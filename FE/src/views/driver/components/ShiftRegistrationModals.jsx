"use client";
import React from "react";
import { Button, Input, Modal } from "antd";
import { Truck, AlertTriangle, Send, Plus, X } from "lucide-react";
import dayjs from "dayjs";

export default function ShiftRegistrationModals({
  leaveModalOpen,
  setLeaveModalOpen,
  leaveDates,
  upcomingLeaveChoices,
  toggleLeaveDate,
  todayStr,
  customLeaveDate,
  setCustomLeaveDate,
  handleAddCustomLeaveDate,
  affectedLeavePreviewTrips,
  hasUrgentTrip,
  leaveReason,
  setLeaveReason,
  submittingLeave,
  handleSubmitLeaveRequest,
}) {
  return (
    <Modal
      centered
      open={leaveModalOpen}
      styles={{
        content: {
          backgroundColor: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "1.5rem",
          color: "#f8fafc",
          padding: "1.25rem",
        },
        header: {
          backgroundColor: "transparent",
          borderBottom: "1px solid #1e293b",
          paddingBottom: "0.75rem",
          marginBottom: "0.75rem",
        },
      }}
      onCancel={() => setLeaveModalOpen(false)}
      footer={null}
      width="95%"
      style={{ maxWidth: 440 }}
      destroyOnHidden
      title={
        <div className="flex items-center gap-2 text-amber-300 text-sm font-bold">
          <AlertTriangle size={17} className="shrink-0" />
          <span>Báo nghỉ đột xuất</span>
        </div>
      }
    >
      <div className="space-y-3.5 pt-2 text-xs">
        <div className="rounded-xl bg-amber-950/40 border border-amber-700/50 px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
          <strong>Quy định:</strong> Được chọn xin nghỉ từ{" "}
          <strong className="text-white">hôm nay</strong> hoặc các ngày sắp tới
          (áp dụng cho các chuyến chưa khởi hành).
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-300">
            1. Chọn ngày sắp tới muốn nghỉ ({leaveDates.length} ngày đã chọn):
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
            {upcomingLeaveChoices.map((opt) => {
              const selected = leaveDates.includes(opt.dateStr);
              return (
                <button
                  key={opt.dateStr}
                  type="button"
                  disabled={opt.alreadyRequested}
                  onClick={() => toggleLeaveDate(opt.dateStr)}
                  className={`rounded-xl border px-2 py-1.5 text-left transition ${
                    opt.alreadyRequested
                      ? "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
                      : selected
                        ? "bg-amber-600/25 border-amber-400 text-white cursor-pointer shadow-sm"
                        : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 cursor-pointer"
                  }`}
                >
                  <div className="text-[10px] truncate flex items-center justify-between">
                    <span
                      className={
                        opt.isToday
                          ? "font-bold text-amber-300"
                          : "text-slate-400"
                      }
                    >
                      {opt.dayName}
                    </span>
                    {opt.isToday && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
                        title="Hôm nay"
                      />
                    )}
                  </div>
                  <div className="font-mono font-bold text-xs">
                    {opt.displayDate}
                  </div>
                  {opt.alreadyRequested ? (
                    <div className="text-[9px] text-slate-500 truncate">
                      Đã gửi đơn
                    </div>
                  ) : opt.tripCount > 0 ? (
                    <div className="text-[9px] font-semibold text-amber-300 truncate">
                      {opt.tripCount} chuyến xe
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-500 truncate">
                      Trống chuyến
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="date"
              min={todayStr}
              value={customLeaveDate}
              onChange={(e) => setCustomLeaveDate(e.target.value)}
              className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <Button
              size="small"
              icon={<Plus size={13} />}
              onClick={handleAddCustomLeaveDate}
              disabled={!customLeaveDate}
              className="!rounded-xl !bg-slate-800 !border-slate-700 !text-slate-200"
            >
              Thêm ngày
            </Button>
          </div>

          {leaveDates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {leaveDates.map((dStr) => (
                <span
                  key={dStr}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 font-mono text-[11px]"
                >
                  {dayjs(dStr).format("DD/MM/YYYY")}
                  <button
                    type="button"
                    onClick={() => toggleLeaveDate(dStr)}
                    className="hover:text-white cursor-pointer"
                    aria-label={`Bỏ chọn ${dStr}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {leaveDates.length > 0 && (
          <div
            className={`rounded-xl border p-3 space-y-2 ${
              affectedLeavePreviewTrips.length > 0
                ? "bg-red-950/35 border-red-700/60"
                : "bg-slate-900/70 border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Truck
                  size={14}
                  className={
                    affectedLeavePreviewTrips.length > 0
                      ? "text-red-400"
                      : "text-slate-400"
                  }
                />
                Chuyến xe sẽ phải Re-assign ({affectedLeavePreviewTrips.length})
              </span>
            </div>

            {hasUrgentTrip && (
              <div className="p-2 rounded-lg bg-red-950/80 border border-red-500/80 text-red-200 text-[11px] flex items-start gap-1.5 animate-pulse">
                <AlertTriangle
                  size={14}
                  className="text-red-400 shrink-0 mt-0.5"
                />
                <div>
                  <span className="font-bold text-red-100 uppercase">
                    Cảnh báo khẩn cấp:
                  </span>{" "}
                  Có chuyến xe sắp chạy trong vòng ít hơn 2 giờ tới! Đơn sẽ được
                  gắn cờ <b>[KHẨN CẤP]</b> để Quản lý và Điều phối xử lý ưu
                  tiên.
                </div>
              </div>
            )}
            {leaveDates.includes(todayStr) && !hasUrgentTrip && (
              <div className="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-800/40 rounded-lg p-2">
                💡 <b>Báo nghỉ hôm nay:</b> Áp dụng cho các chuyến xe chưa khởi
                hành từ giờ đến hết hôm nay. Các chuyến đã hoàn thành không bị
                ảnh hưởng.
              </div>
            )}

            {affectedLeavePreviewTrips.length === 0 ? (
              <div className="text-[11px] text-slate-400">
                Không có chuyến xe nào đang giao vào các ngày bạn chọn.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                <div className="text-[11px] text-red-200">
                  Sau khi Quản lý duyệt cho nghỉ, các chuyến sau sẽ được chuyển
                  Điều phối viên gán cho tài xế khác:
                </div>
                {affectedLeavePreviewTrips.map((tr) => {
                  const sortedStops = [...(tr.stops || [])].sort(
                    (a, b) => (a.sequence || 0) - (b.sequence || 0),
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
                  const plate =
                    tr.truck?.plate_number ||
                    tr.truck_assignments?.[0]?.truck?.plate_number ||
                    "";

                  return (
                    <div
                      key={tr.id}
                      className={`rounded-lg bg-slate-950/80 border px-2.5 py-1.5 space-y-0.5 ${
                        tr.isUrgent ? "border-red-500/80" : "border-red-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-blue-300">
                          {tr.trip_code || `TRIP-${tr.id}`}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
                          {dayjs(tr.planned_start || tr.created_at).format(
                            "DD/MM HH:mm",
                          )}
                          {plate ? ` • ${plate}` : ""}
                          {tr.isUrgent && (
                            <span className="bg-red-500/40 text-red-200 border border-red-500/50 text-[9px] px-1 rounded font-bold">
                              Gấp (&lt;2h)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {routeText}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-300">
            2. Lý do báo nghỉ đột xuất <span className="text-red-400">*</span>
          </label>
          <Input.TextArea
            rows={3}
            maxLength={250}
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
            placeholder="Ví dụ: Bị ốm đột xuất, có việc gia đình khẩn cấp..."
            className="!bg-slate-950 !border-slate-700 !text-slate-100 !rounded-xl"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            onClick={() => setLeaveModalOpen(false)}
            className="!rounded-xl !bg-slate-800 !border-slate-700 !text-slate-200"
          >
            Đóng
          </Button>
          <Button
            type="primary"
            loading={submittingLeave}
            disabled={leaveDates.length === 0 || !leaveReason.trim()}
            onClick={handleSubmitLeaveRequest}
            icon={<Send size={13} />}
            className="!rounded-xl !bg-amber-600 hover:!bg-amber-500 !border-amber-500 !font-bold"
          >
            Gửi Quản lý duyệt
          </Button>
        </div>
      </div>
    </Modal>
  );
}
