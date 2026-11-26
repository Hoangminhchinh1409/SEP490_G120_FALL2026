const prisma = require('../config/prisma');
const { serializePrisma, toBigInt, toNum } = require('../utils/prismaHelper');

const INCIDENT_SAFE_SELECT = {
  id: true,
  trip_id: true,
  trip_stop_id: true,
  type: true,
  description: true,
  photos: true,
  fault: true,
  status: true,
  reported_by: true,
  reported_time: true,
  escalated_by: true,
  escalated_time: true,
  escalation_reason: true,
  resolution_note: true,
  resolved_by: true,
  resolved_time: true,
  created_at: true,
  updated_at: true
};

const INCIDENT_SELECT = {
  ...INCIDENT_SAFE_SELECT,
  compensation_claims: {
    select: {
      id: true,
      order_id: true,
      status: true,
      amount: true,
      approved_amount: true,
      claim_type: true,
      created_time: true
    },
    orderBy: { id: 'desc' }
  },
  trips: {
    select: {
      id: true,
      trip_code: true,
      trip_stops: {
        where: { order_id: { not: null } },
        select: {
          order_id: true,
          orders: {
            select: {
              id: true,
              order_code: true,
              receiver_name: true,
              receiver_phone: true,
              customers: {
                select: { company_name: true, phone: true }
              }
            }
          }
        }
      },
      trip_trucks: {
        select: {
          id: true,
          truck_id: true,
          released_time: true,
          replacement_reason: true,
          trucks: { select: { id: true, plate_number: true } }
        }
      },
      trip_drivers: {
        select: {
          id: true,
          driver_id: true,
          released_time: true,
          replacement_reason: true,
          driver_profiles: {
            select: {
              id: true,
              users: { select: { full_name: true, phone: true } }
            }
          }
        }
      }
    }
  }
};

const normalizePhotosArray = (rawPhotos) => {
  if (!rawPhotos) return [];
  if (Array.isArray(rawPhotos)) return rawPhotos.filter(Boolean);
  if (typeof rawPhotos === 'string') {
    try {
      const parsed = JSON.parse(rawPhotos);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [rawPhotos];
    } catch {
      return [rawPhotos];
    }
  }
  return [];
};

const mapIncident = (inc) => {
  if (!inc) return null;
  const s = serializePrisma(inc);
  const tripRow = inc.trips;
  const orderMap = new Map();
  if (tripRow?.trip_stops) {
    for (const ts of tripRow.trip_stops) {
      if (ts.orders && !orderMap.has(String(ts.orders.id))) {
        const oid = toNum(ts.orders.id);
        orderMap.set(String(ts.orders.id), {
          id: oid,
          order_code: ts.orders.order_code,
          customer_name: ts.orders.customers?.company_name || ts.orders.receiver_name || 'Khách hàng',
          contact_phone: ts.orders.customers?.phone || ts.orders.receiver_phone || null
        });
      }
    }
  }
  const tripOrders = Array.from(orderMap.values());
  const claims = (s.compensation_claims || []).map((c) => {
    const cid = toNum(c.id);
    return {
      id: cid,
      claim_code: `CLM-${String(cid).padStart(4, '0')}`,
      order_id: toNum(c.order_id),
      status: c.status,
      amount: Number(c.amount || 0),
      approved_amount: Number(c.approved_amount || 0),
      claim_type: c.claim_type || 'Damage',
      created_time: c.created_time || null
    };
  });

  const trip = tripRow
    ? {
        id: toNum(tripRow.id),
        trip_code: tripRow.trip_code,
        trip_trucks: (tripRow.trip_trucks || []).map((tt) => ({
          id: toNum(tt.id),
          truck_id: toNum(tt.truck_id),
          released_time: tt.released_time,
          replacement_reason: tt.replacement_reason,
          truck: tt.trucks
            ? {
                id: toNum(tt.trucks.id),
                plate_number: tt.trucks.plate_number
              }
            : null
        })),
        trip_drivers: (tripRow.trip_drivers || []).map((td) => ({
          id: toNum(td.id),
          driver_id: toNum(td.driver_id),
          released_time: td.released_time,
          replacement_reason: td.replacement_reason,
          driver:
            td.driver_profiles && td.driver_profiles.users
              ? {
                  id: toNum(td.driver_profiles.id),
                  user: {
                    full_name: td.driver_profiles.users.full_name,
                    phone: td.driver_profiles.users.phone
                  }
                }
              : null
        }))
      }
    : null;

  const { trips: _omitTrips, compensation_claims: _omitClaims, ...rest } = s;
  return {
    ...rest,
    id: toNum(inc.id),
    trip_id: toNum(inc.trip_id),
    trip_stop_id: toNum(inc.trip_stop_id),
    reported_by: toNum(inc.reported_by),
    escalated_by: toNum(inc.escalated_by),
    resolved_by: toNum(inc.resolved_by),
    closed_by: toNum(inc.closed_by),
    photos: normalizePhotosArray(s.photos),
    proposed_compensation_amount: toNum(inc.proposed_compensation_amount) || 0,
    approved_compensation_amount: toNum(inc.approved_compensation_amount) || 0,
    damage_percentage: toNum(inc.damage_percentage),
    goods_handling_method: inc.goods_handling_method || null,
    contract_clause_ref: inc.contract_clause_ref || null,
    rejection_reason: inc.rejection_reason || null,
    contact_hotline: inc.contact_hotline || '1900 1234',
    payment_proof_url: inc.payment_proof_url || null,
    incident_lat: inc.incident_lat !== null && inc.incident_lat !== undefined ? Number(inc.incident_lat) : null,
    incident_lng: inc.incident_lng !== null && inc.incident_lng !== undefined ? Number(inc.incident_lng) : null,
    is_on_route: inc.is_on_route !== false,
    route_deviation_km: inc.route_deviation_km ? Number(inc.route_deviation_km) : 0,
    closed_at: s.closed_at || null,
    trip_orders: tripOrders,
    claims,
    trip
  };
};

const findAll = async () => {
  const incidents = await prisma.incidents.findMany({
    select: INCIDENT_SELECT,
    orderBy: { id: 'desc' }
  });
  return (incidents || []).map(mapIncident);
};

const findById = async (id) => {
  const bigId = toBigInt(id);
  if (bigId === null) return null;
  const incident = await prisma.incidents.findUnique({
    where: { id: bigId },
    select: INCIDENT_SELECT
  });
  return mapIncident(incident);
};

const findTripIdByCode = async (tripCode) => {
  if (!tripCode) return null;
  const trip = await prisma.trips.findUnique({
    where: { trip_code: String(tripCode).trim() },
    select: { id: true }
  });
  return trip ? toNum(trip.id) : null;
};

const findFirstTripId = async () => {
  const trip = await prisma.trips.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true }
  });
  return trip ? toNum(trip.id) : 9;
};

const create = async (incidentData) => {
  const data = {
    trip_id: toBigInt(incidentData.trip_id),
    trip_stop_id: incidentData.trip_stop_id ? toBigInt(incidentData.trip_stop_id) : null,
    type: incidentData.type || 'BREAKDOWN',
    description: String(incidentData.description || 'Sự cố phát sinh trên đường vận chuyển').slice(0, 500),
    photos: Array.isArray(incidentData.photos) ? incidentData.photos : [],
    fault: incidentData.fault || null,
    status: incidentData.status || 'Reported',
    reported_time: incidentData.reported_time ? new Date(incidentData.reported_time) : new Date()
  };

  if (incidentData.reported_by) {
    const rbId = toBigInt(incidentData.reported_by);
    if (rbId !== null) {
      const dp = await prisma.driver_profiles.findFirst({
        where: { OR: [{ id: rbId }, { user_account_id: rbId }] },
        select: { id: true }
      });
      if (dp) {
        data.reported_by = dp.id;
      }
    }
  }

  const created = await prisma.incidents.create({
    data,
    select: INCIDENT_SELECT
  });
  return mapIncident(created);
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

  const data = { updated_at: new Date() };
  for (const key of allowedFields) {
    if (updateData[key] !== undefined) {
      if ((key === 'escalated_by' || key === 'resolved_by') && updateData[key] !== null) {
        data[key] = toBigInt(updateData[key]);
      } else if (key.endsWith('_time') && updateData[key] !== null) {
        data[key] = new Date(updateData[key]);
      } else {
        data[key] = updateData[key];
      }
    }
  }

  const updated = await prisma.incidents.update({
    where: { id: BigInt(numId) },
    data,
    select: INCIDENT_SELECT
  });
  return mapIncident(updated);
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
  const bigIncId = BigInt(numIncId);
  const now = new Date();

  const incident = await prisma.incidents.findUnique({
    where: { id: bigIncId },
    select: {
      ...INCIDENT_SAFE_SELECT,
      trips: {
        include: {
          trip_trucks: true,
          trip_drivers: true,
          waybills: true
        }
      }
    }
  });

  if (!incident) {
    throw new Error('Không tìm thấy sự cố cần xử lý');
  }

  const trip = incident.trips;
  const tripId = incident.trip_id;
  const numTripId = toNum(tripId);
  const reasonText = String(replacementReason || 'Điều xe thay thế do sự cố hiện trường').slice(0, 255);

  // 1. Tìm xe thay thế (BUG-SYS-21: không tự ý thay bằng xe bất kỳ khi biển số không tồn tại hoặc không sẵn sàng)
  if (!newTruckPlate || !String(newTruckPlate).trim()) {
    const err = new Error('Vui lòng chọn xe thay thế hợp lệ.');
    err.statusCode = 400;
    throw err;
  }
  const cleanPlate = String(newTruckPlate).split(' ')[0].trim();
  const newTruck = await prisma.trucks.findFirst({
    where: {
      deleted_at: null,
      plate_number: { contains: cleanPlate, mode: 'insensitive' }
    },
    select: { id: true, plate_number: true, status: true }
  });
  if (!newTruck) {
    const err = new Error(`Không tìm thấy xe thay thế với biển số "${cleanPlate}".`);
    err.statusCode = 400;
    throw err;
  }
  const truckStUpper = String(newTruck.status || '').trim().toUpperCase();
  if (!['AVAILABLE', 'READY', 'IDLE'].includes(truckStUpper)) {
    const err = new Error(`Xe ${newTruck.plate_number} hiện không sẵn sàng (trạng thái: ${newTruck.status}).`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Tìm tài xế thay thế
  if (!newDriverName || !String(newDriverName).trim()) {
    const err = new Error('Vui lòng chọn tài xế thay thế hợp lệ.');
    err.statusCode = 400;
    throw err;
  }
  const cleanDriver = String(newDriverName).split('-')[0].split('·')[0].trim();
  const newDriver = await prisma.driver_profiles.findFirst({
    where: {
      users: {
        full_name: { contains: cleanDriver, mode: 'insensitive' }
      }
    },
    include: { users: { select: { full_name: true } } }
  });
  if (!newDriver) {
    const err = new Error(`Không tìm thấy tài xế thay thế "${cleanDriver}".`);
    err.statusCode = 400;
    throw err;
  }
  }
  if (!newDriver) {
    newDriver = await prisma.driver_profiles.findFirst({
      include: { users: { select: { full_name: true } } }
    });
  }

  const prevWaybills = trip?.waybills || [];
  const nextVersion = prevWaybills.length + 1;
  const tripCodeShort = (trip?.trip_code || `T${numTripId}`).replace(/^TRIP-/i, '');
  const newWaybillNo = `WB-${tripCodeShort}-V${nextVersion}`.slice(0, 20);
  const actorBigId = toBigInt(userId || 1);

  const updatedInc = await prisma.$transaction(async (tx) => {
    // 3. Giải phóng xe cũ & gán xe mới
    if (newTruck && tripId) {
      const activeTrucks = (trip?.trip_trucks || []).filter((tt) => !tt.released_time);
      for (const tt of activeTrucks) {
        await tx.trip_trucks.update({
          where: { id: tt.id },
          data: { released_time: now, replacement_reason: reasonText }
        });
        await tx.trucks.update({
          where: { id: tt.truck_id },
          data: { status: 'MAINTENANCE', updated_at: now }
        });
      }

      await tx.trip_trucks.create({
        data: {
          trip_id: tripId,
          truck_id: newTruck.id,
          assignment_type: 'Replacement',
          incident_id: bigIncId,
          assigned_time: now,
          replacement_reason: reasonText
        }
      });

      await tx.trucks.update({
        where: { id: newTruck.id },
        data: { status: 'On Trip', updated_at: now }
      });
    }

    // 4. Giải phóng tài xế cũ & gán tài xế mới
    if (newDriver && tripId) {
      const activeDrivers = (trip?.trip_drivers || []).filter((td) => !td.released_time);
      for (const td of activeDrivers) {
        await tx.trip_drivers.update({
          where: { id: td.id },
          data: { released_time: now, replacement_reason: reasonText }
        });
      }

      await tx.trip_drivers.create({
        data: {
          trip_id: tripId,
          driver_id: newDriver.id,
          driver_role: 'Primary',
          assignment_type: 'Replacement',
          incident_id: bigIncId,
          assigned_time: now,
          replacement_reason: reasonText
        }
      });
    }

    // 5. Cấp lại Vận đơn Waybill mới
    if (prevWaybills.length > 0) {
      await tx.waybills.updateMany({
        where: { trip_id: tripId, status: 'Valid' },
        data: { status: 'Superseded' }
      });
    }

    await tx.waybills.create({
      data: {
        trip_id: tripId,
        waybill_number: newWaybillNo,
        issued_by: actorBigId,
        status: 'Valid',
        trip_data_snapshot: {
          version: nextVersion,
          trip_code: trip?.trip_code,
          replaced_due_to_incident: numIncId,
          new_truck_plate: newTruck?.plate_number || newTruckPlate,
          new_driver_name: newDriver?.users?.full_name || newDriverName,
          replacement_reason: reasonText
        }
      }
    });

    // 6. Cập nhật trạng thái sự cố thành RESOLVED
    return tx.incidents.update({
      where: { id: bigIncId },
      data: {
        status: 'RESOLVED',
        resolution_note: `[Điều xe thay thế ${newTruck?.plate_number || newTruckPlate} - Tài xế ${newDriver?.users?.full_name || newDriverName}]: ${reasonText}`.slice(0, 500),
        resolved_time: now,
        updated_at: now
      },
      select: INCIDENT_SELECT
    });
  });

  // 7. Ghi activity log
  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: actorBigId,
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
      }
    });
  } catch (logErr) {
    console.warn('[IncidentModel] activity_logs replacement error:', logErr.message);
  }

  return {
    ...mapIncident(updatedInc || incident),
    new_waybill_version: nextVersion,
    new_waybill_number: newWaybillNo,
    new_truck_plate: newTruck?.plate_number || newTruckPlate,
    new_driver_name: newDriver?.users?.full_name || newDriverName
  };
};

module.exports = {
  findAll,
  findById,
  findTripIdByCode,
  findFirstTripId,
  create,
  update,
  dispatchReplacementWithTransaction
};
