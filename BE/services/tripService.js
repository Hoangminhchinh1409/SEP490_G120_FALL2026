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
    plate: truckObj.plate_number || '29C-888.99',
    truck_model: fleetService.getTruckModelName(truckObj.allowed_payload || 5000),
    driver_name: driverObj.full_name || 'Nguyễn Văn Lái',
    driver_phone: driverObj.phone || '0912345678',
    orders: [`ORD-${trip.id}`],
    customer: 'Khách hàng vận tải',
    pickup: pickupStop.location?.address || pickupStop.location?.name || pickupStop.address || 'Kho ALS Cảng HKQT Nội Bài',
    dropoff: dropoffStop.location?.address || dropoffStop.location?.name || dropoffStop.address || 'KCN Quế Võ, Bắc Ninh',
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
    waybill_version: 1,
    stops: sortedStops.length > 0 ? sortedStops.map(s => ({
      id: s.id,
      name: s.location?.name || s.location?.address || 'Điểm dừng',
      type: s.stop_type,
      planned: s.planned_arrival ? new Date(s.planned_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00',
      actual: s.actual_arrival ? new Date(s.actual_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Đang di chuyển',
      event: s.status === 'Completed' ? 'Đã hoàn thành' : 'Đang di chuyển',
      note: s.stop_type === 'PICKUP' ? 'Đã kẹp chì niêm phong' : 'Chờ giao hàng và ký POD'
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

const createTrip = async (payload, userId = 1) => {
  const {
    order_id,
    order_code,
    truck_plate,
    driver_name,
    driver1_name,
    stops,
    planned_distance,
    planned_duration,
    allocation_type,
    vendor_name,
    vendor_tracking_code
  } = payload;

  let truckId = null;
  if (truck_plate) {
    truckId = await tripModel.findTruckByPlate(truck_plate);
  }
  if (!truckId) {
    truckId = await tripModel.findFirstTruck();
  }

  let driverId = null;
  const targetDriverName = driver_name || driver1_name;
  if (targetDriverName) {
    driverId = await tripModel.findDriverByName(targetDriverName);
  }
  if (!driverId) {
    driverId = await tripModel.findFirstDriver();
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const tripCode = `TRIP-${randomNum}`;

  const stopsData = Array.isArray(stops) && stops.length > 0 ? stops : [
    { type: 'PICKUP', location_id: 1, planned_arrival: new Date() },
    { type: 'DROPOFF', location_id: 24, planned_arrival: new Date(Date.now() + 3600000 * 2) }
  ];

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
    stopsData,
    orderId: order_id
  });

  return {
    id: tripCode,
    raw_id: tripRecord.id,
    plate: truck_plate || '29C-888.99',
    driver_name: targetDriverName || 'Nguyễn Văn Lái',
    status: 'ASSIGNED',
    order_id
  };
};

const updateTripStatus = async (id, status) => {
  let dbStatus = 'Assigned';
  if (status === 'COMPLETED' || status === 'Delivered') dbStatus = 'Completed';
  else if (status === 'IN_TRANSIT' || status === 'In Transit') dbStatus = 'In Transit';
  else if (status === 'CANCELLED') dbStatus = 'Cancelled';

  const updatedTrip = await tripModel.updateTripStatus(id, dbStatus);
  return formatTrip(updatedTrip);
};

module.exports = {
  formatTrip,
  getAllTrips,
  createTrip,
  updateTripStatus
};
