"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spin, message, Tag, DatePicker, Table } from 'antd';
import dayjs from 'dayjs';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';
import { useAuth } from '../../providers/AuthProvider';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
const OrderFormModal = dynamic(
  () => import('../../components/dispatcher/OrderFormModal'),
  { ssr: false }
);

function AnimatedCounter({ value, suffix = '', prefix = '', duration = 750 }) {
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
  const router = useRouter();
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
      orderApi.getAllOrders().catch(() => []),
      dispatcherApi.getDashboardStats({ refresh }).catch(() => null),
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
        if (ts.year() === nowYear || monthsMap[mIdx]) {
          monthsMap[mIdx].orders += 1;
          monthsMap[mIdx].revenue += isOrderCancelled(o)
            ? Number(o.cancel_fee) || Number(o.cancellation_fee) || 0
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

  const getGaugeOptions = (label, color, subLabel) => ({
    chart: {
      type: 'radialBar',
      offsetY: -5,
      sparkline: { enabled: true },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 900
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
    fill: { colors: [color] },
    labels: [label],
    tooltip: {
      enabled: true,
      y: { formatter: (val) => `${val}% (${subLabel})` }
    }
  });

  const fleetReadyColor =
    computed.fleetReadyPercent >= 40
      ? '#10B981'
      : computed.fleetReadyPercent >= 15
        ? '#F59E0B'
        : '#EF4444';

  const pipelineChartOptions = useMemo(() => {
    const list = computed.pipelineCounts;
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit'
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '55%',
          distributed: true,
          borderRadius: 6
        }
      },
      colors: list.map((item) => item.color),
      xaxis: {
        categories: list.map((item) => item.label),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: {
        labels: { maxWidth: 165, style: { fontSize: '11px', fontWeight: 600 } }
      },
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 700 }
      },
      tooltip: {
        y: { formatter: (val) => `${val} đơn` }
      }
    };
  }, [computed.pipelineCounts]);

  const pipelineSeries = useMemo(
    () => [
      {
        name: 'Số lượng đơn',
        data: computed.pipelineCounts.map((i) => i.count)
      }
    ],
    [computed.pipelineCounts]
  );

  const hubChartOptions = useMemo(() => {
    const list = computed.hubChartData;
    return {
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: {
        bar: { columnWidth: '45%', borderRadius: 6, distributed: true }
      },
      colors: ['#2563EB', '#0EA5E9', '#10B981', '#6366F1', '#F59E0B'],
      xaxis: {
        categories: list.map((item) => item.hubName),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: {
        title: { text: 'Số đơn lấy hàng', style: { fontSize: '11px' } }
      },
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 800 }
      },
      tooltip: {
        y: {
          formatter: (val, { dataPointIndex }) => {
            const w = list[dataPointIndex]?.weightKg || 0;
            return `${val} đơn · ${Math.round(w).toLocaleString('vi-VN')} kg`;
          }
        }
      }
    };
  }, [computed.hubChartData]);

  const hubSeries = useMemo(
    () => [
      {
        name: 'Số đơn',
        data: computed.hubChartData.map((item) => item.count)
      }
    ],
    [computed.hubChartData]
  );

  const incidentsDonutOptions = useMemo(() => {
    const list = computed.incidentsChart;
    return {
      chart: {
        type: 'donut',
        fontFamily: 'inherit',
        events: {
          dataPointSelection: () => {
            router.push('/dispatcher/incidents');
          }
        }
      },
      labels: list.map((item) => item.label),
      colors: list.map((item) => item.color),
      legend: { position: 'bottom', fontSize: '11px', fontWeight: 600 },
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
        y: { formatter: (val) => `${val} vụ (Bấm để xem chi tiết)` }
      }
    };
  }, [computed.incidentsChart, router]);

  const incidentsDonutSeries = useMemo(
    () => computed.incidentsChart.map((i) => i.count),
    [computed.incidentsChart]
  );

  const trendOptions = useMemo(() => {
    const list = computed.trendBuckets;
    return {
      chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit' },
      stroke: { width: [0, 3], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: '38%', borderRadius: 4 } },
      colors: ['#2563EB', '#10B981'],
      xaxis: {
        categories: list.map((item) => item.label),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: [
        {
          title: { text: 'Doanh thu', style: { color: '#2563EB', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${(val / 1_000_000).toFixed(0)} tr`,
            style: { fontSize: '10px' }
          }
        },
        {
          opposite: true,
          title: { text: 'Số lượng đơn', style: { color: '#10B981', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${Math.round(val)}`,
            style: { fontSize: '10px' }
          }
        }
      ],
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600 }
    };
  }, [computed.trendBuckets]);

  const trendSeries = useMemo(
    () => [
      {
        name: 'Doanh thu (VNĐ)',
        type: 'column',
        data: computed.trendBuckets.map((i) => i.revenue)
      },
      {
        name: 'Số lượng đơn',
        type: 'line',
        data: computed.trendBuckets.map((i) => i.orders)
      }
    ],
    [computed.trendBuckets]
  );

  const recentActivities = useMemo(() => {
    if (orders.length === 0) {
      return [
        {
          id: 'empty',
          title: 'Hệ thống sẵn sàng tiếp nhận vận đơn mới',
          time: 'Hiện tại',
          icon: 'check_circle',
          color: 'text-emerald-600'
        }
      ];
    }
    return orders.slice(0, 6).map((o, idx) => {
      const meta = STATUS_META[o.status] || { label: o.status, color: 'default' };
      return {
        id: o.id || idx,
        title: `Đơn ${o.order_id} (${o.customer || 'Khách lẻ'}): ${meta.label}`,
        time: o.date || 'Gần đây',
        icon: o.status === 'DELIVERED' || o.status === 'CLOSED' ? 'task_alt' : 'local_shipping',
        color:
          o.status === 'CANCELLED'
            ? 'text-error'
            : o.status === 'DELIVERED' || o.status === 'CLOSED'
              ? 'text-emerald-600'
              : 'text-secondary'
      };
    });
  }, [orders]);

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

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 120,
      render: (text) => (
        <span className="font-bold text-primary font-mono text-xs">{text}</span>
      )
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      key: 'customer',
      ellipsis: true,
      render: (text) => (
        <span className="font-medium text-on-surface text-xs truncate block" title={text}>
          {text || 'Khách hàng'}
        </span>
      )
    },
    {
      title: 'Tuyến đường',
      dataIndex: 'route',
      key: 'route',
      ellipsis: true,
      render: (text) => (
        <span className="text-on-surface-variant text-xs truncate block" title={text}>
          {text}
        </span>
      )
    },
    {
      title: 'Giá cước',
      dataIndex: 'agreed_price',
      key: 'agreed_price',
      width: 130,
      align: 'right',
      render: (price) => (
        <span className="font-bold text-emerald-600 text-xs whitespace-nowrap">
          {Number(price) > 0 ? `${Number(price).toLocaleString('vi-VN')} đ` : 'Chờ báo giá'}
        </span>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 135,
      align: 'center',
      render: (status) => {
        const meta = STATUS_META[status] || { label: status, color: 'default' };
        return (
          <Tag
            color={meta.color}
            className="m-0 text-[11px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
          >
            {meta.label}
          </Tag>
        );
      }
    }
  ];

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
              {/* TẦNG 1: 6 THẺ KPI CỐT LÕI */}
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

              {/* TẦNG 2: 3 RADIAL GAUGES */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    Chỉ số Sẵn sàng Đội xe &amp; Nhịp độ Điều phối (Radial Gauges)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Gauge 1: Đội xe sẵn sàng */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
                    <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
                      <span>Xe sẵn sàng nhận chuyến</span>
                      <Tag
                        color={
                          computed.fleetReadyPercent >= 40
                            ? 'green'
                            : computed.fleetReadyPercent >= 15
                              ? 'gold'
                              : 'red'
                        }
                      >
                        {computed.fleetReadyPercent >= 40
                          ? 'Đủ xe'
                          : computed.fleetReadyPercent >= 15
                            ? 'Cân đối'
                            : 'Thiếu xe'}
                      </Tag>
                    </div>
                    <div className="my-2 w-full flex justify-center">
                      <Chart
                        key={`gauge-fleet-${computed.availableTrucks}-${computed.totalTrucks}`}
                        options={getGaugeOptions('Xe sẵn sàng', fleetReadyColor, 'Xe Available ÷ Tổng đội xe')}
                        series={[computed.fleetReadyPercent]}
                        type="radialBar"
                        height={180}
                        width="100%"
                      />
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium">
                      Hiện có {computed.availableTrucks} / {computed.totalTrucks} xe tải sẵn sàng
                    </div>
                  </div>

                  {/* Gauge 2: Tiến độ đã điều phối */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
                    <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
                      <span>Tỷ lệ đơn đã điều xe</span>
                      <Tag color="blue">
                        {computed.dispatchedPercent >= 70 ? 'Nhanh chóng' : 'Cần xếp thêm'}
                      </Tag>
                    </div>
                    <div className="my-2 w-full flex justify-center">
                      <Chart
                        key={`gauge-dispatch-${periodMode}-${computed.dispatchedPercent}`}
                        options={getGaugeOptions('Đã gán xe', '#2563EB', 'Đơn đã gán ÷ Tổng đơn hợp lệ')}
                        series={[computed.dispatchedPercent]}
                        type="radialBar"
                        height={180}
                        width="100%"
                      />
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium">
                      {computed.readyCount} đơn sẵn sàng · {computed.confirmedCount} đơn chờ chứng từ
                    </div>
                  </div>

                  {/* Gauge 3: Tỷ lệ giao hoàn tất */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
                    <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
                      <span>Tỷ lệ giao hoàn tất</span>
                      <Tag color={computed.deliveredRatePercent >= 60 ? 'green' : 'blue'}>
                        {computed.deliveredRatePercent >= 60 ? 'Hiệu quả' : 'Đang vận hành'}
                      </Tag>
                    </div>
                    <div className="my-2 w-full flex justify-center">
                      <Chart
                        key={`gauge-delivered-${periodMode}-${computed.deliveredRatePercent}`}
                        options={getGaugeOptions('Hoàn tất', '#10B981', 'Delivered & Closed ÷ Tổng đơn')}
                        series={[computed.deliveredRatePercent]}
                        type="radialBar"
                        height={180}
                        width="100%"
                      />
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium">
                      {computed.deliveredCount} đơn giao thành công trong kỳ
                    </div>
                  </div>
                </div>
              </div>

              {/* TẦNG 3: PHÂN BỐ TRẠNG THÁI & SẢN LƯỢNG THEO KHO */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Phân tích Tiến độ Đơn hàng &amp; Lưu lượng Kho bãi
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Chart 1: Pipeline trạng thái */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-primary">
                          Phân bố Đơn hàng theo Trạng thái (Pipeline)
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Số lượng đơn thực tế trên từng bước quy trình vận tải ALS.
                        </p>
                      </div>
                      <Link
                        href="/dispatcher/orders"
                        className="text-xs text-secondary font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span>Quản lý đơn</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>

                    {computed.pipelineCounts.length > 0 ? (
                      <div className="w-full">
                        <Chart
                          key={`pipeline-${periodMode}-${computed.totalAllOrders}`}
                          options={pipelineChartOptions}
                          series={pipelineSeries}
                          type="bar"
                          height={240}
                          width="100%"
                        />
                      </div>
                    ) : (
                      <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                        Chưa có dữ liệu đơn hàng trong kỳ {displayPeriod}
                      </div>
                    )}
                  </div>

                  {/* Chart 2: Sản lượng theo kho lấy */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-primary">
                          Top Kho / Điểm lấy hàng nhiều đơn nhất
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Thống kê số lượng đơn và tổng tải trọng tại các điểm xuất phát chính.
                        </p>
                      </div>
                      <Tag color="blue" className="font-bold">
                        Top {computed.hubChartData.length} điểm
                      </Tag>
                    </div>

                    {computed.hubChartData.length > 0 ? (
                      <div className="w-full">
                        <Chart
                          key={`hubs-${periodMode}-${computed.hubChartData.length}`}
                          options={hubChartOptions}
                          series={hubSeries}
                          type="bar"
                          height={240}
                          width="100%"
                        />
                      </div>
                    ) : (
                      <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                        Chưa có dữ liệu kho bãi trong kỳ {displayPeriod}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TẦNG 4: RỦI RO SỰ CỐ & XU HƯỚNG DOANH THU */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-error"></span>
                    Giám sát Sự cố Hiện trường &amp; Xu hướng Sản lượng
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Donut Chart: Sự cố theo loại */}
                  <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-extrabold text-primary">
                        Sự cố theo loại (Incidents)
                      </h4>
                      <Link
                        href="/dispatcher/incidents"
                        className="text-xs text-secondary font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span>Chi tiết</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mb-2">
                      Bấm lát cắt để mở trang quản lý sự cố.
                    </p>

                    {computed.incidentsChart.length > 0 ? (
                      <div className="w-full flex justify-center my-1">
                        <Chart
                          key={`incidents-disp-${computed.incidentsChart.length}-${computed.openIncidentsCount}`}
                          options={incidentsDonutOptions}
                          series={incidentsDonutSeries}
                          type="donut"
                          height={235}
                          width="100%"
                        />
                      </div>
                    ) : (
                      <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                        <span className="material-symbols-outlined text-[32px] text-emerald-500 mb-1 block">
                          verified_user
                        </span>
                        Không có sự cố vận tải nào được ghi nhận
                      </div>
                    )}

                    <div className="text-[11px] text-center text-on-surface-variant font-medium pt-2 border-t border-surface-container">
                      Tổng hợp từ báo cáo tài xế và chuyến đang chạy
                    </div>
                  </div>

                  {/* Composed Chart: Xu hướng doanh thu & đơn */}
                  <div className="lg:col-span-2 p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h4 className="text-sm font-extrabold text-primary">
                          Xu hướng Doanh thu &amp; Số lượng Đơn hàng
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Biến động cước chốt và lượng đơn tiếp nhận trong {displayPeriod}.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        <span className="material-symbols-outlined text-[14px]">insights</span>
                        Doanh thu &amp; Sản lượng
                      </span>
                    </div>

                    <div className="w-full">
                      <Chart
                        key={`trend-disp-${periodMode}-${computed.totalAllOrders}`}
                        options={trendOptions}
                        series={trendSeries}
                        type="line"
                        height={240}
                        width="100%"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
                      <span>Cột xanh: Giá cước thực tế (VNĐ)</span>
                      <span>Đường xanh lá: Số đơn phát sinh</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TẦNG 5: ĐƠN HÀNG GẦN ĐÂY & HOẠT ĐỘNG ĐIỀU PHỐI */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/30">
                  <div className="mb-4 pb-3 border-b border-surface-container flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-primary">
                        Đơn hàng gần đây ({periodOrders.length})
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        Danh sách vận đơn thuộc phạm vi điều phối trong kỳ
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/dispatcher/orders"
                        className="px-3 py-1.5 rounded-lg bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors"
                      >
                        Xem tất cả
                      </Link>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">add</span>
                        <span>Tạo đơn</span>
                      </button>
                    </div>
                  </div>
                  <Table
                    columns={columns}
                    dataSource={periodOrders}
                    rowKey={(record) => record.id || record.order_id}
                    loading={loading}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                </div>

                <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-container">
                      <h3 className="text-sm font-extrabold text-primary">
                        Hoạt động Vận hành Gần đây
                      </h3>
                      <Link
                        href="/dispatcher/trips"
                        className="text-xs text-secondary font-bold hover:underline"
                      >
                        Lập chuyến &rarr;
                      </Link>
                    </div>
                    <div className="space-y-3.5">
                      {recentActivities.map((feed) => (
                        <div key={feed.id} className="flex gap-3 items-start">
                          <span
                            className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${feed.color}`}
                          >
                            {feed.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-on-surface leading-snug">
                              {feed.title}
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                              {feed.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>Đồng bộ trực tiếp từ PostgreSQL</span>
                    <span className="font-bold text-primary">ALS Dispatch</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: HÀNG ĐỢI XẾP XE & ĐỘI XE */}
      {activeTab === 'QUEUE' && (
        <div className="space-y-5">
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-container pb-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-black text-primary tracking-tight">
                    Đơn hàng đang chờ Xử lý &amp; Xếp xe
                  </h3>
                  <Tag color="cyan" className="font-bold">
                    Sẵn sàng xếp xe: {computed.readyCount}
                  </Tag>
                  <Tag color="green" className="font-bold">
                    Xe trống: {computed.availableTrucks}/{computed.totalTrucks}
                  </Tag>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Các đơn ở trạng thái Nháp, Đã xác nhận hoặc Sẵn sàng lập chuyến để ghép vào xe tải.
                </p>
              </div>
              <Link
                href="/dispatcher/trips"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">alt_route</span>
                <span>Đi tới Lập chuyến &amp; Gán xe</span>
              </Link>
            </div>

            <Table
              columns={columns}
              dataSource={queueOrders}
              rowKey={(record) => record.id || record.order_id}
              loading={loading}
              pagination={{ pageSize: 8 }}
              size="small"
            />
          </div>
        </div>
      )}

      <OrderFormModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrder}
      />
    </div>
  );
}
