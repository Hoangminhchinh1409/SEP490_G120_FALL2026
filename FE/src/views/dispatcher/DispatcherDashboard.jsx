"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Spin, message, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';
import { useAuth } from '../../providers/AuthProvider';
import DispatcherKpiCards from './dashboard/DispatcherKpiCards';
import DispatcherAnalyticsCharts from './dashboard/DispatcherAnalyticsCharts';
import {
  DispatcherOverviewBottomSection,
  DispatcherQueueSection
} from './dashboard/DispatcherRecentAndQueueSection';

const OrderFormModal = dynamic(
  () => import('../../components/dispatcher/OrderFormModal'),
  { ssr: false }
);

const getCleanShortName = (fullText, defaultText) => {
  if (!fullText) return defaultText;
  const firstPart = String(fullText).split(/[-–,]/)[0]?.trim();
  return firstPart || defaultText;
};

const STATUS_META = {
  DRAFT: { label: 'Lưu nháp', color: 'default', barColor: '#94A3B8' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'blue', barColor: '#3B82F6' },
  READY_FOR_PLANNING: { label: 'Sẵn sàng xếp xe', color: 'cyan', barColor: '#06B6D4' },
  ASSIGNED: { label: 'Đã gán xe', color: 'orange', barColor: '#F59E0B' },
  ACCEPTED: { label: 'Tài xế đã nhận', color: 'geekblue', barColor: '#6366F1' },
  PICKED_UP: { label: 'Đã lấy hàng', color: 'purple', barColor: '#8B5CF6' },
  IN_TRANSIT: { label: 'Đang vận chuyển', color: 'purple', barColor: '#7C3AED' },
  HANDED_OVER_VENDOR: { label: 'Giao thầu phụ', color: 'gold', barColor: '#D97706' },
  DELIVERED: { label: 'Đã giao hàng', color: 'green', barColor: '#10B981' },
  DELIVERED_EXCEPTION: { label: 'Giao có ngoại lệ', color: 'volcano', barColor: '#EA580C' },
  CLOSED: { label: 'Đã đóng', color: 'green', barColor: '#059669' },
  CANCELLED: { label: 'Đã hủy', color: 'red', barColor: '#EF4444' }
};

const INCIDENT_TYPE_LABELS = {
  ENGINE_BREAKDOWN: { label: 'Hỏng xe', color: '#F59E0B' },
  BREAKDOWN: { label: 'Hỏng xe', color: '#F59E0B' },
  DAMAGED_LOST_CARGO: { label: 'Hàng hư hỏng/mất', color: '#EF4444' },
  DAMAGED_CARGO: { label: 'Hàng hư hỏng/mất', color: '#EF4444' },
  CARGO_DAMAGED: { label: 'Hàng hư hỏng/mất', color: '#EF4444' },
  TRAFFIC_ACCIDENT: { label: 'Tai nạn', color: '#DC2626' },
  ACCIDENT: { label: 'Tai nạn', color: '#DC2626' },
  CARGO_HELD: { label: 'Hàng bị giữ', color: '#8B5CF6' },
  ROAD_BAN: { label: 'Cấm đường / Ùn tắc', color: '#3B82F6' },
  OTHER: { label: 'Khác', color: '#64748B' }
};

const resolveOrderTimestamp = (order) => {
  const raw = order?.created_at || order?.date;
  if (!raw) return null;
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed : null;
};

const isOrderCancelled = (o) => {
  const st = String(o?.status || '').toUpperCase();
  return st === 'CANCELLED' || Boolean(o?.cancel_reason) || Boolean(o?.cancellation_reason);
};

// Cache ngắn hạn ở FE giúp chuyển tab / quay lại Dashboard hiển thị tức thì (stale-while-revalidate)
const DISPATCHER_SWF_TTL_MS = 15000;
const dispatcherDashboardCache = new Map();

export default function DispatcherDashboard() {
  const { user } = useAuth();
  const cacheKey = `disp_${user?.id || 'default'}`;
  const initialCache = dispatcherDashboardCache.get(cacheKey);

  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [periodMode, setPeriodMode] = useState('ALL'); // 'ALL' | 'MONTH'
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' | 'QUEUE'
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [orders, setOrders] = useState(() => initialCache?.userOrders || []);
  const [dbStats, setDbStats] = useState(() => initialCache?.statsRes || null);
  const [leaveReassignments, setLeaveReassignments] = useState(
    () => initialCache?.leaveReassignments || []
  );

  const fetchAllData = useCallback(async ({ refresh = false } = {}) => {
    const [ordersRes, statsRes] = await Promise.all([
      orderApi.getAllOrders(),
      dispatcherApi.getDashboardStats({ refresh }),
    ]);

    const currentUserId = user?.id ? Number(user.id) : null;
    const isDispatcher =
      user &&
      (Number(user.role_id) === 3 ||
        user.role === 'DISPATCHER' ||
        user.role_name === 'DISPATCHER');

    const userOrders = (ordersRes || []).filter((o) => {
      if (isDispatcher && currentUserId) {
        const orderDispId = o.responsible_dispatcher_id
          ? Number(o.responsible_dispatcher_id)
          : null;
        if (orderDispId && orderDispId !== currentUserId) {
          return false;
        }
      }
      return true;
    });

    return {
      userOrders: userOrders.map((o) => ({
        ...o,
        status: String(o.status || 'DRAFT').toUpperCase(),
        route: `${getCleanShortName(o.pickup, 'Kho ALS')} → ${getCleanShortName(o.dropoff, 'Điểm giao')}`
      })),
      statsRes,
    };
  }, [user]);

  useEffect(() => {
    let ignore = false;
    const cached = dispatcherDashboardCache.get(cacheKey);

    const loadLeaveBannerAsync = (forceRefresh = false) => {
      dispatcherApi
        .getLeaveReassignments({ refresh: forceRefresh })
        .then((leaveRes) => {
          if (ignore) return;
          const items = leaveRes?.reassignments || [];
          setLeaveReassignments(items);
          const cur = dispatcherDashboardCache.get(cacheKey);
          if (cur) {
            dispatcherDashboardCache.set(cacheKey, { ...cur, leaveReassignments: items });
          }
        })
        .catch(() => {});
    };

    async function initLoad() {
      if (cached) {
        await Promise.resolve();
        if (ignore) return;
        setOrders(cached.userOrders);
        setDbStats(cached.statsRes);
        setLeaveReassignments(cached.leaveReassignments || []);
        setLoading(false);
        if (Date.now() - cached.updatedAt < DISPATCHER_SWF_TTL_MS) {
          loadLeaveBannerAsync(false);
          return;
        }
      }

      loadLeaveBannerAsync(false);

      try {
        const res = await fetchAllData({ refresh: false });
        if (!ignore) {
          setOrders(res.userOrders);
          setDbStats(res.statsRes);
          const prev = dispatcherDashboardCache.get(cacheKey);
          dispatcherDashboardCache.set(cacheKey, {
            userOrders: res.userOrders,
            statsRes: res.statsRes,
            leaveReassignments: prev?.leaveReassignments || [],
            updatedAt: Date.now()
          });
        }
      } catch (err) {
        if (!ignore) {
          console.error('DispatcherDashboard init error:', err);
          message.error('Không thể tải số liệu điều phối từ máy chủ.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    initLoad();
    return () => {
      ignore = true;
    };
  }, [fetchAllData, cacheKey]);

  const handleManualRefresh = async () => {
    if (orders.length === 0 && !dbStats) {
      setLoading(true);
    }
    setRefreshing(true);
    dispatcherApi
      .getLeaveReassignments({ refresh: true })
      .then((leaveRes) => {
        const items = leaveRes?.reassignments || [];
        setLeaveReassignments(items);
        const cur = dispatcherDashboardCache.get(cacheKey);
        if (cur) {
          dispatcherDashboardCache.set(cacheKey, { ...cur, leaveReassignments: items });
        }
      })
      .catch(() => {});

    try {
      const res = await fetchAllData({ refresh: true });
      setOrders(res.userOrders);
      setDbStats(res.statsRes);
      const prev = dispatcherDashboardCache.get(cacheKey);
      dispatcherDashboardCache.set(cacheKey, {
        userOrders: res.userOrders,
        statsRes: res.statsRes,
        leaveReassignments: prev?.leaveReassignments || [],
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('DispatcherDashboard refresh error:', err);
      message.error('Không thể làm mới dữ liệu điều phối.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMonthChange = (date) => {
    if (!date) return;
    setSelectedMonth(date);
    setPeriodMode('MONTH');
  };

  const displayPeriod =
    periodMode === 'ALL' ? 'Tất cả thời gian' : `Tháng ${selectedMonth.format('MM/YYYY')}`;

  const periodOrders = useMemo(() => {
    if (periodMode === 'ALL') return orders;
    const targetKey = selectedMonth.format('YYYY-MM');
    return orders.filter((o) => {
      const ts = resolveOrderTimestamp(o);
      return ts ? ts.format('YYYY-MM') === targetKey : false;
    });
  }, [orders, periodMode, selectedMonth]);

  const computed = useMemo(() => {
    const activeOrders = periodOrders.filter((o) => !isOrderCancelled(o));
    const totalRevenue = periodOrders.reduce((sum, o) => {
      if (isOrderCancelled(o)) {
        return sum + (Number(o.cancel_fee) || Number(o.cancellation_fee) || 0);
      }
      if (o.status === 'DRAFT') return sum;
      return sum + (Number(o.agreed_price) || 0);
    }, 0);

    const readyCount = activeOrders.filter((o) => o.status === 'READY_FOR_PLANNING').length;
    const draftCount = activeOrders.filter((o) => o.status === 'DRAFT').length;
    const confirmedCount = activeOrders.filter((o) => o.status === 'CONFIRMED').length;
    const deliveredCount = activeOrders.filter(
      (o) => o.status === 'DELIVERED' || o.status === 'CLOSED'
    ).length;
    const dispatchedCount = activeOrders.filter((o) =>
      [
        'ASSIGNED',
        'ACCEPTED',
        'PICKED_UP',
        'IN_TRANSIT',
        'HANDED_OVER_VENDOR',
        'DELIVERED',
        'DELIVERED_EXCEPTION',
        'CLOSED'
      ].includes(o.status)
    ).length;

    const totalWeightKg = activeOrders.reduce(
      (sum, o) => sum + (Number(o.chargeable) || Number(o.weight) || 0),
      0
    );

    const totalTrucks = Number(dbStats?.total_trucks || 0);
    const availableTrucks = Number(dbStats?.available_trucks || 0);
    const activeTripsCount = Number(dbStats?.active_trips || 0);

    const incidentsList = Array.isArray(dbStats?.incidentsSummary)
      ? dbStats.incidentsSummary
      : [];

    const openIncidentsCount =
      incidentsList.length > 0
        ? incidentsList.filter(
            (inc) => !['RESOLVED', 'DONE', 'CLOSED'].includes(String(inc.status || '').toUpperCase())
          ).length
        : Number(dbStats?.open_incidents || 0);

    const fleetReadyPercent =
      totalTrucks > 0 ? Math.round((availableTrucks / totalTrucks) * 100) : 0;
    const dispatchedPercent =
      activeOrders.length > 0 ? Math.round((dispatchedCount / activeOrders.length) * 100) : 0;
    const deliveredRatePercent =
      activeOrders.length > 0 ? Math.round((deliveredCount / activeOrders.length) * 100) : 0;

    const revenueFormatted =
      totalRevenue >= 1_000_000
        ? `${(totalRevenue / 1_000_000).toFixed(1).replace('.', ',')} tr`
        : `${totalRevenue.toLocaleString('vi-VN')} đ`;

    // Pipeline counts by Figure 20 uppercase statuses
    const pipelineOrder = [
      'DRAFT',
      'CONFIRMED',
      'READY_FOR_PLANNING',
      'ASSIGNED',
      'ACCEPTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERED',
      'CLOSED',
      'CANCELLED'
    ];
    const pipelineCounts = pipelineOrder
      .map((st) => ({
        status: st,
        label: STATUS_META[st]?.label || st,
        color: STATUS_META[st]?.barColor || '#2563EB',
        count: periodOrders.filter((o) => o.status === st).length
      }))
      .filter((item) => item.count > 0 || ['READY_FOR_PLANNING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(item.status));

    // Hub volume counts
    const hubMap = new Map();
    activeOrders.forEach((o) => {
      const hub = getCleanShortName(o.pickup, 'Kho ALS');
      const prev = hubMap.get(hub) || { hubName: hub, count: 0, weightKg: 0 };
      prev.count += 1;
      prev.weightKg += Number(o.chargeable) || Number(o.weight) || 0;
      hubMap.set(hub, prev);
    });
    const hubChartData = Array.from(hubMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Incident donut (dữ liệu từ dbStats.incidentsSummary, không cần gọi /incidents 368KB)
    const incMap = new Map();
    incidentsList.forEach((inc) => {
      const key = String(inc.type || 'OTHER').toUpperCase();
      const meta = INCIDENT_TYPE_LABELS[key] || { label: inc.type || 'Khác', color: '#64748B' };
      const existing = incMap.get(meta.label) || { label: meta.label, color: meta.color, count: 0 };
      existing.count += 1;
      incMap.set(meta.label, existing);
    });
    const incidentsChart = Array.from(incMap.values());

    // Revenue & Orders trend chart
    let trendBuckets = [];
    if (periodMode === 'ALL') {
      const nowYear = dayjs().year();
      const monthsMap = Array.from({ length: 12 }, (_, idx) => ({
        label: `T${idx + 1}`,
        revenue: 0,
        orders: 0
      }));
      periodOrders.forEach((o) => {
        const ts = resolveOrderTimestamp(o);
        if (!ts) return;
        const mIdx = ts.month();
        if (ts.year() === nowYear && monthsMap[mIdx]) {
          monthsMap[mIdx].orders += 1;
          monthsMap[mIdx].revenue += isOrderCancelled(o)
            ? Number(o.cancel_fee) || Number(o.cancellation_fee) || 0
            : o.status === 'DRAFT'
              ? 0
              : Number(o.agreed_price) || 0;
        }
      });
      const nonEmpty = monthsMap.filter((b) => b.orders > 0 || b.revenue > 0);
      trendBuckets = nonEmpty.length > 0 ? monthsMap : monthsMap.slice(6);
    } else {
      const daysInMonth = selectedMonth.daysInMonth();
      const ranges = [
        { label: '01-05', start: 1, end: 5 },
        { label: '06-10', start: 6, end: 10 },
        { label: '11-15', start: 11, end: 15 },
        { label: '16-20', start: 16, end: 20 },
        { label: '21-25', start: 21, end: 25 },
        { label: `26-${daysInMonth}`, start: 26, end: daysInMonth }
      ];
      trendBuckets = ranges.map((r) => {
        let rev = 0;
        let cnt = 0;
        periodOrders.forEach((o) => {
          const ts = resolveOrderTimestamp(o);
          if (!ts) return;
          const d = ts.date();
          if (d >= r.start && d <= r.end) {
            cnt += 1;
            rev += isOrderCancelled(o)
              ? Number(o.cancel_fee) || Number(o.cancellation_fee) || 0
              : o.status === 'DRAFT'
                ? 0
                : Number(o.agreed_price) || 0;
          }
        });
        return { label: r.label, revenue: rev, orders: cnt };
      });
    }

    return {
      totalOrders: activeOrders.length,
      totalAllOrders: periodOrders.length,
      totalRevenue,
      revenueFormatted,
      readyCount,
      draftCount,
      confirmedCount,
      deliveredCount,
      totalWeightKg,
      totalTrucks,
      availableTrucks,
      activeTripsCount,
      openIncidentsCount,
      fleetReadyPercent,
      dispatchedPercent,
      deliveredRatePercent,
      pipelineCounts,
      hubChartData,
      incidentsChart,
      trendBuckets
    };
  }, [periodOrders, dbStats, periodMode, selectedMonth]);

  const queueOrders = useMemo(
    () =>
      orders.filter((o) =>
        ['DRAFT', 'CONFIRMED', 'READY_FOR_PLANNING'].includes(o.status)
      ),
    [orders]
  );

  const handleCreateOrder = async (values) => {
    try {
      await orderApi.createDirectOrder(values);
      setIsModalOpen(false);
      await handleManualRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-5 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* 1. Global Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/30">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              Trung tâm Điều phối Vận tải
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Hybrid BI Dispatch
            </span>
          </div>
          <p className="text-xs text-on-surface-variant max-w-2xl">
            Theo dõi đơn hàng, hiệu suất sẵn sàng đội xe, tiến độ giao vận và xử lý cảnh báo điều phối theo thời gian thực.
          </p>
        </div>

        {/* Global Filter & Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setPeriodMode('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              periodMode === 'ALL'
                ? 'bg-primary text-on-primary border-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-container'
            }`}
          >
            Tất cả
          </button>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${
              periodMode === 'MONTH'
                ? 'bg-primary/10 border-primary/40'
                : 'bg-surface-container-low border-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              calendar_month
            </span>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              format="[Tháng] MM/YYYY"
              allowClear={false}
              className="bg-transparent border-none text-xs font-bold text-primary shadow-none cursor-pointer p-0"
              style={{ width: 135 }}
            />
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
            type="button"
            title="Làm mới dữ liệu từ Database"
          >
            <span className={`material-symbols-outlined text-[16px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
            <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>Tạo đơn vận chuyển</span>
          </button>
        </div>
      </div>

      {/* Alert Banner nếu có tài xế nghỉ phép đột xuất */}
      {leaveReassignments.length > 0 && (
        <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-orange-950 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-orange-600 text-[20px] shrink-0">
              warning
            </span>
            <div>
              <div className="font-bold text-sm">
                Cần đổi tài xế (Re-assign): Có {leaveReassignments.length} chuyến xe có tài xế được Quản lý duyệt nghỉ đột xuất
              </div>
              <div className="text-orange-800 mt-0.5">
                Chuyến: {leaveReassignments.map((r) => r.trip_code).join(', ')}
              </div>
            </div>
          </div>
          <Link
            href="/dispatcher/trips"
            className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs no-underline transition-colors"
          >
            <span>Đi tới Đổi tài xế</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* 2. Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">query_stats</span>
          <span>Tổng quan điều phối</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('QUEUE')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'QUEUE'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">local_shipping</span>
          <span>Hàng đợi xếp xe &amp; Đội xe ({queueOrders.length})</span>
        </button>
      </div>

      {/* TAB 1: TỔNG QUAN (HYBRID BI DASHBOARD) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-5">
          {loading ? (
            <div className="py-20 flex flex-col justify-center items-center gap-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
              <Spin size="large" />
              <span className="text-xs text-on-surface-variant font-medium">
                Đang tổng hợp số liệu điều phối...
              </span>
            </div>
          ) : (
            <>
              <DispatcherKpiCards computed={computed} displayPeriod={displayPeriod} />

              <DispatcherAnalyticsCharts
                computed={computed}
                periodMode={periodMode}
                displayPeriod={displayPeriod}
              />

              <DispatcherOverviewBottomSection
                orders={orders}
                periodOrders={periodOrders}
                loading={loading}
                statusMeta={STATUS_META}
                onOpenCreateModal={() => setIsModalOpen(true)}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 2: HÀNG ĐỢI XẾP XE & ĐỘI XE */}
      {activeTab === 'QUEUE' && (
        <DispatcherQueueSection
          queueOrders={queueOrders}
          computed={computed}
          loading={loading}
          statusMeta={STATUS_META}
        />
      )}

      <OrderFormModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrder}
      />
    </div>
  );
}
