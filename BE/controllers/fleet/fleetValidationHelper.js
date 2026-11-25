const prisma = require('../../config/prisma');

const VALID_TRUCK_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'];
const VALID_LICENSE_CLASSES = ['B2', 'C', 'FC'];
const VALID_DRIVER_PROFILE_STATUSES = ['ACTIVE', 'INACTIVE', 'RESTING', 'SUSPENDED', 'LEAVE'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+() -]{9,15}$/;
const TX_OPTIONS = { maxWait: 10000, timeout: 15000 };

const normalizeDriverProfileStatus = (rawStatus) => {
  const norm = String(rawStatus || 'ACTIVE').trim().toUpperCase().replace(/\s+/g, '_');
  return norm || 'ACTIVE';
};

const formatP2002Message = (error, fallbackMessage) => {
  const target = Array.isArray(error?.meta?.target)
    ? error.meta.target.join(',').toLowerCase()
    : String(error?.meta?.target || '').toLowerCase();
  if (target.includes('license_number')) return 'Số GPLX đã tồn tại trong hệ thống.';
  if (target.includes('email')) return 'Email đã tồn tại trong hệ thống.';
  if (target.includes('username')) return 'Tên đăng nhập đã tồn tại trong hệ thống.';
  if (target.includes('user_account_id')) return 'Tài xế này đã có hồ sơ trong hệ thống.';
  if (target.includes('id')) return 'Xung đột khóa chính khi lưu dữ liệu (sequence id), vui lòng thử lại.';
  return fallbackMessage;
};

const createControllerError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const sendSafeError = (res, error, fallbackMessage, logLabel = 'Fleet Controller Error') => {
  const statusCode = Number(error?.statusCode);
  if (statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ message: error.message || fallbackMessage });
  }
  console.error(`${logLabel}:`, error);
  return res.status(500).json({ message: fallbackMessage });
};

const isTruckOnActiveTrip = async (truckBigId, currentStatus = '') => {
  const stUpper = String(currentStatus || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (['ON_TRIP', 'IN_TRANSIT', 'IN_PROGRESS'].includes(stUpper)) {
    return true;
  }
  const activeTripTruck = await prisma.trip_trucks.findFirst({
    where: {
      truck_id: truckBigId,
      released_time: null,
      trips: {
        status: {
          in: ['Assigned', 'Accepted', 'In Progress', 'In Transit', 'Loading Started', 'Loading Done']
        }
      }
    },
    select: { id: true }
  });
  return Boolean(activeTripTruck);
};

const getTodayGMT7Str = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().split('T')[0];

const parsePositiveNumber = (val, fieldLabel) => {
  if (val === undefined || val === null || val === '' || typeof val === 'boolean') {
    throw createControllerError(`${fieldLabel} là bắt buộc và phải là số lớn hơn 0.`, 400);
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) {
    throw createControllerError(`${fieldLabel} phải là số lớn hơn 0.`, 400);
  }
  return num;
};

const parseValidDateStr = (val, fieldLabel, { mustBeFutureOrToday = false } = {}) => {
  if (typeof val !== 'string' || !val.trim()) {
    throw createControllerError(`${fieldLabel} là bắt buộc và phải đúng định dạng ngày.`, 400);
  }
  const trimmed = val.trim();
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  let isoDate;
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]);
    const d = Number(ymdMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
      throw createControllerError(`${fieldLabel} không đúng định dạng ngày hợp lệ.`, 400);
    }
    isoDate = trimmed;
  } else {
    const parsedMs = Date.parse(trimmed);
    if (Number.isNaN(parsedMs)) {
      throw createControllerError(`${fieldLabel} không đúng định dạng ngày hợp lệ.`, 400);
    }
    isoDate = new Date(parsedMs).toISOString().split('T')[0];
  }

  if (mustBeFutureOrToday && isoDate < getTodayGMT7Str()) {
    throw createControllerError(`${fieldLabel} không được nằm trong quá khứ.`, 400);
  }
  return isoDate;
};

const validateTruckStatusValue = (status) => {
  if (typeof status !== 'string' || !status.trim()) {
    throw createControllerError('Trạng thái xe không hợp lệ. Chỉ chấp nhận: AVAILABLE, MAINTENANCE, INACTIVE.', 400);
  }
  const normalized = status.trim().toUpperCase();
  if (normalized === 'ON_TRIP') {
    throw createControllerError('Không thể đặt trạng thái ON_TRIP thủ công. Trạng thái này do hệ thống tự động gán khi điều phối chuyến xe (BR-24).', 400);
  }
  if (!VALID_TRUCK_STATUSES.includes(normalized)) {
    throw createControllerError('Trạng thái xe không hợp lệ. Chỉ chấp nhận: AVAILABLE, MAINTENANCE, INACTIVE.', 400);
  }
  return normalized;
};

const validateLicenseClassValue = (licenseClass) => {
  if (typeof licenseClass !== 'string' || !licenseClass.trim()) {
    throw createControllerError('Hạng bằng lái không hợp lệ (chỉ chấp nhận B2, C, FC).', 400);
  }
  const normalized = licenseClass.trim().toUpperCase();
  if (!VALID_LICENSE_CLASSES.includes(normalized)) {
    throw createControllerError('Hạng bằng lái không hợp lệ (chỉ chấp nhận B2, C, FC).', 400);
  }
  return normalized;
};

const toDateObj = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).split('T')[0].trim();
  return new Date(`${s}T00:00:00.000Z`);
};

module.exports = {
  VALID_TRUCK_STATUSES,
  VALID_LICENSE_CLASSES,
  VALID_DRIVER_PROFILE_STATUSES,
  EMAIL_REGEX,
  PHONE_REGEX,
  TX_OPTIONS,
  normalizeDriverProfileStatus,
  formatP2002Message,
  createControllerError,
  sendSafeError,
  isTruckOnActiveTrip,
  getTodayGMT7Str,
  parsePositiveNumber,
  parseValidDateStr,
  validateTruckStatusValue,
  validateLicenseClassValue,
  toDateObj
};
