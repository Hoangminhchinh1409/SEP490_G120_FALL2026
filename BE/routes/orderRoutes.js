const express = require('express');
const {
  getAllOrders,
  createConsultationOrder,
  createDirectOrder,
  updateAgreedPrice,
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder
} = require('../controllers/orderController');

const router = express.Router();

// 1. Lấy danh sách đơn hàng
router.get('/', getAllOrders);

// 2. Khách hàng gửi tư vấn từ Homepage (Public)
router.post('/consultation', createConsultationOrder);

// 3. Điều phối viên tạo đơn trực tiếp
router.post('/', createDirectOrder);

// 4. Chốt giá cước thỏa thuận
router.patch('/:id/price', updateAgreedPrice);

// 5. Xác nhận đơn hàng (chuyển sang READY_FOR_PLANNING)
router.patch('/:id/confirm', confirmOrder);

// 6. Gán xe & lập chuyến (chuyển sang ASSIGNED)
router.post('/:id/assign', assignTrip);

// 7. Hủy đơn hàng (chuyển sang CANCELLED)
router.post('/:id/cancel', cancelOrder);

// 8. Đóng đơn hàng (chuyển sang CLOSED)
router.post('/:id/close', closeOrder);

module.exports = router;
