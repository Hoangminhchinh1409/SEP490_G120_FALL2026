const supabase = require('../config/supabase');
const fleetService = require('../services/fleetService');
const staffAccountService = require('../services/staffAccountService');

/**
 * Fleet Controller — Nhóm chức năng Quản lý Đội xe, Hồ sơ Tài xế, Lịch Phân ca & Tài khoản Nhân viên Vận hành
 * (UC-17, UC-18, UC-19, UC-20 — Screen 15, 21, 22, 23, 24, 25, 26, 27)
 */

// ==========================================
// A. DISPATCHER FLEET & DRIVER OPERATIONS (Screen 15)
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
    const statusCode = err.message === 'Biển số xe là bắt buộc' ? 400 : 500;
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
// B. MANAGER STAFF ACCOUNTS (UC-17 - Screen 26 & Screen 27)
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
// C. MANAGER TRUCKS & DRIVER PROFILES (UC-18, UC-19 - Screen 21, 22, 23, 24)
// ==========================================

const getVehicles = async (req, res) => {
  try {
    const { data: trucksResult, error: trucksErr } = await supabase
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
      .order('id', { ascending: true });

    if (trucksErr) throw trucksErr;

    const { data: driversResult, error: driversErr } = await supabase
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
      .order('id', { ascending: true });

    if (driversErr) throw driversErr;

    const formattedTrucks = (trucksResult || []).map((t) => {
      const isInspectionExpired = t.inspection_expiry ? new Date(t.inspection_expiry) < new Date() : false;
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
      const isLicenseExpired = dp.license_expiry ? new Date(dp.license_expiry) < new Date() : false;
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
      return res.status(400).json({ message: 'Biển số xe là bắt buộc (MSG02).' });
    }

    const cleanPlate = plate_number.trim().toUpperCase();

    const { data: existingPlate } = await supabase
      .from('trucks')
      .select('id')
      .eq('plate_number', cleanPlate)
      .maybeSingle();

    if (existingPlate) {
      return res.status(409).json({ message: `Biển số xe ${cleanPlate} đã tồn tại trong hệ thống (MSG04).` });
    }

    let finalStatus = status;
    if (inspection_expiry && new Date(inspection_expiry) < new Date()) {
      if (finalStatus === 'AVAILABLE') {
        return res.status(400).json({
          message: 'Lỗi BR-24: Xe đã hết hạn đăng kiểm không được đặt trạng thái Sẵn sàng (Available). Vui lòng chọn Bảo dưỡng hoặc Ngưng hoạt động.'
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
        inspection_expiry: inspection_expiry ? new Date(inspection_expiry).toISOString() : null,
        insurance_expiry: insurance_expiry ? new Date(insurance_expiry).toISOString() : null,
        gps_device_id: gps_device_id || null,
        status: finalStatus
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: `Đã lưu xe tải ${cleanPlate} thành công (MSG07).`,
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
        return res.status(409).json({ message: `Biển số xe ${cleanPlate} đã bị trùng lặp (MSG04).` });
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
      updateData.inspection_expiry = inspection_expiry ? new Date(inspection_expiry).toISOString() : null;
    }
    if (insurance_expiry !== undefined) {
      updateData.insurance_expiry = insurance_expiry ? new Date(insurance_expiry).toISOString() : null;
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
            message: 'Lỗi BR-24: Không thể chuyển trạng thái sang Sẵn sàng (Available) do xe đã hết hạn đăng kiểm.'
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
      message: 'Cập nhật thông tin xe tải thành công (MSG07).',
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
          message: `Lỗi BR-24: Không thể bật xe ${truck.plate_number} sang Sẵn sàng (Available) do xe đã hết hạn đăng kiểm.`
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
    const { name, full_name, phone, license_number, license_class, expiry } = req.body;
    const driverName = full_name || name;

    if (!driverName || !phone) {
      return res.status(400).json({ message: 'Họ tên và số điện thoại là bắt buộc (MSG02).' });
    }

    const username = `driver_${phone.slice(-4)}_${Math.floor(Math.random() * 100)}`;
    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({
        username,
        full_name: driverName,
        phone,
        role_id: 4,
        status: 'ACTIVE'
      })
      .select('id, full_name, phone, username')
      .single();

    if (userErr) throw userErr;

    const licNum = license_number || `GPLX-${phone.slice(-6)}`;
    const { data: newProfile, error: profileErr } = await supabase
      .from('driver_profiles')
      .insert({
        user_account_id: newUser.id,
        license_number: licNum,
        license_class: license_class || 'C',
        license_expiry: expiry ? new Date(expiry).toISOString() : null,
        status: 'ACTIVE'
      })
      .select('*')
      .single();

    if (profileErr) throw profileErr;

    return res.status(201).json({
      message: 'Thêm tài xế mới thành công (MSG07).',
      driver: {
        id: newProfile.id,
        name: newUser.full_name,
        phone: newUser.phone,
        license: newProfile.license_class,
        license_number: newProfile.license_number,
        expiry: newProfile.license_expiry,
        status: newProfile.status
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
    const { license_number, license_class, license_expiry, status, full_name, phone } = req.body;

    const profileUpdates = { updated_at: new Date().toISOString() };
    if (license_number !== undefined) profileUpdates.license_number = license_number;
    if (license_class !== undefined) profileUpdates.license_class = license_class;
    if (license_expiry !== undefined) {
      profileUpdates.license_expiry = license_expiry ? new Date(license_expiry).toISOString() : null;
    }
    if (status !== undefined) profileUpdates.status = status;

    const { data: updatedProfile, error: pErr } = await supabase
      .from('driver_profiles')
      .update(profileUpdates)
      .eq('id', id)
      .select('*, users:user_account_id(id, full_name, phone)')
      .single();

    if (pErr) throw pErr;

    if ((full_name || phone) && updatedProfile.user_account_id) {
      const userUpdates = { updated_at: new Date().toISOString() };
      if (full_name) userUpdates.full_name = full_name;
      if (phone) userUpdates.phone = phone;

      await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', updatedProfile.user_account_id);
    }

    return res.json({
      message: 'Cập nhật hồ sơ tài xế thành công (MSG07).',
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Update Driver Profile Error:', error);
    return res.status(500).json({ message: 'Lỗi khi cập nhật hồ sơ tài xế', error: error.message });
  }
};

// ==========================================
// D. MANAGER DRIVER SHIFTS (UC-20 - Screen 25)
// ==========================================

const getShifts = async (req, res) => {
  try {
    const { from, to, status, driver_id } = req.query;

    let query = supabase
      .from('driver_shifts')
      .select(`
        id,
        driver_id,
        date,
        start_time,
        end_time,
        status,
        note,
        rejection_reason,
        created_by,
        registered_by,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        driver_profiles (
          id,
          license_number,
          license_class,
          users (
            id,
            full_name,
            phone,
            username
          )
        )
      `)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    if (status && status !== 'ALL') query = query.eq('status', status);
    if (driver_id) query = query.eq('driver_id', driver_id);

    const { data, error } = await query;
    if (error) throw error;

    const formatted = (data || []).map((s) => {
      const dp = s.driver_profiles;
      const u = dp?.users;

      let durationHours = 0;
      try {
        const st = new Date(s.start_time);
        const et = new Date(s.end_time);
        durationHours = Math.max(0, Number(((et - st) / (1000 * 60 * 60)).toFixed(1)));
      } catch {
        durationHours = 8;
      }

      return {
        id: s.id,
        driver_id: s.driver_id,
        driver_name: u?.full_name || u?.username || `Tài xế #${s.driver_id}`,
        driver_phone: u?.phone || '',
        driver_username: u?.username || '',
        license_class: dp?.license_class || '',
        license_number: dp?.license_number || '',
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_hours: durationHours,
        status: s.status,
        note: s.note,
        rejection_reason: s.rejection_reason,
        reviewed_at: s.reviewed_at,
        created_at: s.created_at
      };
    });

    return res.json({
      total: formatted.length,
      shifts: formatted
    });
  } catch (error) {
    console.error('getShifts Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách ca làm việc', error: error.message });
  }
};

const approveShift = async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.id || null;

    const { data: existing, error: getErr } = await supabase
      .from('driver_shifts')
      .select('*, driver_profiles(users(full_name))')
      .eq('id', id)
      .single();

    if (getErr || !existing) {
      return res.status(404).json({ message: 'Không tìm thấy ca làm việc' });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('driver_shifts')
      .update({
        status: 'Approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    let warningMessage = null;
    try {
      const { data: dayShifts } = await supabase
        .from('driver_shifts')
        .select('start_time, end_time')
        .eq('driver_id', existing.driver_id)
        .eq('date', existing.date)
        .eq('status', 'Approved');

      let totalHours = 0;
      (dayShifts || []).forEach((sh) => {
        const diff = (new Date(sh.end_time) - new Date(sh.start_time)) / (1000 * 60 * 60);
        if (diff > 0) totalHours += diff;
      });

      if (totalHours > 10) {
        warningMessage = `Cảnh báo BR-34: Tổng giờ làm việc trong ngày ${existing.date} của tài xế đạt ${totalHours.toFixed(1)}h, vượt quá giới hạn an toàn 10 giờ/ngày.`;
      }
    } catch (err) {
      console.warn('BR-34 check warning:', err.message);
    }

    return res.json({
      message: 'Đã phê duyệt ca làm việc thành công (MSG80).',
      warning: warningMessage,
      shift: updated
    });
  } catch (error) {
    console.error('approveShift Error:', error);
    return res.status(500).json({ message: 'Lỗi khi duyệt ca làm việc', error: error.message });
  }
};

const rejectShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user?.id || null;

    const { data: updated, error } = await supabase
      .from('driver_shifts')
      .update({
        status: 'Rejected',
        rejection_reason: reason || 'Quản lý không phê duyệt ca này',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      message: 'Đã từ chối ca làm việc thành công (MSG80).',
      shift: updated
    });
  } catch (error) {
    console.error('rejectShift Error:', error);
    return res.status(500).json({ message: 'Lỗi khi từ chối ca làm việc', error: error.message });
  }
};

const createShift = async (req, res) => {
  try {
    const { driver_id, date, start_time, end_time, note } = req.body;
    const creatorId = req.user?.id || null;

    if (!driver_id || !date || !start_time || !end_time) {
      return res.status(400).json({ message: 'Tài xế, ngày và khoảng thời gian bắt đầu - kết thúc là bắt buộc' });
    }

    let isoStart = start_time;
    let isoEnd = end_time;
    if (!start_time.includes('T')) {
      isoStart = `${date}T${start_time}:00+07:00`;
    }
    if (!end_time.includes('T')) {
      isoEnd = `${date}T${end_time}:00+07:00`;
    }

    const { data: existingShifts } = await supabase
      .from('driver_shifts')
      .select('id, start_time, end_time, status')
      .eq('driver_id', driver_id)
      .eq('date', date)
      .neq('status', 'Rejected');

    const newStartMs = new Date(isoStart).getTime();
    const newEndMs = new Date(isoEnd).getTime();

    const hasOverlap = (existingShifts || []).some((s) => {
      const curStart = new Date(s.start_time).getTime();
      const curEnd = new Date(s.end_time).getTime();
      return Math.max(newStartMs, curStart) < Math.min(newEndMs, curEnd);
    });

    if (hasOverlap) {
      return res.status(400).json({
        message: 'Lỗi BR-08: Tài xế này đã có ca làm việc khác chồng lấn thời gian trong ngày này.'
      });
    }

    const { data: newShift, error } = await supabase
      .from('driver_shifts')
      .insert({
        driver_id,
        date,
        start_time: isoStart,
        end_time: isoEnd,
        note: note || 'Ca trực do Quản lý tạo',
        status: 'Approved',
        created_by: creatorId,
        registered_by: creatorId,
        reviewed_by: creatorId,
        reviewed_at: new Date().toISOString()
      })
      .select(`
        *,
        driver_profiles (
          users (full_name, phone)
        )
      `)
      .single();

    if (error) throw error;

    let warningMessage = null;
    try {
      const { data: dayShifts } = await supabase
        .from('driver_shifts')
        .select('start_time, end_time')
        .eq('driver_id', driver_id)
        .eq('date', date)
        .eq('status', 'Approved');

      let totalHours = 0;
      (dayShifts || []).forEach((sh) => {
        const diff = (new Date(sh.end_time) - new Date(sh.start_time)) / (1000 * 60 * 60);
        if (diff > 0) totalHours += diff;
      });

      if (totalHours > 10) {
        warningMessage = `Cảnh báo BR-34: Ca làm việc đã lưu nhưng tổng giờ làm việc trong ngày của tài xế đạt ${totalHours.toFixed(1)}h, vượt quá 10 giờ/ngày.`;
      }
    } catch (err) {
      console.warn('BR-34 check warning:', err.message);
    }

    return res.status(201).json({
      message: 'Tạo ca làm việc cho tài xế thành công.',
      warning: warningMessage,
      shift: newShift
    });
  } catch (error) {
    console.error('createShift Error:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo ca làm việc', error: error.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('driver_shifts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.json({ message: 'Đã xóa ca làm việc thành công.' });
  } catch (error) {
    console.error('deleteShift Error:', error);
    return res.status(500).json({ message: 'Lỗi khi xóa ca làm việc', error: error.message });
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

  // Manager Staff Accounts (UC-17)
  getStaffAccounts,
  getStaffAccountDetail,
  createStaffAccount,
  updateStaffAccount,
  updateAccountStatus,

  // Manager Trucks & Driver Profiles (UC-18, UC-19)
  getVehicles,
  createTruck,
  updateTruck,
  updateTruckStatus,
  deleteTruck,
  createDriver,
  updateDriverProfile,

  // Manager Driver Shifts (UC-20)
  getShifts,
  createShift,
  approveShift,
  rejectShift,
  deleteShift
};

