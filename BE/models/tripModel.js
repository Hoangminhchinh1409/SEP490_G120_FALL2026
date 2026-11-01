const prisma = require('../config/prisma');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapTripStop = (s) => {
  if (!s) return null;
  return {
    ...s,
    id: toPlainNumber(s.id),
    trip_id: toPlainNumber(s.trip_id),
    order_id: toPlainNumber(s.order_id),
    location_id: toPlainNumber(s.location_id),
    distance_from_previous_stop: s.distance_from_previous_stop !== null ? Number(s.distance_from_previous_stop) : null,
    location: s.locations ? {
      ...s.locations,
      id: toPlainNumber(s.locations.id),
      latitude: s.locations.latitude !== null ? Number(s.locations.latitude) : null,
      longitude: s.locations.longitude !== null ? Number(s.locations.longitude) : null
    } : null
  };
};

const mapTripTruck = (tt) => {
  if (!tt) return null;
  return {
    ...tt,
    id: toPlainNumber(tt.id),
    trip_id: toPlainNumber(tt.trip_id),
    truck_id: toPlainNumber(tt.truck_id),
    truck: tt.trucks ? {
      ...tt.trucks,
      id: toPlainNumber(tt.trucks.id),
      allowed_payload: toPlainNumber(tt.trucks.allowed_payload)
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
    planned_distance: t.planned_distance !== null ? Number(t.planned_distance) : null,
    actual_distance: t.actual_distance !== null ? Number(t.actual_distance) : null,
    trip_trucks: (t.trip_trucks || []).map(mapTripTruck),
    trip_drivers: (t.trip_drivers || []).map(mapTripDriver),
    stops: (t.trip_stops || []).map(mapTripStop),
    incidents: (t.incidents || []).map(i => ({
      ...i,
      id: toPlainNumber(i.id),
      trip_id: toPlainNumber(i.trip_id)
    }))
  };
};

const findAllTrips = async () => {
  const trips = await prisma.trips.findMany({
    include: {
      trip_trucks: {
        include: {
          trucks: {
            select: { id: true, plate_number: true, allowed_payload: true, status: true }
          }
        }
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
          locations: {
            select: { id: true, name: true, address: true, latitude: true, longitude: true }
          }
        },
        orderBy: { sequence: 'asc' }
      },
      incidents: {
        select: { id: true, type: true, status: true, description: true, reported_time: true },
        orderBy: { id: 'desc' }
      }
    },
    orderBy: { id: 'desc' }
  });
  return trips.map(mapTrip);
};

const findTruckByPlate = async (plate) => {
  const truck = await prisma.trucks.findFirst({
    where: { plate_number: plate },
    select: { id: true }
  });
  return truck ? toPlainNumber(truck.id) : null;
};

const findFirstTruck = async () => {
  const truck = await prisma.trucks.findFirst({
    where: { status: 'Available' },
    select: { id: true }
  });
  return truck ? toPlainNumber(truck.id) : 14;
};

const findDriverByName = async (name) => {
  const profile = await prisma.driver_profiles.findFirst({
    where: {
      users: {
        full_name: { contains: name, mode: 'insensitive' }
      }
    },
    select: { id: true }
  });
  return profile ? toPlainNumber(profile.id) : null;
};

const findFirstDriver = async () => {
  const driver = await prisma.driver_profiles.findFirst({
    select: { id: true }
  });
  return driver ? toPlainNumber(driver.id) : 6;
};

const createTripWithRelations = async ({
  tripData,
  truckId,
  driverId,
  stopsData,
  orderId
}) => {
  const numOrderId = orderId ? BigInt(orderId) : null;
  const numTruckId = BigInt(truckId);
  const numDriverId = BigInt(driverId);

  return await prisma.$transaction(async (tx) => {
    // 1. Tạo Trip
    const newTrip = await tx.trips.create({
      data: {
        trip_code: tripData.trip_code,
        status: tripData.status || 'Assigned',
        planned_start: tripData.planned_start ? new Date(tripData.planned_start) : new Date(),
        planned_distance: tripData.planned_distance ? parseFloat(tripData.planned_distance) : 50.0,
        planned_duration: tripData.planned_duration ? parseInt(tripData.planned_duration, 10) : 60,
        created_by: tripData.created_by ? BigInt(tripData.created_by) : 1
      }
    });

    const tripId = newTrip.id;

    // 2. Gán xe (trip_trucks)
    await tx.trip_trucks.create({
      data: {
        trip_id: tripId,
        truck_id: numTruckId,
        assignment_type: 'Original'
      }
    });

    // 3. Gán tài xế (trip_drivers)
    await tx.trip_drivers.create({
      data: {
        trip_id: tripId,
        driver_id: numDriverId,
        driver_role: 'Primary',
        assignment_type: 'Original'
      }
    });

    // 4. Tạo các trạm dừng (trip_stops)
    if (Array.isArray(stopsData) && stopsData.length > 0) {
      for (let i = 0; i < stopsData.length; i++) {
        const s = stopsData[i];
        await tx.trip_stops.create({
          data: {
            trip_id: tripId,
            order_id: numOrderId,
            sequence: i + 1,
            stop_type: s.type || (i === 0 ? 'PICKUP' : 'DROPOFF'),
            location_id: s.location_id ? BigInt(s.location_id) : 1,
            planned_arrival: s.planned_arrival ? new Date(s.planned_arrival) : null,
            status: s.status || 'Pending'
          }
        });
      }
    }

    // 5. Cập nhật trạng thái xe thành 'In Transit'
    await tx.trucks.update({
      where: { id: numTruckId },
      data: { status: 'In Transit' }
    });

    // 6. Cập nhật đơn hàng thành ASSIGNED
    if (numOrderId) {
      await tx.orders.update({
        where: { id: numOrderId },
        data: {
          status: 'ASSIGNED',
          updated_at: new Date()
        }
      });
    }

    return mapTrip(newTrip);
  });
};

const updateTripStatus = async (id, status) => {
  const numId = BigInt(id);
  const updated = await prisma.trips.update({
    where: { id: numId },
    data: {
      status
    }
  });
  return mapTrip(updated);
};

module.exports = {
  findAllTrips,
  findTruckByPlate,
  findFirstTruck,
  findDriverByName,
  findFirstDriver,
  createTripWithRelations,
  updateTripStatus
};
