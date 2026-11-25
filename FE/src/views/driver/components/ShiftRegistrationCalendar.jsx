"use client";
import React from "react";
import { Tag } from "antd";
import {
  Clock,
  Lock,
  MapPin,
  Truck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import dayjs from "dayjs";
import {
  formatShiftSummaryText,
  isSystemAutoAssigned,
  TRIP_STATUS_LABELS,
} from "./shiftRegistrationHelpers";

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

export default function ShiftRegistrationCalendar({
  selectedMonday,
  weekEnd,
  activeWeekShifts,
  weekTripsCount,
  weekDaysList,
  leaveRequests,
  onNavigateTrip,
}) {
  return (
    <>
      {/* CHI TIẾT 7 NGÀY TRONG TUẦN */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">
            Chi tiết lịch 7 ngày ({selectedMonday.format("DD/MM")} –{" "}
            {weekEnd.format("DD/MM")})
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{activeWeekShifts.length}/7 ngày có ca</span>
            <span>•</span>
            <span className="text-blue-300 font-semibold">
              {weekTripsCount} chuyến được giao
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {weekDaysList.map(
            ({ dateObj, dateStr, dayName, isToday, shift, dayTrips }) => {
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
                      {shift?.note &&
                        !shift.note.includes("Đăng ký ca cố định cả tuần") && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[210px]">
                            {shift.note}
                          </div>
                        )}
                      {shift?.rejection_reason &&
                        shift.status === "Rejected" && (
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
                          (a, b) => (a.sequence || 0) - (b.sequence || 0),
                        );
                        const firstLoc = sortedStops[0]?.location?.name;
                        const lastLoc =
                          sortedStops.length > 1
                            ? sortedStops[sortedStops.length - 1]?.location
                                ?.name
                            : null;
                        const routeText =
                          firstLoc && lastLoc
                            ? `${firstLoc} → ${lastLoc}`
                            : firstLoc || `${sortedStops.length} điểm dừng`;

                        return (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => onNavigateTrip(tr.id)}
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
                                <MapPin
                                  size={11}
                                  className="shrink-0 text-slate-500"
                                />
                                <span className="truncate flex-1 min-w-0 block">
                                  {routeText}
                                </span>
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
            },
          )}
        </div>
      </div>

      {/* DANH SÁCH ĐƠN BÁO NGHỈ ĐỘT XUẤT ĐÃ GỬI */}
      {leaveRequests.length > 0 && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 shadow-lg space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span className="truncate">Đơn báo nghỉ đột xuất đã gửi</span>
            </h2>
            <span className="text-[11px] text-slate-400 shrink-0">
              {leaveRequests.length} đơn
            </span>
          </div>

          <div className="space-y-2.5">
            {leaveRequests.map((lr) => {
              const statusMap = {
                PENDING: {
                  label: "Chờ Quản lý duyệt",
                  cls: "!border-amber-500/50 !bg-amber-950/60 !text-amber-300",
                },
                APPROVED: {
                  label: "Đã duyệt nghỉ",
                  cls: "!border-emerald-500/50 !bg-emerald-950/60 !text-emerald-300",
                },
                REJECTED: {
                  label: "Quản lý từ chối",
                  cls: "!border-red-500/50 !bg-red-950/60 !text-red-300",
                },
              };
              const st = statusMap[lr.status] || statusMap.PENDING;

              return (
                <div
                  key={lr.id}
                  className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-2 text-xs min-w-0"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {(lr.leave_dates || []).map((dStr) => (
                        <span
                          key={dStr}
                          className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px]"
                        >
                          {dayjs(dStr).format("DD/MM/YYYY")}
                        </span>
                      ))}
                    </div>
                    <Tag
                      className={`!m-0 !rounded-full !text-[10px] !px-2 shrink-0 ${st.cls}`}
                    >
                      {st.label}
                    </Tag>
                  </div>

                  <div className="text-slate-300 text-[11px] leading-snug">
                    <span className="text-slate-400">Lý do:</span> {lr.reason}
                  </div>

                  {(lr.affected_trips || []).length > 0 && (
                    <div className="rounded-lg bg-slate-900/90 border border-slate-800/90 p-2 space-y-1">
                      <div className="text-[10px] font-semibold text-amber-300">
                        Chuyến xe bị ảnh hưởng ({lr.affected_trips.length}):
                      </div>
                      {lr.affected_trips.map((tr) => (
                        <div
                          key={tr.trip_id}
                          className="flex items-center justify-between gap-2 text-[11px] text-slate-300 min-w-0"
                        >
                          <span className="font-mono text-blue-300 shrink-0">
                            {tr.trip_code}
                          </span>
                          <span className="truncate flex-1 text-slate-400">
                            {tr.planned_start
                              ? dayjs(tr.planned_start).format("DD/MM HH:mm")
                              : ""}
                          </span>
                          {lr.status === "APPROVED" ? (
                            <span
                              className={`shrink-0 text-[10px] font-semibold ${
                                tr.reassigned
                                  ? "text-emerald-400"
                                  : "text-amber-300"
                              }`}
                            >
                              {tr.reassigned
                                ? `Đã đổi → ${tr.reassigned_to_driver_name || "Tài mới"}`
                                : "Chờ Điều phối đổi tài"}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-slate-500">
                              Chờ xét duyệt
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {lr.manager_comment && (
                    <div className="text-[11px] text-slate-400 italic">
                      Phản hồi Quản lý: {lr.manager_comment}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
