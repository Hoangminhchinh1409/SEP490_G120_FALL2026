const express = require('express');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/customs-documents', aiController.analyzeCustomsDocuments);
router.post('/vehicle-quote', aiController.analyzeVehicleAndQuote);
router.post('/load-plan', aiController.analyzeLoadPlan3D);

module.exports = router;

