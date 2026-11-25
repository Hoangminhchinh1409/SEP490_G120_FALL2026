"use client";
import React from "react";
import {
  Button,
  DatePicker,
  Input,
  Select,
  Spin,
  Empty
} from "antd";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle
} from "lucide-react";
import dayjs from "dayjs";

export default function ShiftCalendarMatrixSection({
  stats,
  weekDays,
  currentWeekStart,
  setCurrentWeekStart,
  getMondayOfWeek,
  handlePrevWeek,
  handleNextWeek,
  handleTodayWeek,
  searchDriver,
  setSearchDriver,
  statusFilter,
  setStatusFilter,
  loading,
  filteredDrivers,
  shifts,
  isReadOnly,
  onSelectShift,
  onCreateShift
}) {
  return (
    <>
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
          <div className={`text-2xl font-black mt-1 ${stats.overLimitCount > 0 ? "text-error" : "text-on-surface"}`}>
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
        ) : filteredDrivers.length === 0 ? (
          <div className="py-12 text-center">
            <Empty description="Không có tài xế nào phù hợp" />
          </div>
        ) : (
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
                        d.isToday ? "bg-primary/10 text-primary" : ""
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
                            {drv.name ? drv.name.charAt(0) : "T"}
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
                              d.isToday ? "bg-primary/5" : ""
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
                                      onClick={() => onSelectShift(sh)}
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
                                          {isPending ? "⏳ " : ""}
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
                                  onClick={() => onCreateShift(drv.id, d.dayMoment)}
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
    </>
  );
}
