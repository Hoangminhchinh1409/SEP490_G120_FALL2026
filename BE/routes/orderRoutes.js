const express = require('express');
const {
  getAllOrders,
  createConsultationOrder,
  createDirectOrder,
  updateAgreedPrice,
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder,
  getOrderByToken,
  customerAgreeOrderPrice,
  customerNegotiateOrder,
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
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const requireDispatcherOrAdmin = [requireAuth, requireRole(['DISPATCHER', 3, 'ADMINISTRATOR', 1])];

// 1. Lấy danh sách đơn hàng
router.get('/', getAllOrders);

// 2. Khách hàng gửi tư vấn từ Homepage (Public)
router.post('/consultation', createConsultationOrder);

// 3. Khách hàng: Lấy chi tiết đơn hàng qua Token bí mật gửi qua Gmail (Public)
router.get('/customer-view/:token', getOrderByToken);

// 4. Khách hàng: Đồng ý chốt giá cước đơn hàng (Public)
router.post('/customer-agree/:token', customerAgreeOrderPrice);

// 4b. Khách hàng: Gửi yêu cầu đàm phán điều chỉnh giá / lịch trình (Public)
router.post('/customer-negotiate/:token', customerNegotiateOrder);

// 5. Khách hàng: Upload hồ sơ chứng từ liên quan (Public)
router.post('/customer-upload-docs/:token', customerUploadDocuments);

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

// 13. Đóng đơn hàng (chuyển sang CLOSED)
router.post('/:id/close', ...requireDispatcherOrAdmin, closeOrder);

module.exports = router;
