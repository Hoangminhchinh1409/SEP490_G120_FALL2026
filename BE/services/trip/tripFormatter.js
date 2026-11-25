const fleetService = require("../fleetService");

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
    uniqueOrders.length > 0 ? uniqueOrders.map((o) => o.order_code) : [];

  const primaryOrder = uniqueOrders[0] || null;
  const customerName =
    primaryOrder?.customer?.company_name ||
    primaryOrder?.receiver_name ||
    null;

  // Kiểm tra sự cố đang chờ xử lý (Reported / Pending / Escalated) — BUG-TR-02: không gắn sự cố đã Resolved/Closed
  const pendingIncidents = (trip.incidents || []).filter((i) => {
    const st = String(i.status || "").toUpperCase();
    return st !== "RESOLVED" && st !== "CLOSED" && st !== "CANCELLED";
  });
  const hasIncident = pendingIncidents.length > 0;
  const latestIncident = pendingIncidents[0] || null;

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
  let sealNumber = null;
  let sealPhotoUrl = null;
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
  const durationMins = trip.planned_duration ?? null;
  const plannedFinishObj = durationMins !== null
    ? new Date(plannedStartObj.getTime() + durationMins * 60000)
    : null;

  const getOrderCargoSummary = (o) => {
    const list = Array.isArray(o?.order_cargos)
      ? o.order_cargos
      : o?.cargo
        ? [o.cargo]
        : [];
    const weight = list.reduce((s, c) => s + (Number(c.actual_weight_kg) || 0), 0);
    const qty = list.reduce((s, c) => s + (Number(c.quantity) || 0), 0);
    const first = list[0] || {};
    return {
      weight: list.length > 0 ? weight : null,
      quantity: list.length > 0 ? qty : null,
      length_cm: first.length_cm !== undefined && first.length_cm !== null ? Number(first.length_cm) : null,
      width_cm: first.width_cm !== undefined && first.width_cm !== null ? Number(first.width_cm) : null,
      height_cm: first.height_cm !== undefined && first.height_cm !== null ? Number(first.height_cm) : null,
    };
  };

  const cargoWeight =
    uniqueOrders.length > 0
      ? uniqueOrders.reduce((acc, o) => acc + (getOrderCargoSummary(o).weight || 0), 0)
      : null;
  const cargoPackages =
    uniqueOrders.length > 0
      ? uniqueOrders.reduce((acc, o) => acc + (getOrderCargoSummary(o).quantity || 0), 0)
      : null;

  // Tọa độ hiện tại để hiển thị bản đồ trực tuyến
  const pickupLat = pickupStop.location?.latitude ?? null;
  const pickupLng = pickupStop.location?.longitude ?? null;
  const dropoffLat = dropoffStop.location?.latitude ?? null;
  const dropoffLng = dropoffStop.location?.longitude ?? null;
  const ratio = Math.min(1, Math.max(0, progress / 100));
  const currentLat =
    truckObj.last_lat ??
    (pickupLat !== null && dropoffLat !== null
      ? Number((pickupLat + (dropoffLat - pickupLat) * ratio).toFixed(6))
      : null);
  const currentLng =
    truckObj.last_lng ??
    (pickupLng !== null && dropoffLng !== null
      ? Number((pickupLng + (dropoffLng - pickupLng) * ratio).toFixed(6))
      : null);

  return {
    id: trip.trip_code,
    raw_id: trip.id,
    trip_code: trip.trip_code,
    plate: truckObj.plate_number || null,
    truck_model:
      truckObj.model ||
      (truckObj.allowed_payload
        ? fleetService.getTruckModelName(truckObj.allowed_payload)
        : null),
    max_payload: truckObj.allowed_payload ?? null,
    driver_name: needsDriverReassign
      ? "Chờ điều phối tài xế mới"
      : driverObj.full_name || null,
    driver_phone: needsDriverReassign ? "" : driverObj.phone || null,
    needs_driver_reassign: needsDriverReassign,
    previous_driver_name: latestReleasedAssign?.driver?.user?.full_name || null,
    leave_reason: latestReleasedAssign?.replacement_reason || null,
    planned_start_iso: trip.planned_start || null,
    orders: orderCodes,
    orders_data: uniqueOrders.map((o) => {
      const hasReturnStop = sortedStops.some(
        (st) =>
          Number(st.order_id) === Number(o.id) &&
          String(st.stop_type || "").toUpperCase() === "RETURN",
      );
      const summary = getOrderCargoSummary(o);
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
        weight: summary.weight,
        package_count: summary.quantity,
        length_cm: summary.length_cm,
        width_cm: summary.width_cm,
        height_cm: summary.height_cm,
        dropoff:
          dropoffStop.location?.address ||
          dropoffStop.location?.name ||
          null,
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
      null,
    dropoff:
      dropoffStop.location?.address ||
      dropoffStop.location?.name ||
      null,
    pickup_coords:
      pickupLat !== null && pickupLng !== null
        ? { lat: pickupLat, lng: pickupLng }
        : null,
    dropoff_coords:
      dropoffLat !== null && dropoffLng !== null
        ? { lat: dropoffLat, lng: dropoffLng }
        : null,
    current_coords:
      currentLat !== null && currentLng !== null
        ? { lat: currentLat, lng: currentLng }
        : null,
    planned_start: trip.planned_start
      ? plannedStartObj.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
    planned_finish: plannedFinishObj
      ? plannedFinishObj.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
    actual_start: trip.planned_start
      ? plannedStartObj.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
    planned_distance: trip.planned_distance ?? null,
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
                  : upperStopType === "RETURN" ||
                      upperStopType === "RETURN_TO_WAREHOUSE"
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
                : null,
              actual: actualText,
              event: eventText,
              note: noteText,
            };
          })
        : [],
  };
};

module.exports = {
  calculateDriverStatusAndProgress,
  formatTrip,
};
