import dayjs from "dayjs";

// Helper nhận diện điểm lấy hàng (Pickup), điểm giao hàng (Drop-off) hoặc điểm hoàn hàng về kho ALS (Return)
export const isPickupStop = (stop) => {
  if (!stop) return false;
  const raw = String(stop.raw_stop_type || stop.stop_type || stop.type || "")
    .trim()
    .toUpperCase();
  if (raw === "PICKUP" || raw === "LẤY HÀNG" || raw === "LAY HANG") return true;
  if (
    raw === "DROPOFF" ||
    raw === "DROP-OFF" ||
    raw === "DROP_OFF" ||
    raw === "DELIVERY" ||
    raw === "GIAO HÀNG" ||
    raw === "GIAO HANG" ||
    raw === "RETURN" ||
    raw === "RETURN_TO_WAREHOUSE" ||
    raw === "HOÀN KHO" ||
    raw === "REST" ||
    raw === "TRANSIT"
  ) {
    return false;
  }
  // Quy chuẩn nghiệp vụ vận tải ALS: Điểm dừng sequence 1 luôn là điểm lấy hàng (Pickup)
  return stop.sequence === 1;
};

export const isReturnWarehouseStop = (stop) => {
  if (!stop) return false;
  const raw = String(stop.raw_stop_type || stop.stop_type || stop.type || "")
    .trim()
    .toUpperCase();
  return raw === "RETURN" || raw === "RETURN_TO_WAREHOUSE" || raw === "HOÀN KHO";
};

export const isDropoffStop = (stop) => {
  if (!stop) return false;
  return !isPickupStop(stop);
};

// Chuẩn hóa nhãn trạng thái điểm dừng sang tiếng Việt
export const formatStopStatus = (status, stopType = "Pickup") => {
  switch (status) {
    case "Pending":
      return "Chờ xử lý";
    case "Arrived":
      return "Đã đến nơi";
    case "Loading Started":
      return stopType === "Pickup" ? "Đang bốc hàng" : "Đang dỡ hàng";
    case "Loading Done":
      return stopType === "Pickup" ? "Đã bốc xong" : "Đã dỡ xong";
    case "Done":
      return "Hoàn thành";
    case "Skipped":
      return "Bỏ qua";
    case "Cancelled":
      return "Đã hủy";
    default:
      return status || "Chờ xử lý";
  }
};

// Chuẩn hóa nhãn trạng thái chuyến xe sang tiếng Việt
export const formatTripStatus = (status) => {
  switch (status) {
    case "Assigned":
      return "Sắp tới";
    case "Accepted":
      return "Đã nhận";
    case "In Progress":
      return "Đang chạy";
    case "Completed":
      return "Hoàn thành";
    case "Cancelled":
      return "Đã hủy";
    default:
      return status || "Không xác định";
  }
};

export const formatTripDateTime = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}p`;
  if (h > 0) return `${h}h`;
  return `${m}p`;
};

// Helper lấy tọa độ GPS
export const getCurrentGps = () => {
  return new Promise((resolve) => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            phoneLat: pos.coords.latitude,
            phoneLng: pos.coords.longitude,
          }),
        () => resolve({ phoneLat: null, phoneLng: null }),
        { timeout: 5000, enableHighAccuracy: true },
      );
    } else {
      resolve({ phoneLat: null, phoneLng: null });
    }
  });
};

export const getMondayOfWeek = (d = dayjs()) => {
  const day = d.day();
  const diff = day === 0 ? -6 : 1 - day;
  return d.startOf("day").add(diff, "day");
};
