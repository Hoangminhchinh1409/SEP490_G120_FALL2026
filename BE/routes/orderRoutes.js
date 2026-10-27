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
  approveWebOrderDocuments,
  customerSignContract,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting
} = require('../controllers/orderController');

const router = express.Router();

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

// 6. Điều phối viên: Kiểm duyệt chứng từ cho đơn web & Tự động gửi email kèm hợp đồng điện tử & Link ký số
router.post('/:id/approve-web-docs', approveWebOrderDocuments);

// 7. Khách hàng: Ký chữ ký số lên hợp đồng & Lưu trực tiếp vào hồ sơ (Public)
router.post('/customer-sign/:token', customerSignContract);

// 8. Điều phối viên tạo đơn trực tiếp
router.post('/', createDirectOrder);

// 9. Chốt giá cước thỏa thuận (Điều phối viên)
router.patch('/:id/price', updateAgreedPrice);

// 9b. Điều phối viên tải lên tệp hợp đồng đã ký thật
router.post('/:id/contract-file', uploadContractFile);

// 9c. Điều phối viên cập nhật/lưu chứng từ vào hồ sơ đơn hàng
router.post('/:id/documents', uploadOrderDocuments);

// 9d. Xuất hóa đơn GTGT điện tử & bàn giao cho Kế toán thu nợ
router.patch('/:id/issue-invoice', issueInvoiceToAccounting);

// 10. Xác nhận đơn hàng trực tiếp (chuyển sang READY_FOR_PLANNING)
router.patch('/:id/confirm', confirmOrder);

// 11. Gán xe & lập chuyến (chuyển sang ASSIGNED)
router.post('/:id/assign', assignTrip);

// 12. Hủy đơn hàng (chuyển sang CANCELLED)
router.post('/:id/cancel', cancelOrder);

// 13. Đóng đơn hàng (chuyển sang CLOSED)
router.post('/:id/close', closeOrder);

module.exports = router;

