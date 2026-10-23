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


module.exports = {
  mapDbStatusToFe,
  generateTrackingToken,
  getOrCreateLocation
};