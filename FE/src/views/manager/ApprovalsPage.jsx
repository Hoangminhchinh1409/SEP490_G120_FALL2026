"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { managerApi } from '../../api/managerApi';

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [approvalsList, setApprovalsList] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('SLA'); // 'SLA', 'VALUE_DESC', 'TIME_DESC'
  
  // Modal states
  const [decisionModal, setDecisionModal] = useState({
    isOpen: false,
    item: null,
    action: 'APPROVE', // 'APPROVE' or 'REJECT'
    reason: '',
    note: '',
    submitting: false
  });

  const [detailModalItem, setDetailModalItem] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const parseAndSetApprovals = (data) => {
    // Format DB items
    const dbItems = (data || []).map(item => {
      let cat = 'CLAIM';
      let icon = 'shield_with_heart';
      let tagColor = 'error';
      if (item.type === 'BREAKDOWN') {
        cat = 'FLEET';
        icon = 'car_crash';
      } else if (item.type === 'ROAD_BAN') {
        cat = 'FLEET';
        icon = 'traffic';
      } else if (item.type === 'DELAY') {
        cat = 'QUOTE';
        icon = 'timer';
      }

      return {
        id: item.id,
        code: item.code || `INC-${item.id}`,
        type: item.type || 'Sự cố vận hành',
        category: cat,
        title: `Xử lý sự cố & Bồi thường ${item.tripId || ''}: ${item.type || 'Sự cố vận chuyển'}`,
        description: item.description || item.claim_reason || 'Yêu cầu thẩm định và phê duyệt chi phí đền bù tổn thất trong quá trình vận hành trung chuyển.',
        requester: item.requester_name || 'Dispatcher / Tài xế hiện trường',
        timeAgo: 'Gần đây',
        slaRemaining: item.status === 'REPORTED' ? '15 phút' : 'Đã phản hồi',
        slaCritical: item.type === 'BREAKDOWN' || item.type === 'ACCIDENT',
        customer: 'ALS Logistics Network',
        hawb: item.tripId || 'TRIP-998',
        route: 'Nội địa',
        proposedValue: Number(item.cost || 0),
        baseCost: 0,
        margin: 'Trách nhiệm: ' + (item.fault || 'Đang xác định'),
        status: (item.claim_status === 'APPROVED' || item.status === 'RESOLVED') ? 'APPROVED' : ((item.claim_status === 'REJECTED' || item.status === 'CLOSED') ? 'REJECTED' : 'PENDING'),
        icon: icon,
        tagLabel: item.fault ? `Lỗi: ${item.fault}` : 'Thẩm định sự cố',
        tagColor: tagColor,
        isDbRecord: true
      };
    });

    setApprovalsList(dbItems);
  };

  const loadApprovals = () => {
    setLoading(true);
    managerApi.getApprovals()
      .then(res => {
        const rawList = Array.isArray(res) ? res : (res?.requests || []);
        parseAndSetApprovals(rawList);
      })
      .catch(err => {
        console.error('Failed to load approvals:', err);
        showToast('Không thể tải danh sách duyệt từ máy chủ', 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    managerApi.getApprovals()
      .then(res => {
        const rawList = Array.isArray(res) ? res : (res?.requests || []);
        if (isMounted) parseAndSetApprovals(rawList);
      })
      .catch(err => {
        console.error('Failed to load approvals:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  // Filter & Search Logic
  const filteredApprovals = useMemo(() => {
    return approvalsList.filter(item => {
      // Tab filter
      if (activeTab === 'QUOTE' && item.category !== 'QUOTE') return false;
      if (activeTab === 'CHARTER' && item.category !== 'CHARTER') return false;
      if (activeTab === 'CLAIM' && item.category !== 'CLAIM') return false;
      if (activeTab === 'FLEET' && item.category !== 'FLEET') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchCode = item.code?.toLowerCase().includes(q);
        const matchCust = item.customer?.toLowerCase().includes(q);
        const matchHawb = item.hawb?.toLowerCase().includes(q);
        return matchTitle || matchCode || matchCust || matchHawb;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'VALUE_DESC') return b.proposedValue - a.proposedValue;
      if (sortBy === 'SLA') {
        if (a.slaCritical && !b.slaCritical) return -1;
        if (!a.slaCritical && b.slaCritical) return 1;
        return 0;
      }
      return 0;
    });
  }, [approvalsList, activeTab, searchQuery, sortBy]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const total = approvalsList.length;
    const quotes = approvalsList.filter(x => x.category === 'QUOTE').length;
    const charters = approvalsList.filter(x => x.category === 'CHARTER').length;
    const claims = approvalsList.filter(x => x.category === 'CLAIM').length;
    const fleets = approvalsList.filter(x => x.category === 'FLEET').length;
    return { total, quotes, charters, claims, fleets };
  }, [approvalsList]);

  const criticalSlaCount = approvalsList.filter(x => x.slaCritical || x.type === 'BREAKDOWN' || x.type === 'ACCIDENT').length;
  const pendingCount = approvalsList.filter(x => x.status === 'PENDING').length;
  const totalClaimsValue = approvalsList.reduce((acc, cur) => acc + (Number(cur.proposedValue) || 0), 0);
  const fleetDispatchCount = approvalsList.filter(x => x.category === 'FLEET').length;
  const approvedCount = approvalsList.filter(x => x.status === 'APPROVED').length;
  const totalCount = approvalsList.length;
  const approvalRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  // Handler for opening decision modal
  const handleOpenDecision = (item, action) => {
    setDecisionModal({
      isOpen: true,
      item,
      action,
      reason: action === 'APPROVE' ? 'Đủ điều kiện phê duyệt & đúng thẩm quyền' : 'Không đạt tiêu chí biên lợi nhuận quy định',
      note: '',
      submitting: false
    });
  };

  // Submit Decision
  const handleConfirmDecision = async () => {
    const { item, action, reason, note } = decisionModal;
    if (!item) return;

    setDecisionModal(prev => ({ ...prev, submitting: true }));

    try {
      if (item.isDbRecord) {
        await managerApi.decideApproval(item.id, {
          action: action,
          reason: reason,
          note: note
        });
      }

      // Update state locally
      setApprovalsList(prev => prev.map(rec => {
        if (rec.id === item.id) {
          return {
            ...rec,
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
          };
        }
        return rec;
      }));

      showToast(
        action === 'APPROVE' 
          ? `Đã phê duyệt thành công yêu cầu ${item.code}` 
          : `Đã từ chối yêu cầu ${item.code}`,
        action === 'APPROVE' ? 'success' : 'info'
      );

      setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', reason: '', note: '', submitting: false });
    } catch (err) {
      console.error('Decision error:', err);
      showToast(err.message || 'Lỗi khi gửi quyết định duyệt', 'error');
      setDecisionModal(prev => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="flex flex-col w-full gap-y-space-lg text-on-surface">
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border animate-slide-up ${
          toastMessage.type === 'error' 
            ? 'bg-red-950/95 text-red-200 border-red-700/60' 
            : 'bg-slate-900/95 text-white border-blue-500/40'
        }`}>
          <span className="material-symbols-outlined text-[22px] text-secondary">
            {toastMessage.type === 'error' ? 'error' : 'task_alt'}
          </span>
          <span className="font-body-md text-sm font-medium">{toastMessage.msg}</span>
        </div>
      )}

      {/* Top Hero Header / Dispatch Control Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-[0_1px_3px_0_rgba(15,43,92,0.04)] relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-secondary/5 blur-3xl pointer-events-none"></div>
        <div className="flex flex-col gap-space-xs z-10">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="font-headline-lg text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight">
              Trung tâm Duyệt Yêu Cầu &amp; Phê Duyệt Tải
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-error font-label-sm text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-error"></span>
              {tabCounts.total} yêu cầu cần xử lý
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-data-mono text-xs">
              <span className="material-symbols-outlined text-[15px] text-secondary">verified_user</span>
              Tier 3 Dispatch Authority
            </span>
          </div>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl">
            Xử lý phê duyệt báo giá đặc biệt, yêu cầu chuyến bay khẩn cấp (Emergency Charter), điều chỉnh tải trọng và đền bù sự cố theo phân cấp vận hành NEXLOG OS.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-space-sm flex-wrap z-10">
          <button
            onClick={() => loadApprovals()}
            className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-xl bg-surface-container-low text-primary font-label-lg text-sm font-semibold hover:bg-surface-container hover:text-primary transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Đồng bộ mới nhất</span>
          </button>
          <button
            onClick={() => {
              // Batch approve all pending items
              setApprovalsList(prev => prev.map(p => ({ ...p, status: 'APPROVED' })));
              showToast('Đã áp dụng phê duyệt nhanh cho toàn bộ hồ sơ hợp lệ!');
            }}
            className="inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-xl bg-on-tertiary-container text-white font-label-lg text-sm font-bold shadow-sm hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            <span>Phê duyệt hàng loạt</span>
          </button>
        </div>
      </div>

      {/* KPI Matrix (Key Performance & Dispatch Status) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Card 1: Critical SLAs */}
        <div className="relative bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_3px_0_rgba(15,43,92,0.04)] flex flex-col justify-between overflow-hidden border border-outline-variant/30">
          <div className="absolute top-0 left-0 right-0 h-1 bg-error"></div>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-xs font-semibold text-outline uppercase tracking-wider">Khẩn cấp SLA &lt; 30p</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl text-error font-extrabold leading-none">{criticalSlaCount}</span>
                <span className="font-label-sm text-xs text-error font-semibold">yêu cầu</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-error-container/60 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[22px]">timer</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between font-body-sm text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded-lg">
            <span className="flex items-center gap-1 text-error font-medium">
              <span className="material-symbols-outlined text-[16px]">priority_high</span>
              {criticalSlaCount > 0 ? `${criticalSlaCount} sự cố khẩn cấp` : 'Không có sự cố khẩn cấp'}
            </span>
            <span className="font-data-mono text-[11px] text-outline">Realtime DB</span>
          </div>
        </div>

        {/* Card 2: Price Quotes / Claims */}
        <div className="relative bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_3px_0_rgba(15,43,92,0.04)] flex flex-col justify-between overflow-hidden border border-outline-variant/30">
          <div className="absolute top-0 left-0 right-0 h-1 bg-on-tertiary-container"></div>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-xs font-semibold text-outline uppercase tracking-wider">Hồ sơ chờ phê duyệt</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl text-primary font-extrabold leading-none">{pendingCount}</span>
                <span className="font-label-sm text-xs text-outline font-semibold">hồ sơ</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <span className="material-symbols-outlined text-[22px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between font-body-sm text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded-lg">
            <span className="text-on-surface-variant">Tổng chi phí: <strong className="text-primary font-bold">{totalClaimsValue.toLocaleString('vi-VN')} đ</strong></span>
            <span className="font-data-mono text-[11px] text-secondary font-semibold">Thẩm định</span>
          </div>
        </div>

        {/* Card 3: Out-of-province Fleet Dispatch & Technical */}
        <div className="relative bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_3px_0_rgba(15,43,92,0.04)] flex flex-col justify-between overflow-hidden border border-outline-variant/30">
          <div className="absolute top-0 left-0 right-0 h-1 bg-secondary"></div>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-xs font-semibold text-outline uppercase tracking-wider">Sự cố kỹ thuật &amp; Đội xe</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl text-secondary font-extrabold leading-none">{fleetDispatchCount}</span>
                <span className="font-label-sm text-xs text-outline font-semibold">hồ sơ</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[22px]">rv_hookup</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between font-body-sm text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded-lg">
            <span className="text-on-surface-variant">Phân loại sự cố kỹ thuật xe</span>
            <span className="font-data-mono text-[11px] text-secondary font-semibold">{fleetDispatchCount} vụ</span>
          </div>
        </div>

        {/* Card 4: Daily Clearance Metric */}
        <div className="relative bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_3px_0_rgba(15,43,92,0.04)] flex flex-col justify-between overflow-hidden border border-outline-variant/30">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-xs font-semibold text-outline uppercase tracking-wider">Đã giải quyết / Phê duyệt</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl text-primary font-extrabold leading-none">{approvedCount}</span>
                <span className="font-label-sm text-xs text-outline font-semibold">hồ sơ</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">task_alt</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between font-body-sm text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded-lg">
            <span className="flex items-center gap-1 text-on-surface font-medium">
              Tỷ lệ hoàn tất: <strong className="text-secondary">{approvalRate}%</strong>
            </span>
            <div className="w-16 h-2 bg-surface-container rounded-full overflow-hidden">
              <div className="bg-secondary h-full rounded-full" style={{ width: `${approvalRate}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Filter Bar & Tab Segments */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-sm rounded-xl shadow-[0_1px_3px_0_rgba(15,43,92,0.04)] border border-outline-variant/30">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl font-label-lg text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            Tất cả yêu cầu <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-xs">{tabCounts.total}</span>
          </button>
          <button
            onClick={() => setActiveTab('QUOTE')}
            className={`px-4 py-2 rounded-xl font-label-lg text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'QUOTE'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            Báo giá nhanh trực tuyến <span className="ml-1.5 px-2 py-0.5 rounded-full bg-surface-container text-xs font-semibold">{tabCounts.quotes}</span>
          </button>
          <button
            onClick={() => setActiveTab('CHARTER')}
            className={`px-4 py-2 rounded-xl font-label-lg text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'CHARTER'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            Cấp tải bay khẩn cấp <span className="ml-1.5 px-2 py-0.5 rounded-full bg-error-container text-error text-xs font-bold">{tabCounts.charters}</span>
          </button>
          <button
            onClick={() => setActiveTab('CLAIM')}
            className={`px-4 py-2 rounded-xl font-label-lg text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'CLAIM'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            Bồi thường sự cố hàng hóa <span className="ml-1.5 px-2 py-0.5 rounded-full bg-surface-container text-xs font-semibold">{tabCounts.claims}</span>
          </button>
          <button
            onClick={() => setActiveTab('FLEET')}
            className={`px-4 py-2 rounded-xl font-label-lg text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'FLEET'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            Điều xe ngoại tỉnh <span className="ml-1.5 px-2 py-0.5 rounded-full bg-surface-container text-xs font-semibold">{tabCounts.fleets}</span>
          </button>
        </div>

        {/* Quick Tools & Search */}
        <div className="flex items-center gap-2 px-space-xs">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Lọc mã đơn, khách hàng..."
              className="w-48 lg:w-56 h-9 pl-8 pr-3 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary transition-all"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-outline text-[16px] pointer-events-none">search</span>
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="h-9 bg-surface-container-low px-3 rounded-xl font-label-sm text-xs text-on-surface-variant border-none focus:ring-1 focus:ring-secondary cursor-pointer"
          >
            <option value="SLA">Ưu tiên SLA cao nhất</option>
            <option value="VALUE_DESC">Giá trị cao nhất</option>
          </select>

          <button
            onClick={loadApprovals}
            className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
            title="Làm mới dữ liệu"
            type="button"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>sync</span>
          </button>
        </div>
      </div>

      {/* Interactive Dispatch Request Cards List */}
      <div className="flex flex-col gap-space-md">
        {loading && approvalsList.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-surface-container-lowest rounded-xl">
            <span className="material-symbols-outlined text-4xl text-secondary animate-spin">progress_activity</span>
            <p className="mt-3 text-sm text-on-surface-variant font-medium">Đang tải hồ sơ phê duyệt...</p>
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="py-16 text-center bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant/60">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">task_alt</span>
            <p className="text-sm font-semibold text-on-surface">Không có yêu cầu nào trong danh mục này</p>
            <p className="text-xs text-outline mt-1">Tất cả hồ sơ liên quan đã được xử lý hoặc phân cấp hoàn tất.</p>
          </div>
        ) : (
          filteredApprovals.map((item) => {
            const isApproved = item.status === 'APPROVED';
            const isRejected = item.status === 'REJECTED';
            const isPending = !isApproved && !isRejected;

            // Accent bar color
            let accentColor = 'bg-primary';
            if (item.tagColor === 'error' || item.slaCritical) accentColor = 'bg-error';
            else if (item.tagColor === 'warning') accentColor = 'bg-on-tertiary-container';
            else if (item.tagColor === 'secondary') accentColor = 'bg-secondary';

            return (
              <div
                key={item.id}
                className="bg-surface-container-lowest rounded-xl p-space-lg shadow-[0_2px_8px_rgba(15,43,92,0.06)] hover:shadow-md transition-shadow relative overflow-hidden flex flex-col gap-space-md border border-outline-variant/30"
              >
                {/* SLA Accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentColor}`}></div>

                {/* Top bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm pl-2">
                  <div className="flex flex-wrap items-center gap-space-sm">
                    <span className={`px-2.5 py-1 rounded font-data-mono text-xs font-bold flex items-center gap-1 ${
                      item.tagColor === 'error' ? 'bg-error-container text-error' :
                      item.tagColor === 'warning' ? 'bg-orange-100 text-orange-700' :
                      item.tagColor === 'secondary' ? 'bg-blue-100 text-blue-700' :
                      'bg-surface-container-high text-primary font-semibold'
                    }`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {item.tagColor === 'error' ? 'bolt' : item.tagColor === 'warning' ? 'pending_actions' : 'verified'}
                      </span>
                      {item.tagLabel}
                    </span>

                    <span className="font-data-mono text-sm text-primary font-bold">#{item.code}</span>
                    <span className="h-4 w-[1px] bg-surface-container"></span>
                    <span className="flex items-center gap-1 font-body-sm text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px] text-outline">schedule</span>
                      {item.timeAgo}
                    </span>

                    {item.slaCritical && isPending && (
                      <span className="px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-[11px] font-bold animate-pulse">
                        {item.slaRemaining}
                      </span>
                    )}

                    {isApproved && (
                      <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 font-label-sm text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Đã phê duyệt
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-label-sm text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        Đã từ chối
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-space-md font-body-sm text-xs text-outline pl-2">
                    <span>Người gửi: <strong className="text-on-surface font-semibold">{item.requester}</strong></span>
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md pl-2 items-center">
                  {/* Title & Logistics Spec */}
                  <div className="lg:col-span-6 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.tagColor === 'error' ? 'bg-error-container text-error' :
                        item.tagColor === 'warning' ? 'bg-orange-100 text-orange-600' :
                        'bg-surface-container-high text-primary'
                      }`}>
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      </span>
                      <h2 className="text-base lg:text-lg font-bold text-primary leading-snug">
                        {item.title}
                      </h2>
                    </div>
                    <p className="font-body-md text-xs lg:text-sm text-on-surface-variant pl-10 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 pl-10 text-xs">
                      <span className="text-outline">Khách hàng: <strong className="text-on-surface">{item.customer}</strong></span>
                      <span className="text-outline">Mã HAWB / Tuyến: <span className="font-data-mono font-medium text-secondary">{item.hawb}</span></span>
                      <span className="text-outline">Lộ trình: <span className="font-data-mono text-on-surface font-medium">{item.route}</span></span>
                    </div>
                  </div>

                  {/* Financial & Capacity Metric */}
                  <div className="lg:col-span-3 flex flex-col bg-surface-container-low p-space-md rounded-xl gap-1 border border-outline-variant/20">
                    <span className="font-label-sm text-xs text-outline uppercase tracking-wider font-semibold">
                      {item.category === 'CLAIM' ? 'Giá trị đền bù đề xuất' : 'Giá trị hợp đồng / Cước'}
                    </span>
                    <span className="text-xl lg:text-2xl text-primary font-black tracking-tight">
                      {Number(item.proposedValue || 0).toLocaleString('vi-VN')} đ
                    </span>
                    <div className="flex items-center justify-between font-label-sm text-xs text-on-surface-variant pt-1 border-t border-surface-container">
                      <span>{item.baseCost > 0 ? `Chi phí sàn: ${Number(item.baseCost).toLocaleString('vi-VN')} đ` : 'Quỹ thẩm định'}</span>
                      <span className="text-secondary font-bold">{item.margin}</span>
                    </div>
                  </div>

                  {/* Action CTAs */}
                  <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col gap-2 justify-end">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleOpenDecision(item, 'APPROVE')}
                          className="w-full py-2.5 px-space-md rounded-xl bg-primary text-on-primary font-label-lg text-sm font-bold hover:bg-primary-container shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          <span>Phê duyệt ngay</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDecision(item, 'REJECT')}
                            className="flex-1 py-2 px-space-sm rounded-xl bg-error-container text-error hover:bg-error hover:text-white font-label-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[16px]">cancel</span>
                            <span>Từ chối</span>
                          </button>
                          <button
                            onClick={() => setDetailModalItem(item)}
                            className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-lg text-xs font-semibold transition-all flex items-center justify-center cursor-pointer"
                            title="Xem hồ sơ chi tiết"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setDetailModalItem(item)}
                          className="w-full py-2.5 px-space-md rounded-xl bg-surface-container-high text-primary font-label-lg text-sm font-bold hover:bg-surface-container-highest transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                          <span>Xem nhật ký duyệt</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dispatch Policy & Governance Notice */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md border border-outline-variant/30">
        <div className="flex items-start gap-space-md">
          <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-lg text-sm text-primary font-bold">Chính sách Phân quyền &amp; Kiểm toán Phê duyệt NEXLOG OS</span>
            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
              Quản lý cấp vận hành (Manager) được cấp hạn mức duyệt tối đa <strong>500.000.000 đ/lần</strong> cho chuyến Charter và chiết khấu cước đến <strong>10%</strong>. Tất cả quyết định duyệt hoặc từ chối được mã hóa số và đồng bộ tự động tới bộ phận Kế toán &amp; Điều vận Dispatcher.
            </p>
          </div>
        </div>
        <a
          className="inline-flex items-center gap-1 text-secondary font-label-sm text-xs font-bold hover:underline shrink-0"
          href="#"
          onClick={(e) => { e.preventDefault(); showToast('Tài liệu Phân cấp Thẩm quyền v4.2 đang áp dụng trên toàn mạng lưới.'); }}
        >
          <span>Quy chế phân quyền v4.2</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </a>
      </div>

      {/* Decision Modal (Approve / Reject) */}
      {decisionModal.isOpen && decisionModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
            <div className={`p-5 flex items-center justify-between text-white ${
              decisionModal.action === 'APPROVE' ? 'bg-primary' : 'bg-red-700'
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">
                  {decisionModal.action === 'APPROVE' ? 'check_circle' : 'cancel'}
                </span>
                <h3 className="font-bold text-lg">
                  {decisionModal.action === 'APPROVE' ? 'Xác nhận Phê duyệt' : 'Xác nhận Từ chối'}
                </h3>
              </div>
              <button 
                onClick={() => setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', reason: '', note: '', submitting: false })}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="p-3.5 bg-surface-container-low rounded-xl text-xs flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-outline">Mã yêu cầu:</span>
                  <span className="font-data-mono font-bold text-primary">#{decisionModal.item.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Tiêu đề:</span>
                  <span className="font-semibold text-on-surface truncate max-w-[280px]">{decisionModal.item.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Số tiền thẩm định:</span>
                  <span className="font-bold text-secondary">{Number(decisionModal.item.proposedValue || 0).toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Căn cứ quyết định</label>
                <input
                  type="text"
                  value={decisionModal.reason}
                  onChange={e => setDecisionModal(prev => ({ ...prev, reason: e.target.value }))}
                  className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  placeholder="Lý do ngắn gọn..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Ghi chú điều vận / kế toán</label>
                <textarea
                  rows={3}
                  value={decisionModal.note}
                  onChange={e => setDecisionModal(prev => ({ ...prev, note: e.target.value }))}
                  className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                  placeholder="Ghi chú thêm gửi cho Dispatcher hoặc bộ phận liên quan..."
                />
              </div>
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', reason: '', note: '', submitting: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={decisionModal.submitting}
                onClick={handleConfirmDecision}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 cursor-pointer ${
                  decisionModal.action === 'APPROVE' ? 'bg-primary hover:bg-primary-container' : 'bg-error hover:bg-red-800'
                }`}
              >
                {decisionModal.submitting && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                <span>Xác nhận thực hiện</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
            <div className="p-5 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">description</span>
                <div>
                  <h3 className="font-bold text-base">Hồ sơ Chi tiết Yêu cầu #{detailModalItem.code}</h3>
                  <p className="text-xs text-white/70">Phân cấp thẩm định vận hành ALS Network</p>
                </div>
              </div>
              <button 
                onClick={() => setDetailModalItem(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-outline uppercase">Tiêu đề yêu cầu</span>
                <h4 className="text-base font-bold text-primary">{detailModalItem.title}</h4>
              </div>

              <div className="p-4 bg-surface-container-low rounded-xl text-xs flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-outline block">Khách hàng:</span>
                    <span className="font-bold text-on-surface">{detailModalItem.customer}</span>
                  </div>
                  <div>
                    <span className="text-outline block">Vận đơn / Chuyến:</span>
                    <span className="font-data-mono font-bold text-secondary">{detailModalItem.hawb}</span>
                  </div>
                  <div>
                    <span className="text-outline block">Hành trình:</span>
                    <span className="font-medium text-on-surface">{detailModalItem.route}</span>
                  </div>
                  <div>
                    <span className="text-outline block">Thời điểm tạo:</span>
                    <span className="font-medium text-on-surface">{detailModalItem.timeAgo}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-outline uppercase">Mô tả nghiệp vụ</span>
                <p className="text-xs text-on-surface-variant bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30 leading-relaxed">
                  {detailModalItem.description}
                </p>
              </div>

              <div className="p-4 bg-blue-50/70 border border-blue-200/50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-900 font-semibold block">Giá trị đề xuất thẩm định:</span>
                  <span className="text-xl font-black text-secondary">
                    {Number(detailModalItem.proposedValue || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-blue-900 font-semibold block">Trạng thái:</span>
                  <span className="font-bold text-xs px-2.5 py-1 rounded-full bg-white text-secondary shadow-sm">
                    {detailModalItem.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white cursor-pointer"
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
