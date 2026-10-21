// Các hàm tính toán cước và phân loại chứng từ vận tải
export const calculateRouteEstimate = (pLat, pLng, dLat, dLng) => {
  if (!pLat || !pLng || !dLat || !dLng) {
    return { distanceKm: 0, durationMins: 0, isDefault: true };
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

// Cấu hình chuẩn nghiệp vụ Nhà Ga Hàng Hóa ALS Cảng HKQT Nội Bài
export const ALS_NOI_BAI_TERMINAL = {
  name: 'Nhà Ga Hàng Hóa ALS Nội Bài',
  address: 'Nhà Ga Hàng Hóa ALS Nội Bài',
  lat: 21.2187,
  lng: 105.8042
};

// 4 kho hàng của ALS tại Nội Bài phân bổ hàng hóa
export const ALS_NOI_BAI_WAREHOUSES = [
  { id: 'WH-1', name: 'Kho ALS 1 (Nội Bài Cargo Terminal 1)', code: 'ALS-NB-01' },
  { id: 'WH-2', name: 'Kho ALS 2 (Nội Bài Cargo Terminal 2)', code: 'ALS-NB-02' },
  { id: 'WH-3', name: 'Kho ALS 3 (Nội Bài Cargo Terminal 3)', code: 'ALS-NB-03' },
  { id: 'WH-4', name: 'Kho ALS 4 (Nội Bài Cargo Terminal 4)', code: 'ALS-NB-04' }
];

// Cửa khẩu kéo dài / Cảng cạn ICD (ALS điều xe chở về thông quan tránh nghẽn hàng)
export const ALS_ICD_LOCATIONS = [
  {
    key: 'NOI_BAI',
    name: 'Thông quan trực tiếp tại Ga ALS Nội Bài',
    address: 'Cảng HKQT Nội Bài, Hà Nội',
    type: 'AIRPORT_DIRECT',
    description: 'Thông quan trực tiếp tại 4 kho Nội Bài'
  },
  { 
    key: 'MY_DINH', 
    name: 'Cảng cạn ICD Mỹ Đình (ALS)', 
    address: 'Số 17 Phạm Hùng, Mỹ Đình 2, Nam Từ Liêm, Hà Nội',
    type: 'EXTENDED_CUSTOMS',
    description: 'Cửa khẩu kéo dài ICD Mỹ Đình giúp giảm tải cho Nội Bài'
  },
  { 
    key: 'BAC_NINH', 
    name: 'Cảng cạn ICD Bắc Ninh (ALS)', 
    address: 'Lô CN05, Đường YP6, KCN Yên Phong, Đông Phong, Yên Phong, Bắc Ninh',
    type: 'EXTENDED_CUSTOMS',
    description: 'Cửa khẩu kéo dài ICD Bắc Ninh phục vụ KCN Yên Phong / VSIP'
  },
  { 
    key: 'GIA_LAM', 
    name: 'Cảng cạn ICD Gia Lâm (ALS)', 
    address: 'Khu công nghiệp Đài Tư, 386 Nguyễn Văn Linh, Sài Đồng, Long Biên, Hà Nội',
    type: 'EXTENDED_CUSTOMS',
    description: 'Cửa khẩu kéo dài ICD Gia Lâm cửa ngõ phía Đông'
  }
];

// 3 luồng phân loại hải quan
export const CUSTOMS_CHANNELS = [
  { key: 'GREEN', label: 'Luồng Xanh', color: 'green', desc: 'Thông quan thẳng, gần như không phải kiểm tra.' },
  { key: 'YELLOW', label: 'Luồng Vàng', color: 'gold', desc: 'Mở ra kiểm tra trực quan chứng từ và thực tế hàng hóa.' },
  { key: 'RED', label: 'Luồng Đỏ', color: 'red', desc: 'Kiểm tra kỹ lưỡng (áp dụng hóa chất, chất đặc biệt, nguy cơ cao).' }
];

// Hàm lấy tọa độ từ chuỗi địa chỉ (trả về null nếu chưa được chọn qua Geocoding API)
export const getCoordsFromAddress = (addressStr = '', markerType = 'A') => {
  if (!addressStr) return null;
  const lower = addressStr.toLowerCase();
  if (lower.includes('als nội bài') || lower.includes('ga hàng hóa als') || lower.includes('cảng hkqt nội bài')) {
    return { lat: ALS_NOI_BAI_TERMINAL.lat, lng: ALS_NOI_BAI_TERMINAL.lng };
  }
  return null;
};

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