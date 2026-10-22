import { fetchWithAuth } from './apiClient';

export const managerApi = {
  // 1. Thống kê Dashboard
  getDashboardStats: async () => {
    try {
      const data = await fetchWithAuth('/manager/dashboard/stats');
      return data.stats;
    } catch (error) {
      console.error('managerApi.getDashboardStats Error:', error);
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
  reassignOrder: async (orderId, newDispatcherId) => {
    try {
      const data = await fetchWithAuth(`/manager/orders/${orderId}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ newDispatcherId })
      });
      return data;
    } catch (error) {
      console.error('managerApi.reassignOrder Error:', error);
      throw error;
    }
  },

  // 4. Lấy danh sách nhà xe & hợp đồng
  getVendors: async () => {
    try {
      const data = await fetchWithAuth('/manager/vendors');
      return data;
    } catch (error) {
      console.error('managerApi.getVendors Error:', error);
      throw error;
    }
  },

  // Phê duyệt nhà xe / hợp đồng
  approveVendor: async (vendorId) => {
    try {
      const data = await fetchWithAuth(`/manager/vendors/${vendorId}/approve`, {
        method: 'PATCH'
      });
      return data;
    } catch (error) {
      console.error('managerApi.approveVendor Error:', error);
      throw error;
    }
  },

  // 5. Lấy danh sách sự cố & bồi thường
  getApprovals: async () => {
    try {
      const data = await fetchWithAuth('/manager/approvals');
      return data;
    } catch (error) {
      console.error('managerApi.getApprovals Error:', error);
      throw error;
    }
  },

  // Quyết định phê duyệt / từ chối bồi thường
  decideApproval: async (id, { action, reason, note }) => {
    try {
      const data = await fetchWithAuth(`/manager/approvals/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ action, reason, note })
      });
      return data;
    } catch (error) {
      console.error('managerApi.decideApproval Error:', error);
      throw error;
    }
  },

  // 6. Quản lý Tin tức / Bản tin
  getBlogs: async () => {
    try {
      const data = await fetchWithAuth('/manager/blogs');
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

  approveBlog: async (blogId) => {
    try {
      const data = await fetchWithAuth(`/manager/blogs/${blogId}/approve`, {
        method: 'PATCH'
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
  }
};

