const {
  cloudinary,
  isCloudinaryConfigured,
  assertCloudinaryConfigured
} = require('../config/cloudinary');

/**
 * Service tích hợp Cloudinary Storage theo quy chuẩn hệ thống (API-02: Upload/Sign, API-03: Delete)
 */
class CloudinaryService {
  isConfigured() {
    return isCloudinaryConfigured();
  }

  /**
   * Sinh Signature để Client (Driver PWA, Web Portal) upload trực tiếp lên Cloudinary CDN
   */
  generateUploadSignature(folder = 'nexlog/documents') {
    const { cloud_name, api_key, api_secret } = assertCloudinaryConfigured();
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      timestamp,
      folder
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, api_secret);

    return {
      cloudName: cloud_name,
      apiKey: api_key,
      timestamp,
      folder,
      signature
    };
  }

  /**
   * Upload tệp base64 (data URI) hoặc buffer lên Cloudinary thật
   */
  async uploadFile(fileContent, folder = 'nexlog/general') {
    assertCloudinaryConfigured();
    const uploadResult = await cloudinary.uploader.upload(fileContent, {
      folder,
      resource_type: 'auto'
    });
    return {
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes
    };
  }

  /**
   * Nếu đầu vào là data URI base64 thì upload lên Cloudinary và trả về URL https://res.cloudinary.com/...
   * Nếu đã là HTTP(S) URL thì giữ nguyên.
   */
  async uploadDataUriIfNeeded(value, folder = 'nexlog/general') {
    if (!value || typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith('data:')) {
      return trimmed;
    }
    const res = await this.uploadFile(trimmed, folder);
    return res.url;
  }

  /**
   * Xóa tệp khỏi Cloudinary (API-03)
   */
  async deleteFile(publicId) {
    assertCloudinaryConfigured();
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      result: result.result
    };
  }
}

module.exports = new CloudinaryService();
