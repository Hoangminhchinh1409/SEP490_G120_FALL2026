"use client";
import React, { useState, useEffect } from 'react';

export function AnimatedCounter({ value, suffix = '', prefix = '', duration = 750 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const end = Number(value) || 0;
    const startTime = performance.now();
    let animationFrame;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(end * ease);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString('vi-VN')}
      {suffix}
    </span>
  );
}

export default function DispatcherKpiCards({ computed, displayPeriod }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          Chỉ số Vận hành &amp; Điều phối Cốt lõi ({displayPeriod})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* KPI 1: Doanh thu */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            <span>Doanh thu chốt</span>
            <span className="material-symbols-outlined text-primary text-[18px]">
              payments
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-primary tracking-tight">
              {computed.revenueFormatted}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
              Cước &amp; phí hủy
            </div>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* KPI 2: Chờ xếp xe */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-amber-600/40 transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            <span>Chờ xếp xe</span>
            <span className="material-symbols-outlined text-amber-600 text-[18px]">
              pending_actions
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-amber-600 tracking-tight">
              <AnimatedCounter value={computed.readyCount} suffix=" đơn" />
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
              Sẵn sàng lập chuyến
            </div>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div
              className="bg-amber-600 h-full rounded-full transition-all duration-700"
              style={{
                width: `${
                  computed.totalOrders > 0
                    ? Math.min(100, Math.round((computed.readyCount / computed.totalOrders) * 100))
                    : 0
                }%`
              }}
            ></div>
          </div>
        </div>

        {/* KPI 3: Chuyến đang chạy */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-blue-600/40 transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            <span>Đang khai thác</span>
            <span className="material-symbols-outlined text-blue-600 text-[18px]">
              local_shipping
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-blue-600 tracking-tight">
              <AnimatedCounter value={computed.activeTripsCount} suffix=" chuyến" />
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
              Assigned · In Transit
            </div>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>

        {/* KPI 4: Giao thành công */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-emerald-600/40 transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            <span>Giao thành công</span>
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">
              check_circle
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              <AnimatedCounter value={computed.deliveredCount} suffix=" đơn" />
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
              Trong {computed.totalOrders} đơn hợp lệ
            </div>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-700"
              style={{ width: `${computed.deliveredRatePercent}%` }}
            ></div>
          </div>
        </div>

        {/* KPI 5: Tổng tải trọng xử lý */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-indigo-600/40 transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            <span>Khối lượng xử lý</span>
            <span className="material-symbols-outlined text-indigo-600 text-[18px]">
              inventory_2
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-indigo-600 tracking-tight">
              <AnimatedCounter value={Math.round(computed.totalWeightKg)} suffix=" kg" />
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
              Trọng lượng tính cước
            </div>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: '68%' }}></div>
          </div>
        </div>

        {/* KPI 6: Sự cố mở */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-teal-600/40 transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            <span>Sự cố chưa đóng</span>
            <span
              className={`material-symbols-outlined text-[18px] ${
                computed.openIncidentsCount > 0 ? 'text-error' : 'text-teal-600'
              }`}
            >
              {computed.openIncidentsCount > 0 ? 'report_problem' : 'verified_user'}
            </span>
          </div>
          <div className="my-2">
            <div
              className={`text-2xl font-black tracking-tight ${
                computed.openIncidentsCount > 0 ? 'text-error' : 'text-teal-600'
              }`}
            >
              <AnimatedCounter value={computed.openIncidentsCount} suffix=" vụ" />
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
              Giám sát hiện trường
            </div>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                computed.openIncidentsCount > 0 ? 'bg-error' : 'bg-teal-600'
              }`}
              style={{
                width: `${
                  computed.openIncidentsCount > 0
                    ? Math.min(100, computed.openIncidentsCount * 20)
                    : 100
                }%`
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
