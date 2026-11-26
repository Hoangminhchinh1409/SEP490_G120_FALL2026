const express = require('express');
const { rateLimit } = require('express-rate-limit');
const {
  getAllOrders,
  createConsultationOrder,
  createDirectOrder,
  updateAgreedPrice,
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder,
  splitOrder,
  redirectOrderToAlsWarehouse,
  getOrderByToken,
  submitGuestClaimByToken,
  confirmGuestClaimPayment,
  getPublicInvoiceCaptcha,
  lookupPublicInvoice,
  downloadPublicInvoiceFile,
  customerAgreeOrderPrice,
  customerUploadDocuments,
  rejectOrderDocument,
  approveWebOrderDocuments,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting,
  sendContractToCustomer,
  confirmHardcopyContractReceived
} = require('../controllers/orderController');

const router = express.Router();
const locationController = require('../controllers/locationController');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const requireDispatcherOrAdmin = [requireAuth, requireRole(['DISPATCHER', 3, 'ADMINISTRATOR', 1])];

const requireDispatcherOnly = (req, res, next) => {
  const roleId = Number(req.user?.role_id);
  const roleName = String(req.user?.role || '').toUpperCase();
  if (roleId === 3 || roleName === 'DISPATCHER') {
    return next();
  }
  return res.status(403).json({
    message: 'Forbidden: You do not have permission to access this resource',
    code: 'MSG_FORBIDDEN'
  });
};

// 1. Lấy danh sách đơn hàng (Chỉ dành riêng cho Điều phối viên - BUG-OL-01)
router.get('/', requireAuth, requireDispatcherOnly, getAllOrders);

const invoiceLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quý khách tra cứu quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
});

// 1b. Khách hàng: Lấy danh sách hệ thống kho ALS công khai (Public)
router.get('/public-locations', locationController.getPublicAlsWarehouses);

// 1c. Khách hàng: Captcha & Tra cứu / Tải hóa đơn điện tử công khai (Public)
router.get('/public-invoice-captcha', getPublicInvoiceCaptcha);
router.post('/public-invoice-lookup', invoiceLookupLimiter, lookupPublicInvoice);
router.get('/public-invoice-file/:downloadToken', downloadPublicInvoiceFile);

// 2. Khách hàng gửi tư vấn từ Homepage (Public)
router.post('/consultation', createConsultationOrder);

// 3. Khách hàng: Lấy chi tiết đơn hàng qua Token bí mật gửi qua Gmail (Public)
router.get('/customer-view/:token', getOrderByToken);

// 4. Khách hàng: Đồng ý chốt giá cước đơn hàng (Public)
router.post('/customer-agree/:token', customerAgreeOrderPrice);

const claimSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quý khách gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
});

// 5. Khách hàng: Upload hồ sơ chứng từ liên quan (Public)
router.post('/customer-upload-docs/:token', customerUploadDocuments);

// 5a. Khách hàng: Gửi yêu cầu bồi thường thiệt hại hàng hóa từ Tracking Page (Public, <= 14 ngày - BR-59)
router.post('/customer-claim/:token', claimSubmitLimiter, submitGuestClaimByToken);

// 5b. Khách hàng: Xác nhận đã nhận tiền bồi thường trên Tracking Page (Public - BF-04)
router.post('/customer-confirm-claim/:token', claimSubmitLimiter, confirmGuestClaimPayment);

// 5b. Điều phối viên: Từ chối 1 chứng từ & tự động gửi email yêu cầu khách tải lại
router.post('/:id/reject-document', ...requireDispatcherOrAdmin, rejectOrderDocument);

// 6. Điều phối viên: Kiểm duyệt chứng từ cho đơn web
router.post('/:id/approve-web-docs', ...requireDispatcherOrAdmin, approveWebOrderDocuments);

// 8. Điều phối viên tạo đơn trực tiếp
router.post('/', ...requireDispatcherOrAdmin, createDirectOrder);

// 9. Chốt giá cước thỏa thuận (Điều phối viên)
router.patch('/:id/price', ...requireDispatcherOrAdmin, updateAgreedPrice);

// 9b. Điều phối viên tải lên tệp hợp đồng đã ký thật
router.post('/:id/contract-file', ...requireDispatcherOrAdmin, uploadContractFile);

// 9b.1 Điều phối viên gửi email hợp đồng (PDF kèm điều khoản) cho khách hàng
router.post('/:id/send-contract', ...requireDispatcherOrAdmin, sendContractToCustomer);

// 9b.2 Điều phối viên xác nhận đã nhận bản cứng hợp đồng gốc có dấu đỏ qua bưu điện
router.patch('/:id/hardcopy-contract', ...requireDispatcherOrAdmin, confirmHardcopyContractReceived);

// 9c. Điều phối viên cập nhật/lưu chứng từ vào hồ sơ đơn hàng
router.post('/:id/documents', ...requireDispatcherOrAdmin, uploadOrderDocuments);

// 9d. Xuất hóa đơn GTGT điện tử & bàn giao cho Kế toán thu nợ
router.patch('/:id/issue-invoice', ...requireDispatcherOrAdmin, issueInvoiceToAccounting);

// 10. Xác nhận đơn hàng trực tiếp (chuyển sang READY_FOR_PLANNING)
router.patch('/:id/confirm', ...requireDispatcherOrAdmin, confirmOrder);

// 11. Gán xe & lập chuyến (chuyển sang ASSIGNED)
router.post('/:id/assign', ...requireDispatcherOrAdmin, assignTrip);

// 12. Hủy đơn hàng (chuyển sang CANCELLED)
router.post('/:id/cancel', ...requireDispatcherOrAdmin, cancelOrder);

// 13b. Tách đơn hàng lớn thành nhiều đơn con cho các xe nhỏ
router.post('/:id/split', ...requireDispatcherOrAdmin, splitOrder);

// 13. Đóng đơn hàng (chuyển sang CLOSED)
router.post('/:id/close', ...requireDispatcherOrAdmin, closeOrder);

// 14. Điều tài xế chở hàng bị từ chối về Kho ALS & Đóng đơn ngoại lệ (Chỉ Điều phối viên / Quản trị)
router.post('/:id/redirect-warehouse', ...requireDispatcherOrAdmin, redirectOrderToAlsWarehouse);

module.exports = router;
