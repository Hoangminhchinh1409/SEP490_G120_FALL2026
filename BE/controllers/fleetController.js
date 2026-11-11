const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');
const fleetService = require('../services/fleetService');
const staffAccountService = require('../services/staffAccountService');

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

const getVehicles = async (req, res) => {
  try {
    const [
      { data: trucksResult, error: trucksErr },
      { data: driversResult, error: driversErr }
    ] = await Promise.all([
      supabase
        .from('trucks')
        .select(`
          id, 
          plate_number, 
          model,
          allowed_payload,
          box_length, 
          box_width, 
          box_height,
          required_license_class,
          inspection_expiry,
          insurance_expiry,
          gps_device_id,
          status,
          created_at,
          updated_at
        `)
        .order('id', { ascending: true }),
      supabase
        .from('driver_profiles')
        .select(`
          id, 
          user_account_id, 
          license_number,
          license_class, 
          license_expiry, 
          status,
          user:users!driver_profiles_user_account_id_fkey(id, full_name, phone, username, email)
        `)
        .order('id', { ascending: true })
    ]);

    if (trucksErr) throw trucksErr;
    if (driversErr) throw driversErr;

    const formattedTrucks = (trucksResult || []).map((t) => {
      const isInspectionExpired = t.inspection_expiry ? new Date(t.inspection_expiry) < new Date(): false;
      return {
        id: t.id,
        plate_number: t.plate_number,
        model: t.model || 'Xe tải thùng kín',
        payload_kg: t.allowed_payload || 5000,
        allowed_payload: t.allowed_payload || 5000,
        box_length_cm: t.box_length || 620,
        box_width_cm: t.box_width || 210,
        box_height_cm: t.box_height || 220,
        box_length: t.box_length || 620,
        box_width: t.box_width || 210,
        box_height: t.box_height || 220,
        required_license_class: t.required_license_class || 'C',
        inspection_expiry: t.inspection_expiry,
        insurance_expiry: t.insurance_expiry,
        gps_device_id: t.gps_device_id,
        status: t.status,
        is_inspection_expired: isInspectionExpired
      };
    });

    const formattedDrivers = (driversResult || []).map((dp) => {
      const isLicenseExpired = dp.license_expiry ? new Date(dp.license_expiry) < new Date(): false;
      return {
        id: dp.id,
        user_id: dp.user_account_id,
        user_account_id: dp.user_account_id,
        name: dp.user?.full_name || dp.user?.username || 'Tài xế',
        full_name: dp.user?.full_name || dp.user?.username || 'Tài xế',
        username: dp.user?.username || '',
        email: dp.user?.email || '',
        phone: dp.user?.phone || '',
        license: dp.license_class,
        license_class: dp.license_class,
        license_number: dp.license_number,
        expiry: dp.license_expiry,
        license_expiry: dp.license_expiry,
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

    const { data: existingPlate } = await supabase
      .from('trucks')
      .select('id')
      .eq('plate_number', cleanPlate)
      .maybeSingle();

    if (existingPlate) {
      return res.status(409).json({ message: `Biển số xe ${cleanPlate} đã tồn tại trong hệ thống.` });
    }

    let finalStatus = status;
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

    const { data: newTruck, error } = await supabase
      .from('trucks')
      .insert({
        plate_number: cleanPlate,
        model: model || 'Xe tải thùng kín',
        allowed_payload: payloadNum,
        box_length: bLength,
        box_width: bWidth,
        box_height: bHeight,
        required_license_class: required_license_class || 'C',
        inspection_expiry: inspection_expiry ? new Date(inspection_expiry).toISOString(): null,
        insurance_expiry: insurance_expiry ? new Date(insurance_expiry).toISOString(): null,
        gps_device_id: gps_device_id || null,
        status: finalStatus
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: `Đã lưu xe tải ${cleanPlate} thành công.`,
      truck: newTruck
    });
  } catch (error) {
    console.error('Create Truck Error:', error);
    return res.status(500).json({ message: 'Lỗi khi thêm mới xe tải', error: error.message });
  }
};

const updateTruck = async (req, res) => {
  try {
    const { id } = req.params;
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

    const updateData = { updated_at: new Date().toISOString() };

    if (plate_number) {
      const cleanPlate = plate_number.trim().toUpperCase();
      const { data: dup } = await supabase
        .from('trucks')
        .select('id')
        .eq('plate_number', cleanPlate)
        .neq('id', id)
        .maybeSingle();

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

    if (inspection_expiry !== undefined) {
      updateData.inspection_expiry = inspection_expiry ? new Date(inspection_expiry).toISOString(): null;
    }
    if (insurance_expiry !== undefined) {
      updateData.insurance_expiry = insurance_expiry ? new Date(insurance_expiry).toISOString(): null;
    }

    const targetInspection = updateData.inspection_expiry !== undefined
      ? updateData.inspection_expiry
      : null;

    if (status !== undefined) {
      if (status === 'AVAILABLE') {
        let exp = targetInspection;
        if (exp === null) {
          const { data: cur } = await supabase.from('trucks').select('inspection_expiry').eq('id', id).single();
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

    const { data: updated, error } = await supabase
      .from('trucks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      message: 'Cập nhật thông tin xe tải thành công.',
      truck: updated
    });
  } catch (error) {
    console.error('Update Truck Error:', error);
    return res.status(500).json({ message: 'Lỗi khi cập nhật xe tải', error: error.message });
  }
};

const updateTruckStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status && status.toUpperCase() === 'ON_TRIP') {
      return res.status(400).json({ message: 'Không thể chuyển xe sang trạng thái Đang chạy thủ công. Trạng thái này do hệ thống tự động gán khi điều phối chuyến xe.' });
    }

    if (!status || !['AVAILABLE', 'MAINTENANCE', 'INACTIVE'].includes(status.toUpperCase())) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: AVAILABLE, MAINTENANCE, INACTIVE.' });
    }

    const targetStatus = status.toUpperCase();

    if (targetStatus === 'AVAILABLE') {
      const { data: truck, error: tErr } = await supabase
        .from('trucks')
        .select('inspection_expiry, plate_number')
        .eq('id', id)
        .single();

      if (tErr || !truck) {
        return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
      }

      if (truck.inspection_expiry && new Date(truck.inspection_expiry) < new Date()) {
        return res.status(400).json({
          message: `Lỗi: Không thể bật xe ${truck.plate_number} sang Sẵn sàng (Available) do xe đã hết hạn đăng kiểm.`
        });
      }
    }

    const { data: updated, error } = await supabase
      .from('trucks')
      .update({
        status: targetStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      message: `Đã đổi trạng thái xe thành ${targetStatus}.`,
      truck: updated
    });
  } catch (error) {
    console.error('Update Truck Status Error:', error);
    return res.status(500).json({ message: 'Lỗi khi đổi trạng thái xe', error: error.message });
  }
};

const deleteTruck = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('trucks')
      .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
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

    // 1. Kiểm tra xem đã có user nào theo SĐT hoặc Email chưa
    let userId = null;
    let finalUsername = '';
    let finalEmail = '';
    let finalFullName = driverName;
    let finalPhone = cleanPhone;

    const { data: userByPhone } = await supabase
      .from('users')
      .select('id, full_name, phone, username, email, role_id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    let existingUser = userByPhone;
    if (!existingUser && email && email.trim()) {
      const { data: userByEmail } = await supabase
        .from('users')
        .select('id, full_name, phone, username, email, role_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      if (userByEmail) existingUser = userByEmail;
    }

    if (existingUser) {
      userId = existingUser.id;
      finalUsername = existingUser.username;
      finalEmail = existingUser.email;
      finalFullName = existingUser.full_name || driverName;
      finalPhone = existingUser.phone || cleanPhone;

      // Cập nhật vai trò thành Driver (4) nếu chưa phải
      if (existingUser.role_id !== 4) {
        await supabase.from('users').update({ role_id: 4 }).eq('id', userId);
      }
    } else {
      // Tạo Username duy nhất
      const phoneDigits = cleanPhone.replace(/\D/g, '').slice(-4) || Math.floor(Math.random() * 1000);
      let candidateUsername = `driver_${phoneDigits}_${Math.floor(10 + Math.random() * 90)}`;
      const { data: dupUser } = await supabase.from('users').select('id').eq('username', candidateUsername).maybeSingle();
      if (dupUser) {
        candidateUsername = `driver_${phoneDigits}_${Date.now().toString().slice(-4)}`;
      }
      finalUsername = candidateUsername;

      // Tạo Email hợp lệ không được null và không được trùng
      if (email && email.trim()) {
        finalEmail = email.trim().toLowerCase();
      } else {
        finalEmail = `${finalUsername}@nexlog.vn`;
      }
      const { data: dupEmail } = await supabase.from('users').select('id').eq('email', finalEmail).maybeSingle();
      if (dupEmail) {
        finalEmail = `driver_${phoneDigits}_${Date.now()}@nexlog.vn`;
      }

      // Băm mật khẩu mặc định (bắt buộc vì password_hash NOT NULL)
      const rawPassword = password || 'Nexlog@2026';
      if (typeof rawPassword !== 'string' || Buffer.byteLength(rawPassword, 'utf8') > 72) {
        return res.status(400).json({ message: 'Mật khẩu không được vượt quá 72 byte.' });
      }
      const password_hash = await bcrypt.hash(rawPassword, 10);

      const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({
          username: finalUsername,
          password_hash,
          full_name: driverName,
          email: finalEmail,
          phone: cleanPhone,
          role_id: 4,
          status: 'ACTIVE'
        })
        .select('id, full_name, phone, username, email')
        .single();

      if (userErr) throw userErr;
      userId = newUser.id;
    }

    // 2. Kiểm tra và thêm / cập nhật hồ sơ driver_profiles
    const { data: existingProfile } = await supabase
      .from('driver_profiles')
      .select('id')
      .eq('user_account_id', userId)
      .maybeSingle();

    const licNum = (license_number || '').trim() || `GPLX-${cleanPhone.slice(-6)}`;
    const licClass = license_class || 'C';
    // license_expiry is NOT NULL in database: use provided date or default to 5 years in future
    const licExpiry = expiry 
      ? new Date(expiry).toISOString().split('T')[0] 
      : new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let profileResult = null;
    if (existingProfile) {
      const { data: updatedProfile, error: updateProfileErr } = await supabase
        .from('driver_profiles')
        .update({
          license_number: licNum,
          license_class: licClass,
          license_expiry: licExpiry,
          status: 'ACTIVE',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProfile.id)
        .select('*')
        .single();

      if (updateProfileErr) throw updateProfileErr;
      profileResult = updatedProfile;
    } else {
      const { data: newProfile, error: profileErr } = await supabase
        .from('driver_profiles')
        .insert({
          user_account_id: userId,
          license_number: licNum,
          license_class: licClass,
          license_expiry: licExpiry,
          status: 'ACTIVE'
        })
        .select('*')
        .single();

      if (profileErr) throw profileErr;
      profileResult = newProfile;
    }

    return res.status(201).json({
      message: 'Thêm tài xế mới thành công.',
      driver: {
        id: profileResult.id,
        user_account_id: userId,
        name: finalFullName,
        phone: finalPhone,
        username: finalUsername,
        email: finalEmail,
        license: profileResult.license_class,
        license_class: profileResult.license_class,
        license_number: profileResult.license_number,
        expiry: profileResult.license_expiry,
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
    const { id } = req.params;
    const { license_number, license_class, license_expiry, status, full_name, phone, email } = req.body;

    const profileUpdates = { updated_at: new Date().toISOString() };
    if (license_number !== undefined) profileUpdates.license_number = license_number;
    if (license_class !== undefined) profileUpdates.license_class = license_class;
    if (license_expiry !== undefined) {
      profileUpdates.license_expiry = license_expiry ? new Date(license_expiry).toISOString(): null;
    }
    if (status !== undefined) profileUpdates.status = status;

    const { data: updatedProfile, error: pErr } = await supabase
      .from('driver_profiles')
      .update(profileUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (pErr) throw pErr;

    if ((full_name || phone || email) && updatedProfile.user_account_id) {
      const userUpdates = { updated_at: new Date().toISOString() };
      if (full_name) userUpdates.full_name = full_name;
      if (phone) userUpdates.phone = phone;
      if (email) userUpdates.email = email;

      await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', updatedProfile.user_account_id);
    }

    return res.json({
      message: 'Cập nhật hồ sơ tài xế thành công.',
      profile: updatedProfile
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
  deleteShift
};
