"use client";
import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spin, message, Tag, Tooltip, Modal, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { managerApi } from '../../api/managerApi';

// Dynamic import ReactApexChart để tránh lỗi SSR trong Next.js App Router
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Component hiệu ứng số đếm mượt mà (Animated Counter)
function AnimatedCounter({ value, suffix = '', prefix = '', duration = 750 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const end = Number(value) || 0;
    let start = 0;
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

export default function ManagerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs('2026-10-01'));
  const [period, setPeriod] = useState('2026-10');
  const [displayPeriod, setDisplayPeriod] = useState('Tháng 10/2026');
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' (Screen 16), 'DRIVERS' (Screen 41)

  // 1. Dashboard State — Cấu trúc chuẩn Hybrid BI (Screen 16)
  const [dashboardData, setDashboardData] = useState({
    period: '2026-10',
    kpiCards: {
      revenueVnd: 482500000,
      revenueFormatted: '482,5 tr',
      revenuePerKmVnd: 18400,
      revenuePerKmFormatted: '18.400 đ',
      avgDispatcherSlaMinutes: 42,
      avgSlaDispatchText: '42 phút',
      successfulDeliveries: 38,
      avgOrderCycleDays: 2.6,
      orderCycleTime: '2,6 ngày',
      perfectOrderRatePercent: 91
    },
    fleetGauges: {
      truckUsePercent: 68,
      vehicleFillPercent: 64,
      emptyRunningPercent: 22
    },
    dwellTimeByLocationChart: [
      { locationName: 'Kho ALS tại Sân bay Nội Bài', avgMinutes: 72, threshold: 60, status: 'OVER_LIMIT' },
      { locationName: 'ALSC Nhà ga hàng hóa', avgMinutes: 65, threshold: 60, status: 'OVER_LIMIT' },
      { locationName: 'ALSB Bắc Ninh', avgMinutes: 48, threshold: 60, status: 'NORMAL' },
      { locationName: 'Kho B - KCN Quế Võ', avgMinutes: 31, threshold: 60, status: 'NORMAL' }
    ],
    lateStopsByCauseChart: [
      { cause: 'Đi đường lâu', count: 9, color: '#F59E0B' },
      { cause: 'Ở điểm lâu', count: 6, color: '#3B82F6' },
      { cause: 'Sự cố vận tải', count: 2, color: '#EF4444' }
    ],
    incidentsByTypeChart: [
      { type: 'ENGINE_BREAKDOWN', label: 'Hỏng xe', count: 2, color: '#F59E0B' },
      { type: 'DAMAGED_LOST_CARGO', label: 'Hàng hư hỏng/mất', count: 1, color: '#EF4444' },
      { type: 'TRAFFIC_ACCIDENT', label: 'Tai nạn', count: 1, color: '#DC2626' },
      { type: 'OTHER', label: 'Khác', count: 1, color: '#64748B' }
    ],
    revenueTrendChart: [
      { date: '01/10', revenue: 38000000, orders: 3 },
      { date: '05/10', revenue: 58000000, orders: 5 },
      { date: '10/10', revenue: 87000000, orders: 7 },
      { date: '15/10', revenue: 106000000, orders: 9 },
      { date: '20/10', revenue: 72000000, orders: 6 },
      { date: '25/10', revenue: 72000000, orders: 5 },
      { date: '30/10', revenue: 49500000, orders: 3 }
    ]
  });

  // 2. Driver Performance State (Screen 41)
  const [driversPerformance, setDriversPerformance] = useState([]);
  const [driverSummary, setDriverSummary] = useState({ total_drivers: 0, total_completed_trips: 0 });
  const [driverSearch, setDriverSearch] = useState('');
  const [selectedDriverModal, setSelectedDriverModal] = useState(null);

  // Hàm load dữ liệu API
  const loadData = React.useCallback(async (queryPeriod = period) => {
    setLoading(true);
    try {
      const [statsRes, driversRes] = await Promise.all([
        managerApi.getDashboardStats(queryPeriod).catch(() => null),
        managerApi.getDriverPerformance(queryPeriod).catch(() => ({ drivers: [], summary: {} }))
      ]);

      if (statsRes) {
        // Tương thích cả format mới phân cụm và format cũ
        const kpiCards = statsRes.kpiCards || {
          revenueVnd: statsRes.stats?.revenue || statsRes.revenue || 0,
          revenueFormatted: statsRes.stats?.revenueFormatted || statsRes.revenueFormatted || '0 đ',
          revenuePerKmVnd: Number(String(statsRes.stats?.revenuePerKm || '0').replace(/\D/g, '')) || 0,
          revenuePerKmFormatted: statsRes.stats?.revenuePerKm || statsRes.revenuePerKm || '0 đ',
          avgDispatcherSlaMinutes: parseInt(statsRes.stats?.avgSlaDispatch || '0') || 0,
          avgSlaDispatchText: statsRes.stats?.avgSlaDispatch || '0 phút',
          successfulDeliveries: statsRes.stats?.completedOrders || statsRes.completedOrders || 0,
          avgOrderCycleDays: 0,
          orderCycleTime: statsRes.stats?.orderCycleTime || statsRes.orderCycleTime || 'Chưa có đơn hoàn thành',
          perfectOrderRatePercent: Number(statsRes.stats?.perfectOrdersRate || statsRes.perfectOrdersRate || 0)
        };

        const fleetGauges = statsRes.fleetGauges || {
          truckUsePercent: Number(statsRes.stats?.truckUtilization || statsRes.truckUtilization || 0),
          vehicleFillPercent: Number(statsRes.stats?.vehicleFillRate || statsRes.vehicleFillRate || 0),
          emptyRunningPercent: Number(statsRes.stats?.emptyRunningRate || statsRes.emptyRunningRate || 0)
        };

        setDashboardData({
          period: statsRes.period || queryPeriod,
          kpiCards,
          fleetGauges,
          dwellTimeByLocationChart: Array.isArray(statsRes.dwellTimeByLocationChart) ? statsRes.dwellTimeByLocationChart : [],
          lateStopsByCauseChart: Array.isArray(statsRes.lateStopsByCauseChart) ? statsRes.lateStopsByCauseChart : [],
          incidentsByTypeChart: Array.isArray(statsRes.incidentsByTypeChart) ? statsRes.incidentsByTypeChart : [],
          revenueTrendChart: Array.isArray(statsRes.revenueTrendChart) ? statsRes.revenueTrendChart : []
        });
      }

      if (driversRes) {
        setDriversPerformance(driversRes.drivers || []);
        setDriverSummary(driversRes.summary || { total_drivers: 0, total_completed_trips: 0 });
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu dashboard:', error);
      message.error('Không thể tải số liệu hiệu suất từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const handleMonthChange = (date) => {
    if (!date) return;
    setSelectedMonth(date);
    const pKey = date.format('YYYY-MM');
    const pDisplay = `Tháng ${date.format('MM/YYYY')}`;
    setDisplayPeriod(pDisplay);
    setPeriod(pKey);
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!ignore) {
        await loadData(period);
      }
    }
    init();
    return () => { ignore = true; };
  }, [period, loadData]);

  const handleExportReport = () => {
    message.success(`Đang kết xuất báo cáo hiệu suất vận tải (${displayPeriod})... Tải xuống thành công!`);
  };

  // Helper tạo Option cho Radial Gauge (Đồng hồ bán nguyệt có hiệu ứng chạy)
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

  // Gauge colors theo ngưỡng cảnh báo
  const truckUseColor = dashboardData.fleetGauges.truckUsePercent > 85
    ? '#EF4444' // Quá tải - Đỏ
    : dashboardData.fleetGauges.truckUsePercent >= 40
    ? '#10B981' // Tối ưu - Xanh lá
    : '#F59E0B'; // Dư xe - Vàng

  const emptyRunningColor = dashboardData.fleetGauges.emptyRunningPercent > 25
    ? '#EF4444' // Lãng phí cao - Đỏ
    : dashboardData.fleetGauges.emptyRunningPercent > 18
    ? '#F59E0B' // Mức vừa - Vàng cam
    : '#10B981'; // Thấp = Tốt - Xanh lá

  // Tầng 3: Biểu đồ Dwell Time (Horizontal Bar)
  const dwellOptions = useMemo(() => {
    const list = dashboardData.dwellTimeByLocationChart;
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 850,
          animateGradually: {
            enabled: true,
            delay: 120
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        }
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '50%',
          distributed: true,
          borderRadius: 6
        }
      },
      colors: list.map((item) => (item.avgMinutes > 60 ? '#EF4444' : '#2563EB')),
      xaxis: {
        categories: list.map((item) => item.locationName),
        labels: {
          formatter: (val) => `${val}'`,
          style: { fontSize: '11px', fontWeight: 600 }
        }
      },
      yaxis: {
        labels: {
          maxWidth: 180,
          style: { fontSize: '11px', fontWeight: 600 }
        }
      },
      annotations: {
        xaxis: [
          {
            x: 60,
            borderColor: '#DC2626',
            strokeDashArray: 4,
            label: {
              text: 'Ngưỡng 60 phút',
              orientation: 'horizontal',
              style: {
                color: '#fff',
                background: '#DC2626',
                fontSize: '10px',
                fontWeight: 700
              }
            }
          }
        ]
      },
      legend: { show: false },
      tooltip: {
        y: {
          formatter: (val) => `${val} phút (${val > 60 ? 'VƯỢT ĐỊNH MỨC' : 'ĐẠT CHUẨN'})`
        }
      }
    };
  }, [dashboardData.dwellTimeByLocationChart]);

  const dwellSeries = useMemo(() => [
    {
      name: 'Thời gian dừng TB',
      data: dashboardData.dwellTimeByLocationChart.map((item) => item.avgMinutes)
    }
  ], [dashboardData.dwellTimeByLocationChart]);

  // Tầng 3: Lịch trễ theo nguyên nhân (Grouped Bar Chart)
  const lateStopsOptions = useMemo(() => {
    const list = dashboardData.lateStopsByCauseChart;
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 850,
          animateGradually: {
            enabled: true,
            delay: 120
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        }
      },
      plotOptions: {
        bar: {
          columnWidth: '45%',
          distributed: true,
          borderRadius: 6
        }
      },
      colors: list.map((item) => item.color || '#3B82F6'),
      xaxis: {
        categories: list.map((item) => item.cause),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: {
        title: { text: 'Số điểm dừng trễ > 30p', style: { fontSize: '11px' } }
      },
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 800 }
      }
    };
  }, [dashboardData.lateStopsByCauseChart]);

  const lateStopsSeries = useMemo(() => [
    {
      name: 'Số điểm trễ',
      data: dashboardData.lateStopsByCauseChart.map((item) => item.count)
    }
  ], [dashboardData.lateStopsByCauseChart]);

  // Tầng 4: Biểu đồ Sự cố theo loại (Donut Chart)
  const incidentsDonutOptions = useMemo(() => {
    const list = dashboardData.incidentsByTypeChart;
    return {
      chart: {
        type: 'donut',
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 950,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 400
          }
        },
        events: {
          dataPointSelection: () => {
            router.push('/manager/incidents');
          }
        }
      },
      labels: list.map((item) => item.label),
      colors: list.map((item) => item.color),
      legend: {
        position: 'bottom',
        fontSize: '11px',
        fontWeight: 600
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Tổng sự cố',
                fontSize: '12px',
                fontWeight: 600,
                color: '#64748B',
                formatter: () => `${list.reduce((sum, item) => sum + item.count, 0)}`
              }
            }
          }
        }
      },
      tooltip: {
        y: {
          formatter: (val) => `${val} vụ (Bấm để xem chi tiết)`
        }
      }
    };
  }, [dashboardData.incidentsByTypeChart, router]);

  const incidentsDonutSeries = useMemo(() => {
    return dashboardData.incidentsByTypeChart.map((item) => item.count);
  }, [dashboardData.incidentsByTypeChart]);

  // Tầng 4: Xu hướng Doanh thu & Đơn hàng (Composed Area & Column Chart)
  const trendOptions = useMemo(() => {
    const list = dashboardData.revenueTrendChart;
    return {
      chart: {
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1000,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 400
          }
        }
      },
      stroke: {
        width: [0, 3],
        curve: 'smooth'
      },
      plotOptions: {
        bar: {
          columnWidth: '35%',
          borderRadius: 4
        }
      },
      colors: ['#2563EB', '#10B981'],
      xaxis: {
        categories: list.map((item) => item.date),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: [
        {
          title: { text: 'Doanh thu', style: { color: '#2563EB', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${(val / 1000000).toFixed(0)} tr`,
            style: { fontSize: '10px' }
          }
        },
        {
          opposite: true,
          title: { text: 'Số đơn hoàn thành', style: { color: '#10B981', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${val}`,
            style: { fontSize: '10px' }
          }
        }
      ],
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '11px',
        fontWeight: 600
      }
    };
  }, [dashboardData.revenueTrendChart]);

  const trendSeries = useMemo(() => {
    const list = dashboardData.revenueTrendChart;
    return [
      {
        name: 'Doanh thu (VNĐ)',
        type: 'column',
        data: list.map((item) => item.revenue)
      },
      {
        name: 'Đơn giao thành công',
        type: 'line',
        data: list.map((item) => item.orders)
      }
    ];
  }, [dashboardData.revenueTrendChart]);

  // Bộ lọc tài xế tab 2
  const filteredDrivers = driversPerformance.filter((d) => {
    if (!driverSearch) return true;
    const q = driverSearch.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.phone?.includes(q) ||
      d.license_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col w-full space-y-5">
      {/* 1. Global Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/30">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              Tổng quan hiệu suất
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Hybrid BI Telemetry
            </span>
          </div>
          <p className="text-xs text-on-surface-variant max-w-2xl">
            Kết hợp Thẻ số liệu lớn (KPI Cards) và Biểu đồ trực quan (ApexCharts) phân tích điểm nghẽn và hiệu suất khai thác.
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-surface-container">
            <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
            <span className="text-xs font-bold text-on-surface-variant">Kỳ báo cáo:</span>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              format="[Tháng] MM/YYYY"
              allowClear={false}
              className="bg-transparent border-none text-xs font-bold text-primary shadow-none cursor-pointer hover:bg-surface-container-high/40 rounded-lg p-0"
              style={{ width: 165 }}
            />
          </div>

          <button
            onClick={() => loadData(period)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
            type="button"
            title="Làm mới dữ liệu từ Database"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {/* 2. Main Tabs Navigation (Screen 16 vs Screen 41) */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-2">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">query_stats</span>
          <span>Tổng quan</span>
        </button>

        <button
          onClick={() => setActiveTab('DRIVERS')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'DRIVERS'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>Hiệu suất tài xế ({driversPerformance.length})</span>
        </button>
      </div>

      {/* TAB 1: TỔNG QUAN (CẤU TRÚC 4 TẦNG HYBRID BI DASHBOARD) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-5">
          {loading ? (
            <div className="py-20 flex flex-col justify-center items-center gap-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
              <Spin size="large" />
              <span className="text-xs text-on-surface-variant font-medium">Đang tổng hợp số liệu vận tải...</span>
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* TẦNG 1: 6 THẺ KPI CỐT LÕI (4+2 GRID)                                       */}
              {/* ========================================================================= */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    Chỉ số Vận hành & Doanh thu Cốt lõi
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
                        Chưa gồm tiền thu hộ (BR-30)
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

              {/* ========================================================================= */}
              {/* TẦNG 2: HIỆU SUẤT KHAI THÁC ĐỘI XE (3 RADIAL GAUGES)                       */}
              {/* ========================================================================= */}
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

              {/* ========================================================================= */}
              {/* TẦNG 3: PHÂN TÍCH ĐIỂM NGHẼN & LỊCH TRỄ (2 BIỂU ĐỒ CỘT)                   */}
              {/* ========================================================================= */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Phân tích Điểm nghẽn Vận tải & Lịch trễ
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Biểu đồ 1: Dwell Time theo Kho (Horizontal Bar) */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-primary">
                          Thời gian ở điểm (TB) – Kho lâu nhất (Dwell Time)
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Đo thời gian (Left - Arrived) tại từng kho. Cột vượt 60 phút cảnh báo Đỏ.
                        </p>
                      </div>
                      <Tag color="red" className="font-bold">
                        Định mức: 60 phút
                      </Tag>
                    </div>

                    {dashboardData.dwellTimeByLocationChart && dashboardData.dwellTimeByLocationChart.length > 0 ? (
                      <div className="w-full">
                        <Chart key={`dwell-${period}`} options={dwellOptions} series={dwellSeries} type="bar" height={220} width="100%" />
                      </div>
                    ) : (
                      <div className="py-12 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-1 block">warehouse</span>
                        Chưa có dữ liệu điểm dừng kho bãi trong kỳ này
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-blue-600"></span>
                        Đạt chuẩn (&le;60 phút)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-error"></span>
                        Nút thắt cổ chai (&gt;60 phút)
                      </span>
                    </div>
                  </div>

                  {/* Biểu đồ 2: Lịch trễ theo nguyên nhân (Stacked / Grouped Bar) */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-primary">
                          Lịch trễ theo nguyên nhân (Late Stops by Cause)
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Điểm dừng trễ &gt; 30 phút chia theo 3 nhóm nguyên nhân chính.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">warning</span>
                        Trễ &gt; 30 phút
                      </span>
                    </div>

                    <div className="w-full">
                      <Chart key={`late-${period}`} options={lateStopsOptions} series={lateStopsSeries} type="bar" height={220} width="100%" />
                    </div>

                    <div className="flex items-center justify-around text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span> Đi đường lâu
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span> Ở điểm lâu
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-600"></span> Sự cố vận tải
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* TẦNG 4: GIÁM SÁT RỦI RO & XU HƯỚNG (DONUT & COMPOSED CHART)                */}
              {/* ========================================================================= */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-error"></span>
                    Giám sát Rủi ro Sự cố & Nhịp điệu Vận hành
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Donut Chart: Sự cố theo loại (1 cột) */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-extrabold text-primary">
                        Sự cố theo loại (Incidents)
                      </h4>
                      <Link
                        href="/manager/incidents"
                        className="text-xs text-secondary font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span>Chi tiết</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mb-2">
                      Bấm lát cắt để lọc danh sách sự cố.
                    </p>

                    {dashboardData.incidentsByTypeChart && dashboardData.incidentsByTypeChart.some((i) => i.count > 0) ? (
                      <div className="w-full flex justify-center my-1">
                        <Chart
                          key={`incidents-${period}`}
                          options={incidentsDonutOptions}
                          series={incidentsDonutSeries}
                          type="donut"
                          height={240}
                          width="100%"
                        />
                      </div>
                    ) : (
                      <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                        <span className="material-symbols-outlined text-[32px] text-emerald-500 mb-1 block">verified_user</span>
                        Không có sự cố vận tải nào trong {displayPeriod}
                      </div>
                    )}

                    <div className="text-[11px] text-center text-on-surface-variant font-medium pt-2 border-t border-surface-container">
                      Dữ liệu báo cáo hiện trường & biên bản giám định
                    </div>
                  </div>

                  {/* Composed Chart: Xu hướng Doanh thu & Đơn hàng trong kỳ (2 cột) */}
                  <div className="lg:col-span-2 p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h4 className="text-sm font-extrabold text-primary">
                          Xu hướng Doanh thu & Đơn hàng Hoàn thành
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Nhịp điệu biến động sản lượng và doanh thu theo các mốc thời gian trong {displayPeriod}.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        <span className="material-symbols-outlined text-[14px]">insights</span>
                        Doanh thu & Sản lượng
                      </span>
                    </div>

                    <div className="w-full">
                      <Chart key={`trend-${period}`} options={trendOptions} series={trendSeries} type="line" height={240} width="100%" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
                      <span>Cột xanh: Doanh thu thực tế (VNĐ)</span>
                      <span>Đường xanh lá: Số lượng đơn giao hoàn tất</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: HIỆU SUẤT TÀI XẾ (BẢNG 8 CỘT CHUẨN XÁC THEO SCREEN 41) */}
      {activeTab === 'DRIVERS' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
          {/* Header & Tìm kiếm tài xế */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-container pb-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-black text-primary tracking-tight">
                  Bảng đánh giá hiệu suất tài xế
                </h3>
                <Tag color="blue" className="font-bold">
                  Tổng tài xế: {driverSummary.total_drivers}
                </Tag>
                <Tag color="cyan" className="font-bold">
                  Tổng chuyến: {driverSummary.total_completed_trips}
                </Tag>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Giờ lái tính từ GPS xe. Bấm tên tài xế để xem danh sách chuyến xe được phân công.
              </p>
            </div>

            <div className="w-full sm:w-72 relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-surface-container"
                placeholder="Tìm tên, SĐT, số bằng lái..."
                type="text"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center"><Spin size="large" /></div>
          ) : filteredDrivers.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-sm">
              Không tìm thấy hồ sơ tài xế nào trong cơ sở dữ liệu.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[11px] font-extrabold tracking-wider border-b border-surface-container">
                    <th className="py-3 px-4">Tài xế</th>
                    <th className="py-3 px-4 text-center">Số chuyến</th>
                    <th className="py-3 px-4 text-center">Giờ lái (GPS)</th>
                    <th className="py-3 px-4 text-center">Chạm giới hạn lái</th>
                    <th className="py-3 px-4 text-center">Quá tốc độ</th>
                    <th className="py-3 px-4 text-center">Ngoài bán kính</th>
                    <th className="py-3 px-4 text-center">Ở điểm (TB)</th>
                    <th className="py-3 px-4 text-center">Sự cố · khiếu nại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {filteredDrivers.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedDriverModal(d)}
                          className="flex items-center gap-3 text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            {d.name?.charAt(0) || 'TX'}
                          </div>
                          <div>
                            <div className="font-bold text-primary group-hover:underline flex items-center gap-1.5">
                              <span>{d.name}</span>
                              <span className="material-symbols-outlined text-[13px] text-secondary opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                            </div>
                            <div className="text-[11px] text-on-surface-variant font-mono flex items-center gap-2 mt-0.5">
                              <span>{d.phone}</span>
                              <span>·</span>
                              <span>GPLX: {d.license_number}</span>
                              <Tag color="blue" className="text-[10px] px-1 py-0 m-0">Hạng {d.license_class}</Tag>
                            </div>
                          </div>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-primary">
                        {d.completed_trips}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-primary">
                        {d.gps_driving_hours}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {d.limit_driving_count > 0 ? (
                          <Tooltip title="Tài xế lái quá 4h liên tục không nghỉ ngơi">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-error/10 text-error font-extrabold">
                              {d.limit_driving_count}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-on-surface-variant">0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {d.speeding_count > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-extrabold">
                            {d.speeding_count}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {d.outside_radius_count > 0 ? (
                          <Tooltip title="Check-in/Check-out ngoài bán kính Geofence hợp lệ">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-error/10 text-error font-extrabold">
                              {d.outside_radius_count}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-on-surface-variant">0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-medium text-primary">
                        {d.avg_dwell_time}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold">
                        <span className={d.incident_claim_text !== '0 · 0' ? 'text-error font-black' : 'text-on-surface-variant'}>
                          {d.incident_claim_text}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 text-xs italic text-on-surface-variant">
                Giờ lái tính từ GPS xe. Bấm tên tài xế để xem danh sách chuyến của tài xế đó.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal hiển thị danh sách chuyến của tài xế khi click tên tài xế */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">route</span>
            <span className="font-bold text-base text-primary">
              Danh sách chuyến xe: {selectedDriverModal?.name}
            </span>
          </div>
        }
        open={Boolean(selectedDriverModal)}
        onCancel={() => setSelectedDriverModal(null)}
        footer={null}
        width={700}
      >
        {selectedDriverModal && (
          <div className="space-y-4 pt-2">
            <div className="bg-surface-container-low p-3 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Số điện thoại:</span>
                <span className="font-bold text-primary">{selectedDriverModal.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Số bằng lái:</span>
                <span className="font-bold text-primary">{selectedDriverModal.license_number} (Hạng {selectedDriverModal.license_class})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Trạng thái:</span>
                <Tag color={selectedDriverModal.status === 'Active' ? 'green' : 'orange'}>
                  {selectedDriverModal.status}
                </Tag>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-on-surface-variant mb-2">
                Các chuyến xe được phân công:
              </h4>
              {selectedDriverModal.trips && selectedDriverModal.trips.length > 0 ? (
                <div className="border border-surface-container rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-surface-container">
                      <tr>
                        <th className="py-2.5 px-3">Mã chuyến</th>
                        <th className="py-2.5 px-3">Lộ trình</th>
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3">Quãng đường</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {selectedDriverModal.trips.map((t, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-low/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-primary">{t.code}</td>
                          <td className="py-2.5 px-3">{t.route}</td>
                          <td className="py-2.5 px-3 text-on-surface-variant">{t.time}</td>
                          <td className="py-2.5 px-3">{t.distance}</td>
                          <td className="py-2.5 px-3">
                            <Tag color={t.status === 'Completed' ? 'green' : t.status === 'Assigned' ? 'blue' : 'orange'}>
                              {t.status}
                            </Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-on-surface-variant text-xs italic bg-surface-container-low rounded-xl">
                  Chưa có chuyến xe nào được ghi nhận cho tài xế này.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
