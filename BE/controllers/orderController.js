/**
 * Order Controller Barrel Export
 * Phân chia trách nhiệm các luồng nghiệp vụ Order:
 * - Query: BE/controllers/order/orderQueryController.js
 * - Creation: BE/controllers/order/orderCreationController.js
 * - Document & Pricing: BE/controllers/order/orderDocumentController.js
 * - Workflow (Confirm, Cancel, Close, Assign): BE/controllers/order/orderWorkflowController.js
 * - Helpers: BE/controllers/order/orderHelpers.js
 */

const {
  mapDbStatusToFe,
  generateTrackingToken,
  getOrCreateLocation
} = require('./order/orderHelpers');

const {
  getAllOrders,
  getOrderByToken
} = require('./order/orderQueryController');

const {
  createConsultationOrder,
  createDirectOrder
} = require('./order/orderCreationController');

const {
  updateAgreedPrice,
  customerAgreeOrderPrice,
  customerNegotiateOrder,
  customerUploadDocuments,
  approveWebOrderDocuments,
  customerSignContract,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting
} = require('./order/orderDocumentController');

const {
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder
} = require('./order/orderWorkflowController');

module.exports = {
  // Helpers
  mapDbStatusToFe,
  generateTrackingToken,
  getOrCreateLocation,

  // Query
  getAllOrders,
  getOrderByToken,

  // Creation
  createConsultationOrder,
  createDirectOrder,

  // Documents & Pricing
  updateAgreedPrice,
  customerAgreeOrderPrice,
  customerNegotiateOrder,
  customerUploadDocuments,
  approveWebOrderDocuments,
  customerSignContract,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting,

  // Workflow
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder
};
