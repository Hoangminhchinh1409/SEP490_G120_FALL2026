"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Input, message, Spin, Tag, Tooltip, Alert } from 'antd';
import { managerApi } from '../../api/managerApi';
import { useAuth } from '../../providers/AuthProvider';
import ReadOnlyBanner from '../../components/common/ReadOnlyBanner';
import AccessDenied from '../../components/common/AccessDenied';

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true);

  // Claims list & summary
  const [claimsList, setClaimsList] = useState([]);
  const [claimSummary, setClaimSummary] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [claimStatusFilter, setClaimStatusFilter] = useState('ALL'); // 'ALL', 'PENDING', 'APPROVED', 'REJECTED'
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL', 'DRIVER_REPORTED', 'DISPATCHER_ESCALATED', 'CUSTOMER_CLAIM'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Chi tiết & Xét duyệt bồi thường
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimComment, setClaimComment] = useState('');
  const [decidingClaim, setDecidingClaim] = useState(false);

  // Modal Trip Replay (GPS)
  const [isReplayModalOpen, setIsReplayModalOpen] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayData, setReplayData] = useState(null);

  // Tải dữ liệu Yêu cầu bồi thường từ Database
  const fetchData = async () => {
    setLoading(true);
    try {
      const claimsRes = await managerApi.getClaims().catch(() => ({ claims: [], summary: {} }));
      setClaimsList(claimsRes.claims || []);
      setClaimSummary(claimsRes.summary || { total: 0, pending: 0, approved: 0, rejected: 0 });
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu yêu cầu bồi thường:', error);
      message.error('Không thể tải danh sách yêu cầu bồi thường từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const claimsRes = await managerApi.getClaims().catch(() => ({ claims: [], summary: {} }));
        if (!ignore) {
          setClaimsList(claimsRes.claims || []);
          setClaimSummary(claimsRes.summary || { total: 0, pending: 0, approved: 0, rejected: 0 });
        }
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadInitial();
    return () => { ignore = true; };
  }, []);

  // Mở modal Chi tiết yêu cầu bồi thường & Xử lý sự cố
  const handleOpenClaimModal = (claim) => {
    setSelectedClaim(claim);
    setClaimComment(claim.decision_comment || '');
    setIsClaimModalOpen(true);
  };

  // Xử lý Duyệt hoặc Từ chối bồi thường
  const handleDecideClaim = async (action) => {
    if (!selectedClaim) return;
    const isApprove = action === 'APPROVE';

    // Bắt buộc comment nếu từ chối hoặc duyệt vượt hạn mức trách nhiệm
    if (!isApprove && !claimComment.trim()) {
      message.warning('Bắt buộc nhập nhận xét/lý do khi từ chối yêu cầu bồi thường.');
      return;
    }
    if (isApprove && selectedClaim.is_exceeding_cap && !claimComment.trim()) {
      message.warning('Số tiền vượt giới hạn trách nhiệm! Bắt buộc nhập lý do phê duyệt ngoại lệ.');
      return;
    }

    try {
      setDecidingClaim(true);
      const res = await managerApi.decideClaim(selectedClaim.id, {
        action,
        comment: claimComment
      });
      message.success(res.message || 'Xử lý yêu cầu bồi thường thành công!');
      setIsClaimModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Lỗi quyết định bồi thường:', error);
      message.error(error.message || 'Lỗi khi xử lý bồi thường');
    } finally {
      setDecidingClaim(false);
    }
  };

  // Mở tua lại hành trình GPS
  const handleOpenTripReplay = async (tripId) => {
    if (!tripId) {
      message.warning('Yêu cầu bồi thường này không gắn với chuyến xe cụ thể.');
      return;
    }
    setIsReplayModalOpen(true);
    setReplayLoading(true);
    try {
      const data = await managerApi.getTripReplay(tripId);
      setReplayData(data);
    } catch (error) {
      console.error('Lỗi tải dữ liệu tua lại chuyến:', error);
      message.error('Không thể tải dữ liệu GPS tua lại chuyến.');
      setIsReplayModalOpen(false);
    } finally {
      setReplayLoading(false);
    }
  };

  // Lọc danh sách yêu cầu bồi thường
  const filteredClaims = claimsList.filter((c) => {
    const matchStatus =
      claimStatusFilter === 'ALL' ||
      (claimStatusFilter === 'PENDING' && c.status === 'PENDING') ||
      (claimStatusFilter === 'APPROVED' && c.status === 'APPROVED') ||
      (claimStatusFilter === 'REJECTED' && c.status === 'REJECTED');

    const matchSource =
      sourceFilter === 'ALL' ||
      (sourceFilter === 'DRIVER_REPORTED' && (c.source === 'DRIVER_REPORTED' || c.source === 'INCIDENT')) ||
      (sourceFilter === 'DISPATCHER_ESCALATED' && c.source === 'DISPATCHER_ESCALATED') ||
      (sourceFilter === 'CUSTOMER_CLAIM' && c.source === 'CUSTOMER_CLAIM');

    const query = searchQuery.trim().toLowerCase();
    const matchSearch =
      !query ||
      c.claim_code?.toLowerCase().includes(query) ||
      c.order_code?.toLowerCase().includes(query) ||
      c.incident_code?.toLowerCase().includes(query) ||
      c.trip_code?.toLowerCase().includes(query) ||
      c.truck_plate?.toLowerCase().includes(query) ||
      c.driver_name?.toLowerCase().includes(query) ||
      c.reason?.toLowerCase().includes(query) ||
      c.source_display?.toLowerCase().includes(query) ||
      c.incident_description?.toLowerCase().includes(query);

    return matchStatus && matchSource && matchSearch;
  });

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              Danh sách yêu cầu bồi thường
            </h1>
            {claimSummary.pending > 0 ? (
              <Tag color="error" className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                {claimSummary.pending} Chờ phê duyệt
              </Tag>
            ): (
              <Tag color="green" className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                Tất cả đã xử lý
              </Tag>
            )}
          </div>
          <p className="text-xs text-on-surface-variant mt-1.5 max-w-3xl">
            Tiếp nhận, thẩm tra sự cố kỹ thuật / tai nạn / hư hỏng hàng hóa và xét duyệt các yêu cầu bồi thường theo đúng hạn mức trách nhiệm hợp đồng vận tải.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer border border-surface-container"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Tổng yêu cầu</div>
            <div className="text-xl font-black text-primary font-mono">{claimSummary.total}</div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">pending_actions</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Chờ duyệt</div>
            <div className="text-xl font-black text-amber-600 font-mono">{claimSummary.pending}</div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">check_circle</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Đã chấp thuận</div>
            <div className="text-xl font-black text-emerald-600 font-mono">{claimSummary.approved}</div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">cancel</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Đã từ chối</div>
            <div className="text-xl font-black text-red-600 font-mono">{claimSummary.rejected}</div>
          </div>
        </div>
      </div>

      {/* Main Content Card: Single tab dedicated to Claims */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
        {/* Controls: Filter by status & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Trạng thái:</span>
              <select
                value={claimStatusFilter}
                onChange={(e) => setClaimStatusFilter(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả ({claimSummary.total})</option>
                <option value="PENDING">Chờ duyệt ({claimSummary.pending})</option>
                <option value="APPROVED">Đã duyệt ({claimSummary.approved})</option>
                <option value="REJECTED">Từ chối ({claimSummary.rejected})</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Nguồn gửi:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả nguồn gửi</option>
                <option value="DRIVER_REPORTED">👨‍✈️ Tài xế báo cáo</option>
                <option value="DISPATCHER_ESCALATED">🎧 ĐPV chuyển tiếp</option>
                <option value="CUSTOMER_CLAIM">🏢 Khách hàng khiếu nại</option>
              </select>
            </div>
          </div>

          <div className="flex-1 min-w-[240px] sm:max-w-md relative">
            <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant text-[18px] pointer-events-none">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã yêu cầu, đơn hàng, sự cố, tài xế..."
              className="w-full h-9 pl-9 pr-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Table: Danh sách yêu cầu bồi thường */}
        {loading ? (
          <div className="py-16 flex justify-center"><Spin size="large" /></div>
        ): filteredClaims.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant bg-surface-container-low/30 rounded-2xl border border-dashed border-surface-container">
            <span className="material-symbols-outlined text-4xl text-secondary mb-1">verified_user</span>
            <p className="font-bold text-sm text-primary">Không có yêu cầu bồi thường nào</p>
            <p className="text-xs text-on-surface-variant mt-1">
              Toàn bộ hàng hóa và chuyến vận chuyển hiện tại không phát sinh đền bù cần phê duyệt.
            </p>
          </div>
        ): (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider border-b border-surface-container">
                  <th className="py-3 px-4">Mã yêu cầu</th>
                  <th className="py-3 px-4">Đơn hàng</th>
                  <th className="py-3 px-4">Nguồn gửi &amp; Sự cố / Khiếu nại</th>
                  <th className="py-3 px-4">Chuyến xe &amp; Tài xế</th>
                  <th className="py-3 px-4">Số tiền yêu cầu</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Thời điểm tạo</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {filteredClaims.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenClaimModal(c)}
                    className="hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                    title="Bấm để mở Chi tiết và Phê duyệt yêu cầu bồi thường"
                  >
                    {/* Cột 1: Mã bồi thường */}
                    <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-secondary">gavel</span>
                        <span>{c.claim_code}</span>
                      </div>
                    </td>

                    {/* Cột 2: Đơn hàng */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-primary block">{c.order_code}</span>
                      {c.receiver_name && (
                        <span className="text-[11px] text-on-surface-variant block truncate max-w-[150px]">
                          {c.receiver_name}
                        </span>
                      )}
                    </td>

                    {/* Cột 3: Nguồn gửi & Sự cố / Khiếu nại */}
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="space-y-1">
                        <div>
                          {c.source === 'DRIVER_REPORTED' || c.source === 'INCIDENT' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 font-bold text-[10px] border border-blue-200">
                              <span>👨‍✈️ Tài xế báo cáo</span>
                            </span>
                          ): c.source === 'DISPATCHER_ESCALATED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 font-bold text-[10px] border border-purple-200">
                              <span>🎧 ĐPV chuyển tiếp</span>
                            </span>
                          ): (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                              <span>🏢 Khách hàng khiếu nại</span>
                            </span>
                          )}
                        </div>

                        {c.incident_code ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-bold text-error text-[11px]">{c.incident_code}</span>
                              <span className="font-bold text-primary text-[11px]">({c.incident_type_display})</span>
                            </div>
                            <span className="text-[11px] text-on-surface-variant block truncate max-w-[200px]" title={c.incident_description || c.reason}>
                              {c.incident_description || c.reason || 'Sự cố trên tuyến'}
                            </span>
                          </div>
                        ): (
                          <div>
                            <span className="text-[11px] text-on-surface-variant block truncate max-w-[200px]" title={c.reason}>
                              {c.reason || 'Khiếu nại hư hỏng hàng'}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cột 4: Chuyến xe & Tài xế */}
                    <td className="py-3.5 px-4">
                      {c.trip_code ? (
                        <div>
                          <span className="font-mono font-bold text-primary block text-[11px]">{c.trip_code}</span>
                          <span className="text-[11px] text-on-surface-variant block">
                            {c.truck_plate ? `${c.truck_plate} · `: ''}{c.driver_name || 'Tài xế'}
                          </span>
                        </div>
                      ): (
                        <span className="text-on-surface-variant italic">Chưa gắn chuyến</span>
                      )}
                    </td>

                    {/* Cột 5: Số tiền yêu cầu */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono font-black text-error text-sm block">
                        {Number(c.amount || 0).toLocaleString('vi-VN')} đ
                      </span>
                      {c.is_exceeding_cap && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 text-[10px] font-bold border border-amber-300">
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          <span>Vượt hạn mức</span>
                        </span>
                      )}
                    </td>

                    {/* Cột 6: Trạng thái */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Tag
                        color={c.status === 'APPROVED' ? 'green': c.status === 'REJECTED' ? 'red': 'orange'}
                        className="font-bold text-xs"
                      >
                        {c.status === 'APPROVED' ? 'Đã duyệt': c.status === 'REJECTED' ? 'Từ chối': 'Chờ duyệt'}
                      </Tag>
                    </td>

                    {/* Cột 7: Thời điểm tạo */}
                    <td className="py-3.5 px-4 text-on-surface-variant whitespace-nowrap">
                      {c.created_at ? new Date(c.created_at).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }): 'N/A'}
                    </td>

                    {/* Cột 8: Thao tác */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenClaimModal(c);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-container-low group-hover:bg-primary group-hover:text-on-primary text-primary font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1 border border-surface-container"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span>{c.status === 'PENDING' ? 'Xét duyệt': 'Chi tiết'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Chú thích chân bảng */}
            <div className="pt-4 flex items-center justify-between text-xs italic text-on-surface-variant border-t border-surface-container">
              <span>Bấm vào một dòng để xem chi tiết bằng chứng và thực hiện duyệt/từ chối bồi thường.</span>
              <span className="font-mono font-medium not-italic">Hiển thị {filteredClaims.length}/{claimsList.length} yêu cầu</span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT & XÉT DUYỆT BỒI THƯỜNG */}
      <Modal
        title={
          <div className="flex items-center justify-between w-full pr-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">gavel</span>
              <span className="font-bold text-base text-primary">
                Xét duyệt Bồi thường: {selectedClaim?.claim_code} – Đơn {selectedClaim?.order_code}
              </span>
            </div>
            <Tag color={selectedClaim?.status === 'APPROVED' ? 'green': selectedClaim?.status === 'REJECTED' ? 'red': 'orange'} className="font-bold text-xs">
              {selectedClaim?.status === 'APPROVED' ? 'Đã duyệt': selectedClaim?.status === 'REJECTED' ? 'Từ chối': 'Chờ phê duyệt'}
            </Tag>
          </div>
        }
        open={isClaimModalOpen}
        onCancel={() => setIsClaimModalOpen(false)}
        footer={null}
        width={760}
      >
        {selectedClaim && (
          <div className="space-y-4 pt-2 text-xs">
            {/* Box 1: Thông tin tổng quan bồi thường */}
            <div className="p-4 bg-surface-container-low rounded-xl space-y-2 border border-surface-container">
              <div className="grid grid-cols-2 gap-2">
                <div>Đơn hàng: <strong className="font-mono text-primary">{selectedClaim.order_code}</strong> ({selectedClaim.order_type})</div>
                <div>Chuyến xe: <strong className="font-mono text-primary">{selectedClaim.trip_code || 'Chưa gán chuyến'}</strong></div>
                {selectedClaim.truck_plate && (
                  <div>Xe vận chuyển: <strong className="font-mono text-primary">{selectedClaim.truck_plate}</strong></div>
                )}
                {selectedClaim.driver_name && (
                  <div>Tài xế: <strong className="text-primary">{selectedClaim.driver_name}</strong> {selectedClaim.driver_phone ? `(${selectedClaim.driver_phone})`: ''}</div>
                )}
              </div>
              <div className="pt-2 border-t border-surface-container flex items-center justify-between">
                <div>
                  <span className="text-on-surface-variant">Số tiền yêu cầu bồi thường: </span>
                  <span className="font-mono font-black text-error text-base ml-1">
                    {Number(selectedClaim.amount || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                {selectedClaim.trip_id && (
                  <button
                    type="button"
                    onClick={() => handleOpenTripReplay(selectedClaim.trip_id)}
                    className="px-3 py-1.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-secondary font-bold inline-flex items-center gap-1.5 cursor-pointer border border-surface-container"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_circle</span>
                    <span>Tua lại hành trình GPS</span>
                  </button>
                )}
              </div>
            </div>

            {/* Box 2: Thông tin Sự cố liên quan */}
            <div className="p-4 bg-surface-container-low/70 rounded-xl space-y-2 border border-surface-container">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-primary uppercase text-[11px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-error text-[16px]">car_crash</span>
                  <span>Thông tin sự cố phát sinh</span>
                </h4>
                {selectedClaim.incident_code && (
                  <Tag color="red" className="font-bold text-xs">
                    {selectedClaim.incident_code} · {selectedClaim.incident_type_display}
                  </Tag>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-on-surface">
                <div>
                  <span className="text-on-surface-variant">Nguồn gốc: </span>
                  <strong className="text-primary">{selectedClaim.source_display}</strong>
                </div>
                <div>
                  <span className="text-on-surface-variant">Trách nhiệm lỗi: </span>
                  <strong className={selectedClaim.incident_fault === 'COMPANY' ? 'text-error': 'text-primary'}>
                    {selectedClaim.incident_fault === 'COMPANY'
                      ? 'Lỗi Công ty / Đội xe'
                      : selectedClaim.incident_fault === 'CUSTOMER'
                      ? 'Lỗi Khách hàng'
                      : 'Bên thứ ba (Giao thông, thời tiết)'}
                  </strong>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-on-surface-variant block mb-1">Mô tả nguyên nhân / Thiệt hại:</span>
                <p className="p-2.5 bg-surface-container-lowest rounded-lg text-primary font-medium border border-surface-container">
                  {selectedClaim.incident_description || selectedClaim.reason || 'Chưa có ghi chú mô tả chi tiết sự cố.'}
                </p>
              </div>
            </div>

            {/* Box 3: Ảnh minh chứng hiện trường / Hàng hóa */}
            <div className="space-y-1.5">
              <span className="font-bold text-primary uppercase text-[11px] block">Hình ảnh minh chứng:</span>
              {selectedClaim.incident_photos && selectedClaim.incident_photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {selectedClaim.incident_photos.map((photo, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border border-surface-container h-24 bg-surface-container-low">
                      <img src={photo} alt={`Minh chứng ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ): (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 border border-dashed border-surface-container rounded-xl text-center bg-surface-container-lowest flex flex-col items-center justify-center min-h-[85px]">
                    <span className="material-symbols-outlined text-outline text-[22px] mb-1">photo_camera</span>
                    <span className="text-[11px] font-bold text-on-surface-variant">Ảnh hàng khi nhận</span>
                  </div>
                  <div className="p-3 border border-dashed border-surface-container rounded-xl text-center bg-surface-container-lowest flex flex-col items-center justify-center min-h-[85px]">
                    <span className="material-symbols-outlined text-outline text-[22px] mb-1">lock</span>
                    <span className="text-[11px] font-bold text-on-surface-variant">Ảnh seal chì &amp; biển số</span>
                  </div>
                  <div className="p-3 border border-dashed border-surface-container rounded-xl text-center bg-surface-container-lowest flex flex-col items-center justify-center min-h-[85px]">
                    <span className="material-symbols-outlined text-outline text-[22px] mb-1">description</span>
                    <span className="text-[11px] font-bold text-on-surface-variant">Biên bản / POD giao hàng</span>
                  </div>
                </div>
              )}
            </div>

            {/* Box 4: Điều khoản hợp đồng & Giới hạn trách nhiệm */}
            <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container">
              <h4 className="font-bold text-primary uppercase text-[11px] mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[16px]">verified</span>
                <span>Hạn mức trách nhiệm hợp đồng</span>
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between border-r border-surface-container pr-3">
                  <span className="text-on-surface-variant">Trần bồi thường HĐ:</span>
                  <span className="font-mono font-bold text-primary">
                    {selectedClaim.contract_cap ? `${selectedClaim.contract_cap.toLocaleString('vi-VN')} đ`: '500.000.000 đ'}
                  </span>
                </div>
                <div className="flex justify-between pl-1">
                  <span className="text-on-surface-variant">Giới hạn trách nhiệm:</span>
                  <span className="font-mono font-bold text-error">
                    {selectedClaim.liability_limit ? `${selectedClaim.liability_limit.toLocaleString('vi-VN')} đ`: '500.000.000 đ'}
                  </span>
                </div>
              </div>

              {selectedClaim.is_exceeding_cap && (
                <div className="mt-2.5 p-2.5 bg-amber-500/10 border border-amber-300 text-amber-800 rounded-lg font-medium text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                  <span>
                    Số tiền yêu cầu ({selectedClaim.amount?.toLocaleString('vi-VN')} đ) vượt giới hạn trách nhiệm ({selectedClaim.liability_limit?.toLocaleString('vi-VN')} đ). Bắt buộc nhập lý do ngoại lệ nếu phê duyệt!
                  </span>
                </div>
              )}
            </div>

            {/* Box 5: Nhận xét & Phê duyệt */}
            <div>
              <label className="block font-bold text-primary mb-1">
                Nhận xét phê duyệt * <span className="font-normal text-on-surface-variant">(bắt buộc khi từ chối, hoặc duyệt số tiền vượt hạn mức)</span>:
              </label>
              <Input.TextArea
                rows={3}
                value={claimComment}
                onChange={(e) => setClaimComment(e.target.value)}
                disabled={selectedClaim.status !== 'PENDING'}
                placeholder="Nhập nhận xét quyết định hoặc lý do phê duyệt/từ chối bồi thường..."
                className="rounded-xl text-xs"
              />
            </div>

            {/* Thông tin người đã duyệt nếu đã xử lý */}
            {selectedClaim.status !== 'PENDING' && (
              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">
                  Đã được xử lý vào lúc: <strong>{selectedClaim.decided_at ? new Date(selectedClaim.decided_at).toLocaleString('vi-VN'): 'N/A'}</strong>
                </span>
                <Tag color={selectedClaim.status === 'APPROVED' ? 'green': 'red'} className="font-bold">
                  {selectedClaim.status === 'APPROVED' ? 'ĐÃ DUYỆT BỒI THƯỜNG': 'ĐÃ TỪ CHỐI'}
                </Tag>
              </div>
            )}

            {/* Các nút bấm Duyệt / Từ chối (chỉ mở khi PENDING) */}
            {selectedClaim.status === 'PENDING' ? (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={decidingClaim}
                  onClick={() => handleDecideClaim('APPROVE')}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{decidingClaim ? 'Đang lưu...': 'Duyệt bồi thường'}</span>
                </button>
                <button
                  type="button"
                  disabled={decidingClaim}
                  onClick={() => handleDecideClaim('REJECT')}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  <span>{decidingClaim ? 'Đang lưu...': 'Từ chối bồi thường'}</span>
                </button>
              </div>
            ): (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-surface-container text-primary font-bold cursor-pointer hover:bg-surface-container-high transition-colors"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL TUA LẠI HÀNH TRÌNH GPS */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">play_circle</span>
            <span className="font-bold text-base text-primary">
              Tua lại hành trình GPS – Chuyến xe
            </span>
          </div>
        }
        open={isReplayModalOpen}
        onCancel={() => setIsReplayModalOpen(false)}
        footer={null}
        width={700}
      >
        {replayLoading ? (
          <div className="py-12 flex justify-center"><Spin /></div>
        ): (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-4 bg-surface-container-low rounded-xl text-on-surface-variant">
              Mô phỏng lộ trình xe chạy qua định vị GPS hộp đen &amp; phát hiện vi phạm bán kính Geofence tại thời điểm xảy ra sự cố.
            </div>
            <div className="h-64 bg-surface-container rounded-2xl flex items-center justify-center text-on-surface-variant border border-surface-container-high">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-secondary mb-1">map</span>
                <p className="font-bold">Bản đồ lộ trình GPS xe</p>
                <p className="text-[11px] text-outline">Chưa phát hiện vi phạm bán kính dừng đỗ trên chuyến xe này.</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
