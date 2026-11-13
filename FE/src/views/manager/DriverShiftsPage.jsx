"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Form,
  DatePicker,
  TimePicker,
  Input,
  Button,
  Tag,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Empty,
  Tooltip,
  message
} from "antd";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  User,
  Trash2,
  Edit3,
  Eye,
  Check,
  X
} from "lucide-react";
import dayjs from "dayjs";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../providers/AuthProvider";

const getMondayOfWeek = (d = dayjs()) => {
  const dow = d.day();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return d.startOf("day").add(diffToMon, "day");
};

const detectShiftTypeManager = (sh) => {
  if (!sh) return 'MORNING';
  const noteStr = String(sh.note || '').toUpperCase();
  if (noteStr.includes('CA ĐÊM') || noteStr.includes('NIGHT')) return 'NIGHT';
  if (noteStr.includes('CA SÁNG') || noteStr.includes('MORNING')) return 'MORNING';
  const h = sh.start_time ? dayjs(sh.start_time).hour() : 8;
  return h >= 15 ? 'NIGHT' : 'MORNING';
};

const isAutoAssignedManager = (sh) => {
  if (!sh) return false;
  return (sh.note && sh.note.includes('[Hệ thống tự động xếp lịch]')) || sh.registered_by === null || sh.registered_by === undefined;
};

export default function DriverShiftsPage({ readOnly = false }) {
  const { user } = useAuth();
  const isReadOnly = readOnly || (Number(user?.role_id) !== 1 && Number(user?.role_id) !== 2);

  // State quản lý ngày tuần
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    return getMondayOfWeek(dayjs()); // Thứ Hai chuẩn bất kể locale
  });

  // Data states
  const [shifts, setShifts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveDecisionModal, setLeaveDecisionModal] = useState({
    open: false,
    request: null,
    decision: "APPROVED",
    comment: "",
  });
  const [submittingLeaveDecision, setSubmittingLeaveDecision] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchDriver, setSearchDriver] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal states
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null); // null = tạo mới, object = sửa
  const [shiftForm] = Form.useForm();
  const [submittingShift, setSubmittingShift] = useState(false);

  // Detail modal
  const [detailModal, setDetailModal] = useState({ open: false, shift: null });

  // Reject modal
  const [rejectModal, setRejectModal] = useState({ open: false, shiftId: null, shiftInfo: null, reason: "" });
  const [submittingReject, setSubmittingReject] = useState(false);

  const weekEnd = useMemo(() => currentWeekStart.add(6, "day"), [currentWeekStart]);

  // Tạo danh sách 7 ngày trong tuần
  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
    for (let i = 0; i < 7; i++) {
      const d = currentWeekStart.add(i, "day");
      days.push({
        dateStr: d.format("YYYY-MM-DD"),
        displayDate: d.format("DD/MM"),
        dayName: dayNames[i],
        dayMoment: d,
        isToday: d.isSame(dayjs(), "day")
      });
    }
    return days;
  }, [currentWeekStart]);

  // Tải danh sách ca và danh sách tài xế
  const [autoAssigning, setAutoAssigning] = useState(false);

  const handleAutoAssignNextWeek = async () => {
    setAutoAssigning(true);
    try {
      const res = await managerApi.autoAssignNextWeekShifts(true);
      const data = res?.data || res;
      if (data?.assignedDriversCount > 0) {
        message.success(
          `Đã tự động xếp lịch tuần tới (${data.nextMonday} - ${data.nextSunday}) cho ${data.assignedDriversCount} tài xế (Sáng: ${data.assignedMorning}, Đêm: ${data.assignedNight}).`,
          6
        );
      } else {
        message.info(data?.message || "Tất cả tài xế đang hoạt động đều đã có lịch cho tuần tới.");
      }
      await loadData();
    } catch (err) {
      console.error("handleAutoAssignNextWeek error:", err);
      message.error(err.message || "Không thể chạy xếp lịch tự động tuần tới.");
    } finally {
      setAutoAssigning(false);
    }
  };

  const [sendingReminders, setSendingReminders] = useState(false);
  const [weeklyBusyKey, setWeeklyBusyKey] = useState(null);

  const handleSendReminders21h = async () => {
    setSendingReminders(true);
    try {
      const res = await managerApi.sendShiftReminders(true);
      const data = res?.data || res;
      if (data?.sentCount > 0) {
        message.success(data.message || `Đã gửi nhắc nhở 21h cho ${data.sentCount} tài xế.`);
      } else {
        message.info(data?.message || 'Tất cả tài xế đều đã có lịch tuần tới hoặc đã được nhắc.');
      }
    } catch (err) {
      message.error(err.message || 'Không thể gửi thông báo nhắc đăng ký.');
    } finally {
      setSendingReminders(false);
    }
  };

  const handleApproveDriverWeek = async (driverId) => {
    setWeeklyBusyKey(`approve_${driverId}`);
    try {
      const res = await managerApi.approveDriverWeekShifts({
        driver_id: driverId,
        week_start: currentWeekStart.format('YYYY-MM-DD'),
      });
      message.success(res.message || 'Đã phê duyệt cả tuần cho tài xế.');
      await loadData();
    } catch (err) {
      message.error(err.message || 'Không thể phê duyệt cả tuần.');
    } finally {
      setWeeklyBusyKey(null);
    }
  };

  const pendingLeaveCount = useMemo(
    () => (leaveRequests || []).filter((lr) => lr.status === "PENDING").length,
    [leaveRequests]
  );

  const handleOpenLeaveDecision = (leaveReq, decision) => {
    setLeaveDecisionModal({
      open: true,
      request: leaveReq,
      decision,
      comment: decision === "APPROVED" ? "Đồng ý cho nghỉ đột xuất. Chuyển Điều phối đổi tài xế." : "",
    });
  };

  const handleConfirmLeaveDecision = async () => {
    if (!leaveDecisionModal.request) return;
    if (leaveDecisionModal.decision === "REJECTED" && !leaveDecisionModal.comment.trim()) {
      message.warning("Vui lòng nhập lý do từ chối đơn xin nghỉ.");
      return;
    }
    setSubmittingLeaveDecision(true);
    try {
      const res = await managerApi.decideLeaveRequest(leaveDecisionModal.request.id, {
        decision: leaveDecisionModal.decision,
        comment: leaveDecisionModal.comment.trim(),
      });
      message.success(res?.message || "Đã xử lý đơn báo nghỉ đột xuất.");
      setLeaveDecisionModal({ open: false, request: null, decision: "APPROVED", comment: "" });
      await loadData();
    } catch (err) {
      message.error(err.message || "Không thể xử lý đơn báo nghỉ đột xuất.");
    } finally {
      setSubmittingLeaveDecision(false);
    }
  };

  const handleSwitchDriverWeek = async (driverId, targetShiftType, autoApprove = false) => {
    setWeeklyBusyKey(`switch_${driverId}`);
    try {
      const res = await managerApi.switchDriverWeekShiftType({
        driver_id: driverId,
        week_start: currentWeekStart.format('YYYY-MM-DD'),
        shift_type: targetShiftType,
        auto_approve: autoApprove,
      });
      message.success(res.message || 'Đã điều chỉnh ca làm việc cả tuần.');
      await loadData();
    } catch (err) {
      message.error(err.message || 'Không thể điều chỉnh ca làm việc cả tuần.');
    } finally {
      setWeeklyBusyKey(null);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const fromStr = currentWeekStart.format("YYYY-MM-DD");
      const toStr = weekEnd.format("YYYY-MM-DD");

      const [shiftsRes, driversRes, leaveRes] = await Promise.all([
        managerApi.getShifts({ from: fromStr, to: toStr, status: statusFilter !== "ALL" ? statusFilter: undefined }),
        managerApi.getFleetDrivers ? managerApi.getFleetDrivers(): Promise.resolve([]),
        managerApi.getLeaveRequests ? managerApi.getLeaveRequests().catch(() => []) : Promise.resolve([])
      ]);

      setShifts(shiftsRes?.shifts || []);
      setDrivers(driversRes || []);
      setLeaveRequests(Array.isArray(leaveRes) ? leaveRes : []);
    } catch (err) {
      console.error("loadData error:", err);
      message.error(err.message || "Không thể tải dữ liệu ca làm việc");
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart, weekEnd, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lọc danh sách tài xế theo tìm kiếm
  const filteredDrivers = useMemo(() => {
    if (!searchDriver.trim()) return drivers;
    const q = searchDriver.toLowerCase().trim();
    return drivers.filter(
      (d) =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.phone && d.phone.includes(q)) ||
        (d.license_class && d.license_class.toLowerCase().includes(q))
    );
  }, [drivers, searchDriver]);

  // Danh sách các ca đang chờ duyệt
  const pendingShifts = useMemo(() => {
    return shifts.filter((s) => s.status === "Requested");
  }, [shifts]);

  // Thống kê tổng hợp tuần
  const stats = useMemo(() => {
    const totalScheduled = shifts.filter((s) => s.status === "Approved").length;
    const totalPending = pendingShifts.length;
    const overLimitShifts = shifts.filter((s) => s.duration_hours > 10);
    const activeDriverIds = new Set(shifts.filter((s) => s.status === "Approved").map((s) => s.driver_id));

    return {
      totalScheduled,
      totalPending,
      overLimitCount: overLimitShifts.length,
      activeDriversCount: activeDriverIds.size
    };
  }, [shifts, pendingShifts]);
  const weeklyOverview = useMemo(() => {
    const rows = [];
    let morningCount = 0;
    let nightCount = 0;
    let unscheduledCount = 0;

    filteredDrivers.forEach((drv) => {
      const drvShifts = shifts.filter((sh) => Number(sh.driver_id) === Number(drv.id) && sh.status !== 'Rejected');
      if (drvShifts.length === 0) {
        unscheduledCount++;
        return;
      }
      const shiftType = detectShiftTypeManager(drvShifts[0]);
      if (shiftType === 'NIGHT') nightCount++;
      else morningCount++;

      const isAuto = drvShifts.some((sh) => isAutoAssignedManager(sh));
      const hasPending = drvShifts.some((sh) => sh.status === 'Requested');
      const allApproved = drvShifts.every((sh) => sh.status === 'Approved');

      rows.push({
        driver: drv,
        shifts: drvShifts,
        daysCount: drvShifts.length,
        shiftType,
        isAuto,
        hasPending,
        allApproved,
      });
    });

    return { rows, morningCount, nightCount, unscheduledCount };
  }, [filteredDrivers, shifts]);

  // Điều hướng tuần
  const handlePrevWeek = () => setCurrentWeekStart((prev) => prev.subtract(1, "week"));
  const handleNextWeek = () => setCurrentWeekStart((prev) => prev.add(1, "week"));
  const handleTodayWeek = () => setCurrentWeekStart(getMondayOfWeek(dayjs()));

  // Mở modal tạo ca mới (pre-fill tài xế và ngày nếu có)
  const handleOpenCreateShift = (driverId = null, dateMoment = null) => {
    if (isReadOnly) return;
    setEditingShift(null);
    shiftForm.resetFields();
    const defaultDate = dateMoment || currentWeekStart;
    shiftForm.setFieldsValue({
      driver_id: driverId || (drivers.length > 0 ? drivers[0].id: undefined),
      date: defaultDate,
      time_range: [defaultDate.hour(8).minute(0), defaultDate.hour(17).minute(0)],
      note: ""
    });
    setIsShiftModalOpen(true);
  };

  // Mở modal sửa ca
  const handleOpenEditShift = (shift) => {
    if (isReadOnly) return;
    setEditingShift(shift);
    shiftForm.resetFields();
    const shiftDate = dayjs(shift.date);
    shiftForm.setFieldsValue({
      driver_id: shift.driver_id,
      date: shiftDate,
      time_range: [dayjs(shift.start_time), dayjs(shift.end_time)],
      note: shift.note || ""
    });
    setDetailModal({ open: false, shift: null });
    setIsShiftModalOpen(true);
  };

  // Chọn template ca nhanh
  const handleApplyShiftTemplate = (startH, startM, endH, endM) => {
    const curDate = shiftForm.getFieldValue("date") || currentWeekStart;
    shiftForm.setFieldsValue({
      time_range: [
        curDate.hour(startH).minute(startM).second(0),
        curDate.add(endH <= startH ? 1 : 0, "day").hour(endH).minute(endM).second(0)
      ]
    });
  };

  // Lưu ca làm việc (Tạo mới hoặc Cập nhật)
  const handleSaveShift = async (values) => {
    if (isReadOnly) {
      message.error("Tài khoản chỉ có quyền xem, không thể tạo hoặc chỉnh sửa ca làm việc.");
      return;
    }
    try {
      setSubmittingShift(true);
      const dateStr = values.date.format("YYYY-MM-DD");
      const startTimeStr = values.time_range[0].format("HH:mm:ss");
      const endTimeStr = values.time_range[1].format("HH:mm:ss");
      const endDateStr = endTimeStr <= startTimeStr ? values.date.add(1, "day").format("YYYY-MM-DD") : dateStr;

      const payload = {
        driver_id: values.driver_id,
        date: dateStr,
        start_time: `${dateStr}T${startTimeStr}+07:00`,
        end_time: `${endDateStr}T${endTimeStr}+07:00`,
        note: values.note ? values.note.trim(): null
      };

      if (editingShift) {
        // Cập nhật ca
        const res = await managerApi.updateShift(editingShift.id, payload);
        message.success(res.message || "Cập nhật ca làm việc thành công.");
        if (res.warning) message.warning(res.warning, 6);
      } else {
        // Tạo ca mới
        const res = await managerApi.createShift(payload);
        message.success(res.message || "Xếp ca làm việc cho tài xế thành công.");
        if (res.warning) message.warning(res.warning, 6);
      }

      setIsShiftModalOpen(false);
      shiftForm.resetFields();
      loadData();
    } catch (err) {
      console.error("handleSaveShift error:", err);
      message.error(err.message || "Không thể lưu ca làm việc");
    } finally {
      setSubmittingShift(false);
    }
  };

  // Duyệt ca
  const handleApproveShift = async (shift) => {
    try {
      const res = await managerApi.approveShift(shift.id);
      message.success(res.message || "Đã phê duyệt ca làm việc thành công.");
      if (res.warning) message.warning(res.warning, 6);
      setDetailModal({ open: false, shift: null });
      loadData();
    } catch (err) {
      message.error(err.message || "Không thể phê duyệt ca làm việc");
    }
  };

  // Mở modal từ chối ca
  const handleOpenRejectModal = (shift) => {
    setRejectModal({
      open: true,
      shiftId: shift.id,
      shiftInfo: shift,
      reason: ""
    });
  };

  // Xác nhận từ chối ca
  const handleConfirmReject = async () => {
    if (!rejectModal.reason || rejectModal.reason.trim().length < 3) {
      message.warning("Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).");
      return;
    }
    try {
      setSubmittingReject(true);
      const res = await managerApi.rejectShift(rejectModal.shiftId, rejectModal.reason.trim());
      message.success(res.message || "Đã từ chối ca làm việc thành công.");
      setRejectModal({ open: false, shiftId: null, shiftInfo: null, reason: "" });
      setDetailModal({ open: false, shift: null });
      loadData();
    } catch (err) {
      message.error(err.message || "Không thể từ chối ca làm việc");
    } finally {
      setSubmittingReject(false);
    }
  };

  // Xóa ca
  const handleDeleteShift = async (shiftId) => {
    try {
      await managerApi.deleteShift(shiftId);
      message.success("Đã xóa ca làm việc thành công.");
      setDetailModal({ open: false, shift: null });
      loadData();
    } catch (err) {
      message.error(err.message || "Không thể xóa ca làm việc");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. HEADER & THỐNG KÊ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-3xl shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              <CalendarIcon size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-primary tracking-tight">
                Lịch Phân Ca & Phê Duyệt Ca Trực
              </h1>
              <p className="text-xs text-on-surface-variant">
                Quản lý xếp lịch làm việc tài xế theo tuần, phê duyệt ca đăng ký và kiểm soát giới hạn giờ lái
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {!isReadOnly && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => handleOpenCreateShift()}
              className="bg-primary hover:bg-primary/90 font-bold rounded-xl h-10 shadow-sm"
            >
              Xếp ca mới
            </Button>
          )}
          <Button
            icon={<RotateCcw size={15} />}
            onClick={loadData}
            loading={loading}
            className="rounded-xl h-10 font-medium"
          >
            Làm mới
          </Button>
          {!isReadOnly && (
            <>
              <Button
                onClick={handleAutoAssignNextWeek}
                loading={autoAssigning}
                className="rounded-xl h-10 font-semibold border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100"
              >
                Tự động xếp lịch tuần tới
              </Button>
              <Button
                onClick={handleSendReminders21h}
                loading={sendingReminders}
                className="rounded-xl h-10 font-semibold border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
              >
                Gửi nhắc 21h
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-2xs">
          <div className="text-xs font-semibold text-on-surface-variant">Ca đã phân công</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.totalScheduled}</div>
          <div className="text-[11px] text-on-surface-variant/80 mt-0.5">Ca đã duyệt tuần này</div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-2xs">
          <div className="text-xs font-semibold text-on-surface-variant">Ca chờ phê duyệt</div>
          <div className="text-2xl font-black text-amber-500 mt-1 flex items-center gap-1.5">
            {stats.totalPending}
            {stats.totalPending > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block" />
            )}
          </div>
          <div className="text-[11px] text-on-surface-variant/80 mt-0.5">Yêu cầu từ tài xế</div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-2xs">
          <div className="text-xs font-semibold text-on-surface-variant">Tài xế trực tuần</div>
          <div className="text-2xl font-black text-primary mt-1">{stats.activeDriversCount}</div>
          <div className="text-[11px] text-on-surface-variant/80 mt-0.5">Đã có ca phân công</div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-2xs">
          <div className="text-xs font-semibold text-on-surface-variant">Cảnh báo giờ lái</div>
          <div className={`text-2xl font-black mt-1 ${stats.overLimitCount > 0 ? "text-error": "text-on-surface"}`}>
            {stats.overLimitCount}
          </div>
          <div className="text-[11px] text-on-surface-variant/80 mt-0.5">&gt; 10 giờ/ngày theo luật</div>
        </div>
      </div>

      {/* 3. TOOLBAR ĐIỀU HƯỚNG TUẦN & TÌM KIẾM */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Bộ chọn tuần */}
        <div className="flex items-center gap-2">
          <Button
            icon={<ChevronLeft size={16} />}
            onClick={handlePrevWeek}
            className="rounded-xl h-9 w-9 flex items-center justify-center"
            title="Tuần trước"
          />
          <div className="px-3.5 py-1.5 rounded-xl bg-surface-container-low border border-surface-container font-mono text-xs font-bold text-primary">
            Tuần {weekDays[0].displayDate} – {weekDays[6].displayDate}/{currentWeekStart.format("YYYY")}
          </div>
          <Button
            icon={<ChevronRight size={16} />}
            onClick={handleNextWeek}
            className="rounded-xl h-9 w-9 flex items-center justify-center"
            title="Tuần sau"
          />
          <Button
            size="small"
            onClick={handleTodayWeek}
            className="rounded-lg text-xs font-bold text-primary ml-1"
          >
            Tuần này
          </Button>
          <DatePicker
            picker="week"
            value={currentWeekStart}
            onChange={(d) => {
              if (d) setCurrentWeekStart(getMondayOfWeek(d));
            }}
            className="w-36 rounded-xl text-xs"
            placeholder="Chọn tuần"
            format="[Tuần] w - YYYY"
          />
        </div>

        {/* Tìm kiếm & Bộ lọc trạng thái */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Tìm tài xế, SĐT, bằng lái..."
            prefix={<Search size={14} className="text-on-surface-variant" />}
            value={searchDriver}
            onChange={(e) => setSearchDriver(e.target.value)}
            className="rounded-xl w-52 text-xs"
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-36 text-xs"
            options={[
              { value: "ALL", label: "Tất cả trạng thái" },
              { value: "Approved", label: "Đã phê duyệt" },
              { value: "Requested", label: "Chờ phê duyệt" },
              { value: "Rejected", label: "Đã từ chối" }
            ]}
          />
        </div>
      </div>

      {/* 4. BẢNG 1: MA TRẬN LỊCH PHÂN CA TUẦN */}
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5 border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-primary">
              Ma trận ca trực tuần (Tài xế × 7 ngày)
            </h2>
            <span className="text-xs text-on-surface-variant">
              ({filteredDrivers.length} tài xế)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Đã duyệt
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> ⏳ Chờ duyệt
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" /> ⚠️ &gt;10h
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Spin size="large" />
          </div>
        ): filteredDrivers.length === 0 ? (
          <div className="py-12 text-center">
            <Empty description="Không có tài xế nào phù hợp" />
          </div>
        ): (
          <div className="overflow-x-auto rounded-2xl border border-surface-container">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[11px] font-black tracking-wider border-b border-surface-container">
                  <th className="py-3 px-3 min-w-[170px] sticky left-0 bg-surface-container-low z-10 shadow-xs">
                    Tài xế
                  </th>
                  {weekDays.map((d) => (
                    <th
                      key={d.dateStr}
                      className={`py-3 px-2 text-center text-xs font-extrabold min-w-[130px] border-l border-surface-container/60 ${
                        d.isToday ? "bg-primary/10 text-primary": ""
                      }`}
                    >
                      <div>{d.dayName}</div>
                      <div className="text-[11px] font-mono text-on-surface-variant">{d.displayDate}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {filteredDrivers.map((drv) => {
                  const driverShifts = shifts.filter((s) => Number(s.driver_id) === Number(drv.id));

                  return (
                    <tr key={drv.id} className="hover:bg-surface-container-low/30 transition-colors">
                      {/* Cột thông tin tài xế (Sticky) */}
                      <td className="py-3 px-3 font-bold text-primary sticky left-0 bg-surface-container-lowest z-10 shadow-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                            {drv.name ? drv.name.charAt(0): "T"}
                          </div>
                          <div className="overflow-hidden">
                            <div className="truncate text-xs font-extrabold">{drv.name}</div>
                            <div className="text-[10px] text-on-surface-variant font-mono flex items-center gap-1">
                              <span>Hạng {drv.license_class}</span>
                              {drv.phone && <span>· {drv.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 7 Cột các ngày trong tuần */}
                      {weekDays.map((d) => {
                        const dayShifts = driverShifts.filter((s) => s.date === d.dateStr);
                        const totalHoursOnDay = dayShifts
                          .filter((s) => s.status === "Approved")
                          .reduce((sum, s) => sum + (s.duration_hours || 0), 0);
                        const isDayOverLimit = totalHoursOnDay > 10;

                        return (
                          <td
                            key={d.dateStr}
                            className={`py-2 px-2 align-top border-l border-surface-container/60 transition-colors ${
                              d.isToday ? "bg-primary/5": ""
                            }`}
                          >
                            <div className="min-h-[64px] flex flex-col justify-between gap-1">
                              {/* Danh sách các ca trực trong ngày */}
                              <div className="space-y-1.5">
                                {dayShifts.map((sh) => {
                                  const isPending = sh.status === "Requested";
                                  const isRejected = sh.status === "Rejected";
                                  const isShiftOver = sh.duration_hours > 10;

                                  return (
                                    <div
                                      key={sh.id}
                                      onClick={() => setDetailModal({ open: true, shift: sh })}
                                      className={`p-1.5 rounded-xl border text-[11px] font-mono cursor-pointer transition-all hover:scale-[1.02] shadow-2xs ${
                                        isRejected
                                          ? "bg-slate-100 border-slate-300 text-slate-400 line-through"
                                          : isPending
                                          ? "bg-amber-50 border-amber-300 text-amber-900"
                                          : isShiftOver || isDayOverLimit
                                          ? "bg-amber-100 border-amber-400 text-amber-950 font-bold"
                                          : "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium"
                                      }`}
                                      title="Bấm để xem chi tiết hoặc thao tác"
                                    >
                                      <div className="flex items-center justify-between gap-1 leading-tight">
                                        <span className="truncate">
                                          {isPending ? "⏳ ": ""}
                                          {dayjs(sh.start_time).format("HH:mm")}–{dayjs(sh.end_time).format("HH:mm")}
                                        </span>
                                        <span className="text-[10px] opacity-80">
                                          {sh.duration_hours}h
                                        </span>
                                      </div>

                                      {isShiftOver && (
                                        <div className="text-[9px] text-amber-800 font-sans mt-0.5 flex items-center gap-0.5">
                                          <AlertTriangle size={10} /> &gt;10h
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Nút bấm thêm ca nhanh */}
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCreateShift(drv.id, d.dayMoment)}
                                  className="w-full py-1 text-center text-on-surface-variant/40 hover:text-primary hover:bg-surface-container rounded-lg transition-all text-xs cursor-pointer border border-dashed border-transparent hover:border-primary/40 mt-1"
                                  title={`Xếp thêm ca cho ${drv.name} ngày ${d.displayDate}`}
                                >
                                  + Thêm ca
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Chú thích chân trang chuẩn  */}
        <div className="pt-2 text-xs text-on-surface-variant border-t border-surface-container/60">
          <div>
            {isReadOnly ? (
              <span>💡 <strong>Hướng dẫn:</strong> Bạn đang ở chế độ xem chéo (Chỉ xem). Bấm vào ca đã có để xem chi tiết lịch trực của tài xế.</span>
            ) : (
              <span>💡 <strong>Hướng dẫn:</strong> Bấm vào một ô hoặc nút <strong>&ldquo;+ Thêm ca&rdquo;</strong> để xếp ca trực mới (ca do Quản lý tạo tự động có hiệu lực). Bấm vào ca đã có để xem chi tiết, chỉnh sửa hoặc xóa ca.</span>
            )}
          </div>
        </div>
      </div>

      {/* 4A. ĐƠN BÁO NGHỈ ĐỘT XUẤT TỪ TÀI XẾ */}
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5 border border-outline-variant/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              Đơn báo nghỉ đột xuất từ Tài xế
              {pendingLeaveCount > 0 && (
                <Tag color="warning" className="ml-1 font-bold rounded-full">
                  {pendingLeaveCount} đơn chờ duyệt
                </Tag>
              )}
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Khi duyệt cho nghỉ, ca trực ngày đó tự động hủy và các chuyến xe bị ảnh hưởng sẽ chuyển sang Điều phối viên đổi tài xế (Re-assign).
            </p>
          </div>
        </div>

        {leaveRequests.length === 0 ? (
          <div className="py-5 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-2xl">
            Chưa có đơn báo nghỉ đột xuất nào.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-surface-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[11px] font-bold border-b border-surface-container">
                  <th className="py-3 px-3">Tài xế</th>
                  <th className="py-3 px-3">Ngày xin nghỉ</th>
                  <th className="py-3 px-3">Lý do</th>
                  <th className="py-3 px-3">Chuyến xe bị ảnh hưởng (Re-assign)</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {leaveRequests.map((lr) => (
                  <tr key={lr.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-primary">{lr.driver_name}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        {lr.license_class ? `Hạng ${lr.license_class}` : ""} {lr.driver_phone ? `· ${lr.driver_phone}` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(lr.leave_dates || []).map((dStr) => (
                          <Tag key={dStr} color="blue" className="font-mono font-semibold !m-0">
                            {dayjs(dStr).format("DD/MM/YYYY")}
                          </Tag>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-[220px]">
                      <div className="text-on-surface line-clamp-2">{lr.reason}</div>
                      {lr.manager_comment && (
                        <div className="text-[10px] text-on-surface-variant italic mt-0.5">
                          Ghi chú: {lr.manager_comment}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {(lr.affected_trips || []).length === 0 ? (
                        <span className="text-on-surface-variant/60 italic">Không có chuyến</span>
                      ) : (
                        <div className="space-y-1">
                          {lr.affected_trips.map((tr) => (
                            <div key={tr.trip_id} className="flex items-center gap-1.5 flex-wrap">
                              <Tag color={tr.reassigned ? "green" : "orange"} className="font-mono font-bold !m-0">
                                {tr.trip_code}
                              </Tag>
                              <span className="text-[10px] font-mono text-on-surface-variant">
                                {tr.planned_start ? dayjs(tr.planned_start).format("DD/MM HH:mm") : ""}
                              </span>
                              {lr.status === "APPROVED" && (
                                <span className={`text-[10px] font-semibold ${tr.reassigned ? "text-emerald-700" : "text-orange-600"}`}>
                                  {tr.reassigned ? `✓ Đã đổi (${tr.reassigned_to_driver_name})` : "• Chờ Dispatcher"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {lr.status === "PENDING" ? (
                        <Tag color="warning" className="font-bold">Chờ duyệt</Tag>
                      ) : lr.status === "APPROVED" ? (
                        <Tag color="success" className="font-bold">Đã duyệt</Tag>
                      ) : (
                        <Tag color="error" className="font-bold">Từ chối</Tag>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isReadOnly ? (
                        <Tag color="blue" className="font-semibold text-xs m-0">Chỉ xem</Tag>
                      ) : lr.status === "PENDING" ? (
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="primary"
                            size="small"
                            icon={<Check size={13} />}
                            onClick={() => handleOpenLeaveDecision(lr, "APPROVED")}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg text-xs"
                          >
                            Duyệt nghỉ
                          </Button>
                          <Button
                            danger
                            size="small"
                            icon={<X size={13} />}
                            onClick={() => handleOpenLeaveDecision(lr, "REJECTED")}
                            className="font-bold rounded-lg text-xs"
                          >
                            Từ chối
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant">
                          {lr.reviewed_by_name || "Quản lý"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4B. CÂN ĐỐI CA TUẦN & DUYỆT NHANH THEO TUẦN (BAO GỒM CA HỆ THỐNG TỰ XẾP) */}
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5 border border-outline-variant/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              Tổng hợp ca tuần &amp; Cân đối Sáng / Đêm
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Quản lý duyệt trọn tuần (kể cả ca hệ thống tự động xếp lúc 22h) hoặc đổi nhanh Ca Sáng ↔ Ca Đêm nếu phân bổ bị lệch
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800">
              Ca Sáng (08:00–17:00): {weeklyOverview.morningCount} tài xế
            </span>
            <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-300 text-indigo-800">
              Ca Đêm (17:00–08:00): {weeklyOverview.nightCount} tài xế
            </span>
            {weeklyOverview.unscheduledCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-600">
                Chưa xếp: {weeklyOverview.unscheduledCount}
              </span>
            )}
          </div>
        </div>

        {weeklyOverview.rows.length === 0 ? (
          <div className="py-6 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-2xl">
            Chưa có tài xế nào đăng ký hoặc được xếp ca trong tuần này.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-surface-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[11px] font-bold border-b border-surface-container">
                  <th className="py-3 px-3">Tài xế</th>
                  <th className="py-3 px-3">Nguồn lịch</th>
                  <th className="py-3 px-3">Ca cố định tuần</th>
                  <th className="py-3 px-3">Số ngày</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Điều chỉnh &amp; Duyệt cả tuần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {weeklyOverview.rows.map((row) => {
                  const drv = row.driver;
                  const targetSwitchType = row.shiftType === 'NIGHT' ? 'MORNING' : 'NIGHT';
                  const targetSwitchLabel = targetSwitchType === 'NIGHT' ? 'Đổi sang Ca Đêm' : 'Đổi sang Ca Sáng';
                  const isSwitching = weeklyBusyKey === `switch_${drv.id}`;
                  const isApproving = weeklyBusyKey === `approve_${drv.id}`;
                  return (
                    <tr key={drv.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-primary">
                        <div>{drv.name}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono">
                          Hạng {drv.license_class || 'C'} {drv.phone ? `· ${drv.phone}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {row.isAuto ? (
                          <Tag color="gold" className="font-semibold rounded-full">Hệ thống tự động xếp</Tag>
                        ) : (
                          <Tag color="blue" className="font-semibold rounded-full">Tài xế / Quản lý</Tag>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        {row.shiftType === 'NIGHT' ? 'Ca Đêm (17:00 – 08:00)' : 'Ca Sáng (08:00 – 17:00)'}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold">{row.daysCount}/7 ngày</td>
                      <td className="py-3 px-3">
                        {row.hasPending ? (
                          <Tag color="warning" className="font-bold">Chờ duyệt ⏳</Tag>
                        ) : row.allApproved ? (
                          <Tag color="success" className="font-bold">Đã duyệt</Tag>
                        ) : (
                          <Tag>Hỗn hợp</Tag>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isReadOnly ? (
                          <Tag color="blue" className="font-semibold text-xs m-0">Chỉ xem</Tag>
                        ) : (
                          <div className="inline-flex items-center flex-wrap justify-end gap-2">
                            <Button
                              size="small"
                              loading={isSwitching}
                              onClick={() => handleSwitchDriverWeek(drv.id, targetSwitchType, false)}
                              className="rounded-lg font-semibold h-8 border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                            >
                              {targetSwitchLabel}
                            </Button>
                            {row.hasPending && (
                              <Button
                                type="primary"
                                size="small"
                                icon={<Check size={14} />}
                                loading={isApproving}
                                onClick={() => handleApproveDriverWeek(drv.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg h-8"
                              >
                                Duyệt cả tuần
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. BẢNG 2: DANH SÁCH CA CHỜ PHÊ DUYỆT */}
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5 border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              Ca làm việc chờ duyệt
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 text-xs font-black">
              {pendingShifts.length}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant hidden sm:block">
            Các ca trực do tài xế chủ động gửi đăng ký qua ứng dụng Driver PWA
          </p>
        </div>

        {pendingShifts.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-2xl">
            Không có ca làm việc nào đang chờ duyệt trong tuần này.
          </div>
        ): (
          <div className="overflow-x-auto rounded-2xl border border-surface-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[11px] font-bold border-b border-surface-container">
                  <th className="py-3 px-3">Tài xế</th>
                  <th className="py-3 px-3">Ngày làm việc</th>
                  <th className="py-3 px-3">Khung giờ</th>
                  <th className="py-3 px-3">Thời lượng</th>
                  <th className="py-3 px-3">Thời điểm gửi</th>
                  <th className="py-3 px-3">Ghi chú của tài xế</th>
                  <th className="py-3 px-3 text-right">Thao tác phê duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {pendingShifts.map((sh) => (
                  <tr key={sh.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-primary">
                      <div>{sh.driver_name}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        Hạng {sh.license_class || "C"} {sh.driver_phone ? `· ${sh.driver_phone}`: ""}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      {sh.date ? dayjs(sh.date).format("dddd, DD/MM/YYYY"): "N/A"}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-primary">
                      {dayjs(sh.start_time).format("HH:mm")} – {dayjs(sh.end_time).format("HH:mm")}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold ${
                        sh.duration_hours > 10 ? "bg-amber-100 text-amber-900 border border-amber-300": "bg-slate-100 text-slate-700"
                      }`}>
                        {sh.duration_hours} giờ
                      </span>
                    </td>
                    <td className="py-3 px-3 text-on-surface-variant font-mono text-[11px]">
                      {sh.created_at ? dayjs(sh.created_at).format("DD/MM/YYYY HH:mm"): "N/A"}
                    </td>
                    <td className="py-3 px-3 text-on-surface-variant max-w-[200px] truncate">
                      {sh.note || <span className="text-on-surface-variant/40 italic">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isReadOnly ? (
                        <Tag color="blue" className="font-semibold text-xs m-0">Chỉ xem</Tag>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <Button
                            type="primary"
                            size="small"
                            icon={<Check size={14} />}
                            onClick={() => handleApproveShift(sh)}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg h-8 shadow-2xs"
                          >
                            Duyệt
                          </Button>
                          <Button
                            danger
                            size="small"
                            icon={<X size={14} />}
                            onClick={() => handleOpenRejectModal(sh)}
                            className="font-bold rounded-lg h-8"
                          >
                            Từ chối
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL XỬ LÝ ĐƠN BÁO NGHỈ ĐỘT XUẤT */}
      <Modal
        centered
        open={leaveDecisionModal.open}
        onCancel={() => setLeaveDecisionModal({ open: false, request: null, decision: "APPROVED", comment: "" })}
        onOk={handleConfirmLeaveDecision}
        confirmLoading={submittingLeaveDecision}
        okText={leaveDecisionModal.decision === "APPROVED" ? "Xác nhận duyệt cho nghỉ" : "Xác nhận từ chối"}
        okButtonProps={{
          danger: leaveDecisionModal.decision === "REJECTED",
          className: leaveDecisionModal.decision === "APPROVED" ? "bg-emerald-600 font-bold" : "font-bold",
        }}
        cancelText="Quay lại"
        title={
          <span className="font-bold text-sm">
            {leaveDecisionModal.decision === "APPROVED"
              ? "Duyệt đơn báo nghỉ đột xuất"
              : "Từ chối đơn báo nghỉ đột xuất"}
          </span>
        }
      >
        {leaveDecisionModal.request && (
          <div className="space-y-3 text-xs pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div>
                <span className="text-slate-500">Tài xế:</span>{" "}
                <strong className="text-slate-800">{leaveDecisionModal.request.driver_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Ngày nghỉ:</span>{" "}
                <strong className="font-mono text-slate-800">
                  {(leaveDecisionModal.request.leave_dates || [])
                    .map((d) => dayjs(d).format("DD/MM/YYYY"))
                    .join(", ")}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Lý do tài xế gửi:</span>{" "}
                <span className="text-slate-700">{leaveDecisionModal.request.reason}</span>
              </div>
              {(leaveDecisionModal.request.affected_trips || []).length > 0 && (
                <div className="pt-1 text-amber-700 font-semibold">
                  ⚠️ Có {leaveDecisionModal.request.affected_trips.length} chuyến xe bị ảnh hưởng (
                  {leaveDecisionModal.request.affected_trips.map((t) => t.trip_code).join(", ")}) sẽ tự động chuyển cho Điều phối viên đổi tài xế khác!
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-xs mb-1">
                {leaveDecisionModal.decision === "APPROVED"
                  ? "Ghi chú phản hồi (tùy chọn):"
                  : "Lý do từ chối (*):"}
              </label>
              <Input.TextArea
                rows={3}
                value={leaveDecisionModal.comment}
                onChange={(e) => setLeaveDecisionModal((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder={
                  leaveDecisionModal.decision === "APPROVED"
                    ? "Nhập ghi chú gửi tài xế & điều phối viên..."
                    : "Nhập lý do từ chối để tài xế nắm rõ..."
                }
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 1: XẾP CA MỚI / CHỈNH SỬA CA LÀM VIỆC */}
      {/* ========================================================= */}
      <Modal
        forceRender
        title={
          <div className="flex items-center gap-2 text-primary font-black text-base">
            <CalendarIcon size={20} className="text-primary" />
            <span>{editingShift ? "Chỉnh sửa ca làm việc": "Xếp ca làm việc mới cho tài xế"}</span>
          </div>
        }
        open={!isReadOnly && isShiftModalOpen}
        onCancel={() => setIsShiftModalOpen(false)}
        footer={null}
        destroyOnHidden
        className="rounded-3xl"
      >
        <Form
          form={shiftForm}
          layout="vertical"
          onFinish={handleSaveShift}
          className="mt-4 space-y-3"
        >
          <Form.Item
            name="driver_id"
            label={<span className="font-bold text-xs">Tài xế nhận ca (*)</span>}
            rules={[{ required: true, message: "Vui lòng chọn tài xế" }]}
          >
            <Select
              placeholder="Chọn tài xế"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={drivers.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.license_class || "C"}) - ${d.phone || ""}`
              }))}
              className="w-full rounded-xl"
            />
          </Form.Item>

          <Form.Item
            name="date"
            label={<span className="font-bold text-xs">Ngày làm việc (*)</span>}
            rules={[{ required: true, message: "Vui lòng chọn ngày" }]}
          >
            <DatePicker className="w-full py-1.5 rounded-xl" format="DD/MM/YYYY" />
          </Form.Item>

          {/* Khung giờ & Templates */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-xs">Khung giờ ca trực (*)</span>
              <span className="text-[11px] text-on-surface-variant font-medium">Mẫu ca nhanh:</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={() => handleApplyShiftTemplate(6, 0, 14, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Sáng (06:00 - 14:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyShiftTemplate(14, 0, 22, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Chiều (14:00 - 22:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyShiftTemplate(8, 0, 17, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Hành chính (08:00 - 17:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyShiftTemplate(17, 0, 8, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Ca Đêm (17:00 - 08:00)
              </button>
            </div>

            <Form.Item
              name="time_range"
              noStyle
              rules={[{ required: true, message: "Vui lòng chọn giờ bắt đầu và kết thúc" }]}
            >
              <TimePicker.RangePicker
                order={false}
                format="HH:mm"
                minuteStep={15}
                className="w-full py-1.5 rounded-xl font-mono"
                placeholder={["Giờ bắt đầu", "Giờ kết thúc"]}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="note"
            label={<span className="font-bold text-xs">Ghi chú ca trực</span>}
          >
            <Input.TextArea
              rows={2}
              maxLength={200}
              placeholder="Ghi chú phân công tuyến hoặc lưu ý an toàn..."
              className="rounded-xl"
            />
          </Form.Item>

          {/* Cảnh báo */}
          <div className="p-3 bg-amber-500/10 border border-amber-300 rounded-xl text-amber-900 text-xs">
            ⚠️ <strong>Quy chuẩn an toàn:</strong> Ca trực do Quản lý tạo sẽ tự động được phê duyệt (`Approved`). Hệ thống sẽ tự động chặn việc tạo 2 ca chồng lấn thời gian của cùng một tài xế. Ca dài quá 10 giờ sẽ kích hoạt cảnh báo an toàn.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container">
            <Button onClick={() => setIsShiftModalOpen(false)} className="rounded-xl">
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submittingShift}
              className="bg-primary hover:bg-primary/90 font-bold rounded-xl"
            >
              {editingShift ? "Lưu thay đổi": "Lưu ca làm việc"}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: CHI TIẾT & THAO TÁC CA LÀM VIỆC */}
      {/* ========================================================= */}
      <Modal
        forceRender
        title={
          <div className="flex items-center gap-2 text-primary font-black text-base">
            <Clock size={20} className="text-primary" />
            <span>Chi tiết ca làm việc #{detailModal.shift?.id}</span>
          </div>
        }
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, shift: null })}
        footer={null}
        className="rounded-3xl"
      >
        {detailModal.shift && (
          <div className="space-y-4 text-xs mt-3">
            <div className="p-4 bg-surface-container-low rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Tài xế:</span>
                <span className="font-black text-primary text-sm">
                  {detailModal.shift.driver_name} (Hạng {detailModal.shift.license_class})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Ngày làm việc:</span>
                <span className="font-mono font-bold">
                  {dayjs(detailModal.shift.date).format("dddd, DD/MM/YYYY")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Khung giờ ca:</span>
                <span className="font-mono font-black text-primary text-sm">
                  {dayjs(detailModal.shift.start_time).format("HH:mm")} – {dayjs(detailModal.shift.end_time).format("HH:mm")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Thời lượng:</span>
                <span className="font-mono font-bold">
                  {detailModal.shift.duration_hours} giờ
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Trạng thái:</span>
                <div>
                  {detailModal.shift.status === "Approved" && (
                    <Tag color="success" className="font-bold">Đã phê duyệt</Tag>
                  )}
                  {detailModal.shift.status === "Requested" && (
                    <Tag color="warning" className="font-bold">Chờ duyệt ⏳</Tag>
                  )}
                  {detailModal.shift.status === "Rejected" && (
                    <Tag color="error" className="font-bold">Đã từ chối</Tag>
                  )}
                </div>
              </div>

              {detailModal.shift.note && (
                <div className="pt-2 border-t border-surface-container/60">
                  <span className="text-on-surface-variant block mb-1">Ghi chú:</span>
                  <div className="italic text-on-surface bg-surface-container-lowest p-2 rounded-lg">
                    &ldquo;{detailModal.shift.note}&rdquo;
                  </div>
                </div>
              )}

              {detailModal.shift.rejection_reason && (
                <div className="pt-2 border-t border-surface-container/60">
                  <span className="text-error block mb-1 font-bold">Lý do từ chối:</span>
                  <div className="italic text-error bg-error/10 p-2 rounded-lg">
                    &ldquo;{detailModal.shift.rejection_reason}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Các hành động thao tác */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-surface-container">
              {!isReadOnly && detailModal.shift.status === "Requested" && (
                <>
                  <Button
                    type="primary"
                    icon={<Check size={14} />}
                    onClick={() => handleApproveShift(detailModal.shift)}
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl"
                  >
                    Duyệt ca
                  </Button>
                  <Button
                    danger
                    icon={<X size={14} />}
                    onClick={() => handleOpenRejectModal(detailModal.shift)}
                    className="font-bold rounded-xl"
                  >
                    Từ chối
                  </Button>
                </>
              )}

              {!isReadOnly && (
                <>
                  <Button
                    icon={<Edit3 size={14} />}
                    onClick={() => handleOpenEditShift(detailModal.shift)}
                    className="font-medium rounded-xl"
                  >
                    Chỉnh sửa
                  </Button>

                  <Popconfirm
                    title="Xóa ca làm việc này?"
                    description="Bạn có chắc chắn muốn xóa ca làm việc này không?"
                    onConfirm={() => handleDeleteShift(detailModal.shift.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<Trash2 size={14} />} className="rounded-xl">
                      Xóa ca
                    </Button>
                  </Popconfirm>
                </>
              )}

              <Button onClick={() => setDetailModal({ open: false, shift: null })} className="rounded-xl">
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: TỪ CHỐI CA LÀM VIỆC */}
      {/* ========================================================= */}
      <Modal
        forceRender
        title={<span className="font-black text-error text-base">Từ chối ca làm việc</span>}
        open={rejectModal.open}
        onCancel={() => setRejectModal({ open: false, shiftId: null, shiftInfo: null, reason: "" })}
        onOk={handleConfirmReject}
        confirmLoading={submittingReject}
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        className="rounded-3xl"
      >
        <div className="space-y-3 mt-3 text-xs">
          {rejectModal.shiftInfo && (
            <p className="text-on-surface-variant">
              Bạn đang từ chối ca làm việc của tài xế{" "}
              <strong>{rejectModal.shiftInfo.driver_name}</strong> vào ngày{" "}
              <strong>{dayjs(rejectModal.shiftInfo.date).format("DD/MM/YYYY")}</strong> (
              {dayjs(rejectModal.shiftInfo.start_time).format("HH:mm")} – {dayjs(rejectModal.shiftInfo.end_time).format("HH:mm")}).
            </p>
          )}

          <div>
            <label className="block font-bold text-xs mb-1">
              Lý do từ chối (*)
            </label>
            <Input.TextArea
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((prev) => ({...prev, reason: e.target.value }))}
              placeholder="Nhập lý do từ chối để tài xế được thông báo (ví dụ: Không đủ tài xế dự phòng, lịch trùng ca xe...)"
              className="rounded-xl"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

