const supabase = require('../../config/supabase');
const { generateTrackingToken, getOrCreateLocation, saveOrderMeta } = require('./orderHelpers');

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

    // 1. Tìm hoặc tạo Customer (kèm Mã số thuế)
    let customerId = 16;
    const cleanPhone = (customer_phone || '').replace(/[^0-9]/g, '');
    const taxCode = customer_tax_code || cleanPhone.slice(-10) || '0988123456';

    const { data: existingCust } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${customer_email || 'none@none.com'},tax_code.eq.${taxCode}`)
      .limit(1);

    let isNewCustomer = false;
    if (existingCust && existingCust.length > 0) {
      customerId = existingCust[0].id;
    } else {
      isNewCustomer = true;
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{
          company_name: customer_name || 'Khách hàng trực tuyến',
          contact_person: customer_name || 'Khách hàng',
          phone: cleanPhone || '0988123456',
          tax_code: taxCode,
          registered_address: pickup_address || delivery_address || 'Hà Nội',
          email: customer_email || 'client@nexlog.vn',
          created_by: 1
        }])
        .select();

      if (custErr) {
        console.error('Error creating customer:', custErr);
      }
      if (newCust && newCust.length > 0) {
        customerId = newCust[0].id;
      }
    }

    // 2. Lấy hoặc tạo Location cho điểm lấy và điểm giao (chỉ lưu vào danh mục địa điểm với khách hàng mới)
    const pickupLocationId = await getOrCreateLocation({
      name: pickup_address ? (customer_name || 'Địa chỉ lấy hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: pickup_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: pickup_address ? customerId : null,
      type: pickup_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone,
      isNewCustomer
    });

    const deliveryLocationId = await getOrCreateLocation({
      name: delivery_address ? (customer_name || 'Địa chỉ giao hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: delivery_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: delivery_address ? customerId : null,
      type: delivery_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
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
    let totalPackages = parseInt(package_count) || 1;
    let l = parseFloat(length_cm) || 0;
    let w = parseFloat(width_cm) || 0;
    let h = parseFloat(height_cm) || 0;

    if (items && Array.isArray(items) && items.length > 0) {
      totalPackages = items.reduce((sum, it) => sum + (parseInt(it.package_count) || 1), 0);
      actualWeight = items.reduce((sum, it) => sum + (parseFloat(it.weight) || 0), 0);
      chargeableWeight = items.reduce((sum, it) => {
        const itemWeight = parseFloat(it.weight) || 0;
        if (it.cargo_type === 'BULK') return sum + itemWeight;
        const itemVol = ((parseFloat(it.length_cm) || 0) * (parseFloat(it.width_cm) || 0) * (parseFloat(it.height_cm) || 0)) / 5000;
        return sum + Math.max(itemWeight, itemVol);
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
      actualWeight = actualWeight || 1000;
      const volWeight = isBulk ? 0 : ((l * w * h) / 5000);
      chargeableWeight = isBulk ? actualWeight : Math.max(actualWeight, volWeight);
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
      flight_arrival_date: flight_arrival_date || null,
      flight_arrival_time: flight_arrival_time || null,
      flight_datetime: flight_datetime || null,
      export_pickup_suggestion: export_pickup_suggestion || null,
      customer_email: customer_email || null,
      customer_tax_code: taxCode,
      accounting_email: accounting_email || customer_email || null,
      authorized_bank: authorized_bank || 'Vietcombank',
      items: items || null
    };

    // 4. Insert vào bảng orders
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        order_code: randomCode,
        hawb_number: randomCode,
        order_type: req.body.shipping_direction === 'EXPORT' ? 'Export' : 'Import',
        customer_id: customerId,
        tracking_token: token,
        pickup_location_id: pickupLocationId,
        delivery_location_id: deliveryLocationId,
        receiver_name: (receiver_name && (receiver_name + '').trim()) || customer_name || 'Khách hàng trực tuyến',
        receiver_phone: (receiver_phone && (receiver_phone + '').replace(/[^0-9]/g, '')) || cleanPhone || '0988123456',
        agreed_price: 0,
        status: 'Draft',
        source: 'Web',
        responsible_dispatcher_id: 1,
        created_by: 1,
        requested_pickup_date: required_pickup_date || flight_arrival_date || null,
        truck_type_requested: vehicle_type_required || 'TRUCK_2.5T',
        loading_request: (loading_unloading_required === true || loading_unloading_required === 'true') ? 'YES' : 'NO',
        warehouse_type: 'ALS warehouse',
        customer_agrees_to_grouping: false,
        document_status: 'Pending Documents',
        is_closed: false,
        waiting_too_long: false,
        late_risk: false
      }])
      .select();

    if (orderErr) {
      console.error('createConsultationOrder Insert Error:', orderErr);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng trên Supabase', error: orderErr });
    }

    const createdOrder = newOrder[0];
    await saveOrderMeta(createdOrder.id, metadata);

    // 5. Insert vào bảng order_cargos
    const { error: cargoErr } = await supabase
      .from('order_cargos')
      .insert([{
        order_id: createdOrder.id,
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
        declared_value: declared_value_usd ? parseFloat(declared_value_usd) * 25000 : 0,
        special_request_note: notes || null
      }]);

    if (cargoErr) {
      console.error('createConsultationOrder Cargo Insert Error:', cargoErr);
    }

    // 6. Thêm ghi chú vào bảng order_notes nếu có
    if (notes && notes.trim().length > 0) {
      await supabase.from('order_notes').insert([{
        order_id: createdOrder.id,
        content: notes.trim(),
        created_by: 1
      }]);
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
      hawb_code,
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
      source,
      status,
      pickup_coords,
      delivery_coords,
      // --- Trường mới: Người nhận & Lịch trình ---
      receiver_name,
      receiver_phone,
      required_pickup_date,
      vehicle_type_required,
      loading_unloading_required,
      pickup_contact_name,
      pickup_contact_phone,
      // --- Trường mới: Hải quan 4 kịch bản ---
      customs_scenario,
      hawb_number,
      mawb_number,
      customs_clearance_status,
      expected_clearance_date,
      customs_declaration_number,
      external_warehouse_address,
      // --- Trường mới: Thương mại & Hóa đơn Kế toán ---
      hs_code,
      declared_value_usd,
      incoterms,
      payment_method,
      vat_required,
      payment_terms,
      authorized_bank,
      accounting_email,
      invoice_payment_terms
    } = req.body;

    // Tìm hoặc tạo Customer
    let customerId = 16;
    const cleanPhone = (customer_phone || '').replace(/[^0-9]/g, '');

    if (!is_new_customer) {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .or(`company_name.eq.${customer_name || 'none'},tax_code.eq.${cleanPhone || 'none'}`)
        .limit(1);

      if (existingCust && existingCust.length > 0) {
        customerId = existingCust[0].id;
      }
    }

    // Nếu là khách hàng mới hoặc chưa tìm thấy trong DB thì tạo mới
    if (is_new_customer || customerId === 16) {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{
          company_name: customer_name || 'Khách hàng mới',
          contact_person: customer_name || 'Khách hàng',
          phone: cleanPhone || '0988123456',
          tax_code: cleanPhone.slice(-10) || '0988123456',
          registered_address: customer_address || delivery_address || 'Hà Nội',
          email: customer_email || 'client@nexlog.vn',
          created_by: 1
        }])
        .select();

      if (custErr) {
        console.error('Error creating customer in direct order:', custErr);
      }
      if (newCust && newCust.length > 0) {
        customerId = newCust[0].id;
      }
    }

    // Lấy hoặc tạo Location cho điểm lấy và điểm giao (chỉ lưu vào danh mục địa điểm với khách hàng mới)
    const isNew = Boolean(is_new_customer || customerId === 16);
    const pickupLocationId = await getOrCreateLocation({
      name: pickup_address ? (customer_name || 'Địa chỉ lấy hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: pickup_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: pickup_address ? customerId : null,
      type: pickup_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone,
      isNewCustomer: isNew
    });

    const deliveryLocationId = await getOrCreateLocation({
      name: delivery_address ? (customer_name || 'Địa chỉ giao hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: delivery_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: delivery_address ? customerId : null,
      type: delivery_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: delivery_coords?.lat,
      lng: delivery_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone,
      isNewCustomer: isNew
    });

    // Mã đơn ban đầu: ORD-XXXXXX
    const orderCode = hawb_code?.trim() || `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const token = generateTrackingToken();

    const isBulk = cargo_type === 'BULK';
    const l = isBulk ? 1 : Math.max(1, parseFloat(length_cm) || 120);
    const w = isBulk ? 1 : Math.max(1, parseFloat(width_cm) || 100);
    const h = isBulk ? 1 : Math.max(1, parseFloat(height_cm) || 150);
    const actualWeight = parseFloat(weight_kg) || 1000;
    const finalChargeable = isBulk ? actualWeight : (parseFloat(chargeable_weight) || actualWeight);

    const directMeta = {
      shipping_direction: req.body.shipping_direction || 'IMPORT',
      flight_arrival_date: req.body.flight_arrival_date || null,
      flight_arrival_time: req.body.flight_arrival_time || null,
      flight_datetime: req.body.flight_datetime || null,
      export_pickup_suggestion: req.body.export_pickup_suggestion || null,
      customer_email: customer_email || null,
      accounting_email: accounting_email || customer_email || null,
      authorized_bank: authorized_bank || 'Vietcombank',
      items: req.body.items || null
    };

    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        order_code: orderCode,
        hawb_number: hawb_number || orderCode,
        order_type: req.body.shipping_direction === 'EXPORT' ? 'Export' : 'Import',
        customer_id: customerId,
        tracking_token: token,
        pickup_location_id: pickupLocationId,
        delivery_location_id: deliveryLocationId,
        receiver_name: (receiver_name && (receiver_name + '').trim()) || customer_name || 'Người nhận',
        receiver_phone: (receiver_phone && (receiver_phone + '').replace(/[^0-9]/g, '')) || cleanPhone || '0988123456',
        agreed_price: parseInt(agreed_price) || 0,
        status: 'Assigned',
        source: 'Direct',
        responsible_dispatcher_id: 1,
        created_by: 1,
        requested_pickup_date: required_pickup_date || req.body.flight_arrival_date || null,
        truck_type_requested: vehicle_type_required || 'TRUCK_2.5T',
        loading_request: (loading_unloading_required === true || loading_unloading_required === 'true') ? 'YES' : 'NO',
        warehouse_type: 'ALS warehouse',
        customer_agrees_to_grouping: false,
        document_status: 'Pending Documents',
        is_closed: false,
        waiting_too_long: false,
        late_risk: false,
        ready_for_planning_at: new Date().toISOString()
      }])
      .select();

    if (orderErr) {
      console.error('createDirectOrder Error:', orderErr);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng', error: orderErr });
    }

    const createdOrder = newOrder[0];
    await saveOrderMeta(createdOrder.id, directMeta);

    // Insert cargo
    const { error: cargoErr } = await supabase
      .from('order_cargos')
      .insert([{
        order_id: createdOrder.id,
        cargo_type: isBulk ? 'Bulk' : (cargo_type === 'PALLET' ? 'Pallet' : 'General'),
        cargo_name: cargo_name || (isBulk ? 'Hàng rời tính theo trọng tải' : 'Hàng bách hóa / Linh kiện'),
        quantity: parseInt(package_count) || 1,
        unit: package_unit || (isBulk ? 'Chuyến' : 'Kiện'),
        actual_weight_kg: actualWeight,
        length_cm: l,
        width_cm: w,
        height_cm: h,
        stackable: true,
        chargeable_weight_kg: parseFloat(finalChargeable.toFixed(2)),
        declared_value: declared_value_usd ? parseFloat(declared_value_usd) * 25000 : 0,
        special_request_note: order_notes || null
      }]);

    if (cargoErr) {
      console.error('createDirectOrder Cargo Error:', cargoErr);
    }

    // Lưu các ghi chú chi tiết
    const noteParts = [
      order_notes,
      pickup_address ? `Điểm lấy hàng: ${pickup_address}` : '',
      customer_address ? `Địa chỉ KH: ${customer_address}` : '',
      cargo_type ? `Loại hàng: ${cargo_type}` : '',
      package_unit ? `Quy cách: ${package_count || 1} ${package_unit}` : ''
    ].filter(Boolean);

    if (noteParts.length > 0) {
      await supabase.from('order_notes').insert([{
        order_id: createdOrder.id,
        content: noteParts.join(' | '),
        created_by: 1
      }]);
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