const prisma = require('../../config/prisma');
const fleetService = require('../../services/fleetService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../../utils/prismaHelper');
const {
  normalizeDriverProfileStatus,
  sendSafeError,
  isTruckOnActiveTrip,
  getTodayGMT7Str,
  parsePositiveNumber,
  parseValidDateStr,
  validateTruckStatusValue,
  validateLicenseClassValue,
  toDateObj
} = require('./fleetValidationHelper');

// ==========================================
// DISPATCHER TRUCK OPERATIONS
// ==========================================

const getFleetTrucks = async (req, res) => {
  try {
    const formattedTrucks = await fleetService.getAllTrucks();
    return res.json({ trucks: formattedTrucks });
  } catch (err) {
    return sendSafeError(res, err, 'Lỗi tải danh sách xe', 'getFleetTrucks');
  }
};

const createFleetTruck = async (req, res) => {
  try {
    const newTruck = await fleetService.createTruck(req.body);
    return res.status(201).json({ message: 'Thêm xe thành công', truck: newTruck });
  } catch (err) {
    if (err.message === 'Biển số xe là bắt buộc') {
      err.statusCode = 400;
    }
    return sendSafeError(res, err, 'Không thể thêm phương tiện', 'createFleetTruck');
  }
};

const updateFleetTruck = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await fleetService.updateTruck(id, req.body);
    return res.json({ message: 'Cập nhật thành công', truck: updated });
  } catch (err) {
    return sendSafeError(res, err, 'Lỗi cập nhật phương tiện', 'updateFleetTruck');
  }
};

// ==========================================
// MANAGER TRUCKS & VEHICLES OVERVIEW
// ==========================================

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
      const payloadVal = t.allowed_payload !== null && t.allowed_payload !== undefined ? toNum(t.allowed_payload) : null;
      const boxLen = t.box_length !== null && t.box_length !== undefined ? toNum(t.box_length) : null;
      const boxWid = t.box_width !== null && t.box_width !== undefined ? toNum(t.box_width) : null;
      const boxHei = t.box_height !== null && t.box_height !== undefined ? toNum(t.box_height) : null;
      return {
        id: toNum(t.id),
        plate_number: t.plate_number,
        model: t.model || null,
        payload_kg: payloadVal,
        allowed_payload: payloadVal,
        box_length_cm: boxLen,
        box_width_cm: boxWid,
        box_height_cm: boxHei,
        box_length: boxLen,
        box_width: boxWid,
        box_height: boxHei,
        required_license_class: t.required_license_class || null,
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
        status: normalizeDriverProfileStatus(dp.status),
        is_license_expired: isLicenseExpired
      };
    });

    return res.json({
      trucks: formattedTrucks,
      drivers: formattedDrivers
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi máy chủ khi lấy danh sách đội xe', 'getVehicles');
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
    return sendSafeError(res, error, 'Lỗi khi thêm mới xe tải', 'createTruck');
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

    const currentTruck = await prisma.trucks.findFirst({
      where: { id: bigId, deleted_at: null },
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
      const targetStatus = validateTruckStatusValue(status);
      const curUpper = String(currentTruck.status || '').trim().toUpperCase();
      if (targetStatus !== curUpper && await isTruckOnActiveTrip(bigId, currentTruck.status)) {
        return res.status(409).json({
          message: 'Xe đang trong chuyến vận chuyển, không thể đổi trạng thái.'
        });
      }
      updateData.status = targetStatus;
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
    return sendSafeError(res, error, 'Lỗi khi cập nhật xe tải', 'updateTruck');
  }
};

const updateTruckStatus = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    if (bigId === null) {
      return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
    }

    const { status } = req.body || {};

    if (status && status.toUpperCase() === 'ON_TRIP') {
      return res.status(400).json({ message: 'Không thể chuyển xe sang trạng thái Đang chạy thủ công. Trạng thái này do hệ thống tự động gán khi điều phối chuyến xe.' });
    }

    if (!status || !['AVAILABLE', 'MAINTENANCE', 'INACTIVE'].includes(status.toUpperCase())) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: AVAILABLE, MAINTENANCE, INACTIVE.' });
    }

    const truck = await prisma.trucks.findFirst({
      where: { id: bigId, deleted_at: null },
      select: { id: true, status: true, inspection_expiry: true, plate_number: true }
    });
    if (!truck) {
      return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
    }

    if (await isTruckOnActiveTrip(bigId, truck.status)) {
      return res.status(409).json({
        message: `Xe ${truck.plate_number} đang trong chuyến vận chuyển, không thể đổi trạng thái.`
      });
    }

    const targetStatus = status.toUpperCase();

    if (targetStatus === 'AVAILABLE') {
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
    return sendSafeError(res, error, 'Lỗi khi đổi trạng thái xe', 'updateTruckStatus');
  }
};

const deleteTruck = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    if (bigId === null) {
      return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
    }

    const truck = await prisma.trucks.findFirst({
      where: { id: bigId, deleted_at: null },
      select: { id: true, status: true, plate_number: true }
    });
    if (!truck) {
      return res.status(404).json({ message: 'Không tìm thấy xe tải.' });
    }

    if (await isTruckOnActiveTrip(bigId, truck.status)) {
      return res.status(409).json({
        message: `Xe ${truck.plate_number} đang trong chuyến vận chuyển, không thể ngưng hoạt động hoặc xóa.`
      });
    }

    await prisma.trucks.update({
      where: { id: bigId },
      data: { status: 'INACTIVE', updated_at: new Date() }
    });

    return res.json({ message: 'Đã chuyển xe sang trạng thái Ngưng hoạt động (Inactive).' });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi ngưng hoạt động xe', 'deleteTruck');
  }
};

module.exports = {
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getVehicles,
  createTruck,
  updateTruck,
  updateTruckStatus,
  deleteTruck
};
