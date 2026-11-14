"use client";
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tag,
  Input,
  Select,
  Radio,
  InputNumber,
  Space,
  message,
  Spin,
  Image,
  Alert,
  Tooltip
} from 'antd';
import { managerApi } from '../../../api/managerApi';
import TripReplayModal from '../../../components/common/TripReplayModal';

export default function MajorIncidentDetailModal({
  open,
  incident,
  onClose,
  onSuccess,
  isReadOnly = false
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  // Form decision state (Mục 10, 12, 13, 14)
  const [fault, setFault] = useState('COMPANY'); // 'COMPANY' | 'CUSTOMER' | 'THIRD_PARTY'
  const [resolutionNote, setResolutionNote] = useState('');
  const [damagePercentage, setDamagePercentage] = useState(30);
  const [goodsHandlingMethod, setGoodsHandlingMethod] = useState('CUSTOMER_RETAIN'); // 'CUSTOMER_RETAIN' | 'COMPANY_RECOVERY'
  const [surveyOrgReport, setSurveyOrgReport] = useState('Giám định ABC - BB-2026-118');
  const [contractClauseRef, setContractClauseRef] = useState('Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)');
  const [compensationAmount, setCompensationAmount] = useState(36000000);
  const [submitting, setSubmitting] = useState(false);

  // Khung 18 & 19: Chi tiền cho khách (Thanh toán sau khi duyệt)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionCode, setTransactionCode] = useState('FT26114123456');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Sub-modals
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRequestInfoModalOpen, setIsRequestInfoModalOpen] = useState(false);
  const [isContractViewerOpen, setIsContractViewerOpen] = useState(false);
  const [contractViewerTab, setContractViewerTab] = useState('FRAMEWORK'); // 'FRAMEWORK' | 'ORDER_TRIP'

  // Rejection modal inputs (Mục 15)
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionClause, setRejectionClause] = useState('Điều 4.2 - Miễn trừ trách nhiệm đối với lỗi do khâu đóng gói của chủ hàng');
  const [contactHotline, setContactHotline] = useState('1900 1234');

  // Request More Info modal inputs (Mục 16)
  const [requestInfoNote, setRequestInfoNote] = useState('');

  useEffect(() => {
    if (!open || !incident) {
      setDetail(null);
      return;
    }

    setFault(incident.fault || 'COMPANY');
    setResolutionNote(incident.resolution_note || '');
    setDamagePercentage(Number(incident.damage_percentage || 30));
    setGoodsHandlingMethod(incident.goods_handling_method || 'CUSTOMER_RETAIN');
    setContractClauseRef(incident.contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)');
    setSurveyOrgReport(incident.survey_org_report || 'Giám định ABC - BB-2026-118');
    setPaymentProofUrl(incident.payment_proof_url || '');
    setCompensationAmount(Number(incident.approved_compensation_amount || incident.proposed_compensation_amount || incident.claim_amount || 36000000));

    // Tải chi tiết sự cố và hồ sơ liên quan
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
        if (data.survey_org_report) setSurveyOrgReport(data.survey_org_report);
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

  // Hồ sơ đã đóng bồi thường: Quản lý đã từ chối HOẶC đã chi tiền hoàn tất
  const isRejected = Boolean(currentData.rejection_reason) || rawStatus === 'REJECTED';
  const isPaymentClosed = rawStatus === 'DONE' || rawStatus === 'CLOSED' || Boolean(currentData.closed_at) || Boolean(currentData.payment_proof_url);
  const isDone = isRejected || isPaymentClosed;

  // Hồ sơ đã phê duyệt bồi thường (chờ chi tiền)
  const isApproved = !isDone && (rawStatus === 'APPROVED' || (Number(currentData.approved_compensation_amount) > 0 && !isDone));

  // Hồ sơ đang chờ Quản lý thẩm định và xét duyệt
  const isPending = !isDone && !isApproved;

  const claimCode = currentData.claim_code || currentData.compensation_claim?.claim_code || `CLM-${String(currentData.id || 1).padStart(4, '0')}`;
  const orderCode = currentData.order_code || currentData.order?.order_code || 'NEX-208337';
  const orderType = currentData.order?.order_type || currentData.order_type || 'Xuất khẩu';
  const orderStatus = currentData.order?.status || 'Đã giao';
  const customerName = currentData.order?.customer?.company_name || currentData.customer_name || 'BV Đa khoa Thái Nguyên';
  const contactPerson = currentData.order?.contact_person || 'Nguyễn Thị Lan';
  const contactPhone = currentData.order?.contact_phone || '0912 345 678';
  const routeDisplay = currentData.order?.route_display || 'Kho ALS Nội Bài → BV Đa khoa TN';
  const cargoDescription = currentData.order?.cargo_description || 'Thiết bị y tế - 12 kiện - 480 kg';
  const declaredValue = Number(currentData.order?.declared_value || currentData.declared_value || 120000000);
  const agreedPrice = Number(currentData.order?.agreed_price || currentData.agreed_price || 5000000);
  const tripCode = currentData.trip_code || (currentData.trip_id ? `TR${currentData.trip_id}` : 'TR261107-003');
  const truckPlate = currentData.truck_plate || '29H-456.78';
  const driverName = currentData.driver_name || 'Trần Văn Khang';
  const driverPhone = currentData.driver_phone || '0987 654 321';
  const contractNumber = currentData.contract?.contract_number || 'HĐ vận chuyển ký ngày 02/11/2026';
  const contractPdfUrl = currentData.contract?.attachment_link || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  const contractCap = Number(currentData.contract?.liability_cap || 200000000);

  // Nhận diện đơn hàng có Hợp đồng khung đối tác dài hạn hay là khách vãng lai
  const hasFrameworkContract = Boolean(
    currentData.order?.contract_id ||
    currentData.contract?.id ||
    (currentData.contract?.contract_number && !currentData.contract.contract_number.includes(orderCode) && !currentData.contract.contract_number.includes('VÃNG-LAI'))
  );
  const effectiveLiabilityCap = hasFrameworkContract ? contractCap : 500000000;

  // Số tiền yêu cầu bồi thường (Mục 3)
  const requestedClaimAmount = Number(currentData.claim_amount || currentData.proposed_compensation_amount || 35000000);

  // Thông tin sự cố phát sinh (Mục 5 & 6)
  const incidentCode = currentData.code || `INC-${currentData.id || 12}`;
  const incidentTitle = currentData.type_display || currentData.type || 'Hàng hóa hư hỏng (Cargo Damaged)';
  const incidentSource = currentData.source_display || 'Tài xế báo cáo';
  const incidentTime = currentData.reported_time ? new Date(currentData.reported_time).toLocaleString('vi-VN') : '07:52 07/11/2026';
  const incidentLocation = currentData.incident_location || 'QL18, Sóc Sơn (21.2113, 105.8340)';
  const incidentDescription = currentData.description || 'Xe phanh gấp tránh va chạm, 2 kiện hàng đổ vỡ, niêm phong chì vẫn nguyên vẹn.';
  const tripEventsTimeline = currentData.trip_events_timeline || '07:31 Lấy hàng, seal SL-894201 · 07:45 Rời kho · 07:52 Báo sự cố · 08:10 Tiếp tục hành trình · 09:20 Giao hàng';

  // 4 Khung hình ảnh minh chứng (Mục 9)
  const pickupPhoto = currentData.pickup_photos?.[0] || 'https://images.unsplash.com/photo-1586528116311-ad8ed7c50a41?q=80&w=800';
  const sealPhoto = currentData.seal_photos?.[0] || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800';
  const podPhoto = currentData.delivery_photos?.[0] || 'https://images.unsplash.com/photo-1620023412351-96860000d6cb?q=80&w=800';
  const incidentPhoto = currentData.incident_photos?.[0] || currentData.photos?.[0] || 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=800';

  // Tính toán bồi thường theo hợp đồng (Mục 11 & Mục 13)
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

  // Nút 17: Phê duyệt bồi thường
  const handleApproveCompensation = async () => {
    if (!fault) {
      message.warning('Vui lòng xác định bên chịu trách nhiệm lỗi!');
      return;
    }
    if (!resolutionNote.trim()) {
      message.warning('Vui lòng nhập nhận xét & căn cứ giải quyết!');
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
        survey_org_report: surveyOrgReport,
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

  // Nút 16: Yêu cầu bổ sung hồ sơ
  const handleConfirmRequestMoreInfo = async () => {
    if (!requestInfoNote.trim()) {
      message.warning('Vui lòng ghi rõ nội dung hoặc giấy tờ cần bổ sung!');
      return;
    }

    try {
      setSubmitting(true);
      const incId = currentData.id || currentData.raw_id;
      const payload = {
        action: 'REQUEST_MORE_INFO',
        resolution_note: `Yêu cầu bổ sung hồ sơ: ${requestInfoNote.trim()}`
      };

      const res = await managerApi.decideIncidentCompensation(incId, payload);
      message.success(res?.message || 'Đã gửi yêu cầu bổ sung hồ sơ tới các bên liên quan!');
      setIsRequestInfoModalOpen(false);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi gửi yêu cầu bổ sung hồ sơ:', error);
      message.error(error.message || 'Lỗi khi yêu cầu bổ sung hồ sơ');
    } finally {
      setSubmitting(false);
    }
  };

  // Nút 15: Từ chối bồi thường
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

  // Nút 19: Ghi nhận đã chi tiền cho khách
  const handleRecordPayment = async () => {
    if (!transactionCode.trim()) {
      message.warning('Vui lòng nhập Mã giao dịch ngân hàng!');
      return;
    }
    if (!paymentProofUrl.trim()) {
      message.warning('Vui lòng nhập link ảnh hoặc tải biên lai chuyển khoản!');
      return;
    }

    try {
      setRecordingPayment(true);
      const incId = currentData.id || currentData.raw_id;
      const payload = {
        payment_proof_url: paymentProofUrl.trim(),
        close_note: `Đã hoàn tất chi tiền ngày ${paymentDate}. Mã GD: ${transactionCode.trim()}`
      };

      const res = await managerApi.closeIncidentCase(incId, payload);
      message.success(res?.message || 'Đã ghi nhận chi tiền thành công và đóng hồ sơ (DONE)!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi ghi nhận chi tiền:', error);
      message.error(error.message || 'Lỗi khi ghi nhận chi tiền bồi thường');
    } finally {
      setRecordingPayment(false);
    }
  };

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between pb-3.5 border-b border-surface-container pr-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[24px]">gavel</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-primary tracking-tight font-mono">
                    Xét duyệt Bồi thường: {claimCode} – Đơn {orderCode}
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
                    <Tag color={isRejected ? "red" : "green"} className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                      {isRejected ? "Đã từ chối bồi thường (Đóng)" : "Đã hoàn tất (Đóng)"}
                    </Tag>
                  )}
                  {currentData.is_major && (
                    <Tag color="red" className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                      Sự cố nghiêm trọng (BR-16)
                    </Tag>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Quy trình thẩm định và ban hành quyết định bồi thường theo Hợp đồng ALS
                </p>
              </div>
            </div>
          </div>
        }
        open={open}
        onCancel={onClose}
        footer={null}
        width={980}
        centered
        className="major-incident-detail-modal"
      >
        {loading ? (
          <div className="py-20 flex justify-center"><Spin size="large" /></div>
        ) : (
          <div className="space-y-4 pt-3 text-xs leading-relaxed text-on-surface">

            {/* MỤC 1 & 2: THÔNG TIN ĐƠN HÀNG & CHUYẾN XE */}
            <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3 shadow-2xs">
              <div className="pb-1 border-b border-surface-container/60">
                <span className="font-bold text-primary uppercase text-xs tracking-wider">
                  Thông tin đơn hàng &amp; chuyến xe
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {/* Cột trái */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Đơn hàng:</span>
                    <strong className="font-mono text-primary font-bold">{orderCode} ({orderType})</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Trạng thái đơn:</span>
                    <strong className="text-error font-bold">{orderStatus}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Khách hàng:</span>
                    <strong className="text-error font-bold text-right">{customerName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Người liên hệ:</span>
                    <strong className="text-error font-semibold">{contactPerson} - {contactPhone}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Tuyến:</span>
                    <strong className="text-error font-semibold text-right">{routeDisplay}</strong>
                  </div>
                </div>

                {/* Cột phải */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Hàng hóa:</span>
                    <strong className="text-error font-semibold">{cargoDescription}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Giá trị khai báo:</span>
                    <strong className="text-error font-mono font-bold text-sm">{declaredValue.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Chuyến xe:</span>
                    <strong className="font-mono text-primary font-bold">{tripCode}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Xe vận chuyển:</span>
                    <strong className="font-mono text-primary font-bold">{truckPlate}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Tài xế:</span>
                    <strong className="text-primary font-bold">{driverName} ({driverPhone})</strong>
                  </div>
                </div>
              </div>

              {/* Hàng chân Mục 1 & 2: Hợp đồng áp dụng & Nút Xem PDF */}
              <div className="pt-2 border-t border-surface-container/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-error font-semibold text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">contract</span>
                  <span>Hợp đồng áp dụng: {contractNumber}</span>
                </span>

                <button
                  type="button"
                  onClick={() => setIsContractViewerOpen(true)}
                  className="h-8.5 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer border border-surface-container-highest transition-all shadow-2xs hover:scale-102 shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px] text-red-500">picture_as_pdf</span>
                  <span>Xem hợp đồng (PDF)</span>
                </button>
              </div>
            </div>

            {/* MỤC 3 & 4: YÊU CẦU BỒI THƯỜNG */}
            <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[11px] font-semibold text-outline uppercase tracking-wider block">
                    Số tiền yêu cầu bồi thường
                  </span>
                  <div className="font-mono font-black text-2xl text-error mt-0.5">
                    {requestedClaimAmount.toLocaleString('vi-VN')} đ
                  </div>
                </div>

                <div className="border-l border-surface-container pl-6 space-y-0.5">
                  <div className="text-xs text-on-surface-variant font-medium">
                    Mã yêu cầu: <b className="font-mono text-primary">{claimCode}</b>
                  </div>
                  <div className="text-xs text-on-surface-variant font-medium">
                    Nguồn gửi: <b className="text-primary">{incidentSource}</b>
                  </div>
                </div>
              </div>

              {/* Nút 4: Tua lại hành trình GPS */}
              <button
                type="button"
                onClick={() => setIsLocationMapOpen(true)}
                className="h-9 px-4 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-secondary text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs border border-surface-container shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                <span>Tua lại hành trình GPS</span>
              </button>
            </div>

            {/* MỤC 5, 6, 7, 8, 9: THÔNG TIN SỰ CỐ PHÁT SINH */}
            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3 shadow-2xs">
              <div className="pb-1 border-b border-surface-container/60">
                <span className="font-bold text-primary uppercase text-xs tracking-wider">
                  Thông tin sự cố phát sinh
                </span>
              </div>

              {/* Mục 6: Header Sự cố */}
              <div className="space-y-1">
                <h4 className="font-bold text-primary text-xs flex items-center gap-2">
                  <span className="font-mono font-black text-error">{incidentCode}</span>
                  <span>-</span>
                  <span>{incidentTitle}</span>
                </h4>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-on-surface-variant">
                  <span>Nguồn gốc: <strong className="text-primary font-semibold">{incidentSource}</strong></span>
                  <span>Thời điểm báo: <strong className="text-error font-mono font-semibold">{incidentTime}</strong></span>
                  <span className="inline-flex items-center gap-1">
                    <span>Vị trí:</span>
                    <strong className="text-error font-mono font-semibold">{incidentLocation}</strong>
                    <button
                      type="button"
                      onClick={() => setIsLocationMapOpen(true)}
                      className="ml-1 text-secondary hover:underline font-bold text-[11px] inline-flex items-center gap-0.5 cursor-pointer"
                      title="Mở bản đồ VietMap xem vị trí sự cố"
                    >
                      <span className="material-symbols-outlined text-[14px]">map</span>
                      <span>Xem VietMap</span>
                    </button>
                  </span>
                </div>
              </div>

              {/* Mục 7: Mô tả nguyên nhân / Thiệt hại */}
              <div className="space-y-1">
                <span className="text-[11px] text-on-surface-variant font-medium block">
                  Mô tả nguyên nhân / Thiệt hại:
                </span>
                <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container text-xs text-primary font-medium leading-relaxed">
                  {incidentDescription}
                </div>
              </div>

              {/* Mục 8: Các sự kiện của chuyến quanh thời điểm sự cố */}
              <div className="space-y-1">
                <span className="text-[11px] text-error font-semibold block">
                  Các sự kiện của chuyến quanh thời điểm sự cố:
                </span>
                <div className="p-2.5 bg-surface-container-low rounded-xl border border-surface-container text-xs text-primary font-mono leading-relaxed">
                  {tripEventsTimeline}
                </div>
              </div>

              {/* Mục 9: 4 Khung hình ảnh minh chứng */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-outline uppercase tracking-wider block">
                  Hình ảnh minh chứng:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Image.PreviewGroup>
                    {/* 1. Ảnh hàng khi nhận */}
                    <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center justify-between text-center gap-1.5">
                      <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                        <Image src={pickupPhoto} alt="Ảnh hàng khi nhận" className="w-full h-20 object-cover" />
                      </div>
                      <span className="text-[11px] font-bold text-primary">Ảnh hàng khi nhận</span>
                    </div>

                    {/* 2. Ảnh seal chì & biển số */}
                    <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center justify-between text-center gap-1.5">
                      <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                        <Image src={sealPhoto} alt="Ảnh seal chì & biển số" className="w-full h-20 object-cover" />
                      </div>
                      <span className="text-[11px] font-bold text-primary">Ảnh seal chì &amp; biển số</span>
                    </div>

                    {/* 3. Biên bản / POD giao hàng */}
                    <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center justify-between text-center gap-1.5">
                      <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                        <Image src={podPhoto} alt="Biên bản / POD giao hàng" className="w-full h-20 object-cover" />
                      </div>
                      <span className="text-[11px] font-bold text-primary">Biên bản / POD giao hàng</span>
                    </div>

                    {/* 4. Ảnh hiện trường */}
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-300 flex flex-col items-center justify-between text-center gap-1.5">
                      <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                        <Image src={incidentPhoto} alt="Ảnh hiện trường" className="w-full h-20 object-cover" />
                      </div>
                      <span className="text-[11px] font-bold text-amber-950">Ảnh hiện trường</span>
                    </div>
                  </Image.PreviewGroup>
                </div>
              </div>
            </div>

            {/* MỤC 10: KẾT QUẢ GIÁM ĐỊNH (GIÁM ĐỊNH THỰC HIỆN NGOÀI HỆ THỐNG) */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container space-y-3 shadow-2xs">
              <div className="pb-1 border-b border-surface-container/60">
                <span className="font-bold text-primary uppercase text-xs tracking-wider">
                  Kết quả giám định (giám định thực hiện ngoài hệ thống)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Cột 1: Tỷ lệ hàng hỏng (%) */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Tỷ lệ hàng hỏng (%) * :
                  </label>
                  <div className="space-y-2">
                    <Space.Compact className="w-full">
                      <InputNumber
                        min={0}
                        max={100}
                        controls={false}
                        value={damagePercentage}
                        onChange={handlePercentageChange}
                        disabled={isDone || isReadOnly || goodsHandlingMethod === 'COMPANY_RECOVERY'}
                        className="w-full font-mono font-bold text-center h-9 text-xs"
                      />
                      <span className="inline-flex items-center px-3 bg-surface-container border border-l-0 border-outline-variant/40 text-on-surface-variant font-bold text-xs rounded-r-lg select-none">
                        %
                      </span>
                    </Space.Compact>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[10, 30, 50, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={isDone || isReadOnly || goodsHandlingMethod === 'COMPANY_RECOVERY'}
                          onClick={() => handlePercentageChange(p)}
                          className={`h-7.5 rounded-lg text-xs font-bold cursor-pointer border transition-all text-center flex items-center justify-center ${
                            damagePercentage === p
                              ? 'bg-secondary text-white border-secondary shadow-xs font-black'
                              : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container text-primary'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cột 2: Lỗi thuộc về */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Lỗi thuộc về * :
                  </label>
                  <Select
                    value={fault}
                    onChange={(val) => setFault(val)}
                    disabled={isDone || isReadOnly}
                    className="w-full h-9"
                    options={[
                      { value: 'COMPANY', label: 'Công ty vận chuyển (ALS)' },
                      { value: 'CUSTOMER', label: 'Khách hàng' },
                      { value: 'THIRD_PARTY', label: 'Bên thứ ba / Khách quan' }
                    ]}
                  />
                </div>

                {/* Cột 3: Đơn vị giám định / Số biên bản */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-primary text-xs">
                    Đơn vị giám định / số biên bản:
                  </label>
                  <Input
                    value={surveyOrgReport}
                    onChange={(e) => setSurveyOrgReport(e.target.value)}
                    disabled={isDone || isReadOnly}
                    placeholder="VD: Giám định ABC - BB-2026-118"
                    className="h-9 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <p className="text-[11px] text-on-surface-variant italic pt-0.5">
                * Nhập từ biên bản giám định của ALS hoặc bên thứ ba. Bắt buộc có trước khi duyệt.
              </p>
            </div>

            {/* MỤC 11: HẠN MỨC VÀ CÁCH TÍNH THEO HỢP ĐỒNG (HỘP VÀNG HIGHLIGHT) */}
            <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-300 space-y-1.5 shadow-2xs">
              <span className="font-bold text-amber-950 uppercase text-xs tracking-wider block">
                Hạn mức và cách tính theo hợp đồng
              </span>
              <div className="space-y-1 text-xs text-amber-950 leading-relaxed">
                <div>
                  Hạn mức bồi thường theo hợp đồng: <b className="font-mono font-bold">{contractCap.toLocaleString('vi-VN')} đ</b>
                </div>
                <div>
                  Giá trị khai báo {declaredValue.toLocaleString('vi-VN')} đ × {damagePercentage}% hỏng = <b className="font-mono font-bold text-error">{(declaredValue * (damagePercentage / 100)).toLocaleString('vi-VN')} đ</b>, {compensationAmount <= contractCap ? 'trong hạn mức.' : <span className="text-error font-bold">⚠ VƯỢT HẠN MỨC TRÁCH NHIỆM!</span>}
                </div>
              </div>
            </div>

            {/* MỤC 12, 13, 14: QUYẾT ĐỊNH CỦA NGƯỜI DUYỆT */}
            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3.5 shadow-2xs">
              <div className="pb-1 border-b border-surface-container/60">
                <span className="font-bold text-primary uppercase text-xs tracking-wider">
                  Quyết định của người duyệt
                </span>
              </div>

              {/* Mục 12: Hướng xử lý */}
              <div className="space-y-1.5">
                <label className="block font-bold text-primary text-xs">
                  Hướng xử lý * :
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <Select
                    value={goodsHandlingMethod}
                    onChange={(val) => handleHandlingMethodChange(val)}
                    disabled={isDone || isReadOnly}
                    className="w-full sm:w-80 h-9"
                    options={[
                      { value: 'CUSTOMER_RETAIN', label: 'Bồi thường' },
                      { value: 'COMPANY_RECOVERY', label: 'Lấy hàng về và bồi thường' }
                    ]}
                  />
                  <span className="text-[11px] text-on-surface-variant italic">
                    (Bồi thường - Giao phần hàng tốt và bồi thường phần hỏng · Lấy hàng về và bồi thường)
                  </span>
                </div>
              </div>

              {/* Mục 13: Số tiền duyệt (đ) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-primary text-xs">
                  Số tiền duyệt (đ) * :
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="w-full sm:w-80">
                    <Space.Compact className="w-full">
                      <InputNumber
                        min={0}
                        step={500000}
                        controls={false}
                        value={compensationAmount}
                        onChange={(val) => setCompensationAmount(val || 0)}
                        disabled={isDone || isReadOnly}
                        formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        parser={(val) => val.replace(/\./g, '')}
                        className="w-full font-mono font-bold text-sm text-error h-9 text-right pr-2"
                      />
                      <span className="inline-flex items-center px-3 bg-surface-container border border-l-0 border-outline-variant/40 text-on-surface-variant font-bold text-xs rounded-r-lg select-none font-mono">
                        đ
                      </span>
                    </Space.Compact>
                  </div>
                  <span className="text-[11px] text-on-surface-variant italic">
                    Mặc định theo hợp đồng, người duyệt có thể sửa kèm nhận xét.
                  </span>
                </div>
              </div>

              {/* Mục 14: Nhận xét của người duyệt */}
              <div className="space-y-1.5">
                <label className="block font-bold text-primary text-xs">
                  Nhận xét * <span className="font-normal text-on-surface-variant">(Bắt buộc khi từ chối, khi sửa số tiền, hoặc vượt hạn mức)</span>:
                </label>
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  disabled={isDone || isReadOnly}
                  placeholder="Nhập nhận xét; khi từ chối đây là lý do gửi cho khách..."
                  className="rounded-xl text-xs p-3 leading-relaxed border-surface-container focus:border-secondary transition-colors"
                />
              </div>

              <div className="pt-1 text-[11px] text-error font-semibold">
                * Chỉ quyết định được khi đơn đã Delivered hoặc hàng đã lấy về. Mời xác nhận hộp thoại các nhận trước khi lưu.
              </div>

              {/* CỤM NÚT HÀNH ĐỘNG (MỤC 15, 16, 17) */}
              {isPending && !isReadOnly && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-surface-container/60">
                  {/* Nút 15: Từ chối bồi thường */}
                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    disabled={submitting}
                    className="w-full sm:w-auto h-10 px-5 rounded-xl bg-red-100 hover:bg-red-200 text-error font-bold cursor-pointer transition-all border border-red-300 inline-flex items-center justify-center gap-1.5 text-xs shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    <span>Từ chối bồi thường</span>
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {/* Nút 16: Yêu cầu bổ sung hồ sơ */}
                    <button
                      type="button"
                      onClick={() => setIsRequestInfoModalOpen(true)}
                      disabled={submitting}
                      className="w-full sm:w-auto h-10 px-5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold cursor-pointer transition-all border border-surface-container-highest inline-flex items-center justify-center gap-1.5 text-xs shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">contact_support</span>
                      <span>Yêu cầu bổ sung hồ sơ</span>
                    </button>

                    {/* Nút 17: Duyệt bồi thường */}
                    <button
                      type="button"
                      onClick={handleApproveCompensation}
                      disabled={submitting}
                      className="w-full sm:w-auto h-10 px-6 rounded-xl bg-secondary hover:bg-blue-700 text-white font-bold cursor-pointer transition-all shadow-xs inline-flex items-center justify-center gap-1.5 text-xs hover:scale-102"
                    >
                      <span className="material-symbols-outlined text-[18px]">task_alt</span>
                      <span>{submitting ? 'Đang lưu...' : 'Duyệt bồi thường'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* MỤC 18 & 19: CHI TIỀN CHO KHÁCH (HIỆN SAU KHI DUYỆT) */}
            {isApproved && (
              <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-400/40 space-y-3.5 shadow-2xs">
                <div className="pb-1 border-b border-cyan-300/60">
                  <span className="font-bold text-cyan-950 uppercase text-xs tracking-wider">
                    Chi tiền cho khách (hiện sau khi Duyệt)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Ngày thanh toán */}
                  <div className="space-y-1">
                    <label className="block font-bold text-cyan-950 text-xs">
                      Ngày thanh toán * :
                    </label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>

                  {/* Mã giao dịch */}
                  <div className="space-y-1">
                    <label className="block font-bold text-cyan-950 text-xs">
                      Mã giao dịch * :
                    </label>
                    <Input
                      value={transactionCode}
                      onChange={(e) => setTransactionCode(e.target.value)}
                      placeholder="VD: FT26114123456"
                      className="h-9 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  {/* Link / Nút Tải chứng từ chi */}
                  <div className="space-y-1">
                    <label className="block font-bold text-cyan-950 text-xs">
                      Chứng từ chi (Ủy nhiệm chi) * :
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={paymentProofUrl}
                        onChange={(e) => setPaymentProofUrl(e.target.value)}
                        placeholder="Link ảnh UNC..."
                        className="h-9 rounded-xl text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setPaymentProofUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800')}
                        className="h-9 px-3 rounded-xl bg-white hover:bg-cyan-50 text-cyan-800 text-xs font-bold border border-cyan-300 shrink-0 cursor-pointer"
                      >
                        Tải chứng từ chi
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-cyan-900 italic">
                    (Khách xác nhận đã nhận tiền trên trang theo dõi, hoặc hệ thống tự xác nhận sau 7 ngày, rồi yêu cầu được Đóng).
                  </span>

                  {/* Nút 19: Ghi nhận đã chi */}
                  {!isReadOnly && (
                    <button
                      type="button"
                      disabled={recordingPayment}
                      onClick={handleRecordPayment}
                      className="h-10 px-6 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold cursor-pointer transition-all shadow-xs inline-flex items-center gap-2 text-xs shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                      <span>{recordingPayment ? 'Đang lưu...' : 'Ghi nhận đã chi'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* KHI ĐÃ ĐÓNG (DONE): READ-ONLY SUMMARY FOOTER */}
            {isDone && (
              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                  <span className="font-bold text-primary uppercase text-xs flex items-center gap-2 tracking-wide">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified</span>
                    Hồ sơ bồi thường đã được đóng hoàn tất (DONE)
                  </span>
                  <span className="text-[11px] text-outline font-mono">
                    Đã xử lý lúc: {currentData.closed_at ? new Date(currentData.closed_at).toLocaleString('vi-VN') : (currentData.resolved_time ? new Date(currentData.resolved_time).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'))}
                  </span>
                </div>

                {currentData.rejection_reason ? (
                  <Alert
                    type="error"
                    showIcon
                    title={<b className="text-xs">ĐÃ TỪ CHỐI BỒI THƯỜNG</b>}
                    description={
                      <div className="text-xs mt-1 space-y-1 leading-relaxed">
                        <p>• Điều khoản viện dẫn: <b>{currentData.contract_clause_ref}</b></p>
                        <p>• Lý do từ chối: {currentData.rejection_reason}</p>
                        <p>• Hotline hỗ trợ khiếu nại: <b className="font-mono text-primary font-bold">{currentData.contact_hotline || '1900 1234'}</b></p>
                      </div>
                    }
                    className="rounded-xl p-3 border border-red-200"
                  />
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-on-surface-variant block">Số tiền bồi thường đã hoàn tất:</span>
                      <strong className="text-error font-mono text-base font-black">
                        {(currentData.approved_compensation_amount || compensationAmount).toLocaleString('vi-VN')} đ
                      </strong>
                    </div>
                    {currentData.payment_proof_url && (
                      <a
                        href={currentData.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary text-xs font-bold inline-flex items-center gap-1.5 border border-surface-container transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">receipt</span>
                        <span>Xem biên lai chuyển khoản (UNC)</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 4: TRÌNH TUA LẠI HÀNH TRÌNH GPS & XÁC THỰC HIỆN TRƯỜNG BẢN ĐỒ VIETMAP */}
      <TripReplayModal
        open={isLocationMapOpen}
        onClose={() => setIsLocationMapOpen(false)}
        tripId={currentData.trip_id || currentData.trip?.id || (currentData.trip_code ? parseInt(String(currentData.trip_code).replace(/\D/g, ''), 10) : null)}
        incidentInfo={{
          incident_location_lat: currentData.incident_lat || currentData.latitude || 21.2113,
          incident_location_lng: currentData.incident_lng || currentData.longitude || 105.8340,
          location: incidentLocation,
          reported_time: currentData.reported_time || '2026-11-07T07:52:00Z',
          trip_code: tripCode,
          vehicle_plate: truckPlate,
          driver_name: driverName,
          incident_code: incidentCode,
          title: incidentTitle,
          is_on_route: currentData.is_on_route !== false
        }}
      />

      {/* MODAL 15: TỪ CHỐI BỒI THƯỜNG */}
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
            description="Quyết định từ chối bồi thường dựa trên căn cứ Hợp đồng sẽ tự động gửi thông báo cho Khách hàng và chuyển ngay trạng thái sự cố sang ĐÃ ĐÓNG (DONE)."
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
              placeholder="Nhập lý do chi tiết..."
              className="rounded-xl text-xs p-3 leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Hotline giải quyết khiếu nại * :
            </label>
            <Input
              value={contactHotline}
              onChange={(e) => setContactHotline(e.target.value)}
              className="h-10 rounded-xl text-xs font-mono font-bold"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 16: YÊU CẦU BỔ SUNG HỒ SƠ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-[22px]">contact_support</span>
            <span className="font-bold text-sm">Yêu cầu Bổ sung Hồ sơ &amp; Minh chứng</span>
          </div>
        }
        open={isRequestInfoModalOpen}
        onCancel={() => setIsRequestInfoModalOpen(false)}
        onOk={handleConfirmRequestMoreInfo}
        confirmLoading={submitting}
        okText="Gửi yêu cầu bổ sung"
        okButtonProps={{ className: "bg-secondary text-white font-bold text-xs h-10 px-5 rounded-xl shadow-xs" }}
        cancelButtonProps={{ className: "text-xs h-10 px-4 rounded-xl" }}
        width={580}
        centered
      >
        <div className="space-y-4 pt-2 text-xs">
          <Alert
            type="info"
            showIcon
            title={<b className="text-xs">Chuyển trạng thái xử lý chờ thông tin</b>}
            description="Hệ thống sẽ giữ hồ sơ ở trạng thái Đang xử lý (IN_PROGRESS) và gửi thông báo cho Điều phối viên, Tài xế và Khách hàng yêu cầu nộp thêm tài liệu."
            className="rounded-xl p-3 border border-blue-200"
          />

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Nội dung hồ sơ / Minh chứng cần bổ sung * :
            </label>
            <Input.TextArea
              rows={4}
              value={requestInfoNote}
              onChange={(e) => setRequestInfoNote(e.target.value)}
              placeholder="Ví dụ: Cần bổ sung biên bản giám định của bên thứ ba độc lập và ảnh chụp lại tem seal chì cận cảnh..."
              className="rounded-xl text-xs p-3 leading-relaxed"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 2: TRÌNH XEM HỢP ĐỒNG THÔNG MINH (TỰ ĐỘNG HIỆN 1 HOẶC 2 HỢP ĐỒNG) */}
      <Modal
        title={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-8 gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[24px]">picture_as_pdf</span>
              <div>
                <h4 className="font-bold text-sm text-primary">
                  {hasFrameworkContract ? 'Hồ sơ Hợp đồng Pháp lý (2 Bản)' : 'Hợp đồng Vận tải Theo chuyến (Khách vãng lai)'}
                </h4>
                <p className="text-[11px] text-on-surface-variant font-normal">
                  {hasFrameworkContract
                    ? 'Hệ thống tự động liên kết Hợp đồng khung đối tác & Hợp đồng vận tải của đơn hàng này'
                    : 'Đơn hàng chưa có HĐ khung dài hạn · Áp dụng giới hạn trách nhiệm 500 triệu VNĐ (NĐ 163/2017/NĐ-CP)'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>In hợp đồng</span>
              </button>
            </div>
          </div>
        }
        open={isContractViewerOpen}
        onCancel={() => setIsContractViewerOpen(false)}
        footer={null}
        width={900}
        centered
      >
        <div className="space-y-3 pt-1">
          {/* THANH CHUYỂN TAB: CHỈ HIỆN 2 TAB KHI ĐƠN HÀNG CÓ HỢP ĐỒNG ĐỐI TÁC KHUNG */}
          {hasFrameworkContract ? (
            <div className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded-xl border border-surface-container">
              <button
                type="button"
                onClick={() => setContractViewerTab('FRAMEWORK')}
                className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                  contractViewerTab === 'FRAMEWORK'
                    ? 'bg-white text-secondary shadow-xs border border-surface-container'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>1. Hợp đồng Khung Đối tác ({contractNumber})</span>
              </button>

              <button
                type="button"
                onClick={() => setContractViewerTab('ORDER_TRIP')}
                className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                  contractViewerTab === 'ORDER_TRIP'
                    ? 'bg-white text-secondary shadow-xs border border-surface-container'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                <span>2. Hợp đồng Vận tải Chuyến ({orderCode})</span>
              </button>
            </div>
          ) : (
            <Alert
              type="warning"
              showIcon
              title={<b className="text-xs">Đơn hàng không có Hợp đồng Khung Đối tác (Khách hàng Vãng lai)</b>}
              description="Doanh nghiệp này chưa ký hợp đồng nguyên tắc dài hạn. Mọi chế tài bồi thường được thẩm định trực tiếp theo Hợp đồng vận tải từng chuyến dưới đây và giới hạn trách nhiệm luật định 500.000.000 VNĐ theo Nghị định 163/2017/NĐ-CP."
              className="rounded-xl p-3 border border-amber-300"
            />
          )}

          {/* NỘI DUNG VĂN BẢN HỢP ĐỒNG ĐƯỢC CHỌN */}
          <div className="max-h-[70vh] overflow-y-auto p-6 bg-white rounded-xl border border-surface-container text-xs text-slate-800 space-y-4 font-sans leading-relaxed shadow-inner">
            
            {/* ============================================================== */}
            {/* BẢN 1: HỢP ĐỒNG NGUYÊN TẮC KHUNG (FRAMEWORK) */}
            {/* ============================================================== */}
            {(hasFrameworkContract && contractViewerTab === 'FRAMEWORK') && (
              <div className="space-y-4">
                <div className="text-center space-y-1 pb-3 border-b border-slate-200">
                  <div className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </div>
                  <div className="font-semibold text-xs text-slate-800">
                    Độc lập - Tự do - Hạnh phúc
                  </div>
                  <div className="text-slate-400 text-xs">---o0o---</div>
                  <div className="font-black text-base text-primary uppercase mt-2">
                    HỢP ĐỒNG NGUYÊN TẮC VẬN CHUYỂN HÀNG HÓA ĐƯỜNG BỘ
                  </div>
                  <div className="text-slate-500 italic text-[11px] font-mono">
                    Số: {contractNumber} / ALS-NEXLOG
                  </div>
                  <div className="text-[10px] text-slate-400 italic space-y-0.5 pt-1">
                    <div>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội ban hành ngày 24/11/2015;</div>
                    <div>- Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005;</div>
                    <div>- Căn cứ Hợp đồng khung hợp tác cung ứng dịch vụ logistics giữa hai Bên.</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                  <div className="space-y-1">
                    <strong className="text-primary uppercase block font-bold text-xs">BÊN A (BÊN VẬN CHUYỂN):</strong>
                    <div><strong>CÔNG TY TNHH VẬN TẢI &amp; LOGISTICS HÀNG KHÔNG ALS (NEXLOG)</strong></div>
                    <div>Địa chỉ: Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội</div>
                    <div>Mã số thuế: 0102345678 · Điện thoại: 1900 3133 / 0988 123 456</div>
                    <div>Đại diện: Ban Giám đốc Vận tải Hàng không ALS</div>
                  </div>

                  <div className="space-y-1">
                    <strong className="text-primary uppercase block font-bold text-xs">BÊN B (ĐỐI TÁC DOANH NGHIỆP):</strong>
                    <div><strong>{customerName}</strong></div>
                    <div>Người liên hệ: {contactPerson} · SĐT: {contactPhone}</div>
                    <div>Hạn mức tín dụng &amp; thanh toán: 30 ngày kể từ ngày chốt bảng kê công nợ tháng</div>
                  </div>
                </div>

                <div className="space-y-3 pt-1 text-slate-700">
                  <div>
                    <strong className="text-primary font-bold text-xs block mb-0.5">
                      ĐIỀU 4: MIỄN TRỪ TRÁCH NHIỆM (CĂN CỨ TỪ CHỐI BỒI THƯỜNG)
                    </strong>
                    <p className="p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                      <b>Khoản 4.2:</b> Bên A được hoàn toàn miễn trừ trách nhiệm bồi thường nếu hàng hóa bị hư hỏng, rách nát xuất phát từ lỗi đóng gói không đúng quy chuẩn bảo vệ của chủ hàng, hoặc hàng hóa đã bị tổn thất từ trước thời điểm bàn giao bốc xếp lên phương tiện vận chuyển của Bên A (căn cứ theo ảnh chụp đối chiếu lúc nhận hàng Pickup).
                    </p>
                  </div>

                  <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-950 space-y-1.5">
                    <strong className="text-primary font-bold text-xs block uppercase">
                      ĐIỀU 8: TRÁCH NHIỆM BỒI THƯỜNG THIỆT HẠI HÀNG HÓA (CĂN CỨ DUYỆT BỒI THƯỜNG)
                    </strong>
                    <p>
                      <b>Khoản 8.1:</b> Bên A chịu trách nhiệm bồi thường đối với các tổn thất, móp vỡ, hư hỏng hoặc mất mát phát sinh đối với hàng hóa trong quá trình vận chuyển do lỗi trực tiếp từ phương tiện hoặc nhân viên lái xe của Bên A.
                    </p>
                    <p>
                      <b>Khoản 8.2:</b> Mức bồi thường được xác định theo công thức:
                      <br />
                      <span className="font-mono font-bold text-primary pl-4 block py-1">
                        Số tiền bồi thường = Tỷ lệ hư hỏng thực tế (%) × Giá trị khai báo của từng đơn hàng
                      </span>
                      Trong mọi trường hợp, tổng mức trách nhiệm bồi thường tối đa của Bên A cho mỗi vụ việc không vượt quá Hạn mức trách nhiệm hợp đồng đối tác là: <b className="font-mono text-error font-bold">{contractCap.toLocaleString('vi-VN')} VNĐ</b>.
                    </p>
                    <p>
                      <b>Khoản 8.3:</b> Thời hạn khách hàng lập yêu cầu khiếu nại bồi thường tối đa 14 ngày kể từ thời điểm giao hàng (POD). Quá thời hạn trên, quyền khiếu nại không còn hiệu lực.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-center">
                  <div className="space-y-1">
                    <strong className="block font-bold text-xs text-primary uppercase">ĐẠI DIỆN BÊN B (DOANH NGHIỆP)</strong>
                    <div className="h-14 flex items-center justify-center">
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-700 text-[11px] font-bold">
                        ✔ ĐÃ KÝ SỐ ĐỐI TÁC KHUNG
                      </div>
                    </div>
                    <strong className="block text-primary font-bold text-xs">{contactPerson}</strong>
                  </div>

                  <div className="space-y-1">
                    <strong className="block font-bold text-primary uppercase text-xs">ĐẠI DIỆN BÊN A (ALS LOGISTICS)</strong>
                    <div className="h-14 flex items-center justify-center">
                      <div className="px-3 py-1 bg-red-50 border border-red-300 rounded-lg text-red-700 text-[11px] font-bold">
                        ✔ CHỨNG THƯ SỐ ALS LOGISTICS
                      </div>
                    </div>
                    <strong className="block text-primary font-bold text-xs">TỔNG GIÁM ĐỐC ALS</strong>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* BẢN 2: HỢP ĐỒNG VẬN TẢI THEO CHUYẾN (ORDER SPECIFIC CONTRACT) */}
            {/* (ĐƯỢC LẤY TRỰC TIẾP TỪ HỒ SƠ CỦA CHÍNH ĐƠN HÀNG ĐÓ) */}
            {/* ============================================================== */}
            {(!hasFrameworkContract || contractViewerTab === 'ORDER_TRIP') && (
              <div className="space-y-4">
                <div className="text-center space-y-1 pb-3 border-b border-slate-200">
                  <div className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </div>
                  <div className="font-semibold text-xs text-slate-800">
                    Độc lập - Tự do - Hạnh phúc
                  </div>
                  <div className="text-slate-400 text-xs">---o0o---</div>
                  <div className="font-black text-base text-primary uppercase mt-2">
                    HỢP ĐỒNG VẬN TẢI HÀNG HÓA THEO CHUYẾN
                  </div>
                  <div className="text-slate-500 italic text-[11px] font-mono">
                    Số: {orderCode}/HĐVT-{new Date().getFullYear()}
                  </div>
                  <div className="text-[10px] text-slate-400 italic space-y-0.5 pt-1">
                    <div>- Lập và lưu trữ trực tiếp tại hồ sơ Đơn hàng: <b>{orderCode}</b> (Chuyến xe: <b>{tripCode}</b>)</div>
                    <div>- Căn cứ xác nhận ký kết giữa Điều phối viên ALS và Khách hàng theo quy chuẩn BR-45 &amp; BR-50.</div>
                  </div>
                </div>

                {/* NẾU ĐƠN HÀNG CÓ TỆP SCAN HỢP ĐỒNG PDF ĐÍNH KÈM THẬT */}
                {(currentData.order?.order_contract?.contract_file || currentData.order?.signed_order_contract_file) && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]">file_present</span>
                      <div>
                        <span className="font-bold text-emerald-950 block">
                          Tệp scan hợp đồng đã ký của đơn hàng:
                        </span>
                        <span className="font-mono text-emerald-800 text-[11px]">
                          {currentData.order?.order_contract?.contract_file || currentData.order?.signed_order_contract_file}
                        </span>
                      </div>
                    </div>
                    {currentData.order?.order_contract?.contract_file_data ? (
                      <a
                        href={currentData.order.order_contract.contract_file_data}
                        download={currentData.order.order_contract.contract_file || `Hop_Dong_${orderCode}.pdf`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        <span>Tải tệp PDF</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-emerald-800 italic">Đã lưu trữ hồ sơ điện tử</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                  <div className="space-y-1">
                    <strong className="text-primary uppercase block font-bold text-xs">ĐƠN VỊ VẬN CHUYỂN:</strong>
                    <div><strong>CÔNG TY TNHH VẬN TẢI &amp; LOGISTICS HÀNG KHÔNG ALS</strong></div>
                    <div>Xe vận chuyển: <b className="font-mono text-primary">{truckPlate}</b></div>
                    <div>Tài xế phụ trách: <b>{driverName}</b> ({driverPhone})</div>
                    <div>Cước phí chuyến: <b className="font-mono text-error font-bold">{agreedPrice.toLocaleString('vi-VN')} VNĐ</b></div>
                  </div>

                  <div className="space-y-1">
                    <strong className="text-primary uppercase block font-bold text-xs">BÊN THUÊ VẬN CHUYỂN:</strong>
                    <div><strong>{customerName}</strong></div>
                    <div>Người liên hệ nhận/giao: {contactPerson} ({contactPhone})</div>
                    <div>Lộ trình: <span className="font-medium text-primary">{routeDisplay}</span></div>
                    <div>Quy cách lô hàng: <b className="text-primary">{cargoDescription}</b></div>
                  </div>
                </div>

                <div className="space-y-3 pt-1 text-slate-700">
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1">
                    <strong className="text-amber-950 font-bold text-xs block">
                      GIÁ TRỊ KHAI BÁO CỦA LÔ HÀNG ĐƯỢC BẢO HIỂM:
                    </strong>
                    <div className="flex items-center justify-between text-xs">
                      <span>Giá trị khai báo tính bồi thường:</span>
                      <strong className="font-mono text-error font-bold text-sm">
                        {declaredValue.toLocaleString('vi-VN')} VNĐ
                      </strong>
                    </div>
                    <p className="text-[11px] text-on-surface-variant italic pt-0.5">
                      (Được trích xuất từ hồ sơ chứng từ của đơn hàng {orderCode} do khách hàng nộp đã được duyệt).
                    </p>
                  </div>

                  {/* NẾU ĐƠN HÀNG CÓ CÁC ĐIỀU KHOẢN TÙY BIẾN DO ĐIỀU PHỐI VIÊN SOẠN THẢO */}
                  {Array.isArray(currentData.order?.order_contract?.contract_custom_terms) && currentData.order.order_contract.contract_custom_terms.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <strong className="text-primary font-bold text-xs block">
                        ĐIỀU KHOẢN BỔ SUNG CỦA ĐƠN HÀNG:
                      </strong>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700">
                        {currentData.order.order_contract.contract_custom_terms.map((term, tIdx) => (
                          <li key={tIdx}>{term}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <strong className="text-primary font-bold text-xs block mb-0.5">
                      ĐIỀU KHOẢN TRÁCH NHIỆM &amp; HẠN MỨC BỒI THƯỜNG:
                    </strong>
                    <p>
                      1. Bên vận chuyển cam kết bảo quản nguyên đai nguyên kiện và nguyên tem niêm phong chì trong suốt hành trình từ điểm nhận đến điểm giao.
                    </p>
                    <p>
                      2. Trường hợp xảy ra móp vỡ, đổ vỡ do lỗi vận hành xe: Mức bồi thường = <b>Tỷ lệ hư hỏng (%) × Giá trị khai báo ({declaredValue.toLocaleString('vi-VN')} VNĐ)</b>.
                    </p>
                    <p>
                      3. Giới hạn trách nhiệm tối đa áp dụng: <b className="font-mono font-bold text-error">{effectiveLiabilityCap.toLocaleString('vi-VN')} VNĐ</b> {!hasFrameworkContract && '(Theo mức trần luật định Nghị định 163/2017/NĐ-CP)'}.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-center">
                  <div className="space-y-1">
                    <strong className="block font-bold text-xs text-primary uppercase">XÁC NHẬN CỦA KHÁCH HÀNG</strong>
                    <div className="h-14 flex items-center justify-center">
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-700 text-[11px] font-bold">
                        ✔ ĐÃ KÝ XÁC NHẬN CHUYẾN
                      </div>
                    </div>
                    <strong className="block text-primary font-bold text-xs">{contactPerson}</strong>
                  </div>

                  <div className="space-y-1">
                    <strong className="block font-bold text-primary uppercase text-xs">ĐIỀU PHỐI VIÊN ALS</strong>
                    <div className="h-14 flex items-center justify-center">
                      <div className="px-3 py-1 bg-blue-50 border border-blue-300 rounded-lg text-blue-700 text-[11px] font-bold">
                        ✔ ĐÃ XÁC NHẬN ĐƠN (CONFIRMED)
                      </div>
                    </div>
                    <strong className="block text-primary font-bold text-xs">BAN ĐIỀU PHỐI VẬN TẢI</strong>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </Modal>
    </>
  );
}
