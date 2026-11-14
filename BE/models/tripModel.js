const supabase = require('../config/supabase');
const prisma = require('../config/prisma');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapTripStop = (s) => {
  if (!s) return null;
  const orderCargo = Array.isArray(s.orders?.order_cargos)
    ? s.orders.order_cargos[0]
    : s.orders?.order_cargos;

  return {
    ...s,
    id: toPlainNumber(s.id),
    trip_id: toPlainNumber(s.trip_id),
    order_id: toPlainNumber(s.order_id),
    location_id: toPlainNumber(s.location_id),
    distance_from_previous_stop: s.distance_from_previous_stop !== null ? Number(s.distance_from_previous_stop) : null,
    loaded_weight: s.loaded_weight !== null && s.loaded_weight !== undefined ? Number(s.loaded_weight) : null,
    delivered_weight: s.delivered_weight !== null && s.delivered_weight !== undefined ? Number(s.delivered_weight) : null,
    location: s.locations ? {
      ...s.locations,
      id: toPlainNumber(s.locations.id),
      latitude: s.locations.latitude !== null ? Number(s.locations.latitude) : null,
      longitude: s.locations.longitude !== null ? Number(s.locations.longitude) : null
    } : null,
    order: s.orders ? {
      id: toPlainNumber(s.orders.id),
      order_code: s.orders.order_code,
      hawb_number: s.orders.hawb_number,
      status: s.orders.status,
      receiver_name: s.orders.receiver_name,
      receiver_phone: s.orders.receiver_phone,
      agreed_price: toPlainNumber(s.orders.agreed_price),
      vendor_tracking_code: s.orders.vendor_tracking_code,
      customer: s.orders.customers ? {
        id: toPlainNumber(s.orders.customers.id),
        company_name: s.orders.customers.company_name,
        phone: s.orders.customers.phone
      } : null,
      cargo: orderCargo ? {
        cargo_name: orderCargo.cargo_name,
        cargo_type: orderCargo.cargo_type,
        quantity: toPlainNumber(orderCargo.quantity),
        unit: orderCargo.unit,
        actual_weight_kg: orderCargo.actual_weight_kg !== null ? Number(orderCargo.actual_weight_kg) : null,
        chargeable_weight_kg: orderCargo.chargeable_weight_kg !== null ? Number(orderCargo.chargeable_weight_kg) : null,
        length_cm: orderCargo.length_cm !== null ? Number(orderCargo.length_cm) : null,
        width_cm: orderCargo.width_cm !== null ? Number(orderCargo.width_cm) : null,
        height_cm: orderCargo.height_cm !== null ? Number(orderCargo.height_cm) : null
      } : null
    } : null,
    evidences: (s.delivery_evidences || []).map(ev => ({
      ...ev,
      id: toPlainNumber(ev.id),
      trip_stop_id: toPlainNumber(ev.trip_stop_id),
      order_id: toPlainNumber(ev.order_id),
      latitude: ev.latitude !== null ? Number(ev.latitude) : null,
      longitude: ev.longitude !== null ? Number(ev.longitude) : null
    }))
  };
};

const mapTripTruck = (tt) => {
  if (!tt) return null;
  return {
    ...tt,
    id: toPlainNumber(tt.id),
    trip_id: toPlainNumber(tt.trip_id),
    truck_id: toPlainNumber(tt.truck_id),
    incident_id: toPlainNumber(tt.incident_id),
    truck: tt.trucks ? {
      ...tt.trucks,
      id: toPlainNumber(tt.trucks.id),
      allowed_payload: toPlainNumber(tt.trucks.allowed_payload),
      box_length: tt.trucks.box_length !== null && tt.trucks.box_length !== undefined ? Number(tt.trucks.box_length) : null,
      box_width: tt.trucks.box_width !== null && tt.trucks.box_width !== undefined ? Number(tt.trucks.box_width) : null,
      box_height: tt.trucks.box_height !== null && tt.trucks.box_height !== undefined ? Number(tt.trucks.box_height) : null,
      last_lat: tt.trucks.last_lat !== null && tt.trucks.last_lat !== undefined ? Number(tt.trucks.last_lat) : null,
      last_lng: tt.trucks.last_lng !== null && tt.trucks.last_lng !== undefined ? Number(tt.trucks.last_lng) : null
    } : null
  };
};

const mapTripDriver = (td) => {
  if (!td) return null;
  const user = td.driver_profiles?.users ? {
    id: toPlainNumber(td.driver_profiles.users.id),
    full_name: td.driver_profiles.users.full_name,
    phone: td.driver_profiles.users.phone
  } : null;

  return {
    ...td,
    id: toPlainNumber(td.id),
    trip_id: toPlainNumber(td.trip_id),
    driver_id: toPlainNumber(td.driver_id),
    incident_id: toPlainNumber(td.incident_id),
    driver: {
      id: toPlainNumber(td.driver_id),
      user
    }
  };
};

const mapTrip = (t) => {
  if (!t) return null;
  return {
    ...t,
    id: toPlainNumber(t.id),
    created_by: toPlainNumber(t.created_by),
    planned_distance: t.planned_distance !== null ? Number(t.planned_distance) : null,
    actual_distance: t.actual_distance !== null ? Number(t.actual_distance) : null,
    trip_trucks: (t.trip_trucks || []).map(mapTripTruck),
    trip_drivers: (t.trip_drivers || []).map(mapTripDriver),
    stops: (t.trip_stops || []).map(mapTripStop),
    incidents: (t.incidents || []).map(i => ({
      ...i,
      id: toPlainNumber(i.id),
      trip_id: toPlainNumber(i.trip_id)
    })),
    waybills: (t.waybills || []).map(w => ({
      ...w,
      id: toPlainNumber(w.id),
      trip_id: toPlainNumber(w.trip_id),
      issued_by: toPlainNumber(w.issued_by)
    })),
    events: (t.trip_events || []).map(e => ({
      ...e,
      id: toPlainNumber(e.id),
      trip_id: toPlainNumber(e.trip_id),
      trip_stop_id: toPlainNumber(e.trip_stop_id),
      driver_id: toPlainNumber(e.driver_id),
      latitude: e.latitude !== null ? Number(e.latitude) : null,
      longitude: e.longitude !== null ? Number(e.longitude) : null
    }))
  };
};

const findAllTrips = async () => {
  const { data: trips, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_trucks(id, trip_id, truck_id, incident_id, assignment_type, trucks(*)),
      trip_drivers(id, trip_id, driver_id, incident_id, driver_role, assignment_type, driver_profiles(*, users:user_account_id(id, full_name, phone))),
      trip_stops(*, locations(*), orders(*, customers(*), order_cargos(*)), delivery_evidences(*)),
      incidents(id, type, status, description, reported_time, resolution_note),
      waybills(*),
      trip_events(*)
    `)
    .order('id', { ascending: false });

  if (error) {
    console.error('tripModel.findAllTrips error:', error);
    throw error;
  }
  return (trips || []).map(mapTrip);
};

const findTruckByPlate = async (plate) => {
  if (!plate) return null;
  const cleanPlate = String(plate).split(' ')[0].trim();
  const { data } = await supabase
    .from('trucks')
    .select('id')
    .is('deleted_at', null)
    .ilike('plate_number', `%${cleanPlate}%`)
    .limit(1);
  return data?.[0] ? Number(data[0].id) : null;
};

const findFirstTruck = async () => {
  const { data } = await supabase
    .from('trucks')
    .select('id')
    .is('deleted_at', null)
    .in('status', ['Available', 'AVAILABLE', 'Active'])
    .limit(1);
  if (data?.[0]) return Number(data[0].id);
  const { data: anyTruck } = await supabase
    .from('trucks')
    .select('id')
    .is('deleted_at', null)
    .limit(1);
  return anyTruck?.[0] ? Number(anyTruck[0].id) : 14;
};

const findDriverByName = async (name) => {
  if (!name) return null;
  const cleanName = String(name).split('·')[0].split('-')[0].trim();
  const { data } = await supabase
    .from('driver_profiles')
    .select('id, users:user_account_id(full_name)')
    .limit(100);
  if (data) {
    const match = data.find(d => (d.users?.full_name || '').toLowerCase().includes(cleanName.toLowerCase()));
    if (match) return Number(match.id);
  }
  return null;
};

const findFirstDriver = async () => {
  const { data } = await supabase
    .from('driver_profiles')
    .select('id')
    .limit(1);
  return data?.[0] ? Number(data[0].id) : 6;
};

const findOrderByCodeOrId = async (orderIdOrCode) => {
  if (!orderIdOrCode) return null;
  const strVal = String(orderIdOrCode).trim();
  const query = supabase
    .from('orders')
    .select('*, customers(*), order_cargos(*)');
  if (/^\d+$/.test(strVal)) {
    query.eq('id', Number(strVal));
  } else {
    query.eq('order_code', strVal);
  }
  const { data } = await query.limit(1);
  if (!data || data.length === 0) return null;
  return data[0];
};

const findVendorByNameOrId = async (vendorNameOrId) => {
  if (!vendorNameOrId) return null;
  const strVal = String(vendorNameOrId).trim();
  if (/^\d+$/.test(strVal)) {
    const { data } = await supabase.from('vendors').select('*').eq('id', Number(strVal)).limit(1);
    if (data?.[0]) return data[0];
  }
  const { data } = await supabase.from('vendors').select('*').ilike('company_name', `%${strVal}%`).limit(1);
  if (data?.[0]) return data[0];
  const { data: firstVendor } = await supabase.from('vendors').select('*').limit(1);
  return firstVendor?.[0] || null;
};

const createTripWithRelations = async ({
  tripData,
  truckId,
  driverId,
  secondaryDriverId = null,
  stopsData,
  orderId,
  waybillSnapshot = {}
}) => {
  const numOrderId = orderId ? Number(orderId) : null;
  const numTruckId = Number(truckId);
  const numDriverId = Number(driverId);
  const numDriver2Id = secondaryDriverId ? Number(secondaryDriverId) : null;

  // 1. Tạo Trip
  const { data: newTripArr, error: tripErr } = await supabase
    .from('trips')
    .insert([{
      trip_code: tripData.trip_code,
      status: tripData.status || 'Assigned',
      planned_start: tripData.planned_start ? new Date(tripData.planned_start).toISOString() : new Date().toISOString(),
      planned_distance: tripData.planned_distance ? parseFloat(tripData.planned_distance) : 50.0,
      planned_duration: tripData.planned_duration ? parseInt(tripData.planned_duration, 10) : 60,
      created_by: tripData.created_by ? Number(tripData.created_by) : 1
    }])
    .select();

  if (tripErr || !newTripArr || newTripArr.length === 0) {
    console.error('createTrip error in supabase:', tripErr);
    throw tripErr || new Error('Không thể tạo chuyến xe');
  }

  const newTrip = newTripArr[0];
  const tripId = newTrip.id;

  // 2. Gán xe (trip_trucks)
  await supabase.from('trip_trucks').insert([{
    trip_id: tripId,
    truck_id: numTruckId,
    assignment_type: 'Original'
  }]);

  // 3. Gán tài xế chính (trip_drivers)
  await supabase.from('trip_drivers').insert([{
    trip_id: tripId,
    driver_id: numDriverId,
    driver_role: 'Primary',
    assignment_type: 'Original'
  }]);

  // 3b. Gán tài xế phụ nếu có
  if (numDriver2Id && numDriver2Id !== numDriverId) {
    await supabase.from('trip_drivers').insert([{
      trip_id: tripId,
      driver_id: numDriver2Id,
      driver_role: 'Secondary',
      assignment_type: 'Original'
    }]);
  }

  // 4. Tạo các trạm dừng (trip_stops)
  if (Array.isArray(stopsData) && stopsData.length > 0) {
    const stopsToInsert = stopsData.map((s, i) => {
      let normalizedStopType = 'Drop-off';
      const rawType = String(s.type || s.stop_type || '').toUpperCase();
      if (rawType === 'PICKUP') normalizedStopType = 'Pickup';
      else if (rawType === 'REST') normalizedStopType = 'Rest';
      else if (rawType === 'TRANSIT') normalizedStopType = 'Transit';

      return {
        trip_id: tripId,
        order_id: s.order_id ? Number(s.order_id) : numOrderId,
        sequence: i + 1,
        stop_type: normalizedStopType,
        location_id: s.location_id ? Number(s.location_id) : 1,
        planned_arrival: s.planned_arrival ? new Date(s.planned_arrival).toISOString() : null,
        distance_from_previous_stop: s.distance_from_previous_stop ? parseFloat(s.distance_from_previous_stop) : null,
        status: s.status || 'Pending'
      };
    });
    await supabase.from('trip_stops').insert(stopsToInsert);
  }

  // 5. Tạo Vận đơn (Waybill V1)
  const waybillNum = `WB-${tripData.trip_code.replace(/^TRIP-/i, '')}-V1`.slice(0, 20);
  await supabase.from('waybills').insert([{
    trip_id: tripId,
    waybill_number: waybillNum,
    issued_by: tripData.created_by ? Number(tripData.created_by) : 1,
    status: 'Valid',
    trip_data_snapshot: {
      version: 1,
      trip_code: tripData.trip_code,
      ...waybillSnapshot
    }
  }]);

  // 6. Ghi lịch sử trạng thái chuyến (trip_status_history)
  await supabase.from('trip_status_history').insert([{
    trip_id: tripId,
    status: 'Assigned',
    changed_by: tripData.created_by ? Number(tripData.created_by) : 1
  }]);

  // 7. Cập nhật trạng thái xe thành 'On Trip'
  await supabase.from('trucks').update({
    status: 'On Trip',
    updated_at: new Date().toISOString()
  }).eq('id', numTruckId);

  // 8. Cập nhật đơn hàng thành ASSIGNED & ghi order_status_history
  if (numOrderId) {
    await supabase.from('orders').update({
      status: 'ASSIGNED',
      updated_at: new Date().toISOString()
    }).eq('id', numOrderId);

    await supabase.from('order_status_history').insert([{
      order_id: numOrderId,
      status: 'Assigned',
      changed_by: tripData.created_by ? Number(tripData.created_by) : 1
    }]);
  }

  // 9. Gửi thông báo cho tài xế
  try {
    const { data: driverProfile } = await supabase
      .from('driver_profiles')
      .select('user_account_id')
      .eq('id', numDriverId)
      .single();

    if (driverProfile?.user_account_id) {
      await supabase.from('notifications').insert([{
        user_account_id: driverProfile.user_account_id,
        target_type: 'TRIP',
        target_id: tripId,
        message: `Bạn vừa được phân công chuyến xe mới ${tripData.trip_code}. Vui lòng kiểm tra lộ trình và nhận chuyến.`
      }]);
    }
  } catch (notifErr) {
    console.warn('Driver notification warning:', notifErr.message);
  }

  return mapTrip(newTrip);
};

const assignOrderToVendor = async ({
  orderId,
  vendorId,
  vendorName,
  vendorTrackingCode,
  vendorCost,
  vendorVehicleCount,
  userId = 1
}) => {
  const numOrderId = Number(orderId);
  const now = new Date().toISOString();

  const { data: updatedOrder } = await supabase
    .from('orders')
    .update({
      vendor_id: vendorId ? Number(vendorId) : null,
      vendor_tracking_code: vendorTrackingCode ? String(vendorTrackingCode).slice(0, 50) : null,
      status: 'HANDED_OVER_TO_VENDOR',
      is_closed: true,
      updated_at: now
    })
    .eq('id', numOrderId)
    .select();

  await supabase.from('order_status_history').insert([{
    order_id: numOrderId,
    status: 'Handed Over to Vendor',
    changed_by: userId ? Number(userId) : 1
  }]);

  await supabase.from('order_notes').insert([{
    order_id: numOrderId,
    created_by: userId ? Number(userId) : 1,
    content: `[Bàn giao Nhà xe 3PL]: ${vendorName || 'Đối tác'} - Mã vận đơn: ${vendorTrackingCode} - Số xe: ${vendorVehicleCount || 1} - Chi phí: ${vendorCost || 'Theo HĐ'}`
  }]);

  return updatedOrder?.[0] || { id: numOrderId };
};

const updateTripStatus = async (id, status, userId = 1) => {
  const strId = String(id).trim();
  let existingTrip = null;
  if (/^\d+$/.test(strId)) {
    const { data } = await supabase.from('trips').select('*, trip_trucks(*), trip_drivers(*), trip_stops(*)').eq('id', Number(strId)).limit(1);
    existingTrip = data?.[0];
  } else {
    const { data } = await supabase.from('trips').select('*, trip_trucks(*), trip_drivers(*), trip_stops(*)').eq('trip_code', strId).limit(1);
    existingTrip = data?.[0];
  }

  if (!existingTrip) {
    throw new Error('Không tìm thấy chuyến xe');
  }

  const tripId = existingTrip.id;
  const now = new Date().toISOString();
  const updateData = {
    status,
    updated_at: now
  };
  if (status === 'Completed' || status === 'COMPLETED') {
    updateData.actual_distance = existingTrip.planned_distance || 50;
    updateData.actual_duration = existingTrip.planned_duration || 60;
  }

  const { data: updated, error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', tripId)
    .select();

  if (error) throw error;

  await supabase.from('trip_status_history').insert([{
    trip_id: tripId,
    status,
    changed_by: userId ? Number(userId) : 1
  }]);

  if (status === 'Completed' || status === 'Cancelled') {
    const activeTrucks = (existingTrip.trip_trucks || []).filter(tt => !tt.released_time);
    for (const tt of activeTrucks) {
      await supabase.from('trip_trucks').update({ released_time: now }).eq('id', tt.id);
      await supabase.from('trucks').update({ status: 'AVAILABLE', updated_at: now }).eq('id', tt.truck_id);
    }

    const activeDrivers = (existingTrip.trip_drivers || []).filter(td => !td.released_time);
    for (const td of activeDrivers) {
      await supabase.from('trip_drivers').update({ released_time: now }).eq('id', td.id);
      await supabase.from('driver_profiles').update({
        status: 'Active',
        ...(status === 'Completed' ? { last_trip_ended_at: now } : {}),
        updated_at: now
      }).eq('id', td.driver_id);
    }

    const orderIds = [...new Set((existingTrip.trip_stops || []).map(s => s.order_id).filter(Boolean))];

    if (status === 'Completed') {
      await supabase.from('trip_stops').update({ status: 'Done', actual_arrival: now }).eq('trip_id', tripId);
      for (const ordId of orderIds) {
        await supabase.from('orders').update({ status: 'DELIVERED', is_closed: true, updated_at: now }).eq('id', ordId);
        await supabase.from('order_status_history').insert([{
          order_id: ordId,
          status: 'Delivered',
          changed_by: userId ? Number(userId) : 1
        }]);
      }
    } else if (status === 'Cancelled') {
      await supabase.from('trip_stops').update({ status: 'Skipped' }).eq('trip_id', tripId);
      for (const ordId of orderIds) {
        await supabase.from('orders').update({ status: 'READY_FOR_PLANNING', updated_at: now }).eq('id', ordId);
        await supabase.from('order_status_history').insert([{
          order_id: ordId,
          status: 'Ready for Planning',
          changed_by: userId ? Number(userId) : 1
        }]);
      }
    }
  }

  return mapTrip(updated?.[0] || existingTrip);
};

module.exports = {
  findAllTrips,
  findTruckByPlate,
  findFirstTruck,
  findDriverByName,
  findFirstDriver,
  findOrderByCodeOrId,
  findVendorByNameOrId,
  createTripWithRelations,
  assignOrderToVendor,
  updateTripStatus
};
