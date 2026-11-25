"use client";
import React from "react";
import { Button, Tag } from "antd";
import { AlertTriangle, Check, X } from "lucide-react";
import dayjs from "dayjs";

export default function ShiftTablesSection({
  leaveRequests,
  pendingLeaveCount,
  isReadOnly,
  onOpenLeaveDecision,
  weeklyOverview,
  weeklyBusyKey,
  onSwitchDriverWeek,
  onApproveDriverWeek,
  pendingShifts,
  onApproveShift,
  onOpenRejectModal
}) {
  return (
    <>
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
                      <div className="flex flex-wrap items-center gap-1">
                        {(lr.leave_dates || []).map((dStr) => {
                          const isToday = dStr === dayjs().format("YYYY-MM-DD");
                          return (
                            <Tag key={dStr} color={isToday ? "volcano" : "blue"} className="font-mono font-semibold !m-0">
                              {dayjs(dStr).format("DD/MM/YYYY")}{isToday ? " (Hôm nay)" : ""}
                            </Tag>
                          );
                        })}
                        {lr.is_urgent && (
                          <Tag color="error" className="font-bold animate-pulse !m-0">
                            KHẨN CẤP
                          </Tag>
                        )}
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
                            onClick={() => onOpenLeaveDecision(lr, "APPROVED")}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg text-xs"
                          >
                            Duyệt nghỉ
                          </Button>
                          <Button
                            danger
                            size="small"
                            icon={<X size={13} />}
                            onClick={() => onOpenLeaveDecision(lr, "REJECTED")}
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
                  const targetSwitchType = row.shiftType === "NIGHT" ? "MORNING" : "NIGHT";
                  const targetSwitchLabel = targetSwitchType === "NIGHT" ? "Đổi sang Ca Đêm" : "Đổi sang Ca Sáng";
                  const isSwitching = weeklyBusyKey === `switch_${drv.id}`;
                  const isApproving = weeklyBusyKey === `approve_${drv.id}`;
                  return (
                    <tr key={drv.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-primary">
                        <div>{drv.name}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono">
                          Hạng {drv.license_class || "C"} {drv.phone ? `· ${drv.phone}` : ""}
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
                        {row.shiftType === "NIGHT" ? "Ca Đêm (17:00 – 08:00)" : "Ca Sáng (08:00 – 17:00)"}
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
                              onClick={() => onSwitchDriverWeek(drv.id, targetSwitchType, false)}
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
                                onClick={() => onApproveDriverWeek(drv.id)}
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
        ) : (
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
                        Hạng {sh.license_class || "C"} {sh.driver_phone ? `· ${sh.driver_phone}` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      {sh.date ? dayjs(sh.date).format("dddd, DD/MM/YYYY") : "N/A"}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-primary">
                      {dayjs(sh.start_time).format("HH:mm")} – {dayjs(sh.end_time).format("HH:mm")}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold ${
                        sh.duration_hours > 10 ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-slate-100 text-slate-700"
                      }`}>
                        {sh.duration_hours} giờ
                      </span>
                    </td>
                    <td className="py-3 px-3 text-on-surface-variant font-mono text-[11px]">
                      {sh.created_at ? dayjs(sh.created_at).format("DD/MM/YYYY HH:mm") : "N/A"}
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
                            onClick={() => onApproveShift(sh)}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg h-8 shadow-2xs"
                          >
                            Duyệt
                          </Button>
                          <Button
                            danger
                            size="small"
                            icon={<X size={14} />}
                            onClick={() => onOpenRejectModal(sh)}
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
    </>
  );
}
