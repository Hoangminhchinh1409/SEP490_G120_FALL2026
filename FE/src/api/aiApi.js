import { fetchWithoutAuth } from './apiClient';

export const aiApi = {
  // 1. Phân tích & gợi ý chứng từ hải quan bằng Gemini AI (qua BE)
  analyzeCustomsDocuments: async (payload) => {
    const res = await fetchWithoutAuth('/ai/customs-documents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  },

  // 2. Phân tích kỹ thuật chọn xe tải & soạn ghi chú tư vấn gửi khách (qua BE)
  analyzeVehicleAndQuote: async (payload) => {
    const res = await fetchWithoutAuth('/ai/vehicle-quote', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  },

  // 3. Phân tích sơ đồ xếp hàng 3D & hướng dẫn bốc xếp an toàn (qua BE)
  analyzeLoadPlan3D: async (payload) => {
    const res = await fetchWithoutAuth('/ai/load-plan', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  },

  // 4. Scan tự động bộ chứng từ khách nộp để tự sinh Tờ khai hải quan điện tử VNACCS
  autoScanCustomsDeclaration: async (payload) => {
    const res = await fetchWithoutAuth('/ai/scan-customs-declaration', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  }
};