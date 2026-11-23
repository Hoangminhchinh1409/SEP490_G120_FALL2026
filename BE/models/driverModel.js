const crypto = require("crypto");
const prisma = require("../config/prisma");
const shiftModel = require("./shiftModel");
const notificationModel = require("./notificationModel");
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require("../utils/prismaHelper");

const ensureUUID = (val) => {
  if (!val) return crypto.randomUUID();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  ) {
    return val;
  }
  const hash = crypto.createHash("md5").update(String(val)).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

const normalizeStopDirection = (s) => {
  const raw = String(s.stop_type || s.type || "").trim().toUpperCase();
  if (
    raw === "PICKUP" ||
    raw === "LẤY HÀNG" ||
    (s.sequence === 1 && !raw.includes("DROP") && !raw.includes("DELIVER"))
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
  const orderCargos = ordObj?.order_cargos ? { ...ordObj.order_cargos } : null;
  let mappedOrder = null;
  if (ordObj) {
    const { order_cargos: _omit, ...ordRest } = ordObj;
    mappedOrder = {
      ...ordRest,
      cargos: orderCargos,
    };
  }
  return {
    ...rest,
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
// 3. TRIP & STOP MUTATIONS
// ==========================================

const updateTripStatus = async (tripId, status, extraFields = {}) => {
  const payload = {
    status,
    ...extraFields,
    updated_at: new Date(),
  };

  const updated = await prisma.trips.update({
    where: { id: toBigInt(tripId) },
    data: payload,
  });
  return serializePrisma(updated);
};

const getTripStopById = async (stopId, tripId) => {
  const row = await prisma.trip_stops.findFirst({
    where: {
      id: toBigInt(stopId),
      trip_id: toBigInt(tripId),
    },
    select: {
      id: true,
      trip_id: true,
      order_id: true,
      sequence: true,
      stop_type: true,
      location_id: true,
      planned_arrival: true,
      actual_arrival: true,
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
        },
      },
      orders: {
        select: {
          id: true,
          order_code: true,
          order_type: true,
          status: true,
        },
      },
    },
  });

  if (!row) return null;
  const s = serializePrisma(row);
  const { locations: locObj, orders: ordObj, ...rest } = s;
  return {
    ...rest,
    location: locObj || null,
    order: ordObj || null,
  };
};

const updateTripStop = async (stopId, updateData) => {
  const payload = { ...updateData };
  if (payload.actual_arrival !== undefined) {
    payload.actual_arrival = payload.actual_arrival ? new Date(payload.actual_arrival) : null;
  }
  const updated = await prisma.trip_stops.update({
    where: { id: toBigInt(stopId) },
    data: payload,
  });
  return serializePrisma(updated);
};

const updateOrdersStatus = async (orderIds, status, notes = "", changedBy = null) => {
  if (!orderIds || orderIds.length === 0) return [];
  const bigOrderIds = orderIds.map((oid) => toBigInt(oid)).filter((v) => v !== null);
  const now = new Date();
  const bigChangedBy = toBigInt(changedBy);

  await prisma.orders.updateMany({
    where: { id: { in: bigOrderIds } },
    data: { status, updated_at: now },
  });

  const rows = await prisma.orders.findMany({
    where: { id: { in: bigOrderIds } },
    select: { id: true, status: true },
  });

  try {
    await prisma.order_status_history.createMany({
      data: bigOrderIds.map((oid) => ({
        order_id: oid,
        status,
        changed_by: bigChangedBy,
      })),
    });
  } catch (histErr) {
    console.warn("order_status_history insert warning:", histErr.message);
  }

  return serializePrisma(rows || []);
};

// ==========================================
// 4. FLEET & DRIVER STATUS MUTATIONS
// ==========================================

const updateTruckStatus = async (truckId, status) => {
  if (!truckId) return null;
  try {
    const updated = await prisma.trucks.update({
      where: { id: toBigInt(truckId) },
      data: { status, updated_at: new Date() },
    });
    return [serializePrisma(updated)];
  } catch (error) {
    console.error("updateTruckStatus error:", error);
    return null;
  }
};

const updateDriverProfileStatus = async (driverProfileId, status, lastTripEndedAt = null) => {
  if (!driverProfileId) return null;
  try {
    const updatePayload = { status, updated_at: new Date() };
    if (lastTripEndedAt) updatePayload.last_trip_ended_at = new Date(lastTripEndedAt);

    const updated = await prisma.driver_profiles.update({
      where: { id: toBigInt(driverProfileId) },
      data: updatePayload,
    });
    return [serializePrisma(updated)];
  } catch (error) {
    console.error("updateDriverProfileStatus error:", error);
    return null;
  }
};

// ==========================================
// 5. TRIP EVENTS & DELIVERY EVIDENCE (BR-11, BR-12, BR-27)
// ==========================================

const recordTripEvent = async ({
  clientActionId,
  tripId,
  tripStopId = null,
  driverId = null,
  eventType,
  phoneTime,
  latitude = null,
  longitude = null,
  payload = null,
}) => {
<<<<<<< Updated upstream
  const insertPayload = {
    client_action_id: ensureUUID(clientActionId),
    trip_id: tripId,
    trip_stop_id: tripStopId,
    driver_id: driverId,
    event_type: eventType,
    phone_time: phoneTime || new Date().toISOString(),
    received_time: new Date().toISOString(),
    latitude,
    longitude,
    outside_radius_flag: !!outsideRadiusFlag,
    payload,
  };

  const { data, error } = await supabase
    .from("trip_events")
    .insert([insertPayload])
    .select();

  if (error) {
    if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
      console.log(`[Idempotency] Event with clientActionId ${insertPayload.client_action_id} already exists, ignoring duplicate.`);
      return { client_action_id: insertPayload.client_action_id, duplicate: true };
    }
    console.error("recordTripEvent error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0] : null;
=======
  const created = await prisma.trip_events.create({
    data: {
      client_action_id: ensureUUID(clientActionId),
      trip_id: toBigInt(tripId),
      trip_stop_id: toBigInt(tripStopId),
      driver_id: toBigInt(driverId),
      event_type: eventType,
      phone_time: phoneTime ? new Date(phoneTime) : new Date(),
      received_time: new Date(),
      latitude: latitude !== null && latitude !== undefined ? Number(latitude) : null,
      longitude: longitude !== null && longitude !== undefined ? Number(longitude) : null,
      payload: payload ?? undefined,
    },
  });
  return serializePrisma(created);
>>>>>>> Stashed changes
};

// ==========================================
// 6. INCIDENTS (BF-04 & UC-32)
// ==========================================

const createIncident = async ({
  tripId,
  tripStopId = null,
  reportedBy,
  type = "Other",
  description,
  photos = null,
  incidentLat = null,
  incidentLng = null,
}) => {
  const now = new Date();
  const normalizedPhotos = Array.isArray(photos)
    ? photos.filter(Boolean)
    : typeof photos === "string" && photos.trim()
      ? [photos.trim()]
      : [];

  const created = await prisma.incidents.create({
    data: {
      trip_id: toBigInt(tripId),
      trip_stop_id: toBigInt(tripStopId),
      reported_by: toBigInt(reportedBy),
      type,
      status: "Reported",
      description: String(description || "").slice(0, 500),
      photos: normalizedPhotos,
      incident_lat: incidentLat !== null && incidentLat !== undefined ? Number(incidentLat) : null,
      incident_lng: incidentLng !== null && incidentLng !== undefined ? Number(incidentLng) : null,
      reported_time: now,
      created_at: now,
      updated_at: now,
    },
  });
  return serializePrisma(created);
};

// ==========================================
// 7. IDEMPOTENCY & AUDIT LOGS (BR-27)
// ==========================================

const checkIdempotency = async (clientActionId) => {
  if (!clientActionId) return false;
  try {
    const uuid = ensureUUID(clientActionId);
    const match = await prisma.trip_events.findUnique({
      where: { client_action_id: uuid },
      select: { id: true },
    });
    return Boolean(match);
  } catch {
    return false;
  }
};

const logDriverActivity = async ({
  actorId,
  actorType = "DRIVER",
  action,
  targetType = "TRIP",
  targetId = 0,
  reason = null,
  changes = null,
  clientActionId = null,
}) => {
  try {
    const changesPayload = clientActionId
      ? { ...(typeof changes === "object" && changes !== null ? changes : {}), client_action_id: clientActionId }
      : changes;

    await prisma.activity_logs.create({
      data: {
        actor_id: toBigInt(actorId),
        actor_type: actorType,
        action,
        target_type: targetType,
        target_id: BigInt(typeof targetId === "number" ? targetId : parseInt(targetId, 10) || 0),
        reason: reason ? String(reason).slice(0, 255) : null,
        changes: changesPayload ?? undefined,
        created_time: new Date(),
      },
    });
  } catch (err) {
    console.warn("logDriverActivity insert warning:", err.message);
  }
};

// ==========================================
// 9. CUSTOMER REFUSAL (BR-57)
// ==========================================

const updateOrderRefusal = async (orderId, { reason, photoUrl, changedBy = null }) => {
  const bigOrderId = toBigInt(orderId);
  const updated = await prisma.orders.update({
    where: { id: bigOrderId },
    data: {
      status: "DELIVERED_EXCEPTION",
      refusal_reason: reason,
      refusal_photo: photoUrl,
      updated_at: new Date(),
    },
    select: {
      id: true,
      order_code: true,
      status: true,
      refusal_reason: true,
      refusal_photo: true,
    },
  });

  try {
    await prisma.order_status_history.create({
      data: {
        order_id: bigOrderId,
        status: "DELIVERED_EXCEPTION",
        changed_by: toBigInt(changedBy),
      },
    });
  } catch (hErr) {
    console.warn("order_status_history insert warning:", hErr.message);
  }

  return serializePrisma(updated);
};

// ==========================================
// 10. EXTRA FEES (BR-30, MSG85)
// ==========================================

const createProposedExtraFee = async ({
  tripId,
  orderId = null,
  feeType,
  amount,
  reason,
  photoUrl,
  recordedBy,
}) => {
  const created = await prisma.extra_fees.create({
    data: {
      trip_id: toBigInt(tripId),
      order_id: toBigInt(orderId),
      fee_type: feeType,
      amount: BigInt(parseInt(amount, 10)),
      reason,
      photo_url: photoUrl,
      status: "Proposed",
      source: "Driver",
      suggested_by_system: false,
      recorded_by: toBigInt(recordedBy),
      created_at: new Date(),
    },
  });
  return serializePrisma(created);
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
  updateTripStatus,
  getTripStopById,
  updateTripStop,
  updateOrdersStatus,
  updateTruckStatus,
  updateDriverProfileStatus,
  recordTripEvent,
  createIncident,
  checkIdempotency,
  logDriverActivity,
  updateOrderRefusal,
  createProposedExtraFee,
  getDriverDrivingTimeStats,

  ...shiftModel,
  ...notificationModel,
};
