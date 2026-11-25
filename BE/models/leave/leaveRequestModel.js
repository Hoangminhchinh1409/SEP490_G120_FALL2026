const prisma = require("../../config/prisma");
const { serializePrisma, toBigInt, toNum } = require("../../utils/prismaHelper");

const GMT7_OFFSET_MS = 7 * 3600 * 1000;
const ACTIVE_TRIP_STATUSES = ["Assigned", "Dispatched", "Accepted", "In Progress"];
const LEAVE_LOG_ACTION = "DRIVER_LEAVE_REQUEST";
const LEAVE_TARGET_TYPE = "DRIVER_LEAVE";

const LEAVE_REASSIGN_CACHE_TTL_MS = 10000;
let leaveReassignCache = { data: null, expiresAt: 0 };

const getLeaveReassignCache = () => leaveReassignCache;
const setLeaveReassignCache = (data) => {
  leaveReassignCache = { data, expiresAt: Date.now() + LEAVE_REASSIGN_CACHE_TTL_MS };
};
const invalidateLeaveReassignmentCache = () => {
  leaveReassignCache = { data: null, expiresAt: 0 };
};

const toDateObj = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  const clean = String(dateStr).split("T")[0].trim();
  return new Date(`${clean}T00:00:00.000Z`);
};

const getTodayGMT7Str = () => {
  return new Date(Date.now() + GMT7_OFFSET_MS).toISOString().split("T")[0];
};

const toGMT7DateStr = (isoTimestamp) => {
  if (!isoTimestamp) return null;
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getTime() + GMT7_OFFSET_MS).toISOString().split("T")[0];
};

const parseChangesJson = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const formatRouteFromStops = (stops = []) => {
  const sorted = [...(stops || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const firstLoc = sorted[0]?.location?.name || sorted[0]?.location?.address || null;
  const lastLoc =
    sorted.length > 1
      ? sorted[sorted.length - 1]?.location?.name || sorted[sorted.length - 1]?.location?.address || null
      : null;

  if (firstLoc && lastLoc) return `${firstLoc} -> ${lastLoc}`;
  if (firstLoc) return firstLoc;
  return sorted.length > 0 ? `${sorted.length} điểm dừng` : "Chưa có điểm dừng";
};

/**
 * Lấy danh sách chuyến xe đang hoạt động/đã giao cho tài xế trong các ngày được chọn (GMT+7).
 */
const getDriverAffectedTripsByDates = async (driverProfileId, dates = []) => {
  const targetSet = new Set((dates || []).map((d) => String(d).trim()).filter(Boolean));
  if (!driverProfileId || targetSet.size === 0) return [];

  const assignments = await prisma.trip_drivers.findMany({
    where: {
      driver_id: toBigInt(driverProfileId),
      released_time: null,
    },
    select: { trip_id: true },
  });

  if (!assignments || assignments.length === 0) return [];

  const tripIds = [...new Set(assignments.map((a) => a.trip_id))];
  const trips = await prisma.trips.findMany({
    where: {
      id: { in: tripIds },
      status: { in: ACTIVE_TRIP_STATUSES },
    },
    select: {
      id: true,
      trip_code: true,
      planned_start: true,
      status: true,
      created_at: true,
      trip_trucks: {
        select: {
          released_time: true,
          trucks: { select: { plate_number: true, model: true } },
        },
      },
      trip_stops: {
        select: {
          id: true,
          sequence: true,
          stop_type: true,
          locations: { select: { name: true, address: true } },
        },
      },
    },
    orderBy: { planned_start: "asc" },
  });

  const todayStr = getTodayGMT7Str();
  const nowMs = Date.now();

  return serializePrisma(trips || [])
    .filter((t) => {
      const dateStr = toGMT7DateStr(t.planned_start || t.created_at);
      if (!dateStr || !targetSet.has(dateStr)) return false;

      if (dateStr === todayStr) {
        const upperSt = String(t.status || "").toUpperCase();
        if (upperSt === "COMPLETED" || upperSt === "CANCELLED") return false;
      }
      return true;
    })
    .map((t) => {
      const truckAssigns = (t.trip_trucks || []).map((ta) => ({
        released_time: ta.released_time,
        truck: ta.trucks || null,
      }));
      const activeTruck =
        truckAssigns.find((ta) => !ta.released_time && ta.truck) ||
        truckAssigns[0] ||
        null;

      const stopsMapped = (t.trip_stops || []).map((s) => ({
        ...s,
        location: s.locations || null,
      }));

      const dateStr = toGMT7DateStr(t.planned_start || t.created_at);
      let isUrgent = false;
      let hoursUntilStart = null;
      if (t.planned_start) {
        const startMs = new Date(t.planned_start).getTime();
        hoursUntilStart = Number(((startMs - nowMs) / 3600000).toFixed(1));
        if (dateStr === todayStr && hoursUntilStart < 2) {
          isUrgent = true;
        }
      }

      return {
        trip_id: toNum(t.id),
        trip_code: t.trip_code || `TRIP-${t.id}`,
        planned_start: t.planned_start,
        planned_date: dateStr,
        status: t.status,
        plate_number: activeTruck?.truck?.plate_number || null,
        route_summary: formatRouteFromStops(stopsMapped),
        is_urgent: isUrgent,
        hours_until_start: hoursUntilStart,
        reassigned: false,
        reassigned_to_driver_id: null,
        reassigned_to_driver_name: null,
        reassigned_at: null,
      };
    });
};

const formatLeaveRow = (row, driverMap = {}, activeTripDriverMap = new Map()) => {
  const sRow = serializePrisma(row);
  const changes = parseChangesJson(sRow.changes);
  const driverProf = driverMap[Number(sRow.target_id)] || null;
  const leaveStatus = String(changes.status || "PENDING").toUpperCase();

  const enrichedTrips = (changes.affected_trips || []).map((tr) => {
    const activeDriver = activeTripDriverMap.get(Number(tr.trip_id));
    if (leaveStatus === "APPROVED" && activeDriver && Number(activeDriver.driver_id) !== Number(sRow.target_id)) {
      return {
        ...tr,
        reassigned: true,
        reassigned_to_driver_id: Number(activeDriver.driver_id),
        reassigned_to_driver_name: activeDriver.driver_name || tr.reassigned_to_driver_name || "Tài xế thay thế",
      };
    }
    return tr;
  });

  return {
    id: toNum(sRow.id),
    driver_id: toNum(sRow.target_id),
    driver_user_id: sRow.actor_id ? toNum(sRow.actor_id) : driverProf?.user_account_id || null,
    driver_name: driverProf?.user?.full_name || driverProf?.user?.username || `Tài xế #${sRow.target_id}`,
    driver_phone: driverProf?.user?.phone || "",
    license_class: driverProf?.license_class || "",
    leave_dates: Array.isArray(changes.leave_dates) ? changes.leave_dates : [],
    reason: changes.reason || sRow.reason || "",
    status: leaveStatus,
    is_urgent: Boolean(changes.is_urgent || enrichedTrips.some((t) => t.is_urgent)),
    affected_trips: enrichedTrips,
    manager_comment: changes.manager_comment || null,
    reviewed_by: changes.reviewed_by || null,
    reviewed_by_name: changes.reviewed_by_name || null,
    reviewed_at: changes.reviewed_at || null,
    created_at: sRow.created_time,
  };
};

const createLeaveRequest = async ({ userId, driverProfileId, dates, reason, isUrgent = false, affectedTrips = [] }) => {
  const cleanReason = String(reason || "").trim();
  const urgentFlag = Boolean(isUrgent || affectedTrips.some((t) => t.is_urgent));
  const payloadChanges = {
    leave_dates: dates,
    reason: cleanReason,
    status: "PENDING",
    is_urgent: urgentFlag,
    affected_trips: affectedTrips,
    manager_comment: null,
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
  };

  const created = await prisma.activity_logs.create({
    data: {
      actor_id: toBigInt(userId),
      actor_type: "DRIVER",
      action: LEAVE_LOG_ACTION,
      target_type: LEAVE_TARGET_TYPE,
      target_id: toBigInt(driverProfileId),
      reason: cleanReason.slice(0, 250),
      changes: payloadChanges,
      created_time: new Date(),
    },
  });

  invalidateLeaveReassignmentCache();
  return created ? formatLeaveRow(created, {}) : null;
};

const getLeaveRequests = async ({ driverProfileId = null, status = null } = {}) => {
  const where = { action: LEAVE_LOG_ACTION };
  if (driverProfileId) {
    where.target_id = toBigInt(driverProfileId);
  }

  const logs = await prisma.activity_logs.findMany({
    where,
    select: {
      id: true,
      actor_id: true,
      actor_type: true,
      action: true,
      target_type: true,
      target_id: true,
      changes: true,
      reason: true,
      created_time: true,
    },
    orderBy: { id: "desc" },
  });

  if (!logs || logs.length === 0) return [];

  const driverIds = [...new Set(logs.map((l) => l.target_id).filter(Boolean))];
  const driverMap = {};

  const approvedTripIds = [];
  logs.forEach((l) => {
    const ch = parseChangesJson(l.changes);
    if (String(ch.status || "").toUpperCase() === "APPROVED") {
      (ch.affected_trips || []).forEach((tr) => {
        if (tr.trip_id) approvedTripIds.push(BigInt(Number(tr.trip_id)));
      });
    }
  });

  const uniqueTripIds = [...new Set(approvedTripIds)];

  const [profiles, currentAssigns] = await Promise.all([
    driverIds.length > 0
      ? prisma.driver_profiles.findMany({
          where: { id: { in: driverIds } },
          select: {
            id: true,
            user_account_id: true,
            license_class: true,
            users: {
              select: { id: true, username: true, full_name: true, phone: true, email: true },
            },
          },
        })
      : Promise.resolve([]),
    uniqueTripIds.length > 0
      ? prisma.trip_drivers.findMany({
          where: {
            trip_id: { in: uniqueTripIds },
            released_time: null,
          },
          select: {
            trip_id: true,
            driver_id: true,
            released_time: true,
            driver_profiles: {
              select: {
                id: true,
                users: { select: { full_name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  serializePrisma(profiles || []).forEach((p) => {
    driverMap[Number(p.id)] = {
      ...p,
      user: p.users || null,
    };
  });

  const activeTripDriverMap = new Map();
  serializePrisma(currentAssigns || []).forEach((a) => {
    activeTripDriverMap.set(Number(a.trip_id), {
      driver_id: Number(a.driver_id),
      driver_name: a.driver_profiles?.users?.full_name || `Tài xế #${a.driver_id}`,
    });
  });

  const formatted = logs.map((row) => formatLeaveRow(row, driverMap, activeTripDriverMap));
  if (status && status !== "ALL") {
    const targetSt = String(status).toUpperCase();
    return formatted.filter((item) => item.status === targetSt);
  }
  return formatted;
};

const getLeaveRequestById = async (id) => {
  const row = await prisma.activity_logs.findFirst({
    where: {
      id: toBigInt(id),
      action: LEAVE_LOG_ACTION,
    },
    select: {
      id: true,
      actor_id: true,
      actor_type: true,
      action: true,
      target_type: true,
      target_id: true,
      changes: true,
      reason: true,
      created_time: true,
    },
  });

  if (!row) return null;

  const prof = await prisma.driver_profiles.findUnique({
    where: { id: row.target_id },
    select: {
      id: true,
      user_account_id: true,
      license_class: true,
      users: {
        select: { id: true, username: true, full_name: true, phone: true, email: true },
      },
    },
  });

  const sProf = serializePrisma(prof);
  const driverMap = sProf
    ? { [Number(sProf.id)]: { ...sProf, user: sProf.users || null } }
    : {};

  return {
    raw: serializePrisma(row),
    formatted: formatLeaveRow(row, driverMap),
  };
};

const updateLeaveRequestChanges = async (id, changesObj) => {
  const bigId = toBigInt(id);
  const existing = await prisma.activity_logs.findFirst({
    where: { id: bigId, action: LEAVE_LOG_ACTION },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.activity_logs.update({
    where: { id: bigId },
    data: { changes: changesObj },
  });
  invalidateLeaveReassignmentCache();
  return serializePrisma(updated);
};

const markDriverShiftsOnDatesAsLeaveApproved = async (driverProfileId, dates = [], reason = "", reviewerId = null) => {
  if (!driverProfileId || !dates || dates.length === 0) return 0;

  const dateObjs = dates.map(toDateObj).filter(Boolean);
  if (dateObjs.length === 0) return 0;

  const existingShifts = await prisma.driver_shifts.findMany({
    where: {
      driver_id: toBigInt(driverProfileId),
      date: { in: dateObjs },
      status: { in: ["Requested", "Approved"] },
    },
    select: { id: true, date: true, status: true },
  });

  if (!existingShifts || existingShifts.length === 0) return 0;

  const shiftIds = existingShifts.map((s) => s.id);
  const now = new Date();
  const rejectMsg = `[Đã duyệt nghỉ đột xuất] ${String(reason || "").trim()}`.slice(0, 240);

  await prisma.driver_shifts.updateMany({
    where: { id: { in: shiftIds } },
    data: {
      status: "Rejected",
      rejection_reason: rejectMsg,
      reviewed_by: toBigInt(reviewerId),
      reviewed_at: now,
      updated_at: now,
    },
  });

  return shiftIds.length;
};

const releaseDriverFromTripsOnApproval = async (driverProfileId, tripIds = [], reason = "") => {
  if (!driverProfileId || !tripIds || tripIds.length === 0) return [];

  const bigDriverId = toBigInt(driverProfileId);
  const bigTripIds = tripIds.map((id) => toBigInt(id)).filter((v) => v !== null);

  const activeRows = await prisma.trip_drivers.findMany({
    where: {
      driver_id: bigDriverId,
      trip_id: { in: bigTripIds },
      released_time: null,
    },
    select: { id: true, trip_id: true },
  });

  if (!activeRows || activeRows.length === 0) return [];

  const now = new Date();
  const reasonMsg = `[Nghỉ đột xuất đã duyệt] ${String(reason || "").trim()}`.slice(0, 250);
  const rowIds = activeRows.map((r) => r.id);

  await prisma.trip_drivers.updateMany({
    where: { id: { in: rowIds } },
    data: {
      released_time: now,
      replacement_reason: reasonMsg,
    },
  });

  const prof = await prisma.driver_profiles.findUnique({
    where: { id: bigDriverId },
    select: { id: true, status: true },
  });

  if (prof && String(prof.status || "").toUpperCase() === "ON_TRIP") {
    await prisma.driver_profiles.update({
      where: { id: bigDriverId },
      data: { status: "Active", updated_at: now },
    });
  }

  return [...new Set(activeRows.map((r) => Number(r.trip_id)))];
};

const getActiveUsersByRoles = async (roleIds = []) => {
  if (!roleIds || roleIds.length === 0) return [];
  const rows = await prisma.users.findMany({
    where: {
      role_id: { in: roleIds.map((r) => BigInt(Number(r))) },
      status: { equals: "active", mode: "insensitive" },
    },
    select: { id: true, full_name: true, role_id: true, status: true },
  });
  return serializePrisma(rows || []);
};

const getUserDisplayName = async (userId) => {
  if (!userId) return null;
  const user = await prisma.users.findUnique({
    where: { id: toBigInt(userId) },
    select: { full_name: true, username: true },
  });
  return user?.full_name || user?.username || null;
};

module.exports = {
  ACTIVE_TRIP_STATUSES,
  LEAVE_LOG_ACTION,
  toDateObj,
  getTodayGMT7Str,
  toGMT7DateStr,
  parseChangesJson,
  formatRouteFromStops,
  getLeaveReassignCache,
  setLeaveReassignCache,
  invalidateLeaveReassignmentCache,
  getDriverAffectedTripsByDates,
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  updateLeaveRequestChanges,
  markDriverShiftsOnDatesAsLeaveApproved,
  releaseDriverFromTripsOnApproval,
  getActiveUsersByRoles,
  getUserDisplayName,
};
