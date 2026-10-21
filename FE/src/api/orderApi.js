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
  },

  // 9. Khách hàng: Lấy chi tiết đơn hàng qua Token bí mật gửi qua Gmail
  getOrderByToken: async (token) => {
    try {
      const data = await fetchWithoutAuth(`/orders/customer-view/${token}`);
      return data.order;
    } catch (error) {
      console.error('orderApi.getOrderByToken Error:', error);
      throw error;
    }
  },

  // 10. Khách hàng: Đồng ý chốt giá cước thỏa thuận
  customerAgreeOrderPrice: async (token) => {
    try {
      const data = await fetchWithoutAuth(`/orders/customer-agree/${token}`, {
        method: 'POST',
        body: JSON.stringify({ agreed: true })
      });
      return data;
    } catch (error) {
      console.error('orderApi.customerAgreeOrderPrice Error:', error);
      throw error;
    }
  },

  // 11. Khách hàng: Tải lên hồ sơ chứng từ liên quan
  customerUploadDocuments: async (token, documents) => {
    try {
      const data = await fetchWithoutAuth(`/orders/customer-upload-docs/${token}`, {
        method: 'POST',
        body: JSON.stringify({ documents })
      });
      return data;
    } catch (error) {
      console.error('orderApi.customerUploadDocuments Error:', error);
      throw error;
    }
  },

  // 12. Điều phối viên: Kiểm duyệt chứng từ cho đơn web & Tự động gửi email kèm hợp đồng điện tử & Link ký số
  approveWebOrderDocuments: async (orderId, approvedDocuments) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/approve-web-docs`, {
        method: 'POST',
        body: JSON.stringify({ approved_documents: approvedDocuments })
      });
      return data;
    } catch (error) {
      console.error('orderApi.approveWebOrderDocuments Error:', error);
      throw error;
    }
  },

  // 13. Khách hàng: Ký chữ ký số hợp đồng điện tử
  customerSignContract: async (token, { signature_data, signer_name }) => {
    try {
      const data = await fetchWithoutAuth(`/orders/customer-sign/${token}`, {
        method: 'POST',
        body: JSON.stringify({ signature_data, signer_name })
      });
      return data;
    } catch (error) {
      console.error('orderApi.customerSignContract Error:', error);
      throw error;
    }
  },

  // 14. Điều phối viên: Tải lên tệp hợp đồng đã ký thật
  uploadContractFile: async (orderId, { file_name, file_data, file_size }) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/contract-file`, {
        method: 'POST',
        body: JSON.stringify({ file_name, file_data, file_size })
      });
      return data;
    } catch (error) {
      console.error('orderApi.uploadContractFile Error:', error);
      throw error;
    }
  },

  // 15. Điều phối viên: Lưu danh mục chứng từ vào hồ sơ đơn hàng
  uploadOrderDocuments: async (orderId, documents) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ documents })
      });
      return data;
    } catch (error) {
      console.error('orderApi.uploadOrderDocuments Error:', error);
      throw error;
    }
  },

  // 16. Xuất hóa đơn GTGT điện tử bàn giao cho Kế toán thu nợ
  issueInvoice: async (orderId, invoiceData) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/issue-invoice`, {
        method: 'PATCH',
        body: JSON.stringify(invoiceData)
      });
      return data;
    } catch (error) {
      console.error('orderApi.issueInvoice Error:', error);
      throw error;
    }
  }
};

