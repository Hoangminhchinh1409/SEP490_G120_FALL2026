import { fetchWithAuth } from "./apiClient";

// ==========================================
// 1. OFFLINE STORAGE QUEUE (BR-27)
// ==========================================

const OFFLINE_QUEUE_KEY = "nexlog_driver_offline_actions";

export const getOfflineActions = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read offline actions", e);
    return [];
  }
};

export const queueOfflineAction = (action) => {
  if (typeof window === "undefined") return;
  try {
    const actions = getOfflineActions();
    actions.push({
      ...action,
      queuedAt: new Date().toISOString()
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(actions));
  } catch (e) {
    console.error("Failed to queue offline action", e);
  }
};

export const clearOfflineActions = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (e) {
    console.error("Failed to clear offline actions", e);
  }
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

  // Báo cáo sự cố khẩn cấp (UC-32 & BF-04)
  reportIncident: async (incidentData) => {
    return await fetchWithAuth("/driver/incidents", {
      method: "POST",
      body: JSON.stringify(incidentData)
    });
  },

  // Đồng bộ ngoại tuyến (BR-27)
  syncOffline: async (actions) => {
    return await fetchWithAuth("/driver/sync", {
      method: "POST",
      body: JSON.stringify({ actions })
    });
  },

  // Hàm tự động đồng bộ hàng đợi ngoại tuyến khi có mạng
  syncPendingQueue: async () => {
    const pendingActions = getOfflineActions();
    if (!pendingActions || pendingActions.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    try {
      const res = await fetchWithAuth("/driver/sync", {
        method: "POST",
        body: JSON.stringify({ actions: pendingActions })
      });
      clearOfflineActions();
      return res;
    } catch (err) {
      console.error("Error flushing offline queue:", err);
      throw err;
    }
  }
};
