import { fetchWithAuth } from './apiClient';

export const managerApi = {
  // 1. Thống kê Dashboard (Screen 16 V2)
  getDashboardStats: async (period = 'Tháng 10/2026') => {
    try {
      const data = await fetchWithAuth(`/manager/dashboard/stats?period=${encodeURIComponent(period)}`);
      return data.stats;
    } catch (error) {
      console.error('managerApi.getDashboardStats Error:', error);
      throw error;
    }
  },

  // Báo cáo hiệu suất tài xế (Screen 41 V2)
  getDriverPerformance: async (period) => {
    try {
      const url = period ? `/manager/drivers/performance?period=${encodeURIComponent(period)}` : '/manager/drivers/performance';
      const data = await fetchWithAuth(url);
      return data;
    } catch (error) {
      console.error('managerApi.getDriverPerformance Error:', error);
      throw error;
    }
  },

  // 2. Lấy danh sách đội xe & tài xế
  getVehicles: async () => {
    try {
      const data = await fetchWithAuth('/manager/vehicles');
      return data;
    } catch (error) {
      console.error('managerApi.getVehicles Error:', error);
      throw error;
    }
  },

  // Thêm mới hồ sơ tài xế
  createDriver: async (driverData) => {
    try {
      const data = await fetchWithAuth('/manager/drivers', {
        method: 'POST',
        body: JSON.stringify(driverData)
      });
      return data;
    } catch (error) {
      console.error('managerApi.createDriver Error:', error);
      throw error;
    }
  },

  // 3. Lấy danh sách đơn hàng & điều phối viên
  getOrders: async () => {
    try {
      const data = await fetchWithAuth('/manager/orders');
      return data;
    } catch (error) {
      console.error('managerApi.getOrders Error:', error);
      throw error;
    }
  },

  // Chuyển giao đơn hàng
  reassignOrder: async (orderId, newDispatcherId, reason) => {
    try {
      const data = await fetchWithAuth(`/manager/orders/${orderId}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ newDispatcherId, reason })
      });
      return data;
    } catch (error) {
      console.error('managerApi.reassignOrder Error:', error);
      throw error;
    }
  },

  // Xem chi tiết đơn hàng chỉ đọc (Screen 09)
  getOrderDetail: async (orderId) => {
    try {
      const data = await fetchWithAuth(`/manager/orders/${orderId}`);
      return data.order;
    } catch (error) {
      console.error('managerApi.getOrderDetail Error:', error);
      throw error;
    }
  },

  // 4. NHÓM 6: NHÀ XE ĐỐI TÁC & HỢP ĐỒNG (UC-23 - Screen 28, 29, 30, 31, 37)
  getVendors: async (status = 'ALL') => {
    try {
      const endpoint = status !== 'ALL' ? `/manager/vendors?status=${status}` : '/manager/vendors';
      const data = await fetchWithAuth(endpoint);
      return data;
    } catch (error) {
      console.error('managerApi.getVendors Error:', error);
      throw error;
    }
  },

  createVendor: async (vendorData) => {
    try {
      const data = await fetchWithAuth('/manager/vendors', {
        method: 'POST',
        body: JSON.stringify(vendorData)
      });
      return data;
    } catch (error) {
      console.error('managerApi.createVendor Error:', error);
      throw error;
    }
  },

  updateVendor: async (id, vendorData) => {
    try {
      const data = await fetchWithAuth(`/manager/vendors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(vendorData)
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateVendor Error:', error);
      throw error;
    }
  },

  updateVendorStatus: async (id, status) => {
    try {
      const data = await fetchWithAuth(`/manager/vendors/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateVendorStatus Error:', error);
      throw error;
    }
  },

  // Phê duyệt nhà xe (alias)
  approveVendor: async (vendorId) => {
    try {
      const data = await fetchWithAuth(`/manager/vendors/${vendorId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'APPROVED' })
      });
      return data;
    } catch (error) {
      console.error('managerApi.approveVendor Error:', error);
      throw error;
    }
  },

  // Tra cứu hợp đồng vận tải Read-only (Screen 30, 31)
  getContracts: async () => {
    try {
      const data = await fetchWithAuth('/manager/contracts');
      return data;
    } catch (error) {
      console.error('managerApi.getContracts Error:', error);
      throw error;
    }
  },

  // Tra cứu địa điểm kho bãi Read-only (Screen 37)
  getLocations: async () => {
    try {
      const data = await fetchWithAuth('/manager/locations');
      return data;
    } catch (error) {
      console.error('managerApi.getLocations Error:', error);
      throw error;
    }
  },

  // 5. NHÓM 4: SỰ CỐ LỚN & KHIẾU NẠI BỒI THƯỜNG (UC-25, UC-26 V2, UC-42)
  getIncidents: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const endpoint = query ? `/manager/incidents?${query}` : '/manager/incidents';
      const data = await fetchWithAuth(endpoint);
      return data;
    } catch (error) {
      console.error('managerApi.getIncidents Error:', error);
      throw error;
    }
  },

  getIncidentById: async (id) => {
    try {
      const data = await fetchWithAuth(`/manager/incidents/${id}`);
      return data.incident;
    } catch (error) {
      console.error('managerApi.getIncidentById Error:', error);
      throw error;
    }
  },

  resolveIncident: async (id, { fault, compensation_amount, resolution_note }) => {
    try {
      const data = await fetchWithAuth(`/manager/incidents/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ fault, compensation_amount, resolution_note })
      });
      return data;
    } catch (error) {
      console.error('managerApi.resolveIncident Error:', error);
      throw error;
    }
  },

  getClaims: async () => {
    try {
      const data = await fetchWithAuth('/manager/claims');
      return data;
    } catch (error) {
      console.error('managerApi.getClaims Error:', error);
      throw error;
    }
  },

  decideClaim: async (id, { action, comment }) => {
    try {
      const data = await fetchWithAuth(`/manager/claims/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ action, comment })
      });
      return data;
    } catch (error) {
      console.error('managerApi.decideClaim Error:', error);
      throw error;
    }
  },

  getTripReplay: async (tripId) => {
    try {
      const data = await fetchWithAuth(`/manager/trips/${tripId}/replay`);
      return data;
    } catch (error) {
      console.error('managerApi.getTripReplay Error:', error);
      throw error;
    }
  },

  // Legacy approval aliases
  getApprovals: async () => {
    try {
      const data = await fetchWithAuth('/manager/claims');
      return data;
    } catch (error) {
      console.error('managerApi.getApprovals Error:', error);
      throw error;
    }
  },

  decideApproval: async (id, { action, reason, note }) => {
    try {
      const data = await fetchWithAuth(`/manager/claims/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ action, comment: reason || note })
      });
      return data;
    } catch (error) {
      console.error('managerApi.decideApproval Error:', error);
      throw error;
    }
  },

  // 6. NHÓM 7: QUẢN LÝ TIN TỨC (UC-44 - Screen 46 & Screen 47)
  getBlogs: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const endpoint = query ? `/manager/blogs?${query}` : '/manager/blogs';
      const data = await fetchWithAuth(endpoint);
      return data;
    } catch (error) {
      console.error('managerApi.getBlogs Error:', error);
      throw error;
    }
  },

  createBlog: async (blogData) => {
    try {
      const data = await fetchWithAuth('/manager/blogs', {
        method: 'POST',
        body: JSON.stringify(blogData)
      });
      return data;
    } catch (error) {
      console.error('managerApi.createBlog Error:', error);
      throw error;
    }
  },

  updateBlog: async (blogId, blogData) => {
    try {
      const data = await fetchWithAuth(`/manager/blogs/${blogId}`, {
        method: 'PUT',
        body: JSON.stringify(blogData)
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateBlog Error:', error);
      throw error;
    }
  },

  updateBlogStatus: async (blogId, status) => {
    try {
      const data = await fetchWithAuth(`/manager/blogs/${blogId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateBlogStatus Error:', error);
      throw error;
    }
  },

  approveBlog: async (blogId) => {
    try {
      const data = await fetchWithAuth(`/manager/blogs/${blogId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PUBLISHED' })
      });
      return data;
    } catch (error) {
      console.error('managerApi.approveBlog Error:', error);
      throw error;
    }
  },

  deleteBlog: async (blogId) => {
    try {
      const data = await fetchWithAuth(`/manager/blogs/${blogId}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('managerApi.deleteBlog Error:', error);
      throw error;
    }
  },

  // 7. Quản lý Tài khoản Nhân sự (Dispatcher & Driver) - Screen 26 & Screen 27
  getStaffAccounts: async (params = {}) => {
    try {
      const query = new URLSearchParams();
      if (params.search) query.append('search', params.search);
      if (params.role && params.role !== 'ALL') query.append('role', params.role);
      if (params.status && params.status !== 'ALL') query.append('status', params.status);

      const qs = query.toString();
      const url = `/manager/accounts${qs ? `?${qs}` : ''}`;
      const data = await fetchWithAuth(url);
      return data;
    } catch (error) {
      console.error('managerApi.getStaffAccounts Error:', error);
      throw error;
    }
  },

  getStaffAccountById: async (id) => {
    try {
      const data = await fetchWithAuth(`/manager/accounts/${id}`);
      return data.account;
    } catch (error) {
      console.error('managerApi.getStaffAccountById Error:', error);
      throw error;
    }
  },

  createStaffAccount: async (payload) => {
    try {
      const data = await fetchWithAuth('/manager/accounts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('managerApi.createStaffAccount Error:', error);
      throw error;
    }
  },

  updateStaffAccount: async (id, payload) => {
    try {
      const data = await fetchWithAuth(`/manager/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateStaffAccount Error:', error);
      throw error;
    }
  },

  toggleStaffAccountStatus: async (id, status) => {
    try {
      const data = await fetchWithAuth(`/manager/accounts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data;
    } catch (error) {
      console.error('managerApi.toggleStaffAccountStatus Error:', error);
      throw error;
    }
  },

  // 8. Quản lý Đội xe tải (UC-18: Screen 21, 22, 15)
  createTruck: async (payload) => {
    try {
      const data = await fetchWithAuth('/manager/trucks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('managerApi.createTruck Error:', error);
      throw error;
    }
  },

  updateTruck: async (id, payload) => {
    try {
      const data = await fetchWithAuth(`/manager/trucks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateTruck Error:', error);
      throw error;
    }
  },

  updateTruckStatus: async (id, status) => {
    try {
      const data = await fetchWithAuth(`/manager/trucks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateTruckStatus Error:', error);
      throw error;
    }
  },

  deleteTruck: async (id) => {
    try {
      const data = await fetchWithAuth(`/manager/trucks/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('managerApi.deleteTruck Error:', error);
      throw error;
    }
  },

  updateDriverProfile: async (id, payload) => {
    try {
      const data = await fetchWithAuth(`/manager/drivers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('managerApi.updateDriverProfile Error:', error);
      throw error;
    }
  },

  // 9. Quản lý Ca trực Tài xế (UC-20 V2: Screen 25)
  getShifts: async (params = {}) => {
    try {
      const query = new URLSearchParams();
      if (params.from) query.append('from', params.from);
      if (params.to) query.append('to', params.to);
      if (params.status && params.status !== 'ALL') query.append('status', params.status);
      if (params.driver_id) query.append('driver_id', params.driver_id);

      const qs = query.toString();
      const url = `/manager/shifts${qs ? `?${qs}` : ''}`;
      const data = await fetchWithAuth(url);
      return data;
    } catch (error) {
      console.error('managerApi.getShifts Error:', error);
      throw error;
    }
  },

  approveShift: async (id) => {
    try {
      const data = await fetchWithAuth(`/manager/shifts/${id}/approve`, {
        method: 'PATCH'
      });
      return data;
    } catch (error) {
      console.error('managerApi.approveShift Error:', error);
      throw error;
    }
  },

  rejectShift: async (id, reason) => {
    try {
      const data = await fetchWithAuth(`/manager/shifts/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      });
      return data;
    } catch (error) {
      console.error('managerApi.rejectShift Error:', error);
      throw error;
    }
  },

  createShift: async (payload) => {
    try {
      const data = await fetchWithAuth('/manager/shifts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('managerApi.createShift Error:', error);
      throw error;
    }
  },

  deleteShift: async (id) => {
    try {
      const data = await fetchWithAuth(`/manager/shifts/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('managerApi.deleteShift Error:', error);
      throw error;
    }
  }
};

