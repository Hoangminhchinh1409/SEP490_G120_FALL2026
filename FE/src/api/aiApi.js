import { fetchWithoutAuth } from './apiClient';

export const aiApi = {
  // Phân tích & gợi ý chứng từ hải quan theo loại hàng hóa (qua BE)
  analyzeCustomsDocuments: async (payload) => {
    const res = await fetchWithoutAuth('/ai/customs-documents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  }
};
