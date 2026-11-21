/**
 * Incident Compensation Helper & Business Rules (Manager Screen 14)
 * Bao gồm 4 Module nghiệp vụ cốt lõi:
 * 1. CompensationCalculationModule
 * 2. DecisionValidationModule
 * 3. IncidentLifecycleModule
 * 4. DecisionPayloadBuilderModule
 */

// ==========================================
// 1. MODULE: CompensationCalculationModule
// ==========================================

/**
 * Method 1.1: Tính toán tiền bồi thường đề xuất, làm tròn đến hàng trăm nghìn và áp trần HĐ
 * @param {Object} params
 * @param {number} params.declaredValue - Giá trị khai báo lô hàng (VNĐ)
 * @param {number} params.damagePercentage - Tỷ lệ hư hỏng (0 - 100)
 * @param {'CUSTOMER_RETAIN'|'COMPANY_RECOVERY'} params.handlingMethod - Phương án xử lý
 * @param {number} params.liabilityCap - Trần hạn mức trách nhiệm của Hợp đồng
 * @returns {number} Số tiền bồi thường hợp lệ (VNĐ)
 */
export function calculateAutoCompensation({
  declaredValue = 0,
  damagePercentage = 0,
  handlingMethod = 'CUSTOMER_RETAIN',
  liabilityCap = 500000000
} = {}) {
  const decVal = Number(declaredValue) || 0;
  const pct = Math.max(0, Math.min(100, Number(damagePercentage) || 0));
  const cap = Number(liabilityCap) || 500000000;

  if (decVal <= 0 || pct <= 0) {
    return 0;
  }

  if (handlingMethod === 'COMPANY_RECOVERY') {
    // Thu hồi hàng thanh lý -> Đền bù 100% giá trị khai báo, khống chế bởi trần HĐ
    return Math.min(decVal, cap);
  }

  // Khách giữ lại hàng hỏng -> Đền bù theo tỷ lệ hư hỏng thực tế làm tròn đến 100.000đ
  const calculated = Math.round((decVal * (pct / 100)) / 100000) * 100000;
  return Math.min(calculated, cap);
}

/**
 * Method 1.2a: Nhận diện đơn hàng có Hợp đồng khung đối tác dài hạn hay là khách vãng lai
 * @param {Object} params
 * @param {Object} params.order - Đơn hàng
 * @param {Object} params.contract - Hợp đồng
 * @returns {boolean}
 */
export function checkHasFrameworkContract({ order, contract } = {}) {
  return Boolean(
    order?.contract_id ||
    contract?.id ||
    (contract?.contract_number &&
      !contract.contract_number.includes('VÃNG-LAI') &&
      !contract.contract_number.includes(order?.order_code))
  );
}

/**
 * Method 1.2: Xác định hạn mức bồi thường áp dụng (Hợp đồng khung vs Khách vãng lai)
 * @param {Object} params
 * @param {Object} params.order - Đơn hàng
 * @param {Object} params.contract - Hợp đồng
 * @returns {number} Hạn mức trách nhiệm áp dụng (VNĐ)
 */
export function getEffectiveLiabilityCap({ order, contract } = {}) {
  const hasFramework = checkHasFrameworkContract({ order, contract });
  if (hasFramework && contract?.liability_cap) {
    return Number(contract.liability_cap);
  }
  return 500000000; // Hạn mức mặc định 500M cho khách vãng lai
}

// ==========================================
// 2. MODULE: DecisionValidationModule
// ==========================================

/**
 * Method 2.1: Validate khi Manager phê duyệt bồi thường (APPROVE)
 * @param {Object} params
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateApprovalDecision({ fault, resolutionNote, compensationAmount } = {}) {
  if (!fault || !String(fault).trim()) {
    return { isValid: false, error: 'Vui lòng xác định bên chịu trách nhiệm lỗi!' };
  }
  if (!resolutionNote || !String(resolutionNote).trim()) {
    return { isValid: false, error: 'Vui lòng nhập nhận xét & căn cứ giải quyết!' };
  }
  if (compensationAmount !== undefined && Number(compensationAmount) < 0) {
    return { isValid: false, error: 'Số tiền bồi thường không thể âm!' };
  }
  return { isValid: true };
}

/**
 * Method 2.2: Validate khi Manager từ chối bồi thường (REJECT)
 * @param {Object} params
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateRejectionDecision({ rejectionReason, rejectionClause } = {}) {
  if (!rejectionReason || !String(rejectionReason).trim()) {
    return { isValid: false, error: 'Vui lòng nhập lý do từ chối bồi thường chi tiết!' };
  }
  if (!rejectionClause || !String(rejectionClause).trim()) {
    return { isValid: false, error: 'Vui lòng viện dẫn điều khoản hợp đồng áp dụng!' };
  }
  return { isValid: true };
}

/**
 * Method 2.3: Validate khi Manager ghi nhận chi tiền và tải biên lai (RECORD_PAYMENT)
 * @param {Object} params
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validatePaymentRecording({ transactionCode, paymentProofUrl } = {}) {
  if (!transactionCode || !String(transactionCode).trim()) {
    return { isValid: false, error: 'Vui lòng nhập Mã giao dịch ngân hàng!' };
  }
  if (!paymentProofUrl || !String(paymentProofUrl).trim()) {
    return { isValid: false, error: 'Vui lòng nhập link ảnh hoặc tải biên lai chuyển khoản!' };
  }
  return { isValid: true };
}

/**
 * Method 2.4: Validate khi Manager yêu cầu bổ sung hồ sơ (REQUEST_MORE_INFO)
 * @param {Object} params
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateRequestMoreInfo({ requestInfoNote } = {}) {
  if (!requestInfoNote || !String(requestInfoNote).trim()) {
    return { isValid: false, error: 'Vui lòng ghi rõ nội dung hoặc giấy tờ cần bổ sung!' };
  }
  return { isValid: true };
}

// ==========================================
// 3. MODULE: IncidentLifecycleModule
// ==========================================

/**
 * Method 3.1: Xác định cờ trạng thái vòng đời của hồ sơ sự cố
 * @param {Object} incident
 * @returns {Object}
 */
export function determineIncidentStatus(incident = {}) {
  const rawStatus = (incident.status || incident.raw_status || '').toUpperCase();
  const isRejected =
    Boolean(incident.rejection_reason) ||
    rawStatus === 'REJECTED' ||
    String(incident.claim_status || '').toUpperCase() === 'REJECTED' ||
    Boolean(incident.resolution_note && String(incident.resolution_note).includes('Từ chối bồi thường'));
  const isPaymentClosed =
    rawStatus === 'DONE' ||
    rawStatus === 'CLOSED' ||
    rawStatus === 'RESOLVED' ||
    Boolean(incident.closed_at) ||
    Boolean(incident.payment_proof_url) ||
    Boolean(incident.transaction_code);
  const isDone = isRejected || isPaymentClosed;
  const isApproved =
    !isDone &&
    (rawStatus === 'APPROVED' || (Number(incident.approved_compensation_amount) > 0 && !isDone));
  const isPending = !isDone && !isApproved;

  let badge = { color: 'orange', label: 'Chờ Quản lý xét duyệt' };
  if (isApproved) {
    badge = { color: 'cyan', label: 'Đã duyệt · Chờ chi trả' };
  } else if (isDone) {
    badge = isRejected
      ? { color: 'red', label: 'Đã từ chối bồi thường (Đóng)' }
      : { color: 'green', label: 'Đã hoàn tất (Đóng)' };
  }

  return {
    isPending,
    isApproved,
    isRejected,
    isPaymentClosed,
    isDone,
    badge
  };
}

/**
 * Method 3.2: Kiểm tra điều kiện tiên quyết cho phép thực hiện hành động
 * @param {Object} params
 * @returns {boolean}
 */
export function canPerformAction({ currentStatus, action, isReadOnly = false } = {}) {
  if (isReadOnly) return false;

  const status = (currentStatus || '').toUpperCase();
  const act = (action || '').toUpperCase();

  // Hồ sơ đã DONE/CLOSED/RESOLVED/REJECTED không được thao tác thêm
  if (status === 'DONE' || status === 'CLOSED' || status === 'REJECTED' || status === 'RESOLVED') {
    return false;
  }

  if (status === 'PENDING_APPROVAL' || status === 'REPORTED' || status === 'ESCALATED') {
    if (['APPROVE', 'REJECT', 'REQUEST_MORE_INFO'].includes(act)) {
      return true;
    }
    // Chưa duyệt thì không thể chi tiền
    if (act === 'RECORD_PAYMENT' || act === 'CLOSE') {
      return false;
    }
  }

  if (status === 'APPROVED') {
    if (act === 'RECORD_PAYMENT' || act === 'CLOSE') {
      return true;
    }
    // Đã duyệt rồi không thể duyệt lại hoặc từ chối lại
    if (['APPROVE', 'REJECT'].includes(act)) {
      return false;
    }
  }

  return false;
}

// ==========================================
// 4. MODULE: DecisionPayloadBuilderModule
// ==========================================

/**
 * Method 4.1: Đóng gói payload cho quyết định Phê duyệt (APPROVE)
 * @param {Object} params
 * @returns {Object}
 */
export function buildApprovalPayload({
  fault,
  compensationAmount,
  damagePercentage,
  goodsHandlingMethod,
  contractClauseRef,
  surveyOrgReport,
  resolutionNote
} = {}) {
  return {
    action: 'APPROVE',
    fault,
    approved_amount: Number(compensationAmount) || 0,
    damage_percentage: Number(damagePercentage) || 0,
    goods_handling_method: goodsHandlingMethod,
    contract_clause_ref: contractClauseRef,
    survey_org_report: surveyOrgReport,
    resolution_note: String(resolutionNote || '').trim()
  };
}

/**
 * Method 4.2: Đóng gói payload cho quyết định Từ chối (REJECT)
 * @param {Object} params
 * @returns {Object}
 */
export function buildRejectionPayload({
  rejectionReason,
  rejectionClause,
  contactHotline
} = {}) {
  const reason = String(rejectionReason || '').trim();
  const clause = String(rejectionClause || '').trim();
  const hotline = String(contactHotline || '').trim();

  return {
    action: 'REJECT',
    fault: 'CUSTOMER',
    rejection_reason: reason,
    contract_clause_ref: clause,
    contact_hotline: hotline,
    resolution_note: `Từ chối bồi thường theo ${clause}. Lý do: ${reason}`
  };
}

/**
 * Method 4.3: Đóng gói payload cho việc Chi tiền & Đóng hồ sơ (CLOSE)
 * @param {Object} params
 * @returns {Object}
 */
export function buildPaymentClosingPayload({
  paymentDate,
  transactionCode,
  paymentProofUrl,
  approvedAmount
} = {}) {
  const date = paymentDate || new Date().toISOString().split('T')[0];
  const tx = String(transactionCode || '').trim();
  const proof = String(paymentProofUrl || '').trim();

  return {
    payment_date: date,
    transaction_code: tx,
    payment_proof_url: proof,
    ...(approvedAmount !== undefined ? { approved_amount: Number(approvedAmount) || 0 } : {}),
    close_note: `Đã hoàn tất chi tiền ngày ${date}. Mã GD: ${tx}`
  };
}
