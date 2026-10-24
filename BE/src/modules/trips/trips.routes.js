const express = require('express');
const router = express.Router();
const tripController = require('./trips.controller');

router.get('/', (req, res) => tripController.getAllTrips(req, res));
router.post('/', (req, res) => tripController.createTrip(req, res));
router.patch('/:id/status', (req, res) => tripController.updateTripStatus(req, res));

module.exports = router;
