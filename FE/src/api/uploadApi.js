import { fetchWithAuth } from './apiClient';
import { API_URL } from './apiConfig';

const readFileAsDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Không tìm thấy tệp để tải lên'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu tệp'));
    reader.readAsDataURL(file);
  });
};

export const uploadApi = {
  /**
   * Chuyển File thành Data URI để đẩy lên Cloudinary qua Back-end hoặc lưu hàng đợi offline
   */
  fileToDataUrl: readFileAsDataUrl,

  /**
   * Tải trực tiếp File hoặc Data URI lên Cloudinary thông qua API Back-end (/api/uploads/direct)
   * Có fallback fetch không gắn header auth nếu là cổng khách hàng công khai.
   */
  uploadToCloudinary: async (fileOrDataUrl, folder = 'nexlog/uploads', { requireAuthCookie = true } = {}) => {
    const filePayload =
      typeof fileOrDataUrl === 'string'
        ? fileOrDataUrl
        : await readFileAsDataUrl(fileOrDataUrl);

    if (requireAuthCookie) {
      const res = await fetchWithAuth('/uploads/direct', {
        method: 'POST',
        body: JSON.stringify({
          file: filePayload,
          folder
        })
      });
      const secureUrl = res?.url || res?.data?.url;
      if (!secureUrl) {
        throw new Error(res?.message || 'Không nhận được URL Cloudinary trả về');
      }
      return {
        url: secureUrl,
        public_id: res?.public_id || res?.data?.public_id || null,
        bytes: res?.data?.bytes || null,
        format: res?.data?.format || null
      };
    }

    const response = await fetch(`${API_URL}/uploads/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: filePayload, folder })
    });
    const resJson = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(resJson?.message || 'Lỗi tải tệp lên Cloudinary');
    }
    const secureUrl = resJson?.url || resJson?.data?.url;
    if (!secureUrl) {
      throw new Error('Không nhận được URL Cloudinary trả về');
    }
    return {
      url: secureUrl,
      public_id: resJson?.public_id || resJson?.data?.public_id || null,
      bytes: resJson?.data?.bytes || null,
      format: resJson?.data?.format || null
    };
  }
};
