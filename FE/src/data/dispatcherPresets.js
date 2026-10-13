// Danh mục chuẩn hóa địa điểm và dữ liệu mẫu
export const POPULAR_LOCATIONS = [
  {
    id: 'LOC-ALS-NB',
    name: 'Kho ALS Nội Bài',
    address: 'Kho Hàng không Kéo dài ALS, Cảng HKQT Nội Bài, Sóc Sơn, Hà Nội',
    lat: 21.2187,
    lng: 105.8042,
    type: 'KHO_NGOAI_QUAN'
  },
  {
    id: 'LOC-TIEN-SON',
    name: 'Nhà máy ADTEK - KCN Tiên Sơn',
    address: 'Đường TS8, KCN Tiên Sơn, Phường Đồng Nguyên, TP. Từ Sơn, Bắc Ninh',
    lat: 21.1235,
    lng: 105.9876,
    type: 'NHA_MAY'
  },
  {
    id: 'LOC-APEX-NCTS',
    name: 'Kho Apex Logistics - Ga NCTS',
    address: 'Ga NCTS Sân bay Nội Bài, Sóc Sơn, Hà Nội',
    lat: 21.2215,
    lng: 105.8078,
    type: 'GA_HANG_HOA'
  },
  {
    id: 'LOC-LAI-XA',
    name: 'CCN Lai Xá - Hoài Đức',
    address: 'Cụm Công nghiệp Lai Xá, Kim Chung, Hoài Đức, Hà Nội',
    lat: 21.0567,
    lng: 105.7198,
    type: 'CUM_CONG_NGHIEP'
  },
  {
    id: 'LOC-YEN-PHONG',
    name: 'Samsung Electronics - KCN Yên Phong',
    address: 'KCN Yên Phong, Yên Trung, Yên Phong, Bắc Ninh',
    lat: 21.2054,
    lng: 105.9732,
    type: 'NHA_MAY'
  },
  {
    id: 'LOC-HAI-PHONG',
    name: 'Cảng Đình Vũ Hải Phòng',
    address: 'Bán đảo Đình Vũ, Đông Hải 2, Hải An, Hải Phòng',
    lat: 20.8542,
    lng: 106.7584,
    type: 'CANG_BIEN'
  }
];

export const calculateRouteEstimate = (pLat, pLng, dLat, dLng) => {
  if (!pLat || !pLng || !dLat || !dLng) {
    return { distanceKm: 35.0, durationMins: 45, isDefault: true };
  }

  const R = 6371;
  const dLatRad = ((dLat - pLat) * Math.PI) / 180;
  const dLonRad = ((dLng - pLng) * Math.PI) / 180;
  const a =
    Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
    Math.cos((pLat * Math.PI) / 180) *
      Math.cos((dLat * Math.PI) / 180) *
      Math.sin(dLonRad / 2) *
      Math.sin(dLonRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadDistance = Math.max(5, R * c * 1.32);
  const travelMinutes = Math.round((roadDistance / 45) * 60) + 10;

  return {
    distanceKm: parseFloat(roadDistance.toFixed(1)),
    durationMins: travelMinutes,
    isDefault: false
  };
};

export const SAMPLE_ORDER_PRESETS = [
  {
    key: 'adtek_preset',
    name: 'Mẫu 1: Đơn hàng ADTEK',
    description: 'Bắc Ninh đi Nội Bài - 18 Pallet linh kiện viễn thông',
    data: {
      customer_name: 'ADTEK VIETNAM CO., LTD',
      customer_tax_code: '2300987654',
      customer_phone: '0977887918',
      customer_email: 'logistics@adtek.com.vn',
      pickup_location_id: 'LOC-TIEN-SON',
      pickup_address: 'Đường TS8, KCN Tiên Sơn, Phường Đồng Nguyên, TP. Từ Sơn, Bắc Ninh',
      pickup_coords: { lat: 21.1235, lng: 105.9876 },
      delivery_location_id: 'LOC-APEX-NCTS',
      delivery_address: 'Ga NCTS Sân bay Nội Bài, Sóc Sơn, Hà Nội',
      delivery_coords: { lat: 21.2215, lng: 105.8078 },
      estimated_distance_km: 38.5,
      estimated_duration_mins: 45,
      hawb_code: 'HNAE25090222',
      factory_name: 'ADTEK Tiên Sơn',
      cargo_type: 'VALUABLE',
      package_count: 18,
      package_unit: 'Pallet',
      length_cm: 120,
      width_cm: 100,
      height_cm: 160,
      weight_kg: 2850,
      is_stackable: true,
      agreed_price: 6500000,
      extra_fees_surcharge: 450000,
      extra_fees_collection: 1200000,
      order_notes: 'Kiểm tra niêm phong chì trước khi dỡ hàng.',
      required_documents: ['CUSTOMS_DECLARATION', 'DELIVERY_ORDER', 'PACKING_LIST', 'COMMERCIAL_INVOICE'],
      truck_assigned_preview: '29H-995.72',
      driver_assigned_preview: 'Hồ Chí Học'
    }
  },
  {
    key: 'lo2_preset',
    name: 'Mẫu 2: Đơn hàng Sound & Light',
    description: 'Nội Bài đi Lai Xá - 42 kiện thiết bị âm thanh ánh sáng',
    data: {
      customer_name: 'CÔNG TY TNHH ÂM THANH ÁNH SÁNG SLVN',
      customer_tax_code: '01082051578',
      customer_phone: '0903456789',
      customer_email: 'import@soundlight.vn',
      pickup_location_id: 'LOC-ALS-NB',
      pickup_address: 'Kho ALS Cảng HKQT Nội Bài, Sóc Sơn, Hà Nội',
      pickup_coords: { lat: 21.2187, lng: 105.8042 },
      delivery_location_id: 'LOC-LAI-XA',
      delivery_address: 'Cụm Công nghiệp Lai Xá, Kim Chung, Hoài Đức, Hà Nội',
      delivery_coords: { lat: 21.0567, lng: 105.7198 },
      estimated_distance_km: 32.4,
      estimated_duration_mins: 40,
      hawb_code: 'SLVN-2026-HQ7N',
      factory_name: 'Kho ngoại quan Nội Bài',
      cargo_type: 'FRAGILE',
      package_count: 42,
      package_unit: 'Kiện gỗ',
      length_cm: 200,
      width_cm: 120,
      height_cm: 150,
      weight_kg: 1850,
      is_stackable: false,
      agreed_price: 5200000,
      extra_fees_surcharge: 300000,
      extra_fees_collection: 2450000,
      order_notes: 'Hàng dễ vỡ, không xếp chồng.',
      required_documents: ['CUSTOMS_DECLARATION', 'DELIVERY_ORDER', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'SALES_CONTRACT', 'BANK_SLIP'],
      truck_assigned_preview: '29H-767.99',
      driver_assigned_preview: 'Nguyễn Văn Đạt'
    }
  }
];

export const DOCUMENT_TYPES = [
  { 
    key: 'CUSTOMS_DECLARATION', 
    label: 'Tờ khai hải quan', 
    description: 'Tờ khai điện tử thông quan', 
    requiredDefault: true 
  },
  { 
    key: 'DELIVERY_ORDER', 
    label: 'Lệnh giao hàng & Vận đơn', 
    description: 'Chứng từ nhận hàng vận tải', 
    requiredDefault: true 
  },
  { 
    key: 'COMMERCIAL_INVOICE', 
    label: 'Hóa đơn thương mại', 
    description: 'Hóa đơn xuất nhập khẩu', 
    requiredDefault: true 
  },
  { 
    key: 'PACKING_LIST', 
    label: 'Phiếu đóng gói hàng hóa', 
    description: 'Quy cách kiện và kích thước chi tiết', 
    requiredDefault: true 
  },
  { 
    key: 'SALES_CONTRACT', 
    label: 'Hợp đồng mua bán', 
    description: 'Hợp đồng kinh tế thương mại', 
    requiredDefault: false 
  },
  { 
    key: 'BANK_SLIP', 
    label: 'Giấy nộp tiền thuế', 
    description: 'Chứng từ nộp thuế hoặc lệ phí', 
    requiredDefault: false 
  }
];