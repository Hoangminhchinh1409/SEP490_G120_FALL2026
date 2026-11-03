const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash'
];

/**
 * Gọi Google Gemini Generative Language API với cơ chế tự động fallback model
 */
const callGeminiGenerateContent = async (promptText, responseJson = true) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong biến môi trường');
  }
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const bodyPayload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          temperature: 0.25,
          thinkingConfig: {
            thinkingBudget: 0
          },
          ...(responseJson ? { responseMimeType: 'application/json' } : {})
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        const errBody = await res.text();
        lastError = new Error(`Gemini API (${modelName}) HTTP ${res.status}: ${errBody}`);
        continue;
      }

      const data = await res.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('')
          .trim() || '';

      if (!rawText) {
        lastError = new Error(`Gemini API (${modelName}) returned empty content`);
        continue;
      }

      if (responseJson) {
        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        return {
          model: data.modelVersion || modelName,
          data: JSON.parse(cleaned)
        };
      }

      return {
        model: data.modelVersion || modelName,
        text: rawText
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Google Gemini AI');
};

/**
 * 1. Trợ lý AI Phân tích & Gợi ý Chứng từ Hải quan Xuất Nhập Khẩu
 */
const analyzeCustomsDocuments = async (payload = {}) => {
  const { cargoDesc = '', order = {} } = payload;

  const prompt = `Bạn là Chuyên gia Thủ tục Hải quan & Logistics Xuất Nhập Khẩu tại Việt Nam (Hệ thống NEXLOG).
Hãy phân tích thông tin lô hàng dưới đây và trả về kết quả JSON chuẩn xác để tư vấn bộ chứng từ cần nộp:

- Mô tả lô hàng: "${cargoDesc}"
- Tên hàng trong đơn: "${order.cargo_name || ''}"
- Loại hàng: "${order.cargo_type || ''}"
- Số lượng / Quy cách: "${order.package_count || ''} ${order.package_unit || ''}"
- Trọng lượng: "${order.weight || order.actual_weight_kg || ''} kg"
- Tuyến vận chuyển: "${order.pickup_address || order.pickup || ''} -> ${order.delivery_address || order.dropoff || ''}"

Yêu cầu trả về đúng định dạng JSON với cấu trúc sau:
{
  "categoryKey": "Chọn 1 trong 5 mã khớp nhất: GENERAL | FOOD_AGRI | MACHINERY_ELEC | CHEMICAL_COSMETIC | WOOD_TEXTILE",
  "categoryName": "Tên nhóm hàng chuyên ngành bằng tiếng Việt",
  "hsCodeSuggestion": "Gợi ý phân nhóm mã HS (4-6 số) tham khảo và chính sách mặt hàng",
  "aiSummary": "Nhận định chuyên môn ngắn gọn (2-3 câu) về thủ tục thông quan và lưu ý kiểm tra chuyên ngành cho lô hàng này",
  "riskNotes": ["Lưu ý rủi ro 1 khi làm thủ tục/vận chuyển", "Lưu ý rủi ro 2"],
  "recommendedSpecializedDocs": [
    {
      "name": "Tên chứng từ chuyên ngành (Tiếng Việt + Tiếng Anh trong ngoặc)",
      "shortCode": "Mã viết tắt (VD: PHYTO, C/O, MSDS, QUALITY...)",
      "description": "Giải thích tại sao lô hàng này cần chứng từ này và cơ quan cấp"
    }
  ]
}`;

  const result = await callGeminiGenerateContent(prompt, true);
  return {
    model: result.model,
    ...result.data
  };
};

/**
 * 2. Trợ lý AI Phân tích Phương án Xe tải, Thẩm định Kích thước & Soạn ghi chú tư vấn gửi khách
 */
const analyzeVehicleAndQuote = async (payload = {}) => {
  const {
    order = {},
    customerRequestedVehicle = '2.5T',
    systemRecommendedVehicle = '3.5T',
    distanceKm = 30,
    estimatedPriceVnd = 2500000
  } = payload;

  const prompt = `Bạn là Kỹ sư Điều phối Vận tải & Định giá Cước Logistics của NEXLOG.
Hãy phân tích lô hàng dưới đây để tư vấn loại xe tải tối ưu và soạn lời giải thích thuyết phục gửi khách hàng:

Thông số đội xe NEXLOG:
- 1.25T: Xe tải 1.25 tấn (Thùng 320x165x170 cm, 9.0 m³, tối đa 1.250 kg)
- 2.5T: Xe tải 2.5 tấn (Thùng 420x190x190 cm, 15.2 m³, tối đa 2.500 kg)
- 3.5T: Xe tải 3.5 tấn (Thùng 500x205x205 cm, 21.0 m³, tối đa 3.500 kg)
- 5T: Xe tải 5 tấn (Thùng 620x220x220 cm, 30.0 m³, tối đa 5.000 kg)
- 8T: Xe tải 8 tấn (Thùng 780x235x240 cm, 44.0 m³, tối đa 8.000 kg)
- 15T: Xe tải 15 tấn / Cont (Thùng 960x240x250 cm, 57.6 m³, tối đa 15.000 kg)

Thông tin đơn hàng khách đặt:
- Mặt hàng: ${order.cargo_name || 'Hàng hóa'} (${order.cargo_type || 'GENERAL'})
- Số lượng: ${order.package_count || 1} ${order.package_unit || 'kiện'}
- Kích thước khai báo (DxRxC): ${order.length_cm || 0} x ${order.width_cm || 0} x ${order.height_cm || 0} cm
- Trọng lượng thực tế: ${order.weight || order.actual_weight_kg || 0} kg
- Tải trọng tính cước: ${order.chargeable || order.chargeable_weight_kg || 0} kg
- Quãng đường bộ thực tế: ${distanceKm} km (${order.pickup_address || order.pickup || ''} -> ${order.delivery_address || order.dropoff || ''})
- Xe khách chọn ban đầu: ${customerRequestedVehicle}
- Xe hệ thống tính toán: ${systemRecommendedVehicle}
- Giá cước hệ thống tạm tính: ${Number(estimatedPriceVnd).toLocaleString('vi-VN')} VNĐ

Trả về JSON với cấu trúc:
{
  "recommendedVehicleKey": "Mã xe tối ưu (1.25T | 2.5T | 3.5T | 5T | 8T | 15T)",
  "technicalAssessment": "Phân tích kỹ thuật (2-3 câu) đối chiếu kích thước DxRxC cm, thể tích m3 và tải trọng kg với lòng thùng xe",
  "customerAdvisoryNote": "Lời tư vấn lịch sự, chuyên nghiệp gửi trực tiếp cho khách hàng giải thích vì sao chọn phương án xe này và mức giá cước đi kèm để khách yên tâm bấm đồng ý chốt",
  "loadingTips": "Gợi ý ngắn gọn cách xếp ${order.package_count || 1} ${order.package_unit || 'kiện'} lên thùng xe"
}`;

  const result = await callGeminiGenerateContent(prompt, true);
  return {
    model: result.model,
    ...result.data
  };
};

/**
 * 3. Trợ lý AI Phân tích Sơ đồ Xếp hàng 3D & Hướng dẫn Bốc xếp An toàn
 */
const analyzeLoadPlan3D = async (payload = {}) => {
  const { truck = {}, summary = {}, cargoSpecDetails = [], stops = [] } = payload;

  const prompt = `Bạn là Chuyên gia Kỹ thuật Xếp dỡ Hàng hóa 3D (Load Planning Engineer) của NEXLOG.
Hãy phân tích sơ đồ xếp hàng 3D hiện tại trên xe tải và đưa ra hướng dẫn bốc xếp thực tế cho đội kho & tài xế:

- Thông số lòng thùng xe: Dài ${truck.length_cm}cm x Rộng ${truck.width_cm}cm x Cao ${truck.height_cm}cm (Tải cho phép: ${truck.max_payload} kg, Thể tích: ${summary.maxVolume} m³)
- Tổng số kiện đã xếp: ${summary.packedPackagesCount}/${summary.totalPackagesCount} kiện (Tràn: ${summary.overflowPackagesCount || 0} kiện)
- Tổng khối lượng: ${summary.totalWeight} kg (${summary.weightPercent}% tải trọng)
- Tổng thể tích: ${summary.totalVolume} m³ (${summary.volumePercent}% dung tích)
- Chi tiết hàng hóa: ${JSON.stringify(cargoSpecDetails)}
- Danh sách điểm trả hàng (LIFO): ${stops.map((s) => `${s.name} (${s.packageCount} kiện, ${s.weight} kg)`).join('; ')}

Trả về JSON với cấu trúc:
{
  "safetyStatus": "SAFE | WARNING | OVERLOADED",
  "headline": "Đánh giá tổng quan 1 câu về độ an toàn trọng tâm và tỷ lệ lấp đầy thùng xe",
  "stepByStepInstructions": [
    "Bước 1: Hướng dẫn xếp lớp sàn, vị trí sát đầu xe...",
    "Bước 2: Hướng dẫn xếp chồng tầng trên, chằng buộc dây tăng đơ hoặc màng PE...",
    "Bước 3: Hướng dẫn thứ tự dỡ hàng tại điểm giao..."
  ],
  "driverChecklist": "Lưu ý kiểm tra kẹp chì niêm phong Seal và phanh lốp với mức tải trọng hiện tại"
}`;

  const result = await callGeminiGenerateContent(prompt, true);
  return {
    model: result.model,
    ...result.data
  };
};

/**
 * 4. Tự động scan thông tin từ bộ chứng từ khách hàng đã upload (Packing List, Invoice, v.v.)
 * để tự điền form Tờ khai hải quan điện tử (VNACCS) bằng Gemini AI
 */
const autoScanCustomsDeclaration = async (payload = {}) => {
  const { order = {}, uploadedDocs = [] } = payload;
  const docSummary = (uploadedDocs || []).map(d => ({
    name: d.name,
    file: d.file,
    categoryName: d.categoryName
  }));

  const prompt = `Bạn là Trợ lý AI Hải quan cao cấp của Hệ thống thông quan hàng hóa ALS / VNACCS.
Khách hàng vừa ký hợp đồng vận chuyển cho đơn hàng:
- Mã đơn: ${order.order_id || order.order_code || order.id}
- Khách hàng (Người nhập khẩu/xuất khẩu): ${order.customer || order.customer_name || 'Công ty CP'}
- Loại hàng: ${order.cargo_name || order.cargo_description || 'Linh kiện điện tử'}
- Số lượng: ${order.package_count || 1} ${order.package_unit || 'kiện'}
- Tổng trọng lượng thực: ${order.actual_weight_kg || order.weight || 0} kg
- Tải trọng tính cước: ${order.chargeable_weight_kg || order.chargeable || 0} kg
- Danh sách chứng từ khách đã nộp: ${JSON.stringify(docSummary)}
- Chi tiết các mặt hàng trong đơn: ${JSON.stringify(order.items || [])}

Hãy trích xuất thông tin nghiệp vụ và tự động điền Tờ khai hải quan điện tử chuẩn xác (VNACCS/VCIS):
1. Số tờ khai hải quan giả định chuẩn định dạng (12 chữ số)
2. Mã loại hình tờ khai (ví dụ: A11 - Nhập kinh doanh tiêu dùng, A12 - Nhập kinh doanh sản xuất, E21 - Nhập gia công, B11 - Xuất kinh doanh...)
3. Phân luồng hải quan dự kiến (GREEN - Luồng Xanh, YELLOW - Luồng Vàng, RED - Luồng Đỏ)
4. Mã địa điểm lưu kho / làm thủ tục hải quan tại ALS (01B1A02 - Ga hàng hóa ALS Nội Bài hoặc ICD tương ứng)
5. Trị giá tính thuế ước tính (USD và quy đổi VNĐ)
6. Danh mục hàng hóa với mã HS (HS Code 8 số) dự kiến phù hợp nhất với tên hàng
7. Tên tệp tờ khai phát hành: Tờ_khai_hải_quan_${order.order_id || order.order_code || 'NEX'}_ĐÃ_SCAN.pdf

Trả về JSON với cấu trúc:
{
  "declarationNumber": "105892341234",
  "declarationType": "A11",
  "declarationTypeName": "Nhập kinh doanh tiêu dùng",
  "customsOffice": "Chi cục Hải quan Cửa khẩu Sân bay Quốc tế Nội Bài (Mã: 01B1)",
  "customsWarehouse": "01B1A02 - Kho Hàng Hóa ALS Nội Bài",
  "channel": "GREEN",
  "channelName": "Luồng Xanh (Thông quan tự động)",
  "hsCode": "8544.42.99",
  "taxableValueUsd": 12500,
  "taxableValueVnd": 318000000,
  "fileName": "To_khai_hai_quan_${order.order_id || order.order_code || 'NEX'}_VNACCS.pdf",
  "fileSize": "245 KB",
  "summaryNote": "Hệ thống đã tự động trích xuất thông tin từ Hóa đơn thương mại và Packing List do khách hàng cung cấp."
}`;

  const result = await callGeminiGenerateContent(prompt, true);
  return {
    model: result.model,
    ...result.data
  };
};

module.exports = {
  callGeminiGenerateContent,
  analyzeCustomsDocuments,
  analyzeVehicleAndQuote,
  analyzeLoadPlan3D,
  autoScanCustomsDeclaration
};

