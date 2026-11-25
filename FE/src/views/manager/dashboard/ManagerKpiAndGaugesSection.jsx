"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Tag } from 'antd';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Component hiệu ứng số đếm mượt mà (Animated Counter)
function AnimatedCounter({ value, suffix = '', prefix = '', duration = 750 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const end = Number(value) || 0;
    const start = 0;
    const startTime = performance.now();
    let animationFrame;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (end - start) * ease);
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

  return <span>{prefix}{displayValue.toLocaleString('vi-VN')}{suffix}</span>;
}

const getGaugeOptions = (label, color, subLabel) => ({
  chart: {
    type: 'radialBar',
    offsetY: -5,
    sparkline: { enabled: true },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 1000,
      dynamicAnimation: {
        enabled: true,
        speed: 450
      }
    }
  },
  plotOptions: {
    radialBar: {
      startAngle: -90,
      endAngle: 90,
      track: {
        background: '#E2E8F0',
        strokeWidth: '97%',
        margin: 5
      },
      dataLabels: {
        name: {
          show: true,
          fontSize: '12px',
          fontWeight: 700,
          color: '#64748B',
          offsetY: -35
        },
        value: {
          offsetY: -10,
          fontSize: '22px',
          fontWeight: 900,
          color: '#0F172A',
          formatter: (val) => `${val}%`
        }
      }
    }
  },
  fill: {
    colors: [color]
  },
  labels: [label],
  tooltip: {
    enabled: true,
    y: {
      formatter: (val) => `${val}% (${subLabel})`
    }
  }
});

export default function ManagerKpiAndGaugesSection({ dashboardData, period }) {
  const truckUseColor = dashboardData.fleetGauges.truckUsePercent > 85
    ? '#EF4444'
    : dashboardData.fleetGauges.truckUsePercent >= 40
    ? '#10B981'
    : '#F59E0B';

  const emptyRunningColor = dashboardData.fleetGauges.emptyRunningPercent > 25
    ? '#EF4444'
    : dashboardData.fleetGauges.emptyRunningPercent > 18
    ? '#F59E0B'
    : '#10B981';

  return (
    <>
      {/* TẦNG 1: 6 THẺ KPI CỐT LÕI (4+2 GRID) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            Chỉ số Vận hành &amp; Doanh thu Cốt lõi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* KPI 1: Doanh thu (Revenue) */}
          <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
              <span>Doanh thu</span>
              <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-primary tracking-tight">
                {dashboardData.kpiCards.revenueFormatted}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                Chưa gồm tiền thu hộ
              </div>
            </div>
            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          {/* KPI 2: Doanh thu / km */}
          <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-blue-600/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
              <span>Doanh thu / km</span>
              <span className="material-symbols-outlined text-blue-600 text-[18px]">trending_up</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-blue-600 tracking-tight">
                {dashboardData.kpiCards.revenuePerKmFormatted}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                Doanh thu ÷ tổng km
              </div>
            </div>
            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>

          {/* KPI 3: SLA Điều phối (TB) */}
          <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-amber-600/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
              <span>SLA điều phối (TB)</span>
              <span className="material-symbols-outlined text-amber-600 text-[18px]">timer</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-amber-600 tracking-tight">
                {dashboardData.kpiCards.avgSlaDispatchText}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                Xác nhận → gán xe
              </div>
            </div>
            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full" style={{ width: '80%' }}></div>
            </div>
          </div>

          {/* KPI 4: Giao thành công */}
          <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-emerald-600/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
              <span>Giao thành công</span>
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-emerald-600 tracking-tight">
                <AnimatedCounter value={dashboardData.kpiCards.successfulDeliveries} suffix=" đơn" />
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                Hoàn tất trong kỳ
              </div>
            </div>
            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, (dashboardData.kpiCards.successfulDeliveries || 0) * 10)}%` }}
              ></div>
            </div>
          </div>

          {/* KPI 5: Nhận đơn -> Giao (TB) */}
          <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-indigo-600/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
              <span>Nhận đơn → giao</span>
              <span className="material-symbols-outlined text-indigo-600 text-[18px]">schedule</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-indigo-600 tracking-tight">
                {dashboardData.kpiCards.orderCycleTime}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                Từ tạo đơn đến đã giao
              </div>
            </div>
            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>

          {/* KPI 6: Đơn hoàn hảo (3 tiêu chí) */}
          <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-teal-600/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
              <span>Đơn hoàn hảo</span>
              <span className="material-symbols-outlined text-teal-600 text-[18px]">task_alt</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-teal-600 tracking-tight">
                <AnimatedCounter value={dashboardData.kpiCards.perfectOrderRatePercent} suffix="%" />
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                Đủ kiện · Chứng từ · Không lỗi
              </div>
            </div>
            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
              <div
                className="bg-teal-600 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, dashboardData.kpiCards.perfectOrderRatePercent || 0)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* TẦNG 2: HIỆU SUẤT KHAI THÁC ĐỘI XE (3 RADIAL GAUGES) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            Hiệu suất Khai thác Đội xe (Đồng hồ bán nguyệt - Radial Gauges)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Gauge 1: Sử dụng xe (Truck Use %) */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
              <span>Sử dụng xe (Truck Use)</span>
              <Tag color={dashboardData.fleetGauges.truckUsePercent > 85 ? 'red' : dashboardData.fleetGauges.truckUsePercent >= 40 ? 'green' : 'gold'}>
                {dashboardData.fleetGauges.truckUsePercent > 85 ? 'Quá tải' : dashboardData.fleetGauges.truckUsePercent >= 40 ? 'Tối ưu' : 'Dư xe'}
              </Tag>
            </div>

            <div className="my-2 w-full flex justify-center">
              <Chart
                key={`gauge-truck-${period}`}
                options={getGaugeOptions('Sử dụng', truckUseColor, 'Giờ chạy ÷ giờ xe sẵn sàng')}
                series={[dashboardData.fleetGauges.truckUsePercent]}
                type="radialBar"
                height={180}
                width="100%"
              />
            </div>

            <div className="text-xs text-on-surface-variant font-medium">
              Ngưỡng: &lt;40% (Dư xe), 40-85% (Tối ưu), &gt;85% (Quá tải)
            </div>
          </div>

          {/* Gauge 2: Độ đầy xe (Vehicle Fill %) */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
              <span>Độ đầy xe (Vehicle Fill)</span>
              <Tag color="blue">
                {dashboardData.fleetGauges.vehicleFillPercent >= 60 ? 'Hiệu quả cao' : 'Ghép thêm'}
              </Tag>
            </div>

            <div className="my-2 w-full flex justify-center">
              <Chart
                key={`gauge-fill-${period}`}
                options={getGaugeOptions('Độ đầy', '#2563EB', 'Khối lượng chở ÷ Tải trọng')}
                series={[dashboardData.fleetGauges.vehicleFillPercent]}
                type="radialBar"
                height={180}
                width="100%"
              />
            </div>

            <div className="text-xs text-on-surface-variant font-medium">
              Tổng khối lượng thực chở ÷ Tải trọng cho phép thùng xe
            </div>
          </div>

          {/* Gauge 3: Km chạy rỗng (Empty Running %) */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
              <span>Km chạy rỗng (Empty Running)</span>
              <Tag color={dashboardData.fleetGauges.emptyRunningPercent > 25 ? 'red' : 'green'}>
                {dashboardData.fleetGauges.emptyRunningPercent > 25 ? 'Lãng phí cao' : 'Tiết kiệm'}
              </Tag>
            </div>

            <div className="my-2 w-full flex justify-center">
              <Chart
                key={`gauge-empty-${period}`}
                options={getGaugeOptions('Chạy rỗng', emptyRunningColor, 'Km không chở hàng ÷ Tổng km')}
                series={[dashboardData.fleetGauges.emptyRunningPercent]}
                type="radialBar"
                height={180}
                width="100%"
              />
            </div>

            <div className="text-xs text-on-surface-variant font-medium">
              Tỷ lệ quãng đường không tải chiều về (Càng thấp càng tối ưu)
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
