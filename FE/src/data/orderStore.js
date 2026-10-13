// Quản lý dữ liệu đơn hàng liên thông giữa Homepage (Khách gửi) và Dispatcher (Điều phối xử lý)

export const INITIAL_ORDERS = [
  { 
    key: '1', 
    order_id: 'NEX-827364', 
    hawb_code: 'HNAE25090222',
    customer: 'ADTEK (VIET NAM) COMPANY LIMITED', 
    customer_phone: '0977887918',
    customer_email: 'logistics@adtek.com.vn',
    pickup: 'KCN Tiên Sơn, Bắc Ninh', 
    pickup_coords: { lat: 21.1235, lng: 105.9876 },
    dropoff: 'Kho Apex - Sân bay Nội Bài', 
    dropoff_coords: { lat: 21.2215, lng: 105.8078 },
    status: 'READY_FOR_PLANNING', 
    source: 'HOTLINE', // Cách 1: Trực tiếp qua Hotline/Zalo
    package_count: 18,
    package_unit: 'Pallet',
    cargo_name: 'Cáp quang viễn thông',
    cargo_type: 'VALUABLE',
    length_cm: 120,
    width_cm: 100,
    height_cm: 160,
    weight: 2850,
    chargeable: 2850,
    estimated_distance_km: 38.5,
    estimated_duration_mins: 45,
    agreed_price: 6500000,
    extra_fees_surcharge: 450000,
    extra_fees_collection: 1200000,
    order_notes: 'Kiểm tra niêm phong chì trước khi dỡ hàng.',
    date: '2026-10-12 08:30' 
  },
  { 
    key: '2', 
    order_id: 'NEX-827365', 
    hawb_code: 'SLVN-2026-HQ7N',
    customer: 'CÔNG TY TNHH ÂM THANH ÁNH SÁNG SLVN', 
    customer_phone: '0903456789',
    customer_email: 'import@soundlight.vn',
    pickup: 'Kho ALS Cảng HKQT Nội Bài', 
    pickup_coords: { lat: 21.2187, lng: 105.8042 },
    dropoff: 'CCN Lai Xá, Hoài Đức, Hà Nội', 
    dropoff_coords: { lat: 21.0567, lng: 105.7198 },
    status: 'CONFIRMED', 
    source: 'HOTLINE',
    package_count: 42,
    package_unit: 'Kiện thùng gỗ',
    cargo_name: 'Thiết bị âm thanh sân khấu',
    cargo_type: 'FRAGILE',
    length_cm: 200,
    width_cm: 120,
    height_cm: 150,
    weight: 1850,
    chargeable: 2160,
    estimated_distance_km: 32.4,
    estimated_duration_mins: 40,
    agreed_price: 5200000,
    extra_fees_surcharge: 300000,
    extra_fees_collection: 2450000,
    order_notes: 'Hàng thiết bị âm thanh nhập khẩu Lô 2.',
    date: '2026-10-12 09:15' 
  },
  { 
    key: '3', 
    order_id: 'NEX-827366', 
    hawb_code: 'SAM-VN-9921',
    customer: 'Samsung Electronics VN', 
    customer_phone: '0912345678',
    customer_email: 'logistics@samsung.com',
    pickup: 'Yên Phong, Bắc Ninh', 
    pickup_coords: { lat: 21.2054, lng: 105.9732 },
    dropoff: 'Kho ALS Cảng Nội Bài', 
    dropoff_coords: { lat: 21.2187, lng: 105.8042 },
    status: 'ASSIGNED', 
    source: 'HOTLINE',
    package_count: 12,
    package_unit: 'Pallet',
    cargo_name: 'Linh kiện màn hình điện thoại',
    cargo_type: 'VALUABLE',
    weight: 1200,
    chargeable: 1200,
    estimated_distance_km: 26.5,
    estimated_duration_mins: 35,
    agreed_price: 4200000,
    date: '2026-10-12 10:00' 
  },
  { 
    key: '4', 
    order_id: 'NEX-827367', 
    hawb_code: 'FOX-GL-4412',
    customer: 'Foxconn Bắc Giang', 
    customer_phone: '0988776655',
    customer_email: 'ops@foxconn.com.vn',
    pickup: 'KCN Quang Châu, Bắc Giang', 
    pickup_coords: { lat: 21.2345, lng: 106.1234 },
    dropoff: 'Cảng Hải Phòng', 
    dropoff_coords: { lat: 20.8542, lng: 106.7584 },
    status: 'IN_TRANSIT', 
    source: 'HOTLINE',
    package_count: 30,
    package_unit: 'Pallet',
    cargo_name: 'Bo mạch máy tính',
    cargo_type: 'GENERAL',
    weight: 4500,
    chargeable: 4500,
    estimated_distance_km: 88.0,
    estimated_duration_mins: 110,
    agreed_price: 7800000,
    date: '2026-10-12 10:45' 
  },
  { 
    key: '5', 
    order_id: 'NEX-827368', 
    hawb_code: 'WEB-PENDING-01',
    customer: 'CÔNG TY CP THIẾT BỊ Y TẾ MEDTECH', 
    customer_phone: '0936123456',
    customer_email: 'supply@medtech.vn',
    pickup: 'Kho ALS Cảng HKQT Nội Bài, Sóc Sơn, Hà Nội', 
    pickup_coords: { lat: 21.2187, lng: 105.8042 },
    dropoff: 'Bệnh viện Bạch Mai, Giải Phóng, Hà Nội', 
    dropoff_coords: { lat: 20.9995, lng: 105.8415 },
    status: 'DRAFT', 
    source: 'HOMEPAGE', // Cách 2: Khách gửi tư vấn qua Homepage
    package_count: 10,
    package_unit: 'Kiện gỗ',
    cargo_name: 'Máy xét nghiệm y tế nhập khẩu',
    cargo_type: 'FRAGILE',
    length_cm: 150,
    width_cm: 90,
    height_cm: 130,
    weight: 980,
    chargeable: 1050,
    estimated_distance_km: 31.5,
    estimated_duration_mins: 50,
    agreed_price: 0, // Chưa chốt giá, chờ điều phối liên hệ lại
    order_notes: 'Khách yêu cầu giao trong ngày mai, chờ điều phối viên gọi lại tư vấn báo giá.',
    date: '2026-10-13 09:30' 
  }
];

const STORAGE_KEY = 'nexlog_orders_store_v1';

export const getStoredOrders = () => {
  if (typeof window === 'undefined') return INITIAL_ORDERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading orders from localStorage', e);
    return INITIAL_ORDERS;
  }
};

export const saveStoredOrders = (orders) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving orders to localStorage', e);
  }
};

export const createConsultationOrderFromWeb = (data) => {
  const currentOrders = getStoredOrders();
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const newOrderId = `NEX-${randomNum}`;
  
  const length_cm = parseFloat(data.length_cm) || 100;
  const width_cm = parseFloat(data.width_cm) || 100;
  const height_cm = parseFloat(data.height_cm) || 100;
  const weight = parseFloat(data.weight) || 100;
  const volumeWeight = (length_cm * width_cm * height_cm) / 5000;
  const chargeable = Math.max(weight, volumeWeight);

  const newOrder = {
    key: Date.now().toString(),
    order_id: newOrderId,
    hawb_code: data.hawb_code || `WEB-${randomNum.toString().slice(-4)}`,
    customer: data.customer_name || 'Khách hàng trực tuyến',
    customer_phone: data.customer_phone || '',
    customer_email: data.customer_email || '',
    pickup: data.pickup_address || 'Chưa xác định',
    pickup_coords: data.pickup_coords || { lat: 21.0285, lng: 105.8542 },
    dropoff: data.delivery_address || 'Chưa xác định',
    dropoff_coords: data.delivery_coords || { lat: 21.2187, lng: 105.8042 },
    status: 'DRAFT',
    source: 'HOMEPAGE',
    package_count: parseInt(data.package_count) || 1,
    package_unit: data.package_unit || 'Kiện',
    cargo_name: data.cargo_name || 'Hàng bách hóa',
    cargo_type: data.cargo_type || 'GENERAL',
    length_cm,
    width_cm,
    height_cm,
    weight,
    chargeable: parseFloat(chargeable.toFixed(2)),
    estimated_distance_km: data.estimated_distance_km || 30.0,
    estimated_duration_mins: data.estimated_duration_mins || 45,
    agreed_price: 0, // Đang chờ chốt giá
    extra_fees_surcharge: 0,
    extra_fees_collection: 0,
    order_notes: data.notes || 'Khách đăng ký nhận tư vấn từ Website, điều phối cần liên hệ lại để chốt giá và thu thập hồ sơ.',
    date: new Date().toISOString().slice(0, 16).replace('T', ' ')
  };

  const updated = [newOrder, ...currentOrders];
  saveStoredOrders(updated);
  return newOrder;
};