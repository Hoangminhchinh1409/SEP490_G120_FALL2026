const supabase = require('../config/supabase');
const crypto = require('crypto');

// Helper map status từ DB sang FE
const mapDbStatusToFe = (dbStatus, order) => {
  switch (dbStatus) {
    case 'WAITING_FOR_DOCUMENTS':
      // Đơn nháp: Chỉ áp dụng cho đơn từ Web/Homepage chưa chốt cước hoặc agreed_price = 0
      if (order?.source === 'HOMEPAGE' && (!order?.agreed_price || order.agreed_price === 0)) {
        return 'DRAFT';
      }
      // Các đơn điều phối tự tạo hoặc đơn web đã chốt giá -> CONFIRMED (Cần kiểm duyệt chứng từ)
      return 'CONFIRMED';
    case 'READY_FOR_PLANNING':
      return 'READY_FOR_PLANNING';
    case 'PLANNED':
    case 'ASSIGNED':
    case 'ACCEPTED':
      return 'ASSIGNED';
    case 'HANDED_OVER_TO_VENDOR':
    case 'PICKED_UP':
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CLOSED':
      return 'CLOSED';
    case 'CANCELLED':
    case 'CANCELLED_RETURNING':
      return 'CANCELLED';
    default:
      return 'DRAFT';
  }
};

// Helper sinh tracking token 43 ký tự
const generateTrackingToken = () => {
  return crypto.randomBytes(32).toString('base64url').padEnd(43, 'x').slice(0, 43);
};

// Helper tìm hoặc tạo Location theo chuẩn schema mới (locations)
const getOrCreateLocation = async ({
  name,
  address,
  customerId,
  type = 'CUSTOMER_SITE',
  lat,
  lng,
  contactName,
  contactPhone
}) => {
  try {
    if (type === 'WAREHOUSE' && !address) {
      return 1;
    }

    if (address) {
      let query = supabase.from('locations').select('id').eq('address', address);
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      const { data: existing } = await query.limit(1);

      if (existing && existing.length > 0) {
        return existing[0].id;
      }
    }

    const { data: newLoc } = await supabase
      .from('locations')
      .insert([{
        name: name || address || 'Điểm giao nhận',
        type: customerId ? 'CUSTOMER_SITE' : 'WAREHOUSE',
        customer_id: customerId || null,
        address: address || 'Hà Nội',
        province_code: 'HN',
        lat: lat ? parseFloat(lat) : 21.1215,
        lng: lng ? parseFloat(lng) : 105.9754,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        created_by: 3
      }])
      .select();

    if (newLoc && newLoc.length > 0) {
      return newLoc[0].id;
    }

    return 1;
  } catch (err) {
    console.error('getOrCreateLocation error:', err);
    return 1;
  }
};

// 1. LẤY TOÀN BỘ DANH SÁCH ĐƠN HÀNG
const getAllOrders = async (req, res) => {
  try {
    const { data: dbOrders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(id, company_name, tax_code, email),
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, lat, lng, type, province_code),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, lat, lng, type, province_code),
        notes:order_notes(id, content, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders from Supabase:', error);
      return res.status(500).json({ message: 'Không thể tải danh sách đơn hàng', error });
    }

    // Map dữ liệu thành định dạng chuẩn cho giao diện Frontend
    const formattedOrders = (dbOrders || []).map(order => {
      const feStatus = mapDbStatusToFe(order.status, order);
      const isFromWeb = order.source === 'HOMEPAGE' || order.agreed_price === 0 || 
        order.notes?.some(n => n.content?.includes('Website') || n.content?.includes('Homepage'));

      const noteStr = order.notes?.map(n => n.content).join(' ') || '';
      const isBulk = noteStr.includes('Loại: BULK') || noteStr.includes('Loại hàng: BULK') || (parseFloat(order.length_cm) === 0 && parseFloat(order.width_cm) === 0);
      const isPallet = noteStr.includes('Loại: PALLET') || noteStr.includes('Loại hàng: PALLET');
      const detectedCargoType = isBulk ? 'BULK' : (isPallet ? 'PALLET' : 'GENERAL');

      return {
        key: order.id.toString(),
        id: order.id,
        order_id: order.order_code,
        hawb_code: order.order_code,
        customer: order.customer?.company_name || 'Khách hàng',
        customer_phone: order.customer?.tax_code || order.receiver_phone || '0988123456',
        customer_email: order.tracking_email || order.customer?.email || '',
        pickup: order.pickup_location?.address || order.pickup_location?.name || 'Kho ALS Cảng HKQT Nội Bài',
        pickup_address: order.pickup_location?.address || order.pickup_location?.name || 'Kho ALS Cảng HKQT Nội Bài',
        pickup_coords: {
          lat: parseFloat(order.pickup_location?.lat) || 21.2187,
          lng: parseFloat(order.pickup_location?.lng) || 105.8042
        },
        dropoff: order.delivery_location?.address || order.delivery_location?.name || (order.receiver_name ? `${order.receiver_name} - ${order.receiver_phone}` : 'KCN Tiên Sơn, Bắc Ninh'),
        delivery_address: order.delivery_location?.address || order.delivery_location?.name || 'KCN Tiên Sơn, Bắc Ninh',
        dropoff_coords: {
          lat: parseFloat(order.delivery_location?.lat) || 21.1215,
          lng: parseFloat(order.delivery_location?.lng) || 105.9754
        },
        delivery_coords: {
          lat: parseFloat(order.delivery_location?.lat) || 21.1215,
          lng: parseFloat(order.delivery_location?.lng) || 105.9754
        },
        receiver_name: order.receiver_name || '',
        receiver_phone: order.receiver_phone || '',
        status: feStatus,
        source: order.source || (isFromWeb ? 'HOMEPAGE' : 'HOTLINE'),
        package_count: order.package_count || 1,
        package_unit: isBulk ? 'Chuyến' : 'Pallet',
        cargo_name: order.cargo_description || (isBulk ? 'Hàng rời tính theo trọng tải' : 'Hàng bách hóa / Linh kiện'),
        cargo_type: detectedCargoType,
        length_cm: isBulk ? 0 : (parseFloat(order.length_cm) || 120),
        width_cm: isBulk ? 0 : (parseFloat(order.width_cm) || 100),
        height_cm: isBulk ? 0 : (parseFloat(order.height_cm) || 150),
        weight: parseFloat(order.actual_weight_kg) || 1200,
        chargeable: parseFloat(order.chargeable_weight_kg) || 1200,
        estimated_distance_km: 35.5,
        estimated_duration_mins: 45,
        agreed_price: parseInt(order.agreed_price) || 0,
        extra_fees_surcharge: 0,
        extra_fees_collection: 0,
        cancel_reason: order.cancel_reason || '',
        cancellation_reason: order.cancel_reason || '',
        cancel_fee: order.cancel_fee || 0,
        cancelled_at: order.cancelled_at || null,
        closed_at: order.closed_at || null,
        order_notes: order.notes?.[0]?.content || '',
        date: order.created_at ? new Date(order.created_at).toISOString().slice(0, 16).replace('T', ' ') : ''
      };
    });

    return res.json({ orders: formattedOrders });
  } catch (err) {
    console.error('getAllOrders Controller Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 2. KHÁCH HÀNG GỬI YÊU CẦU TƯ VẤN TỪ HOMEPAGE
const createConsultationOrder = async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
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
      notes
    } = req.body;

    // 1. Tìm hoặc tạo Customer
    let customerId = 1;
    const cleanPhone = (customer_phone || '').replace(/[^0-9]/g, '');
    const { data: existingCust } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${customer_email || 'none@none.com'},tax_code.eq.${cleanPhone || 'none'}`)
      .limit(1);

    if (existingCust && existingCust.length > 0) {
      customerId = existingCust[0].id;
    } else {
      const { data: newCust } = await supabase
        .from('customers')
        .insert([{
          company_name: customer_name || 'Khách hàng trực tuyến',
          tax_code: cleanPhone.slice(-10) || '0988123456',
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
      name: pickup_address ? `Điểm lấy - ${customer_name || 'Khách hàng'}` : 'Kho ALS Cảng HKQT Nội Bài',
      address: pickup_address || 'Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
      customerId: pickup_address ? customerId : null,
      type: pickup_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
    });

    const deliveryLocationId = await getOrCreateLocation({
      name: delivery_address ? `Điểm giao - ${customer_name || 'Khách hàng'}` : 'KCN Tiên Sơn, Bắc Ninh',
      address: delivery_address || 'KCN Tiên Sơn, Bắc Ninh',
      customerId: customerId,
      type: 'CUSTOMER_SITE',
      lat: delivery_coords?.lat,
      lng: delivery_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
    });

    // 3. Tính toán trọng lượng
    const isBulk = cargo_type === 'BULK';
    const l = isBulk ? 0 : (parseFloat(length_cm) || 120);
    const w = isBulk ? 0 : (parseFloat(width_cm) || 100);
    const h = isBulk ? 0 : (parseFloat(height_cm) || 150);
    const actualWeight = parseFloat(weight) || 1000;
    const volWeight = isBulk ? 0 : ((l * w * h) / 5000);
    const chargeableWeight = isBulk ? actualWeight : Math.max(actualWeight, volWeight);

    const randomCode = `NEX-${Math.floor(100000 + Math.random() * 900000)}`;
    const token = generateTrackingToken();

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
        cargo_description: cargo_name || (isBulk ? 'Hàng rời tính theo trọng tải' : 'Hàng bách hóa / Linh kiện'),
        actual_weight_kg: actualWeight,
        length_cm: l,
        width_cm: w,
        height_cm: h,
        package_count: parseInt(package_count) || 1,
        stackable: true,
        chargeable_weight_kg: parseFloat(chargeableWeight.toFixed(2)),
        receiver_name: customer_name || 'Khách hàng trực tuyến',
        receiver_phone: cleanPhone || '0988123456',
        agreed_price: 0,
        status: 'WAITING_FOR_DOCUMENTS',
        source: 'HOMEPAGE',
        responsible_dispatcher_id: 3,
        created_by: 3
      }])
      .select();

    if (orderErr) {
      console.error('createConsultationOrder Insert Error:', orderErr);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng trên Supabase', error: orderErr });
    }

    // 5. Thêm ghi chú nguồn đơn từ Website
    if (newOrder && newOrder.length > 0) {
      const orderId = newOrder[0].id;
      const typeDisplay = cargo_type === 'OTHER' && other_cargo_type ? `Khác: ${other_cargo_type}` : (cargo_type || 'Bách hóa');
      const unitDisplay = `${package_count || 1} ${package_unit || 'Kiện'}`;
      const noteContent = notes || `Đơn hàng nhận tư vấn từ Website (SĐT: ${customer_phone}, Hàng: ${cargo_name || 'Bách hóa'}, Quy cách: ${unitDisplay}, Loại: ${typeDisplay}, Điểm lấy: ${pickup_address || 'Chưa rõ'}). Cần liên hệ tư vấn lộ trình và chốt giá cước.`;
      
      await supabase.from('order_notes').insert([{
        order_id: orderId,
        content: noteContent,
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
        source: 'HOMEPAGE'
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
      delivery_coords
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
      name: pickup_address ? `Điểm lấy - ${customer_name || 'Khách hàng'}` : 'Kho ALS Cảng HKQT Nội Bài',
      address: pickup_address || 'Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
      customerId: pickup_address ? customerId : null,
      type: pickup_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
    });

    const deliveryLocationId = await getOrCreateLocation({
      name: delivery_address ? `Điểm giao - ${customer_name || 'Khách hàng'}` : 'KCN Tiên Sơn, Bắc Ninh',
      address: delivery_address || 'KCN Tiên Sơn, Bắc Ninh',
      customerId: customerId,
      type: 'CUSTOMER_SITE',
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
    const l = isBulk ? 0 : (parseFloat(length_cm) || 120);
    const w = isBulk ? 0 : (parseFloat(width_cm) || 100);
    const h = isBulk ? 0 : (parseFloat(height_cm) || 150);
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
        receiver_name: customer_name || 'Người nhận',
        receiver_phone: cleanPhone || '0988123456',
        agreed_price: parseInt(agreed_price) || 0,
        status: dbStatus,
        responsible_dispatcher_id: 3,
        created_by: 3,
        source: (source || 'HOTLINE').slice(0, 10),
        ready_for_planning_at: dbStatus === 'READY_FOR_PLANNING' ? new Date().toISOString() : null
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

// 4. CẬP NHẬT GIÁ CƯỚC THỎA THUẬN (Chỉ cho phép khi chưa xác nhận đơn / DRAFT)
const updateAgreedPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price } = req.body;

    const numPrice = parseInt(agreed_price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ message: 'Giá cước không hợp lệ (phải > 0 VNĐ)' });
    }

    // Kiểm tra đơn hàng hiện tại
    let findQuery = supabase.from('orders').select('id, status, agreed_price, cancel_reason');
    if (/^\d+$/.test(id)) {
      findQuery = findQuery.eq('id', parseInt(id));
    } else {
      findQuery = findQuery.eq('order_code', id);
    }
    const { data: currentOrderList } = await findQuery;
    const currentOrder = currentOrderList?.[0];

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    if (currentOrder.status === 'CLOSED' || currentOrder.status === 'CANCELLED' || currentOrder.cancel_reason) {
      return res.status(400).json({ message: 'Đơn hàng đã bị hủy hoặc đã đóng, không thể sửa giá cước!' });
    }

    if (!['WAITING_FOR_DOCUMENTS'].includes(currentOrder.status)) {
      return res.status(400).json({ message: 'Đơn hàng đã được xác nhận và chốt giá, không thể sửa lại giá cước!' });
    }

    // Match theo id số hoặc order_code
    let query = supabase.from('orders').update({ 
      agreed_price: numPrice,
      updated_at: new Date().toISOString()
    });
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('updateAgreedPrice Error:', error);
      return res.status(500).json({ message: 'Không thể cập nhật giá cước', error });
    }

    return res.json({ message: 'Cập nhật giá thỏa thuận thành công!', order: data?.[0] });
  } catch (err) {
    console.error('updateAgreedPrice Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 5. XÁC NHẬN ĐƠN HÀNG (CHUYỂN SANG READY_FOR_PLANNING)
const confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price } = req.body;

    const updates = {
      status: 'READY_FOR_PLANNING',
      ready_for_planning_at: new Date().toISOString(),
      docs_confirmed_at: new Date().toISOString(),
      docs_confirmed_by: 3,
      updated_at: new Date().toISOString()
    };

    if (agreed_price && parseInt(agreed_price) > 0) {
      updates.agreed_price = parseInt(agreed_price);
    }

    let query = supabase.from('orders').update(updates);
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('confirmOrder Error:', error);
      return res.status(500).json({ message: 'Không thể xác nhận đơn hàng', error });
    }

    return res.json({
      message: 'Đã xác nhận đơn hàng thành công! Đơn đã sẵn sàng để xếp xe.',
      order: data?.[0]
    });
  } catch (err) {
    console.error('confirmOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 6. GÁN XE VÀ TÀI XẾ CHO ĐƠN HÀNG (CHUYỂN SANG ASSIGNED)
const assignTrip = async (req, res) => {
  try {
    const { id } = req.params;

    let query = supabase.from('orders').update({
      status: 'ASSIGNED',
      updated_at: new Date().toISOString()
    });

    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('assignTrip Error:', error);
      return res.status(500).json({ message: 'Không thể gán xe cho đơn', error });
    }

    return res.json({ message: 'Đã gán xe thành công!', order: data?.[0] });
  } catch (err) {
    console.error('assignTrip Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 7. HỦY ĐƠN HÀNG (CHUYỂN SANG CANCELLED)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason, cancellation_fee } = req.body;

    const updates = {
      status: 'CLOSED', // Hủy đơn là tự động đóng đơn luôn
      cancel_reason: cancellation_reason || null,
      cancel_fee: cancellation_fee ? parseInt(cancellation_fee) : 0,
      cancelled_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let query = supabase.from('orders').update(updates);
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.warn('cancelOrder note (will fallback):', error.message);
    }

    return res.json({
      message: 'Đã hủy và tự động đóng đơn hàng thành công!',
      order: {
        ...(data?.[0] || { id }),
        status: 'CLOSED',
        cancellation_reason,
        cancellation_fee
      }
    });
  } catch (err) {
    console.error('cancelOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 8. ĐÓNG ĐƠN HÀNG (CHUYỂN SANG CLOSED)
const closeOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const updates = {
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let query = supabase.from('orders').update(updates);
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.warn('closeOrder note (will fallback):', error.message);
    }

    return res.json({
      message: 'Đã đóng đơn hàng thành công!',
      order: {
        ...(data?.[0] || { id }),
        status: 'CLOSED'
      }
    });
  } catch (err) {
    console.error('closeOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  getAllOrders,
  createConsultationOrder,
  createDirectOrder,
  updateAgreedPrice,
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder
};
