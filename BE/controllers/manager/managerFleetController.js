const supabase = require('../../config/supabase');

/**
 * Controller Quản lý Đội xe & Hồ sơ Tài xế dành cho Manager (UC-18 & UC-19)
 * - Quản lý thông số kỹ thuật xe: biển số, tải trọng (BR-33), kích thước thùng D×R×C (BR-43)
 * - Vòng đời trạng thái xe: AVAILABLE, ON_TRIP, MAINTENANCE, INACTIVE (BR-24)
 * - Khóa không cho chuyển sang AVAILABLE nếu hết hạn đăng kiểm (BR-24)
 * - Quản lý hồ sơ tài xế: số bằng lái, hạng bằng, ngày hết hạn
 */
const managerFleetController = {
  // 1. Lấy danh sách đội xe & tài xế
  getVehicles: async (req, res) => {
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

      const formattedTrucks = (trucksResult || []).map(t => {
        // Kiểm tra xem đăng kiểm đã hết hạn hay chưa
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

      const formattedDrivers = (driversResult || []).map(dp => {
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
      console.error("Get Vehicles Error:", error);
      return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách đội xe", error: error.message });
    }
  },

  // 2. Thêm mới xe tải (Screen 22 - UC-18)
  createTruck: async (req, res) => {
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
        return res.status(400).json({ message: "Biển số xe là bắt buộc (MSG02)." });
      }

      const cleanPlate = plate_number.trim().toUpperCase();

      // Kiểm tra trùng biển số (MSG04)
      const { data: existingPlate } = await supabase
        .from('trucks')
        .select('id')
        .eq('plate_number', cleanPlate)
        .maybeSingle();

      if (existingPlate) {
        return res.status(409).json({ message: `Biển số xe ${cleanPlate} đã tồn tại trong hệ thống (MSG04).` });
      }

      // BR-24: Không được bật xe sang Available nếu xe đã hết hạn đăng kiểm
      let finalStatus = status;
      if (inspection_expiry && new Date(inspection_expiry) < new Date()) {
        if (finalStatus === 'AVAILABLE') {
          return res.status(400).json({
            message: "Lỗi BR-24: Xe đã hết hạn đăng kiểm không được đặt trạng thái Sẵn sàng (Available). Vui lòng chọn Bảo dưỡng hoặc Ngưng hoạt động."
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
      console.error("Create Truck Error:", error);
      return res.status(500).json({ message: "Lỗi khi thêm mới xe tải", error: error.message });
    }
  },

  // 3. Cập nhật thông tin xe tải (Screen 22 - UC-18)
  updateTruck: async (req, res) => {
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

      // BR-24: Kiểm tra trạng thái Available khi đăng kiểm hết hạn
      const targetInspection = updateData.inspection_expiry !== undefined 
        ? updateData.inspection_expiry 
        : null;

      if (status !== undefined) {
        if (status === 'AVAILABLE') {
          // Lấy thông tin đăng kiểm hiện tại nếu không update
          let exp = targetInspection;
          if (exp === null) {
            const { data: cur } = await supabase.from('trucks').select('inspection_expiry').eq('id', id).single();
            exp = cur?.inspection_expiry;
          }
          if (exp && new Date(exp) < new Date()) {
            return res.status(400).json({
              message: "Lỗi BR-24: Không thể chuyển trạng thái sang Sẵn sàng (Available) do xe đã hết hạn đăng kiểm."
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
        message: "Cập nhật thông tin xe tải thành công (MSG07).",
        truck: updated
      });
    } catch (error) {
      console.error("Update Truck Error:", error);
      return res.status(500).json({ message: "Lỗi khi cập nhật xe tải", error: error.message });
    }
  },

  // 4. Đổi trạng thái xe tải (Screen 15 & Screen 22 - BR-24)
  updateTruckStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['AVAILABLE', 'MAINTENANCE', 'INACTIVE'].includes(status.toUpperCase())) {
        return res.status(400).json({ message: "Trạng thái không hợp lệ. Chỉ chấp nhận: AVAILABLE, MAINTENANCE, INACTIVE." });
      }

      const targetStatus = status.toUpperCase();

      // BR-24: Nếu chuyển sang AVAILABLE, kiểm tra hạn đăng kiểm
      if (targetStatus === 'AVAILABLE') {
        const { data: truck, error: tErr } = await supabase
          .from('trucks')
          .select('inspection_expiry, plate_number')
          .eq('id', id)
          .single();

        if (tErr || !truck) {
          return res.status(404).json({ message: "Không tìm thấy xe tải." });
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
      console.error("Update Truck Status Error:", error);
      return res.status(500).json({ message: "Lỗi khi đổi trạng thái xe", error: error.message });
    }
  },

  // 5. Xóa hoặc ngưng hoạt động xe
  deleteTruck: async (req, res) => {
    try {
      const { id } = req.params;
      // Chuyển sang trạng thái INACTIVE
      const { error } = await supabase
        .from('trucks')
        .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return res.json({ message: "Đã chuyển xe sang trạng thái Ngưng hoạt động (Inactive)." });
    } catch (error) {
      console.error("Delete Truck Error:", error);
      return res.status(500).json({ message: "Lỗi khi ngưng hoạt động xe", error: error.message });
    }
  },

  // 6. Thêm tài xế mới (UC-19)
  createDriver: async (req, res) => {
    try {
      const { name, full_name, phone, license_number, license_class, expiry } = req.body;
      const driverName = full_name || name;

      if (!driverName || !phone) {
        return res.status(400).json({ message: "Họ tên và số điện thoại là bắt buộc (MSG02)." });
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
        message: "Thêm tài xế mới thành công (MSG07).",
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
      console.error("Create Driver Error:", error);
      return res.status(500).json({ message: "Không thể thêm tài xế", error: error.message });
    }
  },

  // 7. Cập nhật hồ sơ tài xế (Screen 24 - UC-19)
  updateDriverProfile: async (req, res) => {
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
        message: "Cập nhật hồ sơ tài xế thành công (MSG07).",
        profile: updatedProfile
      });
    } catch (error) {
      console.error("Update Driver Profile Error:", error);
      return res.status(500).json({ message: "Lỗi khi cập nhật hồ sơ tài xế", error: error.message });
    }
  }
};

module.exports = managerFleetController;