const supabase = require('../../config/supabase');
const { generateTrackingToken, getOrCreateLocation } = require('./orderHelpers');

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
      required_delivery_date,
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
    let customerId = 1;
    const cleanPhone = (customer_phone || '').replace(/[^0-9]/g, '');
    const taxCode = customer_tax_code || cleanPhone.slice(-10) || '0988123456';

    const { data: existingCust } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${customer_email || 'none@none.com'},tax_code.eq.${taxCode}`)
      .limit(1);

    if (existingCust && existingCust.length > 0) {
      customerId = existingCust[0].id;
    } else {
      const { data: newCust } = await supabase
        .from('customers')
        .insert([{
          company_name: customer_name || 'Khách hàng trực tuyến',
          tax_code: taxCode,
          registered_address: pickup_address || delivery_address || 'Hà Nội',
          email: customer_email || 'client@nexlog.vn',
          created_by: 3
        }])
        .select();
      if (newCust && newCust.length > 0) {
        customerId = newCust[0].id;
      }
    }

    // 2. Lấy hoặc tạo Location cho điểm lấy và điểm giao
    const pickupLocationId = await getOrCreateLocation({
      name: pickup_address ? (customer_name || 'Địa chỉ lấy hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: pickup_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: pickup_address ? customerId : null,
      type: pickup_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
    });

    const deliveryLocationId = await getOrCreateLocation({
      name: delivery_address ? (customer_name || 'Địa chỉ giao hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: delivery_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: delivery_address ? customerId : null,
      type: delivery_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: delivery_coords?.lat,
      lng: delivery_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
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

    // Lưu extraMeta chi tiết kèm quy trình Web Workflow & Nghiệp vụ ALS
    const extraMeta = {
      items: items && items.length > 0 ? items : null,
      customer_tax_code: taxCode,
      shipping_direction: req.body.shipping_direction || 'IMPORT',
      assigned_warehouse: req.body.assigned_warehouse || 'WH-1',
      customs_service_required: req.body.customs_service_required === true || req.body.customs_service_required === 'true',
      customs_fee: req.body.customs_fee ? parseInt(req.body.customs_fee) : (req.body.customs_service_required ? 500000 : 0),
      estimated_price: req.body.estimated_price ? parseInt(req.body.estimated_price) : 0,
      user_note: notes && notes.trim().length > 0 ? notes.trim() : null,
      // --- Thông tin nghiệp vụ từ form khách hàng ---
      required_delivery_date: required_delivery_date || null,
      loading_unloading_required: loading_unloading_required === true || loading_unloading_required === 'true',
      web_workflow: {
        stage: 'WAITING_PRICE_CONFIRMATION',
        documents: [],
        signed_contract: null
      }
    };

    // 4. Insert vào bảng orders với trạng thái WAITING_FOR_DOCUMENTS (Đơn nháp)
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        order_code: randomCode,
        order_type: 'DELIVERY',
        customer_id: customerId,
        tracking_email: customer_email || 'client@nexlog.vn',
        tracking_token: token,
        pickup_location_id: pickupLocationId,
        delivery_location_id: deliveryLocationId,
        cargo_description: finalCargoDesc,
        actual_weight_kg: actualWeight,
        length_cm: l,
        width_cm: w,
        height_cm: h,
        package_count: totalPackages,
        stackable: true,
        chargeable_weight_kg: parseFloat(chargeableWeight.toFixed(2)),
        // Ưu tiên dùng thông tin người nhận thực từ form, fallback về tên khách hàng
        receiver_name: (receiver_name && (receiver_name + '').trim()) || customer_name || 'Khách hàng trực tuyến',
        receiver_phone: (receiver_phone && (receiver_phone + '').replace(/[^0-9]/g, '')) || cleanPhone || '0988123456',
        agreed_price: 0,
        status: 'WAITING_FOR_DOCUMENTS',
        source: 'HOMEPAGE',
        responsible_dispatcher_id: 3,
        created_by: 3,
        ai_input_text: JSON.stringify(extraMeta)
      }])
      .select();

    if (orderErr) {
      console.error('createConsultationOrder Insert Error:', orderErr);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng trên Supabase', error: orderErr });
    }

    // 5. Thêm ghi chú: CHỈ thêm khi khách thực sự có nhập ghi chú thật
    if (newOrder && newOrder.length > 0 && notes && notes.trim().length > 0) {
      const orderId = newOrder[0].id;
      await supabase.from('order_notes').insert([{
        order_id: orderId,
        content: notes.trim(),
        created_by: 3
      }]);
    }

    return res.status(201).json({
      message: 'Đăng ký tư vấn thành công!',
      order: {
        id: newOrder[0].id,
        order_id: newOrder[0].order_code,
        customer_phone,
        status: 'DRAFT',
        source: 'HOMEPAGE',
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
      required_delivery_date,
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
    let customerId = 1;
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
    if (is_new_customer || customerId === 1) {
      const { data: newCust } = await supabase
        .from('customers')
        .insert([{
          company_name: customer_name || 'Khách hàng mới',
          tax_code: cleanPhone.slice(-10) || '0988123456',
          registered_address: customer_address || delivery_address || 'Hà Nội',
          email: customer_email || 'client@nexlog.vn',
          created_by: 3
        }])
        .select();
      if (newCust && newCust.length > 0) {
        customerId = newCust[0].id;
      }
    }

    // Lấy hoặc tạo Location cho điểm lấy và điểm giao
    const pickupLocationId = await getOrCreateLocation({
      name: pickup_address ? (customer_name || 'Địa chỉ lấy hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: pickup_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: pickup_address ? customerId : null,
      type: pickup_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
    });

    const deliveryLocationId = await getOrCreateLocation({
      name: delivery_address ? (customer_name || 'Địa chỉ giao hàng') : 'Nhà Ga Hàng Hóa ALS Nội Bài',
      address: delivery_address || 'Nhà Ga Hàng Hóa ALS Nội Bài',
      customerId: delivery_address ? customerId : null,
      type: delivery_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: delivery_coords?.lat,
      lng: delivery_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
    });

    // Điều phối viên tạo đơn luôn luôn là đã xác nhận chốt giá với khách (READY_FOR_PLANNING)
    // Mã đơn ban đầu: ORD-XXXXXX. Mã vận đơn thống nhất hệ thống NEX-XXXXXX chỉ sinh ra sau khi đã xếp xe nội bộ
    const orderCode = hawb_code?.trim() || `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const token = generateTrackingToken();
    const dbStatus = 'READY_FOR_PLANNING';

    const isBulk = cargo_type === 'BULK';
    const l = isBulk ? 1 : Math.max(1, parseFloat(length_cm) || 120);
    const w = isBulk ? 1 : Math.max(1, parseFloat(width_cm) || 100);
    const h = isBulk ? 1 : Math.max(1, parseFloat(height_cm) || 150);
    const actualWeight = parseFloat(weight_kg) || 1000;

    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        order_code: orderCode,
        order_type: 'DELIVERY',
        customer_id: customerId,
        tracking_email: customer_email || 'hotline@nexlog.vn',
        tracking_token: token,
        pickup_location_id: pickupLocationId,
        delivery_location_id: deliveryLocationId,
        cargo_description: cargo_name || (isBulk ? 'Hàng rời tính theo trọng tải' : 'Hàng bách hóa / Linh kiện'),
        actual_weight_kg: actualWeight,
        length_cm: l,
        width_cm: w,
        height_cm: h,
        package_count: parseInt(package_count) || 1,
        stackable: true,
        chargeable_weight_kg: isBulk ? actualWeight : (parseFloat(chargeable_weight) || actualWeight),
        receiver_name: (receiver_name && (receiver_name + '').trim()) || customer_name || 'Người nhận',
        receiver_phone: (receiver_phone && (receiver_phone + '').replace(/[^0-9]/g, '')) || cleanPhone || '0988123456',
        agreed_price: parseInt(agreed_price) || 0,
        status: dbStatus,
        responsible_dispatcher_id: 3,
        created_by: 3,
        source: (source || 'HOTLINE').slice(0, 10),
        ready_for_planning_at: dbStatus === 'READY_FOR_PLANNING' ? new Date().toISOString() : null,
        ai_input_text: JSON.stringify({
          shipping_direction: req.body.shipping_direction || 'IMPORT',
          customs_service_required: req.body.customs_service_required === true || req.body.customs_service_required === 'true',
          customs_fee: req.body.customs_fee ? parseInt(req.body.customs_fee) : (req.body.customs_service_required ? 500000 : 0),
          items: req.body.items && req.body.items.length > 0 ? req.body.items : null,
          customer_tax_code: req.body.customer_tax_code || null,
          user_note: order_notes || null,
          // --- Người liên hệ & Lịch trình ---
          required_pickup_date: required_pickup_date || null,
          vehicle_type_required: vehicle_type_required || 'TRUCK_2T',
          loading_unloading_required: loading_unloading_required === true || loading_unloading_required === 'true',
          // Tương thích ngược:
          required_delivery_date: required_delivery_date || null,
          pickup_contact_name: pickup_contact_name || null,
          pickup_contact_phone: pickup_contact_phone || null
        })
      }])
      .select();

    if (orderErr) {
      console.error('createDirectOrder Error:', orderErr);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng', error: orderErr });
    }

    // Lưu các ghi chú chi tiết về hàng hóa, quy cách, địa chỉ lấy hàng
    const noteParts = [
      order_notes,
      pickup_address ? `Điểm lấy hàng: ${pickup_address}` : '',
      customer_address ? `Địa chỉ KH: ${customer_address}` : '',
      cargo_type ? `Loại hàng: ${cargo_type}` : '',
      package_unit ? `Quy cách: ${package_count || 1} ${package_unit}` : ''
    ].filter(Boolean);

    if (noteParts.length > 0 && newOrder && newOrder.length > 0) {
      await supabase.from('order_notes').insert([{
        order_id: newOrder[0].id,
        content: noteParts.join(' | '),
        created_by: 3
      }]);
    }

    return res.status(201).json({
      message: 'Tạo đơn vận chuyển thành công!',
      order: newOrder[0]
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