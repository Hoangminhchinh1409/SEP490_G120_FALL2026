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
 * AI Controller — Trợ lý gợi ý bộ chứng từ hải quan chuyên ngành theo loại hàng hóa
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

module.exports = {
  analyzeCustomsDocuments
};
