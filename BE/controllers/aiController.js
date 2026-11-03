const aiService = require('../services/aiService');

const handleAiError = (res, operation, err) => {
  console.error(`AI ${operation} failed:`, {
    name: err.name,
    code: err.code || null
  });
  const statusCode = err.statusCode === 400 ? 400 : err.statusCode === 503 ? 503 : 502;
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 400
      ? err.message
      : 'Dịch vụ AI hiện không khả dụng. Vui lòng thử lại sau.'
  });
};

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
    return handleAiError(res, 'analyzeCustomsDocuments', err);
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
    return handleAiError(res, 'analyzeVehicleAndQuote', err);
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
    return handleAiError(res, 'analyzeLoadPlan3D', err);
  }
};

const autoScanCustomsDeclaration = async (req, res) => {
  try {
    const result = await aiService.autoScanCustomsDeclaration(req.body);
    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    return handleAiError(res, 'autoScanCustomsDeclaration', err);
  }
};

module.exports = {
  analyzeCustomsDocuments,
  analyzeVehicleAndQuote,
  analyzeLoadPlan3D,
  autoScanCustomsDeclaration
};
