const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { serializePrisma, toBigInt } = require("../../utils/prismaHelper");

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
          is_closed: true,
          refusal_reason: true,
          refusal_photo: true,
          warehouse_name: true,
          responsible_dispatcher_id: true,
        },
      },
    },
  });

  if (!row) return null;
  const s = serializePrisma(row);
  const { locations: locObj, orders: ordObj, ...rest } = s;
  return {
    ...rest,
    raw_stop_type: rest.stop_type,
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

const updateOrdersStatus = async (orderIds, status, notes = "", changedBy = null, extraData = {}) => {
  if (!orderIds || orderIds.length === 0) return [];
  const bigOrderIds = orderIds.map((oid) => toBigInt(oid)).filter((v) => v !== null);
  const now = new Date();
  const bigChangedBy = toBigInt(changedBy);

  const updatePayload = {
    status,
    updated_at: now,
    ...extraData,
  };
  if (status === "DELIVERED" && updatePayload.is_closed === undefined) {
    updatePayload.is_closed = true;
  }

  await prisma.orders.updateMany({
    where: { id: { in: bigOrderIds } },
    data: updatePayload,
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
  const actionUuid = ensureUUID(clientActionId);
  try {
    const created = await prisma.trip_events.create({
      data: {
        client_action_id: actionUuid,
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
  } catch (error) {
    if (error?.code === 'P2002') {
      console.log(`[Idempotency] Event with clientActionId ${actionUuid} already exists, ignoring duplicate.`);
      return { client_action_id: actionUuid, duplicate: true };
    }
    console.error("recordTripEvent error:", error);
    throw error;
  }
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

module.exports = {
  updateTripStatus,
  getTripStopById,
  updateTripStop,
  updateOrdersStatus,
  updateTruckStatus,
  updateDriverProfileStatus,
  recordTripEvent,
  checkIdempotency,
  logDriverActivity,
};
