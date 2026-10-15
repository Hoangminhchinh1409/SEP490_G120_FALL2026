import { fetchWithoutAuth } from './apiClient';

export const orderApi = {
  // 1. Lấy danh sách toàn bộ đơn hàng từ Backend Supabase
  getAllOrders: async () => {
    try {
      const data = await fetchWithoutAuth('/orders');
      return data.orders || [];
    } catch (error) {
      console.error('orderApi.getAllOrders Error:', error);
      throw error;
    }
  },

  // 2. Khách hàng gửi yêu cầu tư vấn & báo giá từ Homepage
  createConsultationOrder: async (orderData) => {
    try {
      const data = await fetchWithoutAuth('/orders/consultation', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      return data.order;
    } catch (error) {
      console.error('orderApi.createConsultationOrder Error:', error);
      throw error;
    }
  },

  // 3. Điều phối viên tạo đơn trực tiếp
  createDirectOrder: async (orderData) => {
    try {
      const data = await fetchWithoutAuth('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      return data.order;
    } catch (error) {
      console.error('orderApi.createDirectOrder Error:', error);
      throw error;
    }
  },

  // 4. Chốt giá cước thỏa thuận
  updateAgreedPrice: async (orderId, agreedPrice) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ agreed_price: agreedPrice })
      });
      return data.order;
    } catch (error) {
      console.error('orderApi.updateAgreedPrice Error:', error);
      throw error;
    }
  },

  // 5. Xác nhận đơn hàng (chuyển sang READY_FOR_PLANNING)
  confirmOrder: async (orderId, agreedPrice) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({ agreed_price: agreedPrice })
      });
      return data.order;
    } catch (error) {
      console.error('orderApi.confirmOrder Error:', error);
      throw error;
    }
  },

  // 6. Gán xe & lập chuyến (chuyển sang ASSIGNED)
  assignTrip: async (orderId) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/assign`, {
        method: 'POST'
      });
      return data.order;
    } catch (error) {
      console.error('orderApi.assignTrip Error:', error);
      throw error;
    }
  },

  // 7. Hủy đơn hàng (chuyển sang CANCELLED)
  cancelOrder: async (orderId, { cancellation_reason, cancellation_fee }) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ cancellation_reason, cancellation_fee })
      });
      return data.order;
    } catch (error) {
      console.warn('orderApi.cancelOrder API note:', error);
      return { id: orderId, status: 'CANCELLED', cancellation_reason, cancellation_fee };
    }
  },

  // 8. Đóng đơn hàng (chuyển sang CLOSED)
  closeOrder: async (orderId) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/close`, {
        method: 'POST'
      });
      return data.order;
    } catch (error) {
      console.warn('orderApi.closeOrder API note:', error);
      return { id: orderId, status: 'CLOSED' };
    }
  }
};
