import { Sun, Moon } from "lucide-react";
import dayjs from "dayjs";

export const WEEKDAY_LABELS = [
  "Chủ Nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

export const SHIFT_OPTIONS = [
  {
    value: "MORNING",
    title: "Ca Sáng (Thứ 2 – Chủ Nhật)",
    timeRange: "08:00 - 18:00",
    subDesc: "Làm việc khung giờ ban ngày cố định suốt cả tuần",
    icon: Sun,
  },
  {
    value: "NIGHT",
    title: "Ca Đêm (Thứ 2 – Chủ Nhật)",
    timeRange: "19:00 - 07:00 hôm sau",
    subDesc: "Làm việc khung giờ ca đêm xuyên ngày cố định suốt cả tuần",
    icon: Moon,
  },
];

// Tính Thứ 2 đầu tuần bất kể locale trình duyệt / dayjs
export const getMondayOfWeek = (d = dayjs()) => {
  const dow = d.day(); // 0=CN, 1=T2..6=T7
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return d.startOf("day").add(diffToMon, "day");
};

export const detectShiftType = (shift) => {
  if (!shift) return null;
  const noteStr = String(shift.note || "").toUpperCase();
  if (noteStr.includes("CA SÁNG") || noteStr.includes("MORNING"))
    return "MORNING";
  if (noteStr.includes("CA ĐÊM") || noteStr.includes("NIGHT")) return "NIGHT";
  if (shift.start_time) {
    const h = dayjs(shift.start_time).hour();
    return h >= 17 || h < 6 ? "NIGHT" : "MORNING";
  }
  return "MORNING";
};

export const formatShiftSummaryText = (shift) => {
  if (!shift) return "Chưa đăng ký / chưa được xếp ca";
  const st = shift.start_time ? dayjs(shift.start_time).format("HH:mm") : null;
  const et = shift.end_time ? dayjs(shift.end_time).format("HH:mm") : null;
  if (st === "08:00" && et === "18:00") return "Ca Sáng • 08:00 – 18:00";
  if (st === "19:00" && et === "07:00")
    return "Ca Đêm • 19:00 – 07:00 (+1 ngày)";
  if (st && et) return `Ca tùy chỉnh • ${st} – ${et}`;
  const sType = detectShiftType(shift);
  return sType === "NIGHT"
    ? "Ca Đêm • 19:00 – 07:00 (+1 ngày)"
    : "Ca Sáng • 08:00 – 18:00";
};

export const isSystemAutoAssigned = (shift) => {
  if (!shift) return false;
  const noteStr = String(shift.note || "");
  return (
    noteStr.includes("[Hệ thống tự động xếp lịch]") ||
    shift.registered_by === null ||
    shift.registered_by === undefined
  );
};

export const TRIP_STATUS_LABELS = {
  Assigned: {
    label: "Sắp tới",
    cls: "border-blue-500/40 bg-blue-950/60 text-blue-300",
  },
  Dispatched: {
    label: "Đã điều xe",
    cls: "border-sky-500/40 bg-sky-950/60 text-sky-300",
  },
  Accepted: {
    label: "Đã nhận",
    cls: "border-indigo-500/40 bg-indigo-950/60 text-indigo-300",
  },
  "In Progress": {
    label: "Đang chạy",
    cls: "border-amber-500/40 bg-amber-950/60 text-amber-300",
  },
  Completed: {
    label: "Hoàn thành",
    cls: "border-emerald-500/40 bg-emerald-950/60 text-emerald-300",
  },
  Cancelled: {
    label: "Đã hủy",
    cls: "border-red-500/40 bg-red-950/60 text-red-300",
  },
};

export const mergeDriverTrips = (activeRes, historyRes) => {
  const map = new Map();
  const upcoming =
    activeRes?.upcomingTrips || (activeRes?.trip ? [activeRes.trip] : []);
  const history = historyRes?.trips || [];
  [...upcoming, ...history].forEach((t) => {
    if (t && t.id && !map.has(t.id)) {
      map.set(t.id, t);
    }
  });
  return Array.from(map.values());
};
