"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message, Spin } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function FleetPage() {
  const [loading, setLoading] = useState(true);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [activeTag, setActiveTag] = useState('ALL');

  // Modal thêm tài xế
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverForm] = Form.useForm();
  const [submittingDriver, setSubmittingDriver] = useState(false);

  const fetchFleetData = () => {
    setLoading(true);
    managerApi.getVehicles()
      .then(data => {
        setTrucks(data.trucks || []);
        setDrivers(data.drivers || []);
      })
      .catch(error => {
        console.error('Lỗi khi tải dữ liệu đội xe:', error);
        message.error('Không thể kết nối Backend để lấy danh sách đội xe.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    managerApi.getVehicles()
      .then(data => {
        if (isMounted) {
          setTrucks(data.trucks || []);
          setDrivers(data.drivers || []);
        }
      })
      .catch(error => {
        console.error('Lỗi khi tải dữ liệu đội xe:', error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleCreateDriver = async (values) => {
    try {
      setSubmittingDriver(true);
      await managerApi.createDriver(values);
      message.success('Đăng ký hồ sơ tài xế mới thành công!');
      setIsDriverModalOpen(false);
      driverForm.resetFields();
      fetchFleetData();
    } catch (error) {
      console.error('Lỗi khi tạo tài xế:', error);
      message.error(error.message || 'Lỗi khi tạo tài xế mới');
    } finally {
      setSubmittingDriver(false);
    }
  };

  // Tính toán KPI hoàn toàn từ dữ liệu trucks thực tế trong Database
  const totalTrucks = trucks.length;
  const activeTrucks = trucks.filter((t) => t.status === 'ON_TRIP').length;
  const readyTrucks = trucks.filter((t) => t.status === 'AVAILABLE').length;
  const maintenanceTrucks = trucks.filter((t) => t.status === 'MAINTENANCE').length;
  const utilizationRate = totalTrucks > 0 ? Math.round((activeTrucks / totalTrucks) * 100) : 0;
  const readyRate = totalTrucks > 0 ? Math.round((readyTrucks / totalTrucks) * 100) : 0;
  const maintenanceRate = totalTrucks > 0 ? Math.round((maintenanceTrucks / totalTrucks) * 100) : 0;

  // Lọc danh sách xe
  const filteredTrucks = trucks.filter((truck) => {
    const matchSearch =
      !searchText ||
      truck.plate_number?.toLowerCase().includes(searchText.toLowerCase()) ||
      truck.model?.toLowerCase().includes(searchText.toLowerCase()) ||
      truck.driver_name?.toLowerCase().includes(searchText.toLowerCase());

    const matchType =
      selectedType === 'ALL' ||
      (selectedType === 'uld' && truck.model?.toLowerCase().includes('uld')) ||
      (selectedType === 'reefer' && truck.model?.toLowerCase().includes('reefer')) ||
      (selectedType === 'container' && truck.model?.toLowerCase().includes('container'));

    const matchTag =
      activeTag === 'ALL' ||
      (activeTag === 'ACTIVE' && truck.status === 'ON_TRIP') ||
      (activeTag === 'AVAILABLE' && truck.status === 'AVAILABLE') ||
      (activeTag === 'MAINTENANCE' && truck.status === 'MAINTENANCE');

    return matchSearch && matchType && matchTag;
  });

  return (
    <div className="flex flex-col w-full space-y-space-lg">
      {/* Top Dispatch Action & Summary Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-surface-container-low rounded-full pointer-events-none opacity-50 blur-2xl"></div>
        <div className="flex flex-col gap-space-xs z-10">
          <div className="flex items-center gap-space-md flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
              Quản lý &amp; Điều phối Đội xe
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              Trực tuyến: {activeTrucks}/{totalTrucks} Xe
            </span>
            <span className="font-data-mono text-xs text-outline px-2 py-0.5 rounded bg-surface-container-low">
              Vận hành thực tế (GPS Synced)
            </span>
          </div>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl">
            Giám sát định vị GPS xe tải trung chuyển sân bay, kiểm soát tải trọng tự động, theo dõi nhiệt độ thùng lạnh IoT và điều phối lệnh vận tải tức thời.
          </p>
        </div>

        {/* Quick Ops Actions */}
        <div className="flex items-center gap-space-sm flex-wrap z-10">
          <button
            onClick={() => message.info('Đang xuất tệp telemetry định vị GPS (.kml/.csv)...')}
            className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-surface-container-low text-primary font-label-lg text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px] text-secondary">file_download</span>
            <span>Xuất dữ liệu GPS</span>
          </button>
          <button
            onClick={() => message.warning('Chế độ Điều xe khẩn cấp đang quét các phương tiện trống trong bán kính 10km.')}
            className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-primary-container text-on-primary font-label-lg text-sm font-semibold shadow-sm hover:bg-primary transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">emergency_share</span>
            <span>Điều xe khẩn cấp</span>
          </button>
          <button
            onClick={() => setIsDriverModalOpen(true)}
            className="inline-flex items-center gap-2 px-space-lg py-2.5 rounded-xl bg-on-tertiary-container text-on-primary font-label-lg text-sm font-semibold shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">add_circle</span>
            <span>+ Đăng ký tài xế mới</span>
          </button>
        </div>
      </div>

      {/* Operational KPI Metric Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        {/* Active Trips */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-3 -top-3 w-20 h-20 bg-secondary/5 rounded-full pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-outline uppercase tracking-wider font-semibold">
              Đang lăn bánh (Active)
            </span>
            <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">local_shipping</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-primary">{activeTrucks}</span>
            <span className="font-label-md text-label-md text-on-surface-variant">/ {totalTrucks} phương tiện</span>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm text-outline">
            <span className="flex items-center gap-1 text-secondary font-medium">
              <span className="material-symbols-outlined text-[16px]">navigation</span> GPS Đang chạy
            </span>
            <span className="font-data-mono font-medium text-on-surface">
              {utilizationRate}% công suất
            </span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full"
              style={{ width: `${utilizationRate}%` }}
            ></div>
          </div>
        </div>

        {/* Ready at Depot */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-outline uppercase tracking-wider font-semibold">
              Sẵn sàng tại Depot / Ga
            </span>
            <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-on-tertiary-container">
              <span className="material-symbols-outlined text-[20px]">warehouse</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-primary">{readyTrucks}</span>
            <span className="font-label-md text-label-md text-on-surface-variant">xe chờ lệnh</span>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm text-outline">
            <span className="text-on-surface font-medium">Sẵn sàng xuất phát</span>
            <span className="font-label-sm text-label-sm font-semibold text-secondary uppercase tracking-tight">
              {readyRate}% Đội xe
            </span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-secondary-container h-full rounded-full" style={{ width: `${readyRate}%` }}></div>
          </div>
        </div>

        {/* Under Maintenance */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-outline uppercase tracking-wider font-semibold">
              Bảo dưỡng / Sửa chữa
            </span>
            <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[20px]">build</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-primary">
              {String(maintenanceTrucks).padStart(2, '0')}
            </span>
            <span className="font-label-md text-label-md text-error font-semibold">Bảo trì định kỳ</span>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm text-outline">
            <span>Tình trạng kỹ thuật</span>
            <span className="font-data-mono font-medium text-on-surface">{maintenanceTrucks > 0 ? `${maintenanceTrucks} xe bảo trì` : '0 xe lỗi'}</span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: `${maintenanceRate}%` }}></div>
          </div>
        </div>

        {/* SLA & Fleet Utilization */}
        <div className="p-space-lg rounded-xl bg-primary text-on-primary shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-primary-fixed uppercase tracking-wider font-semibold">
              Tỷ lệ khả dụng đội xe
            </span>
            <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center text-secondary-fixed">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-on-primary">
              {totalTrucks > 0 ? `${Math.round(((activeTrucks + readyTrucks) / totalTrucks) * 100)}%` : '0%'}
            </span>
            <span className="font-label-md text-label-md text-secondary-fixed font-semibold">DB Live</span>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm text-primary-fixed">
            <span>Tổng phương tiện: {totalTrucks} xe</span>
            <span className="font-data-mono text-on-primary font-bold">Chuẩn Vận hành</span>
          </div>
          <div className="w-full bg-primary-container h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-on-tertiary-container h-full rounded-full" style={{ width: `${totalTrucks > 0 ? Math.round(((activeTrucks + readyTrucks) / totalTrucks) * 100) : 0}%` }}></div>
          </div>
        </div>
      </div>

      {/* Operational Filter Hub */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm mb-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          {/* Search Input within filter bar */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
              search
            </span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-space-md py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all"
              placeholder="Tìm theo biển số (29H-...), tên tài xế, mã chuyến..."
              type="text"
            />
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            {/* Vehicle Category Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="appearance-none bg-surface-container-low text-on-surface font-label-md text-label-md py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
              >
                <option value="ALL">Tất cả loại phương tiện</option>
                <option value="uld">Xe ULD Airport Roller bed (Chuyên dụng)</option>
                <option value="reefer">Xe tải lạnh Reefer 5T (Vắc-xin/Thực phẩm)</option>
                <option value="container">Xe đầu kéo Container 40ft</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-2.5 text-outline text-[18px] pointer-events-none">
                expand_more
              </span>
            </div>

            {/* Regional Zone Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="appearance-none bg-surface-container-low text-on-surface font-label-md text-label-md py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
              >
                <option value="ALL">Tất cả khu vực điều phối</option>
                <option value="han">Ga Hàng hóa Nội Bài (HAN Hub)</option>
                <option value="sgn">Ga Hàng hóa Tân Sơn Nhất (SGN Hub)</option>
                <option value="bn">KCN Bắc Ninh - Yên Phong</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-2.5 text-outline text-[18px] pointer-events-none">
                expand_more
              </span>
            </div>

            <button
              onClick={() => {
                setSearchText('');
                setSelectedType('ALL');
                setSelectedZone('ALL');
                setActiveTag('ALL');
              }}
              className="p-2 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-secondary hover:bg-surface-container transition-colors cursor-pointer"
              title="Đặt lại bộ lọc"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>
        </div>

        {/* Active Filter Tags (Chips) */}
        <div className="flex items-center gap-space-xs flex-wrap pt-space-xs">
          <span className="font-label-sm text-label-sm text-outline uppercase font-semibold mr-space-xs">
            Bộ lọc nhanh:
          </span>
          <button
            onClick={() => setActiveTag('ALL')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold transition-colors cursor-pointer ${
              activeTag === 'ALL'
                ? 'bg-secondary-fixed text-on-secondary-fixed'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span>Tất cả ({trucks.length})</span>
          </button>
          <button
            onClick={() => setActiveTag('ACTIVE')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${
              activeTag === 'ACTIVE'
                ? 'bg-secondary text-on-secondary font-semibold'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-medium'
            }`}
          >
            <span>Đang lăn bánh ({activeTrucks})</span>
          </button>
          <button
            onClick={() => setActiveTag('AVAILABLE')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${
              activeTag === 'AVAILABLE'
                ? 'bg-secondary text-on-secondary font-semibold'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-medium'
            }`}
          >
            <span>Sẵn sàng ({readyTrucks})</span>
          </button>
          <button
            onClick={() => setActiveTag('MAINTENANCE')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${
              activeTag === 'MAINTENANCE'
                ? 'bg-secondary text-on-secondary font-semibold'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-medium'
            }`}
          >
            <span>Bảo dưỡng ({maintenanceTrucks})</span>
          </button>
        </div>
      </div>

      {/* Main Content Mosaic: Fleet Data Table + Mini GIS Radar Terminal */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-space-lg mb-space-lg">
        {/* Master Fleet Manifest Table (3 Columns Span) */}
        <div className="xl:col-span-3 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
          {loading ? (
            <div className="py-20 flex justify-center items-center">
              <Spin size="large" description="Đang tải dữ liệu đội xe..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    <th className="py-3 px-space-md">Biển số &amp; Phương tiện</th>
                    <th className="py-3 px-space-md">Tài xế phụ trách</th>
                    <th className="py-3 px-space-md">Vị trí GPS &amp; Lộ trình</th>
                    <th className="py-3 px-space-md">Tải trọng thực tế</th>
                    <th className="py-3 px-space-md">Trạng thái vận hành</th>
                    <th className="py-3 px-space-md text-right">Tác vụ</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm divide-y divide-surface-container">
                  {filteredTrucks.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-outline">
                        Không tìm thấy phương tiện nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredTrucks.map((truck, idx) => {
                      const driverInitial = (truck.driver_name || 'T').charAt(0).toUpperCase();
                      const isCold = truck.model?.toLowerCase().includes('lạnh') || truck.model?.toLowerCase().includes('reefer');
                      const isContainer = truck.model?.toLowerCase().includes('container');

                      return (
                        <tr
                          key={truck.id || idx}
                          className="hover:bg-surface-container-low/70 transition-colors group"
                        >
                          {/* Biển số & Phương tiện */}
                          <td className="py-3.5 px-space-md">
                            <div className="flex items-center gap-space-sm">
                              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                                <span className="material-symbols-outlined text-[20px]">
                                  {isCold ? 'ac_unit' : isContainer ? 'directions_boat' : 'rv_hookup'}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-data-mono font-bold text-on-surface text-body-md">
                                  {truck.plate_number}
                                </span>
                                <span className="text-outline text-label-sm font-medium">
                                  {truck.model || 'Xe tải thùng 8.0T'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Tài xế phụ trách */}
                          <td className="py-3.5 px-space-md">
                            <div className="flex items-center gap-space-sm">
                              <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary text-label-sm">
                                {driverInitial}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-label-md text-label-md text-on-surface font-semibold">
                                  {truck.driver_name || 'Chưa gán tài xế'}
                                </span>
                                <span className="text-outline text-label-sm font-data-mono">
                                  {truck.driver_phone || 'Sẵn sàng phân ca'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Vị trí GPS & Lộ trình */}
                          <td className="py-3.5 px-space-md">
                            <div className="flex flex-col max-w-xs">
                              <div className="flex items-center gap-1 font-medium text-on-surface">
                                <span className="material-symbols-outlined text-secondary text-[16px]">near_me</span>
                                <span className="truncate">
                                  {truck.current_location || 'Trục Võ Nguyên Giáp → Ga T1 Nội Bài'}
                                </span>
                              </div>
                              <span className="text-outline text-label-sm truncate">
                                {truck.cargo_note || 'Lô Air Cargo linh kiện Samsung (SEVT)'}
                              </span>
                            </div>
                          </td>

                          {/* Tải trọng thực tế */}
                          <td className="py-3.5 px-space-md">
                            <div className="flex flex-col gap-1 w-32">
                              <div className="flex justify-between font-data-mono text-label-sm font-semibold">
                                <span className="text-on-surface">
                                  {truck.capacity_ton || (truck.payload_kg ? (Number(truck.payload_kg) / 1000).toFixed(1) : '1.25')} Tấn
                                </span>
                                <span className="text-secondary">{truck.status === 'ON_TRIP' ? '85%' : '0%'}</span>
                              </div>
                              <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-secondary h-full rounded-full"
                                  style={{ width: truck.status === 'ON_TRIP' ? '85%' : '0%' }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Trạng thái vận hành */}
                          <td className="py-3.5 px-space-md">
                            {truck.status === 'ON_TRIP' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                                Đang trung chuyển
                              </span>
                            ) : truck.status === 'AVAILABLE' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                                Sẵn sàng tại Ga
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-error-container text-error font-label-sm text-label-sm font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                                Bảo dưỡng
                              </span>
                            )}
                          </td>

                          {/* Tác vụ */}
                          <td className="py-3.5 px-space-md text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => message.info(`Đang mở vị trí GPS xe ${truck.plate_number}`)}
                                className="p-1.5 rounded-lg text-secondary hover:bg-surface-container-high transition-colors cursor-pointer"
                                title="Xem định vị GPS"
                              >
                                <span className="material-symbols-outlined text-[19px]">fmd_good</span>
                              </button>
                              <button
                                onClick={() => message.success(`Đang kết nối liên lạc với tài xế ${truck.driver_name || 'phụ trách'}`)}
                                className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
                                title="Gọi tài xế"
                              >
                                <span className="material-symbols-outlined text-[19px]">call</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mini GIS Radar Terminal Summary (1 Column Span) */}
        <div className="xl:col-span-1 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-lg text-label-lg font-bold text-primary">Radar Vận Vực Sân Bay</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">radar</span>
            </div>
            <div className="space-y-3 font-body-sm text-body-sm text-on-surface">
              <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
                <span>Ga T1/T2 Nội Bài (HAN)</span>
                <span className="font-data-mono font-bold text-secondary">22 Xe</span>
              </div>
              <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
                <span>Ga Tân Sơn Nhất (SGN)</span>
                <span className="font-data-mono font-bold text-primary">16 Xe</span>
              </div>
              <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
                <span>KCN Bắc Ninh - Yên Phong</span>
                <span className="font-data-mono font-bold text-on-tertiary-container">8 Xe</span>
              </div>
              <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
                <span>Trục Cao tốc Bắc Nam</span>
                <span className="font-data-mono font-bold text-outline">14 Xe</span>
              </div>
            </div>
          </div>

          {/* Quick Driver Stats Panel */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-lg text-label-lg font-bold text-primary">Hồ sơ Tài xế ({drivers.length})</span>
              <button
                onClick={() => setIsDriverModalOpen(true)}
                className="text-secondary font-label-sm font-semibold hover:underline"
              >
                + Thêm
              </button>
            </div>
            <div className="space-y-2">
              {drivers.slice(0, 4).map((d) => (
                <div key={d.id} className="p-2 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-bold text-xs">
                      {(d.full_name || 'D').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-xs text-on-surface">{d.full_name}</span>
                  </div>
                  <span className="font-data-mono text-xs text-outline">{d.license_number || 'Hạng C'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Thêm Tài Xế */}
      <Modal
        title={<span className="font-headline-sm font-bold text-primary">Đăng Ký Tài Xế Mới Vào Đội Xe</span>}
        open={isDriverModalOpen}
        onCancel={() => setIsDriverModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={driverForm} layout="vertical" onFinish={handleCreateDriver} className="mt-4">
          <Form.Item
            name="full_name"
            label="Họ và tên tài xế"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên tài xế' }]}
          >
            <Input placeholder="Nguyễn Văn A" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="username"
            label="Tên đăng nhập hệ thống"
            rules={[{ required: true, message: 'Vui lòng nhập username' }]}
          >
            <Input placeholder="driver_an" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
          >
            <Input placeholder="0912345678" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="license_number"
            label="Số giấy phép lái xe"
            rules={[{ required: true, message: 'Vui lòng nhập số bằng lái' }]}
          >
            <Input placeholder="B2-88991234" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="license_class"
            label="Hạng bằng lái"
            initialValue="C"
            rules={[{ required: true }]}
          >
            <Select
              className="h-10"
              options={[
                { value: 'B2', label: 'B2 (Xe tải dưới 3.5 tấn)' },
                { value: 'C', label: 'C (Xe tải trên 3.5 tấn)' },
                { value: 'FC', label: 'FC (Xe đầu kéo container)' }
              ]}
            />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setIsDriverModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submittingDriver}
              className="px-5 py-2 rounded-xl bg-secondary text-on-secondary font-semibold hover:bg-secondary-container transition-all cursor-pointer"
            >
              {submittingDriver ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
