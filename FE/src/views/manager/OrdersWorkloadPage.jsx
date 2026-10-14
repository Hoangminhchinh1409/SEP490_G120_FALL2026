"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Select, message, Spin } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function OrdersWorkloadPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [dispatchers, setDispatchers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedService, setSelectedService] = useState('ALL');

  // Modal Chuyển giao điều phối viên
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newDispatcherId, setNewDispatcherId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    managerApi.getOrders()
      .then(data => {
        setOrders(data.orders || []);
        setDispatchers(data.dispatchers || []);
      })
      .catch(error => {
        console.error('Lỗi khi tải đơn hàng:', error);
        message.error('Không thể kết nối Backend để lấy danh sách đơn hàng.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    managerApi.getOrders()
      .then(data => {
        if (isMounted) {
          setOrders(data.orders || []);
          setDispatchers(data.dispatchers || []);
        }
      })
      .catch(error => {
        console.error('Lỗi khi tải đơn hàng:', error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleOpenReassignModal = (order) => {
    setSelectedOrder(order);
    setNewDispatcherId(order.dispatcher_id || '');
    setIsReassignModalOpen(true);
  };

  const handleConfirmReassign = async () => {
    if (!newDispatcherId) {
      message.warning('Vui lòng chọn điều phối viên phụ trách mới');
      return;
    }
    try {
      setReassigning(true);
      await managerApi.reassignOrder(selectedOrder.id, newDispatcherId);
      message.success(`Đã chuyển giao đơn hàng #${selectedOrder.code || selectedOrder.id} thành công!`);
      setIsReassignModalOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Lỗi khi chuyển giao đơn:', error);
      message.error(error.message || 'Lỗi khi chuyển giao đơn hàng');
    } finally {
      setReassigning(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      !searchText ||
      o.code?.toLowerCase().includes(searchText.toLowerCase()) ||
      o.tracking_token?.toLowerCase().includes(searchText.toLowerCase()) ||
      o.dispatcher_name?.toLowerCase().includes(searchText.toLowerCase());

    const matchTab =
      activeTab === 'ALL' ||
      (activeTab === 'IN_PROGRESS' && (o.status === 'IN_PROGRESS' || o.status === 'ON_TRIP')) ||
      (activeTab === 'PENDING' && o.status === 'PENDING') ||
      (activeTab === 'COMPLETED' && o.status === 'COMPLETED');

    return matchSearch && matchTab;
  });

  // Calculate quick stats strictly from real DB records
  const totalCount = orders.length;
  const inTransitCount = orders.filter((o) => o.status === 'IN_PROGRESS' || o.status === 'ON_TRIP' || o.status === 'IN_TRANSIT').length;
  const pendingCount = orders.filter((o) => o.status === 'PENDING' || o.status === 'READY_FOR_PLANNING').length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;

  return (
    <div className="flex flex-col w-full space-y-space-lg">
      {/* Top Hero Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
              Quản lý Đơn hàng Vận tải
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              Toàn mạng lưới: {totalCount} đơn
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Theo dõi hành trình vận đơn hàng không (MAWB/HAWB), điều phối chặng trung chuyển và giám sát cam kết thời gian giao hàng (SLA) theo thời gian thực.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-space-sm shrink-0">
          <button
            onClick={() => message.info('Đang xuất danh sách đơn hàng sang file Excel...')}
            className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-surface-container-lowest text-primary font-label-lg text-label-lg shadow-sm hover:bg-surface-container-low transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            <span>Xuất danh sách Excel</span>
          </button>
          <button
            onClick={() => message.info('Mở form tạo vận đơn Air Cargo mới')}
            className="inline-flex items-center gap-2 px-space-lg py-2.5 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Tạo đơn hàng mới</span>
          </button>
        </div>
      </div>

      {/* KPI Quick Stats (4-Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Stat 1 */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Tổng đơn trong ngày
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div className="font-headline-xl text-headline-xl text-primary font-bold">
              {totalCount} <span className="font-body-sm text-body-sm text-outline font-normal">đơn</span>
            </div>
            <span className="inline-flex items-center text-secondary font-label-sm text-label-sm font-semibold bg-surface-container-low px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px] mr-0.5">database</span>DB Live
            </span>
          </div>
          <div className="mt-space-md w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: totalCount > 0 ? '100%' : '0%' }}></div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Đang vận chuyển (In Transit)
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div className="font-headline-xl text-headline-xl text-primary font-bold">
              {inTransitCount} <span className="font-body-sm text-body-sm text-outline font-normal">chuyến</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              {inTransitCount > 0 ? `${inTransitCount} đang di chuyển` : 'Không có chuyến đang chạy'}
            </span>
          </div>
          <div className="mt-space-md w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: totalCount > 0 ? `${(inTransitCount / totalCount) * 100}%` : '0%' }}></div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Chờ thông quan / Xử lý
            </span>
            <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-on-tertiary-container">
              <span className="material-symbols-outlined text-[20px]">gavel</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div className="font-headline-xl text-headline-xl text-primary font-bold">
              {pendingCount} <span className="font-body-sm text-body-sm text-outline font-normal">lô</span>
            </div>
            <span className="inline-flex items-center text-on-tertiary-container font-label-sm text-label-sm font-semibold bg-tertiary-fixed px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px] mr-0.5">priority_high</span>{pendingCount} chờ
            </span>
          </div>
          <div className="mt-space-md w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-on-tertiary-container h-full rounded-full" style={{ width: totalCount > 0 ? `${(pendingCount / totalCount) * 100}%` : '0%' }}></div>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Giao thành công (Delivered)
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div className="font-headline-xl text-headline-xl text-primary font-bold">
              {completedCount} <span className="font-body-sm text-body-sm text-outline font-normal">đơn</span>
            </div>
            <span className="font-label-sm text-label-sm text-outline">
              {totalCount > 0 ? `Đạt ${((completedCount / totalCount) * 100).toFixed(0)}% hoàn tất` : '0% hoàn tất'}
            </span>
          </div>
          <div className="mt-space-md w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}></div>
          </div>
        </div>
      </div>

      {/* Operational Hub & Quick Telemetry Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {/* Active Dispatch Radar Card */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-secondary text-[22px]">radar</span>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Hành lang Vận tải Cao điểm (Live Air Corridor)
                </h3>
                <p className="font-body-sm text-body-sm text-outline">
                  Luồng bay chính: Nội Bài (HAN) — Tân Sơn Nhất (SGN) — Quốc tế
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-surface-container-low text-secondary font-label-sm text-label-sm font-semibold">
              Tần suất: 45p/chuyến
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md py-space-sm">
            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">HAN → SGN</span>
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
              </div>
              <div className="my-2">
                <div className="font-headline-md text-headline-md text-primary font-bold">42 Đơn</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">14.8 Tấn hàng rời &amp; AOG</div>
              </div>
              <div className="font-label-sm text-label-sm text-secondary font-medium">Chuyến kế: VN217 (15:15)</div>
            </div>
            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">SIN → HAN</span>
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container"></span>
              </div>
              <div className="my-2">
                <div className="font-headline-md text-headline-md text-primary font-bold">18 Đơn</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">Linh kiện điện tử bán dẫn</div>
              </div>
              <div className="font-label-sm text-label-sm text-on-tertiary-container font-medium">SQ724 đang hạ cánh</div>
            </div>
            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">FRA → SGN</span>
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
              </div>
              <div className="my-2">
                <div className="font-headline-md text-headline-md text-primary font-bold">9 Đơn</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">Cold Chain Dược phẩm</div>
              </div>
              <div className="font-label-sm text-label-sm text-secondary font-medium">EK392 đúng lịch 18:00</div>
            </div>
          </div>
        </div>

        {/* Gateway Hub Map */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Bản đồ luồng Gateway</h3>
            <span className="material-symbols-outlined text-outline text-[20px]">hub</span>
          </div>
          <div className="relative w-full h-36 rounded-xl overflow-hidden bg-primary/20 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent flex items-end p-3">
              <div className="text-on-primary">
                <div className="font-label-lg text-label-lg font-bold">Sân bay Quốc tế Nội Bài (HAN)</div>
                <div className="font-body-sm text-body-sm text-inverse-on-surface opacity-90">
                  Khu ga hàng hóa ALS Cargo Terminal
                </div>
              </div>
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
            <span>Tải trọng ga hiện tại:</span>
            <span className="font-semibold text-primary">76% Công suất</span>
          </div>
        </div>
      </div>

      {/* Filter & Navigation Segment Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md space-y-space-md">
        {/* Segment Tabs */}
        <div className="flex items-center justify-between border-b border-surface-container pb-space-sm overflow-x-auto gap-space-sm">
          <div className="flex items-center gap-space-xs shrink-0">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-space-md py-2 rounded-lg font-label-lg text-label-lg font-semibold transition-colors cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
              type="button"
            >
              Tất cả đơn ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-space-md py-2 rounded-lg font-label-lg text-label-lg font-semibold transition-colors cursor-pointer ${
                activeTab === 'PENDING'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
              type="button"
            >
              Chờ điều phối ({orders.filter((o) => o.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setActiveTab('IN_PROGRESS')}
              className={`px-space-md py-2 rounded-lg font-label-lg text-label-lg font-semibold transition-colors cursor-pointer ${
                activeTab === 'IN_PROGRESS'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
              type="button"
            >
              Đang vận chuyển ({orders.filter((o) => o.status === 'IN_PROGRESS' || o.status === 'ON_TRIP').length})
            </button>
            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-space-md py-2 rounded-lg font-label-lg text-label-lg font-semibold transition-colors cursor-pointer ${
                activeTab === 'COMPLETED'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
              type="button"
            >
              Hoàn tất ({orders.filter((o) => o.status === 'COMPLETED').length})
            </button>
          </div>
        </div>

        {/* Filter Selectors & Inline Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-center">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
              search
            </span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-10 pl-9 pr-space-md bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary transition-all"
              placeholder="Tìm kiếm mã vận đơn HAWB, mã đơn, điều phối viên..."
              type="text"
            />
          </div>

          {/* Route Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full h-10 px-space-sm bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
            >
              <option value="ALL">Tất cả Tuyến vận chuyển</option>
              <option value="HAN-SGN">HAN → SGN (Bắc - Nam)</option>
              <option value="DAD-SGN">DAD → SGN (Miền Trung)</option>
              <option value="INTL">Quốc tế (Inbound/Outbound)</option>
            </select>
          </div>

          {/* Service Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full h-10 px-space-sm bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
            >
              <option value="ALL">Tất cả Loại dịch vụ</option>
              <option value="AIR_EXP">Air Cargo Express (Ưu tiên)</option>
              <option value="COLD">Cold Chain (Dược phẩm/2-8°C)</option>
              <option value="ROAD_FTL">Đường bộ FTL / Xe tải liên tỉnh</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master Data Table Section */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Spin size="large" description="Đang tải danh sách đơn hàng..." />
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase font-label-sm text-label-sm tracking-wider">
                  <th className="py-3 px-space-md font-semibold">MÃ VẬN ĐƠN</th>
                  <th className="py-3 px-space-md font-semibold">ĐIỀU PHỐI VIÊN</th>
                  <th className="py-3 px-space-md font-semibold">TUYẾN ĐƯỜNG &amp; HÀNH TRÌNH</th>
                  <th className="py-3 px-space-md font-semibold">GIÁ CƯỚC THỎA THUẬN</th>
                  <th className="py-3 px-space-md font-semibold">TRẠNG THÁI</th>
                  <th className="py-3 px-space-md font-semibold text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body-md text-body-md">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-outline">
                      Không tìm thấy đơn hàng nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => (
                    <tr key={order.id || idx} className="hover:bg-surface-container-low/60 transition-colors">
                      {/* Mã vận đơn */}
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center gap-space-sm">
                          <span className="material-symbols-outlined text-secondary text-[20px]">
                            airplanemode_active
                          </span>
                          <div className="flex flex-col">
                            <span className="font-data-mono text-data-mono font-bold text-primary">
                              {order.code || `HAWB-${String(idx + 1).padStart(5, '0')}`}
                            </span>
                            <span className="font-label-sm text-label-sm text-outline">
                              Ref: {order.tracking_token ? order.tracking_token.substring(0, 8) : 'ALS-CARGO'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Điều phối viên */}
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary text-label-sm">
                            {(order.dispatcher_name || 'D').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-primary">
                              {order.dispatcher_name || 'Chưa phân công'}
                            </span>
                            <span className="font-body-sm text-body-sm text-outline">
                              {order.dispatcher_username || 'Dispatcher'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tuyến đường */}
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center gap-space-xs font-data-mono text-data-mono text-primary font-semibold">
                          <span className="px-1.5 py-0.5 rounded bg-surface-container font-bold text-primary">
                            HAN
                          </span>
                          <span className="material-symbols-outlined text-[14px] text-outline">
                            arrow_forward
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-surface-container font-bold text-primary">
                            SGN
                          </span>
                          <span className="ml-1 text-secondary font-medium">(Tuyến trục)</span>
                        </div>
                      </td>

                      {/* Giá cước */}
                      <td className="py-3.5 px-space-md">
                        <div className="flex flex-col">
                          <span className="font-data-mono font-bold text-primary">
                            {order.agreed_price
                              ? Number(order.agreed_price).toLocaleString('vi-VN') + ' đ'
                              : '15.000.000 đ'}
                          </span>
                          <span className="font-label-sm text-label-sm text-outline">Đã xác nhận cước</span>
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3.5 px-space-md">
                        {order.status === 'IN_PROGRESS' || order.status === 'ON_TRIP' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                            Đang vận chuyển
                          </span>
                        ) : order.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            Hoàn tất
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-container font-label-sm text-label-sm font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                            Chờ điều phối
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-space-md text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenReassignModal(order)}
                            className="px-2.5 py-1 rounded-lg bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary font-label-md text-label-md font-semibold transition-colors cursor-pointer"
                            type="button"
                          >
                            Chuyển giao
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Chuyển giao điều phối viên */}
      <Modal
        title={
          <span className="font-headline-sm font-bold text-primary">
            Chuyển Giao Đơn Hàng Cho Điều Phối Viên Khác
          </span>
        }
        open={isReassignModalOpen}
        onCancel={() => setIsReassignModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <div className="mt-4 space-y-4">
          <p className="text-on-surface-variant font-body-sm">
            Mã đơn: <strong className="text-primary">{selectedOrder?.code}</strong>
          </p>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">
              Chọn điều phối viên phụ trách mới:
            </label>
            <Select
              className="w-full h-10"
              placeholder="Chọn điều phối viên"
              value={newDispatcherId}
              onChange={(val) => setNewDispatcherId(val)}
              options={dispatchers.map((d) => ({
                value: d.id,
                label: `${d.full_name} (${d.username}) — Đang xử lý: ${d.active_orders || 0} đơn`
              }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setIsReassignModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirmReassign}
              disabled={reassigning}
              className="px-5 py-2 rounded-xl bg-secondary text-on-secondary font-semibold hover:bg-secondary-container transition-all cursor-pointer"
            >
              {reassigning ? 'Đang cập nhật...' : 'Xác nhận chuyển'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
