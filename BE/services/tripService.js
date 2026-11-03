const tripModel = require('../models/tripModel');
const fleetService = require('./fleetService');
const { getOrCreateLocation } = require('./orderHelperService');

const formatTrip = (trip) => {
  // Ưu tiên xe/tài xế đang hoạt động (chưa có released_time), hoặc lấy bản ghi mới nhất
  const activeTruckAssign =
    (trip.trip_trucks || []).find(tt => !tt.released_time && tt.truck) ||
    trip.trip_trucks?.[0] ||
    {};
  const truckObj = activeTruckAssign.truck || trip.truck || {};

  const activeDriverAssign =
    (trip.trip_drivers || []).find(td => !td.released_time && td.driver_role === 'Primary' && td.driver?.user) ||
    (trip.trip_drivers || []).find(td => !td.released_time && td.driver?.user) ||
    trip.trip_drivers?.[0] ||
    {};
  const driverObj = activeDriverAssign.driver?.user || trip.driver?.user || {};

  const sortedStops = (trip.stops || []).sort((a, b) => (a.sequence || a.seq || 0) - (b.sequence || b.seq || 0));

  const pickupStop = sortedStops.find(s => {
    const t = String(s.stop_type || s.type || '').toUpperCase();
    return t === 'PICKUP';
  }) || sortedStops[0] || {};

  const dropoffStops = sortedStops.filter(s => {
    const t = String(s.stop_type || s.type || '').toUpperCase();
    return t === 'DROPOFF' || t === 'DROP-OFF' || t === 'DELIVERY';
  });
  const dropoffStop = dropoffStops[dropoffStops.length - 1] || sortedStops[sortedStops.length - 1] || {};

  // Trích xuất đơn hàng & khách hàng thực tế từ trip_stops
  const stopOrdersMap = new Map();
  sortedStops.forEach(s => {
    if (s.order && s.order.order_code) {
      stopOrdersMap.set(s.order.order_code, s.order);
    }
  });
  const uniqueOrders = [...stopOrdersMap.values()];
  const orderCodes = uniqueOrders.length > 0
    ? uniqueOrders.map(o => o.order_code)
    : [`ORD-${trip.id}`];

  const primaryOrder = uniqueOrders[0] || null;
  const customerName =
    primaryOrder?.customer?.company_name ||
    primaryOrder?.receiver_name ||
    'Khách hàng vận tải';

  // Kiểm tra sự cố đang chờ xử lý (Reported / Pending / Escalated)
  const pendingIncidents = (trip.incidents || []).filter(i => {
    const st = String(i.status || '').toUpperCase();
    return st !== 'RESOLVED' && st !== 'CLOSED';
  });
  const hasIncident = pendingIncidents.length > 0;
  const latestIncident = pendingIncidents[0] || (trip.incidents?.[0] || null);

  const upperStatus = (trip.status || '').toUpperCase().replace(/\s+/g, '_');
  let feStatus = 'IN_TRANSIT';
  let progress = 35;

  const doneStopsCount = sortedStops.filter(s => s.status === 'Done' || s.status === 'Completed').length;
  const arrivedStopsCount = sortedStops.filter(s => s.status === 'Arrived').length;

  if (upperStatus === 'COMPLETED') {
    feStatus = 'COMPLETED';
    progress = 100;
  } else if (upperStatus === 'CANCELLED') {
    feStatus = 'CANCELLED';
    progress = 0;
  } else if (upperStatus === 'IN_PROGRESS' || upperStatus === 'IN_TRANSIT') {
    feStatus = 'IN_TRANSIT';
    if (sortedStops.length > 0 && doneStopsCount > 0) {
      progress = Math.min(95, Math.max(45, Math.round((doneStopsCount / sortedStops.length) * 90)));
    } else {
      progress = 65;
    }
  } else if (upperStatus === 'ACCEPTED' || upperStatus === 'DISPATCHED') {
    feStatus = 'IN_TRANSIT';
    progress = arrivedStopsCount > 0 ? 40 : 30;
  } else {
    // ASSIGNED -> Hiển thị trong tab Giám sát chuyến xe như chuyến đang vận hành (mới khởi tạo 20%)
    feStatus = 'IN_TRANSIT';
    progress = 20;
  }

  // Lấy thông tin seal & POD từ trip_events hoặc delivery_evidences
  let sealNumber = `SEAL-VN-${trip.id * 1111}`;
  let sealPhotoUrl = '/assets/hero.png';
  let podPhotoUrl = null;

  for (const ev of (trip.events || [])) {
    if (ev.payload?.seal_number) sealNumber = ev.payload.seal_number;
    if (ev.payload?.seal_photo_url) sealPhotoUrl = ev.payload.seal_photo_url;
    if (ev.payload?.pod_photo_url) podPhotoUrl = ev.payload.pod_photo_url;
  }
  for (const s of sortedStops) {
    for (const ev of (s.evidences || [])) {
      if (ev.seal_number) sealNumber = ev.seal_number;
      if (ev.type === 'Seal' && ev.file_link) sealPhotoUrl = ev.file_link;
      if (ev.type === 'POD' && ev.file_link) podPhotoUrl = ev.file_link;
    }
  }

  const waybillCount = (trip.waybills || []).length;
  const latestWaybill = trip.waybills?.[0] || null;
  const waybillVersion = latestWaybill?.trip_data_snapshot?.version || Math.max(1, waybillCount);

  const plannedStartObj = trip.planned_start ? new Date(trip.planned_start) : new Date();
  const durationMins = trip.planned_duration || 120;
  const plannedFinishObj = new Date(plannedStartObj.getTime() + durationMins * 60000);

  const cargoWeight = uniqueOrders.reduce((acc, o) => acc + (o.cargo?.actual_weight_kg || 0), 0) || 1200;
  const cargoPackages = uniqueOrders.reduce((acc, o) => acc + (o.cargo?.quantity || 1), 0) || 1;

  // Tọa độ hiện tại để hiển thị bản đồ trực tuyến
  const pickupLat = pickupStop.location?.latitude || 21.2187;
  const pickupLng = pickupStop.location?.longitude || 105.8042;
  const dropoffLat = dropoffStop.location?.latitude || 21.1215;
  const dropoffLng = dropoffStop.location?.longitude || 105.9754;
  const ratio = Math.min(1, Math.max(0, progress / 100));
  const currentLat = truckObj.last_lat || Number((pickupLat + (dropoffLat - pickupLat) * ratio).toFixed(6));
  const currentLng = truckObj.last_lng || Number((pickupLng + (dropoffLng - pickupLng) * ratio).toFixed(6));

  return {
    id: trip.trip_code,
    raw_id: trip.id,
    trip_code: trip.trip_code,
    plate: truckObj.plate_number || '29C-888.99',
    truck_model: truckObj.model || fleetService.getTruckModelName(truckObj.allowed_payload || 3500),
    max_payload: truckObj.allowed_payload || 3500,
    driver_name: driverObj.full_name || 'Nguyễn Văn Lái',
    driver_phone: driverObj.phone || '0912345678',
    orders: orderCodes,
    orders_data: uniqueOrders.map(o => ({
      order_id: o.order_code,
      hawb_code: o.hawb_number || o.order_code,
      customer: o.customer?.company_name || customerName,
      weight: o.cargo?.actual_weight_kg || 700,
      package_count: o.cargo?.quantity || 4,
      length_cm: o.cargo?.length_cm || 100,
      width_cm: o.cargo?.width_cm || 80,
      height_cm: o.cargo?.height_cm || 80,
      dropoff: dropoffStop.location?.address || dropoffStop.location?.name || 'Điểm giao hàng'
    })),
    customer: customerName,
    pickup: pickupStop.location?.address || pickupStop.location?.name || 'Nhà Ga Hàng Hóa ALS Nội Bài',
    dropoff: dropoffStop.location?.address || dropoffStop.location?.name || 'KCN Quế Võ, Bắc Ninh',
    pickup_coords: { lat: pickupLat, lng: pickupLng },
    dropoff_coords: { lat: dropoffLat, lng: dropoffLng },
    current_coords: { lat: currentLat, lng: currentLng },
    planned_start: plannedStartObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    planned_finish: plannedFinishObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    actual_start: plannedStartObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    planned_distance: trip.planned_distance || 50,
    planned_duration: durationMins,
    status: feStatus,
    db_status: trip.status,
    is_late_risk: hasIncident,
    late_reason: latestIncident ? latestIncident.description : null,
    has_incident: hasIncident,
    incident_id: latestIncident ? `INC-${latestIncident.id}` : null,
    progress,
    total_weight: cargoWeight,
    orders_count: cargoPackages,
    seal_number: sealNumber,
    seal_photo_url: sealPhotoUrl,
    pod_photo_url: podPhotoUrl,
    waybill_version: waybillVersion,
    waybill_number: latestWaybill?.waybill_number || `WB-${trip.trip_code}`,
    stops: sortedStops.length > 0 ? sortedStops.map(s => {
      const upperStopType = String(s.stop_type || '').toUpperCase();
      const displayType = upperStopType === 'PICKUP'
        ? 'PICKUP'
        : upperStopType === 'REST'
          ? 'REST'
          : 'DROPOFF';

      const isDone = s.status === 'Done' || s.status === 'Completed';
      const isArrived = s.status === 'Arrived';

      return {
        id: s.id,
        sequence: s.sequence,
        name: s.location?.address || s.location?.name || 'Điểm dừng',
        address: s.location?.address || s.location?.name || 'Điểm dừng',
        coords: {
          lat: s.location?.latitude || 21.15,
          lng: s.location?.longitude || 105.85
        },
        type: displayType,
        raw_type: s.stop_type,
        status: s.status,
        planned: s.planned_arrival
          ? new Date(s.planned_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : '08:30',
        actual: s.actual_arrival
          ? new Date(s.actual_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : (isDone ? 'Đã hoàn thành' : isArrived ? 'Đã đến điểm dừng' : 'Đang di chuyển'),
        event: isDone
          ? 'Đã hoàn thành'
          : isArrived
            ? 'Tài xế đã đến kho'
            : 'Đang thực hiện lộ trình',
        note: displayType === 'PICKUP'
          ? (isDone ? `Đã bốc hàng & kẹp chì ${sealNumber}` : 'Bốc hàng & niêm phong chì tại kho')
          : displayType === 'REST'
            ? 'Điểm dừng nghỉ 15 phút trên tuyến'
            : (isDone ? 'Đã giao hàng & thu nhận biên bản POD' : 'Chờ giao hàng và ký biên bản POD')
      };
    }) : [
      { id: 1, name: 'Nhà Ga Hàng Hóa ALS Nội Bài', type: 'PICKUP', planned: '08:00', actual: '08:10', event: 'Đã xuất phát', note: 'Niêm phong chì nguyên vẹn' },
      { id: 2, name: 'Điểm giao nhận khách hàng', type: 'DROPOFF', planned: '10:30', actual: 'Dự kiến 10:30', event: 'Đang vận chuyển', note: 'Chờ nhận hàng và đối soát POD' }
    ]
  };
};

const getAllTrips = async () => {
  const trips = await tripModel.findAllTrips();
  return (trips || []).map(t => formatTrip(t));
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
    vendor_vehicles_count
  } = payload;

  // Tìm đơn hàng thực tế trong DB
  const matchedOrder = await tripModel.findOrderByCodeOrId(order_id || order_code);
  const resolvedOrderId = matchedOrder?.id || (Number.isInteger(Number(order_id)) ? Number(order_id) : null);

  // TRƯỜNG HỢP 1: BÀN GIAO NHÀ XE ĐỐI TÁC 3PL (UC-10, BR-13)
  const mode = String(allocation_type || transport_mode || 'INTERNAL').toUpperCase();
  if (mode === 'VENDOR' || Boolean(vendor_tracking_code)) {
    const matchedVendor = await tripModel.findVendorByNameOrId(vendor_id || vendor_name);
    if (resolvedOrderId) {
      await tripModel.assignOrderToVendor({
        orderId: resolvedOrderId,
        vendorId: matchedVendor?.id || null,
        vendorName: vendor_name || matchedVendor?.company_name || 'Nhà xe đối tác 3PL',
        vendorTrackingCode: vendor_tracking_code,
        vendorCost: vendor_cost,
        vendorVehicleCount: vendor_vehicles_count,
        userId
      });
    }

    return {
      id: `3PL-${vendor_tracking_code || Date.now().toString().slice(-4)}`,
      raw_id: resolvedOrderId,
      allocation_type: 'VENDOR',
      vendor_name: vendor_name || matchedVendor?.company_name || 'Nhà xe đối tác 3PL',
      vendor_tracking_code,
      status: 'HANDED_OVER_TO_VENDOR',
      order_id: resolvedOrderId,
      order_code: matchedOrder?.order_code || order_code
    };
  }

  // TRƯỜNG HỢP 2: PHÂN BỔ XE NỘI BỘ & TÀI XẾ (UC-06, UC-09, UC-41)
  let truckId = truck_id ? Number(truck_id) : null;
  if (!truckId && truck_plate) {
    truckId = await tripModel.findTruckByPlate(truck_plate);
  }
  if (!truckId) {
    truckId = await tripModel.findFirstTruck();
  }

  let driverId = driver_id ? Number(driver_id) : null;
  const targetDriverName = driver_name || driver1_name;
  if (!driverId && targetDriverName) {
    driverId = await tripModel.findDriverByName(targetDriverName);
  }
  if (!driverId) {
    driverId = await tripModel.findFirstDriver();
  }

  let secondaryDriverId = null;
  if (driver2_name) {
    secondaryDriverId = await tripModel.findDriverByName(driver2_name);
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const tripCode = `TRIP-${randomNum}`;

  // Chuẩn bị danh sách điểm dừng thực tế (bỏ qua điểm 'START' bãi xe ảo)
  const rawStops = Array.isArray(stops)
    ? stops.filter(s => String(s.type || s.stop_type || '').toUpperCase() !== 'START')
    : [];

  const resolvedStopsData = [];
  const nowMs = Date.now();

  if (rawStops.length > 0) {
    for (let i = 0; i < rawStops.length; i++) {
      const s = rawStops[i];
      const sType = String(s.type || s.stop_type || '').toUpperCase();
      let locId = s.location_id ? Number(s.location_id) : null;

      if (!locId) {
        if (sType === 'PICKUP' && matchedOrder?.pickup_location_id) {
          locId = matchedOrder.pickup_location_id;
        } else if ((sType === 'DROPOFF' || sType === 'DROP-OFF') && i === rawStops.length - 1 && matchedOrder?.delivery_location_id && matchedOrder.delivery_location_id !== 1) {
          locId = matchedOrder.delivery_location_id;
        } else {
          const cleanStopAddr = String(s.address || s.name || '')
            .replace(/^(Lấy hàng|Điểm trả\s*\d*|Trả hàng)\s*:\s*/i, '')
            .trim();
          locId = await getOrCreateLocation({
            name: cleanStopAddr || 'Điểm dừng vận chuyển',
            address: cleanStopAddr || 'Hà Nội',
            customerId: matchedOrder?.customer_id || null,
            lat: s.coords?.lat,
            lng: s.coords?.lng
          });
        }
      }

      resolvedStopsData.push({
        type: sType === 'PICKUP' ? 'Pickup' : sType === 'REST' ? 'Rest' : 'Drop-off',
        location_id: locId || 1,
        order_id: resolvedOrderId,
        planned_arrival: new Date(nowMs + (i + 1) * 45 * 60000),
        status: 'Pending'
      });
    }
  } else {
    resolvedStopsData.push(
      {
        type: 'Pickup',
        location_id: matchedOrder?.pickup_location_id || 1,
        order_id: resolvedOrderId,
        planned_arrival: new Date(nowMs + 30 * 60000),
        status: 'Pending'
      },
      {
        type: 'Drop-off',
        location_id: matchedOrder?.delivery_location_id || 24,
        order_id: resolvedOrderId,
        planned_arrival: new Date(nowMs + 120 * 60000),
        status: 'Pending'
      }
    );
  }

  const cleanPlate = truck_plate ? String(truck_plate).split(' ')[0].trim() : '29H-995.72';
  const cleanDriverName = targetDriverName ? String(targetDriverName).split('·')[0].trim() : 'Nguyễn Văn Lái';

  const tripRecord = await tripModel.createTripWithRelations({
    tripData: {
      trip_code: tripCode,
      status: 'Assigned',
      planned_start: new Date(),
      planned_distance: planned_distance || 65.6,
      planned_duration: planned_duration || 97,
      created_by: userId
    },
    truckId,
    driverId,
    secondaryDriverId,
    stopsData: resolvedStopsData,
    orderId: resolvedOrderId,
    waybillSnapshot: {
      order_code: matchedOrder?.order_code || order_code,
      customer: matchedOrder?.customers?.company_name || 'Khách hàng',
      truck_plate: cleanPlate,
      driver_name: cleanDriverName,
      driver2_name: driver2_name || null,
      planned_distance: planned_distance || 65.6
    }
  });

  return {
    id: tripCode,
    trip_id: tripCode,
    raw_id: tripRecord.id,
    plate: cleanPlate,
    driver_name: cleanDriverName,
    status: 'IN_TRANSIT',
    order_id: resolvedOrderId,
    order_code: matchedOrder?.order_code || order_code
  };
};

const updateTripStatus = async (id, status, userId = 1) => {
  let dbStatus = 'Assigned';
  const upper = String(status || '').toUpperCase();
  if (upper === 'COMPLETED' || upper === 'DELIVERED') dbStatus = 'Completed';
  else if (upper === 'IN_TRANSIT' || upper === 'IN_PROGRESS' || status === 'In Transit') dbStatus = 'In Progress';
  else if (upper === 'CANCELLED') dbStatus = 'Cancelled';

  const updatedTrip = await tripModel.updateTripStatus(id, dbStatus, userId);
  return formatTrip(updatedTrip);
};

module.exports = {
  formatTrip,
  getAllTrips,
  createTrip,
  updateTripStatus
};
