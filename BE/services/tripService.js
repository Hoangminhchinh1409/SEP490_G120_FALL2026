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
    order_code,
    truck_id,
    truck_plate,
    driver_id,
    driver_name,
    driver1_name,
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

  // Tìm đơn hàng thực tế trong DB & kiểm tra trạng thái hợp lệ (chỉ lập chuyến cho đơn READY_FOR_PLANNING)
  const matchedOrder = await tripModel.findOrderByCodeOrId(
    order_id || order_code,
  );
  if ((order_id || order_code) && !matchedOrder) {
    const err = new Error(`Không tìm thấy đơn hàng ${order_id || order_code}.`);
    err.statusCode = 404;
    throw err;
  }
  if (matchedOrder) {
    const normalizedOrderStatus = String(matchedOrder.status || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (normalizedOrderStatus !== "READY_FOR_PLANNING") {
      const err = new Error(
        `Chỉ có thể lập chuyến cho đơn hàng đang ở trạng thái READY_FOR_PLANNING (trạng thái hiện tại: ${matchedOrder.status}).`,
      );
      err.statusCode = 400;
      throw err;
    }
  }
  const resolvedOrderId =
    matchedOrder?.id ||
    (Number.isInteger(Number(order_id)) ? Number(order_id) : null);

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
  let truckId = truck_id ? Number(truck_id) : null;
  if (!truckId && truck_plate) {
    truckId = await tripModel.findTruckByPlate(truck_plate);
    if (!truckId) {
      const err = new Error(`Không tìm thấy xe tải với biển số ${truck_plate}`);
      err.statusCode = 400;
      throw err;
    }
  }
  if (!truckId && !truck_plate) {
    truckId = await tripModel.findFirstTruck();
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

    const cargosArr = Array.isArray(matchedOrder?.order_cargos)
      ? matchedOrder.order_cargos
      : matchedOrder?.order_cargos
        ? [matchedOrder.order_cargos]
        : [];
    const totalOrderWeight = cargosArr.reduce(
      (sum, c) =>
        sum +
        Math.max(
          Number(c?.actual_weight_kg || 0),
          Number(c?.chargeable_weight_kg || 0),
        ),
      0,
    );
    const allowedPayload = Number(truckRow.allowed_payload || 0);
    if (allowedPayload > 0 && totalOrderWeight > allowedPayload) {
      const err = new Error(
        `Tổng trọng lượng đơn hàng (${totalOrderWeight} kg) vượt quá tải trọng cho phép của xe ${truckRow.plate_number} (${allowedPayload} kg)!`,
      );
      err.statusCode = 400;
      throw err;
    }
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
    driverId = await tripModel.findFirstDriver();
  }

  let resolvedPlannedStart = new Date();
  if (planned_start) {
    const parsedStart = new Date(planned_start);
    if (!Number.isNaN(parsedStart.getTime())) {
      resolvedPlannedStart = parsedStart;
    }
  } else if (matchedOrder?.requested_pickup_date) {
    const parsedReq = new Date(matchedOrder.requested_pickup_date);
    if (!Number.isNaN(parsedReq.getTime())) {
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

  let secondaryDriverId = null;
  if (driver2_name) {
    secondaryDriverId = await tripModel.findDriverByName(driver2_name);
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const tripCode = `TRIP-${randomNum}`;

  // Chuẩn bị danh sách điểm dừng thực tế (bỏ qua điểm 'START' bãi xe ảo)
  const rawStops = Array.isArray(stops)
    ? stops.filter(
        (s) => String(s.type || s.stop_type || "").toUpperCase() !== "START",
      )
    : [];

  const resolvedStopsData = [];
  const nowMs = Date.now();

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
        planned_arrival: new Date(nowMs + (i + 1) * 45 * 60000),
        status: "Pending",
      });
    }
  } else {
    resolvedStopsData.push(
      {
        type: "Pickup",
        location_id: matchedOrder?.pickup_location_id || 1,
        order_id: resolvedOrderId,
        planned_arrival: new Date(nowMs + 30 * 60000),
        status: "Pending",
      },
      {
        type: "Drop-off",
        location_id: matchedOrder?.delivery_location_id || 24,
        order_id: resolvedOrderId,
        planned_arrival: new Date(nowMs + 120 * 60000),
        status: "Pending",
      },
    );
  }

  const cleanPlate =
    truckRow?.plate_number ||
    (truck_plate ? String(truck_plate).split(" ")[0].trim() : "29H-995.72");
  const cleanDriverName = targetDriverName
    ? String(targetDriverName).split("·")[0].trim()
    : "Nguyễn Văn Lái";

  const tripRecord = await tripModel.createTripWithRelations({
    tripData: {
      trip_code: tripCode,
      status: "Assigned",
      planned_start: resolvedPlannedStart,
      planned_distance: planned_distance || 65.6,
      planned_duration: planned_duration || 97,
      created_by: userId,
    },
    truckId,
    driverId,
    secondaryDriverId,
    stopsData: resolvedStopsData,
    orderId: resolvedOrderId,
    waybillSnapshot: {
      order_code: matchedOrder?.order_code || order_code,
      customer: matchedOrder?.customers?.company_name || "Khách hàng",
      truck_plate: cleanPlate,
      driver_name: cleanDriverName,
      driver2_name: driver2_name || null,
      planned_distance: planned_distance || 65.6,
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
  let dbStatus = "Assigned";
  const upper = String(status || "").toUpperCase();
  if (upper === "COMPLETED" || upper === "DELIVERED") dbStatus = "Completed";
  else if (
    upper === "IN_TRANSIT" ||
    upper === "IN_PROGRESS" ||
    status === "In Transit"
  )
    dbStatus = "In Progress";
  else if (upper === "CANCELLED") dbStatus = "Cancelled";

  const updatedTrip = await tripModel.updateTripStatus(id, dbStatus, userId);
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
