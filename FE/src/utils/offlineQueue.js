// FE/src/utils/offlineQueue.js
// Quản lý Hàng đợi Ngoại tuyến (IndexedDB) & Cache Tài liệu cho Driver PWA
// Tham chiếu: Report 4 (SDS) Mục 6781, BR-27, BR-37, MSG39

const DB_NAME = "nexlog_driver_pwa_db";
const DB_VERSION = 1;
const STORE_QUEUE = "driver_offline_queue";
const STORE_DOCS = "trip_documents_cache";
const MAX_QUEUE_LIMIT = 50;

/**
 * Khởi tạo hoặc mở IndexedDB
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: "tripId" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Fallback localStorage key
const LOCAL_STORAGE_KEY = "nexlog_driver_offline_actions";

function getLocalStorageQueue() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalStorageQueue(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
}

/**
 * Thêm một hành động vào hàng đợi ngoại tuyến (Tối đa 50 hành động - MSG39)
 */
export async function enqueueAction(action) {
  const item = {
    ...action,
    clientActionId: action.clientActionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}`),
    phoneTime: action.phoneTime || new Date().toISOString(),
    queuedAt: new Date().toISOString()
  };

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      const countReq = store.count();

      countReq.onsuccess = () => {
        if (countReq.result >= MAX_QUEUE_LIMIT) {
          return reject(new Error("Điện thoại đang giữ quá nhiều cập nhật chưa gửi. Hãy kết nối mạng để gửi trước khi làm tiếp. (MSG39)"));
        }
        const addReq = store.add(item);
        addReq.onsuccess = () => resolve(item);
        addReq.onerror = () => reject(addReq.error);
      };
      countReq.onerror = () => reject(countReq.error);
    });
  } catch (err) {
    // Fallback to localStorage
    const queue = getLocalStorageQueue();
    if (queue.length >= MAX_QUEUE_LIMIT) {
      throw new Error("Điện thoại đang giữ quá nhiều cập nhật chưa gửi. Hãy kết nối mạng để gửi trước khi làm tiếp. (MSG39)");
    }
    queue.push(item);
    saveLocalStorageQueue(queue);
    return item;
  }
}

/**
 * Lấy tất cả hành động đang chờ gửi
 */
export async function getPendingActions() {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, "readonly");
      const store = tx.objectStore(STORE_QUEUE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return getLocalStorageQueue();
  }
}

/**
 * Lấy số lượng hành động đang chờ gửi
 */
export async function getPendingCount() {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_QUEUE, "readonly");
      const store = tx.objectStore(STORE_QUEUE);
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result || 0);
      countReq.onerror = () => resolve(getLocalStorageQueue().length);
    });
  } catch (err) {
    return getLocalStorageQueue().length;
  }
}

/**
 * Xóa sạch hàng đợi ngoại tuyến sau khi đồng bộ thành công
 */
export async function clearOfflineQueue() {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        saveLocalStorageQueue([]);
        resolve(true);
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  } catch (err) {
    saveLocalStorageQueue([]);
    return true;
  }
}

/**
 * Lưu bộ chứng từ chuyến xe (Waybill, giấy tờ hải quan) để đọc ngoại tuyến (Mục 6781)
 */
export async function cacheTripDocuments(tripId, documents) {
  if (!tripId) return;
  const payload = {
    tripId: String(tripId),
    documents,
    cachedAt: new Date().toISOString()
  };

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DOCS, "readwrite");
      const store = tx.objectStore(STORE_DOCS);
      const req = store.put(payload);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try {
      localStorage.setItem(`nexlog_docs_${tripId}`, JSON.stringify(payload));
    } catch (e) {}
  }
}

/**
 * Đọc bộ chứng từ chuyến xe đã cache khi mất sóng
 */
export async function getCachedTripDocuments(tripId) {
  if (!tripId) return null;
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DOCS, "readonly");
      const store = tx.objectStore(STORE_DOCS);
      const req = store.get(String(tripId));
      req.onsuccess = () => resolve(req.result ? req.result.documents : null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    try {
      const raw = localStorage.getItem(`nexlog_docs_${tripId}`);
      return raw ? JSON.parse(raw).documents : null;
    } catch (e) {
      return null;
    }
  }
}

/**
 * Xóa cache chứng từ khi chuyến xe hoàn thành (Completed) (Workflow Spec Sec 33)
 */
export async function removeCachedTripDocuments(tripId) {
  if (!tripId) return;
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_DOCS, "readwrite");
    tx.objectStore(STORE_DOCS).delete(String(tripId));
  } catch (err) {
    try {
      localStorage.removeItem(`nexlog_docs_${tripId}`);
    } catch (e) {}
  }
}
