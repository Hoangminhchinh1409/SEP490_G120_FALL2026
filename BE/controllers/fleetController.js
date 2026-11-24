const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fleetService = require('../services/fleetService');
const staffAccountService = require('../services/staffAccountService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../utils/prismaHelper');

const VALID_TRUCK_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'];
const VALID_LICENSE_CLASSES = ['B2', 'C', 'FC'];
const VALID_DRIVER_PROFILE_STATUSES = ['ACTIVE', 'INACTIVE', 'RESTING', 'SUSPENDED', 'LEAVE'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+() -]{9,15}$/;

const createControllerError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
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

/**
 * Fleet Controller — Nhóm chức năng Quản lý Đội xe, Hồ sơ Tài xế, Lịch Phân ca & Tài khoản Nhân viên Vận hành
 *
 */

// ==========================================
// A. DISPATCHER FLEET & DRIVER OPERATIONS
// ==========================================

const getFleetTrucks = async (req, res) => {
  try {
    const formattedTrucks = await fleetService.getAllTrucks();
    return res.json({ trucks: formattedTrucks });
  } catch (err) {
    console.error('getFleetTrucks error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách xe', error: err.message });
  }
};

const createFleetTruck = async (req, res) => {
  try {
    const newTruck = await fleetService.createTruck(req.body);
    return res.status(201).json({ message: 'Thêm xe thành công', truck: newTruck });
  } catch (err) {
    console.error('createFleetTruck error:', err);
    const statusCode = err.message === 'Biển số xe là bắt buộc' ? 400: 500;
    return res.status(statusCode).json({ message: err.message || 'Không thể thêm phương tiện' });
  }
};

const updateFleetTruck = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await fleetService.updateTruck(id, req.body);
    return res.json({ message: 'Cập nhật thành công', truck: updated });
  } catch (err) {
    console.error('updateFleetTruck error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật phương tiện', error: err.message });
  }
};

const getFleetDrivers = async (req, res) => {
  try {
    const formattedDrivers = await fleetService.getAllDrivers();
    return res.json({ drivers: formattedDrivers });
  } catch (err) {
    console.error('getFleetDrivers error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách tài xế', error: err.message });
  }
};

const updateFleetDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await fleetService.updateDriver(id, req.body);
    return res.json({ message: 'Cập nhật thành công', driver: updated });
  } catch (err) {
    console.error('updateFleetDriver error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật tài xế', error: err.message });
  }
};

const getFleetVendors = async (req, res) => {
  try {
    const formattedVendors = await fleetService.getAllVendors();
    return res.json({ vendors: formattedVendors });
  } catch (err) {
    console.error('getFleetVendors error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách đối tác', error: err.message });
  }
};

// ==========================================
// B. MANAGER STAFF ACCOUNTS
// ==========================================

const getStaffAccounts = async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const accounts = await staffAccountService.getStaffAccounts({ search, role, status });
    return res.status(200).json({
      message: 'Lấy danh sách tài khoản nhân viên thành công',
      total: accounts.length,
      accounts
    });
  } catch (error) {
    console.error('getStaffAccounts Error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Lỗi khi lấy danh sách tài khoản nhân viên',
      error: error.message
    });
  }
};

const getStaffAccountDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await staffAccountService.getStaffAccountById(id);
    return res.status(200).json({
      message: 'Lấy thông tin tài khoản thành công',
      account
    });
  } catch (error) {
    console.error('getStaffAccountDetail Error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Lỗi khi lấy thông tin tài khoản',
      error: error.message
    });
  }
};

const createStaffAccount = async (req, res) => {
  try {
    const result = await staffAccountService.createStaffAccount(req.body);
    return res.status(201).json({
      message: `Tạo tài khoản ${result.username} thành công`,
      account: result
    });
  } catch (error) {
    console.error('createStaffAccount Error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Lỗi khi tạo tài khoản nhân viên',
      error: error.message
    });
  }
};

const updateStaffAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await staffAccountService.updateStaffAccount(id, req.body);
    return res.status(200).json({
      message: 'Cập nhật thông tin tài khoản thành công',
      account: result
    });
  } catch (error) {
    console.error('updateStaffAccount Error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Lỗi khi cập nhật tài khoản nhân viên',
      error: error.message
    });
  }
};

const updateAccountStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await staffAccountService.toggleStaffAccountStatus(id, status);
    return res.status(200).json(result);
  } catch (error) {
    console.error('updateAccountStatus Error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Lỗi khi thay đổi trạng thái tài khoản',
      error: error.message
    });
  }
};

// ==========================================
// C. MANAGER TRUCKS & DRIVER PROFILES
// ==========================================

const toDateObj = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).split('T')[0].trim();
  return new Date(`${s}T00:00:00.000Z`);
};

const getVehicles = async (req, res) => {
  try {
    const [trucksResult, driversResult] = await Promise.all([
      prisma.trucks.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          plate_number: true,
          model: true,
          allowed_payload: true,
          box_length: true,
          box_width: true,
          box_height: true,
          required_license_class: true,
          inspection_expiry: true,
          insurance_expiry: true,
          gps_device_id: true,
          status: true,
          created_at: true,
          updated_at: true
        },
        orderBy: { id: 'asc' }
      }),
      prisma.driver_profiles.findMany({
        select: {
          id: true,
          user_account_id: true,
          license_number: true,
          license_class: true,
          license_expiry: true,
          status: true,
          users: {
            select: { id: true, full_name: true, phone: true, username: true, email: true }
          }
        },
        orderBy: { id: 'asc' }
      })
    ]);

    const formattedTrucks = serializePrisma(trucksResult || []).map((t, idx) => {
      const rawT = trucksResult[idx];
      const isInspectionExpired = rawT.inspection_expiry ? new Date(rawT.inspection_expiry) < new Date() : false;
      return {
        id: toNum(t.id),
        plate_number: t.plate_number,
        model: t.model || 'Xe tải thùng kín',
        payload_kg: toNum(t.allowed_payload) || 5000,
        allowed_payload: toNum(t.allowed_payload) || 5000,
        box_length_cm: toNum(t.box_length) || 620,
        box_width_cm: toNum(t.box_width) || 210,
        box_height_cm: toNum(t.box_height) || 220,
        box_length: toNum(t.box_length) || 620,
        box_width: toNum(t.box_width) || 210,
        box_height: toNum(t.box_height) || 220,
        required_license_class: t.required_license_class || 'C',
        inspection_expiry: formatDateOnly(rawT.inspection_expiry),
        insurance_expiry: formatDateOnly(rawT.insurance_expiry),
        gps_device_id: t.gps_device_id,
        status: t.status,
        is_inspection_expired: isInspectionExpired
      };
    });

    const formattedDrivers = serializePrisma(driversResult || []).map((dp, idx) => {
      const rawDp = driversResult[idx];
      const isLicenseExpired = rawDp.license_expiry ? new Date(rawDp.license_expiry) < new Date() : false;
      const licExpStr = formatDateOnly(rawDp.license_expiry);
      return {
        id: toNum(dp.id),
        user_id: toNum(dp.user_account_id),
        user_account_id: toNum(dp.user_account_id),
        name: dp.users?.full_name || dp.users?.username || 'Tài xế',
        full_name: dp.users?.full_name || dp.users?.username || 'Tài xế',
        username: dp.users?.username || '',
        email: dp.users?.email || '',
        phone: dp.users?.phone || '',
        license: dp.license_class,
        license_class: dp.license_class,
        license_number: dp.license_number,
        expiry: licExpStr,
        license_expiry: licExpStr,
        status: dp.status,
        is_license_expired: isLicenseExpired
      };
    });

    return res.json({
      trucks: formattedTrucks,
      drivers: formattedDrivers
    });
  } catch (error) {
    console.error('Get Vehicles Error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đội xe', error: error.message });
  }
};

const createTruck = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      plate_number,
      model,
      allowed_payload,
      payload_kg,
      box_length,
      box_width,
      box_height,
      required_license_class,
      inspection_expiry,
      insurance_expiry,
      gps_device_id,
      status = 'AVAILABLE'
    } = body;

    if (typeof plate_number !== 'string' || !plate_number.trim()) {
      return res.status(400).json({ message: 'Biển số xe là bắt buộc.' });
    }
    const cleanPlate = plate_number.trim().toUpperCase();

    const finalStatus = validateTruckStatusValue(status);
    const rawPayload = allowed_payload !== undefined ? allowed_payload : payload_kg;
    const payloadNum = parsePositiveNumber(rawPayload, 'Tải trọng cho phép (allowed_payload)');
    const bLength = parsePositiveNumber(box_length, 'Chiều dài thùng xe (box_length)');
    const bWidth = parsePositiveNumber(box_width, 'Chiều rộng thùng xe (box_width)');
    const bHeight = parsePositiveNumber(box_height, 'Chiều cao thùng xe (box_height)');

    const licClass = required_license_class !== undefined
      ? validateLicenseClassValue(required_license_class)
      : 'C';

    const cleanInspectionExp = parseValidDateStr(inspection_expiry, 'Hạn đăng kiểm (inspection_expiry)');
    const cleanInsuranceExp = parseValidDateStr(insurance_expiry, 'Hạn bảo hiểm (insurance_expiry)');

    const existingPlate = await prisma.trucks.findFirst({
      where: { plate_number: cleanPlate },
      select: { id: true }
    });

    if (existingPlate) {
      return res.status(409).json({ message: `Biển số xe ${cleanPlate} đã tồn tại trong hệ thống.` });
    }

    if (finalStatus === 'AVAILABLE' && cleanInspectionExp < getTodayGMT7Str()) {
      return res.status(400).json({
        message: 'Lỗi: Xe đã hết hạn đăng kiểm không được đặt trạng thái Sẵn sàng (Available). Vui lòng chọn Bảo dưỡng hoặc Ngưng hoạt động.'
      });
    }

    const cleanModel = typeof model === 'string' && model.trim() ? model.trim() : 'Xe tải thùng kín';
    const cleanGps = typeof gps_device_id === 'string' && gps_device_id.trim() ? gps_device_id.trim() : null;

    const newTruck = await prisma.trucks.create({
      data: {
        plate_number: cleanPlate,
        model: cleanModel,
        allowed_payload: payloadNum,
        box_length: bLength,
        box_width: bWidth,
        box_height: bHeight,
        required_license_class: licClass,
        inspection_expiry: toDateObj(cleanInspectionExp),
        insurance_expiry: toDateObj(cleanInsuranceExp),
        gps_device_id: cleanGps,
        status: finalStatus
      }
    });

    const serialized = serializePrisma(newTruck);
    serialized.inspection_expiry = formatDateOnly(newTruck.inspection_expiry);
    serialized.insurance_expiry = formatDateOnly(newTruck.insurance_expiry);

    return res.status(201).json({
      message: `Đã lưu xe tải ${cleanPlate} thành công.`,
      truck: serialized
    });
  } catch (error) {
    console.error('Create Truck Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi thêm mới xe tải', error: error.message });
  }
};

const updateTruck = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    const body = req.body || {};
    const {
      plate_number,
      model,
      allowed_payload,
      payload_kg,
      box_length,
      box_width,
      box_height,
      required_license_class,
      inspection_expiry,
      insurance_expiry,
      gps_device_id,
      status
    } = body;

    if (bigId === null) {
      return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
    }

    const currentTruck = await prisma.trucks.findUnique({
      where: { id: bigId },
      select: { id: true, status: true, inspection_expiry: true }
    });
    if (!currentTruck) {
      return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
    }

    const updateData = { updated_at: new Date() };

    if (plate_number !== undefined) {
      if (typeof plate_number !== 'string' || !plate_number.trim()) {
        return res.status(400).json({ message: 'Biển số xe không được để trống.' });
      }
      const cleanPlate = plate_number.trim().toUpperCase();
      const dup = await prisma.trucks.findFirst({
        where: { plate_number: cleanPlate, id: { not: bigId } },
        select: { id: true }
      });

      if (dup) {
        return res.status(409).json({ message: `Biển số xe ${cleanPlate} đã bị trùng lặp.` });
      }
      updateData.plate_number = cleanPlate;
    }

    if (model !== undefined) {
      if (typeof model !== 'string' || !model.trim()) {
        return res.status(400).json({ message: 'Model / dòng xe không hợp lệ.' });
      }
      updateData.model = model.trim();
    }

    if (allowed_payload !== undefined || payload_kg !== undefined) {
      const rawPayload = allowed_payload !== undefined ? allowed_payload : payload_kg;
      updateData.allowed_payload = parsePositiveNumber(rawPayload, 'Tải trọng cho phép (allowed_payload)');
    }
    if (box_length !== undefined) updateData.box_length = parsePositiveNumber(box_length, 'Chiều dài thùng xe (box_length)');
    if (box_width !== undefined) updateData.box_width = parsePositiveNumber(box_width, 'Chiều rộng thùng xe (box_width)');
    if (box_height !== undefined) updateData.box_height = parsePositiveNumber(box_height, 'Chiều cao thùng xe (box_height)');

    if (required_license_class !== undefined) {
      updateData.required_license_class = validateLicenseClassValue(required_license_class);
    }

    if (gps_device_id !== undefined) {
      updateData.gps_device_id = typeof gps_device_id === 'string' && gps_device_id.trim()
        ? gps_device_id.trim()
        : null;
    }

    if (inspection_expiry !== undefined) {
      updateData.inspection_expiry = toDateObj(parseValidDateStr(inspection_expiry, 'Hạn đăng kiểm (inspection_expiry)'));
    }
    if (insurance_expiry !== undefined) {
      updateData.insurance_expiry = toDateObj(parseValidDateStr(insurance_expiry, 'Hạn bảo hiểm (insurance_expiry)'));
    }

    if (status !== undefined) {
      updateData.status = validateTruckStatusValue(status);
    }

    const effectiveStatus = updateData.status || String(currentTruck.status || '').toUpperCase();
    const effectiveInspection = updateData.inspection_expiry !== undefined
      ? updateData.inspection_expiry
      : currentTruck.inspection_expiry;

    if (effectiveStatus === 'AVAILABLE' && effectiveInspection) {
      if (formatDateOnly(effectiveInspection) < getTodayGMT7Str()) {
        return res.status(400).json({
          message: 'Lỗi: Không thể chuyển trạng thái sang Sẵn sàng (Available) do xe đã hết hạn đăng kiểm.'
        });
      }
    }

    const updated = await prisma.trucks.update({
      where: { id: bigId },
      data: updateData
    });

    const serialized = serializePrisma(updated);
    serialized.inspection_expiry = formatDateOnly(updated.inspection_expiry);
    serialized.insurance_expiry = formatDateOnly(updated.insurance_expiry);

    return res.json({
      message: 'Cập nhật thông tin xe tải thành công.',
      truck: serialized
    });
  } catch (error) {
    console.error('Update Truck Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi cập nhật xe tải', error: error.message });
  }
};

const updateTruckStatus = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    const { status } = req.body;

    if (status && status.toUpperCase() === 'ON_TRIP') {
      return res.status(400).json({ message: 'Không thể chuyển xe sang trạng thái Đang chạy thủ công. Trạng thái này do hệ thống tự động gán khi điều phối chuyến xe.' });
    }

    if (!status || !['AVAILABLE', 'MAINTENANCE', 'INACTIVE'].includes(status.toUpperCase())) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: AVAILABLE, MAINTENANCE, INACTIVE.' });
    }

    const targetStatus = status.toUpperCase();

    if (targetStatus === 'AVAILABLE') {
      const truck = await prisma.trucks.findUnique({
        where: { id: bigId },
        select: { inspection_expiry: true, plate_number: true }
      });

      if (!truck) {
        return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
      }

      if (truck.inspection_expiry && new Date(truck.inspection_expiry) < new Date()) {
        return res.status(400).json({
          message: `Lỗi: Không thể bật xe ${truck.plate_number} sang Sẵn sàng (Available) do xe đã hết hạn đăng kiểm.`
        });
      }
    }

    const updated = await prisma.trucks.update({
      where: { id: bigId },
      data: {
        status: targetStatus,
        updated_at: new Date()
      }
    });

    return res.json({
      message: `Đã đổi trạng thái xe thành ${targetStatus}.`,
      truck: serializePrisma(updated)
    });
  } catch (error) {
    console.error('Update Truck Status Error:', error);
    return res.status(500).json({ message: 'Lỗi khi đổi trạng thái xe', error: error.message });
  }
};

const deleteTruck = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    await prisma.trucks.update({
      where: { id: bigId },
      data: { status: 'INACTIVE', updated_at: new Date() }
    });

    return res.json({ message: 'Đã chuyển xe sang trạng thái Ngưng hoạt động (Inactive).' });
  } catch (error) {
    console.error('Delete Truck Error:', error);
    return res.status(500).json({ message: 'Lỗi khi ngưng hoạt động xe', error: error.message });
  }
};

const createDriver = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      full_name,
      email,
      phone,
      license_number,
      license_class,
      license_expiry,
      expiry,
      password
    } = body;

    const rawName = full_name !== undefined ? full_name : name;
    if (typeof rawName !== 'string' || !rawName.trim()) {
      return res.status(400).json({ message: 'Họ và tên tài xế là bắt buộc.' });
    }
    const driverName = rawName.trim();

    if (typeof phone !== 'string' || !phone.trim() || !PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({ message: 'Số điện thoại là bắt buộc và phải đúng định dạng.' });
    }
    const cleanPhone = phone.trim();

    let cleanEmailInput = null;
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ message: 'Định dạng email không hợp lệ.' });
      }
      cleanEmailInput = email.trim().toLowerCase();
    }

    if (typeof license_number !== 'string' || !license_number.trim()) {
      return res.status(400).json({ message: 'Số giấy phép lái xe (license_number) là bắt buộc.' });
    }
    const licNum = license_number.trim();

    const licClass = license_class !== undefined
      ? validateLicenseClassValue(license_class)
      : 'C';

    const rawExpiry = license_expiry !== undefined ? license_expiry : expiry;
    const licExpiry = parseValidDateStr(rawExpiry, 'Ngày hết hạn GPLX', { mustBeFutureOrToday: true });

    // Kiểm tra trùng số GPLX trước khi thao tác bảng users (BUG-MGR-03)
    const dupLicense = await prisma.driver_profiles.findFirst({
      where: { license_number: licNum },
      select: { id: true }
    });
    if (dupLicense) {
      return res.status(409).json({ message: `Số GPLX ${licNum} đã tồn tại trong hệ thống.` });
    }

    const userSelect = { id: true, full_name: true, phone: true, username: true, email: true, role_id: true };

    let existingUser = await prisma.users.findFirst({
      where: { phone: cleanPhone },
      select: userSelect
    });
    if (!existingUser && cleanEmailInput) {
      existingUser = await prisma.users.findUnique({
        where: { email: cleanEmailInput },
        select: userSelect
      });
    }

    let userId = null;
    let finalUsername = '';
    let finalEmail = '';
    let finalFullName = driverName;
    let finalPhone = cleanPhone;
    let profileResult = null;

    if (existingUser) {
      // BUG-MGR-01: Tuyệt đối không tự ý chuyển vai trò tài khoản khác thành Driver (BR-28)
      if (Number(existingUser.role_id) !== 4) {
        return res.status(409).json({ message: 'Tài khoản không phải Driver' });
      }

      // BUG-MGR-03: Không cho phép đăng ký lại tài xế đã có hồ sơ
      const existingProfile = await prisma.driver_profiles.findUnique({
        where: { user_account_id: existingUser.id },
        select: { id: true }
      });
      if (existingProfile) {
        return res.status(409).json({ message: 'Tài xế này đã có hồ sơ trong hệ thống.' });
      }

      userId = existingUser.id;
      finalUsername = existingUser.username;
      finalEmail = existingUser.email;
      finalFullName = existingUser.full_name || driverName;
      finalPhone = existingUser.phone || cleanPhone;

      profileResult = await prisma.driver_profiles.create({
        data: {
          user_account_id: userId,
          license_number: licNum,
          license_class: licClass,
          license_expiry: toDateObj(licExpiry),
          status: 'ACTIVE'
        }
      });
    } else {
      const phoneDigits = cleanPhone.replace(/\D/g, '').slice(-4) || Math.floor(Math.random() * 1000);
      let candidateUsername = `driver_${phoneDigits}_${Math.floor(10 + Math.random() * 90)}`;
      const dupUser = await prisma.users.findUnique({
        where: { username: candidateUsername },
        select: { id: true }
      });
      if (dupUser) {
        candidateUsername = `driver_${phoneDigits}_${Date.now().toString().slice(-4)}`;
      }
      finalUsername = candidateUsername;

      finalEmail = cleanEmailInput || `${finalUsername}@nexlog.vn`;
      const dupEmail = await prisma.users.findUnique({
        where: { email: finalEmail },
        select: { id: true }
      });
      if (dupEmail) {
        if (cleanEmailInput) {
          return res.status(409).json({ message: 'Email đã tồn tại trong hệ thống.' });
        }
        finalEmail = `driver_${phoneDigits}_${Date.now()}@nexlog.vn`;
      }

      // Chính sách mật khẩu & không dùng mật khẩu hard-code (BUG-MGR-06)
      let rawPassword;
      if (password !== undefined && password !== null && password !== '') {
        if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
          return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte.' });
        }
        rawPassword = password;
      } else {
        rawPassword = crypto.randomBytes(12).toString('base64url');
      }
      const password_hash = await bcrypt.hash(rawPassword, 10);

      // BUG-MGR-01: user + hồ sơ tài xế tạo trong CÙNG MỘT transaction (lỗi thì rollback, không để lại user mồ côi)
      const txResult = await prisma.$transaction(async (tx) => {
        const newUser = await tx.users.create({
          data: {
            username: finalUsername,
            password_hash,
            full_name: driverName,
            email: finalEmail,
            phone: cleanPhone,
            role_id: 4n,
            status: 'ACTIVE'
          },
          select: { id: true }
        });
        const profile = await tx.driver_profiles.create({
          data: {
            user_account_id: newUser.id,
            license_number: licNum,
            license_class: licClass,
            license_expiry: toDateObj(licExpiry),
            status: 'ACTIVE'
          }
        });
        return { userId: newUser.id, profile };
      });
      userId = txResult.userId;
      profileResult = txResult.profile;
    }

    return res.status(201).json({
      message: 'Thêm tài xế mới thành công.',
      driver: {
        id: toNum(profileResult.id),
        user_account_id: toNum(userId),
        name: finalFullName,
        phone: finalPhone,
        username: finalUsername,
        email: finalEmail,
        license: profileResult.license_class,
        license_class: profileResult.license_class,
        license_number: profileResult.license_number,
        expiry: formatDateOnly(profileResult.license_expiry),
        license_expiry: formatDateOnly(profileResult.license_expiry),
        status: profileResult.status
      }
    });
  } catch (error) {
    console.error('Create Driver Error:', error);
    if (error && error.code === 'P2002') {
      return res.status(409).json({ message: 'Thông tin bị trùng (số GPLX, email hoặc SĐT đã tồn tại).' });
    }
    return res.status(error.statusCode || 500).json({ message: error.message || 'Không thể thêm tài xế', error: error.message });
  }
};

const updateDriverProfile = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    const body = req.body || {};
    const { license_number, license_class, license_expiry, expiry, status } = body;

    const existingProfile = bigId === null ? null : await prisma.driver_profiles.findUnique({
      where: { id: bigId },
      select: { id: true }
    });
    if (!existingProfile) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ tài xế.' });
    }

    const profileUpdates = { updated_at: new Date() };

    if (license_number !== undefined) {
      if (typeof license_number !== 'string' || !license_number.trim()) {
        return res.status(400).json({ message: 'Số GPLX không được để trống.' });
      }
      const cleanLicNum = license_number.trim();
      const dupLic = await prisma.driver_profiles.findFirst({
        where: { license_number: cleanLicNum, id: { not: bigId } },
        select: { id: true }
      });
      if (dupLic) {
        return res.status(409).json({ message: `Số GPLX ${cleanLicNum} đã tồn tại trong hệ thống.` });
      }
      profileUpdates.license_number = cleanLicNum;
    }

    if (license_class !== undefined) {
      profileUpdates.license_class = validateLicenseClassValue(license_class);
    }

    // BUG-MGR-02: Chấp nhận cả license_expiry lẫn expiry
    const rawExpiry = license_expiry !== undefined ? license_expiry : expiry;
    if (rawExpiry !== undefined) {
      profileUpdates.license_expiry = toDateObj(
        parseValidDateStr(rawExpiry, 'Ngày hết hạn GPLX', { mustBeFutureOrToday: true })
      );
    }

    if (status !== undefined) {
      if (typeof status !== 'string' || !status.trim()) {
        return res.status(400).json({ message: 'Trạng thái hồ sơ tài xế không hợp lệ.' });
      }
      const normStatus = status.trim().toUpperCase();
      if (!VALID_DRIVER_PROFILE_STATUSES.includes(normStatus)) {
        return res.status(400).json({ message: 'Trạng thái hồ sơ tài xế không hợp lệ.' });
      }
      profileUpdates.status = normStatus;
    }

    // BUG-MGR-03: Không cập nhật full_name / phone / email vào bảng users từ hồ sơ tài xế (SRS: chỉ đọc)
    const updatedProfile = await prisma.driver_profiles.update({
      where: { id: bigId },
      data: profileUpdates
    });

    const serialized = serializePrisma(updatedProfile);
    serialized.license_expiry = formatDateOnly(updatedProfile.license_expiry);

    return res.json({
      message: 'Cập nhật hồ sơ tài xế thành công.',
      profile: serialized
    });
  } catch (error) {
    console.error('Update Driver Profile Error:', error);
    if (error && error.code === 'P2002') {
      return res.status(409).json({ message: 'Số GPLX đã tồn tại trong hệ thống.' });
    }
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi cập nhật hồ sơ tài xế', error: error.message });
  }
};

// ==========================================
// D. MANAGER DRIVER SHIFTS
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
    console.error('getShifts Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách ca làm việc', error: error.message });
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
    console.error('createShift Error:', error);
    return res.status(400).json({ message: error.message || 'Lỗi khi tạo ca làm việc' });
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
    console.error('updateShift Error:', error);
    return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật ca làm việc' });
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
    console.error('approveShift Error:', error);
    return res.status(500).json({ message: error.message || 'Lỗi khi duyệt ca làm việc' });
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
    console.error('rejectShift Error:', error);
    return res.status(500).json({ message: error.message || 'Lỗi khi từ chối ca làm việc' });
  }
};

const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    await fleetService.deleteShift(id);
    return res.json({ message: 'Đã xóa ca làm việc thành công.' });
  } catch (error) {
    console.error('deleteShift Error:', error);
    return res.status(500).json({ message: error.message || 'Lỗi khi xóa ca làm việc' });
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
  // Dispatcher Fleet & Drivers
  getTruckModelName: fleetService.getTruckModelName,
  getTruckCategory: fleetService.getTruckCategory,
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors,

  // Manager Staff Accounts
  getStaffAccounts,
  getStaffAccountDetail,
  createStaffAccount,
  updateStaffAccount,
  updateAccountStatus,

  // Manager Trucks & Driver Profiles
  getVehicles,
  createTruck,
  updateTruck,
  updateTruckStatus,
  deleteTruck,
  createDriver,
  updateDriverProfile,

  // Manager Driver Shifts
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
