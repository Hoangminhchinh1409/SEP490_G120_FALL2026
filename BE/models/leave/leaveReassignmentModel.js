const prisma = require("../../config/prisma");
const notificationModel = require("../notificationModel");
const { serializePrisma, toBigInt, formatDateOnly } = require("../../utils/prismaHelper");
const {
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
  getLeaveRequests,
  updateLeaveRequestChanges,
} = require("./leaveRequestModel");

let leaveReassignInflight = null;

/**
 * Dispatcher: Lấy danh sách chuyến xe đang cần đổi tài xế (do tài xế nghỉ đột xuất đã duyệt)
 * và danh sách tài xế nội bộ khả dụng kèm lịch ca làm việc theo ngày chạy chuyến.
 */
const getReassignmentsNeededForDispatcher = async () => {
  const approvedLeaves = await getLeaveRequests({ status: "APPROVED" });

  const leaveByTripId = new Map();
  approvedLeaves.forEach((lr) => {
    (lr.affected_trips || []).forEach((tr) => {
      if (!leaveByTripId.has(Number(tr.trip_id))) {
        leaveByTripId.set(Number(tr.trip_id), {
          leave_request_id: lr.id,
          leaving_driver_id: lr.driver_id,
          leaving_driver_name: lr.driver_name,
          leaving_driver_phone: lr.driver_phone,
          leave_dates: lr.leave_dates,
          leave_reason: lr.reason,
          reviewed_at: lr.reviewed_at,
        });
      }
    });
  });

  const activeTripsRaw = await prisma.trips.findMany({
    where: { status: { in: ACTIVE_TRIP_STATUSES } },
    select: {
      id: true,
      trip_code: true,
      planned_start: true,
      planned_duration: true,
      planned_distance: true,
      status: true,
      created_at: true,
      trip_trucks: {
        select: {
          released_time: true,
          trucks: {
            select: {
              id: true,
              plate_number: true,
              model: true,
              allowed_payload: true,
              required_license_class: true,
            },
          },
        },
      },
      trip_drivers: {
        select: {
          id: true,
          driver_id: true,
          driver_role: true,
          assignment_type: true,
          assigned_time: true,
          released_time: true,
          replacement_reason: true,
          driver_profiles: {
            select: {
              id: true,
              license_class: true,
              users: { select: { id: true, full_name: true, phone: true } },
            },
          },
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

  const activeTrips = serializePrisma(activeTripsRaw || []);
  const pendingReassignments = [];

  activeTrips.forEach((t) => {
    const assigns = t.trip_drivers || [];
    const hasActiveDriver = assigns.some((a) => !a.released_time);
    const leaveMeta = leaveByTripId.get(Number(t.id)) || null;

    if (!hasActiveDriver) {
      const sortedReleased = [...assigns]
        .filter((a) => a.released_time)
        .sort((a, b) => new Date(b.released_time) - new Date(a.released_time));
      const latestReleased = sortedReleased[0] || null;
      const truckAssigns = (t.trip_trucks || []).map((ta) => ({
        released_time: ta.released_time,
        truck: ta.trucks || null,
      }));
      const activeTruck =
        truckAssigns.find((ta) => !ta.released_time && ta.truck) ||
        truckAssigns[0] ||
        null;

      const mappedStops = (t.trip_stops || []).map((s) => ({
        ...s,
        location: s.locations || null,
      }));

      pendingReassignments.push({
        trip_id: Number(t.id),
        trip_code: t.trip_code || `TRIP-${t.id}`,
        planned_start: t.planned_start,
        planned_date: toGMT7DateStr(t.planned_start || t.created_at),
        planned_duration: t.planned_duration,
        planned_distance: t.planned_distance,
        status: t.status,
        plate_number: activeTruck?.truck?.plate_number || "Chưa rõ biển số",
        truck_model: activeTruck?.truck?.model || "Xe tải",
        required_license_class: activeTruck?.truck?.required_license_class || null,
        route_summary: formatRouteFromStops(mappedStops),
        leave_request_id: leaveMeta?.leave_request_id || null,
        leaving_driver_id:
          leaveMeta?.leaving_driver_id || (latestReleased ? Number(latestReleased.driver_id) : null),
        leaving_driver_name:
          leaveMeta?.leaving_driver_name ||
          latestReleased?.driver_profiles?.users?.full_name ||
          "Tài xế trước",
        leaving_driver_phone:
          leaveMeta?.leaving_driver_phone || latestReleased?.driver_profiles?.users?.phone || "",
        leave_reason:
          leaveMeta?.leave_reason ||
          latestReleased?.replacement_reason ||
          "Nghỉ đột xuất đã được Quản lý duyệt",
        reassigned: false,
      });
    }
  });

  const todayDateObj = toDateObj(getTodayGMT7Str());
  const [allDriversRaw, upcomingShiftsRaw, busyAssignmentsRaw] = await Promise.all([
    prisma.driver_profiles.findMany({
      select: {
        id: true,
        user_account_id: true,
        license_class: true,
        license_expiry: true,
        status: true,
        users: { select: { id: true, full_name: true, phone: true, status: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.driver_shifts.findMany({
      where: {
        date: { gte: todayDateObj },
        status: { not: "Rejected" },
      },
      select: { id: true, driver_id: true, date: true, start_time: true, end_time: true, status: true },
    }),
    prisma.trip_drivers.findMany({
      where: { released_time: null },
      select: {
        driver_id: true,
        trips: { select: { id: true, trip_code: true, planned_start: true, status: true } },
      },
    }),
  ]);

  const shiftsByDriver = new Map();
  serializePrisma(upcomingShiftsRaw || []).forEach((s, idx) => {
    const key = Number(s.driver_id);
    if (!shiftsByDriver.has(key)) shiftsByDriver.set(key, []);
    shiftsByDriver.get(key).push({
      date: formatDateOnly(upcomingShiftsRaw[idx].date),
      status: s.status,
      start_time: s.start_time,
      end_time: s.end_time,
    });
  });

  const activeTripCountByDriver = new Map();
  serializePrisma(busyAssignmentsRaw || []).forEach((b) => {
    if (b.trips && ACTIVE_TRIP_STATUSES.includes(b.trips.status)) {
      const key = Number(b.driver_id);
      activeTripCountByDriver.set(key, (activeTripCountByDriver.get(key) || 0) + 1);
    }
  });

  const availableDrivers = serializePrisma(allDriversRaw || [])
    .filter((d) => String(d.users?.status || "").toUpperCase() === "ACTIVE")
    .map((d) => ({
      id: Number(d.id),
      user_account_id: Number(d.user_account_id),
      full_name: d.users?.full_name || `Tài xế #${d.id}`,
      phone: d.users?.phone || "",
      license_class: d.license_class || "C",
      license_expiry: formatDateOnly(d.license_expiry),
      status: d.status,
      active_trips_count: activeTripCountByDriver.get(Number(d.id)) || 0,
      shifts: shiftsByDriver.get(Number(d.id)) || [],
    }));

  return {
    reassignments: pendingReassignments,
    availableDrivers,
  };
};

/**
 * Dispatcher: Gán tài xế thay thế mới cho chuyến xe (do nghỉ đột xuất / đổi tài).
 */
const reassignDriverOnTrip = async ({ tripId, newDriverId, dispatcherUserId, reason = "" }) => {
  const numTripId = Number(tripId);
  const numDriverId = Number(newDriverId);
  if (!numTripId || !numDriverId) {
    const err = new Error("Thiếu mã chuyến xe hoặc tài xế thay thế hợp lệ.");
    err.statusCode = 400;
    throw err;
  }

  const bigTripId = BigInt(numTripId);
  const bigDriverId = BigInt(numDriverId);

  const trip = await prisma.trips.findUnique({
    where: { id: bigTripId },
    select: {
      id: true,
      trip_code: true,
      planned_start: true,
      status: true,
      trip_trucks: {
        select: {
          released_time: true,
          trucks: { select: { plate_number: true } },
        },
      },
    },
  });

  if (!trip) {
    const err = new Error("Không tìm thấy chuyến xe cần đổi tài xế.");
    err.statusCode = 404;
    throw err;
  }
  if (trip.status === "Completed" || trip.status === "Cancelled") {
    const err = new Error("Chuyến xe đã hoàn thành hoặc đã hủy, không thể đổi tài xế.");
    err.statusCode = 400;
    throw err;
  }

  const newDriver = await prisma.driver_profiles.findUnique({
    where: { id: bigDriverId },
    select: {
      id: true,
      user_account_id: true,
      license_class: true,
      users: { select: { id: true, full_name: true, phone: true, status: true } },
    },
  });

  if (!newDriver) {
    const err = new Error("Không tìm thấy hồ sơ tài xế thay thế.");
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const cleanReason =
    String(reason || "Điều phối viên đổi tài xế thay thế do nghỉ đột xuất").trim().slice(0, 250);

  await prisma.$transaction(async (tx) => {
    await tx.trip_drivers.updateMany({
      where: { trip_id: bigTripId, released_time: null },
      data: { released_time: now, replacement_reason: cleanReason },
    });

    await tx.trip_drivers.create({
      data: {
        trip_id: bigTripId,
        driver_id: bigDriverId,
        driver_role: "Primary",
        assignment_type: "Replacement",
        assigned_time: now,
        replacement_reason: cleanReason,
      },
    });

    await tx.trips.update({
      where: { id: bigTripId },
      data: { updated_at: now },
    });
  });

  const newDriverName = newDriver.users?.full_name || `Tài xế #${numDriverId}`;
  const leaveLogs = await prisma.activity_logs.findMany({
    where: { action: LEAVE_LOG_ACTION },
    select: { id: true, changes: true },
  });

  for (const log of leaveLogs || []) {
    const ch = parseChangesJson(log.changes);
    if (String(ch.status || "").toUpperCase() !== "APPROVED") continue;
    const tripsArr = Array.isArray(ch.affected_trips) ? ch.affected_trips : [];
    let modified = false;
    const updatedTripsArr = tripsArr.map((tr) => {
      if (Number(tr.trip_id) === numTripId) {
        modified = true;
        return {
          ...tr,
          reassigned: true,
          reassigned_to_driver_id: numDriverId,
          reassigned_to_driver_name: newDriverName,
          reassigned_at: nowIso,
        };
      }
      return tr;
    });
    if (modified) {
      await updateLeaveRequestChanges(log.id, { ...ch, affected_trips: updatedTripsArr });
    }
  }

  const truckAssigns = (trip.trip_trucks || []).map((ta) => ({
    released_time: ta.released_time,
    truck: ta.trucks || null,
  }));
  const activeTruck =
    truckAssigns.find((ta) => !ta.released_time && ta.truck) ||
    truckAssigns[0] ||
    null;
  const plate = activeTruck?.truck?.plate_number || "Xe tải";
  const plannedDate = toGMT7DateStr(trip.planned_start) || "";

  if (newDriver.user_account_id) {
    await notificationModel.createSystemNotification({
      userAccountId: Number(newDriver.user_account_id),
      targetType: "TRIP",
      targetId: numTripId,
      message: `Bạn được điều phối thay thế chạy chuyến ${trip.trip_code || `#${numTripId}`} (${plate})${plannedDate ? ` ngày ${plannedDate}` : ""}. Lý do: ${cleanReason}`,
    });
  }

  await prisma.activity_logs.create({
    data: {
      actor_id: toBigInt(dispatcherUserId),
      actor_type: "DISPATCHER",
      action: "DISPATCHER_REASSIGN_DRIVER",
      target_type: "TRIP",
      target_id: bigTripId,
      changes: {
        trip_id: numTripId,
        trip_code: trip.trip_code,
        new_driver_id: numDriverId,
        new_driver_name: newDriverName,
      },
      reason: cleanReason,
      created_time: now,
    },
  });

  invalidateLeaveReassignmentCache();
  return {
    trip_id: numTripId,
    trip_code: trip.trip_code || `TRIP-${numTripId}`,
    new_driver_id: numDriverId,
    new_driver_name: newDriverName,
    new_driver_phone: newDriver.users?.phone || "",
    reason: cleanReason,
  };
};

const getReassignmentsNeededForDispatcherCached = async ({ refresh = false } = {}) => {
  const now = Date.now();
  const cached = getLeaveReassignCache();
  if (!refresh && cached.data && cached.expiresAt > now) {
    return cached.data;
  }
  if (!refresh && leaveReassignInflight) {
    return leaveReassignInflight;
  }
  const promise = getReassignmentsNeededForDispatcher()
    .then((data) => {
      setLeaveReassignCache(data);
      return data;
    })
    .finally(() => {
      if (leaveReassignInflight === promise) {
        leaveReassignInflight = null;
      }
    });
  leaveReassignInflight = promise;
  return promise;
};

module.exports = {
  getReassignmentsNeededForDispatcher: getReassignmentsNeededForDispatcherCached,
  reassignDriverOnTrip,
};
