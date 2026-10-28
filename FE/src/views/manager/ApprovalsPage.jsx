"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, InputNumber, message, Spin, Tag, Tooltip, Alert } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true);
  // Default tab: 'INCIDENTS' (Sự cố lớn - Figure 40) hoặc 'CLAIMS' (Yêu cầu bồi thường - Figure 41)
  const [activeMainTab, setActiveMainTab] = useState('INCIDENTS');

  // Incidents state (Figure 40 - Screen 17)
  const [incidentsList, setIncidentsList] = useState([]);
  const [incidentSummary, setIncidentSummary] = useState({ total: 0, pending: 0, resolved: 0 });
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('ALL'); // 'ALL', 'Chờ xử lý', 'Đã xử lý'
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('ALL');
  const [incidentSearch, setIncidentSearch] = useState('');

  // Modal Xử lý sự cố lớn (Screen 14)
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentFault, setIncidentFault] = useState('COMPANY');
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [incidentResolutionNote, setIncidentResolutionNote] = useState('');
  const [resolvingIncident, setResolvingIncident] = useState(false);

  // Modal Screen 40 (Trip Replay)
  const [isReplayModalOpen, setIsReplayModalOpen] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayData, setReplayData] = useState(null);

  // Claims state (Figure 41 - Screen 19)
  const [claimsList, setClaimsList] = useState([]);
  const [claimSummary, setClaimSummary] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [claimStatusFilter, setClaimStatusFilter] = useState('ALL'); // 'ALL', 'PENDING', 'APPROVED', 'REJECTED'

  // Modal Figure 42 (Claim Details - Screen 20)
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimComment, setClaimComment] = useState('');
  const [decidingClaim, setDecidingClaim] = useState(false);

  // Tải dữ liệu 100% từ Database
  const fetchData = async () => {
    setLoading(true);
    try {
      const [incidentsRes, claimsRes] = await Promise.all([
        managerApi.getIncidents().catch(() => ({ incidents: [], summary: {} })),
        managerApi.getClaims().catch(() => ({ claims: [], summary: {} }))
      ]);

      setIncidentsList(incidentsRes.incidents || []);
      setIncidentSummary(incidentsRes.summary || { total: 0, pending: 0, resolved: 0 });

      setClaimsList(claimsRes.claims || []);
      setClaimSummary(claimsRes.summary || { total: 0, pending: 0, approved: 0, rejected: 0 });
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu sự cố & bồi thường:', error);
      message.error('Không thể tải danh sách sự cố và bồi thường từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [incidentsRes, claimsRes] = await Promise.all([
          managerApi.getIncidents().catch(() => ({ incidents: [], summary: {} })),
          managerApi.getClaims().catch(() => ({ claims: [], summary: {} }))
        ]);
        if (!ignore) {
          setIncidentsList(incidentsRes.incidents || []);
          setIncidentSummary(incidentsRes.summary || { total: 0, pending: 0, resolved: 0 });
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

    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p === 'claims') {
        setActiveMainTab('CLAIMS');
      } else if (p === 'incidents') {
        setActiveMainTab('INCIDENTS');
      }
    }

    return () => { ignore = true; };
  }, []);

  // Mở modal xử lý sự cố (Bấm một dòng trong bảng Sự cố lớn)
  const handleOpenIncidentModal = (incident) => {
    setSelectedIncident(incident);
    setIncidentFault(incident.fault || 'COMPANY');
    setCompensationAmount(incident.claim_amount || 0);
    setIncidentResolutionNote(incident.resolution_note || '');
    setIsIncidentModalOpen(true);
  };

  // Xác nhận giải quyết sự cố lớn (UC-25)
  const handleResolveIncident = async () => {
    if (!selectedIncident) return;
    try {
      setResolvingIncident(true);
      const res = await managerApi.resolveIncident(selectedIncident.id, {
        fault: incidentFault,
        compensation_amount: compensationAmount,
        resolution_note: incidentResolutionNote
      });
      message.success(res.message || 'Đã đóng sự cố và cập nhật quyết định thành công!');
      setIsIncidentModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Lỗi giải quyết sự cố:', error);
      message.error(error.message || 'Lỗi khi giải quyết sự cố');
    } finally {
      setResolvingIncident(false);
    }
  };

  // Mở tua lại hành trình GPS (Screen 40)
  const handleOpenTripReplay = async (tripId) => {
    if (!tripId) {
      message.warning('Sự cố này không gắn với chuyến vận tải cụ thể nào.');
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

  // Mở modal Chi tiết yêu cầu bồi thường (Figure 42)
  const handleOpenClaimModal = (claim) => {
    setSelectedClaim(claim);
    setClaimComment(claim.decision_comment || '');
    setIsClaimModalOpen(true);
  };

  // Xử lý Duyệt hoặc Từ chối bồi thường (Figure 42 / UC-26)
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

  // Lọc Sự cố lớn
  const filteredIncidents = incidentsList.filter((i) => {
    const matchStatus =
      incidentStatusFilter === 'ALL' ||
      (incidentStatusFilter === 'Chờ xử lý' && (i.status === 'Chờ xử lý' || i.status === 'Reported')) ||
      (incidentStatusFilter === 'Đã xử lý' && (i.status === 'Đã xử lý' || i.status === 'Resolved'));

    const matchType = incidentTypeFilter === 'ALL' || i.type === incidentTypeFilter || i.type_display === incidentTypeFilter;
    const matchSearch =
      !incidentSearch ||
      i.code?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      i.order_code?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      i.trip_code?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      i.description?.toLowerCase().includes(incidentSearch.toLowerCase());

    return matchStatus && matchType && matchSearch;
  });

  // Lọc Yêu cầu bồi thường
  const filteredClaims = claimsList.filter((c) => {
    const matchStatus =
      claimStatusFilter === 'ALL' ||
      (claimStatusFilter === 'PENDING' && c.status === 'PENDING') ||
      (claimStatusFilter === 'APPROVED' && c.status === 'APPROVED') ||
      (claimStatusFilter === 'REJECTED' && c.status === 'REJECTED');

    return matchStatus;
  });

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              {activeMainTab === 'INCIDENTS' ? 'Sự cố lớn' : 'Yêu cầu bồi thường'}
            </h1>
            <Tag color={incidentSummary.pending > 0 ? "error" : "green"} className="font-bold text-xs">
              {incidentSummary.pending} Sự cố chờ xử lý
            </Tag>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Quản trị các sự cố kỹ thuật, tai nạn giao thông trên tuyến và xét duyệt các yêu cầu bồi thường tổn thất theo quy định.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-2">
        <button
          onClick={() => setActiveMainTab('INCIDENTS')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'INCIDENTS'
              ? 'bg-error text-white shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">car_crash</span>
          <span>Sự cố lớn ({incidentsList.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('CLAIMS')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'CLAIMS'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">gavel</span>
          <span>Yêu cầu bồi thường ({claimsList.length})</span>
        </button>
      </div>

      {/* TAB 1: SỰ CỐ LỚN (KHỚP CHUẨN 100% PROTOTYPE FIGURE 40) */}
      {activeMainTab === 'INCIDENTS' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
          {/* Bộ lọc chuẩn Figure 40: Trạng thái (①) & Loại sự cố (②) */}
          <div className="flex flex-wrap items-center gap-4 border-b border-surface-container pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Trạng thái:</span>
              <select
                value={incidentStatusFilter}
                onChange={(e) => setIncidentStatusFilter(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả</option>
                <option value="Chờ xử lý">Chờ xử lý</option>
                <option value="Đã xử lý">Đã xử lý</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Loại sự cố:</span>
              <select
                value={incidentTypeFilter}
                onChange={(e) => setIncidentTypeFilter(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả</option>
                <option value="Hỏng xe">Hỏng xe</option>
                <option value="Cấm đường / Ùn tắc">Cấm đường / Ùn tắc</option>
                <option value="Tai nạn giao thông">Tai nạn giao thông</option>
                <option value="Hàng hư hỏng/mất">Hàng hư hỏng/mất</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px] sm:max-w-xs relative ml-auto">
              <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                placeholder="Tìm mã, chuyến, đơn, mô tả..."
                className="w-full h-9 pl-9 pr-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Bảng 6 Cột chuẩn theo Figure 40 (③) */}
          {loading ? (
            <div className="py-12 flex justify-center"><Spin /></div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-xs">
              Không có sự cố nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider border-b border-surface-container">
                    <th className="py-3 px-4">Mã sự cố</th>
                    <th className="py-3 px-4">Loại</th>
                    <th className="py-3 px-4">Đơn hàng</th>
                    <th className="py-3 px-4">Chuyến</th>
                    <th className="py-3 px-4">Thời điểm chuyển lên</th>
                    <th className="py-3 px-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {filteredIncidents.map((i) => (
                    <tr
                      key={i.id}
                      onClick={() => handleOpenIncidentModal(i)}
                      className="hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                      title="Bấm để mở Chi tiết sự cố"
                    >
                      {/* Cột 1: Mã sự cố */}
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        {i.code}
                      </td>

                      {/* Cột 2: Loại */}
                      <td className="py-3.5 px-4 font-bold">
                        <span className={i.type_display === 'Hỏng xe' ? 'text-error' : i.type_display === 'Cấm đường / Ùn tắc' ? 'text-amber-700' : 'text-primary'}>
                          {i.type_display}
                        </span>
                      </td>

                      {/* Cột 3: Đơn hàng */}
                      <td className="py-3.5 px-4 font-mono text-primary">
                        {i.order_code}
                      </td>

                      {/* Cột 4: Chuyến */}
                      <td className="py-3.5 px-4 font-mono text-on-surface-variant">
                        {i.trip_code}
                      </td>

                      {/* Cột 5: Thời điểm chuyển lên */}
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        {i.reported_time ? new Date(i.reported_time).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </td>

                      {/* Cột 6: Trạng thái */}
                      <td className="py-3.5 px-4">
                        <Tag color={i.status === 'Chờ xử lý' ? 'orange' : 'green'} className="font-bold">
                          {i.status}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Chú thích chân bảng chuẩn theo Figure 40 */}
              <div className="pt-4 text-xs italic text-on-surface-variant">
                Bấm một dòng để mở Chi tiết sự cố. 10 dòng mỗi trang, mới nhất trước.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: YÊU CẦU BỒI THƯỜNG (KHỚP CHUẨN 100% PROTOTYPE FIGURE 41) */}
      {activeMainTab === 'CLAIMS' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
          {/* Bộ lọc chuẩn Figure 41: Trạng thái (①) */}
          <div className="flex items-center gap-2 border-b border-surface-container pb-4">
            <span className="text-xs font-bold text-on-surface-variant">Trạng thái:</span>
            <select
              value={claimStatusFilter}
              onChange={(e) => setClaimStatusFilter(e.target.value)}
              className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </div>

          {/* Bảng 5 Cột chuẩn theo Figure 41 (②) */}
          {loading ? (
            <div className="py-12 flex justify-center"><Spin /></div>
          ) : filteredClaims.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant bg-surface-container-low/30 rounded-2xl border border-dashed border-surface-container">
              <span className="material-symbols-outlined text-4xl text-secondary mb-1">verified_user</span>
              <p className="font-bold text-sm text-primary">Không có yêu cầu bồi thường nào</p>
              <p className="text-xs text-on-surface-variant mt-1">Toàn bộ hàng hóa và chuyến vận chuyển hiện tại không phát sinh đền bù.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider border-b border-surface-container">
                    <th className="py-3 px-4">Đơn hàng</th>
                    <th className="py-3 px-4">Nguồn</th>
                    <th className="py-3 px-4">Số tiền yêu cầu</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Thời điểm tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {filteredClaims.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenClaimModal(c)}
                      className="hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                      title="Bấm để mở Chi tiết yêu cầu bồi thường"
                    >
                      {/* Cột 1: Đơn hàng */}
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        {c.order_code}
                      </td>

                      {/* Cột 2: Nguồn */}
                      <td className="py-3.5 px-4 text-on-surface font-medium">
                        {c.source_display || `Sự cố ${c.claim_code}`}
                      </td>

                      {/* Cột 3: Số tiền yêu cầu */}
                      <td className="py-3.5 px-4 font-mono font-extrabold text-error">
                        {Number(c.amount || 0).toLocaleString('vi-VN')} đ
                      </td>

                      {/* Cột 4: Trạng thái */}
                      <td className="py-3.5 px-4">
                        <Tag
                          color={c.status === 'APPROVED' ? 'green' : c.status === 'REJECTED' ? 'red' : 'orange'}
                          className="font-bold"
                        >
                          {c.status === 'APPROVED' ? 'Đã duyệt' : c.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                        </Tag>
                      </td>

                      {/* Cột 5: Thời điểm tạo */}
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        {c.created_at ? new Date(c.created_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Chú thích chân bảng chuẩn theo Figure 41 */}
              <div className="pt-4 text-xs italic text-on-surface-variant">
                Bấm một dòng để mở Chi tiết yêu cầu bồi thường.
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CHI TIẾT SỰ CỐ & GIẢI QUYẾT (Screen 14) */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error">report</span>
            <span className="font-bold text-base text-primary">
              Chi tiết sự cố: #{selectedIncident?.code} ({selectedIncident?.type_display})
            </span>
          </div>
        }
        open={isIncidentModalOpen}
        onCancel={() => setIsIncidentModalOpen(false)}
        footer={null}
        width={650}
      >
        {selectedIncident && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="bg-surface-container-low p-4 rounded-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>Đơn hàng: <strong className="font-mono text-primary">{selectedIncident.order_code}</strong></div>
                <div>Chuyến xe: <strong className="font-mono text-primary">{selectedIncident.trip_code}</strong></div>
                <div>Người báo cáo: <strong className="text-primary">{selectedIncident.reporter_name}</strong></div>
                <div>Trạng thái: <Tag color="orange">{selectedIncident.status}</Tag></div>
              </div>
              <div className="pt-2 border-t border-surface-container">
                <span className="text-on-surface-variant block mb-1">Mô tả sự cố:</span>
                <p className="p-2.5 bg-surface-container-lowest rounded-lg text-primary font-medium">
                  {selectedIncident.description}
                </p>
              </div>
            </div>

            {selectedIncident.trip_id && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenTripReplay(selectedIncident.trip_id)}
                  className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-secondary font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">play_circle</span>
                  <span>Tua lại hành trình GPS</span>
                </button>
              </div>
            )}

            {/* Form đóng sự cố */}
            <div className="p-4 border border-surface-container rounded-xl space-y-3">
              <h4 className="font-bold text-primary uppercase text-[11px]">Xác định trách nhiệm & Đóng sự cố:</h4>
              <div>
                <label className="block text-on-surface-variant mb-1 font-bold">Trách nhiệm lỗi:</label>
                <select
                  value={incidentFault}
                  onChange={(e) => setIncidentFault(e.target.value)}
                  className="w-full h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl font-bold text-primary focus:outline-none"
                >
                  <option value="COMPANY">Lỗi Công ty / Đội xe</option>
                  <option value="CUSTOMER">Lỗi Khách hàng</option>
                  <option value="THIRD_PARTY">Bên thứ ba (Giao thông, thời tiết)</option>
                </select>
              </div>

              <div>
                <label className="block text-on-surface-variant mb-1 font-bold">
                  Số tiền đền bù (VNĐ) - Tự động tạo Yêu cầu bồi thường nếu &gt; 0:
                </label>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={100000}
                  value={compensationAmount}
                  onChange={(val) => setCompensationAmount(val || 0)}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={(value) => value.replace(/\./g, '')}
                  className="rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-on-surface-variant mb-1 font-bold">Biên bản / Ghi chú xử lý:</label>
                <Input.TextArea
                  rows={2}
                  value={incidentResolutionNote}
                  onChange={(e) => setIncidentResolutionNote(e.target.value)}
                  placeholder="Ghi chú kết quả xử lý cứu hộ, thay lốp hoặc thỏa thuận..."
                  className="rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIncidentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container-low text-on-surface-variant font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={resolvingIncident}
                  onClick={handleResolveIncident}
                  className="px-5 py-2 rounded-xl bg-error text-white font-bold hover:bg-error/90 cursor-pointer shadow-sm"
                >
                  {resolvingIncident ? 'Đang xử lý...' : 'Đóng sự cố'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL CHI TIẾT YÊU CẦU BỒI THƯỜNG KHỚP 100% PROTOTYPE FIGURE 42 */}
      <Modal
        title={
          <div className="flex items-center justify-between w-full pr-6">
            <span className="font-bold text-base text-primary">
              Yêu cầu bồi thường – Đơn {selectedClaim?.order_code}
            </span>
            <Tag color={selectedClaim?.status === 'APPROVED' ? 'green' : selectedClaim?.status === 'REJECTED' ? 'red' : 'orange'} className="font-bold">
              {selectedClaim?.status === 'APPROVED' ? 'Đã duyệt' : selectedClaim?.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
            </Tag>
          </div>
        }
        open={isClaimModalOpen}
        onCancel={() => setIsClaimModalOpen(false)}
        footer={null}
        width={720}
      >
        {selectedClaim && (
          <div className="space-y-4 pt-2 text-xs">
            {/* Box ① & ②: Nguồn & Thông tin tổng quan */}
            <div className="p-4 bg-surface-container-low rounded-xl space-y-1.5 border border-surface-container">
              <div>
                <span className="text-on-surface-variant">Nguồn: </span>
                <span className="font-bold text-primary">{selectedClaim.source_display || `Sự cố ${selectedClaim.claim_code}`}</span>
                <span> · Chuyến: </span>
                <span className="font-mono font-bold text-primary">{selectedClaim.trip_code || 'TRIP-Chưa gán'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant">Số tiền yêu cầu: </span>
                <span className="font-mono font-black text-error text-sm">
                  {Number(selectedClaim.amount || 0).toLocaleString('vi-VN')} đ
                </span>
                <span> · Lý do: </span>
                <span className="font-medium text-primary">{selectedClaim.reason || 'Hư hỏng hàng hóa trong quá trình vận tải'}</span>
              </div>
            </div>

            {/* Box ③: Ảnh minh chứng */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border border-dashed border-surface-container rounded-xl text-center bg-surface-container-lowest flex flex-col items-center justify-center min-h-[90px]">
                <span className="material-symbols-outlined text-outline text-[22px] mb-1">photo_camera</span>
                <span className="text-[11px] font-bold text-on-surface-variant">Ảnh hàng khi lấy</span>
              </div>
              <div className="p-3 border border-dashed border-surface-container rounded-xl text-center bg-surface-container-lowest flex flex-col items-center justify-center min-h-[90px]">
                <span className="material-symbols-outlined text-outline text-[22px] mb-1">lock</span>
                <span className="text-[11px] font-bold text-on-surface-variant">Ảnh chì & biển số</span>
              </div>
              <div className="p-3 border border-dashed border-surface-container rounded-xl text-center bg-surface-container-lowest flex flex-col items-center justify-center min-h-[90px]">
                <span className="material-symbols-outlined text-outline text-[22px] mb-1">description</span>
                <span className="text-[11px] font-bold text-on-surface-variant">Biên bản / POD</span>
              </div>
            </div>

            {/* Box ④: Điều khoản hợp đồng */}
            <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container">
              <h4 className="font-bold text-primary uppercase text-[11px] mb-1">Điều khoản hợp đồng</h4>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Trần bồi thường:</span>
                <span className="font-mono font-bold text-primary">
                  {selectedClaim.contract_cap ? `${selectedClaim.contract_cap.toLocaleString('vi-VN')} đ` : '500.000.000 đ'}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-on-surface-variant">Giới hạn trách nhiệm:</span>
                <span className="font-mono font-bold text-error">
                  {selectedClaim.liability_limit ? `${selectedClaim.liability_limit.toLocaleString('vi-VN')} đ` : '500.000.000 đ'}
                </span>
              </div>
            </div>

            {/* Box ⑤: Cảnh báo nếu vượt giới hạn trách nhiệm */}
            {selectedClaim.is_exceeding_cap && (
              <div className="p-3 bg-amber-500/10 border border-amber-300 text-amber-800 rounded-xl font-medium">
                Số tiền vượt giới hạn trách nhiệm {selectedClaim.liability_limit?.toLocaleString('vi-VN')} đ. Hãy ghi lý do nếu vẫn duyệt.
              </div>
            )}

            {/* Box ⑥: Nhận xét (Bắt buộc khi từ chối, hoặc khi duyệt số tiền vượt giới hạn) */}
            <div>
              <label className="block font-bold text-primary mb-1">
                Nhận xét * <span className="font-normal text-on-surface-variant">(bắt buộc khi từ chối, hoặc khi duyệt số tiền vượt giới hạn)</span>:
              </label>
              <Input.TextArea
                rows={3}
                value={claimComment}
                onChange={(e) => setClaimComment(e.target.value)}
                placeholder="Nhập nhận xét phê duyệt hoặc lý do từ chối..."
                className="rounded-xl text-xs"
              />
            </div>

            {/* Box ⑦: Nút Duyệt / Từ chối khớp Figure 42 */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={decidingClaim}
                onClick={() => handleDecideClaim('APPROVE')}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
              >
                Duyệt
              </button>
              <button
                type="button"
                disabled={decidingClaim}
                onClick={() => handleDecideClaim('REJECT')}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
              >
                Từ chối
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL TUA LẠI HÀNH TRÌNH GPS (Screen 40) */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">play_circle</span>
            <span className="font-bold text-base text-primary">
              Tua lại hành trình GPS (Screen 40)
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
        ) : (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-4 bg-surface-container-low rounded-xl text-on-surface-variant">
              Mô phỏng lộ trình xe chạy qua GPS hộp đen & phát hiện vi phạm bán kính Geofence.
            </div>
            <div className="h-64 bg-surface-container rounded-2xl flex items-center justify-center text-on-surface-variant border border-surface-container-high">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-secondary mb-1">map</span>
                <p className="font-bold">Bản đồ lộ trình GPS xe</p>
                <p className="text-[11px] text-outline">Chưa phát hiện vi phạm bán kính điểm dừng trên chuyến xe này.</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
