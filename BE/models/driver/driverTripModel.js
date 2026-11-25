const prisma = require("../../config/prisma");
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require("../../utils/prismaHelper");

const normalizeStopDirection = (s) => {
  const raw = String(s.stop_type || s.type || "").trim().toUpperCase();
  if (raw === "RETURN" || raw === "RETURN_TO_WAREHOUSE" || raw === "HOÀN KHO") {
    return "Return";
  }
  if (
    raw === "PICKUP" ||
    raw === "LẤY HÀNG" ||
    (s.sequence === 1 && !raw.includes("DROP") && !raw.includes("DELIVER") && !raw.includes("RETURN"))
  ) {
    return "Pickup";
  }
  return "Drop-off";
};

const mapProfileRow = (row) => {
  if (!row) return null;
  const s = serializePrisma(row);
  const { users: userObj, ...rest } = s;
  return {
    ...rest,
    id: toNum(row.id),
    user_account_id: toNum(row.user_account_id),
    license_expiry: formatDateOnly(row.license_expiry),
    user: userObj || null,
  };
};

const mapTripStopRow = (s) => {
  const ss = serializePrisma(s);
  const { locations: locObj, orders: ordObj, ...rest } = ss;
  const orderCargos = Array.isArray(ordObj?.order_cargos)
    ? ordObj.order_cargos
    : ordObj?.order_cargos
      ? [ordObj.order_cargos]
      : [];
  let mappedOrder = null;
  if (ordObj) {
    const { order_cargos: _omit, ...ordRest } = ordObj;
    mappedOrder = {
      ...ordRest,
      cargos: orderCargos[0] || null,
      order_cargos: orderCargos,
    };
  }
  return {
    ...rest,
    raw_stop_type: rest.stop_type,
    stop_type: normalizeStopDirection(rest),
    location: locObj || null,
    order: mappedOrder,
  };
};

const mapTripDetailRow = (t) => {
  if (!t) return null;
  const st = serializePrisma(t);
  const { trip_trucks: ttRows, trip_stops: tsRows, ...rest } = st;

  const stops = (tsRows || [])
    .map(mapTripStopRow)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const truckAssignments = (ttRows || []).map((tt) => ({
    truck_id: tt.truck_id,
    assignment_type: tt.assignment_type,
    truck: tt.trucks || null,
  }));

  const activeTruckAssign =
    truckAssignments.find((ta) => ta.truck) || truckAssignments[0];

  return {
    ...rest,
    truck_assignments: truckAssignments,
    stops,
    truck: activeTruckAssign ? activeTruckAssign.truck : null,
  };
};

// ==========================================
// 1. PROFILE & DRIVER IDENTITY
// ==========================================

const getDriverProfileByUserId = async (userId) => {
  const row = await prisma.driver_profiles.findUnique({
    where: { user_account_id: toBigInt(userId) },
    select: {
      id: true,
      user_account_id: true,
      license_number: true,
      license_class: true,
      license_expiry: true,
      status: true,
      last_trip_ended_at: true,
      users: {
        select: {
          id: true,
          username: true,
          full_name: true,
          phone: true,
          email: true,
          status: true,
        },
      },
    },
  });
  return mapProfileRow(row);
};

const getDriverProfileById = async (driverProfileId) => {
  const row = await prisma.driver_profiles.findUnique({
    where: { id: toBigInt(driverProfileId) },
    select: {
      id: true,
      user_account_id: true,
      license_number: true,
      license_class: true,
      license_expiry: true,
      status: true,
      last_trip_ended_at: true,
      users: {
        select: {
          id: true,
          username: true,
          full_name: true,
          phone: true,
          email: true,
          status: true,
        },
      },
    },
  });
  return mapProfileRow(row);
};

// ==========================================
// 2. TRIP QUERIES (ACTIVE & HISTORY)
// ==========================================

const getActiveTrip = async (driverProfileId) => {
  const assignments = await prisma.trip_drivers.findMany({
    where: {
      driver_id: toBigInt(driverProfileId),
      released_time: null,
    },
    select: { trip_id: true, driver_role: true, assignment_type: true },
    orderBy: { id: "desc" },
  });

  if (!assignments || assignments.length === 0) {
    return null;
  }

  const tripIds = [...new Set(assignments.map((a) => a.trip_id))];

  const tripsRaw = await prisma.trips.findMany({
    where: {
      id: { in: tripIds },
      status: { in: ["Assigned", "Dispatched", "Accepted", "In Progress"] },
    },
    select: {
      id: true,
      trip_code: true,
      planned_start: true,
      planned_distance: true,
      planned_duration: true,
      actual_distance: true,
      actual_duration: true,
      status: true,
      created_by: true,
      created_at: true,
      trip_trucks: {
        select: {
          truck_id: true,
          assignment_type: true,
          trucks: {
            select: {
              id: true,
              plate_number: true,
              model: true,
              allowed_payload: true,
              box_length: true,
              box_width: true,
              box_height: true,
              status: true,
            },
          },
        },
      },
      trip_stops: {
        select: {
          id: true,
          trip_id: true,
          order_id: true,
          sequence: true,
          stop_type: true,
          location_id: true,
          planned_arrival: true,
          actual_arrival: true,
          distance_from_previous_stop: true,
          loaded_quantity: true,
          loaded_weight: true,
          delivered_quantity: true,
          delivered_weight: true,
          status: true,
          locations: {
            select: {
              id: true,
              name: true,
              address: true,
              latitude: true,
              longitude: true,
              contact_name: true,
              contact_phone: true,
            },
          },
          orders: {
            select: {
              id: true,
              order_code: true,
              order_type: true,
              customer_id: true,
              agreed_price: true,
              status: true,
              is_closed: true,
              refusal_reason: true,
              refusal_photo: true,
              warehouse_name: true,
              responsible_dispatcher_id: true,
              receiver_name: true,
              receiver_phone: true,
              order_cargos: true,
            },
          },
        },
      },
    },
    orderBy: { planned_start: "asc" },
  });

  if (!tripsRaw || tripsRaw.length === 0) {
    return null;
  }

  const trips = tripsRaw.map(mapTripDetailRow);
  const activeTrip =
    trips.find((t) => t.status === "In Progress" || t.status === "Accepted") ||
    trips[0];

  return {
    activeTrip,
    upcomingTrips: trips,
  };
};

const getTripHistory = async (driverProfileId, { page = 1, limit = 10 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const assignments = await prisma.trip_drivers.findMany({
    where: { driver_id: toBigInt(driverProfileId) },
    select: { trip_id: true },
  });

  if (!assignments || assignments.length === 0) {
    return { trips: [], total: 0, page, limit };
  }

  const tripIds = [...new Set(assignments.map((a) => a.trip_id))];
  const where = {
    id: { in: tripIds },
    status: { in: ["Completed", "Cancelled"] },
  };

  const [rows, total] = await Promise.all([
    prisma.trips.findMany({
      where,
      select: {
        id: true,
        trip_code: true,
        planned_start: true,
        actual_distance: true,
        actual_duration: true,
        status: true,
        created_at: true,
        trip_trucks: {
          select: {
            trucks: { select: { plate_number: true, allowed_payload: true } },
          },
        },
        trip_stops: {
          select: {
            id: true,
            sequence: true,
            stop_type: true,
            status: true,
            locations: { select: { name: true, address: true } },
          },
        },
      },
      orderBy: { id: "desc" },
      skip,
      take,
    }),
    prisma.trips.count({ where }),
  ]);

  const trips = serializePrisma(rows || []).map((t) => ({
    ...t,
    truck_assignments: (t.trip_trucks || []).map((tt) => ({ truck: tt.trucks || null })),
    stops: (t.trip_stops || []).map((s) => ({
      id: s.id,
      sequence: s.sequence,
      stop_type: s.stop_type,
      status: s.status,
      location: s.locations || null,
    })),
  }));

  return {
    trips,
    total: total || 0,
    page,
    limit,
  };
};

const getTripDetail = async (tripId, driverProfileId) => {
  const bigTripId = toBigInt(tripId);
  const bigDriverId = toBigInt(driverProfileId);
  if (bigTripId === null || bigDriverId === null) return null;

  const assign = await prisma.trip_drivers.findFirst({
    where: { trip_id: bigTripId, driver_id: bigDriverId },
    select: { trip_id: true, driver_role: true },
  });

  if (!assign) {
    return null;
  }

  const trip = await prisma.trips.findUnique({
    where: { id: bigTripId },
    select: {
      id: true,
      trip_code: true,
      planned_start: true,
      planned_distance: true,
      planned_duration: true,
      actual_distance: true,
      actual_duration: true,
      status: true,
      created_by: true,
      created_at: true,
      trip_trucks: {
        select: {
          truck_id: true,
          assignment_type: true,
          trucks: {
            select: {
              id: true,
              plate_number: true,
              model: true,
              allowed_payload: true,
              status: true,
            },
          },
        },
      },
      trip_stops: {
        select: {
          id: true,
          trip_id: true,
          order_id: true,
          sequence: true,
          stop_type: true,
          location_id: true,
          planned_arrival: true,
          actual_arrival: true,
          distance_from_previous_stop: true,
          loaded_quantity: true,
          loaded_weight: true,
          delivered_quantity: true,
          delivered_weight: true,
          status: true,
          locations: {
            select: {
              id: true,
              name: true,
              address: true,
              latitude: true,
              longitude: true,
              contact_name: true,
              contact_phone: true,
            },
          },
          orders: {
            select: {
              id: true,
              order_code: true,
              order_type: true,
              customer_id: true,
              agreed_price: true,
              status: true,
              is_closed: true,
              refusal_reason: true,
              refusal_photo: true,
              warehouse_name: true,
              responsible_dispatcher_id: true,
              receiver_name: true,
              receiver_phone: true,
              order_cargos: true,
            },
          },
        },
      },
    },
  });

  return mapTripDetailRow(trip);
};

// ==========================================
// 12. DRIVING HOURS CALCULATION (BR-34)
// ==========================================

const getDriverDrivingTimeStats = async (driverProfileId) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const dayOfWeek = now.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diffToMonday
  );

  const assignments = await prisma.trip_drivers.findMany({
    where: { driver_id: toBigInt(driverProfileId) },
    select: { trip_id: true },
  });

  const tripIds = [...new Set((assignments || []).map((a) => a.trip_id))];

  let todayDrivenMinutes = 0;
  let weekDrivenMinutes = 0;
  let continuousMinutes = 0;

  if (tripIds.length > 0) {
    const recentTrips = await prisma.trips.findMany({
      where: {
        id: { in: tripIds },
        created_at: { gte: startOfWeek },
      },
      select: {
        id: true,
        actual_duration: true,
        status: true,
        planned_start: true,
        created_at: true,
        updated_at: true,
      },
    });

    for (const t of recentTrips || []) {
      const dur = t.actual_duration || 0;
      const tripTime = new Date(t.created_at).getTime();

      if (tripTime >= startOfDay.getTime()) {
        todayDrivenMinutes += dur;
      }
      weekDrivenMinutes += dur;
    }
  }

  const activeTripRes = await getActiveTrip(driverProfileId);
  const activeTrip = activeTripRes?.activeTrip || null;
  if (activeTrip && activeTrip.status === "In Progress") {
    const firstStopArrive = (activeTrip.stops || []).find((s) => s.actual_arrival);
    if (firstStopArrive && firstStopArrive.actual_arrival) {
      const startedAt = new Date(firstStopArrive.actual_arrival).getTime();
      const currentActiveMin = Math.max(
        0,
        Math.round((now.getTime() - startedAt) / 60000)
      );
      continuousMinutes = currentActiveMin;
      todayDrivenMinutes += currentActiveMin;
      weekDrivenMinutes += currentActiveMin;
    }
  }

  const continuousHours = Math.round((continuousMinutes / 60) * 10) / 10;
  const todayHours = Math.round((todayDrivenMinutes / 60) * 10) / 10;
  const weekHours = Math.round((weekDrivenMinutes / 60) * 10) / 10;

  return {
    continuous_hours_driven: continuousHours,
    continuous_hours_left: Math.max(
      0,
      Math.round((4.0 - continuousHours) * 10) / 10
    ),
    continuous_limit: 4.0,

    daily_hours_driven: todayHours,
    daily_hours_left: Math.max(0, Math.round((10.0 - todayHours) * 10) / 10),
    daily_limit: 10.0,

    weekly_hours_driven: weekHours,
    weekly_hours_left: Math.max(0, Math.round((48.0 - weekHours) * 10) / 10),
    weekly_limit: 48.0,
  };
};

module.exports = {
  getDriverProfileByUserId,
  getDriverProfileById,
  getActiveTrip,
  getTripHistory,
  getTripDetail,
  getDriverDrivingTimeStats,
};
