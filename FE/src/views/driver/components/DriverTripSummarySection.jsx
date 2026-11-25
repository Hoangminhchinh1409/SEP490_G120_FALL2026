"use client";
import React from "react";
import { Button } from "antd";
import {
  Package,
  Navigation2,
  Truck,
  Clock,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import {
  isPickupStop,
  isReturnWarehouseStop,
  formatStopStatus,
  formatTripStatus,
  formatTripDateTime,
  formatDuration,
} from "./driverDashboardHelpers";

export default function DriverTripSummarySection({
  trip,
  upcomingTrips,
  tripWeekOffset,
  setTripWeekOffset,
  selectedWeekMonday,
  selectedWeekSunday,
  weekTitleLabel,
  filteredWeekTrips,
  setSelectedTripId,
  setDocsModalOpen,
  truck,
  stops,
  fetchDashboardData,
}) {
  if (!trip) {
    return (
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 text-center shadow-2xl mt-4">
        <Package className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-white mb-2">
          Hiện chưa có chuyến xe
        </h3>
        <p className="text-slate-400 text-sm mb-6">
          Bạn đang ở trạng thái sẵn sàng. Khi có chuyến xe mới được phân bổ,
          thông tin sẽ xuất hiện ngay tại đây.
        </p>
        <Button
          type="primary"
          onClick={fetchDashboardData}
          className="bg-blue-600 font-bold rounded-xl h-11 px-6 shadow-lg shadow-blue-600/30"
        >
          Kiểm tra lại
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* BỘ CHỌN CHUYẾN XE SẮP TỚI THEO TỪNG TUẦN */}
      {upcomingTrips && upcomingTrips.length > 0 && (
        <div className="mb-3 bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 shadow-xl space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-200 flex items-center gap-1.5">
                <Calendar size={13} className="text-blue-400" />
                Chuyến xe sắp tới
              </span>
              <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {dayjs().format("DD/MM/YYYY")}
              </span>
            </div>
            <Link
              href="/driver/trips"
              className="text-[10px] text-slate-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Sổ chuyến ({upcomingTrips.length})</span>
              <span>→</span>
            </Link>
          </div>

          {/* Bộ chuyển tuần (chỉ hiển thị chuyến trong từng tuần) */}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/75 border border-slate-700/60 px-2 py-1">
            <button
              type="button"
              onClick={() => setTripWeekOffset((w) => w - 1)}
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Tuần trước"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setTripWeekOffset(0)}
              className="flex-1 text-center text-[11px] text-slate-200 font-semibold cursor-pointer"
              title="Bấm để quay về tuần hiện tại"
            >
              <span>{weekTitleLabel}</span>{" "}
              <span className="font-mono text-slate-400 text-[10px]">
                ({selectedWeekMonday.format("DD/MM")} –{" "}
                {selectedWeekSunday.format("DD/MM")})
              </span>{" "}
              <span className="ml-1 inline-block px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                {filteredWeekTrips.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTripWeekOffset((w) => w + 1)}
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Tuần sau"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {filteredWeekTrips.length === 0 ? (
            <div className="py-3 text-center text-[11px] text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800/70">
              Không có chuyến xe nào trong tuần{" "}
              {selectedWeekMonday.format("DD/MM")} –{" "}
              {selectedWeekSunday.format("DD/MM")}.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filteredWeekTrips.map((t, idx) => {
                const isSelected = t.id === trip?.id;
                const tripDate = t.planned_start
                  ? dayjs(t.planned_start)
                  : null;
                const isToday = tripDate
                  ? tripDate.isSame(dayjs(), "day")
                  : false;
                const isTomorrow = tripDate
                  ? tripDate.isSame(dayjs().add(1, "day"), "day")
                  : false;
                const timeStr = tripDate ? tripDate.format("HH:mm") : "Chờ xếp";
                const dateBadge = isToday
                  ? "Hôm nay"
                  : isTomorrow
                    ? "Ngày mai"
                    : tripDate
                      ? tripDate.format("DD/MM")
                      : "";

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTripId(t.id)}
                    className={`p-2 rounded-xl text-left transition-all border ${
                      isSelected
                        ? "bg-blue-600/30 border-blue-400 shadow-md shadow-blue-500/20 ring-1 ring-blue-400"
                        : "bg-slate-900/60 border-slate-700/60 hover:border-slate-600 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className={`text-[10px] font-bold ${isSelected ? "text-white" : "text-slate-400"}`}
                      >
                        #{idx + 1}
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          t.status === "In Progress"
                            ? "bg-amber-400 animate-pulse"
                            : t.status === "Accepted"
                              ? "bg-emerald-400"
                              : "bg-blue-400"
                        }`}
                      />
                    </div>
                    <p
                      className={`text-[11px] font-extrabold truncate ${isSelected ? "text-blue-200" : "text-slate-200"}`}
                    >
                      {t.trip_code}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[9px]">
                      <span className="font-mono text-slate-300 font-semibold">
                        {timeStr}
                      </span>
                      <span
                        className={`px-1 py-0.2 rounded font-medium ${
                          isToday
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {dateBadge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trip Info Header */}
      <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-bold text-white tracking-wide">
          Chuyến xe hiện tại
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setDocsModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors"
          >
            <FileText size={11} /> Chứng từ
          </button>
          <div
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
              trip.status === "Completed"
                ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
                : "bg-blue-500/20 text-blue-200 border border-blue-400/30"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                trip.status === "Completed"
                  ? "bg-emerald-400"
                  : "bg-blue-400 animate-pulse"
              }`}
            ></div>
            {formatTripStatus(trip.status).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Trip Summary Card */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-3 mb-3 shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-start border-b border-white/10 pb-2 mb-2 gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-blue-200/80 font-bold uppercase tracking-wider mb-0.5">
              Mã Chuyến
            </p>
            <h3 className="text-lg font-black text-white tracking-tight truncate">
              {trip.trip_code}
            </h3>
            {truck && (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-blue-200 font-semibold mt-1">
                <span className="flex items-center gap-1 shrink-0">
                  <Truck size={12} /> Xe: {truck.plate_number}
                </span>
                <span className="text-blue-300/70 text-[10px]">
                  ({truck.model} •{" "}
                  {truck.allowed_payload ? `${truck.allowed_payload}kg` : ""})
                </span>
              </div>
            )}

            {/* THÔNG TIN NGÀY GIỜ VÀ HÀNH TRÌNH CHUYẾN XE */}
            {(trip.planned_start || trip.created_at) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-blue-100 font-medium mt-2 pt-2 border-t border-white/10">
                <span className="flex items-center gap-1.5 text-[11px] text-blue-100 bg-white/10 px-2 py-0.5 rounded-md">
                  <Calendar size={12} className="text-blue-300 shrink-0" />
                  <span>
                    Khởi hành:{" "}
                    <b className="text-white">
                      {formatTripDateTime(
                        trip.planned_start || trip.created_at,
                      )}
                    </b>
                  </span>
                </span>
                {trip.planned_duration && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-200/90">
                    <Clock size={12} className="text-blue-300 shrink-0" />
                    <span>
                      Dự kiến: {formatDuration(trip.planned_duration)}
                    </span>
                  </span>
                )}
                {trip.planned_distance && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-200/90">
                    <Navigation2 size={12} className="text-blue-300 shrink-0" />
                    <span>{trip.planned_distance} km</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-xl text-white font-semibold text-[11px] shrink-0">
            <Package size={12} />
            <span>{stops.length} Điểm dừng</span>
          </div>
        </div>

        {/* Stop Timeline */}
        <div className="space-y-3 relative pl-2">
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-500 opacity-50 z-0"></div>

          {stops.map((stop) => {
            const isDone = stop.status === "Done";
            const isArrived = stop.status === "Arrived";
            const isPickup = isPickupStop(stop);
            const isReturn = isReturnWarehouseStop(stop);
            const isOrderRefused =
              !isPickup &&
              !isReturn &&
              String(stop.order?.status || "")
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "_") === "DELIVERED_EXCEPTION";

            return (
              <div key={stop.id} className="flex gap-3 relative z-10">
                <div
                  className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1 shadow-lg ${
                    isOrderRefused
                      ? "bg-red-500 border-2 border-red-200"
                      : isDone
                        ? "bg-emerald-500 border-2 border-emerald-300"
                        : isArrived
                          ? "bg-amber-400 border-2 border-amber-200 animate-ping"
                          : isReturn
                            ? "bg-amber-500 border-2 border-amber-200"
                            : isPickup
                              ? "bg-slate-900 border-[2.5px] border-blue-400"
                              : "bg-slate-900 border-[2.5px] border-indigo-400"
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <p
                      className={`text-[10px] font-bold tracking-wide uppercase ${
                        isReturn
                          ? "text-amber-300"
                          : isOrderRefused
                            ? "text-red-300"
                            : "text-blue-200/80"
                      }`}
                    >
                      #{stop.sequence}{" "}
                      {isReturn
                        ? "HOÀN HÀNG VỀ KHO ALS (RETURN)"
                        : isPickup
                          ? "LẤY HÀNG (PICKUP)"
                          : "GIAO HÀNG (DROP-OFF)"}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isOrderRefused
                          ? "bg-red-500/20 text-red-300 border-red-500/40"
                          : isDone
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : isArrived
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : stop.status === "Loading Started" ||
                                  stop.status === "Loading Done"
                                ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {isOrderRefused
                        ? "Khách từ chối nhận"
                        : formatStopStatus(
                            stop.status,
                            isPickup ? "Pickup" : "Drop-off",
                          )}
                    </span>
                  </div>
                  <p className="font-semibold text-white leading-tight text-xs mt-0.5">
                    {stop.location?.name ||
                      stop.location?.address ||
                      "Kho hàng"}
                  </p>
                  <p className="text-[11px] text-slate-300/80">
                    {stop.location?.address}
                  </p>
                  {stop.order && (
                    <div className="text-[10px] text-blue-200 mt-0.5 flex items-center gap-2">
                      <span>
                        Đơn: <b>{stop.order.order_code}</b>
                      </span>
                      {stop.order.receiver_name && (
                        <span>• Nhận: {stop.order.receiver_name}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
