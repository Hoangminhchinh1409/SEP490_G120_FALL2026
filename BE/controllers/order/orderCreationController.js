const adminModel = require('../../models/adminModel');
const { getClientIp } = require('../../utils/ipHelper');
const prisma = require('../../config/prisma');
const { serializePrisma, toBigInt } = require('../../utils/prismaHelper');
const { generateTrackingToken, resolveAlsLocationIdIfValid, getOrCreateLocation, saveOrderMeta, getNextDispatcherForWebOrder } = require('../../services/orderHelperService');
const { validateVietnamAddressText } = require('../../utils/addressValidator');

const toDateObj = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).split('T')[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
};

// Bảng thông số tải trọng xe chuẩn ALS
const VEHICLE_MAX_PAYLOAD = {
  'TRUCK_1.25T': 1250,
  'TRUCK_2.5T': 2500,
  'TRUCK_3.5T': 3500,
  'TRUCK_5T': 5000,
  'CONTAINER_20': 12000,
  'CONTAINER_40': 25000
};

const getVehicleMaxPayload = (vKey) => {
  if (!vKey) return 2500;
  const normalized = String(vKey).toUpperCase().trim();
  if (VEHICLE_MAX_PAYLOAD[normalized]) return VEHICLE_MAX_PAYLOAD[normalized];
  if (VEHICLE_MAX_PAYLOAD[`TRUCK_${normalized}`]) return VEHICLE_MAX_PAYLOAD[`TRUCK_${normalized}`];
  if (normalized.includes('1.25')) return 1250;
  if (normalized.includes('2.5')) return 2500;
  if (normalized.includes('3.5')) return 3500;
  if (normalized.includes('5')) return 5000;
  if (normalized.includes('20')) return 12000;
  if (normalized.includes('40')) return 25000;
  return 2500;
};

// 2. KHÁCH HÀNG GỬI YÊU CẦU TƯ VẤN TỪ HOMEPAGE
const createConsultationOrder = async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_tax_code,
      pickup_address,
      pickup_coords,
      delivery_address,
      delivery_coords,
      cargo_name,
      cargo_type,
      other_cargo_type,
      package_count,
      package_unit,
      length_cm,
      width_cm,
      height_cm,
      weight,
      items,
      notes,
      // --- Trường mới: Người nhận & Thời gian ---
      receiver_name,
      receiver_phone,
      required_pickup_date,
      vehicle_type_required,
      loading_unloading_required,
      // --- Trường mới: Hải quan & Thương mại ---
      declared_value_usd,
      incoterms,
      hs_code,
      // --- Trường mới: Hóa đơn & Ngân hàng trung gian ---
      authorized_bank,
      accounting_email,
      payment_method,
      vat_required
    } = req.body;

    // Validate chống nhập địa chỉ gõ bừa/vô nghĩa cho các điểm giao nhận không phải kho ALS
    if (!req.body.pickup_location_id && pickup_address && String(pickup_address).trim()) {
      const pCheck = validateVietnamAddressText(pickup_address);
      if (!pCheck.valid) {
        return res.status(400).json({ message: `Điểm lấy hàng không hợp lệ: ${pCheck.reason}` });
      }
    }
    if (!req.body.delivery_location_id && delivery_address && String(delivery_address).trim()) {
      const dCheck = validateVietnamAddressText(delivery_address);
      if (!dCheck.valid) {
        return res.status(400).json({ message: `Điểm giao hàng không hợp lệ: ${dCheck.reason}` });
      }
    }

    // 1. Tìm hoặc tạo Customer (kèm Mã số thuế)
    let customerId = 16;
    const cleanPhone = (customer_phone || '').replace(/[^0-9]/g, '');
    const taxCode = customer_tax_code || cleanPhone.slice(-10) || '0988123456';

    const existingCust = await prisma.customers.findFirst({
      where: {
        OR: [
          { email: customer_email || 'none@none.com' },
          { tax_code: taxCode }
        ]
      },
      select: { id: true }
    });

    let isNewCustomer = false;
    if (existingCust) {
      customerId = Number(existingCust.id);
    } else {
      isNewCustomer = true;
      try {
        const newCust = await prisma.customers.create({
          data: {
            company_name: customer_name || 'Khách hàng trực tuyến',
            contact_person: customer_name || 'Khách hàng',
            phone: cleanPhone || '0988123456',
            tax_code: taxCode,
            registered_address: pickup_address || delivery_address || 'Hà Nội',
            email: customer_email || 'client@nexlog.vn',
            created_by: 1n
          },
          select: { id: true }
        });
        if (newCust) {
          customerId = Number(newCust.id);
        }
      } catch (custErr) {
        console.error('Error creating customer:', custErr);
      }
    }

    const finalPickupAddress = (pickup_address || '').trim() || 'Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội';
    const finalDeliveryAddress = (delivery_address || '').trim() || 'KCN Tiên Sơn, Bắc Ninh';

    // 2. Lấy hoặc tạo Location cho điểm lấy và điểm giao
    const validatedPickupAlsId = await resolveAlsLocationIdIfValid(req.body.pickup_location_id);
    const pickupLocationId = validatedPickupAlsId || await getOrCreateLocation({
      name: finalPickupAddress,
      address: finalPickupAddress,
      customerId: pickup_address ? customerId : null,
      type: 'CUSTOMER_SITE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone,
      isNewCustomer
    });

    const validatedDeliveryAlsId = await resolveAlsLocationIdIfValid(req.body.delivery_location_id);
    const deliveryLocationId = validatedDeliveryAlsId || await getOrCreateLocation({
      name: finalDeliveryAddress,
      address: finalDeliveryAddress,
      customerId: delivery_address ? customerId : null,
      type: 'CUSTOMER_SITE',
      lat: delivery_coords?.lat,
      lng: delivery_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone,
      isNewCustomer
    });

    // 3. Tính toán trọng lượng (hỗ trợ nhiều loại hàng hóa)
    let actualWeight = parseFloat(weight) || 0;
    let chargeableWeight = 0;
    let finalCargoDesc = cargo_name || 'Hàng bách hóa / Linh kiện';
    let totalPackages = parseInt(package_count, 10) || 1;
    let l = parseFloat(length_cm) || 0;
    let w = parseFloat(width_cm) || 0;
    let h = parseFloat(height_cm) || 0;

    if (items && Array.isArray(items) && items.length > 0) {
      totalPackages = items.reduce((sum, it) => sum + (parseInt(it.package_count, 10) || 1), 0);
      actualWeight = items.reduce((sum, it) => {
        const unitW = parseFloat(it.weight) || 0;
        const cnt = parseInt(it.package_count, 10) || 1;
        return sum + (unitW * cnt);
      }, 0);
      chargeableWeight = items.reduce((sum, it) => {
        const unitW = parseFloat(it.weight) || 0;
        const cnt = parseInt(it.package_count, 10) || 1;
        const totalItemW = unitW * cnt;
        if (it.cargo_type === 'BULK') return sum + totalItemW;
        const unitVol = ((parseFloat(it.length_cm) || 0) * (parseFloat(it.width_cm) || 0) * (parseFloat(it.height_cm) || 0)) / 5000;
        const totalItemVol = unitVol * cnt;
        return sum + Math.max(totalItemW, totalItemVol);
      }, 0);
      finalCargoDesc = items.map(it => `${it.cargo_name || 'Hàng'} (${it.package_count || 1} ${it.package_unit || 'kiện'})`).join(', ');
      l = Math.max(1, parseFloat(items[0]?.length_cm) || 100);
      w = Math.max(1, parseFloat(items[0]?.width_cm) || 80);
      h = Math.max(1, parseFloat(items[0]?.height_cm) || 100);
    } else {
      const isBulk = cargo_type === 'BULK';
      l = isBulk ? 1 : Math.max(1, parseFloat(length_cm) || 120);
      w = isBulk ? 1 : Math.max(1, parseFloat(width_cm) || 100);
      h = isBulk ? 1 : Math.max(1, parseFloat(height_cm) || 150);
      actualWeight = actualWeight || 0;
      const volWeight = isBulk ? 0 : ((l * w * h) / 5000);
      chargeableWeight = isBulk ? actualWeight : Math.max(actualWeight, volWeight);
    }

    // Validate quá tải trọng Backend cho đơn tư vấn
    const effectiveWeightConsultation = Math.max(actualWeight, chargeableWeight);
    const maxPayloadConsultation = getVehicleMaxPayload(vehicle_type_required);
    if (effectiveWeightConsultation > maxPayloadConsultation) {
      return res.status(400).json({
        message: `Lô hàng nặng ${effectiveWeightConsultation.toLocaleString('vi-VN')} kg vượt quá tải trọng tối đa của loại xe ${vehicle_type_required || 'đã chọn'} (${maxPayloadConsultation.toLocaleString('vi-VN')} kg). Vui lòng chọn xe có tải trọng lớn hơn!`
      });
    }

    const randomCode = `NEX-${Math.floor(100000 + Math.random() * 900000)}`;
    const token = generateTrackingToken();

    // Trích xuất thông tin lịch bay & logistics
    const {
      flight_arrival_date,
      flight_arrival_time,
      flight_datetime,
      export_pickup_suggestion
    } = req.body;

    const metadata = {
      shipping_direction: req.body.shipping_direction || 'IMPORT',
      pickup_address: finalPickupAddress,
      delivery_address: finalDeliveryAddress,
      pickup_coords: pickup_coords || { lat: 21.2187, lng: 105.8042 },
      delivery_coords: delivery_coords || null,
      estimated_distance_km: parseFloat(req.body.estimated_distance_km) || 0,
      estimated_duration_mins: parseInt(req.body.estimated_duration_mins, 10) || 0,
      vehicle_type_required: vehicle_type_required || 'TRUCK_2.5T',
      customer_requested_vehicle: vehicle_type_required || 'TRUCK_2.5T',
      flight_arrival_date: flight_arrival_date || null,
      flight_arrival_time: flight_arrival_time || null,
      flight_datetime: flight_datetime || null,
      export_pickup_suggestion: export_pickup_suggestion || null,
      customer_email: customer_email || null,
      customer_tax_code: taxCode,
      accounting_email: accounting_email || customer_email || null,
      authorized_bank: authorized_bank || 'Vietcombank',
      items: items || null,
      user_note: notes || null,
      request_split_trucks: Boolean(req.body.request_split_trucks),
      split_details: req.body.split_details || null,
      web_workflow: {
        stage: 'CREATED',
        request_split_trucks: Boolean(req.body.request_split_trucks),
        split_details: req.body.split_details || null
      }
    };

    // 4. Tìm điều phối viên nhận đơn Web xoay vòng (Least Loaded Round-Robin)
    const assignedDispatcherId = await getNextDispatcherForWebOrder();

    // 5. Insert vào bảng orders
    const createdOrderRaw = await prisma.orders.create({
      data: {
        order_code: randomCode,
        order_type: req.body.shipping_direction === 'EXPORT' ? 'Export' : 'Import',
        customer_id: BigInt(customerId),
        tracking_token: token,
        pickup_location_id: BigInt(Number(pickupLocationId)),
        delivery_location_id: BigInt(Number(deliveryLocationId)),
        receiver_name: (receiver_name && (receiver_name + '').trim()) || customer_name || 'Khách hàng trực tuyến',
        receiver_phone: (receiver_phone && (receiver_phone + '').replace(/[^0-9]/g, '')) || cleanPhone || '0988123456',
        agreed_price: 0n,
        status: 'DRAFT',
        source: 'Web',
        responsible_dispatcher_id: BigInt(Number(assignedDispatcherId)),
        created_by: BigInt(Number(assignedDispatcherId)),
        requested_pickup_date: toDateObj(required_pickup_date || req.body.flight_arrival_date),
        truck_type_requested: vehicle_type_required || 'TRUCK_2.5T',
        loading_request: (loading_unloading_required === true || loading_unloading_required === 'true') ? 'YES' : 'NO',
        warehouse_type: 'ALS warehouse',
        customer_agrees_to_grouping: false,
        document_status: 'Pending Documents',
        is_closed: false,
        waiting_too_long: false,
        late_risk: false
      }
    });

    const createdOrder = serializePrisma(createdOrderRaw);
    await saveOrderMeta(createdOrder.id, metadata);

    // 5. Insert vào bảng order_cargos
    try {
      await prisma.order_cargos.create({
        data: {
          order_id: createdOrderRaw.id,
          cargo_type: cargo_type === 'BULK' ? 'Bulk' : (cargo_type === 'PALLET' ? 'Pallet' : 'General'),
          cargo_name: finalCargoDesc,
          quantity: totalPackages,
          unit: package_unit || 'Kiện',
          actual_weight_kg: actualWeight,
          length_cm: l,
          width_cm: w,
          height_cm: h,
          stackable: true,
          chargeable_weight_kg: parseFloat(chargeableWeight.toFixed(2)),
          declared_value: declared_value_usd ? BigInt(Math.round(parseFloat(declared_value_usd) * 25000)) : 0n,
          special_request_note: notes || null
        }
      });
    } catch (cargoErr) {
      console.error('createConsultationOrder Cargo Insert Error:', cargoErr);
    }

    // 6. Thêm ghi chú vào bảng order_notes nếu có hoặc nếu khách yêu cầu chia xe
    let initialNoteContent = notes ? notes.trim() : '';
    if (req.body.request_split_trucks && req.body.split_details) {
      const splitInfo = `[KHÁCH YÊU CẦU TÁCH ${req.body.split_details.split_count || 2} XE NHỎ KHI TẠO ĐƠN]: Loại xe mong muốn: ${req.body.split_details.vehicle_target_label || req.body.split_details.vehicle_target}. Lý do: ${req.body.split_details.reason || 'Đường kho hẹp'}.`;
      initialNoteContent = initialNoteContent ? `${splitInfo} Ghi chú khách: ${initialNoteContent}` : splitInfo;
    }

    if (initialNoteContent.length > 0) {
      await prisma.order_notes.create({
        data: {
          order_id: createdOrderRaw.id,
          content: initialNoteContent.slice(0, 480),
          created_by: 1n
        }
      });
    }

    return res.status(201).json({
      message: 'Đăng ký tư vấn thành công!',
      order: {
        id: createdOrder.id,
        order_id: createdOrder.order_code,
        customer_phone,
        status: 'DRAFT',
        source: 'Web',
        tracking_token: token
      }
    });
  } catch (err) {
    console.error('createConsultationOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 3. ĐIỀU PHỐI VIÊN TẠO ĐƠN TRỰC TIẾP (HOTLINE / TRỰC TIẾP)
const createDirectOrder = async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      is_new_customer,
      pickup_address,
      delivery_address,
      length_cm,
      width_cm,
      height_cm,
      weight_kg,
      chargeable_weight,
      agreed_price,
      order_notes,
      cargo_name,
      cargo_type,
      package_count,
      package_unit,
      pickup_coords,
      delivery_coords,
      receiver_name,
      receiver_phone,
      required_pickup_date,
      vehicle_type_required,
      loading_unloading_required,
      declared_value_usd,
      authorized_bank,
      accounting_email
    } = req.body;

    // Validate chống nhập địa chỉ gõ bừa/vô nghĩa (trụ sở khách & điểm lấy/giao ngoài hệ thống ALS)
    if (customer_address && String(customer_address).trim()) {
      const cCheck = validateVietnamAddressText(customer_address);
      if (!cCheck.valid) {
        return res.status(400).json({ message: `Địa chỉ trụ sở / kho khách hàng không hợp lệ: ${cCheck.reason}` });
      }
    }
    if (!req.body.pickup_location_id && pickup_address && String(pickup_address).trim()) {
      const pCheck = validateVietnamAddressText(pickup_address);
      if (!pCheck.valid) {
        return res.status(400).json({ message: `Điểm lấy hàng không hợp lệ: ${pCheck.reason}` });
      }
    }
    if (!req.body.delivery_location_id && delivery_address && String(delivery_address).trim()) {
      const dCheck = validateVietnamAddressText(delivery_address);
      if (!dCheck.valid) {
        return res.status(400).json({ message: `Điểm giao hàng không hợp lệ: ${dCheck.reason}` });
      }
    }

    // Tìm hoặc tạo Customer
    let customerId = 16;
    const cleanPhone = (customer_phone || '').replace(/[^0-9]/g, '');

    if (!is_new_customer) {
      const existingCust = await prisma.customers.findFirst({
        where: {
          OR: [
            { company_name: customer_name || 'none' },
            { tax_code: cleanPhone || 'none' }
          ]
        },
        select: { id: true }
      });

      if (existingCust) {
        customerId = Number(existingCust.id);
      }
    }

    if (is_new_customer || customerId === 16) {
      try {
        const newCust = await prisma.customers.create({
          data: {
            company_name: customer_name || 'Khách hàng mới',
            contact_person: customer_name || 'Khách hàng',
            phone: cleanPhone || '0988123456',
            tax_code: cleanPhone.slice(-10) || `TX${Date.now().toString().slice(-8)}`,
            registered_address: customer_address || delivery_address || 'Hà Nội',
            email: customer_email || 'client@nexlog.vn',
            created_by: 1n
          },
          select: { id: true }
        });
        if (newCust) {
          customerId = Number(newCust.id);
        }
      } catch (custErr) {
        console.error('Error creating customer in direct order:', custErr);
      }
    }

    const finalPickupAddress = (pickup_address || '').trim() || 'Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội';
    const finalDeliveryAddress = (delivery_address || customer_address || '').trim() || 'KCN Tiên Sơn, Bắc Ninh';

    const isNew = Boolean(is_new_customer || customerId === 16);
    const validatedPickupAlsId = await resolveAlsLocationIdIfValid(req.body.pickup_location_id);
    const pickupLocationId = validatedPickupAlsId || await getOrCreateLocation({
      name: finalPickupAddress,
      address: finalPickupAddress,
      customerId: pickup_address ? customerId : null,
      type: 'CUSTOMER_SITE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone,
      isNewCustomer: isNew
    });

    const validatedDeliveryAlsId = await resolveAlsLocationIdIfValid(req.body.delivery_location_id);
    const deliveryLocationId = validatedDeliveryAlsId || await getOrCreateLocation({
      name: finalDeliveryAddress,
      address: finalDeliveryAddress,
      customerId: delivery_address ? customerId : null,
      type: 'CUSTOMER_SITE',
      lat: delivery_coords?.lat,
      lng: delivery_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone,
      isNewCustomer: isNew
    });

    const orderCode = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const token = generateTrackingToken();

    const isBulk = cargo_type === 'BULK';
    const l = isBulk ? 1 : Math.max(1, parseFloat(length_cm) || 120);
    const w = isBulk ? 1 : Math.max(1, parseFloat(width_cm) || 100);
    const h = isBulk ? 1 : Math.max(1, parseFloat(height_cm) || 150);
    const actualWeight = parseFloat(weight_kg) || 0;
    const finalChargeable = isBulk ? actualWeight : (parseFloat(chargeable_weight) || actualWeight);

    // Validate quá tải trọng Backend
    const effectiveWeight = Math.max(actualWeight, finalChargeable);
    const maxPayload = getVehicleMaxPayload(vehicle_type_required);
    if (effectiveWeight > maxPayload) {
      return res.status(400).json({
        message: `Lô hàng nặng ${effectiveWeight.toLocaleString('vi-VN')} kg vượt quá tải trọng tối đa của loại xe ${vehicle_type_required || 'đã chọn'} (${maxPayload.toLocaleString('vi-VN')} kg). Vui lòng chọn xe có tải trọng lớn hơn!`
      });
    }

    const directMeta = {
      shipping_direction: req.body.shipping_direction || 'IMPORT',
      pickup_address: finalPickupAddress,
      delivery_address: finalDeliveryAddress,
      pickup_coords: pickup_coords || { lat: 21.2187, lng: 105.8042 },
      delivery_coords: delivery_coords || null,
      vehicle_type_required: vehicle_type_required || 'TRUCK_2.5T',
      customer_requested_vehicle: vehicle_type_required || 'TRUCK_2.5T',
      flight_arrival_date: req.body.flight_arrival_date || null,
      flight_arrival_time: req.body.flight_arrival_time || null,
      flight_datetime: req.body.flight_datetime || null,
      export_pickup_suggestion: req.body.export_pickup_suggestion || null,
      customer_email: customer_email || null,
      accounting_email: accounting_email || customer_email || null,
      authorized_bank: authorized_bank || 'Vietcombank',
      items: req.body.items || null,
      documents: req.body.documents || null,
      request_split_trucks: Boolean(req.body.request_split_trucks),
      split_details: req.body.split_details || null,
      web_workflow: {
        stage: 'CREATED',
        request_split_trucks: Boolean(req.body.request_split_trucks),
        split_details: req.body.split_details || null
      }
    };

    const hasUploadedDocs = Array.isArray(req.body.documents) && req.body.documents.some(d => d.file && d.file !== 'Chờ tải lên');

    // Nếu điều phối viên đang đăng nhập trực tiếp tạo đơn, gán chính điều phối viên đó
    const directDispatcherId = req.body.dispatcher_id || req.user?.id || 1;

    const createdOrderRaw = await prisma.orders.create({
      data: {
        order_code: orderCode,
        order_type: req.body.shipping_direction === 'EXPORT' ? 'Export' : 'Import',
        customer_id: BigInt(customerId),
        tracking_token: token,
        pickup_location_id: BigInt(Number(pickupLocationId)),
        delivery_location_id: BigInt(Number(deliveryLocationId)),
        receiver_name: (receiver_name && (receiver_name + '').trim()) || customer_name || 'Người nhận',
        receiver_phone: (receiver_phone && (receiver_phone + '').replace(/[^0-9]/g, '')) || cleanPhone || '0988123456',
        agreed_price: BigInt(parseInt(agreed_price, 10) || 0),
        status: hasUploadedDocs ? 'CONFIRMED' : 'READY_FOR_PLANNING',
        source: 'Direct',
        responsible_dispatcher_id: BigInt(Number(directDispatcherId)),
        created_by: BigInt(Number(directDispatcherId)),
        requested_pickup_date: toDateObj(required_pickup_date || req.body.flight_arrival_date),
        truck_type_requested: vehicle_type_required || 'TRUCK_2.5T',
        loading_request: (loading_unloading_required === true || loading_unloading_required === 'true') ? 'YES' : 'NO',
        warehouse_type: 'ALS warehouse',
        customer_agrees_to_grouping: false,
        document_status: hasUploadedDocs ? 'Approved' : 'Pending Documents',
        is_closed: false,
        waiting_too_long: false,
        late_risk: false,
        ready_for_planning_at: new Date()
      }
    });

    const createdOrder = serializePrisma(createdOrderRaw);
    await saveOrderMeta(createdOrder.id, directMeta);

    // Insert cargo - Bảng order_cargos có quan hệ 1-1 (order_id @unique); chi tiết từng mặt hàng đã nằm trong directMeta.items
    try {
      const hasItemsArr = Array.isArray(req.body.items) && req.body.items.length > 0;
      const firstIt = hasItemsArr ? req.body.items[0] : null;
      const firstIsBulk = (firstIt?.cargo_type || cargo_type) === 'BULK';
      await prisma.order_cargos.create({
        data: {
          order_id: createdOrderRaw.id,
          cargo_type: firstIsBulk ? 'Bulk' : ((firstIt?.cargo_type || cargo_type) === 'PALLET' ? 'Pallet' : 'General'),
          cargo_name: hasItemsArr
            ? req.body.items.map((it, idx) => it.cargo_name || `Mặt hàng #${idx + 1}`).join(', ').slice(0, 255)
            : (cargo_name || (isBulk ? 'Hàng rời tính theo trọng tải' : 'Hàng bách hóa / Linh kiện')),
          quantity: parseInt(package_count, 10) || (hasItemsArr ? req.body.items.reduce((s, it) => s + (parseInt(it.package_count || it.quantity, 10) || 1), 0) : 1),
          unit: package_unit || firstIt?.package_unit || (firstIsBulk ? 'Chuyến' : 'Kiện'),
          actual_weight_kg: actualWeight,
          length_cm: l,
          width_cm: w,
          height_cm: h,
          stackable: true,
          chargeable_weight_kg: parseFloat(finalChargeable.toFixed(2)),
          declared_value: declared_value_usd ? BigInt(Math.round(parseFloat(declared_value_usd) * 25000)) : 0n,
          special_request_note: order_notes || null
        }
      });
    } catch (cargoErr) {
      console.error('createDirectOrder Cargo Error:', cargoErr);
    }

    const noteParts = [
      order_notes,
      req.body.request_split_trucks && req.body.split_details
        ? `[ĐIỀU PHỐI YÊU CẦU TÁCH ${req.body.split_details.split_count || 2} XE NHỎ]: Xe ${req.body.split_details.vehicle_target_label || req.body.split_details.vehicle_target}. Lý do: ${req.body.split_details.reason || 'Kho hẹp'}`
        : '',
      pickup_address ? `Điểm lấy hàng: ${pickup_address}` : '',
      customer_address ? `Địa chỉ KH: ${customer_address}` : '',
      cargo_type ? `Loại hàng: ${cargo_type}` : '',
      package_unit ? `Quy cách: ${package_count || 1} ${package_unit}` : ''
    ].filter(Boolean);

    if (noteParts.length > 0) {
      await prisma.order_notes.create({
        data: {
          order_id: createdOrderRaw.id,
          content: noteParts.join(' | ').slice(0, 500),
          created_by: 1n
        }
      });
    }

    return res.status(201).json({
      message: 'Tạo đơn vận chuyển thành công!',
      order: createdOrder
    });
  } catch (err) {
    console.error('createDirectOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  createConsultationOrder,
  createDirectOrder
};
