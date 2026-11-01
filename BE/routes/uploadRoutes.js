const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// POST /api/v1/uploads/sign - Cấp chữ ký upload ảnh Cloudinary (API-03/API-02)
router.post('/sign', uploadController.getUploadSignature);

// POST /api/v1/uploads/direct - Upload trực tiếp tệp ảnh / tài liệu lên Cloudinary
router.post('/direct', uploadController.uploadDirect);

module.exports = router;

