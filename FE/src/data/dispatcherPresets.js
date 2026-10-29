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

/**
 * Tính toán gợi ý thời gian lấy hàng tối ưu cho đơn hàng Xuất khẩu:
 * - Hàng xuất khẩu bằng đường hàng không cần có mặt tại kho/sân bay tối thiểu 4 - 6 tiếng trước giờ bay (cut-off time làm thủ tục hải quan, soi chiếu an ninh & cân đo).
 * - Cộng thêm thời gian xe chạy thực tế trên đường (khoảng cách km / 40km/h + 30p dự phòng kẹt xe).
 */
export const calculateExportPickupSuggestion = (flightDateTime, distanceKm = 30) => {
  if (!flightDateTime) return null;
  const flightDate = new Date(flightDateTime);
  if (isNaN(flightDate.getTime())) return null;

  // Thời gian xe chạy dự tính (phút)
  const travelMins = Math.round((Math.max(5, distanceKm) / 40) * 60) + 30;
  // Thời gian cut-off kho ALS / an ninh sân bay: tối thiểu 4 tiếng (240 phút)
  const airportLeadMins = 240;
  const totalLeadMinutes = travelMins + airportLeadMins;

  // Thời điểm muộn nhất nên lấy hàng
  const latestPickupDate = new Date(flightDate.getTime() - totalLeadMinutes * 60 * 1000);

  return {
    flightDate,
    latestPickupDate,
    latestPickupFormatted: latestPickupDate.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    travelHours: (travelMins / 60).toFixed(1),
    airportLeadHours: 4
  };
};

// Biểu giá vận tải & phụ phí chính thức ALS (Hợp đồng FedEx Express)
export const ALS_TARIFF_RATES = {
  VEHICLE_TYPES: [
    { key: 'TRUCK_1.25T', label: 'Xe tải 1.25 tấn', baseWeightKg: 1250, defaultRateKm: 28000, unloadingNB: 200000, unloading2Ends: 300000 },
    { key: 'TRUCK_2.5T', label: 'Xe tải 2.5 tấn', baseWeightKg: 2500, defaultRateKm: 35000, unloadingNB: 300000, unloading2Ends: 500000 },
    { key: 'TRUCK_3.5T', label: 'Xe tải 3.5 tấn', baseWeightKg: 3500, defaultRateKm: 42000, unloadingNB: 300000, unloading2Ends: 500000 },
    { key: 'TRUCK_5T', label: 'Xe tải 5 tấn', baseWeightKg: 5000, defaultRateKm: 50000, unloadingNB: 300000, unloading2Ends: 500000 },
    { key: 'CONTAINER_20', label: 'Container 20ft', baseWeightKg: 12000, defaultRateKm: 65000, unloadingNB: 500000, unloading2Ends: 800000 },
    { key: 'CONTAINER_40', label: 'Container 40ft', baseWeightKm: 25000, defaultRateKm: 85000, unloadingNB: 700000, unloading2Ends: 1200000 }
  ],
  // Biểu giá tuyến cố định (Vận tải nội địa/Tracking đến Sân bay Nội Bài)
  FIXED_ROUTES: [
    {
      keywords: ['bá thiện', 'ba thien', 'compal', 'vĩnh phúc', 'vinh phuc'],
      name: 'KCN Bá Thiện (Compal) - Nội Bài',
      rates: {
        'TRUCK_1.25T': { fullDay: 950000, afternoon: 750000 },
        'TRUCK_2.5T': { fullDay: 1350000, afternoon: 1150000 },
        'TRUCK_3.5T': { fullDay: 1700000, afternoon: 1550000 },
        'TRUCK_5T': { fullDay: 2100000, afternoon: 1900000 }
      }
    },
    {
      keywords: ['đồng văn', 'dong van', 'wistron', 'hà nam', 'ha nam'],
      name: 'KCN Đồng Văn 3 (Wistron) - Nội Bài',
      rates: {
        'TRUCK_1.25T': { fullDay: 1450000, afternoon: 1250000 },
        'TRUCK_2.5T': { fullDay: 1850000, afternoon: 1650000 },
        'TRUCK_3.5T': { fullDay: 2150000, afternoon: 1950000 },
        'TRUCK_5T': { fullDay: 2600000, afternoon: 2400000 }
      }
    }
  ],
  // Biểu phí bốc xếp theo tải trọng
  UNLOADING_FEES: {
    'TRUCK_1.25T': { oneEnd: 200000, twoEnds: 300000 },
    'TRUCK_2.5T': { oneEnd: 300000, twoEnds: 500000 },
    'TRUCK_3.5T': { oneEnd: 300000, twoEnds: 500000 },
    'TRUCK_5T': { oneEnd: 300000, twoEnds: 500000 },
    'CONTAINER_20': { oneEnd: 500000, twoEnds: 800000 },
    'CONTAINER_40': { oneEnd: 700000, twoEnds: 1200000 }
  }
};

/**
 * Hàm tính cước dự toán chuẩn theo biểu giá ALS
 */
export const calculateAlsPricing = ({
  distanceKm = 0,
  chargeableWeightKg = 0,
  vehicleType = 'TRUCK_2.5T',
  timeSlot = 'FULL_DAY', // 'FULL_DAY' (8:00 - 17:00) | 'AFTERNOON' (12:00 - 17:00)
  pickupAddress = '',
  deliveryAddress = '',
  loadingUnloadingRequired = false,
  customsServiceRequired = false
}) => {
  if (!distanceKm && !pickupAddress && !deliveryAddress) {
    return { baseTransportFee: 0, loadingFee: 0, customsFee: 0, totalRate: 0, isFixedRoute: false };
  }

  const vType = vehicleType || 'TRUCK_2.5T';
  const fullAddress = `${pickupAddress} ${deliveryAddress}`.toLowerCase();
  
  // 1. Kiểm tra tuyến cố định
  let matchedFixedRoute = ALS_TARIFF_RATES.FIXED_ROUTES.find(r => 
    r.keywords.some(kw => fullAddress.includes(kw))
  );

  let baseTransportFee = 0;
  let isFixedRoute = false;

  if (matchedFixedRoute && matchedFixedRoute.rates[vType]) {
    isFixedRoute = true;
    const rates = matchedFixedRoute.rates[vType];
    baseTransportFee = timeSlot === 'AFTERNOON' ? rates.afternoon : rates.fullDay;
  } else {
    // Tuyến tự do tính theo km đường đi & hệ số loại xe
    const vSpec = ALS_TARIFF_RATES.VEHICLE_TYPES.find(v => v.key === vType) || ALS_TARIFF_RATES.VEHICLE_TYPES[1];
    const baseOpenPrice = vType === 'TRUCK_1.25T' ? 600000 : (vType === 'TRUCK_2.5T' ? 800000 : 1000000);
    const calculatedRate = baseOpenPrice + (distanceKm * vSpec.defaultRateKm) + (chargeableWeightKg * 250);
    const discount = timeSlot === 'AFTERNOON' ? 0.9 : 1.0; // Khung giờ chiều giảm ~10%
    baseTransportFee = Math.round((calculatedRate * discount) / 50000) * 50000;
  }

  // 2. Phí bốc xếp (Tùy case phát sinh thực tế -> chuyển sang ghi nhận phụ phí phát sinh)
  const loadingFee = 0;

  // 3. Phí dịch vụ làm thủ tục hải quan
  const customsFee = customsServiceRequired ? 500000 : 0;

  return {
    baseTransportFee,
    loadingFee,
    customsFee,
    totalRate: baseTransportFee + loadingFee + customsFee,
    isFixedRoute,
    routeName: matchedFixedRoute ? matchedFixedRoute.name : 'Vận chuyển nội địa theo khoảng cách'
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
  if (lower.includes('als nội bài') || lower.includes('ga hàng hóa als') || lower.includes('cảng hkqt nội bài') || lower.includes('sân bay quốc tế nội bài')) {
    return { lat: ALS_NOI_BAI_TERMINAL.lat, lng: ALS_NOI_BAI_TERMINAL.lng };
  }
  if (lower.includes('nguyễn đức cảnh') || lower.includes('trần hưng đạo') || lower.includes('thái bình')) {
    return { lat: 20.447962, lng: 106.326734 };
  }
  if (lower.includes('hưng yên') || lower.includes('phố nối') || lower.includes('thăng long ii')) {
    return { lat: 20.9312, lng: 106.0325 };
  }
  if (lower.includes('quế võ')) {
    return { lat: 21.1628, lng: 106.1285 };
  }
  if (lower.includes('yên phong')) {
    return { lat: 21.1986, lng: 105.9951 };
  }
  if (lower.includes('vsip') || lower.includes('từ sơn') || lower.includes('tiên sơn') || lower.includes('bắc ninh')) {
    return { lat: 21.1150, lng: 105.9750 };
  }
  if (lower.includes('bá thiện') || lower.includes('vĩnh phúc') || lower.includes('bình xuyên')) {
    return { lat: 21.3185, lng: 105.6620 };
  }
  if (lower.includes('đồng văn') || lower.includes('hà nam')) {
    return { lat: 20.6425, lng: 105.9225 };
  }
  if (lower.includes('hải phòng') || lower.includes('đình vũ') || lower.includes('nam cầu kiền')) {
    return { lat: 20.8449, lng: 106.6881 };
  }
  if (lower.includes('thái nguyên') || lower.includes('yên bình')) {
    return { lat: 21.4525, lng: 105.8752 };
  }
  if (lower.includes('long biên') || lower.includes('gia lâm') || lower.includes('đài tư')) {
    return { lat: 21.0375, lng: 105.8942 };
  }
  return null;
};

export const DOCUMENT_TYPES = [
  { 
    key: 'CUSTOMS_DECLARATION', 
    label: 'Tờ khai hải quan', 
    description: 'Bản khai chi tiết về mã HS, trị giá, số lượng và thuế suất.', 
    requiredDefault: true 
  },
  { 
    key: 'COMMERCIAL_INVOICE', 
    label: 'Hóa đơn thương mại', 
    description: 'Chứng từ thanh toán do người bán phát hành, là cơ sở tính thuế.', 
    requiredDefault: true 
  },
  { 
    key: 'PACKING_LIST', 
    label: 'Phiếu đóng gói', 
    description: 'Mô tả chi tiết cách đóng gói, trọng lượng tịnh, trọng lượng tổng và số kiện.', 
    requiredDefault: true 
  },
  { 
    key: 'DELIVERY_ORDER', 
    label: 'Vận đơn', 
    description: 'Chứng nhận quyền sở hữu và hợp đồng vận chuyển.', 
    requiredDefault: true 
  },
  { 
    key: 'SALES_CONTRACT', 
    label: 'Hợp đồng thương mại', 
    description: 'Thỏa thuận mua bán giữa người bán và người mua.', 
    requiredDefault: true 
  }
];

// I. Bộ chứng từ cơ bản (Áp dụng cho mọi loại hàng hóa)
export const BASIC_CUSTOMS_DOCUMENTS = [
  { 
    key: 'doc-basic-1', 
    name: 'Tờ khai hải quan', 
    description: 'Bản khai hải quan do Điều phối viên/Bộ phận Khai báo chuẩn bị và đính kèm.',
    isBasic: true,
    preparedBy: 'DISPATCHER'
  },
  { 
    key: 'doc-basic-2', 
    name: 'Hóa đơn thương mại', 
    description: 'Chứng từ thanh toán do người bán phát hành, là cơ sở tính thuế.',
    isBasic: true 
  },
  { 
    key: 'doc-basic-3', 
    name: 'Phiếu đóng gói', 
    description: 'Mô tả chi tiết cách đóng gói, trọng lượng tịnh, trọng lượng tổng và số kiện.',
    isBasic: true 
  },
  { 
    key: 'doc-basic-4', 
    name: 'Vận đơn', 
    description: 'Chứng nhận quyền sở hữu và hợp đồng vận chuyển.',
    isBasic: true 
  },
  { 
    key: 'doc-basic-5', 
    name: 'Hợp đồng thương mại', 
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
        name: 'Giấy chứng nhận xuất xứ',
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
        name: 'Giấy chứng nhận kiểm dịch thực vật hoặc kiểm dịch động vật',
        description: 'Xác nhận hàng không mang sâu bệnh, dịch hại.'
      },
      {
        name: 'Giấy kiểm tra chất lượng / An toàn thực phẩm',
        description: 'Do cơ quan quản lý nhà nước chuyên ngành cấp sau khi lấy mẫu kiểm tra.'
      },
      {
        name: 'Kết quả kiểm nghiệm',
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
        name: 'Bảng chỉ dẫn an toàn hóa chất',
        description: 'Mô tả thành phần, độ độc hại và cách xử lý sự cố.'
      },
      {
        name: 'Giấy phép nhập khẩu/xuất khẩu hoặc Phiếu công bố sản phẩm',
        description: 'Giấy phép nhập khẩu/xuất khẩu hoặc Phiếu công bố sản phẩm.'
      },
      {
        name: 'Giấy chứng nhận lưu hành tự do',
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
        name: 'Giấy chứng nhận hun trùng',
        description: 'Xác nhận kiện hàng hoặc pallet gỗ đã được xử lý khử trùng.'
      },
      {
        name: 'Hồ sơ lâm sản hợp pháp',
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
        name: 'Giấy chứng nhận chất lượng',
        description: 'Xác nhận chất lượng kỹ thuật của máy móc thiết bị.'
      },
      {
        name: 'Chứng thư giám định của tổ chức giám định độc lập',
        description: 'Xác nhận năm sản xuất và tỉ lệ chất lượng còn lại.'
      },
      {
        name: 'Giấy phép nhập khẩu',
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
    isCustom: false,
    preparedBy: doc.preparedBy || 'CUSTOMER'
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


// Danh mục thông số kỹ thuật chuẩn đội xe ALS phục vụ phân tích gợi ý xe & xếp hàng 3D
export const VEHICLE_SPECS = [
  {
    key: 'TRUCK_1.25T',
    label: 'Xe tải 1.25 tấn',
    shortLabel: 'Xe 1.25 tấn',
    maxPayloadKg: 1250,
    length_cm: 310,
    width_cm: 160,
    height_cm: 160,
    volumeM3: 7.9,
    boxDimText: 'Thùng 3,1 × 1,6 × 1,6 m',
    samplePlate: '29H-112.34'
  },
  {
    key: 'TRUCK_2.5T',
    label: 'Xe tải 2.5 tấn',
    shortLabel: 'Xe 2.5 tấn',
    maxPayloadKg: 2500,
    length_cm: 420,
    width_cm: 190,
    height_cm: 190,
    volumeM3: 15.2,
    boxDimText: 'Thùng 4,2 × 1,9 × 1,9 m',
    samplePlate: '29C-456.78'
  },
  {
    key: 'TRUCK_3.5T',
    label: 'Xe tải 3.5 tấn',
    shortLabel: 'Xe 3.5 tấn',
    maxPayloadKg: 3500,
    length_cm: 500,
    width_cm: 205,
    height_cm: 205,
    volumeM3: 21.0,
    boxDimText: 'Thùng 5,0 × 2,05 × 2,05 m',
    samplePlate: '29H-995.72'
  },
  {
    key: 'TRUCK_5T',
    label: 'Xe tải 5 tấn',
    shortLabel: 'Xe 5 tấn',
    maxPayloadKg: 5000,
    length_cm: 620,
    width_cm: 220,
    height_cm: 220,
    volumeM3: 30.0,
    boxDimText: 'Thùng 6,2 × 2,2 × 2,2 m',
    samplePlate: '29H-767.99'
  },
  {
    key: 'CONTAINER_20',
    label: 'Container 20ft',
    shortLabel: 'Cont 20ft',
    maxPayloadKg: 12000,
    length_cm: 590,
    width_cm: 235,
    height_cm: 239,
    volumeM3: 33.1,
    boxDimText: 'Cont 5,9 × 2,35 × 2,39 m',
    samplePlate: '29R-020.88'
  },
  {
    key: 'CONTAINER_40',
    label: 'Container 40ft',
    shortLabel: 'Cont 40ft',
    maxPayloadKg: 25000,
    length_cm: 1200,
    width_cm: 235,
    height_cm: 239,
    volumeM3: 67.4,
    boxDimText: 'Cont 12,0 × 2,35 × 2,39 m',
    samplePlate: '29R-040.99'
  }
];

export const getVehicleSpecByKey = (vehicleKey) => {
  return (
    VEHICLE_SPECS.find(v => v.key === vehicleKey) ||
    VEHICLE_SPECS[1] // Mặc định TRUCK_2.5T
  );
};

/**
 * Phân tích thông số lô hàng (tải trọng thực, tải trọng tính cước, kích thước DxRxC, số kiện)
 * để gợi ý loại xe tối ưu nhất (BR-03, BR-33) và đối chiếu với loại xe khách hàng chọn ban đầu.
 */
export const analyzeVehicleRecommendation = ({
  actualWeightKg = 0,
  chargeableWeightKg = 0,
  length_cm = 0,
  width_cm = 0,
  height_cm = 0,
  package_count = 1,
  items = [],
  customerRequestedVehicle = 'TRUCK_2.5T'
}) => {
  const effectiveWeight = Math.max(Number(actualWeightKg) || 0, Number(chargeableWeightKg) || 0);
  let maxL = Number(length_cm) || 0;
  let maxW = Number(width_cm) || 0;
  let maxH = Number(height_cm) || 0;
  let totalVolM3 = 0;

  if (Array.isArray(items) && items.length > 0) {
    items.forEach(it => {
      const l = Number(it.length_cm) || 0;
      const w = Number(it.width_cm) || 0;
      const h = Number(it.height_cm) || 0;
      const qty = Math.max(1, parseInt(it.package_count, 10) || 1);
      if (l > maxL) maxL = l;
      if (w > maxW) maxW = w;
      if (h > maxH) maxH = h;
      const singleBoxM3 = (l * w * h) / 1000000;
      // Nếu khách nhập kích thước tổng của cả lô (VD: 200x200x200cm = 8m3 cho 20 thùng), không nhân 20 lần gây ảo thể tích
      if (singleBoxM3 >= 1.5 && qty > 4) {
        totalVolM3 += singleBoxM3;
      } else {
        totalVolM3 += singleBoxM3 * qty;
      }
    });
  } else if (maxL > 0 && maxW > 0 && maxH > 0) {
    const qty = Math.max(1, parseInt(package_count, 10) || 1);
    const singleBoxM3 = (maxL * maxW * maxH) / 1000000;
    totalVolM3 = (singleBoxM3 >= 1.5 && qty > 4) ? singleBoxM3 : singleBoxM3 * qty;
  }

  totalVolM3 = Number(totalVolM3.toFixed(2));

  // Tìm xe nhỏ nhất trong đội xe chứa vừa cả tải trọng, kích thước bao và thể tích
  let recommendedSpec = VEHICLE_SPECS.find(spec => {
    const fitsWeight = spec.maxPayloadKg >= effectiveWeight;
    const fitsDim =
      (spec.length_cm >= maxL && spec.width_cm >= maxW && spec.height_cm >= maxH) ||
      (spec.length_cm >= maxW && spec.width_cm >= maxL && spec.height_cm >= maxH);
    const fitsVol = totalVolM3 === 0 || spec.volumeM3 * 0.9 >= totalVolM3;
    return fitsWeight && fitsDim && fitsVol;
  });

  if (!recommendedSpec) {
    recommendedSpec = VEHICLE_SPECS[VEHICLE_SPECS.length - 1];
  }

  const customerSpec = getVehicleSpecByKey(customerRequestedVehicle);
  const recIdx = VEHICLE_SPECS.findIndex(v => v.key === recommendedSpec.key);
  const custIdx = VEHICLE_SPECS.findIndex(v => v.key === customerSpec.key);

  let status = 'OPTIMAL'; // 'OPTIMAL' | 'UNDER_CAPACITY' | 'OVER_CAPACITY'
  let reason = `Loại xe ${customerSpec.label} (${customerSpec.boxDimText}, tải ${customerSpec.maxPayloadKg.toLocaleString('vi-VN')} kg) hoàn toàn phù hợp với lô hàng (${effectiveWeight.toLocaleString('vi-VN')} kg${totalVolM3 > 0 ? `, ~${totalVolM3} m³` : ''}).`;

  if (custIdx < recIdx) {
    status = 'UNDER_CAPACITY';
    const reasons = [];
    if (effectiveWeight > customerSpec.maxPayloadKg) {
      reasons.push(`tải trọng tính cước ${effectiveWeight.toLocaleString('vi-VN')} kg vượt tải cho phép của ${customerSpec.shortLabel} (${customerSpec.maxPayloadKg.toLocaleString('vi-VN')} kg)`);
    }
    if (maxL > customerSpec.length_cm || maxW > customerSpec.width_cm || maxH > customerSpec.height_cm) {
      reasons.push(`kích thước hàng (${maxL}×${maxW}×${maxH} cm) vượt lòng thùng ${customerSpec.shortLabel} (${customerSpec.length_cm}×${customerSpec.width_cm}×${customerSpec.height_cm} cm)`);
    }
    if (totalVolM3 > customerSpec.volumeM3 * 0.9) {
      reasons.push(`thể tích hàng (~${totalVolM3} m³) vượt dung tích xếp an toàn của ${customerSpec.shortLabel} (${customerSpec.volumeM3} m³)`);
    }
    reason = `Khách chọn ${customerSpec.label} nhưng ${reasons.join(' và ') || 'chưa đủ dung tích'}. Hệ thống đề xuất nâng lên ${recommendedSpec.label} (${recommendedSpec.boxDimText}, tải ${recommendedSpec.maxPayloadKg.toLocaleString('vi-VN')} kg) và trao đổi chốt lại với khách.`;
  } else if (custIdx > recIdx && effectiveWeight > 0) {
    status = 'OVER_CAPACITY';
    reason = `Khách yêu cầu ${customerSpec.label}, tuy nhiên theo phân tích tải trọng (${effectiveWeight.toLocaleString('vi-VN')} kg) và kích thước (${maxL}×${maxW}×${maxH} cm), chỉ cần ${recommendedSpec.label} (${recommendedSpec.boxDimText}) là đủ xếp hàng. Có thể tư vấn khách tối ưu chi phí hoặc giữ nguyên theo yêu cầu riêng của khách.`;
  }

  return {
    recommendedVehicleKey: recommendedSpec.key,
    recommendedSpec,
    customerRequestedKey: customerSpec.key,
    customerSpec,
    effectiveWeightKg: effectiveWeight,
    totalVolumeM3: totalVolM3,
    maxDimensionsCm: { length: maxL, width: maxW, height: maxH },
    status,
    reason
  };
};
