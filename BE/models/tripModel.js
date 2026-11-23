const prisma = require('../config/prisma');
const { serializePrisma, toBigInt, toNum } = require('../utils/prismaHelper');

const mapTripStop = (s) => {
  if (!s) return null;
  const ss = serializePrisma(s);
  const orderCargo = Array.isArray(s.orders?.order_cargos)
    ? s.orders.order_cargos[0]
    : s.orders?.order_cargos;

  return {
    ...ss,
    id: toNum(s.id),
    trip_id: toNum(s.trip_id),
    order_id: toNum(s.order_id),
    location_id: toNum(s.location_id),
    distance_from_previous_stop: s.distance_from_previous_stop !== null ? Number(s.distance_from_previous_stop) : null,
    loaded_weight: s.loaded_weight !== null && s.loaded_weight !== undefined ? Number(s.loaded_weight) : null,
    delivered_weight: s.delivered_weight !== null && s.delivered_weight !== undefined ? Number(s.delivered_weight) : null,
    location: s.locations ? {
      ...serializePrisma(s.locations),
      id: toNum(s.locations.id),
      latitude: s.locations.latitude !== null ? Number(s.locations.latitude) : null,
      longitude: s.locations.longitude !== null ? Number(s.locations.longitude) : null
    } : null,
    order: s.orders ? {
      id: toNum(s.orders.id),
      order_code: s.orders.order_code,
      status: s.orders.status,
      receiver_name: s.orders.receiver_name,
      receiver_phone: s.orders.receiver_phone,
      agreed_price: toNum(s.orders.agreed_price),
      vendor_tracking_code: s.orders.vendor_tracking_code,
      customer: s.orders.customers ? {
        id: toNum(s.orders.customers.id),
        company_name: s.orders.customers.company_name,
        phone: s.orders.customers.phone
      } : null,
      cargo: orderCargo ? {
        cargo_name: orderCargo.cargo_name,
        cargo_type: orderCargo.cargo_type,
        quantity: toNum(orderCargo.quantity),
        unit: orderCargo.unit,
        actual_weight_kg: orderCargo.actual_weight_kg !== null ? Number(orderCargo.actual_weight_kg) : null,
        chargeable_weight_kg: orderCargo.chargeable_weight_kg !== null ? Number(orderCargo.chargeable_weight_kg) : null,
        length_cm: orderCargo.length_cm !== null ? Number(orderCargo.length_cm) : null,
        width_cm: orderCargo.width_cm !== null ? Number(orderCargo.width_cm) : null,
        height_cm: orderCargo.height_cm !== null ? Number(orderCargo.height_cm) : null
      } : null
    } : null,
    evidences: (s.delivery_evidences || []).map((ev) => ({
      ...serializePrisma(ev),
      id: toNum(ev.id),
      trip_stop_id: toNum(ev.trip_stop_id),
      order_id: toNum(ev.order_id),
      latitude: ev.latitude !== null ? Number(ev.latitude) : null,
      longitude: ev.longitude !== null ? Number(ev.longitude) : null
    }))
  };
};

const mapTripTruck = (tt) => {
  if (!tt) return null;
  const stt = serializePrisma(tt);
  return {
    ...stt,
    id: toNum(tt.id),
    trip_id: toNum(tt.trip_id),
    truck_id: toNum(tt.truck_id),
    incident_id: toNum(tt.incident_id),
    truck: tt.trucks ? {
      ...serializePrisma(tt.trucks),
      id: toNum(tt.trucks.id),
      allowed_payload: toNum(tt.trucks.allowed_payload),
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
  const std = serializePrisma(td);
  const user = td.driver_profiles?.users ? {
    id: toNum(td.driver_profiles.users.id),
    full_name: td.driver_profiles.users.full_name,
    phone: td.driver_profiles.users.phone
  } : null;

  return {
    ...std,
    id: toNum(td.id),
    trip_id: toNum(td.trip_id),
    driver_id: toNum(td.driver_id),
    incident_id: toNum(td.incident_id),
    driver: {
      id: toNum(td.driver_id),
      user
    }
  };
};

const mapTrip = (t) => {
  if (!t) return null;
  const st = serializePrisma(t);
  return {
    ...st,
    id: toNum(t.id),
    created_by: toNum(t.created_by),
    planned_distance: t.planned_distance !== null ? Number(t.planned_distance) : null,
    actual_distance: t.actual_distance !== null ? Number(t.actual_distance) : null,
    trip_trucks: (t.trip_trucks || []).map(mapTripTruck),
    trip_drivers: (t.trip_drivers || []).map(mapTripDriver),
    stops: (t.trip_stops || []).map(mapTripStop),
    incidents: (t.incidents || []).map((i) => ({
      ...serializePrisma(i),
      id: toNum(i.id),
      trip_id: toNum(i.trip_id)
    })),
    waybills: (t.waybills || []).map((w) => ({
      ...serializePrisma(w),
      id: toNum(w.id),
      trip_id: toNum(w.trip_id),
      issued_by: toNum(w.issued_by)
    })),
    events: (t.trip_events || []).map((e) => ({
      ...serializePrisma(e),
      id: toNum(e.id),
      trip_id: toNum(e.trip_id),
      trip_stop_id: toNum(e.trip_stop_id),
      driver_id: toNum(e.driver_id),
      latitude: e.latitude !== null ? Number(e.latitude) : null,
      longitude: e.longitude !== null ? Number(e.longitude) : null
    }))
  };
};

const findAllTrips = async () => {
  const trips = await prisma.trips.findMany({
    include: {
      trip_trucks: {
        include: { trucks: true }
      },
      trip_drivers: {
        include: {
          driver_profiles: {
            include: {
              users: { select: { id: true, full_name: true, phone: true } }
            }
          }
        }
      },
      trip_stops: {
        include: {
          locations: true,
          orders: {
            include: {
              customers: true,
              order_cargos: true
            }
          },
          delivery_evidences: true
        }
      },
      incidents: {
        select: {
          id: true,
          type: true,
          status: true,
          description: true,
          reported_time: true,
          resolution_note: true
        }
      },
      waybills: true,
      trip_events: true
    },
    orderBy: { id: 'desc' }
  });
  return (trips || []).map(mapTrip);
};

const findTripByCode = async (codeOrId) => {
  if (!codeOrId) return null;
  const str = String(codeOrId).trim();
  const isNum = /^\d+$/.test(str);

  let query = supabase
    .from('trips')
    .select(`
      *,
      trip_trucks(id, trip_id, truck_id, incident_id, assignment_type, trucks(*)),
      trip_drivers(id, trip_id, driver_id, incident_id, driver_role, assignment_type, driver_profiles(*, users:user_account_id(id, full_name, phone))),
      trip_stops(*, locations(*), orders(*, customers(*), order_cargos(*)), delivery_evidences(*)),
      incidents(id, type, status, description, reported_time, resolution_note),
      waybills(*),
      trip_events(*)
    `);

  if (isNum) {
    query = query.or(`trip_code.eq.${str},id.eq.${Number(str)}`);
  } else {
    query = query.ilike('trip_code', str);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error('tripModel.findTripByCode error:', error);
    throw error;
  }
  return data ? mapTrip(data) : null;
};

const findTruckByPlate = async (plate) => {
  if (!plate) return null;
  const cleanPlate = String(plate).split(' ')[0].trim();
  const truck = await prisma.trucks.findFirst({
    where: {
      deleted_at: null,
      plate_number: { contains: cleanPlate, mode: 'insensitive' }
    },
    select: { id: true }
  });
  return truck ? Number(truck.id) : null;
};

const findFirstTruck = async () => {
  const available = await prisma.trucks.findFirst({
    where: {
      deleted_at: null,
      status: { in: ['Available', 'AVAILABLE', 'Active'] }
    },
    select: { id: true }
  });
  if (available) return Number(available.id);
  const anyTruck = await prisma.trucks.findFirst({
    where: { deleted_at: null },
    select: { id: true }
  });
  return anyTruck ? Number(anyTruck.id) : 14;
};

const findDriverByName = async (name) => {
  if (!name) return null;
  const cleanName = String(name).split('·')[0].split('-')[0].trim();
  const match = await prisma.driver_profiles.findFirst({
    where: {
      users: {
        full_name: { contains: cleanName, mode: 'insensitive' }
      }
    },
    select: { id: true }
  });
  return match ? Number(match.id) : null;
};

const findFirstDriver = async () => {
  const first = await prisma.driver_profiles.findFirst({
    select: { id: true }
  });
  return first ? Number(first.id) : 6;
};

const findOrderByCodeOrId = async (orderIdOrCode) => {
  if (!orderIdOrCode) return null;
  const strVal = String(orderIdOrCode).trim();
  const where = /^\d+$/.test(strVal)
    ? { id: BigInt(Number(strVal)) }
    : { order_code: strVal };

  const order = await prisma.orders.findFirst({
    where,
    include: {
      customers: true,
      order_cargos: true
    }
  });
  return serializePrisma(order);
};

const findVendorByNameOrId = async (vendorNameOrId) => {
  if (!vendorNameOrId) return null;
  const strVal = String(vendorNameOrId).trim();
  if (/^\d+$/.test(strVal)) {
    const byId = await prisma.vendors.findUnique({
      where: { id: BigInt(Number(strVal)) }
    });
    if (byId) return serializePrisma(byId);
  }
  const byName = await prisma.vendors.findFirst({
    where: { company_name: { contains: strVal, mode: 'insensitive' } }
  });
  if (byName) return serializePrisma(byName);
  const firstVendor = await prisma.vendors.findFirst();
  return serializePrisma(firstVendor);
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
  const bigTruckId = BigInt(Number(truckId));
  const bigDriverId = BigInt(Number(driverId));
  const bigDriver2Id = secondaryDriverId ? BigInt(Number(secondaryDriverId)) : null;
  const actorId = BigInt(tripData.created_by ? Number(tripData.created_by) : 1);
  const now = new Date();

  const newTrip = await prisma.$transaction(async (tx) => {
    const createdTrip = await tx.trips.create({
      data: {
        trip_code: tripData.trip_code,
        status: tripData.status || 'Assigned',
        planned_start: tripData.planned_start ? new Date(tripData.planned_start) : now,
        planned_distance: tripData.planned_distance ? parseFloat(tripData.planned_distance) : 50.0,
        planned_duration: tripData.planned_duration ? parseInt(tripData.planned_duration, 10) : 60,
        created_by: actorId
      }
    });

    const tripId = createdTrip.id;

    await tx.trip_trucks.create({
      data: {
        trip_id: tripId,
        truck_id: bigTruckId,
        assignment_type: 'Original'
      }
    });

    await tx.trip_drivers.create({
      data: {
        trip_id: tripId,
        driver_id: bigDriverId,
        driver_role: 'Primary',
        assignment_type: 'Original'
      }
    });

    if (bigDriver2Id && bigDriver2Id !== bigDriverId) {
      await tx.trip_drivers.create({
        data: {
          trip_id: tripId,
          driver_id: bigDriver2Id,
          driver_role: 'Secondary',
          assignment_type: 'Original'
        }
      });
    }

    if (Array.isArray(stopsData) && stopsData.length > 0) {
      const stopsToInsert = stopsData.map((s, i) => {
        let normalizedStopType = 'Drop-off';
        const rawType = String(s.type || s.stop_type || '').toUpperCase();
        if (rawType === 'PICKUP') normalizedStopType = 'Pickup';
        else if (rawType === 'REST') normalizedStopType = 'Rest';
        else if (rawType === 'TRANSIT') normalizedStopType = 'Transit';

        return {
          trip_id: tripId,
          order_id: s.order_id ? BigInt(Number(s.order_id)) : (numOrderId ? BigInt(numOrderId) : null),
          sequence: i + 1,
          stop_type: normalizedStopType,
          location_id: s.location_id ? BigInt(Number(s.location_id)) : 1n,
          planned_arrival: s.planned_arrival ? new Date(s.planned_arrival) : null,
          distance_from_previous_stop: s.distance_from_previous_stop ? parseFloat(s.distance_from_previous_stop) : null,
          status: s.status || 'Pending'
        };
      });
      await tx.trip_stops.createMany({ data: stopsToInsert });
    }

    const waybillNum = `WB-${tripData.trip_code.replace(/^TRIP-/i, '')}-V1`.slice(0, 20);
    await tx.waybills.create({
      data: {
        trip_id: tripId,
        waybill_number: waybillNum,
        issued_by: actorId,
        status: 'Valid',
        trip_data_snapshot: {
          version: 1,
          trip_code: tripData.trip_code,
          ...waybillSnapshot
        }
      }
    });

    await tx.trip_status_history.create({
      data: {
        trip_id: tripId,
        status: 'Assigned',
        changed_by: actorId
      }
    });

    await tx.trucks.update({
      where: { id: bigTruckId },
      data: { status: 'On Trip', updated_at: now }
    });

    if (numOrderId) {
      const bigOrderId = BigInt(numOrderId);
      await tx.orders.update({
        where: { id: bigOrderId },
        data: { status: 'ASSIGNED', updated_at: now }
      });

      await tx.order_status_history.create({
        data: {
          order_id: bigOrderId,
          status: 'ASSIGNED',
          changed_by: actorId
        }
      });
    }

    return createdTrip;
  });

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
  const bigOrderId = BigInt(Number(orderId));
  const actorId = BigInt(userId ? Number(userId) : 1);
  const now = new Date();

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.orders.update({
      where: { id: bigOrderId },
      data: {
        vendor_id: vendorId ? BigInt(Number(vendorId)) : null,
        vendor_tracking_code: vendorTrackingCode ? String(vendorTrackingCode).slice(0, 50) : null,
        status: 'HANDED_OVER_VENDOR',
        is_closed: false,
        updated_at: now
      }
    });

    await tx.order_status_history.create({
      data: {
        order_id: bigOrderId,
        status: 'HANDED_OVER_VENDOR',
        changed_by: actorId
      }
    });

    await tx.order_notes.create({
      data: {
        order_id: bigOrderId,
        created_by: actorId,
        content: `[Bàn giao Nhà xe 3PL]: ${vendorName || 'Đối tác'} - Mã vận đơn: ${vendorTrackingCode} - Số xe: ${vendorVehicleCount || 1} - Chi phí: ${vendorCost || 'Theo HĐ'}`.slice(0, 500)
      }
    });

    return order;
  });

  return serializePrisma(updatedOrder) || { id: Number(orderId) };
};

const updateTripStatus = async (id, status, userId = 1) => {
  const strId = String(id).trim();
  const existingTrip = await prisma.trips.findFirst({
    where: /^\d+$/.test(strId) ? { id: BigInt(Number(strId)) } : { trip_code: strId },
    include: {
      trip_trucks: true,
      trip_drivers: true,
      trip_stops: true
    }
  });

  if (!existingTrip) {
    throw new Error('Không tìm thấy chuyến xe');
  }

  const tripId = existingTrip.id;
  const actorId = BigInt(userId ? Number(userId) : 1);
  const now = new Date();
  const updateData = {
    status,
    updated_at: now
  };
  if (status === 'Completed' || status === 'COMPLETED') {
    updateData.actual_distance = existingTrip.planned_distance || 50;
    updateData.actual_duration = existingTrip.planned_duration || 60;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updTrip = await tx.trips.update({
      where: { id: tripId },
      data: updateData
    });

    await tx.trip_status_history.create({
      data: {
        trip_id: tripId,
        status,
        changed_by: actorId
      }
    });

    if (status === 'Completed' || status === 'Cancelled') {
      const activeTrucks = (existingTrip.trip_trucks || []).filter((tt) => !tt.released_time);
      for (const tt of activeTrucks) {
        await tx.trip_trucks.update({
          where: { id: tt.id },
          data: { released_time: now }
        });
        await tx.trucks.update({
          where: { id: tt.truck_id },
          data: { status: 'AVAILABLE', updated_at: now }
        });
      }

      const activeDrivers = (existingTrip.trip_drivers || []).filter((td) => !td.released_time);
      for (const td of activeDrivers) {
        await tx.trip_drivers.update({
          where: { id: td.id },
          data: { released_time: now }
        });
        await tx.driver_profiles.update({
          where: { id: td.driver_id },
          data: {
            status: 'Active',
            ...(status === 'Completed' ? { last_trip_ended_at: now } : {}),
            updated_at: now
          }
        });
      }

      const orderIds = [...new Set((existingTrip.trip_stops || []).map((s) => s.order_id).filter(Boolean))];

      if (status === 'Completed') {
        await tx.trip_stops.updateMany({
          where: { trip_id: tripId },
          data: { status: 'Done', actual_arrival: now }
        });
        for (const ordId of orderIds) {
          await tx.orders.update({
            where: { id: ordId },
            data: { status: 'DELIVERED', is_closed: true, updated_at: now }
          });
          await tx.order_status_history.create({
            data: {
              order_id: ordId,
              status: 'DELIVERED',
              changed_by: actorId
            }
          });
        }
      } else if (status === 'Cancelled') {
        await tx.trip_stops.updateMany({
          where: { trip_id: tripId },
          data: { status: 'Skipped' }
        });
        for (const ordId of orderIds) {
          await tx.orders.update({
            where: { id: ordId },
            data: { status: 'READY_FOR_PLANNING', updated_at: now }
          });
          await tx.order_status_history.create({
            data: {
              order_id: ordId,
              status: 'READY_FOR_PLANNING',
              changed_by: actorId
            }
          });
        }
      }
    }

    return updTrip;
  });

  return mapTrip(updated || existingTrip);
};

module.exports = {
  findAllTrips,
  findTripByCode,
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
