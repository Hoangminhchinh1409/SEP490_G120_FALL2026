"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Spin, message, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { managerApi } from '../../api/managerApi';
import ManagerKpiAndGaugesSection from './dashboard/ManagerKpiAndGaugesSection';
import ManagerAnalyticsChartsSection from './dashboard/ManagerAnalyticsChartsSection';
import ManagerDriversTab, { ManagerDriverTripsModal } from './dashboard/ManagerDriversTab';

const MANAGER_SWF_TTL_MS = 15000;
const managerDashboardCache = new Map();

export default function ManagerDashboard() {
  const initialMonth = useMemo(() => dayjs().startOf('month'), []);
  const initialPeriod = initialMonth.format('YYYY-MM');
  const initialDisplayPeriod = `Tháng ${initialMonth.format('MM/YYYY')}`;
  const initialCache = managerDashboardCache.get(initialPeriod);
  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => initialMonth);
  const [period, setPeriod] = useState(() => initialPeriod);
  const [displayPeriod, setDisplayPeriod] = useState(() => initialDisplayPeriod);
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' (Screen 16), 'DRIVERS' (Screen 41)

  // 1. Dashboard State — Cấu trúc chuẩn Hybrid BI (Screen 16)
  const [dashboardData, setDashboardData] = useState(() => initialCache?.dashboardData || {
    period: initialPeriod,
    kpiCards: {
      revenueVnd: 0,
      revenueFormatted: '0 đ',
      revenuePerKmVnd: 0,
      revenuePerKmFormatted: '0 đ',
      avgDispatcherSlaMinutes: 0,
      avgSlaDispatchText: '0 phút',
      successfulDeliveries: 0,
      avgOrderCycleDays: 0,
      orderCycleTime: 'Chưa có đơn hoàn thành',
      perfectOrderRatePercent: 0
    },
    fleetGauges: {
      truckUsePercent: 0,
      vehicleFillPercent: 0,
      emptyRunningPercent: 0
    },
    dwellTimeByLocationChart: [],
    lateStopsByCauseChart: [],
    incidentsByTypeChart: [],
    revenueTrendChart: []
  });

  // 2. Driver Performance State (Screen 41)
  const [driversPerformance, setDriversPerformance] = useState(
    () => initialCache?.driversPerformance || []
  );
  const [driverSummary, setDriverSummary] = useState(
    () => initialCache?.driverSummary || { total_drivers: 0, total_completed_trips: 0 }
  );
  const [driverSearch, setDriverSearch] = useState('');
  const [selectedDriverModal, setSelectedDriverModal] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Hàm load dữ liệu API (stale-while-revalidate theo kỳ)
  const loadData = React.useCallback(async (queryPeriod = period, { refresh = false } = {}) => {
    const cacheKey = String(queryPeriod || 'ALL');
    const cached = managerDashboardCache.get(cacheKey);
    if (!refresh && cached) {
      setDashboardData(cached.dashboardData);
      setDriversPerformance(cached.driversPerformance);
      setDriverSummary(cached.driverSummary);
      setLoading(false);
      if (Date.now() - cached.updatedAt < MANAGER_SWF_TTL_MS) {
        return;
      }
    } else if (!cached) {
      setLoading(true);
    }
    if (refresh) setRefreshing(true);
    setLoadError(null);

    try {
      const [statsRes, driversRes] = await Promise.all([
        managerApi.getDashboardStats(queryPeriod, { refresh }),
        managerApi.getDriverPerformance(queryPeriod, { refresh })
      ]);

      let nextDashboardData = cached?.dashboardData || null;
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

        nextDashboardData = {
          period: statsRes.period || queryPeriod,
          kpiCards,
          fleetGauges,
          dwellTimeByLocationChart: Array.isArray(statsRes.dwellTimeByLocationChart) ? statsRes.dwellTimeByLocationChart : [],
          lateStopsByCauseChart: Array.isArray(statsRes.lateStopsByCauseChart) ? statsRes.lateStopsByCauseChart : [],
          incidentsByTypeChart: Array.isArray(statsRes.incidentsByTypeChart) ? statsRes.incidentsByTypeChart : [],
          revenueTrendChart: Array.isArray(statsRes.revenueTrendChart) ? statsRes.revenueTrendChart : []
        };
        setDashboardData(nextDashboardData);
      }

      const nextDrivers = driversRes ? (driversRes.drivers || []) : (cached?.driversPerformance || []);
      const nextSummary = driversRes
        ? (driversRes.summary || { total_drivers: 0, total_completed_trips: 0 })
        : (cached?.driverSummary || { total_drivers: 0, total_completed_trips: 0 });

      if (driversRes) {
        setDriversPerformance(nextDrivers);
        setDriverSummary(nextSummary);
      }

      if (nextDashboardData) {
        managerDashboardCache.set(cacheKey, {
          dashboardData: nextDashboardData,
          driversPerformance: nextDrivers,
          driverSummary: nextSummary,
          updatedAt: Date.now()
        });
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu dashboard:', error);
      const errMsg = error?.message || 'Không thể tải số liệu hiệu suất từ máy chủ.';
      setLoadError(errMsg);
      message.error(errMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [];
    let filename = `bao-cao-nexlog-${period}.csv`;

    if (activeTab === 'DRIVERS') {
      filename = `hieu-suat-tai-xe-${period}.csv`;
      rows.push(['Tài xế', 'SĐT', 'Số GPLX', 'Hạng', 'Số chuyến hoàn thành', 'Tỷ lệ đúng giờ (%)', 'Giờ lái (GPS)', 'Chạm giới hạn 4h', 'Quá tốc độ', 'Ngoài bán kính', 'Ở điểm (TB)', 'Sự cố · Khiếu nại']);
      driversPerformance.forEach((d) => {
        rows.push([
          d.name,
          d.phone,
          d.license_number,
          d.license_class,
          d.completed_trips,
          d.on_time_rate != null ? `${d.on_time_rate}%` : 'Chưa có dữ liệu',
          d.gps_driving_hours,
          d.limit_driving_count,
          d.speeding_count,
          d.outside_radius_count ?? 0,
          d.avg_dwell_time,
          d.incident_claim_text
        ]);
      });
    } else {
      rows.push(['Chỉ số', 'Giá trị']);
      rows.push(['Kỳ báo cáo', displayPeriod]);
      rows.push(['Doanh thu (VNĐ)', dashboardData.kpiCards.revenueVnd]);
      rows.push(['Doanh thu / km (VNĐ)', dashboardData.kpiCards.revenuePerKmVnd]);
      rows.push(['Đơn giao thành công', dashboardData.kpiCards.successfulDeliveries]);
      rows.push(['Tỷ lệ đơn hoàn hảo (%)', dashboardData.kpiCards.perfectOrderRatePercent]);
      rows.push(['Sử dụng xe (%)', dashboardData.fleetGauges.truckUsePercent]);
      rows.push(['Độ đầy xe (%)', dashboardData.fleetGauges.vehicleFillPercent]);
      rows.push(['Km chạy rỗng (%)', dashboardData.fleetGauges.emptyRunningPercent]);
    }

    const csvContent = '\uFEFF' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`Đã xuất báo cáo (${filename}) thành công.`);
  };

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
      {loadError && activeTab === 'OVERVIEW' && (
        <div className="p-4 rounded-2xl bg-error-container/20 border border-error/30 flex items-center justify-between gap-4">
          <div className="text-xs font-semibold text-error">{loadError}</div>
          <button
            type="button"
            onClick={() => loadData(period, { refresh: true })}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold cursor-pointer shrink-0"
          >
            Thử tải lại
          </button>
        </div>
      )}
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
            onClick={() => loadData(period, { refresh: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
            type="button"
            title="Làm mới dữ liệu từ Database"
          >
            <span className={`material-symbols-outlined text-[16px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
            <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
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
              <ManagerKpiAndGaugesSection
                dashboardData={dashboardData}
                period={period}
              />
              <ManagerAnalyticsChartsSection
                dashboardData={dashboardData}
                period={period}
                displayPeriod={displayPeriod}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 2: HIỆU SUẤT TÀI XẾ (BẢNG 8 CỘT CHUẨN XÁC THEO SCREEN 41) */}
      {activeTab === 'DRIVERS' && (
        <ManagerDriversTab
          loading={loading}
          loadError={loadError}
          onRetry={() => loadData(period, { refresh: true })}
          driverSummary={driverSummary}
          driverSearch={driverSearch}
          setDriverSearch={setDriverSearch}
          filteredDrivers={filteredDrivers}
          onSelectDriver={setSelectedDriverModal}
        />
      )}

      {/* Modal hiển thị danh sách chuyến của tài xế khi click tên tài xế */}
      <ManagerDriverTripsModal
        selectedDriverModal={selectedDriverModal}
        onClose={() => setSelectedDriverModal(null)}
      />
    </div>
  );
}
