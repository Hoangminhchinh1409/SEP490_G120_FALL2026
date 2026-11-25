const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
];

const isGeminiEnabled = () => {
  if (String(process.env.GEMINI_ENABLED || "").toLowerCase() === "false") {
    return false;
  }
  return Boolean(process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim());
};

/**
 * Gọi Google Gemini Generative Language API với cơ chế tự động fallback model
 * Hỗ trợ cả text prompt và multimodal inline data (file base64 / mimeType)
 */
const callGeminiGenerateContent = async (promptInput, responseJson = true) => {
  if (!isGeminiEnabled()) {
    const err = new Error("Tính năng kết nối Gemini AI đang tạm dừng (GEMINI_ENABLED=false hoặc chưa cấu hình GEMINI_API_KEY).");
    err.statusCode = 400;
    throw err;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  let lastError = null;

  let parts = [];
  if (typeof promptInput === "string") {
    parts = [{ text: promptInput }];
  } else if (Array.isArray(promptInput)) {
    parts = promptInput;
  } else if (typeof promptInput === "object" && promptInput !== null) {
    if (promptInput.inlineData) {
      parts = [
        { inlineData: promptInput.inlineData },
        {
          text:
            promptInput.text ||
            "Trích xuất thông tin chi tiết từ tài liệu này.",
        },
      ];
    } else if (promptInput.text) {
      parts = [{ text: promptInput.text }];
    }
  }

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const bodyPayload = {
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.1,
          thinkingConfig: {
            thinkingBudget: 0,
          },
          ...(responseJson ? { responseMimeType: "application/json" } : {}),
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errBody = await res.text();
        lastError = new Error(
          `Gemini API (${modelName}) HTTP ${res.status}: ${errBody}`,
        );
        continue;
      }

      const data = await res.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("")
          .trim() || "";

      if (!rawText) {
        lastError = new Error(
          `Gemini API (${modelName}) returned empty content`,
        );
        continue;
      }

      if (responseJson) {
        const cleaned = rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        return {
          model: data.modelVersion || modelName,
          data: JSON.parse(cleaned),
        };
      }

      return {
        model: data.modelVersion || modelName,
        text: rawText,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Không thể kết nối tới Google Gemini AI");
};

/**
 * 1. Trợ lý AI Phân tích & Gợi ý Chứng từ Hải quan Xuất Nhập Khẩu
 */
const analyzeCustomsDocuments = async (payload = {}) => {
  const { cargoDesc = "", order = {} } = payload;

  if (!isGeminiEnabled()) {
    const text = `${cargoDesc} ${order.cargo_name || ""} ${order.cargo_type || ""}`.toLowerCase();
    let categoryKey = "GENERAL";
    let categoryName = "1. Hàng thông thường (Tiêu dùng, linh kiện điện tử mới, thời trang...)";
    let hsCodeSuggestion = "Chương 84 / 85 - Máy móc, thiết bị điện tử & hàng tiêu dùng thông thường";
    let docs = [
      {
        name: "Giấy chứng nhận xuất xứ (C/O)",
        shortCode: "C/O",
        description: "Xác nhận xuất xứ hàng hóa để hưởng ưu đãi thuế quan theo hiệp định thương mại.",
      },
    ];

    if (/(nông sản|thực phẩm|trái cây|rau|thịt|thủy sản|động vật|thực vật|perishable)/.test(text)) {
      categoryKey = "AGRI_FOOD";
      categoryName = "2. Hàng nông sản, thực phẩm, động thực vật sống";
      hsCodeSuggestion = "Chương 02 - 21 - Nông sản, thực phẩm & chế phẩm ăn được";
      docs = [
        { name: "Giấy chứng nhận kiểm dịch thực vật / động vật (Phytosanitary / Veterinary)", shortCode: "PHYTO", description: "Xác nhận lô hàng không mang mầm bệnh, sinh vật gây hại." },
        { name: "Giấy đăng ký kiểm tra An toàn thực phẩm", shortCode: "ATTP", description: "Phục vụ kiểm tra chuyên ngành trước khi thông quan." },
      ];
    } else if (/(hóa chất|mỹ phẩm|dược phẩm|thuốc|pin|dung dịch)/.test(text)) {
      categoryKey = "CHEMICAL_PHARMA";
      categoryName = "3. Hàng hóa chất, mỹ phẩm, dược phẩm";
      hsCodeSuggestion = "Chương 28 - 38 - Sản phẩm công nghiệp hóa chất, dược phẩm, mỹ phẩm";
      docs = [
        { name: "Bảng chỉ dẫn an toàn hóa chất (MSDS)", shortCode: "MSDS", description: "Khai báo thành phần hóa học và quy chuẩn an toàn vận chuyển." },
        { name: "Phiếu công bố sản phẩm / Giấy phép nhập khẩu", shortCode: "LICENSE", description: "Chứng từ quản lý chuyên ngành của Bộ Y tế / Bộ Công Thương." },
      ];
    } else if (/(gỗ|nội thất gỗ|ván ép|pallet gỗ)/.test(text)) {
      categoryKey = "WOOD_PRODUCTS";
      categoryName = "4. Hàng gỗ và sản phẩm từ gỗ";
      hsCodeSuggestion = "Chương 44 - Gỗ và các mặt hàng bằng gỗ";
      docs = [
        { name: "Giấy chứng nhận hun trùng (Fumigation Certificate)", shortCode: "FUMI", description: "Xác nhận gỗ/pallet gỗ đã được xử lý khử trùng đạt chuẩn ISPM 15." },
        { name: "Bảng kê lâm sản hợp pháp", shortCode: "TIMBER", description: "Xác nhận nguồn gốc gỗ hợp pháp khi làm thủ tục hải quan." },
      ];
    } else if (/(máy cũ|thiết bị cũ|đã qua sử dụng)/.test(text)) {
      categoryKey = "USED_MACHINERY";
      categoryName = "5. Hàng máy móc thiết bị cũ / Đã qua sử dụng";
      hsCodeSuggestion = "Chương 84 / 85 - Máy móc thiết bị đã qua sử dụng (QĐ 18/2019/QĐ-TTg)";
      docs = [
        { name: "Chứng thư giám định tuổi thiết bị & chất lượng còn lại", shortCode: "INSPECT", description: "Bắt buộc theo Quyết định 18/2019/QĐ-TTg đối với máy móc đã qua sử dụng." },
      ];
    }

    return {
      model: "rule-based-offline",
      categoryKey,
      categoryName,
      hsCodeSuggestion,
      aiSummary: "Phân tích tự động theo bộ quy tắc nghiệp vụ hải quan nội bộ (chế độ tiết kiệm không dùng API key ngoài). Vui lòng đối chiếu mã HS thực tế trên Invoice & Packing List.",
      riskNotes: [
        "Kiểm tra khớp số kiện và trọng lượng Gross Weight giữa Vận đơn và Packing List.",
        "Đảm bảo nhãn phụ hàng hóa đầy đủ thông tin xuất xứ trước khi thông quan.",
      ],
      recommendedSpecializedDocs: docs,
    };
  }

  const prompt = `Bạn là Chuyên gia Thủ tục Hải quan & Logistics Xuất Nhập Khẩu tại Việt Nam (Hệ thống NEXLOG).
Hãy phân tích thông tin lô hàng dưới đây và trả về kết quả JSON chuẩn xác để tư vấn bộ chứng từ cần nộp:

- Mô tả lô hàng: "${cargoDesc}"
- Tên hàng trong đơn: "${order.cargo_name || ""}"
- Loại hàng: "${order.cargo_type || ""}"
- Số lượng / Quy cách: "${order.package_count || ""} ${order.package_unit || ""}"
- Trọng lượng: "${order.weight || order.actual_weight_kg || ""} kg"
- Tuyến vận chuyển: "${order.pickup_address || order.pickup || ""} -> ${order.delivery_address || order.dropoff || ""}"

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
    ...result.data,
  };
};

/**
 * 2. Trợ lý AI Phân tích Phương án Xe tải, Thẩm định Kích thước & Soạn ghi chú tư vấn gửi khách
 */
const analyzeVehicleAndQuote = async (payload = {}) => {
  const {
    order = {},
    customerRequestedVehicle = "2.5T",
    systemRecommendedVehicle = "3.5T",
    distanceKm = 30,
    estimatedPriceVnd = 2500000,
  } = payload;

  if (!isGeminiEnabled()) {
    return {
      model: "rule-based-offline",
      recommendedVehicleKey: systemRecommendedVehicle,
      technicalAssessment: `Đối chiếu tổng trọng lượng (${order.weight || order.actual_weight_kg || 0} kg) và tải trọng tính cước (${order.chargeable || order.chargeable_weight_kg || 0} kg) trên quãng đường ${distanceKm} km, phương án xe ${systemRecommendedVehicle} đảm bảo an toàn tải trọng và tối ưu không gian thùng xe.`,
      customerAdvisoryNote: `Kính gửi Quý khách, dựa trên quy cách và tổng khối lượng lô hàng, ALS đề xuất phương án vận chuyển bằng xe ${systemRecommendedVehicle} với mức cước dự kiến ${Number(estimatedPriceVnd).toLocaleString("vi-VN")} VNĐ cho lộ trình ${distanceKm} km nhằm đảm bảo an toàn hàng hóa và đúng tiến độ giao nhận.`,
      loadingTips: `Xếp các kiện nặng xuống mặt sàn sát thành trước thùng xe, chằng buộc cố định trước khi niêm chì.`,
    };
  }

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
- Mặt hàng: ${order.cargo_name || "Hàng hóa"} (${order.cargo_type || "GENERAL"})
- Số lượng: ${order.package_count || 1} ${order.package_unit || "kiện"}
- Kích thước khai báo (DxRxC): ${order.length_cm || 0} x ${order.width_cm || 0} x ${order.height_cm || 0} cm
- Trọng lượng thực tế: ${order.weight || order.actual_weight_kg || 0} kg
- Tải trọng tính cước: ${order.chargeable || order.chargeable_weight_kg || 0} kg
- Quãng đường bộ thực tế: ${distanceKm} km (${order.pickup_address || order.pickup || ""} -> ${order.delivery_address || order.dropoff || ""})
- Xe khách chọn ban đầu: ${customerRequestedVehicle}
- Xe hệ thống tính toán: ${systemRecommendedVehicle}
- Giá cước hệ thống tạm tính: ${Number(estimatedPriceVnd).toLocaleString("vi-VN")} VNĐ

Trả về JSON với cấu trúc:
{
  "recommendedVehicleKey": "Mã xe tối ưu (1.25T | 2.5T | 3.5T | 5T | 8T | 15T)",
  "technicalAssessment": "Phân tích kỹ thuật (2-3 câu) đối chiếu kích thước DxRxC cm, thể tích m3 và tải trọng kg với lòng thùng xe",
  "customerAdvisoryNote": "Lời tư vấn lịch sự, chuyên nghiệp gửi trực tiếp cho khách hàng giải thích vì sao chọn phương án xe này và mức giá cước đi kèm để khách yên tâm bấm đồng ý chốt",
  "loadingTips": "Gợi ý ngắn gọn cách xếp ${order.package_count || 1} ${order.package_unit || "kiện"} lên thùng xe"
}`;

  const result = await callGeminiGenerateContent(prompt, true);
  return {
    model: result.model,
    ...result.data,
  };
};

/**
 * 3. Trợ lý AI Phân tích Sơ đồ Xếp hàng 3D & Hướng dẫn Bốc xếp An toàn
 */
const analyzeLoadPlan3D = async (payload = {}) => {
  const {
    truck = {},
    summary = {},
    cargoSpecDetails = [],
    stops = [],
  } = payload;

  if (!isGeminiEnabled()) {
    const isOver = (summary.overflowPackagesCount || 0) > 0 || Number(summary.weightPercent || 0) > 100;
    return {
      model: "rule-based-offline",
      safetyStatus: isOver ? "OVERLOADED" : Number(summary.weightPercent || 0) > 85 ? "WARNING" : "SAFE",
      headline: `Sơ đồ xếp ${summary.packedPackagesCount || 0}/${summary.totalPackagesCount || 0} kiện đạt ${summary.weightPercent || 0}% tải trọng và ${summary.volumePercent || 0}% thể tích thùng xe.`,
      stepByStepInstructions: [
        "Bước 1: Xếp các kiện hàng nặng và đế phẳng ở lớp sàn sát vách cabin để ổn định trọng tâm xe.",
        "Bước 2: Xếp các kiện nhẹ/dễ vỡ lên tầng trên, dùng dây tăng đơ và màng quấn PE cố định chống xê dịch.",
        "Bước 3: Xếp hàng theo nguyên tắc LIFO (điểm giao sau xếp vào trong, điểm giao trước xếp gần cửa thùng).",
      ],
      driverChecklist: "Kiểm tra niêm phong chì (Seal), khóa chốt cửa thùng và áp suất lốp trước khi xuất bến.",
    };
  }

  const prompt = `Bạn là Chuyên gia Kỹ thuật Xếp dỡ Hàng hóa 3D (Load Planning Engineer) của NEXLOG.
Hãy phân tích sơ đồ xếp hàng 3D hiện tại trên xe tải và đưa ra hướng dẫn bốc xếp thực tế cho đội kho & tài xế:

- Thông số lòng thùng xe: Dài ${truck.length_cm}cm x Rộng ${truck.width_cm}cm x Cao ${truck.height_cm}cm (Tải cho phép: ${truck.max_payload} kg, Thể tích: ${summary.maxVolume} m³)
- Tổng số kiện đã xếp: ${summary.packedPackagesCount}/${summary.totalPackagesCount} kiện (Tràn: ${summary.overflowPackagesCount || 0} kiện)
- Tổng khối lượng: ${summary.totalWeight} kg (${summary.weightPercent}% tải trọng)
- Tổng thể tích: ${summary.totalVolume} m³ (${summary.volumePercent}% dung tích)
- Chi tiết hàng hóa: ${JSON.stringify(cargoSpecDetails)}
- Danh sách điểm trả hàng (LIFO): ${stops.map((s) => `${s.name} (${s.packageCount} kiện, ${s.weight} kg)`).join("; ")}

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
    ...result.data,
  };
};

/**
 * 4. Tự động scan thông tin từ bộ chứng từ khách hàng đã upload (Packing List, Invoice, v.v.)
 * để tự điền form Tờ khai hải quan điện tử (VNACCS) bằng Gemini AI
 */
const autoScanCustomsDeclaration = async (payload = {}) => {
  const { order = {}, uploadedDocs = [] } = payload;
  const docSummary = (uploadedDocs || []).map((d) => ({
    name: d.name,
    file: d.file,
    categoryName: d.categoryName,
  }));

  if (!isGeminiEnabled()) {
    const code = order.order_id || order.order_code || "NEX";
    return {
      model: "rule-based-offline",
      declarationNumber: `106${Math.floor(100000000 + Math.random() * 900000000)}`,
      declarationType: "A11",
      declarationTypeName: "Nhập kinh doanh tiêu dùng",
      customsOffice: "Chi cục Hải quan Cửa khẩu Sân bay Quốc tế Nội Bài (Mã: 01B1)",
      customsWarehouse: "01B1A02 - Kho Hàng Hóa ALS Nội Bài",
      channel: "GREEN",
      channelName: "Luồng Xanh (Thông quan tự động)",
      hsCode: "8544.42.99",
      taxableValueUsd: 10000,
      taxableValueVnd: 255000000,
      fileName: `To_khai_hai_quan_${code}_VNACCS.pdf`,
      fileSize: "240 KB",
      summaryNote: "Khởi tạo thông tin tờ khai theo bộ quy tắc mặc định nội bộ (đang tạm dừng kết nối Gemini API).",
    };
  }

  const prompt = `Bạn là Trợ lý AI Hải quan cao cấp của Hệ thống thông quan hàng hóa ALS / VNACCS.
Khách hàng vừa ký hợp đồng vận chuyển cho đơn hàng:
- Mã đơn: ${order.order_id || order.order_code || order.id}
- Khách hàng (Người nhập khẩu/xuất khẩu): ${order.customer || order.customer_name || "Công ty CP"}
- Loại hàng: ${order.cargo_name || order.cargo_description || "Linh kiện điện tử"}
- Số lượng: ${order.package_count || 1} ${order.package_unit || "kiện"}
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
7. Tên tệp tờ khai phát hành: Tờ_khai_hải_quan_${order.order_id || order.order_code || "NEX"}_ĐÃ_SCAN.pdf

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
  "fileName": "To_khai_hai_quan_${order.order_id || order.order_code || "NEX"}_VNACCS.pdf",
  "fileSize": "245 KB",
  "summaryNote": "Hệ thống đã tự động trích xuất thông tin từ Hóa đơn thương mại và Packing List do khách hàng cung cấp."
}`;

  const result = await callGeminiGenerateContent(prompt, true);
  return {
    model: result.model,
    ...result.data,
  };
};

/**
 * 5. AI DOCUMENT AGENT: Đọc tệp PDF hoặc ảnh Tờ khai hải quan / Chứng từ vận chuyển qua OCR
 * Trích xuất toàn bộ thông tin đơn hàng để tự động điền form Dispatcher trong vòng <= 15s.
 */
const extractOrderFromDocument = async (payload = {}) => {
  const {
    fileBase64,
    mimeType = "application/pdf",
    fileName = "",
    textContent = "",
  } = payload;

  const extractionPrompt = `Bạn là Chuyên gia AI OCR & Nghiệp vụ Logistic Hải quan của hệ thống ALS Logistics.
Nhiệm vụ của bạn là đọc và trích xuất dữ liệu thực tế từ tài liệu đính kèm (Tờ khai hải quan thông quan Việt Nam, hoặc Packing List/Invoice).
Hãy trích xuất chính xác các thông tin sau và trả về định dạng JSON thuần túy (RFC 8259).

LƯU Ý NGHIỆP VỤ QUAN TRỌNG:
1. "order_type": Xác định là "IMPORT" (Hàng nhập khẩu về Việt Nam qua Nội Bài/Cảng) hoặc "EXPORT" (Hàng xuất khẩu đi nước ngoài).
2. "customer_name": Tên doanh nghiệp nhập khẩu/xuất khẩu tại Việt Nam (không lấy tên hãng bay).
3. "customer_tax_code": Mã số thuế doanh nghiệp (10 hoặc 13 số).
4. "customer_phone": Số điện thoại liên hệ của người nhận/gửi nếu có trong tài liệu.
5. "customer_email": Email nếu có.
6. "pickup_address": Địa điểm lấy hàng (Ví dụ: "Kho hàng ALS Nội Bài, Sóc Sơn, Hà Nội" nếu là hàng nhập; hoặc địa chỉ kho nhà máy nếu là hàng xuất).
7. "delivery_address": Địa chỉ giao hàng cuối cùng tại Việt Nam (ghi rõ số nhà, đường, quận/huyện, tỉnh thành phố).
8. "receiver_name": Tên người đại diện nhận hàng hoặc tên công ty nhận hàng.
9. "receiver_phone": Số điện thoại người nhận hàng.
10. "declaration_number": Số tờ khai hải quan (nếu có, 12 số).
11. "cargo_lines": Danh sách các dòng mặt hàng cụ thể gồm:
    - cargo_name: Tên mặt hàng tiếng Việt hoặc tiếng Anh
    - package_count: Số lượng kiện (số nguyên >= 1)
    - package_unit: Đơn vị tính (Kiện / Thùng / Pallet / Hộp / Cuộn / Bao)
    - actual_weight_kg: Trọng lượng thực tế (Gross weight) tính bằng kg (số dương)
    - length_cm: Chiều dài mỗi kiện (cm, ước tính theo tiêu chuẩn hoặc trích xuất từ Packing List)
    - width_cm: Chiều rộng mỗi kiện (cm)
    - height_cm: Chiều cao mỗi kiện (cm)
    - stackable: Hàng có được xếp chồng không (true / false)
12. "special_handling": Yêu cầu bảo quản đặc biệt ("GENERAL" - Hàng bách hóa, "PERISHABLE" - Hàng tươi sống/nhiệt độ mát, "VALUABLE" - Hàng giá trị cao, "FRAGILE" - Hàng dễ vỡ).
13. "recommended_vehicle": Gợi ý loại xe tải phù hợp nhất dựa trên tổng trọng lượng và kích thước ("TRUCK_1.25T", "TRUCK_2.5T", "TRUCK_3.5T", "TRUCK_5T", "CONTAINER_20", "CONTAINER_40").

Cấu trúc JSON bắt buộc:
{
  "document_type": "CUSTOMS_DECLARATION | PACKING_LIST | OTHER",
  "order_type": "IMPORT | EXPORT",
  "declaration_number": "string",
  "customer_name": "string",
  "customer_tax_code": "string",
  "customer_phone": "string",
  "customer_email": "string",
  "pickup_address": "string",
  "delivery_address": "string",
  "receiver_name": "string",
  "receiver_phone": "string",
  "cargo_lines": [
    {
      "cargo_name": "string",
      "package_count": 1,
      "package_unit": "Kiện",
      "actual_weight_kg": 100,
      "length_cm": 60,
      "width_cm": 40,
      "height_cm": 40,
      "stackable": true
    }
  ],
  "total_actual_weight_kg": 100,
  "total_package_count": 1,
  "special_handling": "GENERAL",
  "recommended_vehicle": "TRUCK_1.25T",
  "notes": "Trích xuất tự động từ văn bản bởi ALS AI Document Agent",
  "confidence_score": 0.95
}`;

  let promptInput;
  if (fileBase64) {
    const cleanBase64 = fileBase64.includes("base64,")
      ? fileBase64.split("base64,")[1]
      : fileBase64;
    promptInput = [
      {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "application/pdf",
        },
      },
      {
        text: extractionPrompt + `\nTên tệp đính kèm: ${fileName}`,
      },
    ];
  } else {
    promptInput = `${extractionPrompt}\nNội dung văn bản nhận được:\n${textContent}`;
  }

  const result = await callGeminiGenerateContent(promptInput, true);
  return {
    model: result.model,
    ...result.data,
  };
};

module.exports = {
  callGeminiGenerateContent,
  analyzeCustomsDocuments,
  analyzeVehicleAndQuote,
  analyzeLoadPlan3D,
  autoScanCustomsDeclaration,
  extractOrderFromDocument,
};
