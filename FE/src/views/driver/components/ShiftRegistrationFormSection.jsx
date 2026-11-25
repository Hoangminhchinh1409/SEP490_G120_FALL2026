"use client";
import React from "react";
import { Button, Input, Popconfirm, Spin } from "antd";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  ShieldAlert,
  Trash2,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import { SHIFT_OPTIONS } from "./shiftRegistrationHelpers";

export default function ShiftRegistrationFormSection({
  currentMonday,
  nextMonday,
  selectedMonday,
  setSelectedMonday,
  weekEnd,
  isCurrentWeek,
  isNextWeek,
  isPastWeek,
  isPastSundayDeadline,
  activeWeekShifts,
  rejectedWeekShifts,
  loading,
  hasAutoAssigned,
  hasApproved,
  hasPendingRequested,
  lockedShiftType,
  cancelling,
  handleCancelWeek,
  selectedShiftType,
  setSelectedShiftType,
  note,
  setNote,
  submitting,
  handleSubmitWeekShift,
}) {
  return (
    <>
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
              {currentMonday.format("DD/MM")} –{" "}
              {currentMonday.add(6, "day").format("DD/MM")}
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
              {nextMonday.format("DD/MM")} –{" "}
              {nextMonday.add(6, "day").format("DD/MM")}
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
              T2 ({selectedMonday.format("DD/MM")}) – CN (
              {weekEnd.format("DD/MM/YYYY")})
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
            <span className="font-semibold text-amber-300">
              Lưu ý hạn chót 22:00 Chủ Nhật:
            </span>{" "}
            Nếu bạn không đăng ký trước 22:00 Chủ Nhật, hệ thống sẽ{" "}
            <strong className="text-white">
              tự động xếp lịch cố định tuần tới
            </strong>{" "}
            (Ca Sáng hoặc Ca Đêm) và bạn{" "}
            <strong className="text-white">không thể chỉnh sửa</strong> sau khi
            đã bị xếp.
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
              className={
                hasAutoAssigned ? "text-amber-400" : "text-emerald-400"
              }
            />
            <span className="text-sm font-bold text-white">
              {hasAutoAssigned
                ? "Hệ thống đã tự động xếp lịch & Khóa chỉnh sửa"
                : "Lịch làm việc tuần này đã được duyệt cố định"}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ca áp dụng suốt tuần ({selectedMonday.format("DD/MM")} –{" "}
            {weekEnd.format("DD/MM")}):{" "}
            <strong className="text-white">
              {lockedShiftType === "NIGHT"
                ? "Ca Đêm (17:00 - 08:00 hôm sau)"
                : "Ca Sáng (08:00 - 17:00)"}
            </strong>
            . Lịch đã chốt không thể sửa đổi hoặc hủy trực tiếp. Nếu có sự cố
            bất khả kháng, vui lòng liên hệ Quản lý.
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
              Đăng ký trước đó cho tuần này đã bị từ chối. Bạn có thể chọn lại
              ca mới bên dưới.
            </div>
          )}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Chọn ca cố định cho cả tuần ({selectedMonday.format("DD/MM")} –{" "}
              {weekEnd.format("DD/MM")})
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
                      <div className="text-sm font-bold text-white">
                        {opt.title}
                      </div>
                      <div className="text-xs font-semibold text-blue-300 mt-0.5">
                        {opt.timeRange}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {opt.subDesc}
                      </div>
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
              <span>
                Đang ngoại tuyến — Đăng ký sẽ được lưu hàng đợi để đồng bộ khi
                có mạng.
              </span>
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
    </>
  );
}
