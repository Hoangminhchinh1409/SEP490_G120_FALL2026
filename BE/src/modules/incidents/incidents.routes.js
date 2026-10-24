const express = require('express');
const router = express.Router();
const incidentController = require('./incidents.controller');

router.get('/', (req, res) => incidentController.getAllIncidents(req, res));
router.post('/', (req, res) => incidentController.createIncident(req, res));
router.patch('/:id/status', (req, res) => incidentController.updateIncidentStatus(req, res));

module.exports = router;
