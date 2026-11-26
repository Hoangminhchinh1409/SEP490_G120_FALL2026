const prisma = require('../../config/prisma');
const driverModel = require('../../models/driverModel');
const fleetModel = require('../../models/fleetModel');
const leaveModel = require('../../models/leaveModel');

const getAllDrivers = async () => {
  const [profiles, openAssignments] = await Promise.all([
    fleetModel.findAllDrivers(),
    prisma.trip_drivers.findMany({
      where: {
        released_time: null,
        trips: {
          status: { in: ['Assigned', 'Accepted', 'In Progress', 'In Transit', 'Loading Started', 'Loading Done'] }
        }
      },
      select: {
        driver_id: true,
        trips: { select: { trip_code: true } }
      }
    }).catch(() => [])
  ]);

  const activeTripByDriver = new Map();
  for (const row of openAssignments || []) {
    const key = String(row.driver_id);
    if (!activeTripByDriver.has(key)) {
      activeTripByDriver.set(key, row.trips?.trip_code || 'ACTIVE');
    }
  }

  return (profiles || []).map((d) => {
    const u = d.user || {};
    const rawSt = String(d.status || '').trim().toUpperCase().replace(/\s+/g, '_');
    const activeTripCode = activeTripByDriver.get(String(d.id)) || null;
    const hasActiveTrip = Boolean(activeTripCode);

    let status = 'AVAILABLE';
    if (hasActiveTrip || rawSt === 'ON_TRIP' || rawSt === 'ON_DUTY') status = 'ON_DUTY';
    else if (rawSt === 'AVAILABLE' || rawSt === 'ACTIVE') status = 'AVAILABLE';
    else if (rawSt === 'RESTING' || rawSt === 'INACTIVE') status = 'RESTING';
    else if (rawSt === 'SUSPENDED') status = 'SUSPENDED';
    else if (rawSt === 'LEAVE') status = 'LEAVE';
    else status = rawSt || 'AVAILABLE';

    const expYears = d.experience_years !== undefined && d.experience_years !== null
      ? `${d.experience_years} năm kinh nghiệm`
      : null;

    return {
      key: `D${d.id}`,
      id: d.id,
      user_id: d.user_account_id,
      name: u.full_name || (u.username ? `Tài xế ${u.username}` : `Tài xế ${d.id}`),
      phone: u.phone || null,
      email: u.email || null,
      id_card: null,
      license_type: d.license_class ? `Hạng ${d.license_class}` : null,
      license_class: d.license_class || null,
      license_number: d.license_number || null,
      expiry: d.license_expiry || null,
      license_expiry: d.license_expiry || null,
      experience_years: expYears,
      shift_hours_today: d.shift_hours_today ?? null,
      max_shift_hours: null,
      assigned_truck: d.assigned_truck || null,
      current_trip: activeTripCode,
      has_active_trip: hasActiveTrip,
      status: status,
      raw_status: d.status
    };
  });
};

const updateDriver = async (id, payload) => {
  const updateData = {};
  if (payload.status) updateData.status = payload.status;
  if (payload.license_class) updateData.license_class = payload.license_class;
  if (payload.license_expiry) updateData.license_expiry = payload.license_expiry;

  return await fleetModel.updateDriver(id, updateData);
};

const getAllVendors = async () => {
  const vendors = await fleetModel.findAllVendors();
  return (vendors || []).map(v => {
    const rawStatus = String(v.approval_status || '').toUpperCase();
    let status = 'PENDING';
    if (rawStatus === 'APPROVED') status = 'APPROVED';
    else if (rawStatus === 'REJECTED') status = 'REJECTED';
    else status = 'PENDING';

    return {
      id: v.id.toString(),
      key: v.id.toString(),
      name: v.company_name,
      contact_person: v.contact_person,
      phone: v.phone,
      truck_types: v.truck_types,
      status: status,
      rating: v.rating !== undefined && v.rating !== null ? Number(v.rating) : null
    };
  });
};

const getLeaveRequests = async ({ status = null } = {}) => {
  return await leaveModel.getLeaveRequests({ status });
};

const decideLeaveRequest = async ({ id, decision, comment = '', reviewerId = null }) => {
  const normDecision = String(decision || '').trim().toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normDecision)) {
    const err = new Error('Quyết định không hợp lệ (chỉ chấp nhận APPROVED hoặc REJECTED).');
    err.statusCode = 400;
    throw err;
  }

  const found = await leaveModel.getLeaveRequestById(id);
  if (!found || !found.raw) {
    const err = new Error('Không tìm thấy đơn báo nghỉ đột xuất này.');
    err.statusCode = 404;
    throw err;
  }

  const current = found.formatted;
  if (current.status !== 'PENDING') {
    const err = new Error(`Đơn xin nghỉ này đã được xử lý trước đó (${current.status}).`);
    err.statusCode = 400;
    throw err;
  }

  const cleanComment = String(comment || '').trim();
  if (normDecision === 'REJECTED' && !cleanComment) {
    const err = new Error('Vui lòng nhập lý do từ chối đơn xin nghỉ.');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const reviewerName = (await leaveModel.getUserDisplayName(reviewerId)) || 'Quản lý';
  const rawChanges =
    typeof found.raw.changes === 'object' && found.raw.changes
      ? { ...found.raw.changes }
      : JSON.parse(found.raw.changes || '{}');

  const dateDisplay = (current.leave_dates || []).map((d) => d.split('-').reverse().join('/')).join(', ');

  if (normDecision === 'REJECTED') {
    const nextChanges = {
      ...rawChanges,
      status: 'REJECTED',
      manager_comment: cleanComment,
      reviewed_by: reviewerId ? Number(reviewerId) : null,
      reviewed_by_name: reviewerName,
      reviewed_at: nowIso,
    };
    await leaveModel.updateLeaveRequestChanges(current.id, nextChanges);

    if (current.driver_user_id) {
      await driverModel.createSystemNotification({
        userAccountId: current.driver_user_id,
        targetType: 'SHIFT',
        targetId: current.id,
        message: `Đơn báo nghỉ đột xuất các ngày ${dateDisplay} của bạn đã bị Quản lý từ chối. Lý do: ${cleanComment}`,
      });
    }

    const updated = await leaveModel.getLeaveRequestById(current.id);
    return {
      leaveRequest: updated?.formatted || { ...current, status: 'REJECTED', manager_comment: cleanComment },
      cancelledShiftsCount: 0,
      releasedTripIds: [],
      message: 'Đã từ chối đơn báo nghỉ đột xuất và thông báo cho tài xế.',
    };
  }

  // Trường hợp APPROVED:
  const liveAffectedTrips = await leaveModel.getDriverAffectedTripsByDates(current.driver_id, current.leave_dates);
  const storedMap = new Map((current.affected_trips || []).map((t) => [Number(t.trip_id), t]));
  liveAffectedTrips.forEach((t) => {
    if (!storedMap.has(Number(t.trip_id))) {
      storedMap.set(Number(t.trip_id), t);
    }
  });
  const mergedAffectedTrips = [...storedMap.values()];
  const affectedTripIds = mergedAffectedTrips.map((t) => Number(t.trip_id)).filter(Boolean);

  const releasedTripIds = await leaveModel.releaseDriverFromTripsOnApproval(
    current.driver_id,
    affectedTripIds,
    current.reason
  );

  const cancelledShiftsCount = await leaveModel.markDriverShiftsOnDatesAsLeaveApproved(
    current.driver_id,
    current.leave_dates,
    current.reason,
    reviewerId
  );

  const nextChanges = {
    ...rawChanges,
    status: 'APPROVED',
    affected_trips: mergedAffectedTrips,
    manager_comment: cleanComment || 'Đã duyệt cho nghỉ đột xuất',
    reviewed_by: reviewerId ? Number(reviewerId) : null,
    reviewed_by_name: reviewerName,
    reviewed_at: nowIso,
  };
  await leaveModel.updateLeaveRequestChanges(current.id, nextChanges);

  if (current.driver_user_id) {
    await driverModel.createSystemNotification({
      userAccountId: current.driver_user_id,
      targetType: 'SHIFT',
      targetId: current.id,
      message: `Đơn báo nghỉ đột xuất các ngày ${dateDisplay} đã được Quản lý duyệt.${
        releasedTripIds.length > 0
          ? ` ${releasedTripIds.length} chuyến xe bị ảnh hưởng sẽ được Điều phối viên bàn giao cho tài xế khác.`
          : ''
      }`,
    });
  }

  try {
    const dispatchers = await leaveModel.getActiveUsersByRoles([3]);
    const tripCodesText = mergedAffectedTrips.map((t) => t.trip_code).join(', ');
    for (const disp of dispatchers) {
      await driverModel.createSystemNotification({
        userAccountId: disp.id,
        targetType: 'TRIP',
        targetId: releasedTripIds[0] || current.id,
        message:
          releasedTripIds.length > 0
            ? `[Cần đổi tài xế] Tài xế ${current.driver_name} được Quản lý duyệt nghỉ đột xuất ngày ${dateDisplay}. Cần Re-assign ${releasedTripIds.length} chuyến: ${tripCodesText}.`
            : `[Thông báo nghỉ đột xuất] Tài xế ${current.driver_name} được duyệt nghỉ ngày ${dateDisplay}. Lưu ý không điều phối chuyến vào ngày này.`,
      });
    }
  } catch (dispNotifErr) {
    console.warn('Notify dispatchers on approved leave warning:', dispNotifErr.message);
  }

  const updated = await leaveModel.getLeaveRequestById(current.id);
  return {
    leaveRequest: updated?.formatted || { ...current, status: 'APPROVED', affected_trips: mergedAffectedTrips },
    cancelledShiftsCount,
    releasedTripIds,
    message:
      releasedTripIds.length > 0
        ? `Đã duyệt nghỉ đột xuất cho ${current.driver_name}. Đã chuyển ${releasedTripIds.length} chuyến xe sang Điều phối viên để Re-assign tài xế mới.`
        : `Đã duyệt đơn nghỉ đột xuất cho ${current.driver_name} và cập nhật ${cancelledShiftsCount} ngày ca trực.`,
  };
};

module.exports = {
  getAllDrivers,
  updateDriver,
  getAllVendors,
  getLeaveRequests,
  decideLeaveRequest
};
