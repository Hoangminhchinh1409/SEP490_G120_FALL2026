"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Spin, Tag, message } from 'antd';
import { managerApi } from '../../api/managerApi';
import { dispatcherApi } from '../../api/dispatcherApi';
import { useAuth } from '../../providers/AuthProvider';
import TripReplayModal from '../../components/common/TripReplayModal';
import { calculateAutoCompensation } from '../../utils/incidentCompensationHelper';
import ClaimDetailModal from './approvals/ClaimDetailModal';

const STATUS_BADGES = {
  PENDING: { color: 'orange', label: 'Chờ thẩm định' },
  APPROVED: { color: 'blue', label: 'Đã duyệt (Chờ gọi / chi trả)' },
  REJECTED: { color: 'red', label: 'Từ chối (Chờ gọi khách)' },
  PAID: { color: 'cyan', label: 'Đã chi trả (Chờ khách xác nhận)' },
  CLOSED_COMPENSATED: { color: 'green', label: 'Đã bồi thường (Đóng)' },
  CLOSED_REJECTED: { color: 'red', label: 'Đã đóng (Từ chối)' },
  CLOSED: { color: 'default', label: 'Đã đóng' }
};

export default function ApprovalsPage({ readOnly = false, dispatcherCallMode = false }) {
  const { user } = useAuth();
  const roleId = Number(user?.role_id);
  const useDispatcherEndpoint = dispatcherCallMode || roleId === 3;
  const isReadOnly = readOnly || (roleId !== 1 && roleId !== 2);
  const canRecordCallRole = roleId === 1 || roleId === 3 || dispatcherCallMode;

  const [loading, setLoading] = useState(true);
  const [claimsList, setClaimsList] = useState([]);
  const [claimSummary, setClaimSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    paid: 0,
    closed_compensated: 0,
    closed_rejected: 0,
    awaiting_call: 0
  });

  const [claimStatusFilter, setClaimStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Chi tiết Claim
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  // Manager Decision Form State
  const [decisionMode, setDecisionMode] = useState('APPROVE'); // 'APPROVE' | 'REJECT'
  const [assessmentResult, setAssessmentResult] = useState('');
  const [damagePercentage, setDamagePercentage] = useState(null);
  const [outcome, setOutcome] = useState('CUSTOMER_RETAIN');
  const [approvedAmount, setApprovedAmount] = useState(null);
  const [contractClauseRef, setContractClauseRef] = useState('');
  const [claimComment, setClaimComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [contactHotline, setContactHotline] = useState('1900 1234');
  const [decidingClaim, setDecidingClaim] = useState(false);

  // Dispatcher Call Form State
  const [callContactPhone, setCallContactPhone] = useState('');
  const [callNote, setCallNote] = useState('');
  const [recordingCall, setRecordingCall] = useState(false);

  // Manager Payment Form State
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transactionCode, setTransactionCode] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Trip Replay Modal
  const [isReplayModalOpen, setIsReplayModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const claimsRes = useDispatcherEndpoint
        ? await dispatcherApi.getClaims().catch(() => ({ claims: [], summary: {} }))
        : await managerApi.getClaims().catch(() => ({ claims: [], summary: {} }));
      setClaimsList(claimsRes?.claims || []);
      setClaimSummary(claimsRes?.summary || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        paid: 0,
        closed_compensated: 0,
        closed_rejected: 0,
        awaiting_call: 0
      });
    } catch (error) {
      console.error('Lỗi khi tải danh sách yêu cầu bồi thường:', error);
      message.error('Không thể tải danh sách yêu cầu bồi thường từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [useDispatcherEndpoint]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const hydrateClaimForm = (claim) => {
    setSelectedClaim(claim);
    setDecisionMode('APPROVE');
    setAssessmentResult(claim.assessment_result || '');
    setDamagePercentage(claim.damage_percentage ?? null);
    setOutcome(claim.outcome || 'CUSTOMER_RETAIN');
    setApprovedAmount(Number(claim.approved_amount || claim.amount || 0));
    setContractClauseRef(claim.contract_clause_ref || '');
    setClaimComment(claim.decision_comment || claim.review_comment || '');
    setRejectionReason(claim.rejection_reason || '');
    setContactHotline(claim.contact_hotline || '1900 1234');
    setCallContactPhone(claim.call_contact_phone || claim.contact_phone || claim.customer?.phone || '');
    setCallNote(claim.call_note || '');
    setPaymentDate(claim.payment_date || new Date().toISOString().split('T')[0]);
    setTransactionCode(claim.transaction_code || '');
    setPaymentProofUrl(claim.payment_proof_url || '');
    setPaymentNote(claim.payment_note || '');
  };

  const handleOpenClaimModal = async (claim) => {
    hydrateClaimForm(claim);
    setIsClaimModalOpen(true);
    setDetailLoading(true);
    try {
      const detail = useDispatcherEndpoint
        ? await dispatcherApi.getClaimById(claim.id)
        : await managerApi.getClaimById(claim.id);
      if (detail) {
        hydrateClaimForm(detail);
      }
    } catch (err) {
      console.warn('Không tải được chi tiết Claim mở rộng:', err?.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAutoCalculateAmount = () => {
    if (!selectedClaim) return;
    const calc = calculateAutoCompensation({
      declaredValue: selectedClaim.declared_value || 0,
      damagePercentage: damagePercentage ?? 0,
      handlingMethod: outcome,
      liabilityCap: selectedClaim.liability_limit || 500000000
    });
    setApprovedAmount(calc);
  };

  const handleDecideClaim = async () => {
    if (!selectedClaim) return;
    const isApprove = decisionMode === 'APPROVE';

    if (isApprove) {
      if (approvedAmount === null || approvedAmount === undefined || Number(approvedAmount) < 0) {
        message.warning('Vui lòng nhập số tiền bồi thường phê duyệt hợp lệ (>= 0 đ).');
        return;
      }
      const limit = Number(selectedClaim.liability_limit || 500000000);
      if (Number(approvedAmount) > limit && !claimComment.trim()) {
        message.warning('Số tiền duyệt vượt giới hạn trách nhiệm! Bắt buộc nhập nhận xét/lý do phê duyệt ngoại lệ (MSG56).');
        return;
      }
    } else {
      if (!rejectionReason.trim()) {
        message.warning('Bắt buộc nhập lý do chi tiết khi từ chối bồi thường.');
        return;
      }
    }

    try {
      setDecidingClaim(true);
      const payload = isApprove
        ? {
            action: 'APPROVE',
            approved_amount: Number(approvedAmount || 0),
            outcome,
            damage_percentage: damagePercentage !== null && damagePercentage !== undefined ? Number(damagePercentage) : null,
            assessment_result: assessmentResult.trim() || null,
            contract_clause_ref: contractClauseRef.trim() || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa',
            contact_hotline: contactHotline.trim() || '1900 1234',
            comment: claimComment.trim()
          }
        : {
            action: 'REJECT',
            rejection_reason: rejectionReason.trim(),
            assessment_result: assessmentResult.trim() || null,
            contract_clause_ref: contractClauseRef.trim() || 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng',
            contact_hotline: contactHotline.trim() || '1900 1234',
            comment: claimComment.trim() || rejectionReason.trim()
          };

      const res = await managerApi.decideClaim(selectedClaim.id, payload);
      message.success(res?.message || 'Đã lưu quyết định thẩm định bồi thường!');
      setIsClaimModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Lỗi quyết định bồi thường:', error);
      message.error(error.message || 'Lỗi khi xử lý yêu cầu bồi thường');
    } finally {
      setDecidingClaim(false);
    }
  };

  const handleRecordDispatcherCall = async () => {
    if (!selectedClaim) return;
    if (!callNote.trim()) {
      message.warning('Vui lòng nhập nội dung trao đổi & kết quả cuộc gọi với khách hàng.');
      return;
    }
    try {
      setRecordingCall(true);
      const res = await dispatcherApi.recordClaimCall(selectedClaim.id, {
        call_contact_phone: callContactPhone.trim(),
        call_note: callNote.trim()
      });
      message.success(res?.message || 'Đã ghi nhận cuộc gọi thông báo khách hàng thành công!');
      setIsClaimModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Lỗi ghi nhận cuộc gọi:', error);
      message.error(error.message || 'Không thể ghi nhận cuộc gọi');
    } finally {
      setRecordingCall(false);
    }
  };

  const handleRecordManagerPayment = async () => {
    if (!selectedClaim) return;
    if (!transactionCode.trim()) {
      message.warning('Vui lòng nhập mã giao dịch ngân hàng (UNC).');
      return;
    }
    if (!paymentProofUrl.trim()) {
      message.warning('Vui lòng tải lên ảnh biên lai / chứng từ chuyển khoản.');
      return;
    }
    try {
      setRecordingPayment(true);
      const res = await managerApi.recordClaimPayment(selectedClaim.id, {
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        transaction_code: transactionCode.trim(),
        payment_proof_url: paymentProofUrl.trim(),
        payment_note: paymentNote.trim() || undefined
      });
      message.success(res?.message || 'Đã ghi nhận thanh toán bồi thường và gửi email tới khách hàng!');
      setIsClaimModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Lỗi ghi nhận thanh toán:', error);
      message.error(error.message || 'Không thể ghi nhận thanh toán bồi thường');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleOpenTripReplay = (tripId) => {
    if (!tripId) {
      message.warning('Yêu cầu bồi thường này không gắn với chuyến xe cụ thể.');
      return;
    }
    setIsReplayModalOpen(true);
  };

  const filteredClaims = claimsList.filter((c) => {
    const st = String(c.status || 'PENDING').toUpperCase();
    const matchStatus =
      claimStatusFilter === 'ALL' ||
      (claimStatusFilter === 'AWAITING_CALL' && (st === 'APPROVED' || st === 'REJECTED') && !c.called_at) ||
      st === claimStatusFilter;

    const matchSource =
      sourceFilter === 'ALL' ||
      (sourceFilter === 'INCIDENT' && c.source !== 'CUSTOMER_CLAIM') ||
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
      c.customer?.company_name?.toLowerCase().includes(query) ||
      c.reason?.toLowerCase().includes(query) ||
      c.source_display?.toLowerCase().includes(query);

    return matchStatus && matchSource && matchSearch;
  });

  const selectedStatus = String(selectedClaim?.status || 'PENDING').toUpperCase();
  const canRecordCallForSelected =
    Boolean(selectedClaim) &&
    canRecordCallRole &&
    (selectedStatus === 'APPROVED' || selectedStatus === 'REJECTED') &&
    !selectedClaim?.called_at;
  const canRecordPaymentForSelected =
    Boolean(selectedClaim) &&
    !isReadOnly &&
    selectedStatus === 'APPROVED' &&
    Boolean(selectedClaim?.called_at);

  const allEvidencePhotos = selectedClaim
    ? [...new Set([
        ...(selectedClaim.evidence_photos || []),
        ...(selectedClaim.incident_photos || [])
      ])]
    : [];

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              Quản lý Yêu cầu Bồi thường (Claims BF-04)
            </h1>
            {claimSummary.pending > 0 ? (
              <Tag color="error" className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                {claimSummary.pending} Chờ thẩm định
              </Tag>
            ) : (
              <Tag color="green" className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                Không còn hồ sơ chờ thẩm định
              </Tag>
            )}
            {claimSummary.awaiting_call > 0 && (
              <Tag color="processing" className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                {claimSummary.awaiting_call} Chờ ĐPV gọi khách
              </Tag>
            )}
          </div>
          <p className="text-xs text-on-surface-variant mt-1.5 max-w-3xl">
            Thẩm định toàn bộ yêu cầu bồi thường từ Sự cố hiện trường &amp; Khách hàng khiếu nại, kiểm tra hợp đồng &amp; chứng cứ, theo dõi cuộc gọi xác nhận và chi trả.
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

      {/* KPI Cards */}
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
            <div className="text-xs text-on-surface-variant font-medium">Chờ Quản lý duyệt</div>
            <div className="text-xl font-black text-amber-600 font-mono">{claimSummary.pending}</div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">call</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Chờ ĐPV gọi khách</div>
            <div className="text-xl font-black text-blue-600 font-mono">{claimSummary.awaiting_call || 0}</div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">check_circle</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Đã đóng hồ sơ</div>
            <div className="text-xl font-black text-emerald-600 font-mono">
              {(claimSummary.closed_compensated || 0) + (claimSummary.closed_rejected || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
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
                <option value="PENDING">Chờ thẩm định ({claimSummary.pending})</option>
                <option value="AWAITING_CALL">Chờ ĐPV gọi khách ({claimSummary.awaiting_call || 0})</option>
                <option value="APPROVED">Đã duyệt ({claimSummary.approved})</option>
                <option value="REJECTED">Từ chối ({claimSummary.rejected})</option>
                <option value="PAID">Đã chi trả ({claimSummary.paid || 0})</option>
                <option value="CLOSED_COMPENSATED">Đóng - Đã bồi thường ({claimSummary.closed_compensated || 0})</option>
                <option value="CLOSED_REJECTED">Đóng - Từ chối ({claimSummary.closed_rejected || 0})</option>
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
                <option value="INCIDENT">Sự cố vận chuyển / ĐPV tạo</option>
                <option value="CUSTOMER_CLAIM">Khách hàng khiếu nại (Tracking Page)</option>
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
              placeholder="Tìm theo mã yêu cầu, đơn hàng, khách hàng, sự cố..."
              className="w-full h-9 pl-9 pr-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Spin size="large" /></div>
        ) : filteredClaims.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant bg-surface-container-low/30 rounded-2xl border border-dashed border-surface-container">
            <span className="material-symbols-outlined text-4xl text-secondary mb-1">verified_user</span>
            <p className="font-bold text-sm text-primary">Không có yêu cầu bồi thường nào phù hợp</p>
            <p className="text-xs text-on-surface-variant mt-1">
              Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider border-b border-surface-container">
                  <th className="py-3 px-4">Mã yêu cầu</th>
                  <th className="py-3 px-4">Đơn hàng &amp; Khách hàng</th>
                  <th className="py-3 px-4">Nguồn gửi &amp; Nội dung</th>
                  <th className="py-3 px-4">Tiền yêu cầu / Duyệt</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Cuộc gọi ĐPV</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {filteredClaims.map((c) => {
                  const st = String(c.status || 'PENDING').toUpperCase();
                  const badge = STATUS_BADGES[st] || { color: 'default', label: st };
                  const needsCall = (st === 'APPROVED' || st === 'REJECTED') && !c.called_at;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenClaimModal(c)}
                      className="hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                        <div>{c.claim_code}</div>
                        <div className="text-[10px] font-normal text-on-surface-variant">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-primary block">{c.order_code}</span>
                        <span className="text-[11px] text-on-surface-variant block truncate max-w-[170px]">
                          {c.customer?.company_name || c.receiver_name || 'Khách hàng'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                            c.source === 'CUSTOMER_CLAIM'
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                              : 'bg-blue-500/10 text-blue-700 border-blue-200'
                          }`}>
                            {c.source === 'CUSTOMER_CLAIM' ? 'Khách hàng khiếu nại' : (c.incident_code || 'Từ sự cố')}
                          </span>
                          <span className="text-[11px] text-on-surface-variant block truncate max-w-[220px]" title={c.reason}>
                            {c.reason}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-primary">
                          YC: {Number(c.amount || 0).toLocaleString('vi-VN')} đ
                        </div>
                        {Number(c.approved_amount || 0) > 0 && (
                          <div className="font-mono font-bold text-emerald-700 text-[11px]">
                            Duyệt: {Number(c.approved_amount).toLocaleString('vi-VN')} đ
                          </div>
                        )}
                        {c.is_exceeding_cap && (
                          <span className="text-[10px] text-amber-700 font-bold">⚠ Vượt hạn mức</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Tag color={badge.color} className="font-bold text-xs m-0">{badge.label}</Tag>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {c.called_at ? (
                          <Tag color="green" className="text-[11px] font-semibold m-0">
                            Đã gọi ({new Date(c.called_at).toLocaleDateString('vi-VN')})
                          </Tag>
                        ) : needsCall ? (
                          <Tag color="gold" className="text-[11px] font-bold m-0">
                            Cần ĐPV gọi khách
                          </Tag>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant">—</span>
                        )}
                      </td>

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
                          <span>
                            {!isReadOnly && st === 'PENDING'
                              ? 'Thẩm định'
                              : !isReadOnly && st === 'APPROVED' && c.called_at
                                ? 'Ghi nhận chi trả'
                                : canRecordCallRole && needsCall
                                  ? 'Ghi nhận gọi'
                                  : 'Chi tiết'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT & XỬ LÝ CLAIM (BF-04) */}
      <ClaimDetailModal
        open={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        detailLoading={detailLoading}
        selectedClaim={selectedClaim}
        selectedStatus={selectedStatus}
        statusBadges={STATUS_BADGES}
        allEvidencePhotos={allEvidencePhotos}
        isReadOnly={isReadOnly}
        canRecordCallForSelected={canRecordCallForSelected}
        canRecordPaymentForSelected={canRecordPaymentForSelected}
        onOpenTripReplay={handleOpenTripReplay}
        paymentDate={paymentDate}
        setPaymentDate={setPaymentDate}
        transactionCode={transactionCode}
        setTransactionCode={setTransactionCode}
        paymentProofUrl={paymentProofUrl}
        setPaymentProofUrl={setPaymentProofUrl}
        paymentNote={paymentNote}
        setPaymentNote={setPaymentNote}
        recordingPayment={recordingPayment}
        onRecordManagerPayment={handleRecordManagerPayment}
        decisionMode={decisionMode}
        setDecisionMode={setDecisionMode}
        assessmentResult={assessmentResult}
        setAssessmentResult={setAssessmentResult}
        damagePercentage={damagePercentage}
        setDamagePercentage={setDamagePercentage}
        outcome={outcome}
        setOutcome={setOutcome}
        approvedAmount={approvedAmount}
        setApprovedAmount={setApprovedAmount}
        contractClauseRef={contractClauseRef}
        setContractClauseRef={setContractClauseRef}
        contactHotline={contactHotline}
        setContactHotline={setContactHotline}
        claimComment={claimComment}
        setClaimComment={setClaimComment}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        decidingClaim={decidingClaim}
        onAutoCalculateAmount={handleAutoCalculateAmount}
        onDecideClaim={handleDecideClaim}
        callContactPhone={callContactPhone}
        setCallContactPhone={setCallContactPhone}
        callNote={callNote}
        setCallNote={setCallNote}
        recordingCall={recordingCall}
        onRecordDispatcherCall={handleRecordDispatcherCall}
      />

      <TripReplayModal
        open={isReplayModalOpen}
        onClose={() => setIsReplayModalOpen(false)}
        tripId={selectedClaim?.trip_id}
      />
    </div>
  );
}
