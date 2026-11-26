"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Tag, message, Spin } from 'antd';
import { managerApi } from '../../../api/managerApi';
import TripReplayModal from '../../../components/common/TripReplayModal';
import {
  calculateAutoCompensation as calcCompensation,
  checkHasFrameworkContract,
  getEffectiveLiabilityCap,
  validateApprovalDecision,
  validateRejectionDecision,
  validateRequestMoreInfo,
  determineIncidentStatus,
  buildApprovalPayload,
  buildRejectionPayload
} from '../../../utils/incidentCompensationHelper';
import IncidentEvidenceSection from './IncidentEvidenceSection';
import IncidentCompensationForm from './IncidentCompensationForm';
import IncidentDecisionModals from './IncidentDecisionModals';
import IncidentContractViewerModal from './IncidentContractViewerModal';
import IncidentEmailPreviewModal from './IncidentEmailPreviewModal';

export default function MajorIncidentDetailModal({
  open,
  incident,
  onClose,
  onSuccess,
  isReadOnly = false
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  // Form decision state (Mục 10, 12, 13, 14) - không tự chọn sẵn khi mở xét duyệt mới
  const [fault, setFault] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [damagePercentage, setDamagePercentage] = useState(null);
  const [goodsHandlingMethod, setGoodsHandlingMethod] = useState(null);
  const [surveyOrgReport, setSurveyOrgReport] = useState('');
  const [contractClauseRef, setContractClauseRef] = useState('');
  const [compensationAmount, setCompensationAmount] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Sub-modals
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRequestInfoModalOpen, setIsRequestInfoModalOpen] = useState(false);
  const [isContractViewerOpen, setIsContractViewerOpen] = useState(false);
  const [contractViewerTab, setContractViewerTab] = useState('FRAMEWORK'); // 'FRAMEWORK' | 'ORDER_TRIP'
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [emailPreviewType, setEmailPreviewType] = useState('APPROVAL'); // 'APPROVAL' | 'REJECTION'
  const [sendingEmail, setSendingEmail] = useState(false);

  // Rejection modal inputs (Mục 15)
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionClause, setRejectionClause] = useState('');
  const [contactHotline, setContactHotline] = useState('1900 1234');

  // Request More Info modal inputs (Mục 16)
  const [requestInfoNote, setRequestInfoNote] = useState('');

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;
      if (!open || !incident) {
        setDetail(null);
        return;
      }

      const initStatus = determineIncidentStatus(incident);
      if (!initStatus.isPending) {
        setFault(incident.fault || null);
        setResolutionNote(incident.resolution_note || '');
        setDamagePercentage(
          incident.damage_percentage !== undefined && incident.damage_percentage !== null
            ? Number(incident.damage_percentage)
            : null
        );
        setGoodsHandlingMethod(incident.goods_handling_method || null);
        setContractClauseRef(incident.contract_clause_ref || '');
        setSurveyOrgReport(incident.survey_org_report || incident.assessment_result || '');
        setRejectionReason(incident.rejection_reason || '');
        setRejectionClause(initStatus.isRejected ? (incident.contract_clause_ref || '') : '');
        const initAmt = incident.approved_compensation_amount ?? incident.proposed_compensation_amount;
        setCompensationAmount(
          initAmt !== undefined && initAmt !== null && Number(initAmt) > 0
            ? Number(initAmt)
            : null
        );
      } else {
        // Trạng thái chờ xét duyệt: Mở ra hoàn toàn trắng, không tự chọn sẵn bất kỳ giá trị nào
        setFault(null);
        setResolutionNote('');
        setDamagePercentage(null);
        setGoodsHandlingMethod(null);
        setContractClauseRef('');
        setSurveyOrgReport('');
        setRejectionReason('');
        setRejectionClause('');
        setCompensationAmount(null);
      }

      // Tải chi tiết sự cố và hồ sơ liên quan
      setLoading(true);
      const incId = incident.id || incident.raw_id;
      managerApi.getIncidentById(incId)
        .then((res) => {
          if (!active) return;
          const data = res || incident;
          const dataStatus = determineIncidentStatus(data);
          setDetail(data);

          if (!dataStatus.isPending) {
            setFault(data.fault || null);
            setResolutionNote(data.resolution_note || '');
            setDamagePercentage(
              data.damage_percentage !== undefined && data.damage_percentage !== null
                ? Number(data.damage_percentage)
                : null
            );
            setGoodsHandlingMethod(data.goods_handling_method || null);
            setContractClauseRef(data.contract_clause_ref || '');
            setSurveyOrgReport(data.survey_org_report || data.assessment_result || '');
            setRejectionReason(data.rejection_reason || '');
            if (data.rejection_reason && data.contract_clause_ref) {
              setRejectionClause(data.contract_clause_ref);
            }
            if (
              data.approved_compensation_amount !== undefined &&
              data.approved_compensation_amount !== null &&
              Number(data.approved_compensation_amount) > 0
            ) {
              setCompensationAmount(Number(data.approved_compensation_amount));
            } else if (data.proposed_compensation_amount && Number(data.proposed_compensation_amount) > 0) {
              setCompensationAmount(Number(data.proposed_compensation_amount));
            } else {
              setCompensationAmount(null);
            }
          } else {
            // Khi đơn đang chờ duyệt: Đảm bảo xóa sạch 100% các ô nhập liệu
            setFault(null);
            setResolutionNote('');
            setDamagePercentage(null);
            setGoodsHandlingMethod(null);
            setContractClauseRef('');
            setSurveyOrgReport('');
            setRejectionReason('');
            setRejectionClause('');
            setCompensationAmount(null);
          }
        })
        .catch((err) => {
          if (!active) return;
          console.warn('Lỗi lấy chi tiết sự cố:', err);
          setDetail(incident);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [open, incident]);

  if (!open || !incident) return null;

  const currentData = detail || incident;
  const { isPending, isApproved, isPaid, isRejected, isDone, badge } = determineIncidentStatus(currentData);
  const isFormLocked = !isPending || isReadOnly;

  const claimCode = currentData.claim_code || currentData.compensation_claim?.claim_code || null;
  const orderCode = currentData.order_code || currentData.order?.order_code || 'Chưa gắn đơn';
  const orderType = currentData.order?.order_type || currentData.order_type || 'Chưa cập nhật';
  const orderStatus = currentData.order?.status || 'Chưa cập nhật';
  const customerName = currentData.order?.customer?.company_name || currentData.customer_name || 'Chưa cập nhật';
  const contactPerson = currentData.order?.contact_person || currentData.receiver_name || currentData.order?.receiver_name || 'Chưa cập nhật';
  const contactPhone = currentData.order?.contact_phone || currentData.order?.customer?.phone || 'Chưa có';
  const customerEmailDisplay =
    currentData.customer_email ||
    currentData.order?.customer?.email ||
    currentData.order?.order_contract?.contract_details?.customer_email ||
    null;
  const receiverName = currentData.receiver_name || currentData.order?.receiver_name || contactPerson;
  const routeDisplay =
    currentData.order?.route_display ||
    (currentData.order?.pickup_address && currentData.order?.delivery_address
      ? `${currentData.order.pickup_address} → ${currentData.order.delivery_address}`
      : 'Chưa cập nhật');
  const firstCargo = Array.isArray(currentData.order?.order_cargos) ? currentData.order.order_cargos[0] : null;
  const cargoDescription =
    currentData.order?.cargo_description ||
    (firstCargo?.cargo_name
      ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
      : 'Chưa có thông tin hàng hóa');
  const rawDeclaredVal = currentData.order?.declared_value ?? currentData.declared_value ?? null;
  const declaredValue = rawDeclaredVal !== null && rawDeclaredVal !== undefined ? Number(rawDeclaredVal) : null;
  const rawAgreedPrice = currentData.order?.agreed_price ?? currentData.agreed_price ?? null;
  const agreedPrice = rawAgreedPrice !== null && rawAgreedPrice !== undefined ? Number(rawAgreedPrice) : null;
  const tripCode = currentData.trip_code || (currentData.trip_id ? `TRIP-${currentData.trip_id}` : 'Chưa cập nhật');
  const truckPlate = currentData.truck_plate || 'Chưa cập nhật';
  const driverName = currentData.driver_name || 'Chưa cập nhật';
  const driverPhone = currentData.driver_phone || 'Chưa có';
  const sealNumber = currentData.seal_number || currentData.order?.seal_number || 'Chưa ghi nhận';
  const contractNumber = currentData.contract?.contract_number || 'Không có hợp đồng khung';
  const contractCap = currentData.contract?.liability_cap ? Number(currentData.contract.liability_cap) : null;

  // Nhận diện đơn hàng có Hợp đồng khung đối tác dài hạn hay là khách vãng lai
  const hasFrameworkContract = checkHasFrameworkContract({
    order: currentData.order,
    contract: currentData.contract
  });
  const effectiveLiabilityCap = getEffectiveLiabilityCap({
    order: currentData.order,
    contract: currentData.contract
  });

  // Số tiền yêu cầu bồi thường (Mục 3) & Thông tin chuyển cấp từ ĐPV
  const requestedClaimAmount = Number(currentData.claim_amount || currentData.proposed_compensation_amount || 0);
  const escalatedTimeDisplay = currentData.escalated_time
    ? new Date(currentData.escalated_time).toLocaleString('vi-VN')
    : 'Chưa chuyển cấp';
  const escalationReasonDisplay =
    currentData.escalation_reason ||
    'Chưa có ghi chú chuyển cấp.';

  // Thông tin sự cố phát sinh (Mục 5 & 6)
  const incidentCode = currentData.code || (currentData.id ? `INC-${String(currentData.id).padStart(3, '0')}` : '—');
  const incidentTitle = currentData.type_display || currentData.type || 'Sự cố vận chuyển';
  const incidentSource = currentData.source_display || (currentData.driver_name ? 'Tài xế báo cáo' : 'Hệ thống');
  const incidentTime = currentData.reported_time ? new Date(currentData.reported_time).toLocaleString('vi-VN') : 'Chưa ghi nhận';
  const incidentLocation = currentData.incident_location || 'Chưa có thông tin vị trí';
  const hasCoordinates = currentData.incident_lat != null && currentData.incident_lng != null;
  const incidentDescription = currentData.description || 'Chưa có mô tả chi tiết.';
  const tripEventsTimeline = currentData.trip_events_timeline || 'Chưa ghi nhận sự kiện chuyến xe.';

  // 4 Khung hình ảnh minh chứng (Mục 9 — chỉ dùng ảnh thật từ DB, không fallback ảnh mẫu)
  const pickupPhoto = currentData.pickup_photos?.[0] || null;
  const sealPhoto = currentData.seal_photos?.[0] || null;
  const podPhoto = currentData.delivery_photos?.[0] || null;
  const incidentPhotosList =
    Array.isArray(currentData.incident_photos) && currentData.incident_photos.length > 0
      ? currentData.incident_photos
      : Array.isArray(currentData.photos) && currentData.photos.length > 0
        ? currentData.photos
        : [];
  const incidentPhoto = incidentPhotosList[0] || null;

  // Tính toán bồi thường theo hợp đồng (Mục 11 & Mục 13)
  const calculateAutoCompensation = (pct, method) => {
    return calcCompensation({
      declaredValue: declaredValue || 0,
      damagePercentage: pct,
      handlingMethod: method,
      liabilityCap: effectiveLiabilityCap
    });
  };

  const handlePercentageChange = (val) => {
    if (val === null || val === undefined || val === '') {
      setDamagePercentage(null);
      return;
    }
    const num = Number(val);
    setDamagePercentage(num);
    if (fault !== 'CUSTOMER' && declaredValue !== null && declaredValue > 0) {
      setCompensationAmount(
        calculateAutoCompensation(num, goodsHandlingMethod || 'CUSTOMER_RETAIN')
      );
    }
  };

  const handleHandlingMethodChange = (method) => {
    setGoodsHandlingMethod(method);
    if (
      fault !== 'CUSTOMER' &&
      declaredValue !== null &&
      declaredValue > 0 &&
      damagePercentage !== null &&
      damagePercentage !== undefined
    ) {
      setCompensationAmount(calculateAutoCompensation(damagePercentage, method));
    }
  };

  const handleFaultChange = (val) => {
    setFault(val);
    if (val === 'CUSTOMER') {
      setCompensationAmount(0);
    } else if (
      val === 'COMPANY' &&
      (!compensationAmount || compensationAmount === 0) &&
      declaredValue !== null &&
      declaredValue > 0 &&
      damagePercentage > 0
    ) {
      setCompensationAmount(
        calculateAutoCompensation(damagePercentage, goodsHandlingMethod || 'CUSTOMER_RETAIN')
      );
    }
  };

  // Nút 17: Chốt bồi thường, gửi email khách xác nhận và kết thúc luồng
  const handleApproveCompensation = async () => {
    const validation = validateApprovalDecision({
      fault,
      damagePercentage,
      goodsHandlingMethod,
      resolutionNote,
      compensationAmount
    });
    if (!validation.isValid) {
      message.warning(validation.error);
      return;
    }
    if (Number(compensationAmount) > effectiveLiabilityCap && !String(resolutionNote || '').trim()) {
      message.warning(`Số tiền duyệt vượt hạn mức trách nhiệm (${effectiveLiabilityCap.toLocaleString('vi-VN')} đ)! Bắt buộc nhập nhận xét ngoại lệ (MSG56).`);
      return;
    }

    try {
      setSubmitting(true);
      const incId = currentData.id || currentData.raw_id;
      const payload = buildApprovalPayload({
        fault,
        compensationAmount,
        damagePercentage,
        goodsHandlingMethod,
        contractClauseRef,
        surveyOrgReport,
        resolutionNote
      });

      const res = await managerApi.decideIncidentCompensation(incId, payload);
      message.success(
        res?.message ||
          'Đã chốt mức bồi thường và gửi email thông báo tới khách hàng!'
      );
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi duyệt bồi thường:', error);
      message.error(error.message || 'Lỗi khi phê duyệt bồi thường');
    } finally {
      setSubmitting(false);
    }
  };

  // Xác định lỗi & Đóng sự cố không phát sinh bồi thường (UI-38 / BUG-UI-06)
  const handleResolveWithoutCompensation = async () => {
    if (!fault) {
      message.warning('Vui lòng chọn bên chịu trách nhiệm lỗi trước khi đóng sự cố!');
      return;
    }

    try {
      setSubmitting(true);
      const incId = currentData.id || currentData.raw_id;
      const res = await managerApi.resolveIncident(incId, {
        fault,
        compensation_amount: 0,
        resolution_note: resolutionNote.trim() || 'Quản lý đã xác định bên có lỗi và đóng sự cố (không phát sinh bồi thường).'
      });
      message.success(res?.message || 'Đã xác định lỗi và đóng hồ sơ sự cố (không bồi thường)!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi đóng sự cố không bồi thường:', error);
      message.error(error.message || 'Lỗi khi đóng sự cố');
    } finally {
      setSubmitting(false);
    }
  };

  // Nút 16: Yêu cầu bổ sung hồ sơ
  const handleConfirmRequestMoreInfo = async () => {
    const validation = validateRequestMoreInfo({ requestInfoNote });
    if (!validation.isValid) {
      message.warning(validation.error);
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
    const validation = validateRejectionDecision({ rejectionReason, rejectionClause });
    if (!validation.isValid) {
      message.warning(validation.error);
      return;
    }

    try {
      setSubmitting(true);
      const incId = currentData.id || currentData.raw_id;
      const payload = buildRejectionPayload({
        rejectionReason,
        rejectionClause,
        contactHotline
      });

      const res = await managerApi.decideIncidentCompensation(incId, payload);
      message.success(res?.message || 'Đã từ chối bồi thường — Chờ Điều phối viên gọi điện thông báo khách hàng.');
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

  // Gửi trực tiếp hoặc gửi lại Email thông báo tới Khách hàng
  const handleSendEmailToCustomer = async () => {
    if (!customerEmailDisplay) {
      message.warning('Đơn hàng chưa có email khách hàng để gửi thông báo.');
      return;
    }
    try {
      setSendingEmail(true);
      const incId = currentData.id || currentData.raw_id;
      const res = await managerApi.sendIncidentEmail(incId, {
        email_type: emailPreviewType,
        approved_amount: compensationAmount,
        damage_percentage: damagePercentage,
        goods_handling_method: goodsHandlingMethod,
        contract_clause_ref: emailPreviewType === 'REJECTION' ? rejectionClause : contractClauseRef,
        survey_org_report: surveyOrgReport,
        resolution_note: resolutionNote,
        rejection_reason: rejectionReason || currentData.rejection_reason || resolutionNote,
        contact_hotline: contactHotline
      });
      message.success(res?.message || `Đã gửi email thông báo tới ${customerEmailDisplay} thành công!`);
      if (res?.email_result?.sent) {
        setDetail((prev) => ({
          ...(prev || currentData),
          email_sent: true,
          customer_email: res.email_result.customer_email || customerEmailDisplay,
          email_sent_at: res.email_result.email_sent_at || new Date().toISOString(),
          email_type: res.email_result.email_type || emailPreviewType
        }));
      }
      onSuccess?.();
    } catch (error) {
      console.error('Lỗi gửi email cho khách hàng:', error);
      message.error(error.message || 'Không thể gửi email tới khách hàng');
    } finally {
      setSendingEmail(false);
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
                    {claimCode ? `Xét duyệt Bồi thường: ${claimCode}` : `Thẩm định Sự cố: ${incidentCode}`} – Đơn {orderCode}
                  </h3>
                  <Tag color={badge.color} className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                    {badge.label}
                  </Tag>
                  {currentData.is_major && (
                    <Tag color="red" className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 shadow-2xs">
                      Sự cố nghiêm trọng
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
            <IncidentEvidenceSection
              orderCode={orderCode}
              orderType={orderType}
              orderStatus={orderStatus}
              customerName={customerName}
              receiverName={receiverName}
              contactPhone={contactPhone}
              routeDisplay={routeDisplay}
              agreedPrice={agreedPrice}
              cargoDescription={cargoDescription}
              declaredValue={declaredValue}
              tripCode={tripCode}
              truckPlate={truckPlate}
              driverName={driverName}
              driverPhone={driverPhone}
              sealNumber={sealNumber}
              contractNumber={contractNumber}
              requestedClaimAmount={requestedClaimAmount}
              claimCode={claimCode}
              incidentSource={incidentSource}
              escalatedTimeDisplay={escalatedTimeDisplay}
              escalationReasonDisplay={escalationReasonDisplay}
              incidentCode={incidentCode}
              incidentTitle={incidentTitle}
              incidentTime={incidentTime}
              incidentLocation={incidentLocation}
              incidentDescription={incidentDescription}
              tripEventsTimeline={tripEventsTimeline}
              pickupPhoto={pickupPhoto}
              sealPhoto={sealPhoto}
              podPhoto={podPhoto}
              incidentPhoto={incidentPhoto}
              incidentPhotosList={incidentPhotosList}
              cargoAffected={currentData.cargo_affected}
              hasCoordinates={hasCoordinates}
              onOpenContractViewer={() => setIsContractViewerOpen(true)}
              onOpenLocationMap={() => setIsLocationMapOpen(true)}
            />

            <IncidentCompensationForm
              currentData={currentData}
              isPending={isPending}
              isApproved={isApproved}
              isPaid={isPaid}
              isRejected={isRejected}
              isDone={isDone}
              isReadOnly={isReadOnly}
              isFormLocked={isFormLocked}
              submitting={submitting}
              damagePercentage={damagePercentage}
              fault={fault}
              surveyOrgReport={surveyOrgReport}
              setSurveyOrgReport={setSurveyOrgReport}
              goodsHandlingMethod={goodsHandlingMethod}
              contractClauseRef={contractClauseRef}
              setContractClauseRef={setContractClauseRef}
              compensationAmount={compensationAmount}
              setCompensationAmount={setCompensationAmount}
              resolutionNote={resolutionNote}
              setResolutionNote={setResolutionNote}
              hasFrameworkContract={hasFrameworkContract}
              effectiveLiabilityCap={effectiveLiabilityCap}
              declaredValue={declaredValue}
              customerEmailDisplay={customerEmailDisplay}
              handlePercentageChange={handlePercentageChange}
              handleFaultChange={handleFaultChange}
              handleHandlingMethodChange={handleHandlingMethodChange}
              handleApproveCompensation={handleApproveCompensation}
              handleResolveWithoutCompensation={handleResolveWithoutCompensation}
              onOpenRejectModal={() => setIsRejectModalOpen(true)}
              onOpenRequestInfoModal={() => setIsRequestInfoModalOpen(true)}
              onOpenEmailPreview={(type) => {
                setEmailPreviewType(type);
                setIsEmailPreviewOpen(true);
              }}
            />
          </div>
        )}
      </Modal>

      {/* MODAL 4: BẢN ĐỒ VIETMAP XÁC ĐỊNH VỊ TRÍ XẢY RA SỰ CỐ KHI TÀI XẾ BÁO CÁO */}
      <TripReplayModal
        open={isLocationMapOpen}
        onClose={() => setIsLocationMapOpen(false)}
        mode="INCIDENT_LOCATION"
        tripId={currentData.trip_id || currentData.trip?.id || (currentData.trip_code ? parseInt(String(currentData.trip_code).replace(/\D/g, ''), 10) : null)}
        incidentInfo={{
          incident_location_lat: currentData.incident_lat ?? currentData.latitude ?? null,
          incident_location_lng: currentData.incident_lng ?? currentData.longitude ?? null,
          location: incidentLocation,
          reported_time: currentData.reported_time || null,
          trip_code: tripCode,
          vehicle_plate: truckPlate,
          driver_name: driverName,
          incident_code: incidentCode,
          title: incidentTitle,
          is_on_route: currentData.is_on_route !== false
        }}
      />

      {/* MODAL 15 & 16: TỪ CHỐI BỒI THƯỜNG & YÊU CẦU BỔ SUNG HỒ SƠ */}
      <IncidentDecisionModals
        isRejectModalOpen={isRejectModalOpen}
        setIsRejectModalOpen={setIsRejectModalOpen}
        handleConfirmReject={handleConfirmReject}
        submitting={submitting}
        rejectionClause={rejectionClause}
        setRejectionClause={setRejectionClause}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        contactHotline={contactHotline}
        setContactHotline={setContactHotline}
        onPreviewRejectionEmail={() => {
          setEmailPreviewType('REJECTION');
          setIsEmailPreviewOpen(true);
        }}
        isRequestInfoModalOpen={isRequestInfoModalOpen}
        setIsRequestInfoModalOpen={setIsRequestInfoModalOpen}
        handleConfirmRequestMoreInfo={handleConfirmRequestMoreInfo}
        requestInfoNote={requestInfoNote}
        setRequestInfoNote={setRequestInfoNote}
      />

      {/* MODAL 2: TRÌNH XEM HỢP ĐỒNG THÔNG MINH */}
      <IncidentContractViewerModal
        open={isContractViewerOpen}
        onClose={() => setIsContractViewerOpen(false)}
        contractViewerTab={contractViewerTab}
        setContractViewerTab={setContractViewerTab}
        hasFrameworkContract={hasFrameworkContract}
        contractNumber={contractNumber}
        orderCode={orderCode}
        tripCode={tripCode}
        customerName={customerName}
        contactPerson={contactPerson}
        contactPhone={contactPhone}
        contractCap={contractCap}
        truckPlate={truckPlate}
        driverName={driverName}
        driverPhone={driverPhone}
        agreedPrice={agreedPrice}
        routeDisplay={routeDisplay}
        cargoDescription={cargoDescription}
        declaredValue={declaredValue}
        effectiveLiabilityCap={effectiveLiabilityCap}
        currentData={currentData}
      />

      {/* MODAL XEM TRƯỚC THIẾT KẾ EMAIL GỬI KHÁCH HÀNG */}
      <IncidentEmailPreviewModal
        open={isEmailPreviewOpen}
        onClose={() => setIsEmailPreviewOpen(false)}
        emailPreviewType={emailPreviewType}
        setEmailPreviewType={setEmailPreviewType}
        isReadOnly={isReadOnly}
        sendingEmail={sendingEmail}
        onSendEmail={handleSendEmailToCustomer}
        currentData={currentData}
        customerEmailDisplay={customerEmailDisplay}
        compensationAmount={compensationAmount}
        incidentCode={incidentCode}
        orderCode={orderCode}
        customerName={customerName}
        contactPerson={contactPerson}
        goodsHandlingMethod={goodsHandlingMethod}
        contractClauseRef={contractClauseRef}
        claimCode={claimCode}
        tripCode={tripCode}
        incidentTitle={incidentTitle}
        cargoDescription={cargoDescription}
        declaredValue={declaredValue}
        damagePercentage={damagePercentage}
        surveyOrgReport={surveyOrgReport}
        resolutionNote={resolutionNote}
        contactHotline={contactHotline}
        rejectionClause={rejectionClause}
        rejectionReason={rejectionReason}
      />
    </>
  );
}
