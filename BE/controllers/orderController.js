const supabase = require('../config/supabase');
const crypto = require('crypto');
const { sendOrderPriceConfirmationEmail, sendContractSigningEmail } = require('../services/emailService');

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
    const cleanAddr = (address || '').trim();

    // 1. Kiểm tra xem địa chỉ này có thuộc kho / ga ALS có sẵn không
    const cleanAddrLower = cleanAddr.toLowerCase();
    if (cleanAddrLower.includes('kho hàng không kéo dài als') || cleanAddrLower.includes('als nội bài') || cleanAddrLower.includes('cảng hkqt nội bài')) {
      const { data: alsNb } = await supabase.from('locations').select('id').eq('id', 1).limit(1);
      if (alsNb && alsNb.length > 0) return alsNb[0].id;
    }
    if (cleanAddrLower.includes('als bắc ninh') || (cleanAddrLower.includes('yên phong') && cleanAddrLower.includes('als'))) {
      const { data: alsBn } = await supabase.from('locations').select('id').eq('id', 2).limit(1);
      if (alsBn && alsBn.length > 0) return alsBn[0].id;
    }
    if (cleanAddrLower.includes('als thái nguyên') || (cleanAddrLower.includes('yên bình') && cleanAddrLower.includes('als'))) {
      const { data: alsTn } = await supabase.from('locations').select('id').eq('id', 3).limit(1);
      if (alsTn && alsTn.length > 0) return alsTn[0].id;
    }
    if (cleanAddrLower.includes('als hải phòng') || (cleanAddrLower.includes('nam cầu kiền') && cleanAddrLower.includes('als'))) {
      const { data: alsHp } = await supabase.from('locations').select('id').eq('id', 4).limit(1);
      if (alsHp && alsHp.length > 0) return alsHp[0].id;
    }

    // 2. Kiểm tra xem địa chỉ này đã tồn tại trong database chưa (tránh nhân bản điểm)
    if (cleanAddr) {
      // Ưu tiên trùng địa chỉ của cùng khách hàng hoặc trùng chính xác địa chỉ
      let query = supabase.from('locations').select('id, name, customer_id').eq('address', cleanAddr);
      if (customerId) {
        query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);
      }
      const { data: existing } = await query.limit(1);

      if (existing && existing.length > 0) {
        return existing[0].id;
      }
    }

    // 3. Nếu chưa có, tạo địa điểm mới với thông tin chuẩn
    const fallbackName = name ? name.replace(/^Điểm (lấy|giao)\s*-\s*/i, '').trim() : (cleanAddr || 'Điểm giao nhận');

    const { data: newLoc } = await supabase
      .from('locations')
      .insert([{
        name: fallbackName,
        type: customerId ? 'CUSTOMER_SITE' : 'WAREHOUSE',
        customer_id: customerId || null,
        address: cleanAddr || 'Hà Nội',
        province_code: 'HN',
        lat: lat ? parseFloat(lat) : 21.0285,
        lng: lng ? parseFloat(lng) : 105.8542,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        radius_m: 200,
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
        order_notes: (order.notes && order.notes.length > 0 && !order.notes[0]?.content?.includes('Đơn hàng nhận tư vấn từ Website')) 
          ? order.notes[0].content 
          : '',
        date: order.created_at ? new Date(order.created_at).toISOString().slice(0, 16).replace('T', ' ') : '',
        tracking_token: order.tracking_token,
        customer_tax_code: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return meta.customer_tax_code || order.customer?.tax_code || '';
          } catch (e) {
            return order.customer?.tax_code || '';
          }
        })(),
        items: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return meta.items || null;
          } catch (e) {
            return null;
          }
        })(),
        web_workflow: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return meta.web_workflow || null;
          } catch (e) {
            return null;
          }
        })(),
        contract_uploaded: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return !!(meta.contract_uploaded || meta.contract_file || meta.web_workflow?.signed_contract);
          } catch (e) {
            return false;
          }
        })(),
        contract_file: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return meta.contract_file || meta.web_workflow?.signed_contract?.contract_file || null;
          } catch (e) {
            return null;
          }
        })(),
        contract_file_data: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return meta.contract_file_data || null;
          } catch (e) {
            return null;
          }
        })(),
        contract_uploaded_at: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return meta.contract_uploaded_at || meta.web_workflow?.signed_contract?.signed_at || null;
          } catch (e) {
            return null;
          }
        })(),
        documents: (() => {
          try {
            const meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
            return meta.documents || meta.web_workflow?.approved_documents || meta.web_workflow?.documents || null;
          } catch (e) {
            return null;
          }
        })()
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
      notes
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
      name: customer_name ? `${customer_name} (Điểm gửi)` : 'Kho ALS Cảng HKQT Nội Bài',
      address: pickup_address || 'Kho Hàng không Kéo dài ALS, Cảng HKQT Nội Bài, Xã Phú Minh, Sóc Sơn, Hà Nội',
      customerId: pickup_address ? customerId : null,
      type: pickup_address ? 'CUSTOMER_SITE' : 'WAREHOUSE',
      lat: pickup_coords?.lat,
      lng: pickup_coords?.lng,
      contactName: customer_name,
      contactPhone: cleanPhone
    });

    const deliveryLocationId = await getOrCreateLocation({
      name: customer_name ? `${customer_name} (Điểm nhận)` : 'Ga Hàng hóa Kéo dài ALS Bắc Ninh',
      address: delivery_address || 'Lô CN05, Đường YP6, KCN Yên Phong, Xã Đông Phong, Huyện Yên Phong, Bắc Ninh',
      customerId: customerId,
      type: 'CUSTOMER_SITE',
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
      l = items[0]?.length_cm || 0;
      w = items[0]?.width_cm || 0;
      h = items[0]?.height_cm || 0;
    } else {
      const isBulk = cargo_type === 'BULK';
      l = isBulk ? 0 : (parseFloat(length_cm) || 120);
      w = isBulk ? 0 : (parseFloat(width_cm) || 100);
      h = isBulk ? 0 : (parseFloat(height_cm) || 150);
      actualWeight = actualWeight || 1000;
      const volWeight = isBulk ? 0 : ((l * w * h) / 5000);
      chargeableWeight = isBulk ? actualWeight : Math.max(actualWeight, volWeight);
    }

    const randomCode = `NEX-${Math.floor(100000 + Math.random() * 900000)}`;
    const token = generateTrackingToken();

    // Lưu extraMeta chi tiết kèm quy trình Web Workflow
    const extraMeta = {
      items: items && items.length > 0 ? items : null,
      customer_tax_code: taxCode,
      user_note: notes && notes.trim().length > 0 ? notes.trim() : null,
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
        receiver_name: customer_name || 'Khách hàng trực tuyến',
        receiver_phone: cleanPhone || '0988123456',
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
        ready_for_planning_at: dbStatus === 'READY_FOR_PLANNING' ? new Date().toISOString() : null,
        ai_input_text: JSON.stringify({
          items: req.body.items && req.body.items.length > 0 ? req.body.items : null,
          customer_tax_code: req.body.customer_tax_code || null,
          user_note: order_notes || null
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

// 4. CẬP NHẬT GIÁ CƯỚC THỎA THUẬN (VÀ TỰ ĐỘNG GỬI EMAIL XÁC NHẬN CHO KHÁCH HÀNG NẾU LÀ ĐƠN WEB)
const updateAgreedPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price } = req.body;

    const numPrice = parseInt(agreed_price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ message: 'Giá cước không hợp lệ (phải > 0 VNĐ)' });
    }

    // Kiểm tra đơn hàng hiện tại
    let findQuery = supabase.from('orders').select(`
      id, 
      order_code, 
      status, 
      agreed_price, 
      cancel_reason, 
      source, 
      tracking_email, 
      tracking_token,
      cargo_description,
      ai_input_text,
      customer:customers(company_name, email, tax_code),
      pickup_location:locations!orders_pickup_location_id_fkey(name, address),
      delivery_location:locations!orders_delivery_location_id_fkey(name, address)
    `);

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

    // Cập nhật meta workflow
    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) {
      meta.web_workflow = {};
    }
    meta.web_workflow.stage = 'PRICE_AGREED_BY_DISPATCHER';
    meta.web_workflow.agreed_price = numPrice;

    // Cập nhật giá thỏa thuận vào DB
    let query = supabase.from('orders').update({ 
      agreed_price: numPrice,
      ai_input_text: JSON.stringify(meta),
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

    // NẾU LÀ ĐƠN TỪ WEB (HOMEPAGE) -> TỰ ĐỘNG GỬI GMAIL CHO KHÁCH KÈM LINK XÁC NHẬN
    const isWebOrder = currentOrder.source === 'HOMEPAGE';
    const targetEmail = currentOrder.tracking_email || currentOrder.customer?.email;

    if (isWebOrder && targetEmail) {
      const token = currentOrder.tracking_token;
      const confirmUrl = `http://localhost:3000/customer/order-confirmation/${token}`;
      
      sendOrderPriceConfirmationEmail({
        customerEmail: targetEmail,
        customerName: currentOrder.customer?.company_name || 'Quý khách',
        orderCode: currentOrder.order_code,
        agreedPrice: numPrice,
        pickupAddress: currentOrder.pickup_location?.address || currentOrder.pickup_location?.name || 'Hà Nội',
        deliveryAddress: currentOrder.delivery_location?.address || currentOrder.delivery_location?.name || 'Bắc Ninh',
        cargoDescription: currentOrder.cargo_description,
        confirmUrl
      }).catch(err => console.error('Auto-email error:', err));
    }

    return res.json({ 
      message: isWebOrder 
        ? `Đã chốt giá ${numPrice.toLocaleString()} VNĐ và tự động gửi email xác nhận kèm link tới khách hàng!` 
        : 'Cập nhật giá thỏa thuận thành công!', 
      order: data?.[0] 
    });
  } catch (err) {
    console.error('updateAgreedPrice Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.1. API CHO KHÁCH HÀNG: LẤY CHI TIẾT ĐƠN HÀNG QUA TRACKING TOKEN (PUBLIC)
const getOrderByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: 'Thiếu tracking token' });
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(id, company_name, tax_code, email),
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, lat, lng),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, lat, lng),
        notes:order_notes(id, content, created_at)
      `)
      .eq('tracking_token', token)
      .limit(1);

    if (error || !orders || orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng tương ứng với mã token này' });
    }

    const order = orders[0];
    let extraMeta = {};
    try {
      extraMeta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
    } catch (e) {
      extraMeta = {};
    }

    return res.json({
      order: {
        id: order.id,
        order_code: order.order_code,
        customer_name: order.customer?.company_name || order.receiver_name,
        customer_email: order.tracking_email || order.customer?.email,
        customer_phone: order.receiver_phone,
        customer_tax_code: extraMeta.customer_tax_code || order.customer?.tax_code,
        agreed_price: order.agreed_price || 0,
        cargo_description: order.cargo_description,
        package_count: order.package_count,
        actual_weight_kg: order.actual_weight_kg,
        chargeable_weight_kg: order.chargeable_weight_kg,
        pickup_address: order.pickup_location?.address || 'Hà Nội',
        delivery_address: order.delivery_location?.address || 'Bắc Ninh',
        status: order.status,
        source: order.source,
        tracking_token: order.tracking_token,
        web_workflow: extraMeta.web_workflow || { stage: 'WAITING_PRICE_CONFIRMATION' },
        items: extraMeta.items || null,
        user_note: extraMeta.user_note || null
      }
    });
  } catch (err) {
    console.error('getOrderByToken Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.2. API CHO KHÁCH HÀNG: ĐỒNG Ý CHỐT ĐƠN VÀ GIÁ CƯỚC (CHUYỂN SANG BƯỚC UPLOAD CHỨNG TỪ)
const customerAgreeOrderPrice = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_code, ai_input_text, agreed_price')
      .eq('tracking_token', token)
      .limit(1);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    let meta = {};
    try {
      meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'CUSTOMER_CONFIRMED';
    meta.web_workflow.customer_confirmed_at = new Date().toISOString();

    await supabase
      .from('orders')
      .update({
        ai_input_text: JSON.stringify(meta),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return res.json({
      message: 'Quý khách đã đồng ý chốt đơn hàng! Vui lòng hoàn tất nộp chứng từ.',
      next_url: `/customer/order-documents/${token}`
    });
  } catch (err) {
    console.error('customerAgreeOrderPrice Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.3. API CHO KHÁCH HÀNG: UPLOAD CHỨNG TỪ THEO LOẠI HÀNG ĐÃ TẠO
const customerUploadDocuments = async (req, res) => {
  try {
    const { token } = req.params;
    const { documents } = req.body;

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_code, ai_input_text')
      .eq('tracking_token', token)
      .limit(1);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    let meta = {};
    try {
      meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'DOCS_UPLOADED';
    meta.web_workflow.documents = documents || [];
    meta.web_workflow.docs_uploaded_at = new Date().toISOString();

    await supabase
      .from('orders')
      .update({
        ai_input_text: JSON.stringify(meta),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return res.json({
      message: 'Tải lên chứng từ thành công! Hồ sơ đang được Điều phối viên kiểm duyệt.',
      status: 'PENDING_DISPATCHER_REVIEW'
    });
  } catch (err) {
    console.error('customerUploadDocuments Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.4. ĐIỀU PHỐI VIÊN PHÊ DUYỆT CHỨNG TỪ (ĐỐI VỚI ĐƠN WEB) -> TỰ ĐỘNG GỬI EMAIL KÈM HỢP ĐỒNG & LINK KÝ CHỮ KÝ SỐ
const approveWebOrderDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_documents } = req.body;

    let findQuery = supabase
      .from('orders')
      .select(`
        id, 
        order_code, 
        status, 
        agreed_price, 
        source, 
        tracking_email, 
        tracking_token,
        ai_input_text,
        customer:customers(company_name, email)
      `);

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

    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'DOCS_APPROVED';
    meta.web_workflow.approved_documents = approved_documents || meta.web_workflow.documents;
    meta.web_workflow.docs_approved_at = new Date().toISOString();

    await supabase
      .from('orders')
      .update({
        ai_input_text: JSON.stringify(meta),
        docs_confirmed_at: new Date().toISOString(),
        docs_confirmed_by: 3,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentOrder.id);

    // Gửi email hợp đồng và link ký số cho khách hàng
    const targetEmail = currentOrder.tracking_email || currentOrder.customer?.email;
    const token = currentOrder.tracking_token;
    const contractSignUrl = `http://localhost:3000/customer/contract-sign/${token}`;

    if (targetEmail) {
      sendContractSigningEmail({
        customerEmail: targetEmail,
        customerName: currentOrder.customer?.company_name || 'Quý khách',
        orderCode: currentOrder.order_code,
        agreedPrice: currentOrder.agreed_price,
        contractSignUrl
      }).catch(err => console.error('Contract email error:', err));
    }

    return res.json({
      message: 'Đã duyệt hồ sơ chứng từ! Hệ thống đã tự động gửi hợp đồng điện tử và link ký số qua email khách hàng.',
      stage: 'DOCS_APPROVED',
      contractSignUrl
    });
  } catch (err) {
    console.error('approveWebOrderDocuments Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.5. KHÁCH HÀNG KÝ CHỮ KÝ SỐ VÀ LƯU HỢP ĐỒNG ĐÃ KÝ VÀO HỒ SƠ ĐIỀU PHỐI -> CHUYỂN SANG READY_FOR_PLANNING (XẾP XE)
const customerSignContract = async (req, res) => {
  try {
    const { token } = req.params;
    const { signature_data, signer_name } = req.body;

    if (!signature_data) {
      return res.status(400).json({ message: 'Vui lòng cung cấp chữ ký điện tử' });
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_code, agreed_price, ai_input_text')
      .eq('tracking_token', token)
      .limit(1);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    let meta = {};
    try {
      meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'CONTRACT_SIGNED';
    meta.web_workflow.signed_contract = {
      signed_at: new Date().toISOString(),
      signer_name: signer_name || 'Đại diện Khách hàng',
      signature_data: signature_data,
      contract_file: `HD-${order.order_code}-SIGNED.pdf`
    };

    // Tự động chuyển trạng thái đơn hàng sang READY_FOR_PLANNING để tiến hành xếp xe
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({
        status: 'READY_FOR_PLANNING',
        ready_for_planning_at: new Date().toISOString(),
        ai_input_text: JSON.stringify(meta),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .select();

    if (error) {
      console.error('customerSignContract Update Error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật hợp đồng' });
    }

    return res.json({
      message: 'Ký số hợp đồng thành công! Đơn hàng đã hoàn tất thủ tục và chuyển sang công đoạn Xếp xe.',
      order: updatedOrder?.[0],
      stage: 'CONTRACT_SIGNED'
    });
  } catch (err) {
    console.error('customerSignContract Error:', err);
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

// 9. ĐIỀU PHỐI VIÊN TẢI TỆP HỢP ĐỒNG ĐÃ KÝ THẬT VÀO HỒ SƠ ĐƠN HÀNG
const uploadContractFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_name, file_data, file_size } = req.body;

    if (!file_name) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tên tệp hợp đồng' });
    }

    let findQuery = supabase
      .from('orders')
      .select('id, order_code, status, ai_input_text');

    if (/^\d+$/.test(id)) {
      findQuery = findQuery.eq('id', parseInt(id));
    } else {
      findQuery = findQuery.eq('order_code', id);
    }

    const { data: currentOrders, error: findError } = await findQuery;
    const currentOrder = currentOrders?.[0];

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    const nowIso = new Date().toISOString();
    meta.contract_uploaded = true;
    meta.contract_file = file_name;
    meta.contract_file_size = file_size || '-';
    meta.contract_uploaded_at = nowIso;
    if (file_data) {
      meta.contract_file_data = file_data; // Base64 url hoặc đường dẫn
    }

    // Nếu đơn hàng đang ở trạng thái DRAFT hoặc PENDING, có thể cập nhật thời gian hoàn tất hồ sơ
    const updates = {
      ai_input_text: JSON.stringify(meta),
      updated_at: nowIso
    };

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', currentOrder.id)
      .select();

    if (updateError) {
      console.error('uploadContractFile update error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật tệp hợp đồng vào CSDL', error: updateError });
    }

    return res.json({
      message: `Đã lưu tệp hợp đồng [${file_name}] vào hồ sơ đơn hàng thành công!`,
      contract_file: file_name,
      contract_uploaded: true,
      contract_uploaded_at: nowIso,
      order: updatedOrders?.[0]
    });
  } catch (err) {
    console.error('uploadContractFile Exception:', err);
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
  closeOrder,
  getOrderByToken,
  customerAgreeOrderPrice,
  customerUploadDocuments,
  approveWebOrderDocuments,
  customerSignContract,
  uploadContractFile
};
