const tripModel = require("../models/tripModel");
const leaveModel = require("../models/leaveModel");
const prisma = require("../config/prisma");
const { getOrCreateLocation } = require("./orderHelperService");
const { formatTrip } = require("./trip/tripFormatter");

const getAllTrips = async () => {
  const trips = await tripModel.findAllTrips();
  return (trips || []).map((t) => formatTrip(t));
};

const createTrip = async (payload, userId = 1) => {
  const {
    order_id,
    order_ids,
    order_code,
    truck_id,
    truck_plate,
    driver_id,
    driver_name,
    driver1_name,
    driver2_id,
    driver2_name,
    stops,
    planned_start,
    planned_distance,
    planned_duration,
    allocation_type,
    transport_mode,
    vendor_id,
    vendor_name,
    vendor_tracking_code,
    vendor_cost,
    vendor_vehicles_count,
  } = payload;

  // Tìm đơn hàng thực tế trong DB & kiểm tra trạng thái hợp lệ (chỉ lập chuyến cho đơn READY_FOR_PLANNING, hỗ trợ ghép nhiều đơn order_ids - BUG-SYS-14)
  const rawOrderIdentifiers = Array.isArray(order_ids) && order_ids.length > 0
    ? order_ids
    : (order_id || order_code ? [order_id || order_code] : []);
  if (rawOrderIdentifiers.length === 0) {
    const err = new Error("Vui lòng chọn đơn hàng hợp lệ để lập chuyến.");
    err.statusCode = 400;
    throw err;
  }

  const matchedOrders = [];
  const seenOrderIds = new Set();
  for (const ident of rawOrderIdentifiers) {
    const o = await tripModel.findOrderByCodeOrId(ident);
    if (!o) {
      const err = new Error(`Không tìm thấy đơn hàng ${ident}.`);
      err.statusCode = 404;
      throw err;
    }
    const normSt = String(o.status || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (normSt !== "READY_FOR_PLANNING") {
      const err = new Error(
        `Chỉ có thể lập chuyến cho đơn hàng đang ở trạng thái READY_FOR_PLANNING (đơn ${o.order_code || o.id} hiện ở trạng thái: ${o.status}).`,
      );
      err.statusCode = 400;
      throw err;
    }
    if (!seenOrderIds.has(String(o.id))) {
      seenOrderIds.add(String(o.id));
      matchedOrders.push(o);
    }
  }

  if (matchedOrders.length > 1) {
    const firstCustId = String(matchedOrders[0].customer_id || "");
    const diffCustomer = matchedOrders.some((o) => String(o.customer_id || "") !== firstCustId);
    if (diffCustomer) {
      const err = new Error("Chỉ được ghép các đơn hàng của cùng một khách hàng vào một chuyến.");
      err.statusCode = 400;
      throw err;
    }
    const notAgreed = matchedOrders.find((o) => !o.customer_agrees_to_grouping);
    if (notAgreed) {
      const err = new Error(
        `Đơn hàng ${notAgreed.order_code || notAgreed.id} chưa được khách hàng đồng ý đi ghép chuyến.`,
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const matchedOrder = matchedOrders[0];
  const resolvedOrderId = matchedOrder.id;

  // TRƯỜNG HỢP 1: BÀN GIAO NHÀ XE ĐỐI TÁC 3PL
  const mode = String(
    allocation_type || transport_mode || "INTERNAL",
  ).toUpperCase();
  if (mode === "VENDOR" || Boolean(vendor_tracking_code)) {
    if (!vendor_tracking_code || !String(vendor_tracking_code).trim()) {
      const err = new Error(
        "Vui lòng nhập mã vận đơn đối tác (vendor_tracking_code)",
      );
      err.statusCode = 400;
      throw err;
    }
    const matchedVendor = await tripModel.findVendorByNameOrId(
      vendor_id || vendor_name,
    );
    if (resolvedOrderId) {
      await tripModel.assignOrderToVendor({
        orderId: resolvedOrderId,
        vendorId: matchedVendor?.id || null,
        vendorName:
          vendor_name || matchedVendor?.company_name || "Nhà xe đối tác 3PL",
        vendorTrackingCode: vendor_tracking_code,
        vendorCost: vendor_cost,
        vendorVehicleCount: vendor_vehicles_count,
        userId,
      });
    }

    return {
      id: `3PL-${vendor_tracking_code || Date.now().toString().slice(-4)}`,
      raw_id: resolvedOrderId,
      allocation_type: "VENDOR",
      vendor_name:
        vendor_name || matchedVendor?.company_name || "Nhà xe đối tác 3PL",
      vendor_tracking_code,
      status: "HANDED_OVER_VENDOR",
      order_id: resolvedOrderId,
      order_code: matchedOrder?.order_code || order_code,
    };
  }

  // TRƯỜNG HỢP 2: PHÂN BỔ XE NỘI BỘ & TÀI XẾ
  if (truck_id !== undefined && truck_id !== null && (isNaN(Number(truck_id)) || Number(truck_id) <= 0)) {
    const err = new Error(`Mã xe tải không hợp lệ: ${truck_id}`);
    err.statusCode = 400;
    throw err;
  }
  let truckId = truck_id ? Number(truck_id) : null;
  if (!truckId && truck_plate) {
    truckId = await tripModel.findTruckByPlate(truck_plate);
    if (!truckId) {
      const err = new Error(`Không tìm thấy xe tải với biển số ${truck_plate}`);
      err.statusCode = 400;
      throw err;
    }
  }
  if (!truckId) {
    const err = new Error("Vui lòng chọn xe tải hợp lệ để phân bổ chuyến.");
    err.statusCode = 400;
    throw err;
  }

  // Kiểm tra trạng thái xe (không gán xe đang chạy chuyến khác hoặc đang bảo trì) và tải trọng xe
  let truckRow = null;
  if (truckId && prisma.trucks) {
    truckRow = await prisma.trucks.findUnique({
      where: { id: BigInt(Number(truckId)) },
    });
    if (!truckRow || truckRow.deleted_at) {
      const err = new Error(`Không tìm thấy xe tải với ID ${truckId}`);
      err.statusCode = 400;
      throw err;
    }
    const truckStatusUpper = String(truckRow.status || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (
      [
        "ON_TRIP",
        "IN_TRANSIT",
        "IN_PROGRESS",
        "MAINTENANCE",
        "INACTIVE",
      ].includes(truckStatusUpper)
    ) {
      const err = new Error(
        `Xe tải ${truckRow.plate_number} hiện đang ở trạng thái ${truckRow.status}, không thể phân bổ chuyến mới!`,
      );
      err.statusCode = 400;
      throw err;
    }

    // Kiểm tra xe có đang nằm trong chuyến nào chưa kết thúc không (trip_trucks)
    const activeTripTruck = await prisma.trip_trucks.findFirst({
      where: {
        truck_id: BigInt(Number(truckId)),
        trips: {
          status: {
            in: [
              "Assigned",
              "Accepted",
              "In Progress",
              "In Transit",
              "Loading Started",
              "Loading Done",
            ],
          },
        },
      },
      include: {
        trips: { select: { trip_code: true, status: true } },
      },
    });

    if (activeTripTruck) {
      const err = new Error(
        `Xe tải ${truckRow.plate_number} hiện đang tham gia chuyến ${activeTripTruck.trips?.trip_code || ""} (trạng thái: ${activeTripTruck.trips?.status}), không thể phân bổ chuyến mới!`,
      );
      err.statusCode = 400;
      throw err;
    }

    // Kiểm tra hạn đăng kiểm & bảo hiểm xe (BUG-SYS-11)
    const todayVnStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
    if (truckRow.inspection_expiry) {
      const inspStr = new Date(truckRow.inspection_expiry).toISOString().split("T")[0];
      if (inspStr < todayVnStr) {
        const err = new Error(`Xe tải ${truckRow.plate_number} đã hết hạn đăng kiểm (${inspStr}), không thể điều phối!`);
        err.statusCode = 400;
        throw err;
      }
    }
    if (truckRow.insurance_expiry) {
      const insStr = new Date(truckRow.insurance_expiry).toISOString().split("T")[0];
      if (insStr < todayVnStr) {
        const err = new Error(`Xe tải ${truckRow.plate_number} đã hết hạn bảo hiểm (${insStr}), không thể điều phối!`);
        err.statusCode = 400;
        throw err;
      }
    }

    const totalOrderWeight = matchedOrders.reduce((orderSum, ord) => {
      const cargosArr = Array.isArray(ord?.order_cargos)
        ? ord.order_cargos
        : ord?.order_cargos
          ? [ord.order_cargos]
          : [];
      return orderSum + cargosArr.reduce(
        (sum, c) =>
          sum +
          Math.max(
            Number(c?.actual_weight_kg || 0),
            Number(c?.chargeable_weight_kg || 0),
          ),
        0,
      );
    }, 0);
    const allowedPayload = Number(truckRow.allowed_payload || 0);
    if (allowedPayload > 0 && totalOrderWeight > allowedPayload) {
      const err = new Error(
        `Tổng trọng lượng đơn hàng (${totalOrderWeight} kg) vượt quá tải trọng cho phép của xe ${truckRow.plate_number} (${allowedPayload} kg)!`,
      );
      err.statusCode = 400;
      throw err;
    }
  }

  if (driver_id !== undefined && driver_id !== null && (isNaN(Number(driver_id)) || Number(driver_id) <= 0)) {
    const err = new Error(`Mã tài xế không hợp lệ: ${driver_id}`);
    err.statusCode = 400;
    throw err;
  }
  let driverId = driver_id ? Number(driver_id) : null;
  const targetDriverName = driver_name || driver1_name;
  if (!driverId && targetDriverName) {
    driverId = await tripModel.findDriverByName(targetDriverName);
    if (!driverId) {
      const err = new Error(`Không tìm thấy tài xế ${targetDriverName}`);
      err.statusCode = 400;
      throw err;
    }
  }
  if (!driverId) {
    const err = new Error("Vui lòng chọn tài xế hợp lệ để phân bổ chuyến.");
    err.statusCode = 400;
    throw err;
  }

  const parseFlexiblePlannedStart = (rawVal) => {
    if (!rawVal) return null;
    const str = String(rawVal).trim();
    // 1. Chỉ có giờ HH:mm hoặc HH:mm:ss -> ghép với ngày hôm nay theo múi giờ VN (+07:00)
    const hmOnly = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (hmOnly) {
      const vnToday = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
      const hh = hmOnly[1].padStart(2, "0");
      const mm = hmOnly[2].padStart(2, "0");
      const ss = (hmOnly[3] || "00").padStart(2, "0");
      const dt = new Date(`${vnToday}T${hh}:${mm}:${ss}+07:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    // 2. Định dạng VN DD/MM/YYYY HH:mm
    const vnDateHm = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (vnDateHm) {
      const [, dd, mo, yyyy, h, m, s] = vnDateHm;
      const dt = new Date(`${yyyy}-${mo}-${dd}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(s || "00").padStart(2, "0")}+07:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    // 3. Định dạng YYYY-MM-DD HH:mm (không có timezone)
    const isoSpace = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (isoSpace) {
      const [, ymd, h, m, s] = isoSpace;
      const dt = new Date(`${ymd}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(s || "00").padStart(2, "0")}+07:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const direct = new Date(str);
    return Number.isNaN(direct.getTime()) ? null : direct;
  };

  let resolvedPlannedStart = new Date();
  const parsedExplicitStart = parseFlexiblePlannedStart(planned_start);
  if (parsedExplicitStart) {
    resolvedPlannedStart = parsedExplicitStart;
  } else if (matchedOrder?.requested_pickup_date) {
    const parsedReq = parseFlexiblePlannedStart(matchedOrder.requested_pickup_date);
    if (parsedReq) {
      resolvedPlannedStart = parsedReq;
    }
  }

  // --- KIỂM TRA RÀNG BUỘC TÀI XẾ ---
  if (driverId) {
    const tripStart = resolvedPlannedStart;
    const durationMins = Number(planned_duration) > 0 ? Number(planned_duration) : 60;
    const tripEnd = new Date(tripStart.getTime() + durationMins * 60000);
    const bigDriverId = BigInt(Number(driverId));

    // Kiểm tra trạng thái hồ sơ, hạn GPLX và hạng bằng lái phù hợp với xe
    const driverProfile = await prisma.driver_profiles.findUnique({
      where: { id: bigDriverId },
      select: {
        id: true,
        status: true,
        license_class: true,
        license_expiry: true,
        users: { select: { status: true, full_name: true } },
      },
    });
    if (!driverProfile) {
      const err = new Error(`Không tìm thấy hồ sơ tài xế ID ${driverId}.`);
      err.statusCode = 400;
      throw err;
    }
    const drvStatusUpper = String(driverProfile.status || "")
      .trim()
      .toUpperCase();
    const userStatusUpper = String(driverProfile.users?.status || "ACTIVE")
      .trim()
      .toUpperCase();
    if (
      !["ACTIVE", "AVAILABLE"].includes(drvStatusUpper) ||
      userStatusUpper !== "ACTIVE"
    ) {
      const err = new Error(
        `Tài xế ${driverProfile.users?.full_name || `#${driverId}`} hiện không ở trạng thái sẵn sàng (status: ${driverProfile.status}).`,
      );
      err.statusCode = 400;
      throw err;
    }
    // Kiểm tra tài xế có đang chạy chuyến chưa hoàn thành không (BUG-SYS-12 / WF2-04)
    const activeDriverTrip = await prisma.trip_drivers.findFirst({
      where: {
        driver_id: bigDriverId,
        released_time: null,
        trips: {
          status: {
            in: [
              "Assigned",
              "Accepted",
              "In Progress",
              "In Transit",
              "Loading Started",
              "Loading Done",
            ],
          },
        },
      },
      include: {
        trips: { select: { trip_code: true, status: true } },
      },
    });
    if (activeDriverTrip) {
      const err = new Error(
        `Tài xế ${driverProfile.users?.full_name || `#${driverId}`} hiện đang có chuyến ${activeDriverTrip.trips?.trip_code || ""} chưa hoàn thành (trạng thái: ${activeDriverTrip.trips?.status}), không thể gán chuyến mới!`,
      );
      err.statusCode = 400;
      throw err;
    }

    if (driverProfile.license_expiry) {
      const tripDayStr = new Date(tripStart.getTime() + 7 * 3600 * 1000)
        .toISOString()
        .split("T")[0];
      const expDayStr = new Date(driverProfile.license_expiry)
        .toISOString()
        .split("T")[0];
      if (expDayStr < tripDayStr) {
        const err = new Error(
          `Giấy phép lái xe của tài xế đã hết hạn (${expDayStr}), không thể điều phối chuyến.`,
        );
        err.statusCode = 400;
        throw err;
      }
    }
    if (truckRow?.required_license_class) {
      const LICENSE_RANK = { B2: 1, C: 2, D: 3, E: 4, FC: 5 };
      const drvClass = String(driverProfile.license_class || "")
        .trim()
        .toUpperCase();
      const reqClass = String(truckRow.required_license_class || "")
        .trim()
        .toUpperCase();
      const drvRank = LICENSE_RANK[drvClass] || 0;
      const reqRank = LICENSE_RANK[reqClass] || 0;
      if (reqRank > 0 && drvRank < reqRank) {
        const err = new Error(
          `Tài xế có bằng lái hạng ${drvClass || "N/A"} không đủ điều kiện lái xe ${truckRow.plate_number} (yêu cầu hạng ${reqClass}).`,
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const startVn = new Date(tripStart.getTime() + 7 * 3600 * 1000);
    const tripVnStr = startVn.toISOString().split("T")[0];
    const tripUtcStr = tripStart.toISOString().split("T")[0];
    const targetDates = [...new Set([tripVnStr, tripUtcStr])];
    const targetDateObjs = targetDates.map(
      (d) => new Date(`${d}T00:00:00.000Z`),
    );

    const shifts = await prisma.driver_shifts.findMany({
      where: {
        driver_id: bigDriverId,
        date: { in: targetDateObjs },
      },
      select: {
        id: true,
        date: true,
        status: true,
        start_time: true,
        end_time: true,
      },
    });

    const approvedShifts = (shifts || []).filter(
      (s) => String(s.status || "").toUpperCase() === "APPROVED",
    );

    const toVnMinutes = (d) => {
      const dt = new Date(d);
      const vn = new Date(dt.getTime() + 7 * 3600 * 1000);
      return vn.getUTCHours() * 60 + vn.getUTCMinutes();
    };

    const tripStartMins = toVnMinutes(tripStart);
    const tripEndMins = toVnMinutes(tripEnd);

    const coveringShift = approvedShifts.find((s) => {
      if (!s.start_time || !s.end_time) return true;
      const shiftStartMins = toVnMinutes(s.start_time);
      const shiftEndMins = toVnMinutes(s.end_time);
      // Nếu ca qua đêm (vd 22:00 - 06:00) thì coi như hợp lệ nếu không lệch hoàn toàn
      if (shiftEndMins < shiftStartMins) return true;
      // Kiểm tra ca bao trọn thời gian chuyến (cho phép sai số đầu/cuối 0 phút)
      return shiftStartMins <= tripStartMins && shiftEndMins >= tripEndMins;
    });

    if (!coveringShift) {
      const err = new Error(
        `Tài xế được chọn chưa có Ca làm việc được duyệt (Approved Shift) bao trùm thời gian chạy chuyến!`,
      );
      err.statusCode = 400;
      throw err;
    }
  }

  let secondaryDriverId = driver2_id ? Number(driver2_id) : null;
  if (!secondaryDriverId && driver2_name && String(driver2_name).trim()) {
    secondaryDriverId = await tripModel.findDriverByName(driver2_name);
    if (!secondaryDriverId) {
      const err = new Error(`Không tìm thấy tài xế phụ ${driver2_name}`);
      err.statusCode = 400;
      throw err;
    }
  }
  if (secondaryDriverId) {
    if (Number(secondaryDriverId) === Number(driverId)) {
      const err = new Error("Tài xế 2 phải khác tài xế 1.");
      err.statusCode = 400;
      throw err;
    }
    const activeDriver2Trip = await prisma.trip_drivers.findFirst({
      where: {
        driver_id: BigInt(Number(secondaryDriverId)),
        released_time: null,
        trips: {
          status: {
            in: [
              "Assigned",
              "Accepted",
              "In Progress",
              "In Transit",
              "Loading Started",
              "Loading Done",
            ],
          },
        },
      },
      include: {
        trips: { select: { trip_code: true, status: true } },
      },
    });
    if (activeDriver2Trip) {
      const err = new Error(
        `Tài xế phụ #${secondaryDriverId} hiện đang có chuyến ${activeDriver2Trip.trips?.trip_code || ""} chưa hoàn thành.`,
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const tripCode = `TRIP-${randomNum}`;

  const parsedDistance = parseFloat(planned_distance);
  const parsedDuration = parseInt(planned_duration, 10);
  if (isNaN(parsedDistance) || parsedDistance <= 0) {
    const err = new Error(
      "Vui lòng cung cấp quãng đường dự kiến hợp lệ (planned_distance > 0).",
    );
    err.statusCode = 400;
    throw err;
  }
  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    const err = new Error(
      "Vui lòng cung cấp thời gian dự kiến hợp lệ (planned_duration > 0).",
    );
    err.statusCode = 400;
    throw err;
  }
  // BUG-SYS-13: Chuyến >= 8 giờ (480 phút) bắt buộc có 2 tài xế
  if (parsedDuration >= 480 && !secondaryDriverId) {
    const err = new Error(
      "Chuyến đi có thời gian dự kiến từ 8 giờ (480 phút) trở lên bắt buộc phải phân công 2 tài xế.",
    );
    err.statusCode = 400;
    throw err;
  }

  // Hàm phân giải ETA của từng điểm dừng theo dữ liệu Dispatcher duyệt
  const resolveStopPlannedArrival = (stopObj, idx, totalStops) => {
    const rawExplicit =
      stopObj.planned_arrival ||
      stopObj.eta_iso ||
      stopObj.plannedArrival ||
      stopObj.eta;
    if (rawExplicit) {
      const d = new Date(rawExplicit);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const etaMins = stopObj.etaMinutes ?? stopObj.eta_minutes;
    if (etaMins !== undefined && etaMins !== null && !isNaN(Number(etaMins))) {
      return new Date(resolvedPlannedStart.getTime() + Number(etaMins) * 60000);
    }
    if (stopObj.liveEtaTime && /^\d{1,2}:\d{2}$/.test(String(stopObj.liveEtaTime).trim())) {
      const [hh, mm] = String(stopObj.liveEtaTime).trim().split(":").map(Number);
      const vnDateStr = new Date(resolvedPlannedStart.getTime() + 7 * 3600 * 1000)
        .toISOString()
        .split("T")[0];
      const combined = new Date(`${vnDateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`);
      if (!Number.isNaN(combined.getTime())) return combined;
    }
    const ratio = totalStops > 0 ? (idx + 1) / totalStops : 1;
    return new Date(resolvedPlannedStart.getTime() + Math.round(ratio * parsedDuration) * 60000);
  };

  // Chuẩn bị danh sách điểm dừng thực tế (bỏ qua điểm 'START' bãi xe ảo)
  const rawStops = Array.isArray(stops)
    ? stops.filter(
        (s) => String(s.type || s.stop_type || "").toUpperCase() !== "START",
      )
    : [];

  const resolvedStopsData = [];

  if (rawStops.length > 0) {
    for (let i = 0; i < rawStops.length; i++) {
      const s = rawStops[i];
      const sType = String(s.type || s.stop_type || "").toUpperCase();
      let locId = s.location_id ? Number(s.location_id) : null;

      if (!locId) {
        if (sType === "PICKUP" && matchedOrder?.pickup_location_id) {
          locId = matchedOrder.pickup_location_id;
        } else if (
          (sType === "DROPOFF" || sType === "DROP-OFF") &&
          i === rawStops.length - 1 &&
          matchedOrder?.delivery_location_id &&
          matchedOrder.delivery_location_id !== 1
        ) {
          locId = matchedOrder.delivery_location_id;
        } else {
          const cleanStopAddr = String(s.address || s.name || "")
            .replace(/^(Lấy hàng|Điểm trả\s*\d*|Trả hàng)\s*:\s*/i, "")
            .trim();
          locId = await getOrCreateLocation({
            name: cleanStopAddr || "Điểm dừng vận chuyển",
            address: cleanStopAddr || "Hà Nội",
            customerId: matchedOrder?.customer_id || null,
            lat: s.coords?.lat,
            lng: s.coords?.lng,
          });
        }
      }

      resolvedStopsData.push({
        type:
          sType === "PICKUP"
            ? "Pickup"
            : sType === "REST"
              ? "Rest"
              : "Drop-off",
        location_id: locId || 1,
        order_id: resolvedOrderId,
        planned_arrival: resolveStopPlannedArrival(s, i, rawStops.length),
        status: "Pending",
      });
    }
  } else {
    const totalOrd = matchedOrders.length;
    matchedOrders.forEach((ord, idx) => {
      const pickupFrac = (idx * 2 + 1) / (totalOrd * 2 + 1);
      const dropFrac = (idx * 2 + 2) / (totalOrd * 2 + 1);
      resolvedStopsData.push(
        {
          type: "Pickup",
          location_id: ord?.pickup_location_id || 1,
          order_id: ord.id,
          planned_arrival: new Date(resolvedPlannedStart.getTime() + Math.round(parsedDuration * pickupFrac) * 60000),
          status: "Pending",
        },
        {
          type: "Drop-off",
          location_id: ord?.delivery_location_id || 24,
          order_id: ord.id,
          planned_arrival: new Date(resolvedPlannedStart.getTime() + Math.round(parsedDuration * dropFrac) * 60000),
          status: "Pending",
        },
      );
    });
  }

  const cleanPlate =
    truckRow?.plate_number ||
    (truck_plate ? String(truck_plate).split(" ")[0].trim() : null);
  const cleanDriverName =
    targetDriverName
      ? String(targetDriverName).split("·")[0].trim()
      : null;

  const tripRecord = await tripModel.createTripWithRelations({
    tripData: {
      trip_code: tripCode,
      status: "Assigned",
      planned_start: resolvedPlannedStart,
      planned_distance: parsedDistance,
      planned_duration: parsedDuration,
      created_by: userId,
    },
    truckId,
    driverId,
    secondaryDriverId,
    stopsData: resolvedStopsData,
    orderId: resolvedOrderId,
    orderIds: matchedOrders.map((o) => o.id),
    waybillSnapshot: {
      order_code: matchedOrder?.order_code || order_code,
      customer: matchedOrder?.customers?.company_name || "Khách hàng",
      truck_plate: cleanPlate,
      driver_name: cleanDriverName,
      driver2_name: driver2_name || null,
      planned_distance: parsedDistance,
    },
  });

  // 7. Thông báo cho tài xế về chuyến xe mới (UC-14, UC-29, MSG17)
  const targetDriverIds = [driverId, secondaryDriverId].filter(Boolean);
  if (targetDriverIds.length > 0 && allocation_type !== "VENDOR") {
    try {
      const driverModel = require("../models/driverModel");
      for (const dId of targetDriverIds) {
        const driverProf = await prisma.driver_profiles.findUnique({
          where: { id: BigInt(Number(dId)) },
          select: { user_account_id: true },
        });
        if (driverProf?.user_account_id) {
          await driverModel.createSystemNotification({
            userAccountId: Number(driverProf.user_account_id),
            targetType: "TRIP",
            targetId: tripRecord?.id,
            message: `Bạn được điều phối chuyến xe mới ${tripCode} (${cleanPlate || "Xe tải"}). Hãy kiểm tra lộ trình và sẵn sàng nhận chuyến!`,
          });
        }
      }
    } catch (notifErr) {
      console.warn("Trip assignment notification warning:", notifErr.message);
    }
  }

  // 8. Tự động gửi thông báo điều xe đến Group Zalo của Đội Ops Sân bay Nội Bài
  try {
    const zaloService = require("./zaloService");
    const matchedCargo = Array.isArray(matchedOrder?.order_cargos)
      ? matchedOrder.order_cargos[0]
      : matchedOrder?.order_cargos;
    zaloService
      .sendOpsTripNotification({
        tripCode,
        orderCode: matchedOrder?.order_code || order_code,
        truckPlate: cleanPlate,
        driverName: cleanDriverName,
        driverPhone: "0912.345.678",
        pickupAddress:
          rawStops.find(
            (s) =>
              String(s.type || s.stop_type || "").toUpperCase() === "PICKUP",
          )?.address ||
          matchedOrder?.pickup_address ||
          "Kho ALS Sân Bay Quốc tế Nội Bài",
        deliveryAddress:
          rawStops.find(
            (s) =>
              String(s.type || s.stop_type || "").toUpperCase() === "DROPOFF",
          )?.address ||
          matchedOrder?.delivery_address ||
          "Điểm giao nhận",
        plannedEta: "08:30",
        weightKg: matchedCargo?.actual_weight_kg || 2150,
      })
      .catch((err) =>
        console.warn("[ZaloService] Non-blocking warn:", err.message),
      );
  } catch (zaloErr) {
    console.warn(
      "[ZaloService] Trip notification dispatch warn:",
      zaloErr.message,
    );
  }

  return {
    id: tripCode,
    trip_id: tripCode,
    raw_id: tripRecord.id,
    plate: cleanPlate,
    driver_name: cleanDriverName,
    status: "Assigned",
    order_id: resolvedOrderId,
    order_code: matchedOrder?.order_code || order_code,
  };
};

const updateTripStatus = async (id, status, userId = 1) => {
  const normalized = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const STATUS_MAP = {
    ASSIGNED: "Assigned",
    ACCEPTED: "Accepted",
    IN_TRANSIT: "In Progress",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    DELIVERED: "Completed",
    CANCELLED: "Cancelled",
  };

  const dbStatus = STATUS_MAP[normalized];
  if (!dbStatus) {
    const err = new Error(`Trạng thái chuyến xe không hợp lệ: "${status || ""}".`);
    err.statusCode = 400;
    throw err;
  }

  const updatedTrip = await tripModel.updateTripStatus(id, dbStatus, userId);
  if (!updatedTrip) {
    const err = new Error("Không tìm thấy chuyến xe cần cập nhật.");
    err.statusCode = 404;
    throw err;
  }
  return formatTrip(updatedTrip);
};

const getLeaveReassignments = async (options = {}) => {
  return await leaveModel.getReassignmentsNeededForDispatcher(options);
};

const reassignTripDriver = async (
  tripId,
  { newDriverId, dispatcherUserId, reason } = {},
) => {
  return await leaveModel.reassignDriverOnTrip({
    tripId,
    newDriverId,
    dispatcherUserId,
    reason,
  });
};

const getPublicTripByCode = async (tripCode) => {
  if (!tripCode) return null;
  const trip = await tripModel.findTripByCode(tripCode);
  if (!trip) return null;
  return formatTrip(trip);
};

module.exports = {
  formatTrip,
  getAllTrips,
  createTrip,
  updateTripStatus,
  getLeaveReassignments,
  reassignTripDriver,
  getPublicTripByCode,
};
