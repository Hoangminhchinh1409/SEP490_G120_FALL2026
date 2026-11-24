const tripModel = require("../models/tripModel");
const fleetService = require("./fleetService");
const leaveModel = require("../models/leaveModel");
const prisma = require("../config/prisma");
const { getOrCreateLocation } = require("./orderHelperService");

/**
 * Tính toán trạng thái thực tế của tài xế và % tiến độ chuẩn xác của chuyến xe
 * Dựa trên trạng thái từng điểm dừng và chuỗi 4 bước sự kiện (Arrived -> Loading Started -> Loading Done -> Left)
 */
const calculateDriverStatusAndProgress = (trip, sortedStops) => {
  const upperStatus = (trip.status || "").toUpperCase().replace(/\s+/g, "_");
  const nStops = sortedStops.length;

  // 1. Trường hợp đặc biệt: Hủy chuyến hoặc Hoàn thành chuyến
  if (upperStatus === "CANCELLED") {
    return {
      progress: 0,
      driver_status_code: "CANCELLED",
      driver_status_label: "Chuyến xe đã hủy",
      driver_status_color: "default",
      driver_current_step: null,
      current_stop_info: null,
    };
  }

  if (upperStatus === "COMPLETED") {
    return {
      progress: 100,
      driver_status_code: "COMPLETED",
      driver_status_label: "Chuyến xe hoàn tất",
      driver_status_color: "success",
      driver_current_step: "4/4",
      current_stop_info: null,
    };
  }

  // 2. Nếu chuyến chưa có điểm dừng cấu hình
  if (nStops === 0) {
    if (upperStatus === "ASSIGNED") {
      return {
        progress: 10,
        driver_status_code: "ASSIGNED",
        driver_status_label: "Chờ tài xế nhận chuyến",
        driver_status_color: "blue",
        driver_current_step: null,
        current_stop_info: null,
      };
    }
    return {
      progress: 50,
      driver_status_code: "IN_TRANSIT",
      driver_status_label: "Đang vận hành lộ trình",
      driver_status_color: "processing",
      driver_current_step: null,
      current_stop_info: null,
    };
  }

  // 3. Tìm điểm dừng hiện tại (điểm dừng đầu tiên chưa Done/Completed/Skipped)
  const currentStopIndex = sortedStops.findIndex((s) => {
    const st = String(s.status || "")
      .toLowerCase()
      .trim();
    return st !== "done" && st !== "completed" && st !== "skipped";
  });

  // Nếu tất cả các điểm dừng đã Done nhưng chuyến chưa bấm hoàn thành
  if (currentStopIndex === -1) {
    // Kiểm tra xem có đơn hàng nào đang ở DELIVERED_EXCEPTION nhưng chưa đóng (chờ điều về kho ALS) không
    const unclosedRefusedStop = sortedStops.find((s) => {
      const ordSt = String(s.order?.status || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_");
      return ordSt === "DELIVERED_EXCEPTION" && !s.order?.is_closed;
    });
    if (unclosedRefusedStop) {
      return {
        progress: 85,
        driver_status_code: "REFUSED_WAITING_REDIRECT",
        driver_status_label: `Khách từ chối đơn ${unclosedRefusedStop.order?.order_code || ""} — Chờ điều về kho ALS`,
        driver_status_color: "error",
        driver_current_step: "Exception",
        current_stop_info: null,
      };
    }
    return {
      progress: 95,
      driver_status_code: "ALL_STOPS_DONE",
      driver_status_label: "Đã hoàn thành các điểm dừng (Chờ đóng chuyến)",
      driver_status_color: "success",
      driver_current_step: "4/4",
      current_stop_info: null,
    };
  }

  const currentStop = sortedStops[currentStopIndex];
  const stopSeq = currentStop.sequence || currentStopIndex + 1;
  const rawType = String(currentStop.stop_type || "").toUpperCase();
  const isReturn = rawType === "RETURN" || rawType === "RETURN_TO_WAREHOUSE";
  const isPickup = !isReturn && (rawType === "PICKUP" || stopSeq === 1);
  const isDropoff =
    !isPickup &&
    !isReturn &&
    (rawType === "DROPOFF" || rawType === "DELIVERY" || stopSeq === nStops);
  const stopTypeName = isReturn
    ? "Hoàn về kho ALS"
    : isPickup
      ? "Lấy hàng"
      : isDropoff
        ? "Giao hàng"
        : "Điểm dừng";
  const stopLocName =
    currentStop.location?.name ||
    currentStop.location?.address ||
    `Điểm #${stopSeq}`;

  // Chuẩn hóa trạng thái của stop (kết hợp với trip_events mới nhất nếu có)
  let stopStatus = String(currentStop.status || "Pending").trim();
  if (trip.events && trip.events.length > 0) {
    const stopEvents = trip.events
      .filter((e) => Number(e.trip_stop_id) === Number(currentStop.id))
      .sort(
        (a, b) =>
          new Date(b.created_at || b.phone_time || 0) -
          new Date(a.created_at || a.phone_time || 0),
      );
    if (stopEvents.length > 0) {
      const latestEvType = stopEvents[0].event_type;
      if (latestEvType === "Left") {
        stopStatus = "Done";
      } else if (latestEvType === "Loading Done" && stopStatus !== "Done") {
        stopStatus = "Loading Done";
      } else if (
        latestEvType === "Loading Started" &&
        stopStatus !== "Done" &&
        stopStatus !== "Loading Done"
      ) {
        stopStatus = "Loading Started";
      } else if (latestEvType === "Arrived" && stopStatus === "Pending") {
        stopStatus = "Arrived";
      }
    }
  }

  // Chia đều dải tiến độ từ 10% đến 95% (tổng 85%) cho nStops điểm dừng
  const slice = 85 / nStops;
  const baseProgress = 10 + currentStopIndex * slice;

  // Nếu là điểm đầu tiên và chuyến xe mới chỉ ở trạng thái ASSIGNED (chưa nhận chuyến)
  if (
    currentStopIndex === 0 &&
    stopStatus === "Pending" &&
    upperStatus === "ASSIGNED"
  ) {
    return {
      progress: 10,
      driver_status_code: "WAITING_ACCEPT",
      driver_status_label: "Chờ tài xế xác nhận nhận chuyến",
      driver_status_color: "gold",
      driver_current_step: "0/4",
      current_stop_info: {
        sequence: stopSeq,
        name: stopLocName,
        type: stopTypeName,
        status: "Chờ nhận",
      },
    };
  }

  let stopFraction = 0.15;
  let statusCode = "MOVING_TO_STOP";
  let statusLabel = isReturn
    ? `Đang hoàn hàng về Kho ALS (${stopLocName})`
    : currentStopIndex === 0
      ? `Đang di chuyển tới Điểm #1 (Kho lấy hàng)`
      : `Đang di chuyển tới Điểm #${stopSeq} (Điểm giao)`;
  let statusColor = isReturn ? "volcano" : "blue";
  let stepLabel = "0/4";

  switch (stopStatus) {
    case "Arrived":
      stopFraction = 0.4;
      statusCode = "ARRIVED";
      statusLabel = isReturn
        ? `Đã về tới Kho ALS (#${stopSeq} - Chờ hạ hàng hoàn)`
        : isPickup
          ? `Đã đến Điểm #${stopSeq} (Chờ bốc hàng)`
          : `Đã đến Điểm #${stopSeq} (Chờ dỡ hàng)`;
      statusColor = isReturn ? "volcano" : "cyan";
      stepLabel = "1/4";
      break;

    case "Loading Started":
      stopFraction = 0.65;
      statusCode = "LOADING_STARTED";
      statusLabel = isReturn
        ? `Đang hạ hàng hoàn tại Kho ALS (#${stopSeq})`
        : isPickup
          ? `Đang bốc hàng tại Điểm #${stopSeq}`
          : `Đang dỡ hàng tại Điểm #${stopSeq}`;
      statusColor = "orange";
      stepLabel = "2/4";
      break;

    case "Loading Done":
      stopFraction = 0.85;
      statusCode = "LOADING_DONE";
      statusLabel = isReturn
        ? `Đã hạ hàng hoàn vào Kho ALS (#${stopSeq})`
        : isPickup
          ? `Đã bốc xong Điểm #${stopSeq} (Chờ rời đi)`
          : `Đã dỡ hàng & ký POD (Chờ rời đi)`;
      statusColor = "purple";
      stepLabel = "3/4";
      break;

    case "Done":
      stopFraction = 1.0;
      statusCode = "STOP_DONE";
      statusLabel = `Đã hoàn thành Điểm #${stopSeq}`;
      statusColor = "success";
      stepLabel = "4/4";
      break;

    case "Pending":
    default:
      stopFraction = 0.15;
      statusCode = "MOVING_TO_STOP";
      stepLabel = "0/4";
      break;
  }

  const computedProgress = Math.min(
    95,
    Math.max(10, Math.round(baseProgress + stopFraction * slice)),
  );

  return {
    progress: computedProgress,
    driver_status_code: statusCode,
    driver_status_label: statusLabel,
    driver_status_color: statusColor,
    driver_current_step: stepLabel,
    current_stop_info: {
      sequence: stopSeq,
      name: stopLocName,
      type: stopTypeName,
      status: stopStatus,
    },
  };
};

const formatTrip = (trip) => {
  // Ưu tiên xe/tài xế đang hoạt động (chưa có released_time), hoặc lấy bản ghi mới nhất
  const activeTruckAssign =
    (trip.trip_trucks || []).find((tt) => !tt.released_time && tt.truck) ||
    trip.trip_trucks?.[0] ||
    {};
  const truckObj = activeTruckAssign.truck || trip.truck || {};

  const activeDriverAssign =
    (trip.trip_drivers || []).find(
      (td) =>
        !td.released_time && td.driver_role === "Primary" && td.driver?.user,
    ) ||
    (trip.trip_drivers || []).find(
      (td) => !td.released_time && td.driver?.user,
    ) ||
    trip.trip_drivers?.[0] ||
    {};
  const driverObj = activeDriverAssign.driver?.user || trip.driver?.user || {};
  const hasUnreleasedDriver = (trip.trip_drivers || []).some(
    (td) => !td.released_time,
  );
  const releasedDrivers = (trip.trip_drivers || []).filter(
    (td) => td.released_time,
  );
  const needsDriverReassign =
    !hasUnreleasedDriver &&
    releasedDrivers.length > 0 &&
    !["COMPLETED", "CANCELLED"].includes((trip.status || "").toUpperCase());
  const latestReleasedAssign = releasedDrivers[0] || null;

  const sortedStops = (trip.stops || []).sort(
    (a, b) => (a.sequence || a.seq || 0) - (b.sequence || b.seq || 0),
  );

  const pickupStop =
    sortedStops.find((s) => {
      const t = String(s.stop_type || s.type || "").toUpperCase();
      return t === "PICKUP";
    }) ||
    sortedStops[0] ||
    {};

  const dropoffStops = sortedStops.filter((s) => {
    const t = String(s.stop_type || s.type || "").toUpperCase();
    return t === "DROPOFF" || t === "DROP-OFF" || t === "DELIVERY";
  });
  const dropoffStop =
    dropoffStops[dropoffStops.length - 1] ||
    sortedStops[sortedStops.length - 1] ||
    {};

  // Trích xuất đơn hàng & khách hàng thực tế từ trip_stops
  const stopOrdersMap = new Map();
  sortedStops.forEach((s) => {
    if (s.order && s.order.order_code) {
      stopOrdersMap.set(s.order.order_code, s.order);
    }
  });
  const uniqueOrders = [...stopOrdersMap.values()];
  const orderCodes =
    uniqueOrders.length > 0
      ? uniqueOrders.map((o) => o.order_code)
      : [`ORD-${trip.id}`];

  const primaryOrder = uniqueOrders[0] || null;
  const customerName =
    primaryOrder?.customer?.company_name ||
    primaryOrder?.receiver_name ||
    "Khách hàng vận tải";

  // Kiểm tra sự cố đang chờ xử lý (Reported / Pending / Escalated)
  const pendingIncidents = (trip.incidents || []).filter((i) => {
    const st = String(i.status || "").toUpperCase();
    return st !== "RESOLVED" && st !== "CLOSED";
  });
  const hasIncident = pendingIncidents.length > 0;
  const latestIncident = pendingIncidents[0] || trip.incidents?.[0] || null;

  const upperStatus = (trip.status || "").toUpperCase().replace(/\s+/g, "_");
  let feStatus = "IN_TRANSIT";
  if (upperStatus === "COMPLETED") {
    feStatus = "COMPLETED";
  } else if (upperStatus === "CANCELLED") {
    feStatus = "CANCELLED";
  } else {
    feStatus = "IN_TRANSIT";
  }

  // TÍNH TOÁN TIẾN ĐỘ THỰC TẾ & TRẠNG THÁI TÀI XẾ
  const driverState = calculateDriverStatusAndProgress(trip, sortedStops);
  const progress = driverState.progress;

  // Lấy thông tin seal & POD từ trip_events hoặc delivery_evidences
  let sealNumber = `SEAL-VN-${trip.id * 1111}`;
  let sealPhotoUrl = "/assets/hero.png";
  let podPhotoUrl = null;

  for (const ev of trip.events || []) {
    if (ev.payload?.seal_number) sealNumber = ev.payload.seal_number;
    if (ev.payload?.seal_photo_url) sealPhotoUrl = ev.payload.seal_photo_url;
    if (ev.payload?.pod_photo_url) podPhotoUrl = ev.payload.pod_photo_url;
  }
  for (const s of sortedStops) {
    for (const ev of s.evidences || []) {
      if (ev.seal_number) sealNumber = ev.seal_number;
      const evType = String(ev.evidence_type || ev.type || "").toUpperCase();
      const link = ev.file_url || ev.file_link;
      if ((evType === "SEAL" || evType.includes("SEAL")) && link)
        sealPhotoUrl = link;
      if ((evType === "POD" || evType.includes("POD")) && link)
        podPhotoUrl = link;
    }
  }

  const waybillCount = (trip.waybills || []).length;
  const latestWaybill = trip.waybills?.[0] || null;
  const waybillVersion =
    latestWaybill?.trip_data_snapshot?.version || Math.max(1, waybillCount);

  const plannedStartObj = trip.planned_start
    ? new Date(trip.planned_start)
    : new Date();
  const durationMins = trip.planned_duration || 120;
  const plannedFinishObj = new Date(
    plannedStartObj.getTime() + durationMins * 60000,
  );

  const cargoWeight =
    uniqueOrders.reduce(
      (acc, o) => acc + (o.cargo?.actual_weight_kg || 0),
      0,
    ) || 1200;
  const cargoPackages =
    uniqueOrders.reduce((acc, o) => acc + (o.cargo?.quantity || 1), 0) || 1;

  // Tọa độ hiện tại để hiển thị bản đồ trực tuyến
  const pickupLat = pickupStop.location?.latitude || 21.2187;
  const pickupLng = pickupStop.location?.longitude || 105.8042;
  const dropoffLat = dropoffStop.location?.latitude || 21.1215;
  const dropoffLng = dropoffStop.location?.longitude || 105.9754;
  const ratio = Math.min(1, Math.max(0, progress / 100));
  const currentLat =
    truckObj.last_lat ||
    Number((pickupLat + (dropoffLat - pickupLat) * ratio).toFixed(6));
  const currentLng =
    truckObj.last_lng ||
    Number((pickupLng + (dropoffLng - pickupLng) * ratio).toFixed(6));

  return {
    id: trip.trip_code,
    raw_id: trip.id,
    trip_code: trip.trip_code,
    plate: truckObj.plate_number || "29C-888.99",
    truck_model:
      truckObj.model ||
      fleetService.getTruckModelName(truckObj.allowed_payload || 3500),
    max_payload: truckObj.allowed_payload || 3500,
    driver_name: needsDriverReassign
      ? "Chờ điều phối tài xế mới"
      : driverObj.full_name || "Nguyễn Văn Lái",
    driver_phone: needsDriverReassign ? "" : driverObj.phone || "0912345678",
    needs_driver_reassign: needsDriverReassign,
    previous_driver_name: latestReleasedAssign?.driver?.user?.full_name || null,
    leave_reason: latestReleasedAssign?.replacement_reason || null,
    planned_start_iso: trip.planned_start || null,
    // duplicate phone removed
    orders: orderCodes,
    orders_data: uniqueOrders.map((o) => {
      const hasReturnStop = sortedStops.some(
        (st) =>
          Number(st.order_id) === Number(o.id) &&
          String(st.stop_type || "").toUpperCase() === "RETURN",
      );
      return {
        id: o.id,
        order_id: o.order_code,
        order_type: o.order_type || "Import",
        status: o.status,
        is_closed: Boolean(o.is_closed),
        refusal_reason: o.refusal_reason || null,
        refusal_photo: o.refusal_photo || null,
        warehouse_name: o.warehouse_name || null,
        has_return_stop: hasReturnStop,
        customer: o.customer?.company_name || customerName,
        weight: o.cargo?.actual_weight_kg || 700,
        package_count: o.cargo?.quantity || 4,
        length_cm: o.cargo?.length_cm || 100,
        width_cm: o.cargo?.width_cm || 80,
        height_cm: o.cargo?.height_cm || 80,
        dropoff:
          dropoffStop.location?.address ||
          dropoffStop.location?.name ||
          "Điểm giao hàng",
      };
    }),
    has_refusal_exception: uniqueOrders.some(
      (o) =>
        String(o.status || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_") === "DELIVERED_EXCEPTION" &&
        !o.is_closed,
    ),
    refused_orders: uniqueOrders
      .filter(
        (o) =>
          String(o.status || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_") === "DELIVERED_EXCEPTION",
      )
      .map((o) => ({
        id: o.id,
        order_code: o.order_code,
        order_type: o.order_type || "Import",
        is_closed: Boolean(o.is_closed),
        refusal_reason: o.refusal_reason || null,
        refusal_photo: o.refusal_photo || null,
        warehouse_name: o.warehouse_name || null,
        has_return_stop: sortedStops.some(
          (st) =>
            Number(st.order_id) === Number(o.id) &&
            String(st.stop_type || "").toUpperCase() === "RETURN",
        ),
      })),
    customer: customerName,
    pickup:
      pickupStop.location?.address ||
      pickupStop.location?.name ||
      "Nhà Ga Hàng Hóa ALS Nội Bài",
    dropoff:
      dropoffStop.location?.address ||
      dropoffStop.location?.name ||
      "KCN Quế Võ, Bắc Ninh",
    pickup_coords: { lat: pickupLat, lng: pickupLng },
    dropoff_coords: { lat: dropoffLat, lng: dropoffLng },
    current_coords: { lat: currentLat, lng: currentLng },
    planned_start: plannedStartObj.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    planned_finish: plannedFinishObj.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    actual_start: plannedStartObj.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    planned_distance: trip.planned_distance || 50,
    planned_duration: durationMins,
    status: feStatus,
    db_status: trip.status,
    is_late_risk: hasIncident,
    late_reason: latestIncident ? latestIncident.description : null,
    has_incident: hasIncident,
    incident_id: latestIncident ? `INC-${latestIncident.id}` : null,
    progress,
    driver_status_code: driverState.driver_status_code,
    driver_status_label: driverState.driver_status_label,
    driver_status_color: driverState.driver_status_color,
    driver_current_step: driverState.driver_current_step,
    current_stop_info: driverState.current_stop_info,
    total_weight: cargoWeight,
    orders_count: cargoPackages,
    seal_number: sealNumber,
    seal_photo_url: sealPhotoUrl,
    pod_photo_url: podPhotoUrl,
    waybill_version: waybillVersion,
    waybill_number: latestWaybill?.waybill_number || `WB-${trip.trip_code}`,
    stops:
      sortedStops.length > 0
        ? sortedStops.map((s) => {
            const upperStopType = String(s.stop_type || "").toUpperCase();
            const displayType =
              upperStopType === "PICKUP"
                ? "PICKUP"
                : upperStopType === "REST"
                  ? "REST"
                  : upperStopType === "RETURN" || upperStopType === "RETURN_TO_WAREHOUSE"
                    ? "RETURN"
                    : "DROPOFF";

            const isDone = s.status === "Done" || s.status === "Completed";
            const isArrived = s.status === "Arrived";
            const isLoadingStarted = s.status === "Loading Started";
            const isLoadingDone = s.status === "Loading Done";

            let actualText = "Đang di chuyển";
            if (s.actual_arrival) {
              actualText = new Date(s.actual_arrival).toLocaleTimeString(
                "vi-VN",
                { hour: "2-digit", minute: "2-digit" },
              );
            } else if (isDone) {
              actualText = "Đã hoàn thành";
            } else if (isLoadingDone) {
              actualText =
                displayType === "PICKUP" ? "Đã bốc xong" : "Đã dỡ xong";
            } else if (isLoadingStarted) {
              actualText =
                displayType === "PICKUP" ? "Đang bốc hàng" : "Đang dỡ hàng";
            } else if (isArrived) {
              actualText = "Đã đến nơi";
            }

            let eventText = "Đang thực hiện lộ trình";
            if (isDone) {
              eventText = "Đã hoàn thành điểm dừng (Rời đi)";
            } else if (isLoadingDone) {
              eventText =
                displayType === "PICKUP"
                  ? "Đã bốc hàng xong & kẹp chì"
                  : "Đã dỡ hàng & ký biên bản POD";
            } else if (isLoadingStarted) {
              eventText =
                displayType === "PICKUP"
                  ? "Đang bốc hàng lên xe"
                  : "Đang dỡ hàng xuống kho";
            } else if (isArrived) {
              eventText = "Tài xế đã đến điểm dừng";
            }

            let noteText =
              displayType === "PICKUP"
                ? isDone
                  ? `Đã bốc hàng & kẹp chì ${sealNumber}`
                  : isLoadingDone
                    ? `Đã niêm chì ${sealNumber} (Chờ rời đi)`
                    : "Bốc hàng & niêm phong chì tại kho"
                : displayType === "REST"
                  ? "Điểm dừng nghỉ 15 phút trên tuyến"
                  : isDone
                    ? "Đã giao hàng & thu nhận biên bản POD"
                    : isLoadingDone
                      ? "Đã nhận đủ chữ ký POD (Chờ rời đi)"
                      : "Chờ giao hàng và ký biên bản POD";

            return {
              id: s.id,
              sequence: s.sequence,
              name: s.location?.address || s.location?.name || "Điểm dừng",
              address: s.location?.address || s.location?.name || "Điểm dừng",
              coords: {
                lat: s.location?.latitude || 21.15,
                lng: s.location?.longitude || 105.85,
              },
              type: displayType,
              raw_type: s.stop_type,
              status: s.status,
              planned: s.planned_arrival
                ? new Date(s.planned_arrival).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "08:30",
              actual: actualText,
              event: eventText,
              note: noteText,
            };
          })
        : [
            {
              id: 1,
              name: "Nhà Ga Hàng Hóa ALS Nội Bài",
              type: "PICKUP",
              planned: "08:00",
              actual: "08:10",
              event: "Đã xuất phát",
              note: "Niêm phong chì nguyên vẹn",
            },
            {
              id: 2,
              name: "Điểm giao nhận khách hàng",
              type: "DROPOFF",
              planned: "10:30",
              actual: "Dự kiến 10:30",
              event: "Đang vận chuyển",
              note: "Chờ nhận hàng và đối soát POD",
            },
          ],
  };
};

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

  // Tìm đơn hàng thực tế trong DB
  const matchedOrder = await tripModel.findOrderByCodeOrId(
    order_id || order_code,
  );
  const resolvedOrderId =
    matchedOrder?.id ||
    (Number.isInteger(Number(order_id)) ? Number(order_id) : null);

  // TRƯỜNG HỢP 1: BÀN GIAO NHÀ XE ĐỐI TÁC 3PL
  const mode = String(
    allocation_type || transport_mode || "INTERNAL",
  ).toUpperCase();
  if (mode === "VENDOR" || Boolean(vendor_tracking_code)) {
    if (!vendor_tracking_code || !String(vendor_tracking_code).trim()) {
      const err = new Error("Vui lòng nhập mã vận đơn đối tác (vendor_tracking_code)");
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
    if (!truckRow) {
      const err = new Error(`Không tìm thấy xe tải với ID ${truckId}`);
      err.statusCode = 400;
      throw err;
    }
    const truckStatusUpper = String(truckRow.status || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (
      ["ON_TRIP", "IN_TRANSIT", "IN_PROGRESS", "MAINTENANCE"].includes(
        truckStatusUpper,
      )
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
            in: ["Assigned", "Accepted", "In Progress", "In Transit", "Loading Started", "Loading Done"]
          }
        }
      },
      include: {
        trips: { select: { trip_code: true, status: true } }
      }
    });

    if (activeTripTruck) {
      const err = new Error(
        `Xe tải ${truckRow.plate_number} hiện đang tham gia chuyến ${activeTripTruck.trips?.trip_code || ''} (trạng thái: ${activeTripTruck.trips?.status}), không thể phân bổ chuyến mới!`,
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

  // --- KIỂM TRA RÀNG BUỘC TÀI XẾ ---
  if (driverId) {
    const tripStart = payload.planned_start ? new Date(payload.planned_start) : new Date();
    const durationMins = Number(planned_duration) > 0 ? Number(planned_duration) : 60;
    const tripEnd = new Date(tripStart.getTime() + durationMins * 60000);

    const startVn = new Date(tripStart.getTime() + 7 * 3600 * 1000);
    const tripVnStr = startVn.toISOString().split("T")[0];
    const tripUtcStr = tripStart.toISOString().split("T")[0];
    const targetDates = [...new Set([tripVnStr, tripUtcStr])];
    const targetDateObjs = targetDates.map((d) => new Date(`${d}T00:00:00.000Z`));
    const bigDriverId = BigInt(Number(driverId));

    const shifts = await prisma.driver_shifts.findMany({
      where: {
        driver_id: bigDriverId,
        date: { in: targetDateObjs },
      },
      select: { id: true, date: true, status: true, start_time: true, end_time: true },
    });

    const approvedShifts = (shifts || []).filter((s) => String(s.status || "").toUpperCase() === "APPROVED");

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

  const cleanPlate = truckRow?.plate_number || (truck_plate
    ? String(truck_plate).split(" ")[0].trim()
    : "29H-995.72");
  const cleanDriverName = targetDriverName
    ? String(targetDriverName).split("·")[0].trim()
    : "Nguyễn Văn Lái";

  const tripRecord = await tripModel.createTripWithRelations({
    tripData: {
      trip_code: tripCode,
      status: "Assigned",
      planned_start: new Date(),
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
      const prisma = require("../config/prisma");
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
