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

import { lookupLocationCoords } from './vietnamLocationsData';

// Hàm định vị và suy luận tọa độ GPS tự động theo chuỗi địa chỉ toàn quốc
export const getCoordsFromAddress = (addressStr = '', markerType = 'A') => {
  return lookupLocationCoords(addressStr, markerType);
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
    label: 'Tờ khai hải quan (Customs Declaration)', 
    description: 'Bản khai chi tiết về mã HS, trị giá, số lượng và thuế suất.', 
    requiredDefault: true 
  },
  { 
    key: 'COMMERCIAL_INVOICE', 
    label: 'Hóa đơn thương mại (Commercial Invoice - INV)', 
    description: 'Chứng từ thanh toán do người bán phát hành, là cơ sở tính thuế.', 
    requiredDefault: true 
  },
  { 
    key: 'PACKING_LIST', 
    label: 'Phiếu đóng gói (Packing List - P/L)', 
    description: 'Mô tả chi tiết cách đóng gói, trọng lượng tịnh, trọng lượng tổng và số kiện.', 
    requiredDefault: true 
  },
  { 
    key: 'DELIVERY_ORDER', 
    label: 'Vận đơn (Bill of Lading - B/L hoặc Air Waybill - AWB)', 
    description: 'Chứng nhận quyền sở hữu và hợp đồng vận chuyển.', 
    requiredDefault: true 
  },
  { 
    key: 'SALES_CONTRACT', 
    label: 'Hợp đồng thương mại (Sales Contract)', 
    description: 'Thỏa thuận mua bán giữa người bán và người mua.', 
    requiredDefault: true 
  }
];

// I. Bộ chứng từ cơ bản (Áp dụng cho mọi loại hàng hóa)
export const BASIC_CUSTOMS_DOCUMENTS = [
  { 
    key: 'doc-basic-1', 
    name: 'Tờ khai hải quan (Customs Declaration)', 
    description: 'Bản khai chi tiết về mã HS, trị giá, số lượng và thuế suất.',
    isBasic: true 
  },
  { 
    key: 'doc-basic-2', 
    name: 'Hóa đơn thương mại (Commercial Invoice - INV)', 
    description: 'Chứng từ thanh toán do người bán phát hành, là cơ sở tính thuế.',
    isBasic: true 
  },
  { 
    key: 'doc-basic-3', 
    name: 'Phiếu đóng gói (Packing List - P/L)', 
    description: 'Mô tả chi tiết cách đóng gói, trọng lượng tịnh, trọng lượng tổng và số kiện.',
    isBasic: true 
  },
  { 
    key: 'doc-basic-4', 
    name: 'Vận đơn (Bill of Lading - B/L hoặc Air Waybill - AWB)', 
    description: 'Chứng nhận quyền sở hữu và hợp đồng vận chuyển.',
    isBasic: true 
  },
  { 
    key: 'doc-basic-5', 
    name: 'Hợp đồng thương mại (Sales Contract)', 
    description: 'Thỏa thuận mua bán giữa người bán và người mua.',
    isBasic: true 
  }
];

// II. Chứng từ theo từng loại hàng hóa cụ thể
export const SPECIALIZED_CARGO_CATEGORIES = [
  {
    categoryKey: 'GENERAL',
    categoryName: '1. Hàng thông thường (Tiêu dùng, linh kiện điện tử mới, thời trang...)',
    keywords: ['general', 'tiêu dùng', 'linh kiện', 'điện tử', 'thời trang', 'may mặc', 'bách hóa', 'adtek'],
    specializedDocs: [
      {
        name: 'Giấy chứng nhận xuất xứ (Certificate of Origin - C/O)',
        description: 'Dùng để hưởng ưu đãi thuế quan đặc biệt nếu có.'
      }
    ]
  },
  {
    categoryKey: 'AGRI_FOOD',
    categoryName: '2. Hàng nông sản, thực phẩm, động thực vật sống',
    keywords: ['agri_food', 'nông sản', 'thực phẩm', 'động thực vật', 'động vật', 'thực vật', 'trái cây', 'rau quả', 'thịt', 'thủy sản', 'nông nghiệp'],
    specializedDocs: [
      {
        name: 'Giấy chứng nhận kiểm dịch thực vật (Phytosanitary Certificate) hoặc kiểm dịch động vật (Veterinary Certificate)',
        description: 'Xác nhận hàng không mang sâu bệnh, dịch hại.'
      },
      {
        name: 'Giấy kiểm tra chất lượng / An toàn thực phẩm',
        description: 'Do cơ quan quản lý nhà nước chuyên ngành cấp sau khi lấy mẫu kiểm tra.'
      },
      {
        name: 'Kết quả kiểm nghiệm (Certificate of Analysis - C/A)',
        description: 'Kết quả kiểm nghiệm tùy theo từng lô hàng.'
      }
    ]
  },
  {
    categoryKey: 'CHEMICAL_PHARMA',
    categoryName: '3. Hàng hóa chất, mỹ phẩm, dược phẩm',
    keywords: ['chemical_pharma', 'hóa chất', 'mỹ phẩm', 'dược phẩm', 'thuốc', 'chất lỏng', 'nguy hiểm', 'chemical', 'pharma', 'medtech', 'thực phẩm chức năng'],
    specializedDocs: [
      {
        name: 'Bảng chỉ dẫn an toàn hóa chất (Material Safety Data Sheet - MSDS)',
        description: 'Mô tả thành phần, độ độc hại và cách xử lý sự cố.'
      },
      {
        name: 'Giấy phép nhập khẩu/xuất khẩu hoặc Phiếu công bố sản phẩm (đối với mỹ phẩm, thực phẩm chức năng)',
        description: 'Giấy phép nhập khẩu/xuất khẩu hoặc Phiếu công bố sản phẩm.'
      },
      {
        name: 'Giấy chứng nhận lưu hành tự do (Certificate of Free Sale - CFS)',
        description: 'Cung cấp nếu cơ quan hải quan yêu cầu.'
      }
    ]
  },
  {
    categoryKey: 'WOOD_PRODUCTS',
    categoryName: '4. Hàng gỗ và sản phẩm từ gỗ',
    keywords: ['wood_products', 'gỗ', 'sản phẩm từ gỗ', 'sản phẩm gỗ', 'pallet gỗ', 'nội thất gỗ', 'ván ép', 'wood', 'timber'],
    specializedDocs: [
      {
        name: 'Giấy chứng nhận hun trùng (Fumigation Certificate)',
        description: 'Xác nhận kiện hàng hoặc pallet gỗ đã được xử lý khử trùng.'
      },
      {
        name: 'Hồ sơ lâm sản hợp pháp (Bảng kê gỗ, xác nhận nguồn gốc gỗ theo quy định kiểm lâm/hải quan)',
        description: 'Bảng kê gỗ, xác nhận nguồn gốc gỗ theo quy định kiểm lâm/hải quan.'
      }
    ]
  },
  {
    categoryKey: 'USED_MACHINERY',
    categoryName: '5. Hàng máy móc thiết bị cũ / Đã qua sử dụng',
    keywords: ['used_machinery', 'máy cũ', 'thiết bị cũ', 'đã qua sử dụng', 'used machine', 'second hand', 'dây chuyền cũ', 'máy móc cũ', 'máy móc', 'thiết bị', 'machinery'],
    specializedDocs: [
      {
        name: 'Chứng chứng nhận chất lượng (Certificate of Quality - C/Q)',
        description: 'Xác nhận chất lượng kỹ thuật của máy móc thiết bị.'
      },
      {
        name: 'Chứng thư giám định của tổ chức giám định độc lập được cơ quan nhà nước chỉ định',
        description: 'Xác nhận năm sản xuất và tỉ lệ chất lượng còn lại.'
      },
      {
        name: 'Giấy phép nhập khẩu (nếu thuộc danh mục hạn chế)',
        description: 'Giấy phép nhập khẩu nếu thiết bị thuộc danh mục hạn chế.'
      }
    ]
  }
];

// Helper gợi ý chứng từ phù hợp theo tên hoặc phân loại hàng hóa
export const getRecommendedDocsByCargo = (cargoName = '', cargoType = '', notes = '') => {
  const text = `${cargoName} ${cargoType} ${notes}`.toLowerCase();
  const cType = (cargoType || '').toUpperCase();
  
  // Khởi tạo với Bộ chứng từ cơ bản (5 chứng từ bắt buộc cho mọi loại hàng)
  const docs = BASIC_CUSTOMS_DOCUMENTS.map((doc, idx) => ({
    key: `basic-${idx + 1}`,
    name: doc.name,
    description: doc.description,
    file: 'Chờ tải lên',
    status: 'WAITING_UPLOAD',
    size: '-',
    uploadDate: '-',
    isBasic: true,
    isCustom: false
  }));

  // Tìm nhóm hàng đặc thù phù hợp (trực tiếp theo categoryKey hoặc từ khóa)
  let matchedCat = SPECIALIZED_CARGO_CATEGORIES.find(c => c.categoryKey === cType);
  if (!matchedCat) {
    matchedCat = SPECIALIZED_CARGO_CATEGORIES.find(c => c.keywords.some(kw => text.includes(kw)));
  }

  if (matchedCat) {
    matchedCat.specializedDocs.forEach((sDoc, sIdx) => {
      docs.push({
        key: `spec-${matchedCat.categoryKey}-${sIdx + 1}`,
        name: sDoc.name,
        description: sDoc.description,
        file: 'Chờ tải lên',
        status: 'WAITING_UPLOAD',
        size: '-',
        uploadDate: '-',
        isBasic: false,
        isCustom: true,
        categoryName: matchedCat.categoryName
      });
    });
  }

  return docs;
};