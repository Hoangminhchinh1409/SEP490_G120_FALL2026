// Quản lý dữ liệu đơn hàng liên thông giữa Homepage (Khách gửi) và Dispatcher (Điều phối xử lý)

export const INITIAL_ORDERS = [];

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
    pickup_address: data.pickup_address || 'Chưa xác định',
    pickup_coords: data.pickup_coords || { lat: 21.0285, lng: 105.8542 },
    dropoff: data.delivery_address || 'Chưa xác định',
    delivery_address: data.delivery_address || 'Chưa xác định',
    dropoff_coords: data.delivery_coords || { lat: 21.2187, lng: 105.8042 },
    delivery_coords: data.delivery_coords || { lat: 21.2187, lng: 105.8042 },
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