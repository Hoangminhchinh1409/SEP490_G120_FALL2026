const express = require('express');
const router = express.Router();
const fleetController = require('./fleet.controller');

// Trucks
router.get('/trucks', (req, res) => fleetController.getFleetTrucks(req, res));
router.post('/trucks', (req, res) => fleetController.createFleetTruck(req, res));
router.patch('/trucks/:id', (req, res) => fleetController.updateFleetTruck(req, res));

// Drivers
router.get('/drivers', (req, res) => fleetController.getFleetDrivers(req, res));
router.patch('/drivers/:id', (req, res) => fleetController.updateFleetDriver(req, res));

// Vendors
router.get('/vendors', (req, res) => fleetController.getFleetVendors(req, res));

module.exports = router;
