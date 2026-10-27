const tripModel = require('../models/tripModel');
const fleetService = require('./fleetService');

const formatTrip = (trip) => {
  const truckObj = trip.trip_trucks?.[0]?.truck || trip.truck || {};
  const driverObj = trip.trip_drivers?.[0]?.driver?.user || trip.driver?.user || {};
  const sortedStops = (trip.stops || []).sort((a, b) => (a.sequence || a.seq || 0) - (b.sequence || b.seq || 0));

  const pickupStop = sortedStops.find(s => (s.stop_type || s.type) === 'PICKUP' || (s.stop_type || s.type) === 'Pickup') || sortedStops[0] || {};
  const dropoffStop = sortedStops.find(s => (s.stop_type || s.type) === 'DROPOFF' || (s.stop_type || s.type) === 'Delivery' || (s.stop_type || s.type) === 'Dropoff') || sortedStops[sortedStops.length - 1] || {};

  const hasIncident = trip.incidents && trip.incidents.length > 0;
  const latestIncident = hasIncident ? trip.incidents[0] : null;

  let progress = 10;
  const upperStatus = (trip.status || '').toUpperCase();
  if (upperStatus === 'COMPLETED') progress = 100;
  else if (upperStatus === 'IN_PROGRESS' || upperStatus === 'IN_TRANSIT') progress = 60;
  else if (upperStatus === 'ASSIGNED') progress = 20;

  return {
    id: trip.trip_code,
    raw_id: trip.id,
    plate: truckObj.plate_number || '29H-123.45',
    truck_model: fleetService.getTruckModelName(truckObj.allowed_payload || truckObj.payload_kg),
    driver_name: driverObj.full_name || 'Nguyễn Văn Tài',
    driver_phone: driverObj.phone || '0901234567',
    orders: [trip.waybill_no || `ORD-${trip.id}`],
    customer: 'Khách hàng vận tải',
    pickup: pickupStop.address || pickupStop.location?.address || pickupStop.location?.name || 'Kho ALS Cảng HKQT Nội Bài',
    dropoff: dropoffStop.address || dropoffStop.location?.address || dropoffStop.location?.name || 'KCN Tiên Sơn, Bắc Ninh',
    planned_start: trip.planned_start ? new Date(trip.planned_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:30',
    planned_finish: '14:30',
    actual_start: trip.planned_start ? new Date(trip.planned_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:42',
    status: (upperStatus === 'IN_PROGRESS' || upperStatus === 'IN_TRANSIT') ? 'IN_TRANSIT' : (upperStatus === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED'),
    is_late_risk: hasIncident,
    late_reason: latestIncident ? latestIncident.description : null,
    has_incident: hasIncident,
    incident_id: latestIncident ? `INC-${latestIncident.id}` : null,
    progress,
    seal_number: `SEAL-VN-${trip.id * 1111}`,
    seal_photo_url: '/assets/hero.png',
    waybill_version: trip.waybill_version || 1,
    stops: sortedStops.length > 0 ? sortedStops.map(s => ({
      id: s.id,
      name: s.location?.name || s.address || 'Điểm dừng',
      type: s.stop_type || s.type,
      planned: (s.planned_arrival || s.eta_at) ? new Date(s.planned_arrival || s.eta_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00',
      actual: (s.actual_arrival || s.arrived_at) ? new Date(s.actual_arrival || s.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Đang di chuyển',
      event: (s.status || '').toUpperCase() === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang di chuyển',
      note: (s.stop_type || s.type) === 'PICKUP' ? 'Đã kẹp chì niêm phong' : 'Chờ giao hàng và ký POD'
    })) : [
      { id: 1, name: 'Kho ALS Cảng HKQT Nội Bài', type: 'PICKUP', planned: '08:30', actual: '08:40', event: 'Đã xuất phát', note: 'Niêm phong chì nguyên vẹn' },
      { id: 2, name: 'Điểm giao nhận', type: 'DROPOFF', planned: '14:30', actual: 'Dự kiến 14:15', event: 'Đang vận chuyển', note: 'Chờ nhận hàng và đối soát POD' }
    ]
  };
};

const getAllTrips = async () => {
  const trips = await tripModel.findAllTrips();
  return (trips || []).map(t => formatTrip(t));
};

const createTrip = async (payload, userId = 3) => {
  const {
    order_id,
    order_code,
    truck_plate,
    driver_name,
    pickup_address,
    dropoff_address,
    allocation_type,
    vendor_name,
    vendor_tracking_code
  } = payload;

  // 1. Tìm xe
  let truckId = null;
  if (truck_plate) {
    truckId = await tripModel.findTruckByPlate(truck_plate);
  }
  if (!truckId) {
    truckId = await tripModel.findFirstTruck();
  }

  // 2. Tìm tài xế
  const driverId = await tripModel.findFirstDriver();

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const tripCode = `TRIP-${randomNum}`;
  const waybillNo = allocation_type === 'VENDOR'
    ? (vendor_tracking_code?.trim() || '')
    : `NEX-${Math.floor(100000 + Math.random() * 900000)}`;

  // 3. Tạo chuyến
  const tripData = {
    trip_code: tripCode,
    status: 'IN_PROGRESS',
    planned_start_at: new Date().toISOString(),
    total_weight_kg: 1500,
    total_volume_m3: 10.5,
    truck_id: truckId,
    driver_id: driverId,
    waybill_no: waybillNo || `NEX-${Math.floor(100000 + Math.random() * 900000)}`,
    waybill_version: 1,
    created_by: userId
  };

  const newTrip = await tripModel.createTrip(tripData);
  const tripId = newTrip.id;

  // 4. Tạo các trạm dừng
  const stops = [
    {
      trip_id: tripId,
      seq: 1,
      type: 'PICKUP',
      location_id: 1,
      address: pickup_address || 'Kho ALS Cảng HKQT Nội Bài',
      status: 'COMPLETED',
      arrived_at: new Date().toISOString()
    },
    {
      trip_id: tripId,
      seq: 2,
      type: 'DROPOFF',
      location_id: 1,
      address: dropoff_address || 'KCN Tiên Sơn, Bắc Ninh',
      status: 'PENDING'
    }
  ];

  const createdStops = await tripModel.createTripStops(stops);

  // 5. Cập nhật đơn hàng
  const cleanOrderId = parseInt(order_id, 10) || null;
  const orderUpdatePayload = {
    status: allocation_type === 'VENDOR' ? 'HANDED_OVER_VENDOR' : 'ASSIGNED'
  };
  if (waybillNo) {
    orderUpdatePayload.order_code = waybillNo;
  }

  const historyPayload = cleanOrderId ? {
    order_id: cleanOrderId,
    from_status: 'READY_FOR_PLANNING',
    to_status: allocation_type === 'VENDOR' ? 'HANDED_OVER_VENDOR' : 'ASSIGNED',
    notes: allocation_type === 'VENDOR'
      ? `Đã phân bổ cho nhà xe đối tác [${vendor_name || 'Đối tác vận tải'}]. Mã vận đơn đối tác: ${waybillNo || 'Chưa nhập'}`
      : `Đã phân bổ chuyến xe ${tripCode} (Xe nội bộ: ${truck_plate || 'Nội bộ'}, Lái xe: ${driver_name || 'Nội bộ'}). Khởi tạo mã vận đơn hệ thống: ${waybillNo}`,
    changed_by: userId
  } : null;

  await tripModel.updateOrderStatusAndHistory({
    orderId: cleanOrderId,
    orderCode: order_code,
    orderUpdatePayload,
    historyPayload
  });

  if (cleanOrderId && createdStops?.[0]) {
    await tripModel.linkTripStopOrder(createdStops[0].id, cleanOrderId);
  }

  // 6. Cập nhật trạng thái xe sang ON_TRIP
  if (truckId) {
    await tripModel.updateTruckStatus(truckId, 'ON_TRIP');
  }

  return {
    id: tripCode,
    raw_id: tripId,
    plate: truck_plate || '29H-123.45',
    driver_name: driver_name || 'Nguyễn Văn Tài',
    status: 'IN_TRANSIT',
    waybill_no: waybillNo
  };
};

const updateTripStatus = async (id, status) => {
  let dbStatus = 'IN_PROGRESS';
  if (status === 'COMPLETED' || status === 'DELIVERED') dbStatus = 'COMPLETED';
  else if (status === 'CANCELLED') dbStatus = 'CANCELLED';

  const updateData = {
    status: dbStatus,
    completed_at: dbStatus === 'COMPLETED' ? new Date().toISOString() : null
  };

  const updatedTrip = await tripModel.updateTripStatus(id, id, updateData);

  if (dbStatus === 'COMPLETED' && updatedTrip) {
    await tripModel.completeTripStopsAndOrders(updatedTrip.id, updatedTrip.truck_id);
  }

  return updatedTrip;
};

module.exports = {
  formatTrip,
  getAllTrips,
  createTrip,
  updateTripStatus
};

