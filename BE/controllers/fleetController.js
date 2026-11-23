const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const fleetService = require('../services/fleetService');
const staffAccountService = require('../services/staffAccountService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../utils/prismaHelper');

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
    } = req.body;

    if (!plate_number || !plate_number.trim()) {
      return res.status(400).json({ message: 'Biển số xe là bắt buộc.' });
    }

    const cleanPlate = plate_number.trim().toUpperCase();

    const existingPlate = await prisma.trucks.findFirst({
      where: { plate_number: cleanPlate },
      select: { id: true }
    });

    if (existingPlate) {
      return res.status(409).json({ message: `Biển số xe ${cleanPlate} đã tồn tại trong hệ thống.` });
    }

    const finalStatus = status;
    if (inspection_expiry && new Date(inspection_expiry) < new Date()) {
      if (finalStatus === 'AVAILABLE') {
        return res.status(400).json({
          message: 'Lỗi: Xe đã hết hạn đăng kiểm không được đặt trạng thái Sẵn sàng (Available). Vui lòng chọn Bảo dưỡng hoặc Ngưng hoạt động.'
        });
      }
    }

    const payloadNum = Number(allowed_payload || payload_kg || 5000);
    const bLength = Number(box_length || 620);
    const bWidth = Number(box_width || 210);
    const bHeight = Number(box_height || 220);
    const defaultExp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const newTruck = await prisma.trucks.create({
      data: {
        plate_number: cleanPlate,
        model: model || 'Xe tải thùng kín',
        allowed_payload: payloadNum,
        box_length: bLength,
        box_width: bWidth,
        box_height: bHeight,
        required_license_class: required_license_class || 'C',
        inspection_expiry: toDateObj(inspection_expiry) || defaultExp,
        insurance_expiry: toDateObj(insurance_expiry) || defaultExp,
        gps_device_id: gps_device_id || null,
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
    return res.status(500).json({ message: 'Lỗi khi thêm mới xe tải', error: error.message });
  }
};

const updateTruck = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
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
    } = req.body;

    const updateData = { updated_at: new Date() };

    if (plate_number) {
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

    if (model !== undefined) updateData.model = model;
    if (allowed_payload !== undefined || payload_kg !== undefined) {
      updateData.allowed_payload = Number(allowed_payload || payload_kg);
    }
    if (box_length !== undefined) updateData.box_length = Number(box_length);
    if (box_width !== undefined) updateData.box_width = Number(box_width);
    if (box_height !== undefined) updateData.box_height = Number(box_height);
    if (required_license_class !== undefined) updateData.required_license_class = required_license_class;
    if (gps_device_id !== undefined) updateData.gps_device_id = gps_device_id;

    if (inspection_expiry !== undefined && inspection_expiry) {
      updateData.inspection_expiry = toDateObj(inspection_expiry);
    }
    if (insurance_expiry !== undefined && insurance_expiry) {
      updateData.insurance_expiry = toDateObj(insurance_expiry);
    }

    const targetInspection = updateData.inspection_expiry || null;

    if (status !== undefined) {
      if (status === 'AVAILABLE') {
        let exp = targetInspection;
        if (!exp) {
          const cur = await prisma.trucks.findUnique({
            where: { id: bigId },
            select: { inspection_expiry: true }
          });
          exp = cur?.inspection_expiry;
        }
        if (exp && new Date(exp) < new Date()) {
          return res.status(400).json({
            message: 'Lỗi: Không thể chuyển trạng thái sang Sẵn sàng (Available) do xe đã hết hạn đăng kiểm.'
          });
        }
      }
      updateData.status = status;
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
    return res.status(500).json({ message: 'Lỗi khi cập nhật xe tải', error: error.message });
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
    const { name, full_name, email, phone, license_number, license_class, expiry, password } = req.body;
    const driverName = (full_name || name || '').trim();
    const cleanPhone = (phone || '').trim();

    if (!driverName || !cleanPhone) {
      return res.status(400).json({ message: 'Họ tên và số điện thoại là bắt buộc.' });
    }

    let userId = null;
    let finalUsername = '';
    let finalEmail = '';
    let finalFullName = driverName;
    let finalPhone = cleanPhone;

    const userByPhone = await prisma.users.findFirst({
      where: { phone: cleanPhone },
      select: { id: true, full_name: true, phone: true, username: true, email: true, role_id: true }
    });

    let existingUser = userByPhone;
    if (!existingUser && email && email.trim()) {
      existingUser = await prisma.users.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, full_name: true, phone: true, username: true, email: true, role_id: true }
      });
    }

    if (existingUser) {
      userId = existingUser.id;
      finalUsername = existingUser.username;
      finalEmail = existingUser.email;
      finalFullName = existingUser.full_name || driverName;
      finalPhone = existingUser.phone || cleanPhone;

      if (Number(existingUser.role_id) !== 4) {
        await prisma.users.update({
          where: { id: userId },
          data: { role_id: 4n }
        });
      }
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

      if (email && email.trim()) {
        finalEmail = email.trim().toLowerCase();
      } else {
        finalEmail = `${finalUsername}@nexlog.vn`;
      }
      const dupEmail = await prisma.users.findUnique({
        where: { email: finalEmail },
        select: { id: true }
      });
      if (dupEmail) {
        finalEmail = `driver_${phoneDigits}_${Date.now()}@nexlog.vn`;
      }

      const rawPassword = password || 'Nexlog@2026';
      if (typeof rawPassword !== 'string' || Buffer.byteLength(rawPassword, 'utf8') > 72) {
        return res.status(400).json({ message: 'Mật khẩu không được vượt quá 72 byte.' });
      }
      const password_hash = await bcrypt.hash(rawPassword, 10);

      const newUser = await prisma.users.create({
        data: {
          username: finalUsername,
          password_hash,
          full_name: driverName,
          email: finalEmail,
          phone: cleanPhone,
          role_id: 4n,
          status: 'ACTIVE'
        },
        select: { id: true, full_name: true, phone: true, username: true, email: true }
      });
      userId = newUser.id;
    }

    const existingProfile = await prisma.driver_profiles.findUnique({
      where: { user_account_id: userId },
      select: { id: true }
    });

    const licNum = (license_number || '').trim() || `GPLX-${cleanPhone.slice(-6)}`;
    const licClass = license_class || 'C';
    const licExpiryStr = expiry
      ? new Date(expiry).toISOString().split('T')[0]
      : new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const licExpiryDate = toDateObj(licExpiryStr);

    let profileResult = null;
    if (existingProfile) {
      profileResult = await prisma.driver_profiles.update({
        where: { id: existingProfile.id },
        data: {
          license_number: licNum,
          license_class: licClass,
          license_expiry: licExpiryDate,
          status: 'ACTIVE',
          updated_at: new Date()
        }
      });
    } else {
      profileResult = await prisma.driver_profiles.create({
        data: {
          user_account_id: userId,
          license_number: licNum,
          license_class: licClass,
          license_expiry: licExpiryDate,
          status: 'ACTIVE'
        }
      });
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
        status: profileResult.status
      }
    });
  } catch (error) {
    console.error('Create Driver Error:', error);
    return res.status(500).json({ message: 'Không thể thêm tài xế', error: error.message });
  }
};

const updateDriverProfile = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    const { license_number, license_class, license_expiry, status, full_name, phone, email } = req.body;

    const profileUpdates = { updated_at: new Date() };
    if (license_number !== undefined) profileUpdates.license_number = license_number;
    if (license_class !== undefined) profileUpdates.license_class = license_class;
    if (license_expiry !== undefined && license_expiry) {
      profileUpdates.license_expiry = toDateObj(license_expiry);
    }
    if (status !== undefined) profileUpdates.status = status;

    const updatedProfile = await prisma.driver_profiles.update({
      where: { id: bigId },
      data: profileUpdates
    });

    if ((full_name || phone || email) && updatedProfile.user_account_id) {
      const userUpdates = { updated_at: new Date() };
      if (full_name) userUpdates.full_name = full_name;
      if (phone) userUpdates.phone = phone;
      if (email) userUpdates.email = email;

      await prisma.users.update({
        where: { id: updatedProfile.user_account_id },
        data: userUpdates
      });
    }

    const serialized = serializePrisma(updatedProfile);
    serialized.license_expiry = formatDateOnly(updatedProfile.license_expiry);

    return res.json({
      message: 'Cập nhật hồ sơ tài xế thành công.',
      profile: serialized
    });
  } catch (error) {
    console.error('Update Driver Profile Error:', error);
    return res.status(500).json({ message: 'Lỗi khi cập nhật hồ sơ tài xế', error: error.message });
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
