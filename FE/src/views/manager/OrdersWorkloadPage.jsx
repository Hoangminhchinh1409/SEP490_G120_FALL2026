"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Select, message, Spin, Tag, Input, Tooltip } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function OrdersWorkloadPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [flaggedOrders, setFlaggedOrders] = useState([]);
  const [dispatchers, setDispatchers] = useState([]);
  const [summary, setSummary] = useState({ total_orders: 0, flagged_count: 0, active_dispatchers: 0 });

  // Filtering & search
  const [activeMainTab, setActiveMainTab] = useState('FLAGGED'); // 'WORKLOAD', 'FLAGGED', 'ALL'
  const [flagFilter, setFlagFilter] = useState('ALL'); // 'ALL', 'WAITING', 'DOCS', 'LATE'
  const [orderStatusTab, setOrderStatusTab] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  // Modal Điều chuyển (Reassign)
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newDispatcherId, setNewDispatcherId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Modal Chi tiết đơn hàng (Screen 09 Read-only)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);

  const fetchWorkloadData = async () => {
    setLoading(true);
    try {
      const data = await managerApi.getOrders();
      setOrders(data.orders || []);
      setFlaggedOrders(data.flagged_orders || []);
      setDispatchers(data.dispatchers || []);
      setSummary(data.summary || {
        total_orders: (data.orders || []).length,
        flagged_count: (data.flagged_orders || []).length,
        active_dispatchers: (data.dispatchers || []).length
      });
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu khối lượng đơn:', error);
      message.error('Không thể kết nối Backend để lấy dữ liệu tải điều phối.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const data = await managerApi.getOrders();
        if (!ignore) {
          setOrders(data.orders || []);
          setFlaggedOrders(data.flagged_orders || []);
          setDispatchers(data.dispatchers || []);
          setSummary(data.summary || {
            total_orders: (data.orders || []).length,
            flagged_count: (data.flagged_orders || []).length,
            active_dispatchers: (data.dispatchers || []).length
          });
        }
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu khối lượng đơn:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadInitial();
    return () => { ignore = true; };
  }, []);

  // Mở Modal điều chuyển
  const handleOpenReassignModal = (order) => {
    setSelectedOrder(order);
    setNewDispatcherId(order.responsible_dispatcher_id || order.dispatcher_id || '');
    setReassignReason('');
    setIsReassignModalOpen(true);
  };

  // Xác nhận điều chuyển
  const handleConfirmReassign = async () => {
    if (!newDispatcherId) {
      message.warning('Vui lòng chọn điều phối viên phụ trách mới (MSG02).');
      return;
    }
    try {
      setReassigning(true);
      const res = await managerApi.reassignOrder(selectedOrder.id, newDispatcherId, reassignReason);
      message.success(res.message || `Đơn hàng #${selectedOrder.code || selectedOrder.id} đã được điều chuyển thành công!`);
      setIsReassignModalOpen(false);
      fetchWorkloadData();
    } catch (error) {
      console.error('Lỗi khi điều chuyển đơn:', error);
      message.error(error.message || 'Lỗi khi điều chuyển đơn hàng');
    } finally {
      setReassigning(false);
    }
  };

  // Mở modal xem chi tiết đơn hàng (Screen 09 Read-only)
  const handleOpenDetailModal = async (orderId) => {
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const detail = await managerApi.getOrderDetail(orderId);
      setOrderDetail(detail);
    } catch (error) {
      console.error('Lỗi xem chi tiết đơn:', error);
      message.error('Không thể tải chi tiết đơn hàng.');
      setIsDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Lọc danh sách đơn bị gắn cờ
  const filteredFlagged = flaggedOrders.filter((o) => {
    const matchSearch =
      !searchText ||
      o.code?.toLowerCase().includes(searchText.toLowerCase()) ||
      o.dispatcher_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      o.flag_reason?.toLowerCase().includes(searchText.toLowerCase());

    if (!matchSearch) return false;

    if (flagFilter === 'WAITING') return o.waiting_too_long;
    if (flagFilter === 'DOCS') return o.overdue_docs;
    if (flagFilter === 'LATE') return o.late_risk;
    return true;
  });

  // Lọc toàn bộ đơn hàng
  const filteredAllOrders = orders.filter((o) => {
    const matchSearch =
      !searchText ||
      o.code?.toLowerCase().includes(searchText.toLowerCase()) ||
      o.dispatcher_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      o.tracking_token?.toLowerCase().includes(searchText.toLowerCase());

    const matchTab =
      orderStatusTab === 'ALL' ||
      (orderStatusTab === 'IN_TRANSIT' && (o.status === 'IN_TRANSIT' || o.status === 'ON_TRIP')) ||
      (orderStatusTab === 'CONFIRMED' && (o.status === 'CONFIRMED' || o.status === 'READY_FOR_PLANNING')) ||
      (orderStatusTab === 'DRAFT' && o.status === 'DRAFT') ||
      (orderStatusTab === 'COMPLETED' && o.status === 'COMPLETED');

    return matchSearch && matchTab;
  });

  const waitingCount = flaggedOrders.filter((o) => o.waiting_too_long).length;
  const docsCount = flaggedOrders.filter((o) => o.overdue_docs).length;
  const lateCount = flaggedOrders.filter((o) => o.late_risk).length;

  return (
    <div className="flex flex-col w-full space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="flex flex-col space-y-1 z-10">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
              Giám Sát Tải & Đơn Hàng Ách Tắc
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
              {flaggedOrders.length} Đơn cần can thiệp gấp
            </span>
          </div>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl">
            Theo dõi khối lượng công việc của từng điều phối viên, cảnh báo đơn chờ quá lâu (BR-25), quá hạn chứng từ (MSG41), nguy cơ trễ hẹn (BR-13) và điều chuyển linh hoạt (UC-21, UC-22).
          </p>
        </div>

        <div className="flex items-center gap-space-sm shrink-0 z-10">
          <button
            onClick={fetchWorkloadData}
            className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-surface-container-low text-primary font-label-lg text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>Làm mới số liệu</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-outline uppercase font-semibold">Tổng đơn quản lý</span>
            <span className="material-symbols-outlined text-primary text-[22px]">assignment</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-primary">{summary.total_orders || orders.length}</div>
            <div className="text-xs text-on-surface-variant">Toàn bộ đơn trên hệ thống</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-error uppercase font-semibold">Đơn bị gắn cờ</span>
            <span className="material-symbols-outlined text-error text-[22px]">flag</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-error">{flaggedOrders.length}</div>
            <div className="text-xs text-on-surface-variant">Cần xem xét và tái phân bổ</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-error h-full rounded-full"
              style={{ width: `${orders.length ? Math.min((flaggedOrders.length / orders.length) * 100, 100) : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-tertiary uppercase font-semibold">Chờ quá lâu (BR-25)</span>
            <span className="material-symbols-outlined text-tertiary text-[22px]">timer_off</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-tertiary">{waitingCount}</div>
            <div className="text-xs text-on-surface-variant">Draft &gt;4h hoặc Confirmed &gt;8h</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-tertiary h-full rounded-full"
              style={{ width: `${flaggedOrders.length ? (waitingCount / flaggedOrders.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-secondary uppercase font-semibold">Điều phối viên</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">groups</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-secondary">{dispatchers.length}</div>
            <div className="text-xs text-on-surface-variant">Đang trực xử lý đơn hàng</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md border border-outline-variant/20">
        <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container pb-space-sm">
          <div className="flex items-center gap-space-xs">
            <button
              onClick={() => setActiveMainTab('FLAGGED')}
              className={`px-4 py-2 rounded-xl font-label-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'FLAGGED'
                  ? 'bg-error text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">emergency</span>
              <span>Đơn Bị Gắn Cờ ({flaggedOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveMainTab('WORKLOAD')}
              className={`px-4 py-2 rounded-xl font-label-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'WORKLOAD'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">bar_chart</span>
              <span>Tải Điều Phối Viên ({dispatchers.length})</span>
            </button>

            <button
              onClick={() => setActiveMainTab('ALL')}
              className={`px-4 py-2 rounded-xl font-label-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'ALL'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">list_alt</span>
              <span>Tất Cả Đơn Hàng ({orders.length})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-72 relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
              search
            </span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-9 pl-9 pr-space-md bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
              placeholder="Tìm theo mã đơn, ĐPV, lý do..."
              type="text"
            />
          </div>
        </div>

        {/* SUB-TAB 1: FLAGGED ORDERS (TABLE 2 - SCREEN 18) */}
        {activeMainTab === 'FLAGGED' && (
          <div className="mt-space-md space-y-space-md">
            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-outline">Lọc loại cờ:</span>
              <button
                onClick={() => setFlagFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  flagFilter === 'ALL' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Tất cả ({flaggedOrders.length})
              </button>
              <button
                onClick={() => setFlagFilter('WAITING')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  flagFilter === 'WAITING' ? 'bg-amber-600 text-white' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Chờ quá lâu (BR-25) ({waitingCount})
              </button>
              <button
                onClick={() => setFlagFilter('DOCS')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  flagFilter === 'DOCS' ? 'bg-purple-600 text-white' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Quá hạn chứng từ (MSG41) ({docsCount})
              </button>
              <button
                onClick={() => setFlagFilter('LATE')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  flagFilter === 'LATE' ? 'bg-red-600 text-white' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Nguy cơ trễ (BR-13) ({lateCount})
              </button>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center"><Spin size="large" /></div>
            ) : filteredFlagged.length === 0 ? (
              <div className="py-12 text-center text-outline bg-surface-container-low/30 rounded-xl">
                <span className="material-symbols-outlined text-4xl text-secondary mb-2">check_circle</span>
                <p className="font-semibold text-on-surface">Không có đơn hàng nào bị ách tắc hoặc gắn cờ!</p>
                <p className="text-xs text-outline mt-1">Toàn bộ luồng điều phối đang vận hành trong ngưỡng cam kết SLA.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                      <th className="py-3 px-space-md">MÃ ĐƠN</th>
                      <th className="py-3 px-space-md">LOẠI ĐƠN</th>
                      <th className="py-3 px-space-md">LÝ DO GẮN CỜ</th>
                      <th className="py-3 px-space-md">THỜI GIAN TỒN</th>
                      <th className="py-3 px-space-md">ĐPV PHỤ TRÁCH</th>
                      <th className="py-3 px-space-md text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-sm">
                    {filteredFlagged.map((o) => (
                      <tr key={o.id} className="hover:bg-error-container/10 transition-colors">
                        <td className="py-3 px-space-md font-mono font-bold text-primary">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                            <span>{o.code || o.order_code || `ORD-#${o.id}`}</span>
                          </div>
                        </td>
                        <td className="py-3 px-space-md">
                          <Tag color={o.order_type === 'Import' ? 'blue' : 'cyan'}>
                            {o.order_type || 'Export'}
                          </Tag>
                        </td>
                        <td className="py-3 px-space-md">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-error-container text-on-error-container text-xs font-bold">
                            {o.flag_reason}
                          </span>
                        </td>
                        <td className="py-3 px-space-md font-medium text-on-surface-variant">
                          <span className="text-error font-bold">{o.age_hours} giờ</span> trôi qua
                        </td>
                        <td className="py-3 px-space-md">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-xs text-primary">
                              {(o.dispatcher_name || 'D').charAt(0)}
                            </div>
                            <span className="font-semibold text-primary">{o.dispatcher_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-space-md text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetailModal(o.id)}
                              className="px-2.5 py-1 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container text-xs font-semibold cursor-pointer"
                            >
                              Chi tiết
                            </button>
                            <button
                              onClick={() => handleOpenReassignModal(o)}
                              className="px-3 py-1 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-container text-xs font-bold shadow-sm transition-all cursor-pointer"
                            >
                              Điều chuyển
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: DISPATCHER WORKLOAD (TABLE 1 - SCREEN 18) */}
        {activeMainTab === 'WORKLOAD' && (
          <div className="mt-space-md space-y-space-md">
            {loading ? (
              <div className="py-16 flex justify-center"><Spin size="large" /></div>
            ) : dispatchers.length === 0 ? (
              <div className="py-12 text-center text-outline">Chưa có điều phối viên nào trong hệ thống.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                      <th className="py-3 px-space-md">ĐIỀU PHỐI VIÊN</th>
                      <th className="py-3 px-space-md">TỔNG ĐƠN ĐÃ GÁN</th>
                      <th className="py-3 px-space-md">ĐANG XỬ LÝ (ACTIVE)</th>
                      <th className="py-3 px-space-md">ĐƠN BỊ GẮN CỜ</th>
                      <th className="py-3 px-space-md">HOÀN TẤT</th>
                      <th className="py-3 px-space-md w-56">MỨC ĐỘ TẢI (% LOAD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-sm">
                    {dispatchers.map((d) => {
                      const isOverloaded = d.load_percent >= 90;
                      const isHigh = d.load_percent >= 70 && d.load_percent < 90;
                      const loadColor = isOverloaded ? 'bg-error' : isHigh ? 'bg-amber-500' : 'bg-secondary';

                      return (
                        <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3.5 px-space-md">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                {d.full_name?.charAt(0) || d.username?.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-primary">{d.full_name}</div>
                                <div className="text-xs text-outline font-mono">@{d.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-space-md font-bold text-primary">{d.total_orders}</td>
                          <td className="py-3.5 px-space-md">
                            <span className="font-bold text-primary">{d.active_orders}</span>
                            <span className="text-xs text-outline ml-1">đơn</span>
                          </td>
                          <td className="py-3.5 px-space-md">
                            {d.flagged_orders > 0 ? (
                              <Tag color="red" className="font-bold">
                                {d.flagged_orders} đơn cảnh báo
                              </Tag>
                            ) : (
                              <span className="text-xs text-secondary font-semibold">Bình thường</span>
                            )}
                          </td>
                          <td className="py-3.5 px-space-md font-medium text-on-surface-variant">
                            {d.completed_orders} đơn
                          </td>
                          <td className="py-3.5 px-space-md">
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${loadColor}`} style={{ width: `${d.load_percent}%` }}></div>
                              </div>
                              <span className={`text-xs font-bold w-10 text-right ${isOverloaded ? 'text-error' : isHigh ? 'text-amber-600' : 'text-secondary'}`}>
                                {d.load_percent}%
                              </span>
                            </div>
                            {isOverloaded && (
                              <span className="text-[10px] text-error font-bold mt-0.5 block">
                                Cảnh báo: Quá tải!
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: ALL ORDERS TABLE */}
        {activeMainTab === 'ALL' && (
          <div className="mt-space-md space-y-space-md">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOrderStatusTab('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  orderStatusTab === 'ALL' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Tất cả ({orders.length})
              </button>
              <button
                onClick={() => setOrderStatusTab('IN_TRANSIT')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  orderStatusTab === 'IN_TRANSIT' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Đang vận chuyển ({orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'ON_TRIP').length})
              </button>
              <button
                onClick={() => setOrderStatusTab('CONFIRMED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  orderStatusTab === 'CONFIRMED' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Chờ gán chuyến ({orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'READY_FOR_PLANNING').length})
              </button>
              <button
                onClick={() => setOrderStatusTab('DRAFT')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  orderStatusTab === 'DRAFT' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Bản nháp ({orders.filter((o) => o.status === 'DRAFT').length})
              </button>
              <button
                onClick={() => setOrderStatusTab('COMPLETED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  orderStatusTab === 'COMPLETED' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Hoàn tất ({orders.filter((o) => o.status === 'COMPLETED').length})
              </button>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center"><Spin size="large" /></div>
            ) : filteredAllOrders.length === 0 ? (
              <div className="py-12 text-center text-outline">Không tìm thấy đơn hàng nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                      <th className="py-3 px-space-md">MÃ ĐƠN</th>
                      <th className="py-3 px-space-md">LOẠI ĐƠN</th>
                      <th className="py-3 px-space-md">ĐIỀU PHỐI VIÊN</th>
                      <th className="py-3 px-space-md">GIÁ THỎA THUẬN</th>
                      <th className="py-3 px-space-md">TRẠNG THÁI</th>
                      <th className="py-3 px-space-md text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-sm">
                    {filteredAllOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3.5 px-space-md font-mono font-bold text-primary">
                          <div className="flex items-center gap-2">
                            {o.is_flagged && (
                              <Tooltip title={o.flag_reason}>
                                <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                              </Tooltip>
                            )}
                            <span>{o.code || o.order_code || `ORD-#${o.id}`}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-space-md">
                          <Tag color={o.order_type === 'Import' ? 'blue' : 'cyan'}>
                            {o.order_type || 'Export'}
                          </Tag>
                        </td>
                        <td className="py-3.5 px-space-md">
                          <span className="font-semibold text-primary">{o.dispatcher_name}</span>
                        </td>
                        <td className="py-3.5 px-space-md font-mono font-semibold text-primary">
                          {o.agreed_price ? Number(o.agreed_price).toLocaleString('vi-VN') + ' đ' : 'Chưa có giá'}
                        </td>
                        <td className="py-3.5 px-space-md">
                          <Tag color={
                            o.status === 'IN_TRANSIT' ? 'orange' :
                            o.status === 'COMPLETED' ? 'green' :
                            o.status === 'DRAFT' ? 'default' : 'blue'
                          }>
                            {o.status}
                          </Tag>
                        </td>
                        <td className="py-3.5 px-space-md text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetailModal(o.id)}
                              className="px-2.5 py-1 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container text-xs font-semibold cursor-pointer"
                            >
                              Xem
                            </button>
                            <button
                              onClick={() => handleOpenReassignModal(o)}
                              className="px-2.5 py-1 rounded-lg bg-surface-container text-secondary hover:bg-secondary hover:text-white text-xs font-semibold transition-all cursor-pointer"
                            >
                              Chuyển
                            </button>
                          </div>
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

      {/* MODAL 1: ĐIỀU CHUYỂN ĐƠN HÀNG (UC-22 - SCREEN 18) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-headline-sm font-bold">
            <span className="material-symbols-outlined text-secondary">sync_alt</span>
            <span>Điều Chuyển Đơn Hàng Sang Điều Phối Viên Khác</span>
          </div>
        }
        open={isReassignModalOpen}
        onCancel={() => setIsReassignModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <div className="mt-4 space-y-4">
          <div className="p-3 bg-surface-container-low rounded-xl text-xs space-y-1">
            <div>Mã đơn: <strong className="text-primary font-mono">{selectedOrder?.code || selectedOrder?.order_code}</strong></div>
            <div>Loại đơn: <Tag color="blue">{selectedOrder?.order_type || 'Export'}</Tag></div>
            <div>ĐPV hiện tại: <strong className="text-primary">{selectedOrder?.dispatcher_name}</strong></div>
            {selectedOrder?.flag_reason && (
              <div className="text-error font-semibold">Cảnh báo: {selectedOrder?.flag_reason}</div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-outline mb-1">
              Chọn Điều Phối Viên Mới Phụ Trách: *
            </label>
            <Select
              className="w-full h-10"
              placeholder="Chọn điều phối viên"
              value={newDispatcherId}
              onChange={(val) => setNewDispatcherId(val)}
              options={dispatchers.map((d) => ({
                value: d.id,
                label: `${d.full_name} (@${d.username}) — Đang xử lý: ${d.active_orders} đơn (${d.load_percent}% tải)`
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-outline mb-1">
              Lý do điều chuyển (Lưu nhật ký activity_logs):
            </label>
            <Input.TextArea
              rows={2}
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              placeholder="VD: Điều chuyển giảm tải do đơn ách tắc quá lâu theo BR-25"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
            <button
              onClick={() => setIsReassignModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirmReassign}
              disabled={reassigning}
              className="px-5 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-all cursor-pointer shadow-sm"
            >
              {reassigning ? 'Đang điều chuyển...' : 'Xác nhận điều chuyển (MSG29)'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: XEM CHI TIẾT ĐƠN HÀNG CHẾ ĐỘ CHỈ ĐỌC (SCREEN 09 READ-ONLY) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-headline-sm font-bold">
            <span className="material-symbols-outlined text-primary">visibility</span>
            <span>Chi Tiết Đơn Hàng (Chế độ xem xét dành cho Quản lý)</span>
          </div>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <button
            key="close"
            onClick={() => setIsDetailModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-surface-container text-primary font-semibold text-xs cursor-pointer"
          >
            Đóng
          </button>
        ]}
        width={750}
        destroyOnHidden
      >
        {detailLoading ? (
          <div className="py-12 flex justify-center"><Spin size="large" /></div>
        ) : !orderDetail ? (
          <div className="py-8 text-center text-outline">Không tìm thấy thông tin đơn hàng.</div>
        ) : (
          <div className="space-y-4 text-sm mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-surface-container-low rounded-xl">
              <div>
                <span className="text-xs text-outline block">Mã đơn:</span>
                <span className="font-mono font-bold text-primary">{orderDetail.order_code || orderDetail.code}</span>
              </div>
              <div>
                <span className="text-xs text-outline block">Loại đơn (V2):</span>
                <Tag color={orderDetail.order_type === 'Import' ? 'blue' : 'cyan'}>
                  {orderDetail.order_type || 'Export'}
                </Tag>
              </div>
              <div>
                <span className="text-xs text-outline block">Trạng thái:</span>
                <Tag color="orange">{orderDetail.status}</Tag>
              </div>
              <div>
                <span className="text-xs text-outline block">Trạng thái chứng từ:</span>
                <Tag color={orderDetail.document_status === 'APPROVED' ? 'green' : 'gold'}>
                  {orderDetail.document_status || 'PENDING'}
                </Tag>
              </div>
              <div>
                <span className="text-xs text-outline block">Giá thỏa thuận:</span>
                <span className="font-mono font-bold text-primary">
                  {orderDetail.agreed_price ? Number(orderDetail.agreed_price).toLocaleString('vi-VN') + ' đ' : 'Chưa có'}
                </span>
              </div>
              <div>
                <span className="text-xs text-outline block">ĐPV phụ trách:</span>
                <span className="font-semibold text-primary">
                  {orderDetail.dispatcher?.full_name || orderDetail.dispatcher?.username || 'Chưa gán'}
                </span>
              </div>
            </div>

            {/* Thông tin giao nhận */}
            <div className="border border-surface-container rounded-xl p-3 space-y-2">
              <div className="text-xs font-bold uppercase text-outline">Thông tin liên hệ & Giao nhận:</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-outline">Người nhận / Doanh nghiệp:</span>{' '}
                  <strong className="text-primary">{orderDetail.receiver_name || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-outline">Số điện thoại:</span>{' '}
                  <strong className="text-primary">{orderDetail.receiver_phone || 'N/A'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-outline">Địa chỉ giao:</span>{' '}
                  <span className="text-primary">{orderDetail.delivery_address || 'Địa chỉ tiêu chuẩn kho vận ALS'}</span>
                </div>
              </div>
            </div>

            {/* Chế độ chỉ đọc thông báo */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-800">
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span>
                <strong>Chế độ Read-only (Screen 09):</strong> Quản lý chỉ xem xét thông tin để đánh giá tiến độ và hỗ trợ điều phối. Việc sửa đổi chi tiết hàng hóa do Điều phối viên thực hiện.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
