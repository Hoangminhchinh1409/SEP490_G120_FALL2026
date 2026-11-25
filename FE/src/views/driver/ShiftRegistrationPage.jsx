"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { App, Button } from "antd";
import { Calendar, RefreshCw, AlertTriangle } from "lucide-react";
import dayjs from "dayjs";
import { driverApi, queueOfflineAction } from "../../api/driverApi";
import {
  WEEKDAY_LABELS,
  getMondayOfWeek,
  detectShiftType,
  isSystemAutoAssigned,
  mergeDriverTrips,
} from "./components/shiftRegistrationHelpers";
import ShiftRegistrationFormSection from "./components/ShiftRegistrationFormSection";
import ShiftRegistrationCalendar from "./components/ShiftRegistrationCalendar";
import ShiftRegistrationModals from "./components/ShiftRegistrationModals";

export default function ShiftRegistrationPage() {
  const router = useRouter();
  const { message } = App.useApp();

  const currentMonday = useMemo(() => getMondayOfWeek(dayjs()), []);
  const nextMonday = useMemo(
    () => currentMonday.add(7, "day"),
    [currentMonday],
  );

  // Mặc định mở tab Tuần này khi vào trang Ca làm việc
  const [selectedMonday, setSelectedMonday] = useState(() =>
    getMondayOfWeek(dayjs()),
  );
  const [selectedShiftType, setSelectedShiftType] = useState("MORNING");
  const [note, setNote] = useState("");

  const [shifts, setShifts] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveDates, setLeaveDates] = useState([]);
  const [customLeaveDate, setCustomLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const weekStartStr = useMemo(
    () => selectedMonday.format("YYYY-MM-DD"),
    [selectedMonday],
  );
  const weekEnd = useMemo(() => selectedMonday.add(6, "day"), [selectedMonday]);
  const weekEndStr = useMemo(() => weekEnd.format("YYYY-MM-DD"), [weekEnd]);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsRes, activeRes, historyRes, leaveRes] = await Promise.all([
        driverApi.getMyShifts({ from: weekStartStr, to: weekEndStr }),
        driverApi
          .getActiveTrip()
          .catch(() => ({ trip: null, upcomingTrips: [] })),
        driverApi
          .getTripHistory({ page: 1, limit: 50 })
          .catch(() => ({ trips: [] })),
        driverApi.getMyLeaveRequests().catch(() => ({ leaveRequests: [] })),
      ]);
      const rows = Array.isArray(shiftsRes)
        ? shiftsRes
        : shiftsRes?.shifts || shiftsRes?.data || [];
      setShifts(rows);
      setDriverTrips(mergeDriverTrips(activeRes, historyRes));
      setLeaveRequests(leaveRes?.leaveRequests || []);
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
        const [shiftsRes, activeRes, historyRes, leaveRes] = await Promise.all([
          driverApi.getMyShifts({ from: weekStartStr, to: weekEndStr }),
          driverApi
            .getActiveTrip()
            .catch(() => ({ trip: null, upcomingTrips: [] })),
          driverApi
            .getTripHistory({ page: 1, limit: 50 })
            .catch(() => ({ trips: [] })),
          driverApi.getMyLeaveRequests().catch(() => ({ leaveRequests: [] })),
        ]);
        if (!active) return;
        const rows = Array.isArray(shiftsRes)
          ? shiftsRes
          : shiftsRes?.shifts || shiftsRes?.data || [];
        setShifts(rows);
        setDriverTrips(mergeDriverTrips(activeRes, historyRes));
        setLeaveRequests(leaveRes?.leaveRequests || []);
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
    [shifts],
  );

  const rejectedWeekShifts = useMemo(
    () => shifts.filter((s) => s.status === "Rejected"),
    [shifts],
  );

  const hasAutoAssigned = useMemo(
    () => activeWeekShifts.some((s) => isSystemAutoAssigned(s)),
    [activeWeekShifts],
  );

  const hasApproved = useMemo(
    () => activeWeekShifts.some((s) => s.status === "Approved"),
    [activeWeekShifts],
  );

  const hasPendingRequested = useMemo(
    () =>
      !hasApproved &&
      !hasAutoAssigned &&
      activeWeekShifts.some((s) => s.status === "Requested"),
    [activeWeekShifts, hasApproved, hasAutoAssigned],
  );

  const lockedShiftType = useMemo(() => {
    if (activeWeekShifts.length === 0) return null;
    return detectShiftType(activeWeekShifts[0]);
  }, [activeWeekShifts]);

  const now = dayjs();
  const [nowMs] = useState(() => Date.now());
  const todayStr = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const blockedLeaveDateSet = useMemo(() => {
    const set = new Set();
    (leaveRequests || []).forEach((lr) => {
      if (lr.status === "PENDING" || lr.status === "APPROVED") {
        (lr.leave_dates || []).forEach((d) => set.add(d));
      }
    });
    return set;
  }, [leaveRequests]);

  const activeTripsByDate = useMemo(() => {
    const map = new Map();
    (driverTrips || []).forEach((tr) => {
      if (tr.status === "Completed" || tr.status === "Cancelled") return;
      const rawDate = tr.planned_start || tr.created_at;
      if (!rawDate) return;
      const dKey = dayjs(rawDate).format("YYYY-MM-DD");
      if (!map.has(dKey)) map.set(dKey, []);
      map.get(dKey).push(tr);
    });
    return map;
  }, [driverTrips]);

  const upcomingLeaveChoices = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) => {
      const d = dayjs().startOf("day").add(idx, "day");
      const dStr = d.format("YYYY-MM-DD");
      const isToday = dStr === todayStr;
      return {
        dateStr: dStr,
        dayName: isToday ? "Hôm nay" : WEEKDAY_LABELS[d.day()],
        displayDate: d.format("DD/MM"),
        tripCount: (activeTripsByDate.get(dStr) || []).length,
        alreadyRequested: blockedLeaveDateSet.has(dStr),
        isToday,
      };
    });
  }, [activeTripsByDate, blockedLeaveDateSet, todayStr]);

  const affectedLeavePreviewTrips = useMemo(() => {
    const list = [];
    const seen = new Set();
    [...leaveDates].sort().forEach((dStr) => {
      (activeTripsByDate.get(dStr) || []).forEach((tr) => {
        if (!seen.has(tr.id)) {
          seen.add(tr.id);
          const plannedMs = tr.planned_start
            ? new Date(tr.planned_start).getTime()
            : 0;
          const hoursUntil = plannedMs ? (plannedMs - nowMs) / 3600000 : null;
          const isUrgent =
            dStr === todayStr && hoursUntil !== null && hoursUntil < 2;
          list.push({ ...tr, leaveDateStr: dStr, isUrgent, hoursUntil });
        }
      });
    });
    return list;
  }, [leaveDates, activeTripsByDate, todayStr, nowMs]);

  const hasUrgentTrip = useMemo(() => {
    return affectedLeavePreviewTrips.some((t) => t.isUrgent);
  }, [affectedLeavePreviewTrips]);

  const toggleLeaveDate = (dateStr) => {
    if (!dateStr || dateStr < todayStr) {
      message.warning(
        "Không thể chọn ngày đã qua trong quá khứ. Vui lòng chọn từ hôm nay trở đi.",
      );
      return;
    }
    if (blockedLeaveDateSet.has(dateStr)) {
      message.info(
        "Ngày này đã nằm trong đơn báo nghỉ đang chờ duyệt hoặc đã duyệt.",
      );
      return;
    }
    setLeaveDates((prev) =>
      prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr].sort(),
    );
  };

  const handleAddCustomLeaveDate = () => {
    if (!customLeaveDate) return;
    if (customLeaveDate < todayStr) {
      message.warning(
        "Không thể chọn ngày đã qua trong quá khứ. Vui lòng chọn từ hôm nay trở đi.",
      );
      return;
    }
    if (!leaveDates.includes(customLeaveDate)) {
      toggleLeaveDate(customLeaveDate);
    }
    setCustomLeaveDate("");
  };

  const handleSubmitLeaveRequest = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      message.error(
        "Cần kết nối mạng để gửi đơn báo nghỉ đột xuất tới Quản lý.",
      );
      return;
    }
    if (leaveDates.length === 0) {
      message.warning(
        "Vui lòng chọn ít nhất 1 ngày muốn xin nghỉ (bao gồm hôm nay hoặc các ngày sắp tới).",
      );
      return;
    }
    if (!leaveReason.trim()) {
      message.warning("Vui lòng nhập lý do xin nghỉ đột xuất.");
      return;
    }
    setSubmittingLeave(true);
    try {
      const res = await driverApi.submitLeaveRequest({
        dates: leaveDates,
        reason: leaveReason.trim(),
      });
      message.success(
        res?.message ||
          "Đã gửi đơn báo nghỉ đột xuất tới Quản lý chờ phê duyệt.",
      );
      setLeaveModalOpen(false);
      setLeaveDates([]);
      setLeaveReason("");
      await fetchShifts();
    } catch (err) {
      message.error(err.message || "Không thể gửi đơn báo nghỉ đột xuất.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const isPastWeek = weekEndStr < todayStr;
  const isNextWeek = weekStartStr === nextMonday.format("YYYY-MM-DD");
  const isCurrentWeek = weekStartStr === currentMonday.format("YYYY-MM-DD");
  const isPastSundayDeadline =
    isNextWeek && now.day() === 0 && now.hour() >= 22;

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
      message.info(
        "Đang mất mạng: Yêu cầu đăng ký ca cả tuần đã lưu vào hàng đợi ngoại tuyến!",
      );
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
      message.success(
        `Đã gửi đăng ký ${shiftLabel} cho ${count} ngày trong tuần!`,
      );
      setNote("");
      await fetchShifts();
    } catch (err) {
      message.error(
        err.message || "Không thể đăng ký lịch tuần. Vui lòng thử lại.",
      );
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
        res?.message ||
          "Đã hủy đăng ký cả tuần. Bạn có thể chọn lại Ca Sáng hoặc Ca Đêm.",
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
        (a, b) =>
          new Date(a.planned_start || 0) - new Date(b.planned_start || 0),
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

    const totalTrips = list.reduce(
      (sum, item) => sum + item.dayTrips.length,
      0,
    );
    return { weekDaysList: list, weekTripsCount: totalTrips };
  }, [selectedMonday, shifts, driverTrips, todayStr]);

  return (
    <div className="w-full max-w-full min-w-0 px-3 py-4 pb-24 space-y-4 text-slate-100 overflow-x-hidden">
      {/* HEADER */}
      <div className="space-y-2.5 min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 leading-snug">
              <Calendar size={18} className="text-blue-400 shrink-0" />
              <span className="truncate">Ca làm việc</span>
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

        <button
          type="button"
          onClick={() => {
            setLeaveDates([]);
            setLeaveReason("");
            setCustomLeaveDate("");
            setLeaveModalOpen(true);
          }}
          className="w-full flex items-center justify-between gap-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-600/50 px-3 py-2.5 text-left transition cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-200 truncate">
                Báo nghỉ đột xuất
              </div>
              <div className="text-[10px] text-amber-300/80 truncate">
                Gửi Quản lý duyệt &amp; Điều phối viên đổi tài xế các chuyến
                trùng lịch
              </div>
            </div>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] font-bold">
            Tạo đơn
          </span>
        </button>
      </div>

      <ShiftRegistrationFormSection
        currentMonday={currentMonday}
        nextMonday={nextMonday}
        selectedMonday={selectedMonday}
        setSelectedMonday={setSelectedMonday}
        weekEnd={weekEnd}
        isCurrentWeek={isCurrentWeek}
        isNextWeek={isNextWeek}
        isPastWeek={isPastWeek}
        isPastSundayDeadline={isPastSundayDeadline}
        activeWeekShifts={activeWeekShifts}
        rejectedWeekShifts={rejectedWeekShifts}
        loading={loading}
        hasAutoAssigned={hasAutoAssigned}
        hasApproved={hasApproved}
        hasPendingRequested={hasPendingRequested}
        lockedShiftType={lockedShiftType}
        cancelling={cancelling}
        handleCancelWeek={handleCancelWeek}
        selectedShiftType={selectedShiftType}
        setSelectedShiftType={setSelectedShiftType}
        note={note}
        setNote={setNote}
        submitting={submitting}
        handleSubmitWeekShift={handleSubmitWeekShift}
      />

      <ShiftRegistrationCalendar
        selectedMonday={selectedMonday}
        weekEnd={weekEnd}
        activeWeekShifts={activeWeekShifts}
        weekTripsCount={weekTripsCount}
        weekDaysList={weekDaysList}
        leaveRequests={leaveRequests}
        onNavigateTrip={(tripId) => router.push(`/driver/trips?tripId=${tripId}`)}
      />

      <ShiftRegistrationModals
        leaveModalOpen={leaveModalOpen}
        setLeaveModalOpen={setLeaveModalOpen}
        leaveDates={leaveDates}
        upcomingLeaveChoices={upcomingLeaveChoices}
        toggleLeaveDate={toggleLeaveDate}
        todayStr={todayStr}
        customLeaveDate={customLeaveDate}
        setCustomLeaveDate={setCustomLeaveDate}
        handleAddCustomLeaveDate={handleAddCustomLeaveDate}
        affectedLeavePreviewTrips={affectedLeavePreviewTrips}
        hasUrgentTrip={hasUrgentTrip}
        leaveReason={leaveReason}
        setLeaveReason={setLeaveReason}
        submittingLeave={submittingLeave}
        handleSubmitLeaveRequest={handleSubmitLeaveRequest}
      />
    </div>
  );
}
