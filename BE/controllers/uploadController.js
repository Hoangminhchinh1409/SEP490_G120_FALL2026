const cloudinaryService = require('../services/cloudinaryService');

/**
 * Controller xử lý Upload và sinh chữ ký upload Cloudinary
 */
const getUploadSignature = async (req, res) => {
  try {
    const { folder } = req.body || {};
    const signData = cloudinaryService.generateUploadSignature(folder || 'nexlog/uploads');
    return res.status(200).json({
      success: true,
      ...signData
    });
  } catch (error) {
    console.error('getUploadSignature Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể khởi tạo chữ ký tải ảnh Cloudinary',
      error: error.message
    });
  }
};

const uploadDirect = async (req, res) => {
  try {
    const { file, folder } = req.body || {};
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp dữ liệu ảnh hoặc tài liệu cần tải lên'
      });
    }

    const result = await cloudinaryService.uploadFile(file, folder || 'nexlog/uploads');
    return res.status(200).json({
      success: true,
      message: 'Tải ảnh lên Cloudinary thành công',
      data: result
    });
  } catch (error) {
    console.error('uploadDirect Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải tệp lên Cloudinary',
      error: error.message
    });
  }
};

module.exports = {
  getUploadSignature,
  uploadDirect
};

