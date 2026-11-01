const cloudinary = require('../config/cloudinary');

/**
 * Service tích hợp Cloudinary Storage theo đặc tả SRS (API-02: Upload/Sign, API-03: Delete)
 */
class CloudinaryService {
  /**
   * Sinh Signature để Client (Driver PWA, Web Portal) upload trực tiếp lên Cloudinary CDN
   * @param {Object} params - { folder, public_id, timestamp }
   */
  generateUploadSignature(folder = 'nexlog/documents') {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      timestamp,
      folder
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || 'abcdefghijklmnopqrstuvwxyz'
    );

    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'nexlog-cdn',
      apiKey: process.env.CLOUDINARY_API_KEY || '123456789012345',
      timestamp,
      folder,
      signature
    };
  }

  /**
   * Upload tệp base64 hoặc file buffer/URL lên Cloudinary
   * @param {string} fileContent - Base64 string hoặc URL
   * @param {string} folder - Thư mục lưu trữ
   */
  async uploadFile(fileContent, folder = 'nexlog/general') {
    try {
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
    } catch (error) {
      console.error('CloudinaryService uploadFile error:', error);
      throw error;
    }
  }

  /**
   * Xóa tệp khỏi Cloudinary (API-03)
   * @param {string} publicId - Public ID của tệp trên Cloudinary
   */
  async deleteFile(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return {
        success: result.result === 'ok',
        result: result.result
      };
    } catch (error) {
      console.error('CloudinaryService deleteFile error:', error);
      throw error;
    }
  }
}

module.exports = new CloudinaryService();

