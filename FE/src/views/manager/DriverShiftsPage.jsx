"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Form, Button, message } from "antd";
import {
  Calendar as CalendarIcon,
  Plus,
  RotateCcw
} from "lucide-react";
import dayjs from "dayjs";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../providers/AuthProvider";
import ShiftCalendarMatrixSection from "./shifts/ShiftCalendarMatrixSection";
import ShiftTablesSection from "./shifts/ShiftTablesSection";
import ShiftApprovalModals from "./shifts/ShiftApprovalModals";

const getMondayOfWeek = (d = dayjs()) => {
  const dow = d.day();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return d.startOf("day").add(diffToMon, "day");
};

const detectShiftTypeManager = (sh) => {
  if (!sh) return "MORNING";
  const noteStr = String(sh.note || "").toUpperCase();
  if (noteStr.includes("CA ĐÊM") || noteStr.includes("NIGHT")) return "NIGHT";
  if (noteStr.includes("CA SÁNG") || noteStr.includes("MORNING")) return "MORNING";
  const h = sh.start_time ? dayjs(sh.start_time).hour() : 8;
  return h >= 15 ? "NIGHT" : "MORNING";
};

const isAutoAssignedManager = (sh) => {
  if (!sh) return false;
  return (sh.note && sh.note.includes("[Hệ thống tự động xếp lịch]")) || sh.registered_by === null || sh.registered_by === undefined;
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
        message.info(data?.message || "Tất cả tài xế đều đã có lịch tuần tới hoặc đã được nhắc.");
      }
    } catch (err) {
      message.error(err.message || "Không thể gửi thông báo nhắc đăng ký.");
    } finally {
      setSendingReminders(false);
    }
  };

  const handleApproveDriverWeek = async (driverId) => {
    setWeeklyBusyKey(`approve_${driverId}`);
    try {
      const res = await managerApi.approveDriverWeekShifts({
        driver_id: driverId,
        week_start: currentWeekStart.format("YYYY-MM-DD"),
      });
      message.success(res.message || "Đã phê duyệt cả tuần cho tài xế.");
      await loadData();
    } catch (err) {
      message.error(err.message || "Không thể phê duyệt cả tuần.");
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
        week_start: currentWeekStart.format("YYYY-MM-DD"),
        shift_type: targetShiftType,
        auto_approve: autoApprove,
      });
      message.success(res.message || "Đã điều chỉnh ca làm việc cả tuần.");
      await loadData();
    } catch (err) {
      message.error(err.message || "Không thể điều chỉnh ca làm việc cả tuần.");
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
        managerApi.getShifts({ from: fromStr, to: toStr, status: statusFilter !== "ALL" ? statusFilter : undefined }),
        managerApi.getFleetDrivers ? managerApi.getFleetDrivers() : Promise.resolve([]),
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
      const drvShifts = shifts.filter((sh) => Number(sh.driver_id) === Number(drv.id) && sh.status !== "Rejected");
      if (drvShifts.length === 0) {
        unscheduledCount++;
        return;
      }
      const shiftType = detectShiftTypeManager(drvShifts[0]);
      if (shiftType === "NIGHT") nightCount++;
      else morningCount++;

      const isAuto = drvShifts.some((sh) => isAutoAssignedManager(sh));
      const hasPending = drvShifts.some((sh) => sh.status === "Requested");
      const allApproved = drvShifts.every((sh) => sh.status === "Approved");

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
      driver_id: driverId || (drivers.length > 0 ? drivers[0].id : undefined),
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
        note: values.note ? values.note.trim() : null
      };

      if (editingShift) {
        const res = await managerApi.updateShift(editingShift.id, payload);
        message.success(res.message || "Cập nhật ca làm việc thành công.");
        if (res.warning) message.warning(res.warning, 6);
      } else {
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
                Lịch Phân Ca &amp; Phê Duyệt Ca Trực
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

      <ShiftCalendarMatrixSection
        stats={stats}
        weekDays={weekDays}
        currentWeekStart={currentWeekStart}
        setCurrentWeekStart={setCurrentWeekStart}
        getMondayOfWeek={getMondayOfWeek}
        handlePrevWeek={handlePrevWeek}
        handleNextWeek={handleNextWeek}
        handleTodayWeek={handleTodayWeek}
        searchDriver={searchDriver}
        setSearchDriver={setSearchDriver}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        loading={loading}
        filteredDrivers={filteredDrivers}
        shifts={shifts}
        isReadOnly={isReadOnly}
        onSelectShift={(sh) => setDetailModal({ open: true, shift: sh })}
        onCreateShift={handleOpenCreateShift}
      />

      <ShiftTablesSection
        leaveRequests={leaveRequests}
        pendingLeaveCount={pendingLeaveCount}
        isReadOnly={isReadOnly}
        onOpenLeaveDecision={handleOpenLeaveDecision}
        weeklyOverview={weeklyOverview}
        weeklyBusyKey={weeklyBusyKey}
        onSwitchDriverWeek={handleSwitchDriverWeek}
        onApproveDriverWeek={handleApproveDriverWeek}
        pendingShifts={pendingShifts}
        onApproveShift={handleApproveShift}
        onOpenRejectModal={handleOpenRejectModal}
      />

      <ShiftApprovalModals
        isReadOnly={isReadOnly}
        drivers={drivers}
        leaveDecisionModal={leaveDecisionModal}
        setLeaveDecisionModal={setLeaveDecisionModal}
        submittingLeaveDecision={submittingLeaveDecision}
        onConfirmLeaveDecision={handleConfirmLeaveDecision}
        isShiftModalOpen={isShiftModalOpen}
        setIsShiftModalOpen={setIsShiftModalOpen}
        editingShift={editingShift}
        shiftForm={shiftForm}
        submittingShift={submittingShift}
        onSaveShift={handleSaveShift}
        onApplyShiftTemplate={handleApplyShiftTemplate}
        detailModal={detailModal}
        setDetailModal={setDetailModal}
        onApproveShift={handleApproveShift}
        onOpenRejectModal={handleOpenRejectModal}
        onOpenEditShift={handleOpenEditShift}
        onDeleteShift={handleDeleteShift}
        rejectModal={rejectModal}
        setRejectModal={setRejectModal}
        submittingReject={submittingReject}
        onConfirmReject={handleConfirmReject}
      />
    </div>
  );
}
