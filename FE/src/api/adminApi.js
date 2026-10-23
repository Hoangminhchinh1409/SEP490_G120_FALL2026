import { fetchWithAuth } from './apiClient';

export const adminApi = {
  // 1. Thống kê Dashboard
  getDashboardStats: async () => {
    try {
      const data = await fetchWithAuth('/admin/dashboard/stats');
      return data.stats;
    } catch (error) {
      console.error('adminApi.getDashboardStats Error:', error);
      throw error;
    }
  },

  // 2. Nhật ký Hoạt động (Activity Logs)
  getActivityLogs: async (params = {}) => {
    try {
      const query = new URLSearchParams();
      if (params.page) query.append('page', params.page);
      if (params.limit) query.append('limit', params.limit);
      if (params.actorId) query.append('actorId', params.actorId);
      if (params.action && params.action !== 'ALL') query.append('action', params.action);
      if (params.targetType && params.targetType !== 'ALL') query.append('targetType', params.targetType);
      if (params.startDate) query.append('startDate', params.startDate);
      if (params.endDate) query.append('endDate', params.endDate);
      if (params.keyword && params.keyword.trim()) query.append('keyword', params.keyword.trim());

      const url = `/admin/logs?${query.toString()}`;
      const data = await fetchWithAuth(url);
      return data;
    } catch (error) {
      console.error('adminApi.getActivityLogs Error:', error);
      throw error;
    }
  },

  // 3. Quản lý Người dùng (Users)
  getUsers: async (params = {}) => {
    try {
      const query = new URLSearchParams();
      if (params.page) query.append('page', params.page);
      if (params.limit) query.append('limit', params.limit);
      if (params.roleId && params.roleId !== 'ALL') query.append('roleId', params.roleId);
      if (params.status && params.status !== 'ALL') query.append('status', params.status);
      if (params.keyword && params.keyword.trim()) query.append('keyword', params.keyword.trim());

      const url = `/admin/users?${query.toString()}`;
      const data = await fetchWithAuth(url);
      return data;
    } catch (error) {
      console.error('adminApi.getUsers Error:', error);
      throw error;
    }
  },

  getUserById: async (id) => {
    try {
      const data = await fetchWithAuth(`/admin/users/${id}`);
      return data.user;
    } catch (error) {
      console.error(`adminApi.getUserById Error for id ${id}:`, error);
      throw error;
    }
  },

  createUser: async (userData) => {
    try {
      const data = await fetchWithAuth('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      return data.user;
    } catch (error) {
      console.error('adminApi.createUser Error:', error);
      throw error;
    }
  },

  updateUser: async (id, userData) => {
    try {
      const data = await fetchWithAuth(`/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });
      return data.user;
    } catch (error) {
      console.error(`adminApi.updateUser Error for id ${id}:`, error);
      throw error;
    }
  },

  updateUserStatus: async (id, status) => {
    try {
      const data = await fetchWithAuth(`/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data.user;
    } catch (error) {
      console.error(`adminApi.updateUserStatus Error for id ${id}:`, error);
      throw error;
    }
  },

  // 4. Danh mục Vai trò & Ma trận Phân quyền (Roles & Permissions - UC-34)
  getRoles: async () => {
    try {
      const data = await fetchWithAuth('/admin/roles');
      return data.roles;
    } catch (error) {
      console.error('adminApi.getRoles Error:', error);
      throw error;
    }
  },

  getPermissionsMatrix: async () => {
    try {
      const data = await fetchWithAuth('/admin/permissions');
      return data;
    } catch (error) {
      console.error('adminApi.getPermissionsMatrix Error:', error);
      throw error;
    }
  },

  updateRolePermissions: async (roleId, permissionIds) => {
    try {
      const data = await fetchWithAuth(`/admin/roles/${roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds })
      });
      return data;
    } catch (error) {
      console.error(`adminApi.updateRolePermissions Error for roleId ${roleId}:`, error);
      throw error;
    }
  },

  // 5. Cấu hình Hệ thống (System Settings)
  getSystemSettings: async () => {
    try {
      const data = await fetchWithAuth('/admin/settings');
      return data.settings;
    } catch (error) {
      console.error('adminApi.getSystemSettings Error:', error);
      throw error;
    }
  },

  updateSystemSetting: async ({ key, value }) => {
    try {
      const data = await fetchWithAuth('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ key, value })
      });
      return data.setting;
    } catch (error) {
      console.error('adminApi.updateSystemSetting Error:', error);
      throw error;
    }
  }
};
