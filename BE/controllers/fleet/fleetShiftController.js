const fleetService = require('../../services/fleetService');
const { sendSafeError } = require('./fleetValidationHelper');

// ==========================================
// MANAGER DRIVER SHIFTS & LEAVE REQUESTS
// ==========================================

const getShifts = async (req, res) => {
  try {
    const { from, to, status, driver_id } = req.query;
    const shifts = await fleetService.getShifts({ from, to, status, driver_id });
    return res.json({
      total: shifts.length,
      shifts
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi lấy danh sách ca làm việc', 'getShifts');
  }
};

const createShift = async (req, res) => {
  try {
    const { driver_id, date, start_time, end_time, note } = req.body;
    const creatorId = req.user?.id || null;
    const { shift, warning } = await fleetService.createShift({
      driver_id,
      date,
      start_time,
      end_time,
      note,
      creatorId
    });

    return res.status(201).json({
      message: 'Tạo ca làm việc cho tài xế thành công.',
      warning,
      shift
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 400;
    return sendSafeError(res, error, 'Lỗi khi tạo ca làm việc', 'createShift');
  }
};

const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.id || null;
    const { shift, warning } = await fleetService.updateShift(id, {
      ...req.body,
      reviewerId
    });

    return res.json({
      message: 'Cập nhật ca làm việc thành công.',
      warning,
      shift
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi cập nhật ca làm việc', 'updateShift');
  }
};

const approveShift = async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.id || null;
    const { shift, warning } = await fleetService.approveShift(id, reviewerId);

    return res.json({
      message: 'Đã phê duyệt ca làm việc thành công.',
      warning,
      shift
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi duyệt ca làm việc', 'approveShift');
  }
};

const rejectShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user?.id || null;
    const { shift } = await fleetService.rejectShift(id, reason, reviewerId);

    return res.json({
      message: 'Đã từ chối ca làm việc thành công.',
      shift
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi từ chối ca làm việc', 'rejectShift');
  }
};

const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    await fleetService.deleteShift(id);
    return res.json({ message: 'Đã xóa ca làm việc thành công.' });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi xóa ca làm việc', 'deleteShift');
  }
};

const autoAssignNextWeekShifts = async (req, res, next) => {
  try {
    const force = req.body?.force !== undefined ? Boolean(req.body.force) : true;
    const result = await fleetService.autoAssignNextWeekShifts({
      force,
      triggeredBy: req.user?.id || null,
    });
    return res.status(200).json({
      success: true,
      message: result.message || "Hoàn tất xử lý xếp lịch tự động cho tuần tới.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const sendShiftReminders = async (req, res, next) => {
  try {
    const force = req.body?.force !== undefined ? Boolean(req.body.force) : true;
    const result = await fleetService.sendShiftDeadlineReminders({ force });
    return res.status(200).json({
      success: true,
      message: result.message || "Hoàn tất gửi thông báo nhắc đăng ký ca.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const approveDriverWeekShifts = async (req, res, next) => {
  try {
    const { driver_id, week_start } = req.body || {};
    const result = await fleetService.approveDriverWeekShifts({
      driverId: driver_id,
      weekStart: week_start,
      reviewerId: req.user?.id || null,
    });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const switchDriverWeekShiftType = async (req, res, next) => {
  try {
    const { driver_id, week_start, shift_type, auto_approve } = req.body || {};
    const result = await fleetService.switchDriverWeekShiftType({
      driverId: driver_id,
      weekStart: week_start,
      shiftType: shift_type,
      reviewerId: req.user?.id || null,
      autoApprove: Boolean(auto_approve),
    });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getLeaveRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const leaveRequests = await fleetService.getLeaveRequests({ status });
    return res.status(200).json({
      success: true,
      leaveRequests,
    });
  } catch (error) {
    next(error);
  }
};

const decideLeaveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body || {};
    const result = await fleetService.decideLeaveRequest({
      id,
      decision,
      comment,
      reviewerId: req.user?.id || null,
    });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShifts,
  autoAssignNextWeekShifts,
  sendShiftReminders,
  approveDriverWeekShifts,
  switchDriverWeekShiftType,
  createShift,
  updateShift,
  approveShift,
  rejectShift,
  deleteShift,
  getLeaveRequests,
  decideLeaveRequest
};
