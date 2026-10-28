import { fetchWithAuth } from "./apiClient";
import { enqueueAction, getPendingActions, clearOfflineQueue } from "../utils/offlineQueue";

// ==========================================
// 1. OFFLINE STORAGE QUEUE (BR-27, BR-37, MSG39)
// ==========================================

export const getOfflineActions = async () => {
  return await getPendingActions();
};

export const queueOfflineAction = async (action) => {
  return await enqueueAction(action);
};

export const clearOfflineActions = async () => {
  return await clearOfflineQueue();
};

// ==========================================
// 2. DRIVER API CALLS
// ==========================================

export const driverApi = {
  // Lấy hồ sơ tài xế
  getMyProfile: async () => {
    return await fetchWithAuth("/driver/profile");
  },

  // Lấy chuyến xe đang hoạt động
  getActiveTrip: async () => {
    return await fetchWithAuth("/driver/trips/active");
  },

  // Lấy lịch sử chuyến xe
  getTripHistory: async ({ page = 1, limit = 10 } = {}) => {
    return await fetchWithAuth(`/driver/trips/history?page=${page}&limit=${limit}`);
  },

  // Lấy chi tiết chuyến xe
  getTripDetail: async (tripId) => {
    return await fetchWithAuth(`/driver/trips/${tripId}`);
  },

  // Nhận chuyến xe (UC-29)
  acceptTrip: async (tripId, { clientActionId, phoneTime } = {}) => {
    return await fetchWithAuth(`/driver/trips/${tripId}/accept`, {
      method: "PATCH",
      body: JSON.stringify({
        clientActionId: clientActionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined),
        phoneTime: phoneTime || new Date().toISOString()
      })
    });
  },

  // Báo đến điểm dừng (BR-36)
  arriveStop: async (tripId, stopId, { phoneLat, phoneLng, phoneTime, clientActionId } = {}) => {
    return await fetchWithAuth(`/driver/trips/${tripId}/stops/${stopId}/arrive`, {
      method: "POST",
      body: JSON.stringify({
        phoneLat,
        phoneLng,
        phoneTime: phoneTime || new Date().toISOString(),
        clientActionId: clientActionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined)
      })
    });
  },

  // Ghi nhận sự kiện điểm dừng trung gian (Loading started, Left...) (BR-36)
  recordStopEvent: async (tripId, stopId, eventData) => {
    return await fetchWithAuth(`/driver/trips/${tripId}/stops/${stopId}/event`, {
      method: "POST",
      body: JSON.stringify({
        ...eventData,
        clientActionId: eventData.clientActionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined),
        phoneTime: eventData.phoneTime || new Date().toISOString()
      })
    });
  },

  // Ghi nhận bốc hàng & niêm chì (BR-11, BR-31, BR-33)
  recordPickup: async (tripId, stopId, pickupData) => {
    return await fetchWithAuth(`/driver/trips/${tripId}/stops/${stopId}/pickup`, {
      method: "POST",
      body: JSON.stringify({
        ...pickupData,
        clientActionId: pickupData.clientActionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined),
        phoneTime: pickupData.phoneTime || new Date().toISOString()
      })
    });
  },

  // Ghi nhận giao hàng & POD (BR-12, BR-39, BR-24)
  recordDelivery: async (tripId, stopId, deliveryData) => {
    return await fetchWithAuth(`/driver/trips/${tripId}/stops/${stopId}/delivery`, {
      method: "POST",
      body: JSON.stringify({
        ...deliveryData,
        clientActionId: deliveryData.clientActionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined),
        phoneTime: deliveryData.phoneTime || new Date().toISOString()
      })
    });
  },

  // Khách không nhận hàng (BR-57, MSG74, MSG75)
  reportCustomerRefusal: async (tripId, stopId, refusalData) => {
    return await fetchWithAuth(`/driver/trips/${tripId}/stops/${stopId}/refuse`, {
      method: "POST",
      body: JSON.stringify({
        ...refusalData,
        clientActionId: refusalData.clientActionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined),
        phoneTime: refusalData.phoneTime || new Date().toISOString()
      })
    });
  },

  // Đề xuất phụ phí phát sinh (BR-30, MSG85)
  proposeExtraFee: async (tripId, feeData) => {
    return await fetchWithAuth(`/driver/trips/${tripId}/extra-fees`, {
      method: "POST",
      body: JSON.stringify(feeData)
    });
  },

  // Quản lý ca làm việc (UC-20, BR-60)
  getMyShifts: async ({ from, to } = {}) => {
    let url = "/driver/shifts";
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    return await fetchWithAuth(url);
  },

  registerShift: async (shiftData) => {
    return await fetchWithAuth("/driver/shifts", {
      method: "POST",
      body: JSON.stringify(shiftData)
    });
  },

  // Thông báo tài xế (Screen 6.5, MSG80)
  getDriverNotifications: async () => {
    return await fetchWithAuth("/driver/notifications");
  },

  markNotificationRead: async (notificationId) => {
    return await fetchWithAuth(`/driver/notifications/${notificationId}/read`, {
      method: "PATCH"
    });
  },

  markAllNotificationsRead: async () => {
    return await fetchWithAuth("/driver/notifications/read-all", {
      method: "PATCH"
    });
  },

  // Báo cáo sự cố khẩn cấp (UC-32 & BF-04)
  reportIncident: async (incidentData) => {
    return await fetchWithAuth("/driver/incidents", {
      method: "POST",
      body: JSON.stringify(incidentData)
    });
  },

  // Đồng bộ ngoại tuyến (BR-27, MSG39)
  syncOffline: async (actions) => {
    return await fetchWithAuth("/driver/sync", {
      method: "POST",
      body: JSON.stringify({ actions })
    });
  },

  // Hàm tự động đồng bộ hàng đợi ngoại tuyến khi có mạng
  syncPendingQueue: async () => {
    const pendingActions = await getOfflineActions();
    if (!pendingActions || pendingActions.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    try {
      const res = await fetchWithAuth("/driver/sync", {
        method: "POST",
        body: JSON.stringify({ actions: pendingActions })
      });
      await clearOfflineActions();
      return res;
    } catch (err) {
      console.error("Error flushing offline queue:", err);
      throw err;
    }
  }
};
