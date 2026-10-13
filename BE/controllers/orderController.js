const supabase = require('../config/supabase');
const crypto = require('crypto');

// Helper map status từ DB sang FE
const mapDbStatusToFe = (dbStatus) => {
  switch (dbStatus) {
    case 'WAITING_FOR_DOCUMENTS':
      return 'DRAFT';
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
    case 'CLOSED':
      return 'DELIVERED';
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

// 1. LẤY TOÀN BỘ DANH SÁCH ĐƠN HÀNG
const getAllOrders = async (req, res) => {
  try {
    const { data: dbOrders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(id, company_name, tax_code, email),
        pickup_warehouse:warehouses(id, name, address, lat, lng),
        notes:order_notes(id, content, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders from Supabase:', error);
      return res.status(500).json({ message: 'Không thể tải danh sách đơn hàng', error });
    }

    // Map dữ liệu thành định dạng chuẩn cho giao diện Frontend
    const formattedOrders = (dbOrders || []).map(order => {
      const feStatus = mapDbStatusToFe(order.status);
      const isFromWeb = order.agreed_price === 0 || 
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
        customer: order.customer?.company_name || 'Khách hàng trực tuyến',
        customer_phone: order.customer?.tax_code || '0988123456',
        customer_email: order.tracking_email || order.customer?.email || '',
        pickup: order.pickup_warehouse 
          ? `${order.pickup_warehouse.name} - ${order.pickup_warehouse.address}` 
          : 'Kho ALS Cảng HKQT Nội Bài',
        pickup_coords: {
          lat: parseFloat(order.pickup_warehouse?.lat) || 21.2187,
          lng: parseFloat(order.pickup_warehouse?.lng) || 105.8042
        },
        dropoff: order.delivery_address || 'KCN Tiên Sơn, Bắc Ninh',
        status: feStatus,
        source: isFromWeb ? 'HOMEPAGE' : 'HOTLINE',
        package_count: 1,
        package_unit: isBulk ? 'Chuyến' : 'Pallet',
        cargo_name: isBulk ? 'Hàng rời tính theo trọng tải' : 'Hàng bách hóa / Linh kiện',
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
          registered_address: pickup_address || delivery_address || 'Việt Nam',
          email: customer_email || 'client@nexlog.vn',
          created_by: 3
        }])
        .select();
      if (newCust && newCust.length > 0) {
        customerId = newCust[0].id;
      }
    }

    // 2. Lấy hoặc tạo Pickup Warehouse
    let warehouseId = 1;
    const { data: whList } = await supabase.from('warehouses').select('id').limit(1);
    if (whList && whList.length > 0) {
      warehouseId = whList[0].id;
    }

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
        customer_id: customerId,
        tracking_email: customer_email || 'client@nexlog.vn',
        tracking_token: token,
        actual_weight_kg: actualWeight,
        length_cm: l,
        width_cm: w,
        height_cm: h,
        stackable: true,
        chargeable_weight_kg: parseFloat(chargeableWeight.toFixed(2)),
        agreed_price: 0, // Chờ điều phối liên hệ chốt giá
        pickup_warehouse_id: warehouseId,
        delivery_address: delivery_address || 'Địa chỉ giao hàng',
        delivery_province: 'Hà Nội',
        status: 'WAITING_FOR_DOCUMENTS',
        responsible_dispatcher_id: 3
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
      status
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
          registered_address: customer_address || delivery_address || 'Việt Nam',
          email: customer_email || 'client@nexlog.vn',
          created_by: 3
        }])
        .select();
      if (newCust && newCust.length > 0) {
        customerId = newCust[0].id;
      }
    }

    let warehouseId = 1;
    const { data: whList } = await supabase.from('warehouses').select('id').limit(1);
    if (whList && whList.length > 0) {
      warehouseId = whList[0].id;
    }

    // Mã vận đơn: nếu không nhập thì tự động sinh
    const orderCode = hawb_code?.trim() || `NEX-${Math.floor(100000 + Math.random() * 900000)}`;
    const token = generateTrackingToken();
    const dbStatus = (status === 'DRAFT') ? 'WAITING_FOR_DOCUMENTS' : 'READY_FOR_PLANNING';

    const isBulk = cargo_type === 'BULK';
    const l = isBulk ? 0 : (parseFloat(length_cm) || 120);
    const w = isBulk ? 0 : (parseFloat(width_cm) || 100);
    const h = isBulk ? 0 : (parseFloat(height_cm) || 150);
    const actualWeight = parseFloat(weight_kg) || 1000;

    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        order_code: orderCode,
        customer_id: customerId,
        tracking_email: customer_email || 'hotline@nexlog.vn',
        tracking_token: token,
        actual_weight_kg: actualWeight,
        length_cm: l,
        width_cm: w,
        height_cm: h,
        stackable: true,
        chargeable_weight_kg: isBulk ? actualWeight : (parseFloat(chargeable_weight) || actualWeight),
        agreed_price: parseInt(agreed_price) || 0,
        pickup_warehouse_id: warehouseId,
        delivery_address: delivery_address || 'Hà Nội',
        delivery_province: 'Hà Nội',
        status: dbStatus,
        responsible_dispatcher_id: 3,
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

// 4. CẬP NHẬT GIÁ CƯỚC THỎA THUẬN
const updateAgreedPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price } = req.body;

    const numPrice = parseInt(agreed_price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ message: 'Giá cước không hợp lệ' });
    }

    // Match theo id số hoặc order_code
    let query = supabase.from('orders').update({ agreed_price: numPrice });
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
      docs_confirmed_by: 3
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

module.exports = {
  getAllOrders,
  createConsultationOrder,
  createDirectOrder,
  updateAgreedPrice,
  confirmOrder,
  assignTrip
};
