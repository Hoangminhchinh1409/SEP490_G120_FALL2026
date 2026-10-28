const supabase = require('../config/supabase');

const findAllTrips = async () => {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_trucks(
        truck:trucks(id, plate_number, allowed_payload, status)
      ),
      trip_drivers(
        driver:driver_profiles(
          id,
          user:users(id, full_name, phone)
        )
      ),
      stops:trip_stops(
        id,
        sequence,
        stop_type,
        location_id,
        planned_arrival,
        actual_arrival,
        status,
        location:locations(id, name, address, latitude, longitude)
      ),
      incidents:incidents(
        id,
        type,
        status,
        description,
        reported_time
      )
    `)
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
};

const findTruckByPlate = async (plate) => {
  const { data } = await supabase.from('trucks').select('id').eq('plate_number', plate).limit(1);
  return data?.[0]?.id || null;
};

const findFirstTruck = async () => {
  const { data } = await supabase.from('trucks').select('id').limit(1);
  return data?.[0]?.id || null;
};

const findFirstDriver = async () => {
  const { data } = await supabase.from('driver_profiles').select('id').limit(1);
  return data?.[0]?.id || 1;
};

const createTrip = async (tripData) => {
  const { data, error } = await supabase
    .from('trips')
    .insert([tripData])
    .select();
  if (error) throw error;
  return data?.[0];
};

const createTripStops = async (stops) => {
  const { data, error } = await supabase
    .from('trip_stops')
    .insert(stops)
    .select();
  if (error) throw error;
  return data;
};

const updateOrderStatusAndHistory = async ({ orderId, orderCode, orderUpdatePayload, historyPayload }) => {
  if (orderId) {
    await supabase.from('orders').update(orderUpdatePayload).eq('id', orderId);
    if (historyPayload) {
      await supabase.from('order_status_history').insert([historyPayload]);
    }
  } else if (orderCode) {
    await supabase.from('orders').update(orderUpdatePayload).eq('order_code', orderCode);
  }
};

const linkTripStopOrder = async (tripStopId, orderId) => {
  await supabase.from('trip_stop_orders').insert([{
    trip_stop_id: tripStopId,
    order_id: orderId
  }]).select();
};

const updateTruckStatus = async (truckId, status) => {
  await supabase.from('trucks').update({ status }).eq('id', truckId);
};

const updateTripStatus = async (id, tripCode, updateData) => {
  const realTripId = parseInt(id.toString().replace('TRIP-', ''), 10) || parseInt(id, 10);
  const { data, error } = await supabase
    .from('trips')
    .update(updateData)
    .or(`id.eq.${realTripId},trip_code.eq.${tripCode}`)
    .select();
  if (error) throw error;
  return data?.[0];
};

const completeTripStopsAndOrders = async (tripId, truckId) => {
  if (truckId) {
    await updateTruckStatus(truckId, 'AVAILABLE');
  }

  await supabase.from('trip_stops').update({ status: 'COMPLETED' }).eq('trip_id', tripId);

  const { data: stops } = await supabase.from('trip_stops').select('id').eq('trip_id', tripId);
  const stopIds = (stops || []).map(s => s.id);

  if (stopIds.length > 0) {
    const { data: stopOrders } = await supabase
      .from('trip_stop_orders')
      .select('order_id')
      .in('trip_stop_id', stopIds);

    if (stopOrders && stopOrders.length > 0) {
      const orderIds = stopOrders.map(so => so.order_id);
      await supabase.from('orders').update({
        status: 'CLOSED',
        updated_at: new Date().toISOString()
      }).in('id', orderIds);
    }
  }
};

module.exports = {
  findAllTrips,
  findTruckByPlate,
  findFirstTruck,
  findFirstDriver,
  createTrip,
  createTripStops,
  updateOrderStatusAndHistory,
  linkTripStopOrder,
  updateTruckStatus,
  updateTripStatus,
  completeTripStopsAndOrders
};

