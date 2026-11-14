const supabase = require('../config/supabase');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapIncident = (inc) => {
  if (!inc) return null;
  const trip = inc.trips ? {
    id: toPlainNumber(inc.trips.id),
    trip_code: inc.trips.trip_code,
    trip_trucks: (inc.trips.trip_trucks || []).map(tt => ({
      id: toPlainNumber(tt.id),
      truck_id: toPlainNumber(tt.truck_id),
      released_time: tt.released_time,
      replacement_reason: tt.replacement_reason,
      truck: tt.trucks ? {
        id: toPlainNumber(tt.trucks.id),
        plate_number: tt.trucks.plate_number
      } : null
    })),
    trip_drivers: (inc.trips.trip_drivers || []).map(td => ({
      id: toPlainNumber(td.id),
      driver_id: toPlainNumber(td.driver_id),
      released_time: td.released_time,
      replacement_reason: td.replacement_reason,
      driver: td.driver_profiles && td.driver_profiles.users ? {
        id: toPlainNumber(td.driver_profiles.id),
        user: {
          full_name: td.driver_profiles.users.full_name,
          phone: td.driver_profiles.users.phone
        }
      } : null
    }))
  } : null;

  return {
    ...inc,
    id: toPlainNumber(inc.id),
    trip_id: toPlainNumber(inc.trip_id),
    trip_stop_id: toPlainNumber(inc.trip_stop_id),
    reported_by: toPlainNumber(inc.reported_by),
    escalated_by: toPlainNumber(inc.escalated_by),
    resolved_by: toPlainNumber(inc.resolved_by),
    closed_by: toPlainNumber(inc.closed_by),
    proposed_compensation_amount: toPlainNumber(inc.proposed_compensation_amount) || 0,
    approved_compensation_amount: toPlainNumber(inc.approved_compensation_amount) || 0,
    damage_percentage: toPlainNumber(inc.damage_percentage),
    goods_handling_method: inc.goods_handling_method || null,
    contract_clause_ref: inc.contract_clause_ref || null,
    rejection_reason: inc.rejection_reason || null,
    contact_hotline: inc.contact_hotline || '1900 1234',
    payment_proof_url: inc.payment_proof_url || null,
    incident_lat: inc.incident_lat ? Number(inc.incident_lat) : null,
    incident_lng: inc.incident_lng ? Number(inc.incident_lng) : null,
    is_on_route: inc.is_on_route !== false,
    route_deviation_km: inc.route_deviation_km ? Number(inc.route_deviation_km) : 0,
    closed_at: inc.closed_at,
    trip
  };
};

const findAll = async () => {
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select(`
      *,
      trips(
        id,
        trip_code,
        trip_trucks(id, truck_id, released_time, replacement_reason, trucks(id, plate_number)),
        trip_drivers(id, driver_id, released_time, replacement_reason, driver_profiles(id, users:user_account_id(full_name, phone)))
      )
    `)
    .order('id', { ascending: false });

  if (error) {
    console.error('incidentModel.findAll error:', error);
    throw error;
  }
  return (incidents || []).map(mapIncident);
};

const findTripIdByCode = async (tripCode) => {
  if (!tripCode) return null;
  const { data } = await supabase
    .from('trips')
    .select('id')
    .eq('trip_code', String(tripCode).trim())
    .limit(1);
  return data?.[0] ? toPlainNumber(data[0].id) : null;
};

const findFirstTripId = async () => {
  const { data } = await supabase
    .from('trips')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  return data?.[0] ? toPlainNumber(data[0].id) : 9;
};

const create = async (incidentData) => {
  const data = {
    trip_id: Number(incidentData.trip_id),
    trip_stop_id: incidentData.trip_stop_id ? Number(incidentData.trip_stop_id) : null,
    type: incidentData.type || 'BREAKDOWN',
    description: String(incidentData.description || 'Sự cố phát sinh trên đường vận chuyển').slice(0, 500),
    photos: Array.isArray(incidentData.photos) ? incidentData.photos : [],
    fault: incidentData.fault || null,
    status: incidentData.status || 'Reported',
    reported_time: incidentData.reported_time ? new Date(incidentData.reported_time).toISOString() : new Date().toISOString()
  };

  if (incidentData.reported_by) {
    const { data: dp } = await supabase
      .from('driver_profiles')
      .select('id')
      .or(`id.eq.${incidentData.reported_by},user_account_id.eq.${incidentData.reported_by}`)
      .limit(1);
    if (dp?.[0]) {
      data.reported_by = Number(dp[0].id);
    }
  }

  const { data: createdArr, error } = await supabase
    .from('incidents')
    .insert([data])
    .select(`
      *,
      trips(id, trip_code, trip_trucks(id, truck_id, trucks(id, plate_number)), trip_drivers(id, driver_id, driver_profiles(id, users(full_name, phone))))
    `);

  if (error) throw error;
  return mapIncident(createdArr?.[0]);
};

const update = async (id, updateData) => {
  const numId = Number(id);
  const allowedFields = [
    'type',
    'description',
    'photos',
    'fault',
    'status',
    'escalated_by',
    'escalated_time',
    'escalation_reason',
    'resolution_note',
    'resolved_by',
    'resolved_time',
    'updated_at'
  ];

  const data = { updated_at: new Date().toISOString() };
  for (const key of allowedFields) {
    if (updateData[key] !== undefined) {
      if ((key === 'escalated_by' || key === 'resolved_by') && updateData[key] !== null) {
        data[key] = Number(updateData[key]);
      } else if (key.endsWith('_time') && updateData[key] instanceof Date) {
        data[key] = updateData[key].toISOString();
      } else {
        data[key] = updateData[key];
      }
    }
  }

  const { data: updatedArr, error } = await supabase
    .from('incidents')
    .update(data)
    .eq('id', numId)
    .select(`
      *,
      trips(id, trip_code, trip_trucks(id, truck_id, trucks(id, plate_number)), trip_drivers(id, driver_id, driver_profiles(id, users(full_name, phone))))
    `);

  if (error) {
    console.error('incidentModel.update error in supabase:', error);
    throw error;
  }
  return mapIncident(updatedArr?.[0] || { id: numId, ...data });
};

/**
 * Điều xe & tài xế thay thế khi có sự cố hiện trường (UC-15, BR-09, UC-41)
 */
const dispatchReplacementWithTransaction = async ({
  incidentId,
  newTruckPlate,
  newDriverName,
  replacementReason,
  userId = 1
}) => {
  const numIncId = Number(incidentId);
  const now = new Date().toISOString();

  const { data: incArr, error: incErr } = await supabase
    .from('incidents')
    .select(`
      *,
      trips(
        id, trip_code,
        trip_trucks(*),
        trip_drivers(*),
        waybills(*)
      )
    `)
    .eq('id', numIncId)
    .limit(1);

  if (incErr || !incArr?.[0]) {
    throw new Error('Không tìm thấy sự cố cần xử lý');
  }

  const incident = incArr[0];
  const trip = incident.trips;
  const tripId = Number(incident.trip_id);
  const reasonText = String(replacementReason || 'Điều xe thay thế do sự cố hiện trường').slice(0, 255);

  // 1. Tìm xe thay thế
  let newTruck = null;
  if (newTruckPlate) {
    const cleanPlate = String(newTruckPlate).split(' ')[0].trim();
    const { data: trucks } = await supabase
      .from('trucks')
      .select('id, plate_number')
      .is('deleted_at', null)
      .ilike('plate_number', `%${cleanPlate}%`)
      .limit(1);
    newTruck = trucks?.[0] || null;
  }
  if (!newTruck) {
    const { data: trucks } = await supabase
      .from('trucks')
      .select('id, plate_number')
      .is('deleted_at', null)
      .in('status', ['Available', 'AVAILABLE'])
      .limit(1);
    newTruck = trucks?.[0] || null;
  }
  if (!newTruck) {
    const { data: trucks } = await supabase
      .from('trucks')
      .select('id, plate_number')
      .is('deleted_at', null)
      .limit(1);
    newTruck = trucks?.[0] || null;
  }

  // 2. Tìm tài xế thay thế
  let newDriver = null;
  if (newDriverName) {
    const cleanDriver = String(newDriverName).split('-')[0].split('·')[0].trim();
    const { data: drivers } = await supabase
      .from('driver_profiles')
      .select('id, users:user_account_id(full_name)')
      .limit(100);
    newDriver = drivers?.find(d => (d.users?.full_name || '').toLowerCase().includes(cleanDriver.toLowerCase())) || null;
  }
  if (!newDriver) {
    const { data: drivers } = await supabase
      .from('driver_profiles')
      .select('id, users:user_account_id(full_name)')
      .limit(1);
    newDriver = drivers?.[0] || null;
  }

  // 3. Giải phóng xe cũ & gán xe mới
  if (newTruck && tripId) {
    const activeTrucks = (trip?.trip_trucks || []).filter(tt => !tt.released_time);
    for (const tt of activeTrucks) {
      await supabase
        .from('trip_trucks')
        .update({ released_time: now, replacement_reason: reasonText })
        .eq('id', tt.id);

      await supabase
        .from('trucks')
        .update({ status: 'MAINTENANCE', updated_at: now })
        .eq('id', tt.truck_id);
    }

    await supabase
      .from('trip_trucks')
      .insert([{
        trip_id: tripId,
        truck_id: Number(newTruck.id),
        assignment_type: 'Replacement',
        incident_id: numIncId,
        assigned_time: now,
        replacement_reason: reasonText
      }]);

    await supabase
      .from('trucks')
      .update({ status: 'On Trip', updated_at: now })
      .eq('id', Number(newTruck.id));
  }

  // 4. Giải phóng tài xế cũ & gán tài xế mới
  if (newDriver && tripId) {
    const activeDrivers = (trip?.trip_drivers || []).filter(td => !td.released_time);
    for (const td of activeDrivers) {
      await supabase
        .from('trip_drivers')
        .update({ released_time: now, replacement_reason: reasonText })
        .eq('id', td.id);
    }

    await supabase
      .from('trip_drivers')
      .insert([{
        trip_id: tripId,
        driver_id: Number(newDriver.id),
        driver_role: 'Primary',
        assignment_type: 'Replacement',
        incident_id: numIncId,
        assigned_time: now,
        replacement_reason: reasonText
      }]);
  }

  // 5. Cấp lại Vận đơn Waybill mới
  const prevWaybills = trip?.waybills || [];
  const nextVersion = prevWaybills.length + 1;
  if (prevWaybills.length > 0) {
    await supabase
      .from('waybills')
      .update({ status: 'Superseded' })
      .eq('trip_id', tripId)
      .eq('status', 'Valid');
  }

  const tripCodeShort = (trip?.trip_code || `T${tripId}`).replace(/^TRIP-/i, '');
  const newWaybillNo = `WB-${tripCodeShort}-V${nextVersion}`.slice(0, 20);
  await supabase
    .from('waybills')
    .insert([{
      trip_id: tripId,
      waybill_number: newWaybillNo,
      issued_by: userId ? Number(userId) : 1,
      status: 'Valid',
      trip_data_snapshot: {
        version: nextVersion,
        trip_code: trip?.trip_code,
        replaced_due_to_incident: numIncId,
        new_truck_plate: newTruck?.plate_number || newTruckPlate,
        new_driver_name: newDriver?.users?.full_name || newDriverName,
        replacement_reason: reasonText
      }
    }]);

  // 6. Cập nhật trạng thái sự cố thành RESOLVED
  const { data: updatedIncArr } = await supabase
    .from('incidents')
    .update({
      status: 'RESOLVED',
      resolution_note: `[Điều xe thay thế ${newTruck?.plate_number || newTruckPlate} - Tài xế ${newDriver?.users?.full_name || newDriverName}]: ${reasonText}`.slice(0, 500),
      resolved_time: now,
      updated_at: now
    })
    .eq('id', numIncId)
    .select(`
      *,
      trips(id, trip_code, trip_trucks(id, truck_id, trucks(id, plate_number)), trip_drivers(id, driver_id, driver_profiles(id, users(full_name, phone))))
    `);

  // 7. Ghi activity log
  try {
    await supabase.from('activity_logs').insert([{
      actor_id: userId ? Number(userId) : 1,
      actor_type: 'DISPATCHER',
      action: 'REPLACE_TRUCK_DRIVER',
      target_type: 'TRIP',
      target_id: tripId,
      changes: {
        incident_id: numIncId,
        trip_code: trip?.trip_code,
        waybill_version: nextVersion,
        waybill_number: newWaybillNo,
        new_truck: newTruck?.plate_number || newTruckPlate,
        new_driver: newDriver?.users?.full_name || newDriverName
      },
      reason: reasonText,
      created_time: now
    }]);
  } catch (logErr) {
    console.warn('[IncidentModel] activity_logs replacement error:', logErr.message);
  }

  return {
    ...mapIncident(updatedIncArr?.[0] || incident),
    new_waybill_version: nextVersion,
    new_waybill_number: newWaybillNo,
    new_truck_plate: newTruck?.plate_number || newTruckPlate,
    new_driver_name: newDriver?.users?.full_name || newDriverName
  };
};

module.exports = {
  findAll,
  findTripIdByCode,
  findFirstTripId,
  create,
  update,
  dispatchReplacementWithTransaction
};
