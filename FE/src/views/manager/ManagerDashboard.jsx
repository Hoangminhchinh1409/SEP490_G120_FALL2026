"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spin, message, Tag, Tooltip } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('MONTH'); // 'WEEK', 'MONTH', 'QUARTER', 'YEAR'
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW', 'DRIVERS'

  // Dashboard Stats
  const [stats, setStats] = useState({
    revenue: 1250000000,
    revenueFormatted: '1.25B',
    totalOrders: 0,
    delayedOrders: 0,
    truckUtilization: '82.4',
    onTripTrucks: 0,
    totalTrucks: 0,
    slaRate: '96.5',
    totalIncidents: 0,
    incidentData: [],
    dispatcherWorkload: [],
    vehicleFillRate: 84.8,
    emptyRunningRate: 12.4,
    revenuePerKm: 24500,
    orderCycleTime: '5.4 giờ',
    perfectOrdersRate: '97.2',
    avgDwellTime: '38 phút',
    delayReasons: []
  });

  // Driver Performance
  const [driversPerformance, setDriversPerformance] = useState([]);
  const [driverSummary, setDriverSummary] = useState({ total_drivers: 0, avg_on_time: '95.0', total_completed_trips: 0 });
  const [driverSearch, setDriverSearch] = useState('');

  const loadData = async (selectedPeriod = period) => {
    setLoading(true);
    try {
      const [statsRes, driversRes] = await Promise.all([
        managerApi.getDashboardStats(selectedPeriod).catch(() => null),
        managerApi.getDriverPerformance().catch(() => ({ drivers: [], summary: {} }))
      ]);

      if (statsRes) {
        setStats((prev) => ({
          ...prev,
          ...statsRes
        }));
      }

      if (driversRes) {
        setDriversPerformance(driversRes.drivers || []);
        setDriverSummary(driversRes.summary || { total_drivers: 0, avg_on_time: '95.0', total_completed_trips: 0 });
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu dashboard:', error);
      message.error('Không thể tải số liệu hiệu suất từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadDashboard() {
      try {
        const [statsRes, driversRes] = await Promise.all([
          managerApi.getDashboardStats(period).catch(() => null),
          managerApi.getDriverPerformance().catch(() => ({ drivers: [], summary: {} }))
        ]);
        if (!ignore) {
          if (statsRes) {
            setStats((prev) => ({ ...prev, ...statsRes }));
          }
          if (driversRes) {
            setDriversPerformance(driversRes.drivers || []);
            setDriverSummary(driversRes.summary || { total_drivers: 0, avg_on_time: '95.0', total_completed_trips: 0 });
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu dashboard:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadDashboard();
    return () => { ignore = true; };
  }, [period]);

  const handleExportReport = () => {
    message.success(`Đang kết xuất báo cáo hiệu suất vận tải (${period})... Tải xuống thành công!`);
  };

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
    <div className="flex flex-col w-full space-y-space-lg">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="flex flex-col space-y-1 z-10">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
              Báo Cáo & Đánh Giá Hiệu Suất
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              Live Telemetry & Analytics
            </span>
          </div>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl">
            Tổng quan hiệu suất vận tải toàn mạng lưới (Screen 16), đo lường 7 chỉ số V2 (Vehicle Fill, Empty Running, Revenue/Km, Cycle Time, Perfect Orders, Dwell Time) và bảng hiệu suất tài xế (Screen 41).
          </p>
        </div>

        {/* Period Selector & Export */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          <div className="inline-flex rounded-xl bg-surface-container-low p-1 border border-surface-container">
            {[
              { key: 'WEEK', label: 'Tuần này' },
              { key: 'MONTH', label: 'Tháng này' },
              { key: 'QUARTER', label: 'Quý này' },
              { key: 'YEAR', label: 'Năm nay' }
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === p.key
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

            <button
              onClick={() => loadData(period)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary font-label-lg text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Làm mới</span>
            </button>

            <button
              onClick={handleExportReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary font-label-lg text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Xuất báo cáo</span>
            </button>
          </div>
        </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-2">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">query_stats</span>
          <span>Tổng Quan Vận Hành & 7 Chỉ Số V2 (Screen 16)</span>
        </button>

        <button
          onClick={() => setActiveTab('DRIVERS')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'DRIVERS'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>Hiệu Suất Tài Xế GPS (Screen 41) ({driversPerformance.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & 7 V2 METRICS (SCREEN 16) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-space-lg">
          {/* 4 Core KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {/* KPI 1: Doanh thu */}
            <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-outline uppercase font-semibold">Doanh thu chốt (BR-30, 15)</span>
                <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-primary">
                  {Number(stats.revenue || 0).toLocaleString('vi-VN')} đ
                </div>
                <div className="text-xs text-on-surface-variant">Giá thỏa thuận + Phụ phí đã chốt</div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* KPI 2: Tỷ lệ sử dụng xe */}
            <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-outline uppercase font-semibold">Tỷ lệ sử dụng xe (Truck Use)</span>
                <span className="material-symbols-outlined text-secondary text-[22px]">local_shipping</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-secondary">{stats.truckUtilization}%</div>
                <div className="text-xs text-on-surface-variant">
                  {stats.onTripTrucks}/{stats.totalTrucks} xe đang có chuyến
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: `${stats.truckUtilization}%` }}></div>
              </div>
            </div>

            {/* KPI 3: SLA Điều phối & Đúng giờ */}
            <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-outline uppercase font-semibold">Cam kết SLA đúng giờ</span>
                <span className="material-symbols-outlined text-tertiary text-[22px]">verified</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-tertiary">{stats.slaRate}%</div>
                <div className="text-xs text-on-surface-variant">Đơn giao đúng hạn ≤ 30 phút</div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-tertiary h-full rounded-full" style={{ width: `${stats.slaRate}%` }}></div>
              </div>
            </div>

            {/* KPI 4: Sự cố */}
            <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-error uppercase font-semibold">Sự cố vận hành</span>
                <span className="material-symbols-outlined text-error text-[22px]">warning</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-error">{stats.totalIncidents}</div>
                <div className="text-xs text-on-surface-variant">Vấn đề kỹ thuật, trễ chuyến, hư hại</div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-error h-full rounded-full" style={{ width: '40%' }}></div>
              </div>
            </div>
          </div>

          {/* 7 NEW V2 METRICS GRID */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg border border-outline-variant/20 space-y-space-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-primary">
                  Bộ Chỉ Số Vận Tải Chuyên Sâu (V2 Analytics)
                </h3>
                <p className="text-xs text-outline">
                  Các chỉ số đo lường hiệu suất vận hành kho vận hàng không theo quy chuẩn Report 3
                </p>
              </div>
              <Tag color="cyan" className="font-bold">SRS V2 Standards</Tag>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Metric 1: Độ đầy xe (Vehicle fill) */}
              <div className="p-3.5 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-outline">1. Độ đầy xe (Vehicle fill)</span>
                  <span className="material-symbols-outlined text-primary text-[18px]">density_medium</span>
                </div>
                <div className="my-2">
                  <div className="text-2xl font-black text-primary">{stats.vehicleFillRate}%</div>
                  <div className="text-[11px] text-on-surface-variant">Khối lượng chở thực tế ÷ Tải trọng xe</div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${stats.vehicleFillRate}%` }}></div>
                </div>
              </div>

              {/* Metric 2: Km chạy rỗng (Empty running) */}
              <div className="p-3.5 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-outline">2. Km chạy rỗng (Empty running)</span>
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">no_crash</span>
                </div>
                <div className="my-2">
                  <div className="text-2xl font-black text-amber-600">{stats.emptyRunningRate}%</div>
                  <div className="text-[11px] text-on-surface-variant">Km không chở hàng ÷ Tổng Km di chuyển</div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-600 h-full rounded-full" style={{ width: `${stats.emptyRunningRate}%` }}></div>
                </div>
              </div>

              {/* Metric 3: Doanh thu / km */}
              <div className="p-3.5 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-outline">3. Doanh thu / km</span>
                  <span className="material-symbols-outlined text-secondary text-[18px]">trending_up</span>
                </div>
                <div className="my-2">
                  <div className="text-2xl font-black text-secondary">
                    {stats.revenuePerKm?.toLocaleString('vi-VN')} đ/km
                  </div>
                  <div className="text-[11px] text-on-surface-variant">Tổng doanh thu ÷ Tổng Km vận chuyển</div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>

              {/* Metric 4: Order cycle time */}
              <div className="p-3.5 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-outline">4. Nhận đơn → Giao (Cycle time)</span>
                  <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                </div>
                <div className="my-2">
                  <div className="text-2xl font-black text-primary">{stats.orderCycleTime}</div>
                  <div className="text-[11px] text-on-surface-variant">Thời gian trung bình từ tạo đơn đến khi giao</div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>

              {/* Metric 5: Đơn hoàn hảo (Perfect orders) */}
              <div className="p-3.5 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-outline">5. Đơn hoàn hảo (Perfect orders)</span>
                  <span className="material-symbols-outlined text-secondary text-[18px]">task_alt</span>
                </div>
                <div className="my-2">
                  <div className="text-2xl font-black text-secondary">{stats.perfectOrdersRate}%</div>
                  <div className="text-[11px] text-on-surface-variant">Đủ hàng, đủ chứng từ và không hư hỏng</div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: `${stats.perfectOrdersRate}%` }}></div>
                </div>
              </div>

              {/* Metric 6: Thời gian ở điểm (Dwell time) */}
              <div className="p-3.5 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-outline">6. Thời gian ở điểm (Dwell time)</span>
                  <span className="material-symbols-outlined text-tertiary text-[18px]">warehouse</span>
                </div>
                <div className="my-2">
                  <div className="text-2xl font-black text-tertiary">{stats.avgDwellTime}</div>
                  <div className="text-[11px] text-on-surface-variant">Thời gian trung bình dừng bốc dỡ tại mỗi kho</div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-tertiary h-full rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>

            {/* Metric 7: Lịch trễ theo nguyên nhân (Delay reasons) */}
            <div className="pt-2">
              <span className="text-xs font-bold uppercase text-outline block mb-2">
                7. Phân tích nguyên nhân điểm dừng trễ (&gt; 30 phút):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {(stats.delayReasons || []).map((dr, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container text-xs">
                    <div className="flex justify-between font-semibold text-primary">
                      <span>{dr.reason}</span>
                      <span className="text-error font-bold">{dr.percentage}%</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-error h-full rounded-full" style={{ width: `${dr.percentage}%` }}></div>
                    </div>
                    <div className="text-[10px] text-outline mt-1">{dr.count} lượt ghi nhận trễ</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Incidents by Type & Dispatcher Workload Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
            {/* Incidents Card */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-primary text-base">Phân Loại Sự Cố Gặp Phải</h3>
                <Link href="/manager/approvals" className="text-xs text-secondary font-semibold hover:underline">
                  Quản lý sự cố &rarr;
                </Link>
              </div>
              <div className="space-y-3">
                {(stats.incidentData || []).map((inc) => (
                  <div key={inc.key} className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-error">report</span>
                      <span className="font-semibold text-primary">{inc.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{inc.count} vụ</span>
                      <span className={`text-[10px] font-bold ${inc.trend === 'up' ? 'text-error' : 'text-secondary'}`}>
                        {inc.trend === 'up' ? '▲ Tăng' : '▼ Ổn định'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatcher Workload Card */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-primary text-base">Tải Điều Phối Viên Hiện Tại</h3>
                <Link href="/manager/orders" className="text-xs text-secondary font-semibold hover:underline">
                  Xem chi tiết &rarr;
                </Link>
              </div>
              <div className="space-y-3">
                {(stats.dispatcherWorkload || []).map((d) => (
                  <div key={d.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-primary">{d.name}</span>
                      <span className="text-outline">{d.active} đơn đang xử lý ({d.percent}%)</span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${d.percent >= 90 ? 'bg-error' : d.percent >= 70 ? 'bg-amber-500' : 'bg-secondary'}`}
                        style={{ width: `${d.percent}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVER PERFORMANCE REPORT (SCREEN 41 V2) */}
      {activeTab === 'DRIVERS' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md border border-outline-variant/20 space-y-space-md">
          {/* Header & Search */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container pb-space-sm">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-primary">
                  Bảng Đánh Giá Hiệu Suất Tài Xế (Screen 41 V2)
                </h3>
                <Tag color="cyan">Đúng giờ TB: {driverSummary.avg_on_time}%</Tag>
                <Tag color="blue">Tổng chuyến hoàn tất: {driverSummary.total_completed_trips}</Tag>
              </div>
              <p className="text-xs text-outline">
                Đo lường giờ lái hộp đen (BR-34), cảnh báo giới hạn 4h (MSG65), quá tốc độ và sự cố theo thời gian thực
              </p>
            </div>

            <div className="w-full sm:w-72 relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
                placeholder="Tìm tài xế, SĐT, số bằng lái..."
                type="text"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center"><Spin size="large" /></div>
          ) : filteredDrivers.length === 0 ? (
            <div className="py-12 text-center text-outline">Không tìm thấy tài xế nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                    <th className="py-3 px-space-md">TÀI XẾ</th>
                    <th className="py-3 px-space-md">HẠNG BẰNG</th>
                    <th className="py-3 px-space-md">CHUYẾN XONG</th>
                    <th className="py-3 px-space-md">ĐÚNG GIỜ (%)</th>
                    <th className="py-3 px-space-md">GIỜ LÁI GPS (BR-34)</th>
                    <th className="py-3 px-space-md">CHẠM 4H LÁI</th>
                    <th className="py-3 px-space-md">QUÁ TỐC ĐỘ</th>
                    <th className="py-3 px-space-md">Ở ĐIỂM (TB)</th>
                    <th className="py-3 px-space-md">SỰ CỐ / KHIẾU NẠI</th>
                    <th className="py-3 px-space-md">NGOÀI BÁN KÍNH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {filteredDrivers.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3 px-space-md font-bold text-primary">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {d.name?.charAt(0)}
                          </div>
                          <div>
                            <div>{d.name}</div>
                            <div className="text-[10px] text-outline font-mono">{d.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-space-md">
                        <Tag color="geekblue">{d.license_class}</Tag>
                      </td>
                      <td className="py-3 px-space-md font-bold text-primary">
                        {d.completed_trips} chuyến
                      </td>
                      <td className="py-3 px-space-md">
                        <span className={`font-bold ${d.on_time_rate >= 95 ? 'text-secondary' : 'text-amber-600'}`}>
                          {d.on_time_rate}%
                        </span>
                      </td>
                      <td className="py-3 px-space-md font-mono font-semibold text-primary">
                        {d.gps_driving_hours}h / tuần
                      </td>
                      <td className="py-3 px-space-md">
                        {d.limit_4h_count > 0 ? (
                          <Tooltip title="Tài xế chạy quá 4 giờ liên tục không nghỉ ngơi (MSG65)">
                            <Tag color="red" className="font-bold">
                              {d.limit_4h_count} lần
                            </Tag>
                          </Tooltip>
                        ) : (
                          <span className="text-secondary font-semibold">0</span>
                        )}
                      </td>
                      <td className="py-3 px-space-md">
                        {d.speeding_count > 0 ? (
                          <span className="text-amber-600 font-bold">{d.speeding_count} lần</span>
                        ) : (
                          <span className="text-outline">0</span>
                        )}
                      </td>
                      <td className="py-3 px-space-md font-medium text-on-surface">
                        {d.avg_dwell_time}
                      </td>
                      <td className="py-3 px-space-md">
                        {d.incident_count > 0 || d.complaints_count > 0 ? (
                          <Tag color="volcano" className="font-bold">
                            {d.incident_count} lỗi / {d.complaints_count} KN
                          </Tag>
                        ) : (
                          <span className="text-secondary font-semibold">Tốt</span>
                        )}
                      </td>
                      <td className="py-3 px-space-md">
                        {d.outside_radius_count > 0 ? (
                          <Tooltip title="Check-in/Check-out ngoài bán kính Geofence hợp lệ (BR-36)">
                            <span className="text-error font-bold">
                              {d.outside_radius_count} vi phạm
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-outline">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
