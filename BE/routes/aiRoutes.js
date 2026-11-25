const express = require('express');
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/customs-documents', aiController.analyzeCustomsDocuments);

module.exports = router;
