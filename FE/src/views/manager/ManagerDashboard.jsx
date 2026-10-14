"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spin, message } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 1250000000,
    revenueFormatted: '1.25B',
    totalOrders: 4,
    delayedOrders: 1,
    truckUtilization: '40.0',
    onTripTrucks: 2,
    totalTrucks: 5,
    slaRate: '75.0',
    totalIncidents: 2,
    incidentData: [
      {
        key: '1',
        type: 'Hàng hóa hư hỏng',
        note: 'Chặng bay HAN-SGN (Air cargo)',
        count: 1,
        trend: 'Giảm (-50%)',
        icon: 'inventory_2',
        color: 'text-primary-container'
      },
      {
        key: '2',
        type: 'Tai nạn',
        note: 'Va quẹt nhẹ tại cảng Cát Lái',
        count: 1,
        trend: 'Giảm (-33%)',
        icon: 'car_crash',
        color: 'text-on-tertiary-container'
      }
    ],
    dispatcherWorkload: [
      {
        name: 'dispatcher',
        id: 'dispatcher',
        total: 4,
        active: 3,
        percent: 75
      },
      {
        name: 'Lê Văn Cường',
        id: 'dispatcher03',
        total: 0,
        active: 0,
        percent: 0
      },
      {
        name: 'Trần Thị Bích',
        id: 'dispatcher02',
        total: 0,
        active: 0,
        percent: 0
      }
    ]
  });

  useEffect(() => {
    let isMounted = true;
    managerApi.getDashboardStats()
      .then((data) => {
        if (isMounted && data) {
          setStats((prev) => ({
            ...prev,
            ...data,
            incidentData: (data.incidentData && data.incidentData.length > 0)
              ? data.incidentData
              : prev.incidentData,
            dispatcherWorkload: (data.dispatcherWorkload && data.dispatcherWorkload.length > 0)
              ? data.dispatcherWorkload
              : prev.dispatcherWorkload
          }));
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard stats:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleExportReport = () => {
    message.success('Đang chuẩn bị báo cáo hiệu suất vận hành tháng... Tải xuống thành công!');
  };

  return (
    <div className="flex flex-col w-full space-y-space-xl">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex flex-col space-y-space-xs">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
              Bảng Điều khiển Hiệu suất
            </h1>
            <span className="inline-flex items-center px-space-sm py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
              Live Q3
            </span>
          </div>
          <p className="font-body-md text-body-md text-outline">
            Báo cáo phân tích trực quan về doanh thu, tỷ lệ sử dụng xe, và thống kê sự cố thực tế.
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <div className="hidden xl:flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container-low rounded-xl text-on-surface-variant font-data-mono text-data-mono">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>Chu kỳ: 01/10 - 31/10</span>
          </div>
          <button
            onClick={handleExportReport}
            className="inline-flex items-center justify-center gap-space-sm px-space-lg py-space-sm bg-secondary text-on-secondary rounded-xl font-label-lg text-label-lg shadow-sm hover:bg-secondary-container transition-all active:scale-[0.99] cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">file_download</span>
            <span>Xuất Báo cáo Tháng</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center items-center bg-surface-container-lowest rounded-xl shadow-sm">
          <Spin size="large" description="Đang đồng bộ dữ liệu Backend..." />
        </div>
      ) : (
        <>
          {/* KPI Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {/* KPI 1: Doanh thu */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between space-y-space-md transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg text-on-surface-variant font-medium">
                  Doanh thu (Thực tế)
                </span>
                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[22px]">payments</span>
                </div>
              </div>
              <div className="flex flex-col space-y-space-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
                    {stats.revenueFormatted ? `${stats.revenueFormatted} VNĐ` : '0 VNĐ'}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-space-sm py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    Doanh thu thực
                  </span>
                </div>
                <div className="flex items-center justify-between text-outline font-body-sm text-body-sm">
                  <span>Tổng số đơn ghi nhận: {stats.totalOrders ?? 0}</span>
                  <span className="font-data-mono text-data-mono text-on-surface-variant">Live DB</span>
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div className="bg-secondary h-1.5 rounded-full" style={{ width: stats.totalOrders > 0 ? '100%' : '0%' }}></div>
              </div>
            </div>

            {/* KPI 2: Tỷ lệ sử dụng xe */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between space-y-space-md transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg text-on-surface-variant font-medium">
                  Tỷ lệ sử dụng xe
                </span>
                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                </div>
              </div>
              <div className="flex flex-col space-y-space-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
                    {stats.truckUtilization || '0.0'}%
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-space-sm py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                    <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                    GPS Live
                  </span>
                </div>
                <div className="flex items-center justify-between text-outline font-body-sm text-body-sm">
                  <span>Hoạt động: {stats.onTripTrucks ?? 0}/{stats.totalTrucks ?? 0} xe</span>
                  <span className="font-data-mono text-data-mono text-on-surface-variant">Đội xe thực tế</span>
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-secondary-container h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, parseFloat(stats.truckUtilization) || 0)}%` }}
                ></div>
              </div>
            </div>

            {/* KPI 3: SLA Xử lý Đơn hàng */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between space-y-space-md transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg text-on-surface-variant font-medium">
                  SLA Xử lý Đơn hàng
                </span>
                <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-container">
                  <span className="material-symbols-outlined text-[22px]">verified</span>
                </div>
              </div>
              <div className="flex flex-col space-y-space-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
                    {stats.slaRate || '0.0'}%
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-space-sm py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold">
                    <span className="material-symbols-outlined text-[14px]">rule</span>
                    SLA Cam kết
                  </span>
                </div>
                <div className="flex items-center justify-between text-outline font-body-sm text-body-sm">
                  <span>Đơn trễ / rủi ro: {stats.delayedOrders ?? 0}</span>
                  <span className="font-data-mono text-data-mono text-secondary font-semibold">Chuẩn vận hành</span>
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-on-tertiary-container h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, parseFloat(stats.slaRate) || 0)}%` }}
                ></div>
              </div>
            </div>

            {/* KPI 4: Thống kê Sự cố */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between space-y-space-md transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg text-on-surface-variant font-medium">
                  Tổng số Sự cố
                </span>
                <div className="w-10 h-10 rounded-xl bg-error-container flex items-center justify-center text-error">
                  <span className="material-symbols-outlined text-[22px]">warning</span>
                </div>
              </div>
              <div className="flex flex-col space-y-space-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
                    {stats.totalIncidents ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-space-sm py-0.5 rounded-full bg-error-container text-error font-label-sm text-label-sm font-semibold">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {stats.totalIncidents ?? 0} vụ
                  </span>
                </div>
                <div className="flex items-center justify-between text-outline font-body-sm text-body-sm">
                  <span>Đã xử lý &amp; bồi hoàn</span>
                  <span className="font-data-mono text-data-mono text-secondary font-semibold">100% Closed</span>
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div className="bg-error h-1.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>

          {/* Operational Insight Grid: 50 / 50 Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
            {/* Left Card: Thống kê Sự cố theo Phân loại */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between space-y-space-lg">
              <div className="flex flex-col space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-1.5 h-5 bg-secondary rounded-full"></span>
                    <span className="font-headline-md text-headline-md font-bold text-primary">
                      Thống kê Sự cố theo Phân loại
                    </span>
                  </div>
                  <span className="px-space-md py-space-xs bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm rounded-full font-semibold">
                    Tháng hiện tại
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-outline">
                  Báo cáo ghi nhận trực tiếp từ đội điều hành tuyến đường trục &amp; hub giao tiếp.
                </p>
              </div>

              {/* Incident Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="py-space-sm px-space-md rounded-l-lg">Nguyên nhân</th>
                      <th className="py-space-sm px-space-md text-center">Số lượng</th>
                      <th className="py-space-sm px-space-md text-right rounded-r-lg">Xu hướng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {stats.incidentData && stats.incidentData.map((inc) => (
                      <tr key={inc.key || inc.type} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-space-md px-space-md">
                          <div className="flex items-center gap-space-sm">
                            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-[18px]">
                                {inc.icon || (inc.type.includes('xe') ? 'local_shipping' : inc.type.includes('Tai') ? 'car_crash' : 'inventory_2')}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                                {inc.type}
                              </span>
                              <span className="font-body-sm text-body-sm text-outline">
                                {inc.note || 'Tuyến vận tải trung chuyển nội địa'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-space-md px-space-md text-center">
                          <span className="font-headline-sm text-headline-sm font-bold text-primary font-data-mono">
                            {inc.count}
                          </span>
                        </td>
                        <td className="py-space-md px-space-md text-right">
                          <span className="inline-flex items-center gap-0.5 px-space-sm py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                            {inc.trend || 'Giảm'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Status Footer Alert */}
              <div className="p-space-md bg-surface-container-low rounded-xl flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">check_circle</span>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    Biên bản hoàn tất
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Tất cả các sự cố đã được đội vận hành xử lý và lập biên bản đền bù bảo hiểm theo quy chuẩn vận tải NexLog.
                  </span>
                </div>
              </div>
            </div>

            {/* Right Card: Khối lượng đơn của Điều phối viên */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between space-y-space-lg">
              <div className="flex flex-col space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-1.5 h-5 bg-on-tertiary-container rounded-full"></span>
                    <span className="font-headline-md text-headline-md font-bold text-primary">
                      Khối lượng đơn của Điều phối viên
                    </span>
                  </div>
                  <span className="px-space-md py-space-xs bg-surface-container-high text-secondary font-label-sm text-label-sm rounded-full font-semibold">
                    {stats.dispatcherWorkload?.length || 3} Điều phối viên
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-outline">
                  Phân bổ tải công việc và tiến độ xử lý thực ca hiện tại.
                </p>
              </div>

              {/* Dispatchers List */}
              <div className="space-y-space-md">
                {stats.dispatcherWorkload && stats.dispatcherWorkload.map((disp, idx) => {
                  const initial = (disp.name || 'D').charAt(0).toUpperCase();
                  const total = disp.total ?? disp.count ?? 0;
                  const active = disp.active ?? 0;
                  const pct = disp.percent ?? (total > 0 ? Math.round((active / total) * 100) : 0);

                  return (
                    <div
                      key={disp.id || idx}
                      className={`p-space-md rounded-xl space-y-space-sm ${
                        idx === 0 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-space-sm">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-headline-sm text-headline-sm font-bold ${
                              idx === 0
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface-container-high text-primary'
                            }`}
                          >
                            {initial}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-lg text-label-lg font-bold text-on-surface">
                              {disp.name}
                            </span>
                            <span className="font-data-mono text-data-mono text-outline">
                              ID: {disp.id || disp.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-space-xs">
                          <span className="px-space-sm py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm font-semibold">
                            Tổng: {total}
                          </span>
                          <span
                            className={`px-space-sm py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                              active > 0
                                ? 'bg-secondary text-on-secondary'
                                : 'bg-surface-container text-outline'
                            }`}
                          >
                            Đang xử lý: {active}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between font-label-sm text-label-sm text-outline">
                          <span>Tải phân công</span>
                          <span className={`font-semibold ${pct > 0 ? 'text-secondary' : 'text-outline'}`}>
                            {pct > 0 ? `${pct}% (${active}/${total} đơn)` : '0% (Sẵn sàng nhận lệnh)'}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-secondary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Action / Rebalance Banner */}
              <div className="flex items-center justify-between pt-space-xs font-body-sm text-body-sm">
                <span className="text-outline">Trạng thái: Điều phối viên sẵn sàng nhận lệnh</span>
                <Link
                  href="/manager/orders"
                  className="text-secondary font-label-md text-label-md font-semibold hover:underline flex items-center gap-0.5"
                >
                  <span>Tái cân bằng đơn</span>
                  <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Operational Dispatch Status Bar */}
          <div className="bg-primary text-on-primary p-space-md rounded-xl flex flex-col md:flex-row items-center justify-between gap-space-md shadow-md">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-xl bg-on-tertiary-container text-on-tertiary flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[24px]">hub</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg font-bold">
                  Trung tâm Điều vận Hà Nội - Gateway Nội Bài
                </span>
                <span className="font-body-sm text-body-sm text-on-primary-container">
                  Đang vận hành bình thường. Tốc độ luân chuyển kho bãi đạt 98.4% định mức an toàn.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-sm">
              <span className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary font-data-mono text-data-mono">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                Hệ thống: Đồng bộ thời gian thực
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
