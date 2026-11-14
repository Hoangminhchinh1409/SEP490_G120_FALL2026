"use client";
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tag,
  Input,
  Radio,
  InputNumber,
  Space,
  message,
  Spin,
  Image,
  Drawer,
  Alert,
  Tooltip
} from 'antd';
import { managerApi } from '../../../api/managerApi';

export default function MajorIncidentDetailModal({
  open,
  incident,
  onClose,
  onSuccess,
  isReadOnly = false
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  // Form decision state
  const [fault, setFault] = useState('COMPANY'); // 'COMPANY', 'CUSTOMER', 'THIRD_PARTY'
  const [resolutionNote, setResolutionNote] = useState('');
  const [damagePercentage, setDamagePercentage] = useState(30);
  const [goodsHandlingMethod, setGoodsHandlingMethod] = useState('CUSTOMER_RETAIN'); // 'CUSTOMER_RETAIN' | 'COMPANY_RECOVERY'
  const [contractClauseRef, setContractClauseRef] = useState('Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)');
  const [compensationAmount, setCompensationAmount] = useState(15000000);
  const [submitting, setSubmitting] = useState(false);

  // Sub-modals & drawers
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  // Rejection modal inputs
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionClause, setRejectionClause] = useState('Điều 4.2 - Miễn trừ trách nhiệm đối với lỗi do khâu đóng gói của chủ hàng');
  const [contactHotline, setContactHotline] = useState('1900 1234');

  // Close case (Mark as Done) inputs
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [closeNote, setCloseNote] = useState('');

  useEffect(() => {
    if (!open || !incident) {
      setDetail(null);
      return;
    }

    setFault('COMPANY');
    setResolutionNote(incident.resolution_note || '');
    setDamagePercentage(incident.damage_percentage || 30);
    setGoodsHandlingMethod(incident.goods_handling_method || 'CUSTOMER_RETAIN');
    setContractClauseRef(incident.contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)');
    setCompensationAmount(Number(incident.approved_compensation_amount || incident.proposed_compensation_amount || incident.claim_amount || 15000000));
    setPaymentProofUrl(incident.payment_proof_url || '');

    // Tải chi tiết sự cố và hồ sơ liên quan (Đơn hàng, hợp đồng, ảnh đối chiếu)
    setLoading(true);
    const incId = incident.id || incident.raw_id;
    managerApi.getIncidentById(incId)
      .then((res) => {
        const data = res || incident;
        setDetail(data);
        if (data.fault) setFault(data.fault);
        if (data.resolution_note) setResolutionNote(data.resolution_note);
        if (data.damage_percentage) setDamagePercentage(Number(data.damage_percentage));
        if (data.goods_handling_method) setGoodsHandlingMethod(data.goods_handling_method);
        if (data.contract_clause_ref) setContractClauseRef(data.contract_clause_ref);
        if (data.rejection_reason) setRejectionReason(data.rejection_reason);
        if (data.payment_proof_url) setPaymentProofUrl(data.payment_proof_url);
        if (data.approved_compensation_amount) {
          setCompensationAmount(Number(data.approved_compensation_amount));
        } else if (data.proposed_compensation_amount) {
          setCompensationAmount(Number(data.proposed_compensation_amount));
        }
      })
      .catch((err) => {
        console.warn('Lỗi lấy chi tiết sự cố:', err);
        setDetail(incident);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, incident]);

  if (!open || !incident) return null;

  const currentData = detail || incident;
  const rawStatus = (currentData.status || currentData.raw_status || '').toUpperCase();
  const isDone = rawStatus === 'DONE' || rawStatus === 'RESOLVED' || rawStatus === 'CLOSED';
  const isApproved = rawStatus === 'APPROVED';
  const isPending = !isDone && !isApproved;

  const tripCode = currentData.trip_code || (currentData.trip_id ? `TRIP-${currentData.trip_id}` : 'Chưa có');
  const orderCode = currentData.order_code || currentData.order?.order_code || 'ORD-2026-0928';
  const customerName = currentData.order?.customer?.company_name || 'Công ty TNHH VinFast';
  const agreedPrice = Number(currentData.order?.agreed_price || 5000000);
  const declaredValue = agreedPrice * 10 || 50000000;
  const contractCap = Number(currentData.contract?.liability_cap || 500000000);
  const contractPdfUrl = currentData.contract?.attachment_link || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

  // 3 Cụm ảnh đối chiếu
  const pickupPhotos = currentData.pickup_photos || [
    'https://images.unsplash.com/photo-1586528116311-ad8ed7c50a41?q=80&w=800'
  ];
  const incidentPhotos = currentData.incident_photos || currentData.photos || [
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=800'
  ];
  const deliveryPhotos = currentData.delivery_photos || [
    'https://images.unsplash.com/photo-1620023412351-96860000d6cb?q=80&w=800'
  ];

  // Logic tự động tính số tiền bồi thường gợi ý
  const calculateAutoCompensation = (pct, method) => {
    if (method === 'COMPANY_RECOVERY') {
      return Math.min(declaredValue, contractCap);
    }
    const val = Math.round((declaredValue * (pct / 100)) / 100000) * 100000;
    return Math.min(val, contractCap);
  };

  const handlePercentageChange = (val) => {
    const num = Number(val) || 0;
    setDamagePercentage(num);
    setCompensationAmount(calculateAutoCompensation(num, goodsHandlingMethod));
  };

  const handleHandlingMethodChange = (method) => {
    setGoodsHandlingMethod(method);
    setCompensationAmount(calculateAutoCompensation(damagePercentage, method));
  };

  // Hành động 1: Phê duyệt bồi thường
  const handleApproveCompensation = async () => {
    if (!fault) {
      message.warning('Vui lòng xác định bên chịu trách nhiệm lỗi!');
      return;
    }
    if (!resolutionNote.trim()) {
      message.warning('Vui lòng nhập căn cứ & nhận xét phê duyệt!');
      return;
    }

    try {
      setSubmitting(true);
      const incId = currentData.id || currentData.raw_id;
      const payload = {
        action: 'APPROVE',
        fault,
        approved_amount: Number(compensationAmount) || 0,
        damage_percentage: damagePercentage,
        goods_handling_method: goodsHandlingMethod,
        contract_clause_ref: contractClauseRef,
        resolution_note: resolutionNote.trim()
      };

      const res = await managerApi.decideIncidentCompensation(incId, payload);
      message.success(res?.message || 'Đã phê duyệt phương án bồi thường thành công!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi duyệt bồi thường:', error);
      message.error(error.message || 'Lỗi khi phê duyệt bồi thường');
    } finally {
      setSubmitting(false);
    }
  };

  // Hành động 2: Từ chối bồi thường (Đơn phương dứt điểm -> Chuyển DONE)
  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      message.warning('Vui lòng nhập lý do từ chối bồi thường chi tiết!');
      return;
    }
    if (!rejectionClause.trim()) {
      message.warning('Vui lòng viện dẫn điều khoản hợp đồng áp dụng!');
      return;
    }

    try {
      setSubmitting(true);
      const incId = currentData.id || currentData.raw_id;
      const payload = {
        action: 'REJECT',
        fault: 'CUSTOMER',
        rejection_reason: rejectionReason.trim(),
        contract_clause_ref: rejectionClause.trim(),
        contact_hotline: contactHotline.trim(),
        resolution_note: `Từ chối bồi thường theo ${rejectionClause.trim()}. Lý do: ${rejectionReason.trim()}`
      };

      const res = await managerApi.decideIncidentCompensation(incId, payload);
      message.success(res?.message || 'Đã từ chối bồi thường và hoàn tất đóng hồ sơ (DONE)!');
      setIsRejectModalOpen(false);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi từ chối bồi thường:', error);
      message.error(error.message || 'Lỗi khi từ chối bồi thường');
    } finally {
      setSubmitting(false);
    }
  };

  // Hành động 3: Đóng hồ sơ hoàn tất sau khi đã duyệt chi trả (Mark as Done)
  const handleConfirmCloseDone = async () => {
    if (!paymentProofUrl.trim()) {
      message.warning('Vui lòng nhập URL hoặc upload ảnh chứng từ/biên lai chuyển khoản ngân hàng!');
      return;
    }

    try {
      setSubmitting(true);
      const incId = currentData.id || currentData.raw_id;
      const payload = {
        payment_proof_url: paymentProofUrl.trim(),
        close_note: closeNote.trim() || 'Đã hoàn tất chi trả bồi thường cho khách hàng và lưu chứng từ thanh toán.'
      };

      const res = await managerApi.closeIncidentCase(incId, payload);
      message.success(res?.message || 'Đã hoàn tất bồi thường và đóng hồ sơ sự cố (DONE)!');
      setIsCloseModalOpen(false);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi đóng hồ sơ sự cố:', error);
      message.error(error.message || 'Lỗi khi đóng hồ sơ sự cố');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between pb-3.5 border-b border-surface-container pr-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">gavel</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-primary tracking-tight font-mono">
                    {currentData.code || `INC-${currentData.id}`}
                  </h3>
                  {isPending && (
                    <Tag color="orange" className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                      Chờ Quản lý xét duyệt
                    </Tag>
                  )}
                  {isApproved && (
                    <Tag color="cyan" className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                      Đã duyệt · Chờ chi trả
                    </Tag>
                  )}
                  {isDone && (
                    <Tag color="green" className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                      Đã hoàn tất (Đóng)
                    </Tag>
                  )}
                  {currentData.is_major && (
                    <Tag color="red" className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                      Sự cố nghiêm trọng (BR-16)
                    </Tag>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5 flex items-center gap-1.5">
                  <span>Phân loại: <strong className="text-primary">{currentData.type_display || currentData.type}</strong></span>
                  <span className="text-outline">·</span>
                  <span>Thời điểm báo cáo: <strong className="font-mono text-primary">{currentData.reported_time ? new Date(currentData.reported_time).toLocaleString('vi-VN') : '14:30 12/11/2026'}</strong></span>
                </p>
              </div>
            </div>

            {/* Nút xem trực tiếp Hợp đồng scan PDF */}
            <a
              href={contractPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer border border-surface-container-highest shadow-2xs transition-all hover:scale-102"
            >
              <span className="material-symbols-outlined text-[18px] text-red-500">picture_as_pdf</span>
              <span>Xem Hợp đồng (PDF)</span>
            </a>
          </div>
        }
        open={open}
        onCancel={onClose}
        footer={null}
        width={1000}
        centered
        className="major-incident-detail-modal"
      >
        {loading ? (
          <div className="py-20 flex justify-center"><Spin size="large" /></div>
        ) : (
          <div className="space-y-4 pt-3 text-xs leading-relaxed">
            {/* PANEL 1: CỤM LIÊN KẾT THAM CHIẾU NHANH (REFERENCE LINKS) */}
            <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Thẻ 1: Đơn hàng */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container shadow-2xs flex flex-col justify-between min-h-[76px]">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider block">Mã đơn hàng</span>
                <div className="flex items-center justify-between mt-1">
                  <strong className="font-mono text-primary text-sm font-black">{orderCode}</strong>
                  <button
                    type="button"
                    onClick={() => setIsOrderDetailOpen(true)}
                    className="text-xs text-secondary hover:text-blue-800 font-bold cursor-pointer inline-flex items-center gap-0.5 hover:underline"
                  >
                    <span>Chi tiết</span>
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </button>
                </div>
              </div>

              {/* Thẻ 2: Khách hàng */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container shadow-2xs flex flex-col justify-between min-h-[76px]">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider block">Khách hàng</span>
                <div className="mt-1">
                  <strong className="text-primary text-xs font-bold truncate block" title={customerName}>
                    {customerName}
                  </strong>
                  <span className="text-[11px] text-on-surface-variant font-mono block mt-0.5">
                    HĐ: {currentData.contract?.contract_number || 'HĐVC-2026/01'}
                  </span>
                </div>
              </div>

              {/* Thẻ 3: Chuyến xe */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container shadow-2xs flex flex-col justify-between min-h-[76px]">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider block">Chuyến xe &amp; Biển số</span>
                <div className="mt-1">
                  <strong className="font-mono text-secondary text-xs font-bold block">{tripCode}</strong>
                  <span className="text-[11px] text-primary font-mono font-semibold block mt-0.5">
                    Xe: {currentData.truck_plate || '29C-246.80'}
                  </span>
                </div>
              </div>

              {/* Thẻ 4: Tài xế */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container shadow-2xs flex flex-col justify-between min-h-[76px]">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider block">Tài xế hiện trường</span>
                <div className="mt-1">
                  <strong className="text-primary text-xs font-bold block">
                    {currentData.driver_name || 'Trần Văn Bình'}
                  </strong>
                  <span className="text-[11px] text-outline font-mono block mt-0.5">
                    SĐT: {currentData.driver_phone || '0901234567'}
                  </span>
                </div>
              </div>
            </div>

            {/* VỊ TRÍ GPS HIỆN TRƯỜNG & KIỂM TRA LỘ TRÌNH QUY ĐỊNH */}
            <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">pin_drop</span>
                </div>
                <div>
                  <div className="text-xs text-primary font-semibold flex items-center gap-1.5 flex-wrap">
                    <span>Vị trí sự cố:</span>
                    <strong className="text-primary font-bold">{currentData.incident_location || 'Km 18 Cao tốc Nội Bài - Lào Cai, Sóc Sơn, Hà Nội'}</strong>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {currentData.is_on_route !== false ? (
                      <Tag color="green" className="font-bold text-[11px] px-2 py-0.5 rounded-md border-0 shadow-2xs">
                        ✔ KHỚP LỘ TRÌNH ĐƯỢC PHÂN BỔ
                      </Tag>
                    ) : (
                      <Tag color="red" className="font-bold text-[11px] px-2 py-0.5 rounded-md border-0 shadow-2xs">
                        ⚠ CẢNH BÁO LỆCH LỘ TRÌNH ({currentData.route_deviation_km || 12.5} km)
                      </Tag>
                    )}
                    <span className="text-[11px] text-outline font-mono">
                      Tọa độ: {currentData.incident_lat || 21.2185}°N, {currentData.incident_lng || 105.8042}°E
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsLocationMapOpen(true)}
                className="h-8.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">map</span>
                <span>Xem bản đồ xác thực</span>
              </button>
            </div>

            {/* PANEL 2: CỤM BẰNG CHỨNG ĐỐI CHIẾU HÌNH ẢNH (VISUAL EVIDENCE - 3 GÓC NHÌN) */}
            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <span className="font-bold text-primary uppercase text-xs flex items-center gap-2 tracking-wide">
                  <span className="material-symbols-outlined text-secondary text-[20px]">photo_library</span>
                  Hồ sơ Đối chiếu Bằng chứng Hình ảnh (Visual Evidence)
                </span>
                <span className="text-xs text-on-surface-variant font-medium">
                  So sánh trực quan trước và sau khi xảy ra sự cố
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                {/* Khung 1: Ảnh lúc nhận hàng (Pickup) */}
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-primary text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                        1. Lúc nhận hàng (Pickup)
                      </span>
                      <span className="text-[11px] text-outline font-mono font-semibold">09:15:00</span>
                    </div>
                    <div className="h-36 rounded-xl overflow-hidden bg-black/5 relative shadow-inner">
                      <Image.PreviewGroup>
                        {pickupPhotos.map((url, i) => (
                          <Image
                            key={i}
                            src={url}
                            alt="Ảnh lúc nhận hàng"
                            className="w-full h-36 object-cover"
                          />
                        ))}
                      </Image.PreviewGroup>
                    </div>
                  </div>
                  <div className="pt-1 text-xs text-on-surface-variant font-medium min-h-[46px] leading-relaxed">
                    <p>• Tem niêm phong: <b className="text-primary font-mono font-bold">ALS-9982</b> còn nguyên.</p>
                    <p>• Kiện hàng nguyên đai nguyên kiện lúc bốc xếp.</p>
                  </div>
                </div>

                {/* Khung 2: Ảnh hiện trường sự cố (Incident) + Metadata EXIF */}
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-amber-600">report_problem</span>
                        2. Hiện trường sự cố
                      </span>
                      <span className="text-[11px] text-amber-800 font-mono font-semibold">14:25:10</span>
                    </div>
                    <div className="h-36 rounded-xl overflow-hidden bg-black/5 relative shadow-inner">
                      <Image.PreviewGroup>
                        {incidentPhotos.map((url, i) => (
                          <Image
                            key={i}
                            src={url}
                            alt="Ảnh hiện trường sự cố"
                            className="w-full h-36 object-cover"
                          />
                        ))}
                      </Image.PreviewGroup>
                    </div>
                  </div>
                  <div className="p-2 bg-white/90 rounded-lg border border-amber-200/80 text-[11px] text-amber-950 font-mono shadow-2xs">
                    <div className="flex justify-between items-center mb-0.5">
                      <span>🕒 Thời gian: <b>14:25:10</b></span>
                      <span className="text-emerald-700 font-bold">✔ Khớp GPS</span>
                    </div>
                    <div className="truncate">📍 21.2185°N, 105.8042°E (Km 18)</div>
                  </div>
                </div>

                {/* Khung 3: Ảnh giao hàng / kiểm đếm thiệt hại (Delivery / Damage) */}
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-primary text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-red-600">inventory_2</span>
                        3. Bàn giao &amp; Thiệt hại
                      </span>
                      <span className="text-[11px] text-outline font-mono font-semibold">16:40:00</span>
                    </div>
                    <div className="h-36 rounded-xl overflow-hidden bg-black/5 relative shadow-inner">
                      <Image.PreviewGroup>
                        {deliveryPhotos.map((url, i) => (
                          <Image
                            key={i}
                            src={url}
                            alt="Ảnh biên bản thiệt hại"
                            className="w-full h-36 object-cover"
                          />
                        ))}
                      </Image.PreviewGroup>
                    </div>
                  </div>
                  <div className="pt-1 text-xs text-on-surface-variant font-medium min-h-[46px] leading-relaxed">
                    <p>• Biên bản ghi nhận móp vỡ vỏ thùng carton.</p>
                    <p>• Thiệt hại kiểm đếm thực tế: <b className="text-error font-bold font-mono">{damagePercentage}%</b> kiện hàng.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* PANEL 3: ĐÁNH GIÁ THIỆT HẠI & PHƯƠNG ÁN HÀNG HỎNG */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <span className="font-bold text-primary uppercase text-xs flex items-center gap-2 tracking-wide">
                  <span className="material-symbols-outlined text-secondary text-[20px]">rule</span>
                  Đánh giá Mức độ Thiệt hại &amp; Phương án Hàng hỏng
                </span>
                <span className="text-xs text-on-surface-variant font-medium">
                  Giá trị khai báo: <b className="text-primary font-mono font-bold text-sm">{declaredValue.toLocaleString('vi-VN')} đ</b>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Trách nhiệm lỗi */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Trách nhiệm lỗi thuộc về * :
                  </label>
                  <Radio.Group
                    value={fault}
                    onChange={(e) => setFault(e.target.value)}
                    disabled={isDone || isReadOnly}
                    className="w-full flex flex-col gap-2 pt-1"
                  >
                    <Radio value="COMPANY" className="text-xs font-semibold text-primary">
                      Công ty / Đội xe (ALS)
                    </Radio>
                    <Radio value="CUSTOMER" className="text-xs font-semibold text-primary">
                      Khách hàng
                    </Radio>
                    <Radio value="THIRD_PARTY" className="text-xs font-semibold text-primary">
                      Bên thứ ba / Khách quan
                    </Radio>
                  </Radio.Group>
                </div>

                {/* Tỷ lệ hư hỏng % */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Tỷ lệ hư hỏng đánh giá (%):
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <Space.Compact>
                      <InputNumber
                        min={0}
                        max={100}
                        value={damagePercentage}
                        onChange={handlePercentageChange}
                        disabled={isDone || isReadOnly || goodsHandlingMethod === 'COMPANY_RECOVERY'}
                        className="w-20 font-mono font-bold text-center h-9 text-xs"
                      />
                      <span className="inline-flex items-center px-2.5 bg-surface-container border border-l-0 border-outline-variant/40 text-on-surface-variant font-bold text-xs rounded-r-lg select-none">
                        %
                      </span>
                    </Space.Compact>
                    <div className="flex gap-1.5">
                      {[10, 30, 50, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={isDone || isReadOnly || goodsHandlingMethod === 'COMPANY_RECOVERY'}
                          onClick={() => handlePercentageChange(p)}
                          className={`h-9 px-2.5 rounded-lg text-xs font-bold cursor-pointer border transition-all ${damagePercentage === p ? 'bg-secondary text-white border-secondary shadow-xs' : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container'}`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-mono block pt-1">
                    ĐPV sơ bộ đề xuất: <b className="text-primary">{currentData.damage_percentage || 30}%</b>
                  </span>
                </div>

                {/* Phương án xử lý hàng hỏng */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Phương án xử lý hàng hỏng * :
                  </label>
                  <Radio.Group
                    value={goodsHandlingMethod}
                    onChange={(e) => handleHandlingMethodChange(e.target.value)}
                    disabled={isDone || isReadOnly}
                    className="w-full flex flex-col gap-2 pt-1"
                  >
                    <Radio value="CUSTOMER_RETAIN" className="text-xs font-medium text-primary">
                      Khách giữ hàng (Đền bù % thiệt hại)
                    </Radio>
                    <Radio value="COMPANY_RECOVERY" className="text-xs font-medium text-primary">
                      Thu hồi về thanh lý (Đền bù 100%)
                    </Radio>
                  </Radio.Group>
                </div>
              </div>
            </div>

            {/* PANEL 4: CĂN CỨ HỢP ĐỒNG & BUSINESS RULE ĐỀN BÙ */}
            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <span className="font-bold text-primary uppercase text-xs flex items-center gap-2 tracking-wide">
                  <span className="material-symbols-outlined text-secondary text-[20px]">calculate</span>
                  Căn cứ Hợp đồng &amp; Tính toán Bồi thường (Business Rule)
                </span>
                <Tag color="blue" className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-md border-0">
                  Hạn mức tối đa (Cap): {contractCap.toLocaleString('vi-VN')} đ
                </Tag>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cột trái: Điều khoản hợp đồng */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Điều khoản Hợp đồng viện dẫn * :
                  </label>
                  <Input
                    value={contractClauseRef}
                    onChange={(e) => setContractClauseRef(e.target.value)}
                    disabled={isDone || isReadOnly}
                    placeholder="VD: Điều 8.2 - Bồi thường thiệt hại hàng hóa vượt tỷ lệ hao hụt"
                    className="h-10 rounded-xl text-xs font-medium"
                  />
                  <p className="text-[11px] text-on-surface-variant italic pt-0.5 leading-normal">
                    Trích lục: &ldquo;{currentData.contract?.compensation_terms || 'Bồi thường theo tỷ lệ hư hỏng thực tế của giá trị khai báo, tối đa không vượt quá hạn mức trách nhiệm.'}&rdquo;
                  </p>
                </div>

                {/* Cột phải: Số tiền bồi thường chốt duyệt */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Số tiền bồi thường Manager chốt duyệt (VNĐ) * :
                  </label>
                  <div className="flex items-center gap-2">
                    <Space.Compact className="w-full">
                      <InputNumber
                        min={0}
                        step={500000}
                        value={compensationAmount}
                        onChange={(val) => setCompensationAmount(val || 0)}
                        disabled={isDone || isReadOnly}
                        formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        parser={(val) => val.replace(/\./g, '')}
                        className="w-full font-mono font-black text-sm text-error h-10 text-right"
                      />
                      <span className="inline-flex items-center px-3.5 bg-surface-container border border-l-0 border-outline-variant/40 text-on-surface-variant font-bold text-xs rounded-r-lg select-none font-mono">
                        đ
                      </span>
                    </Space.Compact>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-outline pt-0.5 font-mono">
                    <span>ĐPV đề xuất: <b className="text-primary font-bold">{(currentData.proposed_compensation_amount || 15000000).toLocaleString('vi-VN')} đ</b></span>
                    {compensationAmount > contractCap && (
                      <span className="text-error font-bold">⚠ VƯỢT HẠN MỨC TRÁCH NHIỆM HĐ</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Nhận xét / Kết luận của Quản lý */}
              <div className="space-y-1.5 pt-1">
                <label className="block font-bold text-primary text-xs">
                  Kết luận &amp; Căn cứ giải quyết * (Tối đa 500 ký tự):
                </label>
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  disabled={isDone || isReadOnly}
                  placeholder="Ghi nhận căn cứ ra quyết định (Ví dụ: Thẩm định 3 cụm ảnh thấy thùng hàng vỡ trong quá trình di chuyển của xe ALS, lỗi thuộc công ty, đền bù 30% giá trị lô hàng theo Điều 8.2 Hợp đồng)..."
                  className="rounded-xl text-xs p-3 leading-relaxed"
                />
              </div>
            </div>

            {/* PANEL 5: CỤM HÀNH ĐỘNG PHÊ DUYỆT / TỪ CHỐI / ĐÓNG LUỒNG */}
            {isPending && (
              isReadOnly ? (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">info</span>
                    <span>Chế độ Xem thông tin (Read-only)</span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Sự cố này đang ở trạng thái <b>Chờ Quản lý xử lý</b>. Tài khoản được cấp quyền chỉ xem có quyền theo dõi chi tiết hiện trường và lịch sử sự cố, không có thẩm quyền ban hành quyết định bồi thường.
                  </p>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold cursor-pointer hover:bg-blue-700 transition-colors text-xs"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container gap-3 shadow-2xs">
                  <span className="text-xs text-on-surface-variant font-medium text-center sm:text-left">
                    Vui lòng kiểm tra kỹ 3 cụm ảnh đối chiếu và hạn mức hợp đồng trước khi xác nhận.
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsRejectModalOpen(true)}
                      disabled={submitting}
                      className="h-10 px-5 rounded-xl bg-error hover:bg-red-700 text-white font-bold cursor-pointer transition-all shadow-xs inline-flex items-center gap-2 text-xs hover:scale-102"
                    >
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      <span>Từ chối bồi thường</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApproveCompensation}
                      disabled={submitting}
                      className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition-all shadow-xs inline-flex items-center gap-2 text-xs hover:scale-102"
                    >
                      <span className="material-symbols-outlined text-[18px]">task_alt</span>
                      <span>{submitting ? 'Đang duyệt...' : 'Phê duyệt bồi thường'}</span>
                    </button>
                  </div>
                </div>
              )
            )}

            {/* KHI ĐANG Ở TRẠNG THÁI APPROVED: CHỜ HOÀN TẤT THANH TOÁN (MARK AS DONE) */}
            {isApproved && (
              <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/30 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px]">pending_actions</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-cyan-950 text-xs">
                        Hồ sơ đã Phê duyệt: Bồi thường <span className="font-mono text-sm text-error font-black">{compensationAmount.toLocaleString('vi-VN')} đ</span> (Chờ chi trả)
                      </h4>
                      <p className="text-[11px] text-cyan-800 mt-0.5">
                        Sau khi thực tế đã chuyển khoản hoặc thống nhất biên bản với khách hàng, hãy đính kèm biên lai để đóng hồ sơ.
                      </p>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setIsCloseModalOpen(true)}
                      className="h-10 px-5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold cursor-pointer transition-all shadow-xs inline-flex items-center gap-2 text-xs shrink-0 hover:scale-102"
                    >
                      <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                      <span>Xác nhận Hoàn tất &amp; Đóng hồ sơ (Mark as Done)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* KHI ĐÃ ĐÓNG (DONE): READ-ONLY SUMMARY */}
            {isDone && (
              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <span className="font-bold text-primary uppercase text-xs flex items-center gap-2 tracking-wide">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified</span>
                    Hồ sơ sự cố đã được đóng hoàn tất (DONE)
                  </span>
                  <span className="text-[11px] text-outline font-mono font-medium">
                    Đóng lúc: {currentData.closed_at ? new Date(currentData.closed_at).toLocaleString('vi-VN') : '16:00 12/11/2026'}
                  </span>
                </div>

                {currentData.rejection_reason ? (
                  <Alert
                    type="error"
                    showIcon
                    title={<b className="text-xs">ĐÃ TỪ CHỐI BỒI THƯỜNG</b>}
                    description={
                      <div className="text-xs mt-1.5 space-y-1 leading-relaxed">
                        <p>• Điều khoản viện dẫn: <b>{currentData.contract_clause_ref}</b></p>
                        <p>• Lý do từ chối: {currentData.rejection_reason}</p>
                        <p>• Hotline hỗ trợ khiếu nại: <b className="font-mono text-primary font-bold">{currentData.contact_hotline || '1900 1234'}</b></p>
                      </div>
                    }
                    className="rounded-xl p-3.5 border border-red-200"
                  />
                ) : (
                  <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-surface-container flex items-center justify-between">
                    <div>
                      <span className="text-xs text-on-surface-variant block font-medium">Số tiền đã bồi thường hoàn tất:</span>
                      <strong className="text-error font-mono text-base font-black mt-0.5 block">
                        {(currentData.approved_compensation_amount || compensationAmount).toLocaleString('vi-VN')} đ
                      </strong>
                    </div>
                    {currentData.payment_proof_url && (
                      <a
                        href={currentData.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary text-xs font-bold inline-flex items-center gap-1.5 border border-surface-container transition-all hover:scale-102"
                      >
                        <span className="material-symbols-outlined text-[16px]">receipt</span>
                        <span>Xem biên lai chuyển khoản</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* DRAWER XEM NHANH CHI TIẾT ĐƠN HÀNG */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">package_2</span>
            <span className="font-bold text-sm text-primary">Chi tiết Đơn hàng: {orderCode}</span>
          </div>
        }
        placement="right"
        size="default"
        onClose={() => setIsOrderDetailOpen(false)}
        open={isOrderDetailOpen}
      >
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-2.5">
            <h4 className="font-bold text-primary uppercase text-xs tracking-wider">Thông tin chung</h4>
            <div className="flex justify-between items-center py-0.5 border-b border-surface-container/60">
              <span className="text-on-surface-variant">Khách hàng:</span>
              <strong className="text-primary text-right">{customerName}</strong>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-surface-container/60">
              <span className="text-on-surface-variant">Giá trị cước thỏa thuận:</span>
              <strong className="text-primary font-mono">{agreedPrice.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-on-surface-variant">Giá trị khai báo hàng hóa:</span>
              <strong className="text-error font-mono font-bold">{declaredValue.toLocaleString('vi-VN')} đ</strong>
            </div>
          </div>

          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-2">
            <h4 className="font-bold text-primary uppercase text-xs tracking-wider">Danh mục Hàng hóa</h4>
            <div className="space-y-1 text-primary">
              <p>• Tên hàng: <b>Linh kiện phụ tùng ô tô cao cấp</b></p>
              <p>• Số lượng: <b>120 kiện (Thùng carton gia cố)</b></p>
              <p>• Tổng khối lượng: <b className="font-mono">4.500 kg</b></p>
              <p>• Thể tích: <b className="font-mono">18.5 cbm</b></p>
            </div>
          </div>

          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-2">
            <h4 className="font-bold text-primary uppercase text-xs tracking-wider">Lộ trình Giao nhận</h4>
            <div className="space-y-1.5 text-on-surface">
              <p>• <b>Nơi lấy hàng:</b> Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội</p>
              <p>• <b>Nơi giao hàng:</b> Nhà máy VinFast, KCN Đình Vũ, Cát Hải, Hải Phòng</p>
            </div>
          </div>
        </div>
      </Drawer>

      {/* MODAL POPUP BẢN ĐỒ TĨNH ĐỊNH VỊ HIỆN TRƯỜNG */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">location_searching</span>
            <span className="font-bold text-sm text-primary">Xác thực Tọa độ Sự cố Hiện trường</span>
          </div>
        }
        open={isLocationMapOpen}
        onCancel={() => setIsLocationMapOpen(false)}
        footer={null}
        width={680}
        centered
      >
        <div className="space-y-3.5 pt-2 text-xs">
          <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container flex items-center justify-between">
            <div>
              <span className="text-[11px] text-on-surface-variant block">Địa chỉ GPS ghi nhận:</span>
              <strong className="text-primary font-bold text-xs">{currentData.incident_location || 'Km 18 Cao tốc Nội Bài - Lào Cai'}</strong>
            </div>
            <Tag color={currentData.is_on_route !== false ? 'green' : 'red'} className="font-bold text-xs px-2.5 py-0.5 rounded-full border-0">
              {currentData.is_on_route !== false ? '✔ KHỚP LỘ TRÌNH' : '⚠ LỆCH LỘ TRÌNH'}
            </Tag>
          </div>

          {/* Khung bản đồ mô phỏng tọa độ điểm và tuyến đường */}
          <div className="w-full h-80 rounded-2xl overflow-hidden border border-surface-container relative bg-slate-100 flex items-center justify-center shadow-inner">
            <img
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800"
              alt="Bản đồ định vị"
              className="w-full h-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-blue-950/25 backdrop-blur-2xs flex flex-col items-center justify-center p-4 text-center">
              <div className="p-4 bg-white/95 rounded-2xl shadow-xl border border-surface-container max-w-sm">
                <div className="flex items-center justify-center gap-1.5 text-error font-bold text-xs mb-1.5">
                  <span className="material-symbols-outlined text-[20px]">emergency</span>
                  <span>ĐIỂM XẢY RA SỰ CỐ TAI NẠN</span>
                </div>
                <p className="text-xs text-primary font-mono font-bold">
                  Tọa độ: 21.2185° N, 105.8042° E
                </p>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-normal">
                  Khoảng cách lệch tâm tuyến đường: <b className="text-primary font-bold">0.25 km</b> (Nằm trong dung sai an toàn &lt; 1km).
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL NHẬP LÝ DO TỪ CHỐI BỒI THƯỜNG (REJECT MODAL) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-error">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
            <span className="font-bold text-sm">Xác nhận Từ chối Bồi thường (Close Case)</span>
          </div>
        }
        open={isRejectModalOpen}
        onCancel={() => setIsRejectModalOpen(false)}
        onOk={handleConfirmReject}
        confirmLoading={submitting}
        okText="Xác nhận Từ chối & Đóng hồ sơ"
        okButtonProps={{ danger: true, className: "font-bold text-xs h-10 px-5 rounded-xl shadow-xs" }}
        cancelButtonProps={{ className: "text-xs h-10 px-4 rounded-xl" }}
        width={580}
        centered
      >
        <div className="space-y-4 pt-2 text-xs">
          <Alert
            type="warning"
            showIcon
            title={<b className="text-xs">Lưu ý quyết định đơn phương</b>}
            description="Quyết định từ chối bồi thường dựa trên căn cứ Hợp đồng sẽ tự động gửi email thông báo cho Khách hàng và chuyển ngay trạng thái sự cố sang ĐÃ ĐÓNG (DONE)."
            className="rounded-xl p-3 border border-amber-200"
          />

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Điều khoản Hợp đồng miễn trừ trách nhiệm * :
            </label>
            <Input
              value={rejectionClause}
              onChange={(e) => setRejectionClause(e.target.value)}
              placeholder="VD: Điều 4.2 - Miễn trừ trách nhiệm đối với lỗi do khâu đóng gói của chủ hàng"
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Lý do từ chối chi tiết gửi khách hàng * :
            </label>
            <Input.TextArea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Nhập lý do chi tiết (Ví dụ: Thẩm định ảnh lúc nhận hàng Pickup cho thấy thùng hàng đã bị rách vỡ từ trước khi bốc lên xe ALS, vi phạm quy cách bàn giao quy định tại Điều 4.2 Hợp đồng)..."
              className="rounded-xl text-xs p-3 leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Hotline giải quyết khiếu nại (Đính kèm trong thông báo) * :
            </label>
            <Input
              value={contactHotline}
              onChange={(e) => setContactHotline(e.target.value)}
              className="h-10 rounded-xl text-xs font-mono font-bold"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL UPLOAD BIÊN LAI THANH TOÁN ĐỂ ĐÓNG LUỒNG (CLOSE CASE MODAL) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-cyan-800">
            <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            <span className="font-bold text-sm">Xác nhận Hoàn tất Chi trả &amp; Đóng sự cố (DONE)</span>
          </div>
        }
        open={isCloseModalOpen}
        onCancel={() => setIsCloseModalOpen(false)}
        onOk={handleConfirmCloseDone}
        confirmLoading={submitting}
        okText="Xác nhận Đóng hồ sơ (Mark as Done)"
        okButtonProps={{ className: "bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-xs" }}
        cancelButtonProps={{ className: "text-xs h-10 px-4 rounded-xl" }}
        width={580}
        centered
      >
        <div className="space-y-4 pt-2 text-xs leading-relaxed">
          <p className="text-on-surface">
            Để đóng hồ sơ bồi thường số tiền <b className="text-error font-mono text-sm font-bold">{compensationAmount.toLocaleString('vi-VN')} đ</b>, vui lòng đính kèm ảnh chụp Ủy nhiệm chi hoặc Biên lai chuyển khoản ngân hàng đã thực hiện:
          </p>

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              URL / Link ảnh Biên lai chuyển khoản ngân hàng * :
            </label>
            <Input
              value={paymentProofUrl}
              onChange={(e) => setPaymentProofUrl(e.target.value)}
              placeholder="https://example.com/payment-proofs/unc-9982.jpg"
              className="h-10 rounded-xl text-xs font-mono"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPaymentProofUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800')}
                className="text-xs text-secondary hover:underline cursor-pointer font-medium"
              >
                [Điền mẫu Ủy nhiệm chi Vietcombank]
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Ghi chú hoàn tất:
            </label>
            <Input.TextArea
              rows={2}
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="Đã chuyển khoản bồi thường thành công theo số tài khoản hợp đồng."
              className="rounded-xl text-xs p-3 leading-relaxed"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
