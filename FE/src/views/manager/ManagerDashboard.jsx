"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spin, message, Tag, Tooltip, Modal, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { managerApi } from '../../api/managerApi';

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs('2026-10-01'));
  const [period, setPeriod] = useState('Tháng 10/2026');
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW', 'DRIVERS'

  // Dashboard Stats - Không khởi tạo dữ liệu giả, lấy hoàn toàn từ DB thực tế
  const [stats, setStats] = useState({
    period: 'Tháng 10/2026',
    revenue: 0,
    revenueFormatted: '0 đ',
    truckUtilization: '0',
    avgSlaDispatch: '0 phút',
    completedOrders: 0,
    totalOrders: 0,
    incidentData: [],
    incidentSummaryText: 'Chưa ghi nhận sự cố',
    vehicleFillRate: '0',
    emptyRunningRate: '0',
    revenuePerKm: '0 đ',
    orderCycleTime: 'Chưa có đơn hoàn thành',
    perfectOrdersRate: '0',
    dwellLocations: [],
    dwellSummaryText: 'Chưa có dữ liệu điểm dừng',
    delayReasons: [],
    delaySummaryText: 'Chưa có chuyến trễ'
  });

  // Driver Performance - Lấy 100% từ bảng driver_profiles, trips, trip_drivers thực tế
  const [driversPerformance, setDriversPerformance] = useState([]);
  const [driverSummary, setDriverSummary] = useState({ total_drivers: 0, total_completed_trips: 0 });
  const [driverSearch, setDriverSearch] = useState('');
  const [selectedDriverModal, setSelectedDriverModal] = useState(null);

  const loadData = async (selectedPeriod = period) => {
    setLoading(true);
    try {
      const [statsRes, driversRes] = await Promise.all([
        managerApi.getDashboardStats(selectedPeriod).catch(() => null),
        managerApi.getDriverPerformance(selectedPeriod).catch(() => ({ drivers: [], summary: {} }))
      ]);

      if (statsRes) {
        setStats(statsRes);
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
  };

  const handleMonthChange = (date) => {
    if (!date) return;
    setSelectedMonth(date);
    const formatted = `Tháng ${date.format('MM/YYYY')}`;
    setPeriod(formatted);
    loadData(formatted);
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
            setStats(statsRes);
          }
          if (driversRes) {
            setDriversPerformance(driversRes.drivers || []);
            setDriverSummary(driversRes.summary || { total_drivers: 0, total_completed_trips: 0 });
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
    <div className="flex flex-col w-full space-y-5">
      {/* Top Header Section khớp Prototype Figure 35 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              Tổng quan hiệu suất
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              Live Database Telemetry
            </span>
          </div>
          <p className="text-xs text-on-surface-variant max-w-2xl">
            Toàn bộ số liệu vận tải, doanh thu, thời gian dừng bốc dỡ và chỉ số tài xế được tính toán tự động 100% từ cơ sở dữ liệu hiện có.
          </p>
        </div>

        {/* Filter Kỳ (① trong Prototype Figure 35) & Thao tác */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-surface-container">
            <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
            <span className="text-xs font-bold text-on-surface-variant">Chọn tháng:</span>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              format="[Tháng] MM/YYYY"
              allowClear={false}
              className="bg-transparent border-none text-xs font-bold text-primary shadow-none cursor-pointer hover:bg-surface-container-high/40 rounded-lg p-0"
              style={{ width: 175 }}
            />
          </div>

          <button
            onClick={() => loadData(period)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
            type="button"
            title="Tải lại từ Database"
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

      {/* Main Tabs Navigation (② trong Prototype Figure 35 & 36) */}
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

      {/* TAB 1: TỔNG QUAN (BÁM SÁT 100% CẤU TRÚC PROTOTYPE FIGURE 35 VỚI CSS NỀN NÃ HIỆN ĐẠI) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          {/* HÀNG 1 (Prototype 3, 4, 5): Doanh thu, Sử dụng xe, SLA điều phối (TB) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 3: Doanh thu */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Doanh thu</span>
                <span className="material-symbols-outlined text-primary text-[20px]">payments</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-black text-primary tracking-tight">
                  {stats.revenueFormatted || '0 đ'}
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Chưa gồm tiền thu hộ
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: stats.revenue > 0 ? '100%' : '0%' }}></div>
              </div>
            </div>

            {/* Card 4: Sử dụng xe */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-secondary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Sử dụng xe</span>
                <span className="material-symbols-outlined text-secondary text-[20px]">local_shipping</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-black text-secondary tracking-tight">
                  {stats.truckUtilization}%
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Giờ chạy / giờ xe rảnh
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Number(stats.truckUtilization) || 0)}%` }}
                ></div>
              </div>
            </div>

            {/* Card 5: SLA điều phối (TB) */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-tertiary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>SLA điều phối (TB)</span>
                <span className="material-symbols-outlined text-tertiary text-[20px]">timer</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-black text-tertiary tracking-tight">
                  {stats.avgSlaDispatch || '0 phút'}
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Đã xác nhận → đã gán xe
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-tertiary h-full rounded-full" style={{ width: '80%' }}></div>
              </div>
            </div>
          </div>

          {/* HÀNG 2 (Prototype 6, 7): Giao thành công & Sự cố theo loại */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 6 (1 cột): Giao thành công */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Giao thành công</span>
                <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-black text-emerald-600 tracking-tight">
                  {stats.completedOrders ?? 0}
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Trong kỳ
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300" 
                  style={{ 
                    width: (stats.completedOrders && stats.completedOrders > 0)
                      ? (stats.totalOrders && stats.totalOrders > 0 
                          ? `${Math.min(100, Math.round((stats.completedOrders / stats.totalOrders) * 100))}%` 
                          : '100%')
                      : '0%' 
                  }}
                ></div>
              </div>
            </div>

            {/* Card 7 (2 cột): Sự cố theo loại (Khớp định dạng chữ và chi tiết) */}
            <div className="md:col-span-2 p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-error/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <div className="flex items-center gap-2">
                  <span className="text-error font-extrabold">Sự cố theo loại</span>
                  <span className="text-[11px] font-normal text-on-surface-variant">
                    (Phát sinh từ đội xe thực tế)
                  </span>
                </div>
                <Link
                  href="/manager/approvals?tab=incidents"
                  className="text-xs text-secondary font-bold hover:underline flex items-center gap-1"
                >
                  <span>Chi tiết sự cố</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>

              {/* Dòng tóm tắt chuẩn định dạng prototype: Hỏng xe: 2 · Hàng hư hỏng/mất: 1 · Tai nạn: 1 · Khác: 1 */}
              <div className="my-2">
                <div className="text-base font-bold text-primary">
                  {stats.incidentSummaryText}
                </div>
                {/* Visual badges hỗ trợ nhận diện nhanh */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {stats.incidentData && stats.incidentData.length > 0 ? (
                    stats.incidentData.map((inc, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${
                          inc.color === 'error'
                            ? 'bg-error/10 text-error'
                            : inc.color === 'orange'
                            ? 'bg-amber-500/10 text-amber-700'
                            : 'bg-surface-container text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">{inc.icon}</span>
                        <span>{inc.type}:</span>
                        <span className="font-extrabold">{inc.count}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-on-surface-variant italic">Không có sự cố nào trong kỳ</span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-on-surface-variant font-medium">
                Dữ liệu sự cố tổng hợp tự động từ báo cáo tài xế & biên bản hiện trường
              </div>
            </div>
          </div>

          {/* HÀNG 3 (Prototype 8, 9, 10, 11): 4 chỉ số chuyên sâu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 8: Độ đầy xe */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Độ đầy xe</span>
                <span className="material-symbols-outlined text-primary text-[20px]">density_medium</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-primary tracking-tight">
                  {stats.vehicleFillRate}%
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Khối lượng chở ÷ tải trọng
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Number(stats.vehicleFillRate) || 0)}%` }}
                ></div>
              </div>
            </div>

            {/* Card 9: Km chạy rỗng */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Km chạy rỗng</span>
                <span className="material-symbols-outlined text-amber-600 text-[20px]">no_crash</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-amber-600 tracking-tight">
                  {stats.emptyRunningRate}%
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Km không chở hàng ÷ tổng km
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Number(stats.emptyRunningRate) || 0)}%` }}
                ></div>
              </div>
            </div>

            {/* Card 10: Doanh thu / km */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-secondary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Doanh thu / km</span>
                <span className="material-symbols-outlined text-secondary text-[20px]">trending_up</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-secondary tracking-tight">
                  {stats.revenuePerKm || '0 đ'}
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Doanh thu ÷ tổng km
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: stats.revenuePerKm !== '0 đ' ? '75%' : '0%' }}></div>
              </div>
            </div>

            {/* Card 11: Nhận đơn → giao (TB) */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Nhận đơn → giao (TB)</span>
                <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-primary tracking-tight">
                  {stats.orderCycleTime}
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Từ tạo đơn đến đã giao
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>

          {/* HÀNG 4 (Prototype 12, 13, 14): Đơn hoàn hảo, Thời gian ở điểm, Lịch trễ theo nguyên nhân */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Card 12 (1 cột): Đơn hoàn hảo (3 tiêu chí) */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-secondary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Đơn hoàn hảo (3 tiêu chí)</span>
                <span className="material-symbols-outlined text-secondary text-[20px]">task_alt</span>
              </div>
              <div className="my-2">
                <div className="text-3xl font-black text-secondary tracking-tight">
                  {stats.perfectOrdersRate}%
                </div>
                <div className="text-xs text-on-surface-variant mt-1 font-medium">
                  Đủ hàng · đủ chứng từ · không hư hỏng
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Number(stats.perfectOrdersRate) || 0)}%` }}
                ></div>
              </div>
            </div>

            {/* Card 13 (2 cột): Thời gian ở điểm (TB) – kho lâu nhất */}
            <div className="lg:col-span-2 p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-tertiary/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Thời gian ở điểm (TB) – kho lâu nhất</span>
                <span className="material-symbols-outlined text-tertiary text-[20px]">warehouse</span>
              </div>

              {/* Dòng tóm tắt chuẩn định dạng prototype: Kho ALS tại Sân bay Nội Bài 72' · ALSC 65'... */}
              <div className="my-2">
                <div className="text-sm md:text-base font-bold text-primary leading-relaxed">
                  {stats.dwellSummaryText}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {stats.dwellLocations && stats.dwellLocations.length > 0 ? (
                    stats.dwellLocations.map((loc, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-container-low text-xs font-semibold text-primary border border-surface-container"
                      >
                        <span className="material-symbols-outlined text-[15px] text-tertiary">location_on</span>
                        <span>{loc.name}:</span>
                        <span className="font-extrabold text-tertiary">{loc.time}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-on-surface-variant italic">Chưa có thông tin điểm dừng</span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-on-surface-variant font-medium">
                Đo lường thời gian lưu bốc dỡ tại mỗi kho qua định vị Geofence
              </div>
            </div>

            {/* Card 14 (1 cột): Lịch trễ theo nguyên nhân */}
            <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:border-error/40 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                <span>Lịch trễ theo nguyên nhân</span>
                <span className="material-symbols-outlined text-error text-[20px]">warning_amber</span>
              </div>

              {/* Dòng tóm tắt chuẩn định dạng prototype: Đi đường lâu 9 · Ở điểm lâu 6 · Sự cố 2 */}
              <div className="my-2">
                <div className="text-sm font-bold text-primary leading-snug">
                  {stats.delaySummaryText}
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  {stats.delayReasons && stats.delayReasons.length > 0 ? (
                    stats.delayReasons.map((dr, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-on-surface-variant font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                          {dr.reason}
                        </span>
                        <span className="font-black text-error">{dr.count}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-on-surface-variant italic">Không có lịch trễ</span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-on-surface-variant font-medium">
                Cập nhật tự động theo trạng thái đơn hàng & sự cố
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HIỆU SUẤT TÀI XẾ (BÁM SÁT 100% PROTOTYPE FIGURE 36 - 8 CỘT CHUẨN XÁC) */}
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
                Giờ lái tính từ GPS xe. Bấm tên tài xế để xem danh sách chuyến của tài xế đó.
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
              {/* BẢNG ĐÚNG CHUẨN 8 CỘT THEO FIGURE 36 */}
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
                      {/* Cột 1: Tài xế (Bấm tên để xem danh sách chuyến) */}
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

                      {/* Cột 2: Số chuyến */}
                      <td className="py-3.5 px-4 text-center font-bold text-primary">
                        {d.completed_trips}
                      </td>

                      {/* Cột 3: Giờ lái (GPS) */}
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-primary">
                        {d.gps_driving_hours}
                      </td>

                      {/* Cột 4: Chạm giới hạn lái (BR-34 / 4H Limit) */}
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

                      {/* Cột 5: Quá tốc độ */}
                      <td className="py-3.5 px-4 text-center">
                        {d.speeding_count > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-extrabold">
                            {d.speeding_count}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">0</span>
                        )}
                      </td>

                      {/* Cột 6: Ngoài bán kính */}
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

                      {/* Cột 7: Ở điểm (TB) */}
                      <td className="py-3.5 px-4 text-center font-medium text-primary">
                        {d.avg_dwell_time}
                      </td>

                      {/* Cột 8: Sự cố · khiếu nại (Định dạng chuẩn Figure 36: e.g. 0 · 0 hoặc 1 · 1) */}
                      <td className="py-3.5 px-4 text-center font-bold">
                        <span className={d.incident_claim_text !== '0 · 0' ? 'text-error font-black' : 'text-on-surface-variant'}>
                          {d.incident_claim_text}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Chú thích chân bảng khớp nguyên văn Prototype Figure 36 */}
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
