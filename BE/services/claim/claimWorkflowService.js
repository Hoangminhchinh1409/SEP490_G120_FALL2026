const prisma = require('../../config/prisma');
const cloudinaryService = require('../cloudinaryService');
const { parseOrderMeta } = require('../orderHelperService');
const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail
} = require('../emailService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../../utils/prismaHelper');
const {
  DEFAULT_CLAIM_WINDOW_DAYS,
  DEFAULT_LIABILITY_CAP,
  VALID_CLAIM_TYPES,
  DELIVERED_ORDER_STATUSES,
  INCIDENT_TYPE_DISPLAY_MAP,
  createHttpError,
  normalizeStatusKey,
  normalizeClaimType,
  parseJsonStringArray,
  getClaimWindowDays,
  uploadEvidencePhotos,
  notifyManagers,
  notifyDispatchers,
  getOrderDeliveredAt,
  parseEvidencePhotos,
  formatPublicClaim,
  getClaimRelationsInclude,
  formatDetailedClaim,
  buildOrderTokenWhere,
  getActiveContractMap,
  parseClaimIdParam
} = require('./claimHelper');

const decideClaim = async (id, payload = {}, managerId = 1) => {
  const numId = parseClaimIdParam(id);
  const [rawClaim, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findUnique({
      where: { id: BigInt(numId) },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  if (!rawClaim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường.', 404);
  }

  const currentStatus = String(rawClaim.status || '').toUpperCase();
  if (currentStatus !== 'PENDING') {
    throw createHttpError(`Yêu cầu bồi thường đang ở trạng thái ${currentStatus}, không thể xét duyệt lại.`, 400);
  }

  const rawAction = String(payload.action || '').trim().toUpperCase();
  if (rawAction !== 'APPROVE' && rawAction !== 'REJECT') {
    throw createHttpError('Hành động xét duyệt không hợp lệ (chỉ nhận APPROVE hoặc REJECT).', 400);
  }

  const isApprove = rawAction === 'APPROVE';
  const detailedBefore = formatDetailedClaim(rawClaim, activeContractMap);
  const liabilityLimit = detailedBefore.liability_limit || DEFAULT_LIABILITY_CAP;
  const now = new Date();
  const reviewerBigId = managerId ? BigInt(managerId) : null;
  const assessmentResult = payload.assessment_result ? String(payload.assessment_result).trim() : null;
  const contactHotline = payload.contact_hotline ? String(payload.contact_hotline).trim().slice(0, 20) : '1900 1234';

  let updateData;
  let emailResult = { sent: false, customer_email: detailedBefore.customer_email || null, email_type: null, error: null };

  if (isApprove) {
    const hasApprovedInput =
      payload.approved_amount !== undefined &&
      payload.approved_amount !== null &&
      String(payload.approved_amount).trim() !== '';
    const approvedAmount = hasApprovedInput ? Number(payload.approved_amount) : NaN;

    if (!hasApprovedInput || !Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      throw createHttpError('Số tiền phê duyệt bồi thường phải lớn hơn 0 VNĐ.', 400);
    }

    const commentStr = String(payload.comment || payload.resolution_note || payload.note || '').trim();
    if (approvedAmount > liabilityLimit && !commentStr) {
      throw createHttpError(
        `Số tiền duyệt (${approvedAmount.toLocaleString('vi-VN')} đ) vượt hạn mức trách nhiệm (${liabilityLimit.toLocaleString('vi-VN')} đ). Bắt buộc nhập nhận xét/lý do phê duyệt ngoại lệ (MSG56).`,
        400
      );
    }

    const damagePct =
      payload.damage_percentage !== undefined && payload.damage_percentage !== null && payload.damage_percentage !== ''
        ? Number(payload.damage_percentage)
        : null;
    const outcome = payload.outcome || payload.goods_handling_method || 'CUSTOMER_RETAIN';
    const clauseRef = payload.contract_clause_ref
      ? String(payload.contract_clause_ref).trim()
      : 'Điều 8.2 - Bồi thường thiệt hại hàng hóa';

    updateData = {
      status: 'APPROVED',
      approved_amount: BigInt(Math.round(approvedAmount)),
      outcome,
      damage_percentage: damagePct,
      assessment_result: assessmentResult,
      contract_clause_ref: clauseRef,
      contact_hotline: contactHotline,
      reviewed_by: reviewerBigId,
      reviewed_time: now,
      review_comment: commentStr || `Phê duyệt bồi thường ${Math.round(approvedAmount).toLocaleString('vi-VN')} đ theo ${clauseRef}.`,
      updated_at: now
    };
  } else {
    const rejectionReason = String(payload.rejection_reason || payload.comment || payload.note || '').trim();
    if (!rejectionReason) {
      throw createHttpError('Bắt buộc nhập lý do chi tiết khi từ chối bồi thường.', 400);
    }
    const clauseRef = payload.contract_clause_ref
      ? String(payload.contract_clause_ref).trim()
      : 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng';

    updateData = {
      status: 'REJECTED',
      approved_amount: 0n,
      rejection_reason: rejectionReason,
      assessment_result: assessmentResult,
      contract_clause_ref: clauseRef,
      contact_hotline: contactHotline,
      reviewed_by: reviewerBigId,
      reviewed_time: now,
      review_comment: String(payload.comment || rejectionReason).trim(),
      updated_at: now
    };
  }

  const updatedRow = await prisma.compensation_claims.update({
    where: { id: BigInt(numId) },
    data: updateData,
    include: getClaimRelationsInclude()
  });

  if (rawClaim.incident_id) {
    await prisma.incidents.update({
      where: { id: rawClaim.incident_id },
      data: {
        status: isApprove ? 'APPROVED' : 'REJECTED',
        approved_compensation_amount: updateData.approved_amount,
        rejection_reason: isApprove ? null : updateData.rejection_reason,
        contract_clause_ref: updateData.contract_clause_ref,
        updated_at: now
      },
      select: { id: true }
    }).catch((incErr) => {
      console.warn('[claimService] decideClaim sync incident warning:', incErr.message);
    });
  }

  const detailedAfter = formatDetailedClaim(updatedRow, activeContractMap);

  // Gửi Email thông báo quyết định cho khách hàng (không chặn transaction nếu SMTP lỗi)
  if (detailedAfter.customer_email) {
    try {
      const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
      const trackingToken = (detailedAfter.tracking_token || detailedAfter.order_code || '').trim();
      const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

      let sendRes;
      if (isApprove) {
        sendRes = await sendIncidentCompensationApprovalEmail({
          customerEmail: detailedAfter.customer_email,
          customerName: detailedAfter.customer?.company_name || 'Quý khách hàng',
          contactPerson: detailedAfter.customer?.contact_person || '',
          orderCode: detailedAfter.order_code,
          tripCode: detailedAfter.trip_code || 'N/A',
          incidentCode: detailedAfter.incident_code || detailedAfter.claim_code,
          claimCode: detailedAfter.claim_code,
          incidentType: detailedAfter.incident_type_display,
          cargoDescription: detailedAfter.cargo_description,
          declaredValue: detailedAfter.declared_value || 0,
          damagePercentage: detailedAfter.damage_percentage || 0,
          approvedAmount: detailedAfter.approved_amount || 0,
          goodsHandlingMethod: detailedAfter.outcome || 'CUSTOMER_RETAIN',
          contractClauseRef: detailedAfter.contract_clause_ref,
          resolutionNote: detailedAfter.review_comment,
          surveyOrgReport: detailedAfter.assessment_result || '',
          contactHotline: detailedAfter.contact_hotline || '1900 1234',
          trackingUrl
        });
      } else {
        sendRes = await sendIncidentCompensationRejectionEmail({
          customerEmail: detailedAfter.customer_email,
          customerName: detailedAfter.customer?.company_name || 'Quý khách hàng',
          contactPerson: detailedAfter.customer?.contact_person || '',
          orderCode: detailedAfter.order_code,
          tripCode: detailedAfter.trip_code || 'N/A',
          incidentCode: detailedAfter.incident_code || detailedAfter.claim_code,
          claimCode: detailedAfter.claim_code,
          incidentType: detailedAfter.incident_type_display,
          cargoDescription: detailedAfter.cargo_description,
          rejectionReason: detailedAfter.rejection_reason,
          rejectionClause: detailedAfter.contract_clause_ref,
          resolutionNote: detailedAfter.review_comment,
          contactHotline: detailedAfter.contact_hotline || '1900 1234',
          trackingUrl
        });
      }

      emailResult = {
        sent: Boolean(sendRes?.success),
        customer_email: detailedAfter.customer_email,
        email_type: isApprove ? 'APPROVAL' : 'REJECTION',
        preview_url: sendRes?.previewUrl || null,
        error: sendRes?.success ? null : (sendRes?.error || null)
      };
    } catch (mailErr) {
      console.warn('[claimService] decideClaim email warning:', mailErr.message);
      emailResult.error = mailErr.message;
    }
  }

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: reviewerBigId,
        actor_type: 'MANAGER',
        action: isApprove ? 'APPROVE_CLAIM' : 'REJECT_CLAIM',
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(numId),
        changes: {
          status: updateData.status,
          approved_amount: Number(updateData.approved_amount || 0),
          outcome: updateData.outcome || null,
          contract_clause_ref: updateData.contract_clause_ref,
          email_sent: emailResult.sent
        },
        reason: String(updateData.review_comment || '').slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] decideClaim activity_logs warning:', logErr.message);
  }

  // Nhắc Điều phối viên gọi điện thông báo khách hàng & ghi nhận cuộc gọi (BF-04)
  await notifyDispatchers({
    claimId: numId,
    message: isApprove
      ? `[${detailedAfter.claim_code}] Quản lý đã PHÊ DUYỆT bồi thường ${detailedAfter.approved_amount.toLocaleString('vi-VN')} đ cho đơn ${detailedAfter.order_code}. Vui lòng gọi điện khách hàng (${detailedAfter.contact_phone || 'chưa có SĐT'}) và ghi nhận cuộc gọi để mở khóa thanh toán.`
      : `[${detailedAfter.claim_code}] Quản lý đã TỪ CHỐI bồi thường cho đơn ${detailedAfter.order_code}. Vui lòng gọi điện thông báo lý do cho khách hàng (${detailedAfter.contact_phone || 'chưa có SĐT'}) và ghi nhận cuộc gọi để đóng hồ sơ.`
  });

  return { claim: detailedAfter, email_result: emailResult };
};

/**
 * Dispatcher gọi điện thông báo khách hàng & ghi nhận cuộc gọi (BF-04)
 * - Nếu REJECTED -> tự động đóng sang CLOSED_REJECTED (close_method = REJECTED_AFTER_CALL)
 * - Nếu APPROVED -> giữ APPROVED với called_at != null để mở khóa bước Manager Record Payment
 */
const recordDispatcherCall = async (id, payload = {}, dispatcherId = 1) => {
  const numId = parseClaimIdParam(id);
  const [rawClaim, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findUnique({
      where: { id: BigInt(numId) },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  if (!rawClaim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường.', 404);
  }

  const currentStatus = String(rawClaim.status || '').toUpperCase();
  if (currentStatus !== 'APPROVED' && currentStatus !== 'REJECTED') {
    throw createHttpError(
      `Chỉ có thể ghi nhận cuộc gọi khi yêu cầu bồi thường đang ở trạng thái APPROVED hoặc REJECTED (hiện tại: ${currentStatus}).`,
      400
    );
  }

  if (rawClaim.called_at) {
    throw createHttpError('Cuộc gọi thông báo khách hàng cho yêu cầu này đã được ghi nhận trước đó.', 400);
  }

  const callNote = String(payload.call_note || payload.reason || payload.note || '').trim();
  if (!callNote) {
    throw createHttpError('Vui lòng nhập nội dung trao đổi / lý do ghi nhận cuộc gọi với khách hàng.', 400);
  }

  const contactPhone = String(
    payload.call_contact_phone ||
    payload.contact_phone ||
    rawClaim.submitted_by_phone ||
    rawClaim.orders?.customers?.phone ||
    rawClaim.orders?.receiver_phone ||
    ''
  ).trim().slice(0, 30) || null;

  const now = new Date();
  const actorBigId = toBigInt(dispatcherId || 1);
  const isRejected = currentStatus === 'REJECTED';

  const updateData = {
    called_by: actorBigId,
    called_at: now,
    call_note: callNote,
    call_contact_phone: contactPhone,
    updated_at: now,
    ...(isRejected ? {
      status: 'CLOSED_REJECTED',
      closed_at: now,
      close_method: 'REJECTED_AFTER_CALL'
    } : {})
  };

  const updatedRow = await prisma.compensation_claims.update({
    where: { id: BigInt(numId) },
    data: updateData,
    include: getClaimRelationsInclude()
  });

  if (isRejected && rawClaim.incident_id) {
    await prisma.incidents.update({
      where: { id: rawClaim.incident_id },
      data: {
        status: 'CLOSED',
        closed_by: actorBigId,
        closed_at: now,
        updated_at: now
      },
      select: { id: true }
    }).catch((err) => {
      console.warn('[claimService] recordDispatcherCall sync incident warning:', err.message);
    });
  }

  const detailedAfter = formatDetailedClaim(updatedRow, activeContractMap);

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: actorBigId,
        actor_type: 'DISPATCHER',
        action: isRejected ? 'RECORD_CALL_CLOSE_REJECTED' : 'RECORD_CALL_UNLOCK_PAYMENT',
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(numId),
        changes: {
          status: detailedAfter.status,
          call_contact_phone: contactPhone,
          called_at: now.toISOString(),
          close_method: detailedAfter.close_method || null
        },
        reason: callNote.slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] recordDispatcherCall activity_logs warning:', logErr.message);
  }

  await notifyManagers({
    claimId: numId,
    claimCode: detailedAfter.claim_code,
    orderCode: detailedAfter.order_code,
    sourceLabel: 'Điều phối viên',
    customMessage: isRejected
      ? `[${detailedAfter.claim_code}] ĐPV đã gọi điện thông báo từ chối cho khách (${contactPhone || 'N/A'}) và đóng hồ sơ (CLOSED_REJECTED).`
      : `[${detailedAfter.claim_code}] ĐPV đã gọi điện thống nhất bồi thường với khách (${contactPhone || 'N/A'}). Quản lý có thể tiến hành ghi nhận thanh toán.`
  });

  return detailedAfter;
};

/**
 * Manager ghi nhận đã thanh toán tiền bồi thường & chứng từ chuyển khoản (BF-04)
 * Yêu cầu Claim đang APPROVED và Dispatcher đã ghi nhận cuộc gọi (called_at != null)
 */
const recordManagerPayment = async (id, payload = {}, managerId = 1) => {
  const numId = parseClaimIdParam(id);
  const [rawClaim, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findUnique({
      where: { id: BigInt(numId) },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  if (!rawClaim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường.', 404);
  }

  const currentStatus = String(rawClaim.status || '').toUpperCase();
  if (currentStatus !== 'APPROVED') {
    throw createHttpError(
      `Chỉ có thể ghi nhận thanh toán khi yêu cầu bồi thường ở trạng thái APPROVED (hiện tại: ${currentStatus}).`,
      400
    );
  }

  if (!rawClaim.called_at) {
    throw createHttpError(
      'Điều phối viên chưa ghi nhận cuộc gọi thông báo khách hàng. Cần hoàn tất bước gọi khách trước khi ghi nhận thanh toán.',
      400
    );
  }

  const transactionCode = String(payload.transaction_code || '').trim();
  if (!transactionCode) {
    throw createHttpError('Vui lòng nhập mã giao dịch ngân hàng (UNC).', 400);
  }

  const rawProof = String(payload.payment_proof_url || '').trim();
  if (!rawProof) {
    throw createHttpError('Vui lòng tải lên ảnh biên lai / chứng từ chuyển khoản.', 400);
  }

  const uploadedProofUrl = await cloudinaryService.uploadDataUriIfNeeded(rawProof, 'nexlog/claims');
  const now = new Date();
  let parsedPaymentDate = now;
  if (payload.payment_date) {
    const candidate = new Date(
      String(payload.payment_date).includes('T')
        ? payload.payment_date
        : `${String(payload.payment_date).trim()}T00:00:00.000Z`
    );
    if (!Number.isNaN(candidate.getTime())) {
      parsedPaymentDate = candidate;
    }
  }
  const paymentNote = payload.payment_note ? String(payload.payment_note).trim() : null;
  const actorBigId = BigInt(managerId || 1);

  const updatedRow = await prisma.compensation_claims.update({
    where: { id: BigInt(numId) },
    data: {
      status: 'PAID',
      paid_by: actorBigId,
      paid_at: now,
      payment_date: parsedPaymentDate,
      transaction_code: transactionCode.slice(0, 100),
      payment_proof_url: uploadedProofUrl,
      payment_note: paymentNote,
      updated_at: now
    },
    include: getClaimRelationsInclude()
  });

  if (rawClaim.incident_id) {
    await prisma.incidents.update({
      where: { id: rawClaim.incident_id },
      data: {
        status: 'PAID',
        payment_proof_url: uploadedProofUrl,
        updated_at: now
      },
      select: { id: true }
    }).catch((err) => {
      console.warn('[claimService] recordManagerPayment sync incident warning:', err.message);
    });
  }

  const detailedAfter = formatDetailedClaim(updatedRow, activeContractMap);

  let emailResult = { sent: false, customer_email: detailedAfter.customer_email || null, email_type: 'PAYMENT_RECORDED', error: null };
  if (detailedAfter.customer_email) {
    try {
      const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
      const trackingToken = (detailedAfter.tracking_token || detailedAfter.order_code || '').trim();
      const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

      const sendRes = await sendClaimPaymentRecordedEmail({
        customerEmail: detailedAfter.customer_email,
        customerName: detailedAfter.customer?.company_name || 'Quý khách hàng',
        contactPerson: detailedAfter.customer?.contact_person || '',
        orderCode: detailedAfter.order_code,
        claimCode: detailedAfter.claim_code,
        approvedAmount: detailedAfter.approved_amount || detailedAfter.amount || 0,
        paymentDate: detailedAfter.payment_date || formatDateOnly(now),
        transactionCode: detailedAfter.transaction_code,
        paymentProofUrl: detailedAfter.payment_proof_url,
        paymentNote: detailedAfter.payment_note,
        contactHotline: detailedAfter.contact_hotline || '1900 1234',
        trackingUrl
      });

      emailResult = {
        sent: Boolean(sendRes?.success),
        customer_email: detailedAfter.customer_email,
        email_type: 'PAYMENT_RECORDED',
        preview_url: sendRes?.previewUrl || null,
        error: sendRes?.success ? null : (sendRes?.error || null)
      };
    } catch (mailErr) {
      console.warn('[claimService] recordManagerPayment email warning:', mailErr.message);
      emailResult.error = mailErr.message;
    }
  }

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: actorBigId,
        actor_type: 'MANAGER',
        action: 'RECORD_CLAIM_PAYMENT',
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(numId),
        changes: {
          status: 'PAID',
          transaction_code: detailedAfter.transaction_code,
          payment_date: detailedAfter.payment_date,
          payment_proof_url: uploadedProofUrl,
          email_sent: emailResult.sent
        },
        reason: (paymentNote || `Đã chi trả bồi thường, Mã GD: ${transactionCode}`).slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] recordManagerPayment activity_logs warning:', logErr.message);
  }

  await notifyDispatchers({
    claimId: numId,
    message: `[${detailedAfter.claim_code}] Quản lý đã ghi nhận chuyển khoản bồi thường (Mã GD: ${detailedAfter.transaction_code}) cho đơn ${detailedAfter.order_code}. Đang chờ khách hàng xác nhận nhận tiền (tự đóng sau 7 ngày).`
  });

  return { claim: detailedAfter, email_result: emailResult };
};

/**
 * Khách hàng xác nhận đã nhận tiền bồi thường trên Tracking Page (BF-04)
 * Chuyển trạng thái PAID -> CLOSED_COMPENSATED (close_method = CUSTOMER_CONFIRMED)
 */
const confirmCustomerMoneyReceived = async (token, payload = {}) => {
  const whereFilter = buildOrderTokenWhere(token);
  if (!whereFilter) {
    throw createHttpError('Thiếu mã tra cứu đơn hàng.', 400);
  }

  const order = await prisma.orders.findFirst({
    where: whereFilter,
    select: { id: true, order_code: true }
  });

  if (!order) {
    throw createHttpError('Không tìm thấy đơn hàng tương ứng với mã tra cứu này.', 404);
  }

  let claim = null;
  if (payload?.claim_id !== undefined && payload?.claim_id !== null && String(payload.claim_id).trim() !== '') {
    const claimIdNum = parseClaimIdParam(payload.claim_id);
    claim = await prisma.compensation_claims.findFirst({
      where: {
        id: BigInt(claimIdNum),
        order_id: order.id
      }
    });
  } else {
    claim = await prisma.compensation_claims.findFirst({
      where: {
        order_id: order.id,
        status: 'PAID'
      },
      orderBy: { id: 'desc' }
    });
  }

  if (!claim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường phù hợp của đơn hàng này.', 404);
  }

  const statusUpper = String(claim.status || '').toUpperCase();
  if (statusUpper === 'CLOSED_COMPENSATED') {
    throw createHttpError('Yêu cầu bồi thường này đã được xác nhận nhận tiền và đóng hồ sơ trước đó.', 400);
  }
  if (statusUpper !== 'PAID') {
    throw createHttpError('Chỉ có thể xác nhận đã nhận tiền khi Quản lý đã ghi nhận thanh toán.', 400);
  }

  const now = new Date();
  const updatedRow = await prisma.compensation_claims.update({
    where: { id: claim.id },
    data: {
      status: 'CLOSED_COMPENSATED',
      customer_confirmed_at: now,
      closed_at: now,
      close_method: 'CUSTOMER_CONFIRMED',
      updated_at: now
    }
  });

  if (claim.incident_id) {
    await prisma.incidents.update({
      where: { id: claim.incident_id },
      data: {
        status: 'DONE',
        closed_at: now,
        updated_at: now
      },
      select: { id: true }
    }).catch((err) => {
      console.warn('[claimService] confirmCustomerMoneyReceived sync incident warning:', err.message);
    });
  }

  const publicClaim = formatPublicClaim(updatedRow);

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: null,
        actor_type: 'GUEST',
        action: 'GUEST_CONFIRM_MONEY_RECEIVED',
        target_type: 'COMPENSATION_CLAIM',
        target_id: claim.id,
        changes: {
          status: 'CLOSED_COMPENSATED',
          close_method: 'CUSTOMER_CONFIRMED',
          customer_confirmed_at: now.toISOString()
        },
        reason: `Khách hàng xác nhận đã nhận tiền bồi thường trên Tracking Page (${publicClaim.claim_code}).`,
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] confirmCustomerMoneyReceived activity_logs warning:', logErr.message);
  }

  const notifyMsg = `[${publicClaim.claim_code}] Khách hàng đã XÁC NHẬN ĐÃ NHẬN TIỀN bồi thường cho đơn ${order.order_code}. Hồ sơ đã đóng (CLOSED_COMPENSATED).`;
  await Promise.all([
    notifyManagers({
      claimId: publicClaim.id,
      claimCode: publicClaim.claim_code,
      orderCode: order.order_code,
      sourceLabel: 'Khách hàng',
      customMessage: notifyMsg
    }),
    notifyDispatchers({
      claimId: publicClaim.id,
      message: notifyMsg
    })
  ]);

  return publicClaim;
};

/**
 * Tự động đóng các Claim đã chi trả (PAID) quá 7 ngày mà khách chưa xác nhận (BF-04)
 */
const autoCloseOverduePaidClaims = async ({ now = new Date(), autoCloseDays = 7 } = {}) => {
  const cutoff = new Date(now.getTime() - autoCloseDays * 86400000);
  const overdueClaims = await prisma.compensation_claims.findMany({
    where: {
      status: { in: ['PAID', 'Paid'] },
      customer_confirmed_at: null,
      paid_at: { lte: cutoff }
    },
    include: {
      orders: { select: { order_code: true } }
    }
  });

  if (!overdueClaims || overdueClaims.length === 0) {
    return { closedCount: 0, closedClaimIds: [] };
  }

  const closedClaimIds = [];

  for (const claim of overdueClaims) {
    const idNum = toNum(claim.id);
    const claimCode = `CLM-${String(idNum).padStart(4, '0')}`;
    const orderCode = claim.orders?.order_code || `ORDER-${toNum(claim.order_id)}`;

    await prisma.compensation_claims.update({
      where: { id: claim.id },
      data: {
        status: 'CLOSED_COMPENSATED',
        closed_at: now,
        close_method: 'AUTO_7_DAYS',
        updated_at: now
      }
    });

    if (claim.incident_id) {
      await prisma.incidents.update({
        where: { id: claim.incident_id },
        data: {
          status: 'DONE',
          closed_at: now,
          updated_at: now
        },
        select: { id: true }
      }).catch((err) => {
        console.warn('[claimService] autoCloseOverduePaidClaims sync incident warning:', err.message);
      });
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: null,
          actor_type: 'SYSTEM',
          action: 'AUTO_CLOSE_CLAIM_7_DAYS',
          target_type: 'COMPENSATION_CLAIM',
          target_id: claim.id,
          changes: {
            status: 'CLOSED_COMPENSATED',
            close_method: 'AUTO_7_DAYS',
            paid_at: claim.paid_at ? new Date(claim.paid_at).toISOString() : null,
            closed_at: now.toISOString()
          },
          reason: `Tự động đóng hồ sơ bồi thường ${claimCode} sau ${autoCloseDays} ngày không có phản hồi từ khách hàng (BF-04).`,
          created_time: now
        }
      });
    } catch (logErr) {
      console.warn('[claimService] autoCloseOverduePaidClaims activity_logs warning:', logErr.message);
    }

    const msg = `[${claimCode}] Hệ thống đã tự động đóng hồ sơ bồi thường đơn ${orderCode} (CLOSED_COMPENSATED · AUTO_7_DAYS) sau ${autoCloseDays} ngày khách không phản hồi.`;
    await Promise.all([
      notifyManagers({
        claimId: idNum,
        claimCode,
        orderCode,
        sourceLabel: 'Hệ thống',
        customMessage: msg
      }),
      notifyDispatchers({
        claimId: idNum,
        message: msg
      })
    ]);

    closedClaimIds.push(idNum);
  }

  return { closedCount: closedClaimIds.length, closedClaimIds };
};

/**
 * Lấy danh sách order_id & trip_id đang có Claim chưa đóng để bảo lưu dữ liệu (Keep Trip Data - JOB-01)
 */
const getProtectedClaimOrderAndTripIds = async () => {
  const openClaims = await prisma.compensation_claims.findMany({
    where: {
      status: { notIn: ['CLOSED_COMPENSATED', 'CLOSED_REJECTED', 'CLOSED', 'Closed'] }
    },
    select: {
      order_id: true,
      incident_id: true,
      incidents: { select: { trip_id: true } }
    }
  });

  const orderIdSet = new Set();
  const tripIdSet = new Set();

  for (const c of openClaims || []) {
    const oId = toNum(c.order_id);
    if (oId) orderIdSet.add(oId);
    const tId = toNum(c.incidents?.trip_id);
    if (tId) tripIdSet.add(tId);
  }

  const protectedOrderIds = Array.from(orderIdSet);
  if (protectedOrderIds.length > 0) {
    const stops = await prisma.trip_stops.findMany({
      where: {
        order_id: { in: protectedOrderIds.map((id) => BigInt(id)) }
      },
      select: { trip_id: true }
    });
    for (const s of stops || []) {
      const tId = toNum(s.trip_id);
      if (tId) tripIdSet.add(tId);
    }
  }

  return {
    protectedOrderIds,
    protectedTripIds: Array.from(tripIdSet)
  };
};


module.exports = {
  decideClaim,
  recordDispatcherCall,
  recordManagerPayment,
  confirmCustomerMoneyReceived,
  autoCloseOverduePaidClaims,
  getProtectedClaimOrderAndTripIds
};
