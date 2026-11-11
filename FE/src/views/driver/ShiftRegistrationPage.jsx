"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Input, Popconfirm, Spin, Tag } from "antd";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Moon,
  RefreshCw,
  ShieldAlert,
  Sun,
  Trash2,
  Truck,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import dayjs from "dayjs";
import { driverApi, queueOfflineAction } from "../../api/driverApi";

const WEEKDAY_LABELS = [
  "Chủ Nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

const SHIFT_OPTIONS = [
  {
    value: "MORNING",
    title: "Ca Sáng (Thứ 2 – Chủ Nhật)",
    timeRange: "08:00 - 17:00",
    subDesc: "Làm việc khung giờ ban ngày cố định suốt cả tuần",
    icon: Sun,
  },
  {
    value: "NIGHT",
    title: "Ca Đêm (Thứ 2 – Chủ Nhật)",
    timeRange: "17:00 - 08:00 hôm sau",
    subDesc: "Làm việc khung giờ ca đêm xuyên ngày cố định suốt cả tuần",
    icon: Moon,
  },
];

// Tính Thứ 2 đầu tuần bất kể locale trình duyệt / dayjs
const getMondayOfWeek = (d = dayjs()) => {
  const dow = d.day(); // 0=CN, 1=T2..6=T7
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return d.startOf("day").add(diffToMon, "day");
};

const detectShiftType = (shift) => {
  if (!shift) return null;
  const noteStr = String(shift.note || "").toUpperCase();
  if (noteStr.includes("CA SÁNG") || noteStr.includes("MORNING")) return "MORNING";
  if (noteStr.includes("CA ĐÊM") || noteStr.includes("NIGHT")) return "NIGHT";
  if (shift.start_time) {
    const h = dayjs(shift.start_time).hour();
    return h >= 17 || h < 6 ? "NIGHT" : "MORNING";
  }
  return "MORNING";
};

const formatShiftSummaryText = (shift) => {
  if (!shift) return "Chưa đăng ký / chưa được xếp ca";
  const st = shift.start_time ? dayjs(shift.start_time).format("HH:mm") : null;
  const et = shift.end_time ? dayjs(shift.end_time).format("HH:mm") : null;
  if (st === "08:00" && et === "17:00") return "Ca Sáng • 08:00 – 17:00";
  if (st === "17:00" && et === "08:00") return "Ca Đêm • 17:00 – 08:00 (+1 ngày)";
  if (st && et) return `Ca tùy chỉnh • ${st} – ${et}`;
  const sType = detectShiftType(shift);
  return sType === "NIGHT" ? "Ca Đêm • 17:00 – 08:00 (+1 ngày)" : "Ca Sáng • 08:00 – 17:00";
};

const isSystemAutoAssigned = (shift) => {
  if (!shift) return false;
  const noteStr = String(shift.note || "");
  return (
    noteStr.includes("[Hệ thống tự động xếp lịch]") ||
    shift.registered_by === null ||
    shift.registered_by === undefined
  );
};

const TRIP_STATUS_LABELS = {
  Assigned: { label: "Chờ nhận", cls: "border-blue-500/40 bg-blue-950/60 text-blue-300" },
  Dispatched: { label: "Đã điều xe", cls: "border-sky-500/40 bg-sky-950/60 text-sky-300" },
  Accepted: { label: "Đã nhận", cls: "border-indigo-500/40 bg-indigo-950/60 text-indigo-300" },
  "In Progress": { label: "Đang chạy", cls: "border-amber-500/40 bg-amber-950/60 text-amber-300" },
  Completed: { label: "Hoàn thành", cls: "border-emerald-500/40 bg-emerald-950/60 text-emerald-300" },
  Cancelled: { label: "Đã hủy", cls: "border-red-500/40 bg-red-950/60 text-red-300" },
};

const mergeDriverTrips = (activeRes, historyRes) => {
  const map = new Map();
  const upcoming = activeRes?.upcomingTrips || (activeRes?.trip ? [activeRes.trip] : []);
  const history = historyRes?.trips || [];
  [...upcoming, ...history].forEach((t) => {
    if (t && t.id && !map.has(t.id)) {
      map.set(t.id, t);
    }
  });
  return Array.from(map.values());
};

export default function ShiftRegistrationPage() {
  const router = useRouter();
  const { message } = App.useApp();

  const currentMonday = useMemo(() => getMondayOfWeek(dayjs()), []);
  const nextMonday = useMemo(() => currentMonday.add(7, "day"), [currentMonday]);

  // Mặc định mở tab Tuần tới để tài xế đăng ký nhanh
  const [selectedMonday, setSelectedMonday] = useState(() => getMondayOfWeek(dayjs()).add(7, "day"));
  const [selectedShiftType, setSelectedShiftType] = useState("MORNING");
  const [note, setNote] = useState("");

  const [shifts, setShifts] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const weekStartStr = useMemo(() => selectedMonday.format("YYYY-MM-DD"), [selectedMonday]);
  const weekEnd = useMemo(() => selectedMonday.add(6, "day"), [selectedMonday]);
  const weekEndStr = useMemo(() => weekEnd.format("YYYY-MM-DD"), [weekEnd]);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsRes, activeRes, historyRes] = await Promise.all([
        driverApi.getMyShifts({ from: weekStartStr, to: weekEndStr }),
        driverApi.getActiveTrip().catch(() => ({ trip: null, upcomingTrips: [] })),
        driverApi.getTripHistory({ page: 1, limit: 50 }).catch(() => ({ trips: [] })),
      ]);
      const rows = Array.isArray(shiftsRes) ? shiftsRes : shiftsRes?.shifts || shiftsRes?.data || [];
      setShifts(rows);
      setDriverTrips(mergeDriverTrips(activeRes, historyRes));
    } catch (err) {
      console.error("fetchShifts error:", err);
      message.error(err.message || "Không thể tải lịch làm việc của bạn.");
    } finally {
      setLoading(false);
    }
  }, [weekStartStr, weekEndStr, message]);

  useEffect(() => {
    let active = true;
    const loadWeekShifts = async () => {
      try {
        const [shiftsRes, activeRes, historyRes] = await Promise.all([
          driverApi.getMyShifts({ from: weekStartStr, to: weekEndStr }),
          driverApi.getActiveTrip().catch(() => ({ trip: null, upcomingTrips: [] })),
          driverApi.getTripHistory({ page: 1, limit: 50 }).catch(() => ({ trips: [] })),
        ]);
        if (!active) return;
        const rows = Array.isArray(shiftsRes) ? shiftsRes : shiftsRes?.shifts || shiftsRes?.data || [];
        setShifts(rows);
        setDriverTrips(mergeDriverTrips(activeRes, historyRes));
      } catch (err) {
        if (active) {
          console.error("fetchShifts error:", err);
          message.error(err.message || "Không thể tải lịch làm việc của bạn.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadWeekShifts();
    return () => {
      active = false;
    };
  }, [weekStartStr, weekEndStr, message]);

  // Tính trạng thái tuần đang chọn
  const activeWeekShifts = useMemo(
    () => shifts.filter((s) => s.status !== "Rejected"),
    [shifts]
  );

  const rejectedWeekShifts = useMemo(
    () => shifts.filter((s) => s.status === "Rejected"),
    [shifts]
  );

  const hasAutoAssigned = useMemo(
    () => activeWeekShifts.some((s) => isSystemAutoAssigned(s)),
    [activeWeekShifts]
  );

  const hasApproved = useMemo(
    () => activeWeekShifts.some((s) => s.status === "Approved"),
    [activeWeekShifts]
  );

  const hasPendingRequested = useMemo(
    () => !hasApproved && !hasAutoAssigned && activeWeekShifts.some((s) => s.status === "Requested"),
    [activeWeekShifts, hasApproved, hasAutoAssigned]
  );

  const lockedShiftType = useMemo(() => {
    if (activeWeekShifts.length === 0) return null;
    return detectShiftType(activeWeekShifts[0]);
  }, [activeWeekShifts]);

  const now = dayjs();
  const todayStr = now.format("YYYY-MM-DD");
  const isPastWeek = weekEndStr < todayStr;
  const isNextWeek = weekStartStr === nextMonday.format("YYYY-MM-DD");
  const isCurrentWeek = weekStartStr === currentMonday.format("YYYY-MM-DD");
  const isPastSundayDeadline = isNextWeek && now.day() === 0 && now.hour() >= 22;

  const canRegister =
    !loading &&
    activeWeekShifts.length === 0 &&
    !isPastWeek &&
    !isPastSundayDeadline;

  const handleSubmitWeekShift = async () => {
    if (!canRegister) return;

    const payload = {
      week_start: weekStartStr,
      shift_type: selectedShiftType,
      note: note.trim() || null,
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueOfflineAction("REGISTER_SHIFT", null, null, payload);
      message.info("Đang mất mạng: Yêu cầu đăng ký ca cả tuần đã lưu vào hàng đợi ngoại tuyến!");
      setNote("");
      return;
    }

    setSubmitting(true);
    try {
      const res = await driverApi.registerShift(payload);
      const count = res?.count || res?.data?.count || 7;
      const shiftLabel =
        selectedShiftType === "MORNING"
          ? "Ca Sáng (08:00 - 17:00)"
          : "Ca Đêm (17:00 - 08:00 hôm sau)";
      message.success(`Đã gửi đăng ký ${shiftLabel} cho ${count} ngày trong tuần!`);
      setNote("");
      await fetchShifts();
    } catch (err) {
      message.error(err.message || "Không thể đăng ký lịch tuần. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWeek = async () => {
    const firstPending = activeWeekShifts.find((s) => s.status === "Requested");
    if (!firstPending) return;

    setCancelling(true);
    try {
      const res = await driverApi.cancelShift(firstPending.id);
      message.success(
        res?.message || "Đã hủy đăng ký cả tuần. Bạn có thể chọn lại Ca Sáng hoặc Ca Đêm."
      );
      await fetchShifts();
    } catch (err) {
      message.error(err.message || "Không thể hủy lịch đăng ký tuần.");
    } finally {
      setCancelling(false);
    }
  };

  // Danh sách 7 ngày Thứ 2 -> Chủ Nhật kèm các chuyến xe được giao từng ngày
  const { weekDaysList, weekTripsCount } = useMemo(() => {
    const mapByDate = new Map();
    shifts.forEach((s) => {
      if (!mapByDate.has(s.date) || s.status !== "Rejected") {
        mapByDate.set(s.date, s);
      }
    });

    const tripsByDate = new Map();
    driverTrips.forEach((tr) => {
      const rawDate = tr.planned_start || tr.created_at;
      if (!rawDate) return;
      const dKey = dayjs(rawDate).format("YYYY-MM-DD");
      if (!tripsByDate.has(dKey)) tripsByDate.set(dKey, []);
      tripsByDate.get(dKey).push(tr);
    });

    const list = Array.from({ length: 7 }, (_, i) => {
      const d = selectedMonday.add(i, "day");
      const dStr = d.format("YYYY-MM-DD");
      const shift = mapByDate.get(dStr) || null;
      const dayTrips = [...(tripsByDate.get(dStr) || [])].sort(
        (a, b) => new Date(a.planned_start || 0) - new Date(b.planned_start || 0)
      );
      return {
        dateObj: d,
        dateStr: dStr,
        dayName: WEEKDAY_LABELS[d.day()],
        isToday: dStr === todayStr,
        shift,
        dayTrips,
      };
    });

    const totalTrips = list.reduce((sum, item) => sum + item.dayTrips.length, 0);
    return { weekDaysList: list, weekTripsCount: totalTrips };
  }, [selectedMonday, shifts, driverTrips, todayStr]);

  const renderStatusBadge = (shift) => {
    if (!shift) {
      return (
        <Tag className="!m-0 !rounded-full !border-slate-700 !bg-slate-800/70 !text-slate-400 !text-[11px] !px-2.5">
          Chưa xếp lịch
        </Tag>
      );
    }
    if (shift.status === "Approved" && isSystemAutoAssigned(shift)) {
      return (
        <Tag
          icon={<Lock size={11} className="inline mr-1" />}
          className="!m-0 !rounded-full !border-amber-600/50 !bg-amber-950/60 !text-amber-300 !text-[11px] !px-2.5"
        >
          Tự động xếp (Cố định)
        </Tag>
      );
    }
    if (shift.status === "Approved") {
      return (
        <Tag
          icon={<CheckCircle2 size={11} className="inline mr-1" />}
          className="!m-0 !rounded-full !border-emerald-600/50 !bg-emerald-950/60 !text-emerald-300 !text-[11px] !px-2.5"
        >
          Đã duyệt (Cố định)
        </Tag>
      );
    }
    if (shift.status === "Requested" && isSystemAutoAssigned(shift)) {
      return (
        <Tag
          icon={<Lock size={11} className="inline mr-1" />}
          className="!m-0 !rounded-full !border-amber-600/50 !bg-amber-950/60 !text-amber-300 !text-[11px] !px-2.5"
        >
          Tự động xếp (Chờ duyệt)
        </Tag>
      );
    }
    if (shift.status === "Requested") {
      return (
        <Tag
          icon={<Clock size={11} className="inline mr-1" />}
          className="!m-0 !rounded-full !border-blue-500/50 !bg-blue-950/60 !text-blue-300 !text-[11px] !px-2.5"
        >
          Chờ duyệt
        </Tag>
      );
    }
    if (shift.status === "Rejected") {
      return (
        <Tag className="!m-0 !rounded-full !border-red-600/50 !bg-red-950/60 !text-red-300 !text-[11px] !px-2.5">
          Đã từ chối
        </Tag>
      );
    }
    return <Tag>{shift.status}</Tag>;
  };

  return (
    <div className="w-full max-w-full min-w-0 px-3 py-4 pb-24 space-y-4 text-slate-100 overflow-x-hidden">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 leading-snug">
            <Calendar size={18} className="text-blue-400 shrink-0" />
            <span className="truncate">Đăng ký lịch làm theo tuần</span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Chọn cố định 1 ca cả tuần (T2 – CN) • Hạn chót 22:00 CN
          </p>
        </div>
        <Button
          size="small"
          onClick={fetchShifts}
          loading={loading}
          className="shrink-0 !bg-slate-800 !border-slate-700 !text-slate-200 hover:!border-blue-500 !rounded-lg flex items-center gap-1"
          icon={<RefreshCw size={13} />}
        >
          Làm mới
        </Button>
      </div>

      {/* CHỌN TUẦN NHANH + MŨI TÊN CHUYỂN TUẦN */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 space-y-2.5 shadow-lg min-w-0">
        <div className="grid grid-cols-2 gap-2 w-full min-w-0">
          <button
            type="button"
            onClick={() => setSelectedMonday(currentMonday)}
            className={`min-w-0 py-2 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
              isCurrentWeek
                ? "bg-blue-600/20 border-blue-500 text-blue-300"
                : "bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            <div>Tuần này</div>
            <div className="text-[10px] font-mono opacity-80 mt-0.5">
              {currentMonday.format("DD/MM")} – {currentMonday.add(6, "day").format("DD/MM")}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonday(nextMonday)}
            className={`min-w-0 py-2 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
              isNextWeek
                ? "bg-blue-600/20 border-blue-500 text-blue-300"
                : "bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            <div>Tuần tới</div>
            <div className="text-[10px] font-mono opacity-80 mt-0.5">
              {nextMonday.format("DD/MM")} – {nextMonday.add(6, "day").format("DD/MM")}
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between gap-1 bg-slate-950/60 border border-slate-800 rounded-xl px-2 py-2 min-w-0">
          <button
            type="button"
            onClick={() => setSelectedMonday((prev) => prev.subtract(7, "day"))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer shrink-0"
            aria-label="Tuần trước"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-0 flex-1 px-1">
            <div className="text-xs sm:text-sm font-bold text-white truncate">
              T2 ({selectedMonday.format("DD/MM")}) – CN ({weekEnd.format("DD/MM/YYYY")})
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {isNextWeek
                ? "Tuần đăng ký tiếp theo"
                : isCurrentWeek
                ? "Tuần làm việc hiện tại"
                : isPastWeek
                ? "Tuần đã qua"
                : "Tuần kế hoạch"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonday((prev) => prev.add(7, "day"))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer shrink-0"
            aria-label="Tuần sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* BANNER QUY ĐỊNH 22:00 TỰ ĐỘNG XẾP LỊCH */}
      {isNextWeek && activeWeekShifts.length === 0 && !isPastSundayDeadline && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-700/40 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-200">
          <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Lưu ý hạn chót 22:00 Chủ Nhật:</span>{" "}
            Nếu bạn không đăng ký trước 22:00 Chủ Nhật, hệ thống sẽ{" "}
            <strong className="text-white">tự động xếp lịch cố định tuần tới</strong> (Ca Sáng hoặc Ca Đêm) và bạn{" "}
            <strong className="text-white">không thể chỉnh sửa</strong> sau khi đã bị xếp.
          </div>
        </div>
      )}

      {/* KHỐI TRẠNG THÁI HOẶC FORM ĐĂNG KÝ */}
      {loading ? (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 py-10 flex flex-col items-center justify-center gap-2">
          <Spin />
          <span className="text-xs text-slate-400">Đang tải lịch tuần...</span>
        </div>
      ) : hasAutoAssigned || hasApproved ? (
        <div
          className={`rounded-2xl border p-4 space-y-2 shadow-lg ${
            hasAutoAssigned
              ? "bg-amber-950/30 border-amber-700/60"
              : "bg-emerald-950/30 border-emerald-700/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock
              size={18}
              className={hasAutoAssigned ? "text-amber-400" : "text-emerald-400"}
            />
            <span className="text-sm font-bold text-white">
              {hasAutoAssigned
                ? "Hệ thống đã tự động xếp lịch & Khóa chỉnh sửa"
                : "Lịch làm việc tuần này đã được duyệt cố định"}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ca áp dụng suốt tuần ({selectedMonday.format("DD/MM")} – {weekEnd.format("DD/MM")}):{" "}
            <strong className="text-white">
              {lockedShiftType === "NIGHT"
                ? "Ca Đêm (17:00 - 08:00 hôm sau)"
                : "Ca Sáng (08:00 - 17:00)"}
            </strong>
            . Lịch đã chốt không thể sửa đổi hoặc hủy trực tiếp. Nếu có sự cố bất khả kháng, vui lòng liên hệ Quản lý.
          </p>
        </div>
      ) : hasPendingRequested ? (
        <div className="rounded-2xl bg-blue-950/30 border border-blue-700/50 p-4 space-y-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-blue-200 flex items-center gap-2">
                <Clock size={16} className="text-blue-400" />
                Đã gửi đăng ký lịch cả tuần (Chờ Quản lý duyệt)
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Ca đã chọn:{" "}
                <strong className="text-white">
                  {lockedShiftType === "NIGHT"
                    ? "Ca Đêm (17:00 - 08:00 hôm sau)"
                    : "Ca Sáng (08:00 - 17:00)"}
                </strong>{" "}
                cho toàn bộ tuần ({activeWeekShifts.length} ngày).
              </p>
            </div>
          </div>

          <Popconfirm
            title="Hủy đăng ký lịch tuần?"
            description="Toàn bộ các ngày Chờ duyệt trong tuần này sẽ bị hủy để bạn chọn lại Ca Sáng hoặc Ca Đêm."
            okText="Hủy cả tuần"
            cancelText="Giữ nguyên"
            okButtonProps={{ danger: true, loading: cancelling }}
            onConfirm={handleCancelWeek}
          >
            <Button
              danger
              loading={cancelling}
              icon={<Trash2 size={14} />}
              className="!rounded-xl !font-semibold !text-xs flex items-center"
            >
              Hủy đăng ký cả tuần để chọn lại
            </Button>
          </Popconfirm>
        </div>
      ) : isPastWeek || isPastSundayDeadline ? (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center gap-3 text-xs text-slate-300">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <span>
            {isPastWeek
              ? "Tuần này đã kết thúc, không thể đăng ký thêm ca làm việc."
              : "Đã quá hạn chót 22:00 Chủ Nhật. Hệ thống sẽ tự động xếp lịch cố định tuần tới cho bạn."}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-4 shadow-lg">
          {rejectedWeekShifts.length > 0 && (
            <div className="rounded-xl bg-red-950/30 border border-red-700/40 px-3 py-2 text-xs text-red-200">
              Đăng ký trước đó cho tuần này đã bị từ chối. Bạn có thể chọn lại ca mới bên dưới.
            </div>
          )}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Chọn ca cố định cho cả tuần ({selectedMonday.format("DD/MM")} – {weekEnd.format("DD/MM")})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SHIFT_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const isSelected = selectedShiftType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedShiftType(opt.value)}
                    className={`text-left rounded-xl p-3.5 border transition cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/40"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <IconComp size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{opt.title}</div>
                      <div className="text-xs font-semibold text-blue-300 mt-0.5">
                        {opt.timeRange}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{opt.subDesc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Ghi chú cho Quản lý (không bắt buộc)
            </label>
            <Input.TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Xin chạy cố định Ca Sáng cả tuần..."
              className="!bg-slate-950/70 !border-slate-700 !text-slate-100 placeholder:!text-slate-500 !rounded-xl"
            />
          </div>

          {typeof navigator !== "undefined" && !navigator.onLine && (
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-700/40 px-3 py-2 rounded-xl">
              <WifiOff size={14} />
              <span>Đang ngoại tuyến — Đăng ký sẽ được lưu hàng đợi để đồng bộ khi có mạng.</span>
            </div>
          )}

          <Button
            type="primary"
            block
            size="large"
            loading={submitting}
            onClick={handleSubmitWeekShift}
            className="!h-11 !rounded-xl !font-bold !bg-blue-600 hover:!bg-blue-500 !border-none"
          >
            Đăng ký cả tuần (Thứ 2 – Chủ Nhật)
          </Button>
        </div>
      )}

      {/* CHI TIẾT 7 NGÀY TRONG TUẦN */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">
            Chi tiết lịch 7 ngày ({selectedMonday.format("DD/MM")} – {weekEnd.format("DD/MM")})
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{activeWeekShifts.length}/7 ngày có ca</span>
            <span>•</span>
            <span className="text-blue-300 font-semibold">{weekTripsCount} chuyến được giao</span>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {weekDaysList.map(({ dateObj, dateStr, dayName, isToday, shift, dayTrips }) => {
            return (
              <div key={dateStr} className="py-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {dayName}, {dateObj.format("DD/MM")}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/40 text-[10px] font-semibold">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatShiftSummaryText(shift)}
                    </div>
                    {shift?.note && !shift.note.includes("Đăng ký ca cố định cả tuần") && (
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[210px]">
                        {shift.note}
                      </div>
                    )}
                    {shift?.rejection_reason && shift.status === "Rejected" && (
                      <div className="text-[11px] text-red-400 mt-0.5">
                        Lý do từ chối: {shift.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">{renderStatusBadge(shift)}</div>
                </div>

                {dayTrips.length > 0 && (
                  <div className="space-y-1.5 pl-2.5 border-l-2 border-blue-500/40 min-w-0 w-full overflow-hidden">
                    {dayTrips.map((tr) => {
                      const statusCfg = TRIP_STATUS_LABELS[tr.status] || {
                        label: tr.status || "Chuyến xe",
                        cls: "border-slate-700 bg-slate-800 text-slate-300",
                      };
                      const plate =
                        tr.truck?.plate_number ||
                        tr.truck_assignments?.[0]?.truck?.plate_number ||
                        "";
                      const sortedStops = [...(tr.stops || [])].sort(
                        (a, b) => (a.sequence || 0) - (b.sequence || 0)
                      );
                      const firstLoc = sortedStops[0]?.location?.name;
                      const lastLoc =
                        sortedStops.length > 1
                          ? sortedStops[sortedStops.length - 1]?.location?.name
                          : null;
                      const routeText =
                        firstLoc && lastLoc
                          ? `${firstLoc} → ${lastLoc}`
                          : firstLoc || `${sortedStops.length} điểm dừng`;

                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => router.push(`/driver?tripId=${tr.id}`)}
                          className="w-full max-w-full min-w-0 overflow-hidden text-left rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 px-2.5 py-2 transition cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0 overflow-hidden space-y-0.5">
                            <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                              <span className="inline-flex items-center gap-1 font-bold text-blue-300 shrink-0">
                                <Truck size={12} />
                                {tr.trip_code || `TRIP-${tr.id}`}
                              </span>
                              {tr.planned_start && (
                                <span className="text-[11px] font-mono text-slate-300 shrink-0">
                                  {dayjs(tr.planned_start).format("HH:mm")}
                                </span>
                              )}
                              {plate && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                                  {plate}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 min-w-0 w-full">
                              <MapPin size={11} className="shrink-0 text-slate-500" />
                              <span className="truncate flex-1 min-w-0 block">{routeText}</span>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusCfg.cls}`}
                          >
                            {statusCfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
