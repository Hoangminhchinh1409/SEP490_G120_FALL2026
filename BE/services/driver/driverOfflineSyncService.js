const prisma = require("../../config/prisma");
const { serializePrisma } = require("../../utils/prismaHelper");
const { normalizeWeeklyShiftType } = require("./driverHelper");
const {
  acceptTrip,
  arriveAtStop,
  recordPickup,
  recordDelivery,
  recordStopEvent,
} = require("./driverTripExecutionService");
const {
  reportCustomerRefusal,
  proposeExtraFee,
  reportIncident,
} = require("./driverIncidentFeeService");
const { registerShift } = require("./driverShiftLeaveService");

// ==========================================
// 12. OFFLINE SYNC
// ==========================================

const formatActionDescription = (type, payload = {}, tripId, stopId) => {
  switch (type) {
    case "ACCEPT_TRIP":
      return `Xác nhận nhận chuyến xe ${tripId ? `#${tripId}` : ""}`.trim();
    case "ARRIVE_STOP":
      return `Đến điểm dừng ${stopId ? `#${stopId}` : ""} (Arrived)`.trim();
    case "RECORD_STOP_EVENT": {
      const eventName =
        payload?.event_type || payload?.eventType || "Tiến trình";
      const eventMap = {
        LOADING_START: "Bắt đầu bốc hàng (Loading Started)",
        LOADING_DONE: "Bốc hàng xong (Loading Done)",
        UNLOADING_START: "Bắt đầu dỡ hàng (Unloading Started)",
        UNLOADING_DONE: "Dỡ hàng xong (Unloading Done)",
        DEPARTED: "Xe lăn bánh rời điểm dừng (Left)",
      };
      return (
        eventMap[eventName] || `Cập nhật trạng thái điểm dừng: ${eventName}`
      );
    }
    case "RECORD_PICKUP": {
      const seal = payload?.seal_number || payload?.sealNumber || "";
      return `Lấy hàng & Niêm phong seal ${seal ? `#${seal}` : ""} (Picked Up)`.trim();
    }
    case "RECORD_DELIVERY": {
      const receiver =
        payload?.receiver_name || payload?.receiverName || "Khách hàng";
      return `Giao hàng thành công & Ký nhận POD (${receiver})`;
    }
    case "REFUSE_CARGO": {
      const reason =
        payload?.rejection_reason || payload?.reason || "Khách từ chối nhận";
      return `Người nhận từ chối nhận hàng (Lý do: ${reason})`;
    }
    case "PROPOSE_EXTRA_FEE": {
      const amount = Number(payload?.amount || 0).toLocaleString("vi-VN");
      const feeName = payload?.fee_type || payload?.feeType || "Phụ phí";
      return `Đề xuất phụ phí phát sinh: ${amount} đ (${feeName})`;
    }
    case "REGISTER_SHIFT": {
      const date =
        payload?.date || payload?.work_date || payload?.workDate || "Ngày làm";
      let startStr = payload?.start_time || payload?.startTime || "";
      let endStr = payload?.end_time || payload?.endTime || "";
      if (typeof startStr === "string" && startStr.includes("T")) {
        try {
          const d = new Date(startStr);
          startStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } catch {}
      }
      if (typeof endStr === "string" && endStr.includes("T")) {
        try {
          const d = new Date(endStr);
          endStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } catch {}
      }
      const st = normalizeWeeklyShiftType(payload);
      if (st) {
        const wk = payload?.week_start || date;
        const label =
          st === "MORNING"
            ? "Ca Sáng (08:00 - 17:00)"
            : "Ca Đêm (20:00 - 06:00 hôm sau)";
        return `Đăng ký ${label} cả tuần bắt đầu ${wk}`;
      }
      const hours = startStr && endStr ? ` (${startStr} - ${endStr})` : "";
      return `Đăng ký ca làm việc ngày ${date}${hours}`;
    }
    case "REPORT_INCIDENT": {
      const desc = payload?.description || payload?.type || "Sự cố giao thông";
      return `Báo cáo sự cố khẩn cấp: ${desc}`;
    }
    default:
      return `Thao tác ngoại tuyến [${type}]`;
  }
};

const syncOfflineActions = async (userId, actions = []) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { success: true, syncedCount: 0, results: [] };
  }

  if (actions.length > 50) {
    const error = new Error(
      "Đã đạt giới hạn 50 thao tác ngoại tuyến chưa đồng bộ.",
    );
    error.statusCode = 400;
    throw error;
  }

  const results = [];
  for (const actionItem of actions) {
    const { type, tripId, stopId, payload = {} } = actionItem || {};
    const label = formatActionDescription(type, payload, tripId, stopId);
    const clientActionId =
      payload?.clientActionId || actionItem?.clientActionId;
    const clientTime =
      payload?.phoneTime ||
      actionItem?.phoneTime ||
      actionItem?.queuedAt ||
      new Date().toISOString();

    try {
      let res;
      switch (type) {
        case "ACCEPT_TRIP":
          res = await acceptTrip(userId, tripId, payload);
          break;
        case "ARRIVE_STOP":
          res = await arriveAtStop(userId, tripId, stopId, payload);
          break;
        case "RECORD_PICKUP":
          res = await recordPickup(userId, tripId, stopId, payload);
          break;
        case "RECORD_DELIVERY":
          res = await recordDelivery(userId, tripId, stopId, payload);
          break;
        case "REFUSE_CARGO":
          res = await reportCustomerRefusal(userId, tripId, stopId, payload);
          break;
        case "PROPOSE_EXTRA_FEE":
          res = await proposeExtraFee(userId, tripId, payload);
          break;
        case "RECORD_STOP_EVENT":
          res = await recordStopEvent(userId, tripId, stopId, payload);
          break;
        case "REGISTER_SHIFT":
          res = await registerShift(userId, payload);
          break;
        case "REPORT_INCIDENT":
          res = await reportIncident(userId, payload);
          break;
        default:
          res = {
            success: false,
            message: `Loại hành động không hợp lệ: ${type}`,
          };
      }
      results.push({
        actionId: clientActionId,
        type,
        description: label,
        status: "SUCCESS",
        clientTime,
        syncedAt: new Date().toISOString(),
        res,
      });
    } catch (err) {
      results.push({
        actionId: clientActionId,
        type,
        description: label,
        status: "FAILED",
        clientTime,
        syncedAt: new Date().toISOString(),
        error: err.message,
      });
    }
  }

  const syncedCount = results.filter((r) => r.status === "SUCCESS").length;
  const failedCount = results.filter((r) => r.status === "FAILED").length;
  const totalCount = results.length;

  let logId = null;

  try {
    // 1. Lưu bản ghi kiểm tra chi tiết các hành động vào activity_logs (Database)
    const actLog = await prisma.activity_logs.create({
      data: {
        actor_id: BigInt(userId),
        actor_type: "DRIVER",
        action: "OFFLINE_SYNC",
        target_type: "OFFLINE_SYNC",
        target_id: 0n,
        changes: {
          totalCount,
          syncedCount,
          failedCount,
          items: results.map((r) => ({
            actionId: r.actionId,
            type: r.type,
            description: r.description,
            status: r.status,
            clientTime: r.clientTime,
            syncedAt: r.syncedAt,
            error: r.error || null,
          })),
        },
        reason: `Đồng bộ ngoại tuyến: ${syncedCount}/${totalCount} thành công`,
      },
      select: { id: true },
    });

    if (actLog) {
      logId = Number(actLog.id);
    }
  } catch (logErr) {
    console.warn("Failed to insert offline sync activity log:", logErr.message);
  }

  try {
    // 2. Tạo thông báo hiển thị cho Driver
    const notifMessage =
      failedCount === 0
        ? `Đã đồng bộ thành công ${syncedCount}/${totalCount} hành động ngoại tuyến lên máy chủ. Bấm để xem chi tiết danh sách.`
        : `Đồng bộ ngoại tuyến hoàn tất: ${syncedCount}/${totalCount} thành công (${failedCount} thao tác bị lỗi). Bấm để kiểm tra chi tiết.`;

    await prisma.notifications.create({
      data: {
        user_account_id: BigInt(userId),
        target_type: "OFFLINE_SYNC",
        target_id: logId ? BigInt(logId) : null,
        message: notifMessage,
        created_time: new Date(),
        read_time: null,
      },
    });
  } catch (notifErr) {
    console.warn(
      "Failed to insert offline sync notification:",
      notifErr.message,
    );
  }

  return {
    success: true,
    syncedCount,
    failedCount,
    totalCount,
    logId,
    results,
  };
};

const getSyncLogDetail = async (userId, logId) => {
  if (!logId) {
    const error = new Error("Mã bản ghi đồng bộ không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const data = await prisma.activity_logs.findFirst({
    where: {
      id: BigInt(Number(logId)),
      actor_id: BigInt(userId),
    },
    select: {
      id: true,
      actor_id: true,
      action: true,
      target_type: true,
      changes: true,
      reason: true,
      created_time: true,
    },
  });

  if (!data) {
    const err = new Error("Không tìm thấy chi tiết phiên đồng bộ này");
    err.statusCode = 404;
    throw err;
  }

  return serializePrisma(data);
};

module.exports = {
  syncOfflineActions,
  getSyncLogDetail,
};
