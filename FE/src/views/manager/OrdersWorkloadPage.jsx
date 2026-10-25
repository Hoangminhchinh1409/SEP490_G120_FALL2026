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

  // Bộ chọn điều phối nhanh ở dưới bảng (Khớp Section 3 trong Prototype Figure 39)
  const [selectedOrderForReassign, setSelectedOrderForReassign] = useState(null);
  const [quickTargetDispatcherId, setQuickTargetDispatcherId] = useState(null);
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Tab xem thêm: 'FLAGGED' (Mặc định chuẩn Figure 39) hoặc 'ALL_ORDERS'
  const [viewTab, setViewTab] = useState('FLAGGED');
  const [searchText, setSearchText] = useState('');

  // Modal Chi tiết đơn hàng (Screen 09 Read-only)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);

  // Modal Xác nhận điều chuyển
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

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
      if (data.dispatchers && data.dispatchers.length > 0 && !quickTargetDispatcherId) {
        setQuickTargetDispatcherId(data.dispatchers[0].id);
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu khối lượng đơn:', error);
      message.error('Không thể tải dữ liệu tải điều phối từ cơ sở dữ liệu.');
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
          if (data.dispatchers && data.dispatchers.length > 0) {
            setQuickTargetDispatcherId(data.dispatchers[0].id);
          }
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

  // Xử lý nút "Chuyển" trên từng dòng đơn
  const handleSelectOrderToReassign = (order) => {
    setSelectedOrderForReassign(order);
    setIsConfirmModalOpen(true);
  };

  // Xác nhận điều chuyển đơn hàng
  const handleExecuteReassign = async () => {
    if (!selectedOrderForReassign) {
      message.warning('Vui lòng chọn đơn hàng cần điều chuyển.');
      return;
    }
    if (!quickTargetDispatcherId) {
      message.warning('Vui lòng chọn điều phối viên nhận đơn.');
      return;
    }
    try {
      setReassigning(true);
      const res = await managerApi.reassignOrder(
        selectedOrderForReassign.id,
        quickTargetDispatcherId,
        reassignReason || 'Quản lý điều chuyển cân bằng tải'
      );
      message.success(res.message || `Đã điều chuyển đơn #${selectedOrderForReassign.code || selectedOrderForReassign.id} thành công!`);
      setIsConfirmModalOpen(false);
      setSelectedOrderForReassign(null);
      setReassignReason('');
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

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Header Section Khớp Figure 39 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              Khối lượng đơn
            </h1>
            <Tag color={flaggedOrders.length > 0 ? "error" : "green"} className="font-bold text-xs">
              {flaggedOrders.length > 0 ? `${flaggedOrders.length} Đơn bị gắn cờ` : "0 Đơn bị gắn cờ"}
            </Tag>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Giám sát tải công việc của từng điều phối viên và xử lý các đơn hàng ách tắc (chờ quá lâu hoặc quá hạn chứng từ).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWorkloadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: TẢI CỦA TỪNG ĐIỀU PHỐI (BẢNG 1 - FIGURE 39) */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-primary">
            Tải của từng điều phối
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            Tổng cộng: {dispatchers.length} điều phối viên
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><Spin /></div>
        ) : dispatchers.length === 0 ? (
          <div className="py-6 text-center text-on-surface-variant text-xs">
            Chưa ghi nhận điều phối viên nào trong hệ thống.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider border-b border-surface-container">
                  <th className="py-3 px-4">Điều phối</th>
                  <th className="py-3 px-4 text-center">Đơn đang xử lý</th>
                  <th className="py-3 px-4 text-center">Đơn bị gắn cờ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {dispatchers.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-primary">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {d.full_name?.charAt(0) || 'Đ'}
                        </div>
                        <div>
                          <div>{d.full_name || d.username}</div>
                          <div className="text-[10px] text-on-surface-variant font-mono">{d.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-primary">
                      {d.active_orders}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {d.flagged_orders > 0 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-error/10 text-error font-black">
                          {d.flagged_orders}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant font-medium">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: ĐƠN BỊ GẮN CỜ (BẢNG 2 - FIGURE 39) */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container pb-3">
          <div>
            <h2 className="text-base font-extrabold text-primary">
              Đơn bị gắn cờ <span className="text-xs font-normal text-on-surface-variant">(chờ quá lâu hoặc quá hạn chứng từ)</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewTab('FLAGGED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewTab === 'FLAGGED'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-primary'
              }`}
            >
              Đơn bị gắn cờ ({flaggedOrders.length})
            </button>
            <button
              onClick={() => setViewTab('ALL_ORDERS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewTab === 'ALL_ORDERS'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-primary'
              }`}
            >
              Tất cả đơn ({orders.length})
            </button>
          </div>
        </div>

        {/* Bảng Đơn bị gắn cờ hoặc Tất cả đơn */}
        {loading ? (
          <div className="py-12 flex justify-center"><Spin /></div>
        ) : (viewTab === 'FLAGGED' ? flaggedOrders : orders).length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant bg-surface-container-low/30 rounded-2xl border border-dashed border-surface-container">
            <span className="material-symbols-outlined text-4xl text-emerald-600 mb-1">verified</span>
            <p className="font-bold text-sm text-primary">Không có đơn hàng nào bị gắn cờ</p>
            <p className="text-xs text-on-surface-variant mt-1">Toàn bộ đơn hàng đang vận hành đúng tiến độ cam kết SLA.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider border-b border-surface-container">
                  <th className="py-3 px-4">Đơn</th>
                  <th className="py-3 px-4">Điều phối</th>
                  <th className="py-3 px-4">Lý do gắn cờ</th>
                  <th className="py-3 px-4">Thời gian ở trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {(viewTab === 'FLAGGED' ? flaggedOrders : orders).map((o) => (
                  <tr
                    key={o.id}
                    className={`transition-colors ${
                      selectedOrderForReassign?.id === o.id
                        ? 'bg-primary/5 font-semibold'
                        : 'hover:bg-surface-container-low/60'
                    }`}
                  >
                    {/* Cột 1: Đơn */}
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {o.order_code || o.code || `ORD-${o.id}`}
                    </td>

                    {/* Cột 2: Điều phối */}
                    <td className="py-3.5 px-4 text-on-surface">
                      {o.dispatcher_name}
                    </td>

                    {/* Cột 3: Lý do gắn cờ */}
                    <td className="py-3.5 px-4">
                      {o.is_flagged ? (
                        <span className="inline-block px-2.5 py-1 rounded-md bg-error/10 text-error font-bold text-[11px]">
                          {o.flag_reason}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant text-[11px]">
                          Bình thường ({o.status})
                        </span>
                      )}
                    </td>

                    {/* Cột 4: Thời gian ở trạng thái */}
                    <td className="py-3.5 px-4 text-on-surface-variant font-medium">
                      {o.time_in_status || `${o.status} ${o.age_hours}h`}
                    </td>

                    {/* Cột 5: Thao tác (Chuyển · Xem đơn khớp Figure 39) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderForReassign(o);
                            setIsConfirmModalOpen(true);
                          }}
                          className="text-secondary font-bold hover:underline cursor-pointer"
                        >
                          Chuyển
                        </button>
                        <span className="text-outline">·</span>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(o.id)}
                          className="text-primary font-bold hover:underline cursor-pointer"
                        >
                          Xem đơn
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTION 3: CHUYỂN CHO ĐIỀU PHỐI (FORM CUỐI TRANG KHỚP CHUẨN FIGURE 39) */}
        <div className="pt-4 border-t border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs font-bold text-primary">
              Chuyển cho điều phối:
            </span>
            <select
              value={quickTargetDispatcherId || ''}
              onChange={(e) => setQuickTargetDispatcherId(e.target.value)}
              className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[200px]"
            >
              {dispatchers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name || d.username} ({d.active_orders} đơn)
                </option>
              ))}
            </select>

            {selectedOrderForReassign && (
              <span className="text-xs text-secondary font-semibold bg-secondary/10 px-2.5 py-1 rounded-lg">
                Đang chọn: #{selectedOrderForReassign.order_code || selectedOrderForReassign.id}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedOrderForReassign}
            onClick={() => setIsConfirmModalOpen(true)}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              selectedOrderForReassign
                ? 'bg-secondary text-on-secondary hover:bg-secondary/90 cursor-pointer'
                : 'bg-surface-container text-outline cursor-not-allowed'
            }`}
          >
            Chuyển
          </button>
        </div>
      </div>

      {/* Modal xác nhận điều chuyển đơn hàng */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">swap_horiz</span>
            <span className="font-bold text-base text-primary">Điều chuyển đơn hàng</span>
          </div>
        }
        open={isConfirmModalOpen}
        onCancel={() => {
          setIsConfirmModalOpen(false);
          setSelectedOrderForReassign(null);
        }}
        onOk={handleExecuteReassign}
        confirmLoading={reassigning}
        okText="Xác nhận điều chuyển"
        cancelText="Hủy bỏ"
        width={500}
      >
        {selectedOrderForReassign && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="bg-surface-container-low p-3.5 rounded-xl space-y-1.5">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Mã đơn hàng:</span>
                <span className="font-bold font-mono text-primary">
                  {selectedOrderForReassign.order_code || selectedOrderForReassign.code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">ĐPV phụ trách hiện tại:</span>
                <span className="font-bold text-primary">{selectedOrderForReassign.dispatcher_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Trạng thái:</span>
                <Tag color="blue">{selectedOrderForReassign.status}</Tag>
              </div>
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">
                Chọn điều phối viên tiếp nhận mới:
              </label>
              <select
                value={quickTargetDispatcherId || ''}
                onChange={(e) => setQuickTargetDispatcherId(e.target.value)}
                className="w-full h-10 px-3 bg-surface-container-low border border-surface-container rounded-xl font-bold text-primary focus:outline-none"
              >
                {dispatchers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name || d.username} (Đang xử lý: {d.active_orders} đơn)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">
                Lý do điều chuyển (ghi nhật ký hệ thống):
              </label>
              <Input.TextArea
                rows={3}
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Nhập lý do điều chuyển (ví dụ: ĐPV quá tải, xử lý đơn trễ...)"
                className="rounded-xl text-xs"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Chi tiết đơn hàng (Screen 09 Read-only) */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">visibility</span>
            <span className="font-bold text-base text-primary">
              Chi tiết đơn hàng #{orderDetail?.order_code || orderDetail?.id} (Chỉ đọc)
            </span>
          </div>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={750}
      >
        {detailLoading ? (
          <div className="py-12 flex justify-center"><Spin /></div>
        ) : orderDetail ? (
          <div className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-xl">
              <div>
                <span className="text-on-surface-variant block">Mã vận đơn:</span>
                <span className="font-bold font-mono text-primary text-sm">{orderDetail.order_code}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Trạng thái:</span>
                <Tag color="cyan" className="font-bold mt-0.5">{orderDetail.status}</Tag>
              </div>
              <div>
                <span className="text-on-surface-variant block">Giá thỏa thuận:</span>
                <span className="font-bold text-primary">
                  {Number(orderDetail.agreed_price || 0).toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Chứng từ:</span>
                <Tag color={orderDetail.document_status === 'APPROVED' ? 'green' : 'orange'}>
                  {orderDetail.document_status || 'PENDING'}
                </Tag>
              </div>
              <div>
                <span className="text-on-surface-variant block">Người nhận:</span>
                <span className="font-bold text-primary">{orderDetail.receiver_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Số điện thoại nhận:</span>
                <span className="font-mono">{orderDetail.receiver_phone || 'N/A'}</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-primary mb-2 uppercase text-[11px] tracking-wide">
                Lịch sử & Tuyến điểm:
              </h4>
              <div className="p-3 bg-surface-container-low rounded-xl text-on-surface-variant">
                Thời gian tạo: {orderDetail.created_at ? new Date(orderDetail.created_at).toLocaleString('vi-VN') : 'N/A'}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-outline">Không có thông tin chi tiết.</div>
        )}
      </Modal>
    </div>
  );
}
