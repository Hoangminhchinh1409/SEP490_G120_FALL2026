const fs = require("fs");
const path = require("path");
const { Zalo, ThreadType } = require("zca-js");

const SESSION_PATH = path.join(__dirname, "../config/zalo_session.json");

let cachedApi = null;
let lastLoginTime = 0;

/**
 * Lấy đối tượng Zalo API đã đăng nhập (sử dụng session cache để không phải đăng nhập lại mỗi lần gửi)
 */
async function getZaloApi() {
  if (!fs.existsSync(SESSION_PATH)) {
    console.warn(
      "[ZaloService] Chưa tìm thấy file session (BE/config/zalo_session.json). Hãy chạy npm run zalo:login để đăng nhập.",
    );
    return null;
  }

  // Tái sử dụng session nếu đã login trong vòng 1 giờ
  const now = Date.now();
  if (cachedApi && now - lastLoginTime < 3600000) {
    return cachedApi;
  }

  try {
    const raw = fs.readFileSync(SESSION_PATH, "utf8");
    const sessionData = JSON.parse(raw);
    const zalo = new Zalo({ logging: false });

    cachedApi = await zalo.login(sessionData);
    lastLoginTime = now;
    console.log("[ZaloService] Khởi tạo kết nối Zalo thành công!");
    return cachedApi;
  } catch (err) {
    console.warn(
      "[ZaloService] Lỗi khôi phục phiên Zalo từ session:",
      err.message,
    );
    cachedApi = null;
    return null;
  }
}

/**
 * Định dạng nội dung tin nhắn gửi vào Group Ops
 */
function formatTripMessage(trip) {
  const tripCode = trip.tripCode || trip.trip_code || "TRIP-DEMO";
  const orderCode = trip.orderCode || trip.order_code || "ORD-DEMO";
  const hawb = trip.hawbNumber || trip.hawb_number || "HAWB-AUTO";
  const truck = trip.truckPlate || trip.truck_plate || "Xe tải 2.5T";
  const truckModel = trip.truckModel || "Xe tải thùng kín";
  const driver = trip.driverName || trip.driver_name || "Bác tài";
  const driverPhone = trip.driverPhone || trip.driver_phone || "0912.345.678";
  const eta = trip.plannedEta || trip.eta || "08:30 sáng nay";
  const pickup =
    trip.pickupAddress || trip.pickup || "Kho ALS Sân Bay Quốc tế Nội Bài";
  const delivery =
    trip.deliveryAddress || trip.delivery || "KCN Quế Võ, Bắc Ninh";
  const weight = trip.weightKg
    ? `${Number(trip.weightKg).toLocaleString()} kg`
    : "Theo lệnh xuất kho";

  const appFrontendUrl =
    process.env.APP_FRONTEND_URL || "http://localhost:3000";
  const trackingUrl = `${appFrontendUrl}/trips/${tripCode}`;

  return `
🚨 [THÔNG BÁO ĐIỀU XE ĐẾN NỘI BÀI] 🚨
Mã chuyến: ${tripCode} | Đơn: ${orderCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Tuyến: ${pickup} ➔ ${delivery}
⏱️ Dự kiến xe đến kho: ${eta}

🚛 THÔNG TIN PHƯƠNG TIỆN:
• Biển số xe: ${truck} (${truckModel})
• Bác tài: ${driver}
• SĐT Bác tài: ${driverPhone} (Bấm để gọi)

📋 THỦ TỤC HÀNG HÓA KHO ALS:
• Mã HAWB: ${hawb}
• Trọng lượng: ${weight}
• Trạng thái hồ sơ: Đã duyệt Hải quan trực tuyến

👷 OPS TRỰC CA NỘI BÀI:
• Phụ trách tiếp nhận: 0988.111.xxx / 0977.222.xxx

👉 Xem chi tiết chuyến & lệnh vận chuyển:
${trackingUrl}
`;
}

/**
 * Gửi thông báo chuyến xe đến Group Zalo của đội Ops
 * Hoàn toàn non-blocking (chạy ngầm, không làm đơ hay chậm việc tạo chuyến)
 */
async function sendOpsTripNotification(tripPayload) {
  const isEnabled = process.env.ZALO_NOTIFY_ENABLED !== "false";
  if (!isEnabled) {
    console.log(
      "[ZaloService] Tính năng thông báo Zalo đang tắt (ZALO_NOTIFY_ENABLED=false).",
    );
    return;
  }

  const groupId = process.env.ZALO_OPS_GROUP_ID;
  const message = formatTripMessage(tripPayload);

  // 1. Thử gửi trực tiếp qua Zalo Client nếu có groupId và session
  if (groupId) {
    try {
      const api = await getZaloApi();
      if (api) {
        await api.sendMessage({ msg: message }, groupId, ThreadType.Group);
        console.log(
          `[ZaloService] ✅ Đã gửi tin nhắn thông báo chuyến ${tripPayload.tripCode || ""} vào Group Zalo (ID: ${groupId})!`,
        );
        return;
      }
    } catch (sendErr) {
      console.warn(
        "[ZaloService] Lỗi khi gửi tin vào Group Zalo:",
        sendErr.message,
      );
    }
  }

  // 2. Gửi qua Webhook trung gian nếu có cấu hình ZALO_OPS_WEBHOOK_URL
  const webhookUrl = process.env.ZALO_OPS_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.startsWith("http")) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "trip.assigned",
          message,
          data: tripPayload,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      });
      console.log(
        `[ZaloService] ✅ Đã bắn Webhook thành công sang: ${webhookUrl}`,
      );
      return;
    } catch (whErr) {
      console.warn("[ZaloService] Webhook warning:", whErr.message);
    }
  }

  // 3. Fallback: Log tin nhắn mẫu ra màn hình console (chế độ demo/offline)
  console.log("\n[ZaloService - MOCK LOG] Tin nhắn gửi tới Đội Ops:");
  console.log(message);
  console.log("--------------------------------------------------\n");
}

module.exports = {
  getZaloApi,
  formatTripMessage,
  sendOpsTripNotification,
};
