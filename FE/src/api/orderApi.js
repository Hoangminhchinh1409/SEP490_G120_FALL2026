import { fetchWithAuth, fetchWithoutAuth } from './apiClient';

export const orderApi = {
  // 1. Lấy danh sách toàn bộ đơn hàng từ Backend Supabase (hỗ trợ lọc theo dispatcher_id)
  getAllOrders: async (params = {}) => {
    try {
      const queryStr = params?.dispatcher_id ? `?dispatcher_id=${params.dispatcher_id}` : '';
      const data = await fetchWithAuth(`/orders${queryStr}`);
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
      const data = await fetchWithAuth('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      return data.order;
    } catch (error) {
      console.error('orderApi.createDirectOrder Error:', error);
      throw error;
    }
  },

  // 4. Chốt giá cước thỏa thuận & Phương án xe (hoặc Chốt lại giá kèm lý do điều chỉnh)
  updateAgreedPrice: async (orderId, agreedPrice, adjustmentReason = '', extraOptions = {}) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/price`, {
        method: 'PATCH',
        body: JSON.stringify({
          agreed_price: agreedPrice,
          adjustment_reason: adjustmentReason,
          proposed_vehicle_type: extraOptions.proposed_vehicle_type || null,
          vehicle_analysis_note: extraOptions.vehicle_analysis_note || null
        })
      });
      return data;
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
  closeOrder: async (orderId, payload = {}) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/close`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data.order;
    } catch (error) {
      console.warn('orderApi.closeOrder API note:', error);
      return { id: orderId, status: 'CLOSED', is_closed: true };
    }
  },

  // 8b. Điều tài xế chở hàng bị từ chối về Kho ALS hoặc xác nhận đã hạ hàng tại kho ALS & đóng đơn
  redirectToAlsWarehouse: async (orderId, { location_id = null, warehouse_name = '', close_immediately = false, note = '' } = {}) => {
    const data = await fetchWithoutAuth(`/orders/${orderId}/redirect-warehouse`, {
      method: 'POST',
      body: JSON.stringify({
        location_id,
        warehouse_name,
        close_immediately,
        note
      })
    });
    return data;
  },

  // 8c. Lấy danh sách hệ thống kho ALS
  getAlsWarehouses: async () => {
    try {
      const data = await fetchWithoutAuth('/orders/public-locations');
      return data.locations || [];
    } catch (error) {
      console.warn('orderApi.getAlsWarehouses fallback:', error);
      return [];
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

  // 11b. Điều phối viên: Từ chối 1 chứng từ & tự động gửi email yêu cầu khách tải lại
  rejectOrderDocument: async (orderId, { doc_key, reject_reason, documents }) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/reject-document`, {
        method: 'POST',
        body: JSON.stringify({ doc_key, reject_reason, documents })
      });
      return data;
    } catch (error) {
      console.error('orderApi.rejectOrderDocument Error:', error);
      throw error;
    }
  },

  // 12. Điều phối viên: Kiểm duyệt toàn bộ chứng từ của đơn hàng
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

  // 14. Điều phối viên: Tải lên tệp hợp đồng đã scan (PDF)
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

  // 14b. Gửi email hợp đồng vận tải chính thức kèm điều khoản bổ sung & thông tin điều chỉnh cho khách hàng
  sendContractToCustomer: async (orderId, { custom_terms = [], contract_details = {}, pdf_base64 = null } = {}) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/send-contract`, {
        method: 'POST',
        body: JSON.stringify({ custom_terms, contract_details, pdf_base64 })
      });
      return data;
    } catch (error) {
      console.error('orderApi.sendContractToCustomer Error:', error);
      throw error;
    }
  },

  // 14c. Xác nhận đã nhận bản cứng hợp đồng gốc có dấu đỏ qua bưu điện/chuyển phát
  confirmHardcopyContractReceived: async (orderId, { received = true, notes = '', postal_code = '' } = {}) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/hardcopy-contract`, {
        method: 'PATCH',
        body: JSON.stringify({ received, notes, postal_code })
      });
      return data;
    } catch (error) {
      console.error('orderApi.confirmHardcopyContractReceived Error:', error);
      throw error;
    }
  },

  // 15. Điều phối viên: Lưu danh mục chứng từ vào hồ sơ đơn hàng
  uploadOrderDocuments: async (orderId, documents, stage = null) => {
    try {
      const payload = { documents };
      if (stage) payload.stage = stage;
      const data = await fetchWithoutAuth(`/orders/${orderId}/documents`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('orderApi.uploadOrderDocuments Error:', error);
      throw error;
    }
  },

  // 17. Tách đơn hàng lớn sang nhiều xe nhỏ
  splitOrder: async (orderId, splitData) => {
    try {
      const data = await fetchWithoutAuth(`/orders/${orderId}/split`, {
        method: 'POST',
        body: JSON.stringify(splitData)
      });
      return data;
    } catch (error) {
      console.error('orderApi.splitOrder Error:', error);
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
  },

  // 17. Khách hàng: Lấy danh sách điểm kho bãi công khai (Public)
  getPublicLocations: async () => {
    try {
      const data = await fetchWithoutAuth('/orders/public-locations');
      return data.locations || [];
    } catch (error) {
      return [];
    }
  }
};
