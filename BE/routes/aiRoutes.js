const express = require('express');
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/customs-documents', aiController.analyzeCustomsDocuments);
router.post('/vehicle-quote', aiController.analyzeVehicleAndQuote);
router.post('/load-plan', aiController.analyzeLoadPlan3D);
router.post('/scan-customs-declaration', aiController.autoScanCustomsDeclaration);

module.exports = router;
