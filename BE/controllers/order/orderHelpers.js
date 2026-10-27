const supabase = require('../../config/supabase');
const crypto = require('crypto');

// Helper map status từ DB sang FE
const mapDbStatusToFe = (dbStatus, order) => {
  // Nếu đơn hàng đã có ngày hủy hoặc có lý do hủy thì chắc chắn là CANCELLED
  if (dbStatus === 'CANCELLED' || dbStatus === 'CANCELLED_RETURNING' || (order?.cancelled_at && order?.cancel_reason)) {
    return 'CANCELLED';
  }

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
  contactPhone,
  isNewCustomer = false
}) => {
  try {
    const cleanAddr = (address || '').trim();

    // 1. Kiểm tra xem địa chỉ này có thuộc kho / ga ALS có sẵn không
    const cleanAddrLower = cleanAddr.toLowerCase();
    if (
      cleanAddrLower.includes('nhà ga hàng hóa als nội bài') ||
      cleanAddrLower.includes('ga hàng hóa als') ||
      cleanAddrLower.includes('kho hàng không kéo dài als') ||
      cleanAddrLower.includes('als nội bài') ||
      cleanAddrLower.includes('cảng hkqt nội bài')
    ) {
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

    // 3. Nếu chưa có:
    // Theo nghiệp vụ: Chỉ lưu địa điểm vào bảng locations đối với khách hàng mới (isNewCustomer = true).
    // Nếu là khách hàng cũ tạo đơn có địa điểm giao nhận lẻ/tạm thời thì không tự động lưu vào danh bạ điểm giao nhận,
    // mà liên kết tạm về kho mặc định 1 để tránh làm tràn danh bạ địa điểm.
    if (!isNewCustomer) {
      return 1;
    }

    let cleanName = (name || '').trim();
    cleanName = cleanName
      .replace(/^Điểm (lấy|giao)\s*-\s*/i, '')
      .replace(/\s*\((Điểm gửi|Điểm nhận|Điểm lấy|Điểm giao)\)/gi, '')
      .trim();

    const fallbackName = cleanName || (cleanAddr || 'Địa chỉ khách hàng');

    const { data: newLoc } = await supabase
      .from('locations')
      .insert([{
        name: fallbackName,
        type: customerId ? 'Customer Site' : 'Warehouse',
        customer_id: customerId || null,
        address: cleanAddr || 'Hà Nội',
        province: 'Hà Nội',
        latitude: lat ? parseFloat(lat) : 21.0285,
        longitude: lng ? parseFloat(lng) : 105.8542,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        geofence_radius: 200,
        created_by: 1
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


const META_NOTE_PREFIX = '[META_JSON]:';

// Đọc metadata từ order (ưu tiên ai_input_text nếu có, hoặc lấy từ order_notes có prefix [META_JSON]:)
const parseOrderMeta = (order) => {
  if (!order) return {};
  if (order.ai_input_text) {
    try {
      return JSON.parse(order.ai_input_text);
    } catch (e) {
      // ignore
    }
  }
  if (Array.isArray(order.order_notes)) {
    const metaNote = [...order.order_notes]
      .reverse()
      .find((n) => typeof n?.content === 'string' && n.content.startsWith(META_NOTE_PREFIX));
    if (metaNote) {
      try {
        return JSON.parse(metaNote.content.slice(META_NOTE_PREFIX.length));
      } catch (e) {
        // ignore
      }
    }
  }
  return {};
};

// Tải metadata từ DB theo orderId (nếu chưa join sẵn order_notes)
const loadOrderMeta = async (orderId, orderObj = null) => {
  const fromObj = parseOrderMeta(orderObj);
  if (Object.keys(fromObj).length > 0) return fromObj;

  if (!orderId) return {};
  try {
    const { data: notes } = await supabase
      .from('order_notes')
      .select('id, content')
      .eq('order_id', orderId)
      .like('content', `${META_NOTE_PREFIX}%`)
      .order('id', { ascending: false })
      .limit(1);

    if (notes && notes.length > 0) {
      return JSON.parse(notes[0].content.slice(META_NOTE_PREFIX.length));
    }
  } catch (e) {
    // ignore
  }
  return {};
};

// Lưu metadata vào order_notes (tương thích hoàn toàn khi bảng orders chưa có cột ai_input_text)
const saveOrderMeta = async (orderId, meta) => {
  if (!orderId || !meta) return;
  const content = `${META_NOTE_PREFIX}${JSON.stringify(meta)}`;
  try {
    const { data: existing } = await supabase
      .from('order_notes')
      .select('id')
      .eq('order_id', orderId)
      .like('content', `${META_NOTE_PREFIX}%`)
      .order('id', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('order_notes')
        .update({ content })
        .eq('id', existing[0].id);
    } else {
      await supabase
        .from('order_notes')
        .insert([{ order_id: orderId, content, created_by: 1 }]);
    }
  } catch (err) {
    console.warn('saveOrderMeta warning:', err.message);
  }
};

module.exports = {
  META_NOTE_PREFIX,
  mapDbStatusToFe,
  generateTrackingToken,
  getOrCreateLocation,
  parseOrderMeta,
  loadOrderMeta,
  saveOrderMeta
};