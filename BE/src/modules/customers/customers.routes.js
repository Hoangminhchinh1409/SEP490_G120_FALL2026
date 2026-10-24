const express = require('express');
const router = express.Router();
const customerController = require('./customers.controller');

router.get('/contracts', (req, res) => customerController.getAllContracts(req, res));
router.post('/contracts', (req, res) => customerController.createContract(req, res));
router.get('/', (req, res) => customerController.getAllCustomers(req, res));

module.exports = router;
