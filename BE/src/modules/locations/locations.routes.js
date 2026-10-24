const express = require('express');
const router = express.Router();
const locationController = require('./locations.controller');

router.get('/', (req, res) => locationController.getAllLocations(req, res));
router.post('/', (req, res) => locationController.createLocation(req, res));
router.put('/:id', (req, res) => locationController.updateLocation(req, res));
router.delete('/:id', (req, res) => locationController.deleteLocation(req, res));

module.exports = router;
