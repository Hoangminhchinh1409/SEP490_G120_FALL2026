const aiService = require('../services/aiService');

/**
 * AI Controller — Tích hợp Google Gemini AI cho các tính năng thông minh của NEXLOG:
 * 1. Phân tích & gợi ý bộ chứng từ hải quan chuyên ngành
 * 2. Phân tích kỹ thuật chọn xe tải & soạn lời tư vấn báo giá gửi khách
 * 3. Phân tích sơ đồ xếp hàng 3D & hướng dẫn bốc xếp an toàn
 */

const analyzeCustomsDocuments = async (req, res) => {
  try {
    const result = await aiService.analyzeCustomsDocuments(req.body);
    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('AI analyzeCustomsDocuments error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kết nối Gemini AI khi phân tích chứng từ',
      error: err.message
    });
  }
};

const analyzeVehicleAndQuote = async (req, res) => {
  try {
    const result = await aiService.analyzeVehicleAndQuote(req.body);
    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('AI analyzeVehicleAndQuote error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kết nối Gemini AI khi phân tích phương án xe',
      error: err.message
    });
  }
};

const analyzeLoadPlan3D = async (req, res) => {
  try {
    const result = await aiService.analyzeLoadPlan3D(req.body);
    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('AI analyzeLoadPlan3D error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kết nối Gemini AI khi phân tích xếp hàng 3D',
      error: err.message
    });
  }
};

module.exports = {
  analyzeCustomsDocuments,
  analyzeVehicleAndQuote,
  analyzeLoadPlan3D
};

