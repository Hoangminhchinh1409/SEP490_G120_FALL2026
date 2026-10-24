// Delegate to Modular Customers Controller
const customerController = require('../../src/modules/customers/customers.controller');

module.exports = {
  getAllContracts: (req, res) => customerController.getAllContracts(req, res),
  createContract: (req, res) => customerController.createContract(req, res),
  getAllCustomers: (req, res) => customerController.getAllCustomers(req, res)
};