"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, InputNumber, message, Spin, Tag, Tooltip, Alert } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('CLAIMS'); // 'CLAIMS' or 'INCIDENTS'

  // Claims state (Screen 19)
  const [claimsList, setClaimsList] = useState([]);
  const [claimSummary, setClaimSummary] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [claimFilter, setClaimFilter] = useState('ALL'); // 'ALL', 'PENDING', 'APPROVED', 'REJECTED'
  const [claimSearch, setClaimSearch] = useState('');

  // Modal Screen 20 (Claim Details & Decision)
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimComment, setClaimComment] = useState('');
  const [decidingClaim, setDecidingClaim] = useState(false);

  // Incidents state (Screen 17)
  const [incidentsList, setIncidentsList] = useState([]);
  const [incidentSummary, setIncidentSummary] = useState({ total: 0, pending: 0, resolved: 0 });
  const [incidentFilter, setIncidentFilter] = useState('ALL');
  const [incidentSearch, setIncidentSearch] = useState('');

  // Modal Screen 14 (Resolve Major Incident)
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
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [claimsRes, incidentsRes] = await Promise.all([
        managerApi.getClaims().catch(() => ({ claims: [], summary: {} })),
        managerApi.getIncidents().catch(() => ({ incidents: [], summary: {} }))
      ]);

      setClaimsList(claimsRes.claims || []);
      setClaimSummary(claimsRes.summary || { total: 0, pending: 0, approved: 0, rejected: 0 });

      setIncidentsList(incidentsRes.incidents || []);
      setIncidentSummary(incidentsRes.summary || { total: 0, pending: 0, resolved: 0 });
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu bồi thường & sự cố:', error);
      message.error('Không thể kết nối Backend để lấy danh sách sự cố và bồi thường.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [claimsRes, incidentsRes] = await Promise.all([
          managerApi.getClaims().catch(() => ({ claims: [], summary: {} })),
          managerApi.getIncidents().catch(() => ({ incidents: [], summary: {} }))
        ]);
        if (!ignore) {
          setClaimsList(claimsRes.claims || []);
          setClaimSummary(claimsRes.summary || { total: 0, pending: 0, approved: 0, rejected: 0 });
          setIncidentsList(incidentsRes.incidents || []);
          setIncidentSummary(incidentsRes.summary || { total: 0, pending: 0, resolved: 0 });
        }
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu bồi thường & sự cố:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadInitial();
    return () => { ignore = true; };
  }, []);

  // Open Claim Decision Modal (Screen 20)
  const handleOpenClaimModal = (claim) => {
    setSelectedClaim(claim);
    setClaimComment(claim.decision_comment || '');
    setIsClaimModalOpen(true);
  };

  // Submit Claim Decision
  const handleDecideClaim = async (action) => {
    if (!selectedClaim) return;
    const isApprove = action === 'APPROVE';

    // Ràng buộc nghiệp vụ: Bắt buộc comment nếu từ chối hoặc duyệt vượt hạn mức
    if (!isApprove && !claimComment.trim()) {
      message.warning('Bắt buộc nhập lý do/nhận xét khi từ chối yêu cầu bồi thường (MSG02).');
      return;
    }
    if (isApprove && selectedClaim.is_exceeding_cap && !claimComment.trim()) {
      message.warning('Yêu cầu bồi thường vượt hạn mức trách nhiệm! Vui lòng nhập lý do phê duyệt ngoại lệ (BR-37).');
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
      console.error('Lỗi quyết định claim:', error);
      message.error(error.message || 'Lỗi khi xử lý bồi thường');
    } finally {
      setDecidingClaim(false);
    }
  };

  // Open Incident Modal (Screen 14)
  const handleOpenIncidentModal = (incident) => {
    setSelectedIncident(incident);
    setIncidentFault(incident.fault || 'COMPANY');
    setCompensationAmount(incident.claim_amount || 0);
    setIncidentResolutionNote(incident.resolution_note || '');
    setIsIncidentModalOpen(true);
  };

  // Submit Incident Resolution (UC-25)
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

  // Open Trip Replay (UC-42 - Screen 40)
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

  // Filter Claims
  const filteredClaims = claimsList.filter((c) => {
    const matchSearch =
      !claimSearch ||
      c.claim_code?.toLowerCase().includes(claimSearch.toLowerCase()) ||
      c.order_code?.toLowerCase().includes(claimSearch.toLowerCase()) ||
      c.reason?.toLowerCase().includes(claimSearch.toLowerCase());

    const matchFilter = claimFilter === 'ALL' || c.status === claimFilter;
    return matchSearch && matchFilter;
  });

  // Filter Incidents
  const filteredIncidents = incidentsList.filter((i) => {
    const matchSearch =
      !incidentSearch ||
      i.code?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      i.trip_code?.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      i.description?.toLowerCase().includes(incidentSearch.toLowerCase());

    const matchFilter =
      incidentFilter === 'ALL' ||
      (incidentFilter === 'PENDING' && ['REPORTED', 'ESCALATED'].includes(i.status)) ||
      (incidentFilter === 'RESOLVED' && i.status === 'RESOLVED');

    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col w-full space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="flex flex-col space-y-1 z-10">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
              Sự Cố Lớn & Thẩm Định Bồi Thường
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
              {claimSummary.pending} Khiếu nại chờ duyệt
            </span>
          </div>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl">
            Thẩm định sự cố cấp cao (BR-16), xác định trách nhiệm lỗi (UC-25), kiểm soát trần bồi thường theo hợp đồng và NĐ 163 (BR-37) và xem lại hành trình GPS (UC-42 - Screen 40).
          </p>
        </div>

        <div className="flex items-center gap-space-sm shrink-0 z-10">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-surface-container-low text-primary font-label-lg text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-outline uppercase font-semibold">Khiếu nại chờ duyệt</span>
            <span className="material-symbols-outlined text-amber-600 text-[22px]">pending_actions</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-amber-600">{claimSummary.pending}</div>
            <div className="text-xs text-on-surface-variant">Yêu cầu cần xem xét ra quyết định</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-600 h-full rounded-full" style={{ width: `${claimSummary.total ? (claimSummary.pending / claimSummary.total) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-outline uppercase font-semibold">Đã phê duyệt (MSG27)</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-secondary">{claimSummary.approved}</div>
            <div className="text-xs text-on-surface-variant">Đã chấp thuận chi trả đền bù</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: `${claimSummary.total ? (claimSummary.approved / claimSummary.total) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-outline uppercase font-semibold">Sự cố lớn cần đóng</span>
            <span className="material-symbols-outlined text-error text-[22px]">car_crash</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-error">{incidentSummary.pending}</div>
            <div className="text-xs text-on-surface-variant">Hàng hỏng, tai nạn hoặc bị giữ (BR-16)</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: `${incidentSummary.total ? (incidentSummary.pending / incidentSummary.total) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-outline uppercase font-semibold">Sự cố đã giải quyết</span>
            <span className="material-symbols-outlined text-primary text-[22px]">task_alt</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-primary">{incidentSummary.resolved}</div>
            <div className="text-xs text-on-surface-variant">Đã xác định lỗi & hoàn tất hồ sơ</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md border border-outline-variant/20">
        <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container pb-space-sm">
          <div className="flex items-center gap-space-xs">
            <button
              onClick={() => setActiveMainTab('CLAIMS')}
              className={`px-4 py-2 rounded-xl font-label-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'CLAIMS'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">gavel</span>
              <span>Yêu Cầu Bồi Thường (Screen 19 & 20 V2) ({claimsList.length})</span>
            </button>

            <button
              onClick={() => setActiveMainTab('INCIDENTS')}
              className={`px-4 py-2 rounded-xl font-label-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'INCIDENTS'
                  ? 'bg-error text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">report_problem</span>
              <span>Sự Cố Lớn (Screen 17 & 14) ({incidentsList.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: CLAIMS (SCREEN 19 & 20) */}
        {activeMainTab === 'CLAIMS' && (
          <div className="mt-space-md space-y-space-md">
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-outline">Lọc trạng thái:</span>
                <button
                  onClick={() => setClaimFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    claimFilter === 'ALL' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Tất cả ({claimsList.length})
                </button>
                <button
                  onClick={() => setClaimFilter('PENDING')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    claimFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Chờ duyệt ({claimSummary.pending})
                </button>
                <button
                  onClick={() => setClaimFilter('APPROVED')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    claimFilter === 'APPROVED' ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Đã duyệt ({claimSummary.approved})
                </button>
                <button
                  onClick={() => setClaimFilter('REJECTED')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    claimFilter === 'REJECTED' ? 'bg-error text-white' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Từ chối ({claimSummary.rejected})
                </button>
              </div>

              <div className="w-full sm:w-72 relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
                  search
                </span>
                <input
                  value={claimSearch}
                  onChange={(e) => setClaimSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-space-md bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
                  placeholder="Tìm mã khiếu nại, mã đơn, lý do..."
                  type="text"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center"><Spin size="large" /></div>
            ) : filteredClaims.length === 0 ? (
              <div className="py-12 text-center text-outline">Không tìm thấy yêu cầu bồi thường nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                      <th className="py-3 px-space-md">MÃ KHIẾU NẠI</th>
                      <th className="py-3 px-space-md">ĐƠN HÀNG & LOẠI</th>
                      <th className="py-3 px-space-md">NGUỒN KHIẾU NẠI (V2)</th>
                      <th className="py-3 px-space-md">TIỀN YÊU CẦU</th>
                      <th className="py-3 px-space-md">GIỚI HẠN TRÁCH NHIỆM (BR-37)</th>
                      <th className="py-3 px-space-md">TRẠNG THÁI</th>
                      <th className="py-3 px-space-md text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-sm">
                    {filteredClaims.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-space-md font-mono font-bold text-primary">
                          {c.claim_code}
                        </td>
                        <td className="py-3 px-space-md">
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold text-primary">{c.order_code}</span>
                            <div className="mt-0.5">
                              <Tag color={c.order_type === 'Import' ? 'blue' : 'cyan'}>
                                {c.order_type || 'Export'}
                              </Tag>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-space-md text-xs font-medium text-on-surface">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-outline">
                              {c.source === 'CUSTOMER_CLAIM' ? 'support_agent' : 'report'}
                            </span>
                            <span>{c.source_display}</span>
                          </div>
                        </td>
                        <td className="py-3 px-space-md font-mono font-bold text-error">
                          {c.amount.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-space-md">
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold text-primary text-xs">
                              {c.liability_limit ? `${c.liability_limit.toLocaleString('vi-VN')} đ` : '500.000.000 đ'}
                            </span>
                            {c.is_exceeding_cap && (
                              <Tooltip title="Số tiền yêu cầu vượt giới hạn trách nhiệm hợp đồng / luật định (BR-37). Cần nhập lý do nếu phê duyệt.">
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded mt-0.5 w-fit">
                                  <span className="material-symbols-outlined text-[12px]">warning</span>
                                  Vượt trần (MSG56)
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-space-md">
                          <Tag color={c.status === 'APPROVED' ? 'green' : c.status === 'REJECTED' ? 'red' : 'gold'}>
                            {c.status}
                          </Tag>
                        </td>
                        <td className="py-3 px-space-md text-right">
                          <button
                            onClick={() => handleOpenClaimModal(c)}
                            className="px-3 py-1 rounded-lg bg-surface-container text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all cursor-pointer"
                          >
                            Thẩm định
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MAJOR INCIDENTS (SCREEN 17 & 14) */}
        {activeMainTab === 'INCIDENTS' && (
          <div className="mt-space-md space-y-space-md">
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-outline">Lọc:</span>
                <button
                  onClick={() => setIncidentFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    incidentFilter === 'ALL' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Tất cả ({incidentsList.length})
                </button>
                <button
                  onClick={() => setIncidentFilter('PENDING')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    incidentFilter === 'PENDING' ? 'bg-error text-white' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Chờ giải quyết ({incidentSummary.pending})
                </button>
                <button
                  onClick={() => setIncidentFilter('RESOLVED')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    incidentFilter === 'RESOLVED' ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Đã giải quyết ({incidentSummary.resolved})
                </button>
              </div>

              <div className="w-full sm:w-72 relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
                  search
                </span>
                <input
                  value={incidentSearch}
                  onChange={(e) => setIncidentSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-space-md bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
                  placeholder="Tìm mã sự cố, chuyến xe, mô tả..."
                  type="text"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center"><Spin size="large" /></div>
            ) : filteredIncidents.length === 0 ? (
              <div className="py-12 text-center text-outline">Không tìm thấy sự cố lớn nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                      <th className="py-3 px-space-md">MÃ SỰ CỐ</th>
                      <th className="py-3 px-space-md">CHUYẾN ĐI</th>
                      <th className="py-3 px-space-md">LOẠI SỰ CỐ (BR-16)</th>
                      <th className="py-3 px-space-md">TRÁCH NHIỆM LỖI</th>
                      <th className="py-3 px-space-md">TIỀN ĐỀN BÙ</th>
                      <th className="py-3 px-space-md">TRẠNG THÁI</th>
                      <th className="py-3 px-space-md text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-sm">
                    {filteredIncidents.map((i) => (
                      <tr key={i.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-space-md font-mono font-bold text-primary">
                          {i.code}
                        </td>
                        <td className="py-3 px-space-md">
                          <span className="font-mono font-semibold text-primary">{i.trip_code}</span>
                        </td>
                        <td className="py-3 px-space-md">
                          <Tag color="volcano">{i.type}</Tag>
                        </td>
                        <td className="py-3 px-space-md font-semibold text-xs">
                          {i.fault ? (
                            <span className={i.fault === 'COMPANY' ? 'text-error' : 'text-primary'}>
                              {i.fault === 'COMPANY' ? 'Lỗi Công ty' : i.fault === 'CUSTOMER' ? 'Lỗi Khách hàng' : 'Bên thứ ba'}
                            </span>
                          ) : (
                            <span className="text-outline">Chưa xác định</span>
                          )}
                        </td>
                        <td className="py-3 px-space-md font-mono font-bold text-primary">
                          {i.claim_amount > 0 ? `${i.claim_amount.toLocaleString('vi-VN')} đ` : '0 đ'}
                        </td>
                        <td className="py-3 px-space-md">
                          <Tag color={i.status === 'RESOLVED' ? 'green' : 'orange'}>
                            {i.status}
                          </Tag>
                        </td>
                        <td className="py-3 px-space-md text-right">
                          <div className="inline-flex items-center gap-2">
                            {i.trip_id && (
                              <button
                                onClick={() => handleOpenTripReplay(i.trip_id)}
                                className="px-2.5 py-1 rounded-lg bg-surface-container-low text-secondary hover:bg-surface-container text-xs font-semibold cursor-pointer"
                              >
                                Xem lại GPS (Screen 40)
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenIncidentModal(i)}
                              className="px-3 py-1 rounded-lg bg-error text-white hover:bg-red-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
                            >
                              Xử lý (Screen 14)
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

      {/* MODAL SCREEN 20: CHI TIẾT & PHÊ DUYỆT BỒI THƯỜNG (UC-26 V2) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-headline-sm font-bold">
            <span className="material-symbols-outlined text-secondary">verified_user</span>
            <span>Thẩm Định Yêu Cầu Bồi Thường & Ra Quyết Định (Screen 20)</span>
          </div>
        }
        open={isClaimModalOpen}
        onCancel={() => setIsClaimModalOpen(false)}
        footer={null}
        width={700}
        destroyOnHidden
      >
        {selectedClaim && (
          <div className="mt-4 space-y-4 text-sm">
            {/* Warning Banner MSG56 */}
            {selectedClaim.is_exceeding_cap && (
              <Alert
                message="Cảnh báo: Số tiền yêu cầu vượt giới hạn trách nhiệm (MSG56)"
                description={`Số tiền bồi thường (${selectedClaim.amount?.toLocaleString('vi-VN')} đ) vượt quá giới hạn trách nhiệm quy định theo Hợp đồng / NĐ 163 (${selectedClaim.liability_limit?.toLocaleString('vi-VN')} đ). Nếu phê duyệt ngoại lệ, bắt buộc phải nhập nhận xét giải trình (BR-37).`}
                type="warning"
                showIcon
                className="rounded-xl border border-amber-300"
              />
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-low rounded-xl text-xs">
              <div>Mã khiếu nại: <strong className="text-primary font-mono">{selectedClaim.claim_code}</strong></div>
              <div>Mã đơn hàng: <strong className="text-primary font-mono">{selectedClaim.order_code}</strong></div>
              <div>Loại đơn (V2): <Tag color="blue">{selectedClaim.order_type}</Tag></div>
              <div>Nguồn khiếu nại: <strong className="text-primary">{selectedClaim.source_display}</strong></div>
              <div>Trần Hợp đồng: <strong className="text-primary">{selectedClaim.contract_cap ? `${selectedClaim.contract_cap.toLocaleString('vi-VN')} đ` : 'Chưa thiết lập'}</strong></div>
              <div>Giới hạn trách nhiệm: <strong className="text-error">{selectedClaim.liability_limit?.toLocaleString('vi-VN')} đ</strong></div>
            </div>

            {/* Claim Amount & Reason */}
            <div className="p-3 border border-surface-container rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-outline">Số tiền đề xuất bồi thường:</span>
                <span className="text-xl font-black text-error font-mono">
                  {selectedClaim.amount?.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-outline block mb-1">Lý do khiếu nại / Bằng chứng:</span>
                <div className="p-2 bg-surface-container-lowest rounded-lg text-xs text-on-surface">
                  {selectedClaim.reason || 'Khách hàng yêu cầu bồi thường tổn thất trong quá trình vận chuyển.'}
                </div>
              </div>
            </div>

            {/* Comment Input */}
            <div>
              <label className="block text-xs font-bold uppercase text-outline mb-1">
                Nhận xét / Lý do quyết định: {(!selectedClaim || selectedClaim.is_exceeding_cap) ? '(Bắt buộc nếu Từ chối hoặc Vượt trần)' : '(Tùy chọn)'}
              </label>
              <Input.TextArea
                rows={3}
                value={claimComment}
                onChange={(e) => setClaimComment(e.target.value)}
                placeholder="Nhập nhận xét phê duyệt hoặc lý do từ chối bồi thường..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-surface-container">
              <button
                onClick={() => setIsClaimModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => handleDecideClaim('REJECT')}
                disabled={decidingClaim}
                className="px-5 py-2 rounded-xl bg-error text-white text-xs font-bold hover:bg-red-700 transition-all cursor-pointer shadow-sm"
              >
                Từ chối bồi thường
              </button>
              <button
                onClick={() => handleDecideClaim('APPROVE')}
                disabled={decidingClaim}
                className="px-5 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-all cursor-pointer shadow-sm"
              >
                Phê duyệt bồi thường (MSG27)
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL SCREEN 14: XỬ LÝ SỰ CỐ LỚN (UC-25) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-headline-sm font-bold">
            <span className="material-symbols-outlined text-error">gavel</span>
            <span>Xác Định Trách Nhiệm Lỗi & Đóng Sự Cố Lớn (Screen 14)</span>
          </div>
        }
        open={isIncidentModalOpen}
        onCancel={() => setIsIncidentModalOpen(false)}
        footer={null}
        width={650}
        destroyOnHidden
      >
        {selectedIncident && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="p-3 bg-surface-container-low rounded-xl text-xs space-y-1">
              <div>Mã sự cố: <strong className="text-primary font-mono">{selectedIncident.code}</strong></div>
              <div>Chuyến đi: <strong className="text-primary font-mono">{selectedIncident.trip_code}</strong></div>
              <div>Loại sự cố: <Tag color="volcano">{selectedIncident.type}</Tag></div>
              <div>Mô tả: {selectedIncident.description || 'Không có mô tả chi tiết'}</div>
            </div>

            {/* Chọn lỗi thuộc về */}
            <div>
              <label className="block text-xs font-bold uppercase text-outline mb-1">
                Bên có lỗi (Fault attribution): *
              </label>
              <Select
                className="w-full h-10"
                value={incidentFault}
                onChange={(val) => setIncidentFault(val)}
                options={[
                  { value: 'COMPANY', label: 'Lỗi thuộc về Công ty (Tài xế / Vận hành ALS)' },
                  { value: 'CUSTOMER', label: 'Lỗi thuộc về Khách hàng (Đóng gói sai / Thông tin sai)' },
                  { value: 'THIRD_PARTY', label: 'Lỗi thuộc về Bên thứ ba (Va chạm giao thông / Khách quan)' }
                ]}
              />
            </div>

            {/* Nhập số tiền bồi thường */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase text-outline">
                  Số tiền bồi thường tổn thất (VNĐ):
                </label>
                <span className="text-[11px] text-primary font-semibold">
                  (Nếu &gt; 0, hệ thống tự động sinh Yêu cầu bồi thường theo BR-17)
                </span>
              </div>
              <InputNumber
                className="w-full h-10"
                min={0}
                step={500000}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                value={compensationAmount}
                onChange={(val) => setCompensationAmount(val || 0)}
              />
            </div>

            {/* Ghi chú giải quyết */}
            <div>
              <label className="block text-xs font-bold uppercase text-outline mb-1">
                Kết luận giải quyết & Biện pháp khắc phục:
              </label>
              <Input.TextArea
                rows={3}
                value={incidentResolutionNote}
                onChange={(e) => setIncidentResolutionNote(e.target.value)}
                placeholder="Ghi nhận phương án xử lý sự cố, thỏa thuận bồi thường..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-surface-container">
              <button
                onClick={() => setIsIncidentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleResolveIncident}
                disabled={resolvingIncident}
                className="px-5 py-2 rounded-xl bg-error text-white text-xs font-bold hover:bg-red-700 transition-all cursor-pointer shadow-sm"
              >
                {resolvingIncident ? 'Đang lưu...' : 'Đóng sự cố & Ra quyết định (UC-25)'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL SCREEN 40: XEM LẠI CHUYẾN ĐI (TRIP REPLAY - UC-42) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-headline-sm font-bold">
            <span className="material-symbols-outlined text-secondary">play_circle</span>
            <span>Xem Lại Chuyến Đi & Hành Trình GPS (Screen 40)</span>
          </div>
        }
        open={isReplayModalOpen}
        onCancel={() => setIsReplayModalOpen(false)}
        footer={[
          <button
            key="close"
            onClick={() => setIsReplayModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-surface-container text-primary font-semibold text-xs cursor-pointer"
          >
            Đóng
          </button>
        ]}
        width={800}
        destroyOnHidden
      >
        {replayLoading ? (
          <div className="py-16 flex justify-center"><Spin size="large" description="Đang tải vết GPS và dòng thời gian..." /></div>
        ) : !replayData ? (
          <div className="py-12 text-center text-outline">Không có dữ liệu GPS cho chuyến đi này.</div>
        ) : (
          <div className="space-y-4 text-sm mt-3">
            {/* Trip summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-surface-container-low rounded-xl text-xs">
              <div>Mã chuyến: <strong className="text-primary font-mono">{replayData.trip?.trip_code}</strong></div>
              <div>Trạng thái: <Tag color="blue">{replayData.trip?.status}</Tag></div>
              <div>Số điểm GPS: <strong className="text-primary">{replayData.gps_track?.length || 0} điểm</strong></div>
              <div>Số sự kiện: <strong className="text-primary">{replayData.events?.length || 0} sự kiện</strong></div>
            </div>

            {/* GPS Visual Simulation Canvas/Box */}
            <div className="w-full h-48 bg-slate-900 rounded-xl relative overflow-hidden flex flex-col justify-between p-4 text-white">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  GPS Replay Engine Live
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Tốc độ:</span>
                  {[1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setReplaySpeed(spd)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${replaySpeed === spd ? 'bg-secondary text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Map representation */}
              <div className="flex flex-col items-center justify-center my-auto">
                <span className="material-symbols-outlined text-4xl text-secondary animate-bounce">local_shipping</span>
                <span className="text-xs text-slate-300 mt-1 font-mono">
                  {replayData.stops?.map((s) => s.address?.split(',')[0]).join(' ➔ ') || 'Kho ALS Nội Bài ➔ Sân bay Tân Sơn Nhất'}
                </span>
              </div>

              {/* Playback bar */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center cursor-pointer hover:bg-secondary-container"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: isPlaying ? '65%' : '20%' }}></div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">01:45 / 03:20</span>
              </div>
            </div>

            {/* Geofence & Checkpoint Events (BR-36) */}
            <div className="border border-surface-container rounded-xl p-3 space-y-2">
              <div className="text-xs font-bold uppercase text-outline">Dòng thời gian sự kiện & Kiểm tra Bán kính Geofence (BR-36):</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {replayData.events?.length === 0 ? (
                  <div className="text-xs text-outline py-2">Không ghi nhận sự kiện vi phạm bán kính nào.</div>
                ) : (
                  replayData.events?.map((ev, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-container-low">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[16px] ${ev.outside_radius ? 'text-error' : 'text-secondary'}`}>
                          {ev.outside_radius ? 'wrong_location' : 'check_circle'}
                        </span>
                        <span className="font-semibold text-primary">{ev.type}</span>
                        {ev.outside_radius && (
                          <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold">
                            Ngoài bán kính Geofence (BR-36)
                          </span>
                        )}
                      </div>
                      <span className="text-outline font-mono">
                        {ev.occurred_at ? new Date(ev.occurred_at).toLocaleTimeString('vi-VN') : '14:20'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
