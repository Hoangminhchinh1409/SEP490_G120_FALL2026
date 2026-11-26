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
 */
const callGeminiGenerateContent = async (promptText, responseJson = true) => {
  if (!isGeminiEnabled()) {
    const err = new Error("Tính năng kết nối Gemini AI đang tạm dừng (GEMINI_ENABLED=false hoặc chưa cấu hình GEMINI_API_KEY).");
    err.statusCode = 400;
    throw err;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  let lastError = null;
  const parts = [{ text: String(promptText || "") }];

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
 * Trích xuất tên tỉnh/thành phố từ địa chỉ chi tiết để đảm bảo quyền riêng tư (BUG-CD-01)
 */
const extractProvinceOnly = (address = "") => {
  const raw = String(address || "").trim();
  if (!raw) return "Chưa xác định";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "Chưa xác định";
  const last = parts[parts.length - 1];
  if (/^(việt nam|vietnam|vn)$/i.test(last) && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return last;
};

/**
 * Trợ lý AI Phân tích & Gợi ý Chứng từ Hải quan Xuất Nhập Khẩu
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
      aiSummary: "Phân tích tự động theo bộ quy tắc nghiệp vụ hải quan nội bộ. Vui lòng đối chiếu mã HS thực tế trên Invoice & Packing List.",
      riskNotes: [
        "Kiểm tra khớp số kiện và trọng lượng Gross Weight giữa Vận đơn và Packing List.",
        "Đảm bảo nhãn phụ hàng hóa đầy đủ thông tin xuất xứ trước khi thông quan.",
      ],
      recommendedSpecializedDocs: docs,
    };
  }

  const pickupProvince = extractProvinceOnly(order.pickup_address || order.pickup || "");
  const deliveryProvince = extractProvinceOnly(order.delivery_address || order.dropoff || "");

  const prompt = `Bạn là Chuyên gia Thủ tục Hải quan & Logistics Xuất Nhập Khẩu tại Việt Nam (Hệ thống NEXLOG).
Hãy phân tích thông tin lô hàng dưới đây và trả về kết quả JSON chuẩn xác để tư vấn bộ chứng từ cần nộp:

- Mô tả lô hàng: "${cargoDesc}"
- Tên hàng trong đơn: "${order.cargo_name || ""}"
- Loại hàng: "${order.cargo_type || ""}"
- Số lượng / Quy cách: "${order.package_count || ""} ${order.package_unit || ""}"
- Trọng lượng: "${order.weight || order.actual_weight_kg || ""} kg"
- Tuyến vận chuyển (Tỉnh/Thành phố): "${pickupProvince} -> ${deliveryProvince}"

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

module.exports = {
  callGeminiGenerateContent,
  analyzeCustomsDocuments,
};
