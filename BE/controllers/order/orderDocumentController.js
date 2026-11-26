const prisma = require('../../config/prisma');
const {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail
} = require('../../services/emailService');
const { parseOrderMeta, saveOrderMeta } = require('../../services/orderHelperService');
const {
  resolveFrontendBaseUrl,
  serializeOrderWithAliases,
  normalizeOrderDocAttachments,
  findOrderByIdentifier
} = require('./orderDocumentHelper');
const {
  uploadContractFile,
  sendContractToCustomer,
  confirmHardcopyContractReceived,
  issueInvoiceToAccounting
} = require('./orderContractInvoiceController');

// 4. CẬP NHẬT GIÁ CƯỚC THỎA THUẬN (VÀ TỰ ĐỘNG GỬI EMAIL XÁC NHẬN CHO KHÁCH HÀNG NẾU LÀ ĐƠN WEB)
const updateAgreedPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price, adjustment_reason, proposed_vehicle_type, vehicle_analysis_note } = req.body;

    const numPrice = parseInt(agreed_price, 10);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ message: 'Giá cước không hợp lệ (phải > 0 VNĐ)' });
    }

    const currentOrder = await findOrderByIdentifier(id, true);

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    if (
      currentOrder.status === 'CLOSED' ||
      currentOrder.status === 'CANCELLED' ||
      currentOrder.is_closed ||
      currentOrder.cancellation_reason
    ) {
      return res.status(400).json({ message: 'Đơn hàng đã bị hủy hoặc đã đóng, không thể sửa giá cước!' });
    }

    // Cập nhật meta workflow
    const meta = parseOrderMeta(currentOrder);
    if (!meta.web_workflow) {
      meta.web_workflow = {};
    }

    const cleanReason = (adjustment_reason || '').toString().trim();
    const finalVehicleType = proposed_vehicle_type || meta.web_workflow.proposed_vehicle_type || currentOrder.truck_type_requested || 'TRUCK_2.5T';
    const cleanVehicleNote = (vehicle_analysis_note || '').toString().trim();

    meta.web_workflow.stage = 'PRICE_AGREED_BY_DISPATCHER';
    meta.web_workflow.agreed_price = numPrice;
    meta.web_workflow.proposed_vehicle_type = finalVehicleType;
    meta.proposed_vehicle_type = finalVehicleType;
    if (cleanVehicleNote) {
      meta.web_workflow.vehicle_analysis_note = cleanVehicleNote;
      meta.vehicle_analysis_note = cleanVehicleNote;
    }
    if (cleanReason) {
      meta.web_workflow.adjustment_reason = cleanReason;
      meta.web_workflow.adjusted_at = new Date().toISOString();
    }

    // Cập nhật giá thỏa thuận & loại xe đề xuất vào DB
    let updatedPriceRow;
    try {
      updatedPriceRow = await prisma.orders.update({
        where: { id: BigInt(currentOrder.id) },
        data: {
          agreed_price: numPrice,
          truck_type_requested: finalVehicleType,
          updated_at: new Date()
        }
      });
    } catch (error) {
      console.error('updateAgreedPrice Error:', error);
      return res.status(500).json({ message: 'Không thể cập nhật giá cước', error: error.message });
    }
    const updatedOrder = serializeOrderWithAliases(updatedPriceRow);

    await saveOrderMeta(currentOrder.id, meta);

    // NẾU LÀ ĐƠN TỪ WEB (HOMEPAGE) HOẶC CÓ EMAIL KHÁCH HÀNG -> TỰ ĐỘNG GỬI GMAIL CHO KHÁCH KÈM LINK XÁC NHẬN
    const targetEmail =
      meta.customer_email ||
      currentOrder.customer?.email ||
      meta.accounting_email ||
      null;
    const isWebOrder = Boolean(
      targetEmail ||
      currentOrder.source === 'Web' ||
      currentOrder.source === 'HOMEPAGE'
    );

    let emailResult = null;
    let confirmUrl = null;
    if (targetEmail) {
      const token = (currentOrder.tracking_token || currentOrder.order_code || '').trim();
      const frontendBaseUrl = resolveFrontendBaseUrl(req);
      confirmUrl = `${frontendBaseUrl}/customer/order-confirmation/${token}`;

      const orderType = currentOrder.order_type || meta.shipping_direction || 'Export';
      const isExport =
        orderType.toUpperCase().includes('EXPORT') ||
        orderType.toUpperCase().includes('XUẤT');

      const pickupDate = isExport
        ? (currentOrder.requested_pickup_date || meta.export_pickup_suggestion || 'Theo thỏa thuận')
        : (meta.flight_arrival_date
          ? `${meta.flight_arrival_date} ${meta.flight_arrival_time || ''}`.trim()
          : (currentOrder.requested_pickup_date || 'Ngay khi dỡ máy bay'));

      const flightSchedule = isExport
        ? (meta.flight_datetime || 'Chờ cập nhật')
        : (meta.flight_arrival_date
          ? `${meta.flight_arrival_date} (${meta.flight_arrival_time || 'Giờ bay'})`
          : 'Chờ thông báo');

      const cargoObj = Array.isArray(currentOrder.order_cargos)
        ? currentOrder.order_cargos[0]
        : currentOrder.order_cargos;
      const cargoDescription =
        cargoObj?.cargo_name ||
        currentOrder.cargo_description ||
        'Hàng bách hóa / Linh kiện';

      const dispPhone =
        req.body?.dispatcher_phone ||
        currentOrder.responsible_dispatcher?.phone ||
        meta.dispatcher_phone ||
        '0988 123 456';
      const dispZalo =
        req.body?.dispatcher_zalo ||
        currentOrder.responsible_dispatcher?.zalo_link ||
        meta.dispatcher_zalo ||
        (dispPhone ? `https://zalo.me/${dispPhone.replace(/[^0-9]/g, '')}` : 'https://zalo.me/0988123456');

      emailResult = await sendOrderPriceConfirmationEmail({
        customerEmail: targetEmail,
        customerName: currentOrder.customer?.company_name || currentOrder.receiver_name || 'Quý khách',
        orderCode: currentOrder.order_code,
        orderType,
        agreedPrice: numPrice,
        pickupAddress:
          currentOrder.pickup_location?.address ||
          currentOrder.pickup_location?.name ||
          'Hà Nội',
        deliveryAddress:
          currentOrder.delivery_location?.address ||
          currentOrder.delivery_location?.name ||
          'Bắc Ninh',
        cargoDescription,
        pickupDate,
        flightSchedule,
        confirmUrl,
        dispatcherPhone: dispPhone,
        dispatcherZalo: dispZalo
      });
    }

    return res.json({
      message: cleanReason
        ? `Đã chốt lại giá ${numPrice.toLocaleString('vi-VN')} VNĐ (Lý do: ${cleanReason}) và gửi lại báo giá cho khách hàng!`
        : isWebOrder
          ? `Đã chốt giá ${numPrice.toLocaleString('vi-VN')} VNĐ và tự động gửi email xác nhận kèm link tới khách hàng (${targetEmail || 'N/A'})!`
          : 'Cập nhật giá thỏa thuận thành công!',
      email_sent: emailResult?.success || false,
      email_preview_url: emailResult?.previewUrl || null,
      confirm_url: confirmUrl,
      web_workflow: meta.web_workflow,
      order: updatedOrder
    });
  } catch (err) {
    console.error('updateAgreedPrice Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.2. API CHO KHÁCH HÀNG: ĐỒNG Ý CHỐT ĐƠN, PHƯƠNG ÁN XE VÀ GIÁ CƯỚC (CHUYỂN SANG BƯỚC UPLOAD CHỨNG TỪ)
const customerAgreeOrderPrice = async (req, res) => {
  try {
    const { token } = req.params;
    const order = await findOrderByIdentifier(token, false);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // BUG-SYS-08: Chỉ cho phép khách xác nhận đồng ý khi đơn đang ở DRAFT/PENDING và đã có giá cước thỏa thuận > 0
    const currentSt = String(order.status || '').trim().toUpperCase();
    if (!['DRAFT', 'PENDING', 'QUOTED'].includes(currentSt)) {
      return res.status(400).json({
        message: `Đơn hàng đang ở trạng thái ${order.status}, không thể xác nhận chốt giá lại.`
      });
    }
    if (!order.agreed_price || Number(order.agreed_price) <= 0) {
      return res.status(400).json({
        message: 'Đơn hàng chưa có giá cước thỏa thuận từ Điều phối viên nên chưa thể xác nhận.'
      });
    }

    const meta = parseOrderMeta(order);
    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'CUSTOMER_CONFIRMED';
    meta.web_workflow.customer_confirmed_at = new Date().toISOString();
    meta.web_workflow.agreed_vehicle_type =
      meta.web_workflow.proposed_vehicle_type ||
      meta.proposed_vehicle_type ||
      order.truck_type_requested ||
      'TRUCK_2.5T';

    await saveOrderMeta(order.id, meta);
    await prisma.orders.update({
      where: { id: BigInt(order.id) },
      data: {
        status: 'CONFIRMED',
        updated_at: new Date()
      }
    });

    const cleanToken = (order.tracking_token || token || '').trim();
    return res.json({
      message: 'Quý khách đã đồng ý chốt phương án xe và giá cước đơn hàng! Vui lòng hoàn tất nộp chứng từ.',
      next_url: `/customer/order-documents/${cleanToken}`
    });
  } catch (err) {
    console.error('customerAgreeOrderPrice Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.3b. API CHO KHÁCH HÀNG: UPLOAD CHỨNG TỪ THEO LOẠI HÀNG ĐÃ TẠO (HOẶC UPLOAD LẠI CHỨNG TỪ BỊ TỪ CHỐI)
const customerUploadDocuments = async (req, res) => {
  try {
    const { token } = req.params;
    const { documents } = req.body;

    const order = await findOrderByIdentifier(token, false);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // BUG-SYS-08: Chỉ cho phép khách xác nhận đồng ý khi đơn đang ở DRAFT/PENDING và đã có giá cước thỏa thuận > 0
    const currentSt = String(order.status || '').trim().toUpperCase();
    if (!['DRAFT', 'PENDING', 'QUOTED'].includes(currentSt)) {
      return res.status(400).json({
        message: `Đơn hàng đang ở trạng thái ${order.status}, không thể xác nhận chốt giá lại.`
      });
    }
    if (!order.agreed_price || Number(order.agreed_price) <= 0) {
      return res.status(400).json({
        message: 'Đơn hàng chưa có giá cước thỏa thuận từ Điều phối viên nên chưa thể xác nhận.'
      });
    }

    const meta = parseOrderMeta(order);
    if (!meta.web_workflow) meta.web_workflow = {};

    const existingDocs = Array.isArray(meta.documents) && meta.documents.length > 0
      ? meta.documents
      : (Array.isArray(meta.web_workflow.documents) ? meta.web_workflow.documents : []);

    const mergedDocs = (documents || []).map((incomingDoc) => {
      const isCustoms =
        incomingDoc.preparedBy === 'DISPATCHER' ||
        incomingDoc.key === 'doc-basic-1' ||
        incomingDoc.name?.toLowerCase().includes('tờ khai hải quan');
      const existingMatch = existingDocs.find((d) => d.key === incomingDoc.key);
      if (isCustoms && existingMatch && existingMatch.file && existingMatch.file !== 'Chờ tải lên') {
        return existingMatch;
      }
      return incomingDoc;
    });

    const uploadedDocs = await normalizeOrderDocAttachments(
      mergedDocs,
      `nexlog/orders/${order.id}/docs`
    );

    meta.web_workflow.stage = 'DOCS_UPLOADED';
    meta.web_workflow.documents = uploadedDocs;
    meta.web_workflow.approved_documents = null;
    meta.web_workflow.docs_uploaded_at = new Date().toISOString();
    meta.documents = uploadedDocs;

    await saveOrderMeta(order.id, meta);
    await prisma.orders.update({
      where: { id: BigInt(order.id) },
      data: {
        status: 'CONFIRMED',
        updated_at: new Date()
      }
    });

    return res.json({
      message: 'Tải lên chứng từ thành công! Hồ sơ đang được Điều phối viên kiểm duyệt.',
      status: 'PENDING_DISPATCHER_REVIEW',
      documents: uploadedDocs
    });
  } catch (err) {
    console.error('customerUploadDocuments Error:', err);
    return res.status(err.statusCode || 500).json({ message: err.message || 'Internal Server Error' });
  }
};

// 4.3c. ĐIỀU PHỐI VIÊN TỪ CHỐI MỘT CHỨNG TỪ -> CẬP NHẬT TRẠNG THÁI CẦN UPLOAD LẠI & GỬI EMAIL YÊU CẦU KHÁCH GỬI LẠI
const rejectOrderDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { doc_key, reject_reason, documents } = req.body;

    const currentOrder = await findOrderByIdentifier(id, true);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);
    if (!meta.web_workflow) meta.web_workflow = {};

    const cleanReason = (reject_reason || '').toString().trim() || 'Chứng từ chưa hợp lệ hoặc bị mờ, vui lòng tải lại tệp đúng quy định.';
    const baseDocs = Array.isArray(documents) && documents.length > 0
      ? documents
      : (meta.documents || meta.web_workflow.documents || []);

    let rejectedDocName = null;
    const updatedDocs = baseDocs.map((doc) => {
      if (doc.key === doc_key) {
        rejectedDocName = doc.name || 'Chứng từ vận tải';
        return {
          ...doc,
          status: 'REJECTED',
          reject_reason: cleanReason,
          rejected_at: new Date().toISOString()
        };
      }
      return doc;
    });

    if (!rejectedDocName) {
      return res.status(404).json({ message: `Không tìm thấy chứng từ với mã: ${doc_key}` });
    }

    meta.web_workflow.stage = 'DOCS_REJECTED';
    meta.web_workflow.documents = updatedDocs;
    meta.web_workflow.approved_documents = null;
    meta.documents = updatedDocs;

    await saveOrderMeta(currentOrder.id, meta);
    await prisma.orders.update({
      where: { id: BigInt(currentOrder.id) },
      data: {
        status: 'CONFIRMED',
        updated_at: new Date()
      }
    });

    const targetEmail =
      meta.customer_email ||
      currentOrder.customer?.email ||
      meta.accounting_email ||
      null;
    const token = (currentOrder.tracking_token || currentOrder.order_code || '').trim();
    const frontendBaseUrl = resolveFrontendBaseUrl(req);
    const reuploadUrl = `${frontendBaseUrl}/customer/order-documents/${token}`;

    let emailResult = null;
    if (targetEmail) {
      emailResult = await sendDocumentRejectionEmail({
        customerEmail: targetEmail,
        customerName: currentOrder.customer?.company_name || currentOrder.receiver_name || 'Quý khách',
        orderCode: currentOrder.order_code,
        rejectedDocName,
        rejectReason: cleanReason,
        reuploadUrl
      });
    }

    return res.json({
      message: `Đã từ chối "${rejectedDocName}" và gửi email yêu cầu khách hàng tải lại tệp mới!`,
      stage: 'DOCS_REJECTED',
      documents: updatedDocs,
      web_workflow: meta.web_workflow,
      email_sent: emailResult?.success || false,
      reupload_url: reuploadUrl
    });
  } catch (err) {
    console.error('rejectOrderDocument Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 4.4. ĐIỀU PHỐI VIÊN PHÊ DUYỆT CHỨNG TỪ (ĐỐI VỚI ĐƠN WEB) -> CHUYỂN SANG ĐÍNH KÈM HỢP ĐỒNG ĐÃ KÝ (SCAN PDF)
const approveWebOrderDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_documents } = req.body;

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);
    if (!meta.web_workflow) meta.web_workflow = {};

    const docsToCheck = Array.isArray(approved_documents) && approved_documents.length > 0
      ? approved_documents
      : (meta.documents || meta.web_workflow.documents || []);

    if (!Array.isArray(docsToCheck) || docsToCheck.length === 0) {
      return res.status(400).json({
        message: 'Danh sách chứng từ trống, không thể duyệt hồ sơ!'
      });
    }

    const missingUploadList = docsToCheck.filter(
      (d) => !d.file || d.file === 'Chờ tải lên' || d.status === 'WAITING_UPLOAD'
    );
    if (missingUploadList.length > 0) {
      return res.status(400).json({
        message: `Chưa thể duyệt toàn bộ vì còn ${missingUploadList.length} chứng từ chưa được tải tệp lên!`
      });
    }

    const rejectedList = docsToCheck.filter((d) => d.status === 'REJECTED');
    if (rejectedList.length > 0) {
      return res.status(400).json({
        message: `Không thể duyệt hồ sơ vì đang có ${rejectedList.length} chứng từ bị TỪ CHỐI (${rejectedList.map((d) => d.name).join(', ')}). Vui lòng chờ khách hàng tải lại chứng từ hợp lệ!`
      });
    }

    const finalizedDocs = docsToCheck.map((d) => ({
      ...d,
      status: 'APPROVED',
      reject_reason: null
    }));

    const nowIso = new Date().toISOString();
    meta.web_workflow.stage = meta.contract_uploaded ? 'CONTRACT_SIGNED' : 'DOCS_APPROVED';
    meta.web_workflow.documents = finalizedDocs;
    meta.web_workflow.approved_documents = finalizedDocs;
    meta.web_workflow.docs_approved_at = nowIso;
    meta.documents = finalizedDocs;

    await saveOrderMeta(currentOrder.id, meta);

    const updateFields = {
      status: meta.contract_uploaded ? 'READY_FOR_PLANNING' : 'CONFIRMED',
      document_status: 'APPROVED',
      updated_at: nowIso
    };

    if (meta.contract_uploaded) {
      updateFields.ready_for_planning_at = nowIso;
      updateFields.waiting_too_long = false;
    }

    await prisma.orders.update({
      where: { id: BigInt(currentOrder.id) },
      data: updateFields
    });

    return res.json({
      message: meta.contract_uploaded
        ? 'Đã duyệt toàn bộ hồ sơ chứng từ và có sẵn Hợp đồng PDF đã ký! Đơn hàng chuyển sang Sẵn sàng xếp xe.'
        : 'Đã duyệt toàn bộ hồ sơ chứng từ! Vui lòng chuyển sang tab Hợp đồng vận tải để đính kèm bản scan PDF hợp đồng 2 bên đã ký.',
      stage: meta.web_workflow.stage,
      documents: finalizedDocs,
      web_workflow: meta.web_workflow,
      contract_uploaded: Boolean(meta.contract_uploaded)
    });
  } catch (err) {
    console.error('approveWebOrderDocuments Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 9c. ĐIỀU PHỐI VIÊN / KHÁCH HÀNG LƯU TOÀN BỘ CHỨNG TỪ ĐÃ TẢI LÊN VÀO HỒ SƠ
const uploadOrderDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { documents, stage } = req.body;

    if (!Array.isArray(documents)) {
      return res.status(400).json({ message: 'Danh mục chứng từ không hợp lệ' });
    }

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const resolvedDocs = await normalizeOrderDocAttachments(
      documents,
      `nexlog/orders/${currentOrder.id}/docs`
    );

    const meta = parseOrderMeta(currentOrder);
    const nowIso = new Date().toISOString();
    if (!meta.web_workflow) meta.web_workflow = {};

    const customerRequiredDocs = resolvedDocs.filter(
      (d) => !(d.preparedBy === 'DISPATCHER' || d.key === 'doc-basic-1' || d.name?.toLowerCase().includes('tờ khai hải quan'))
    );
    const hasRejected = resolvedDocs.some((d) => d.status === 'REJECTED');
    const allApproved =
      customerRequiredDocs.length > 0 &&
      customerRequiredDocs.every((d) => d.status === 'APPROVED');

    let resolvedStage = stage || meta.web_workflow.stage;
    if (hasRejected) {
      resolvedStage = 'DOCS_REJECTED';
    } else if (allApproved) {
      resolvedStage = meta.contract_uploaded ? 'CONTRACT_SIGNED' : 'DOCS_APPROVED';
    } else if (
      !resolvedStage ||
      resolvedStage === 'PRICE_AGREED_BY_DISPATCHER' ||
      resolvedStage === 'CUSTOMER_CONFIRMED'
    ) {
      const hasUploadedFile = resolvedDocs.some((d) => d.file && d.file !== 'Chờ tải lên');
      if (hasUploadedFile) {
        resolvedStage = 'DOCS_UPLOADED';
      }
    }

    meta.web_workflow.stage = resolvedStage;
    meta.web_workflow.documents = resolvedDocs;
    if (resolvedStage === 'DOCS_APPROVED' || allApproved) {
      meta.web_workflow.approved_documents = resolvedDocs.filter((d) => d.status === 'APPROVED');
      meta.web_workflow.docs_approved_at = meta.web_workflow.docs_approved_at || nowIso;
    }
    meta.documents = resolvedDocs;

    await saveOrderMeta(currentOrder.id, meta);

    const updatePayload = { updated_at: nowIso };
    if (['Draft', 'DRAFT', 'WAITING_FOR_DOCUMENTS', 'PENDING_DOCUMENTS'].includes(currentOrder.status)) {
      updatePayload.status = 'CONFIRMED';
    }
    if (allApproved && meta.contract_uploaded) {
      updatePayload.status = 'READY_FOR_PLANNING';
      updatePayload.ready_for_planning_at = nowIso;
      updatePayload.document_status = 'APPROVED';
    } else if (allApproved) {
      updatePayload.document_status = 'APPROVED';
    }

    let updatedDocRow;
    try {
      updatedDocRow = await prisma.orders.update({
        where: { id: BigInt(currentOrder.id) },
        data: updatePayload
      });
    } catch (updateError) {
      console.error('uploadOrderDocuments update error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật chứng từ', error: updateError.message });
    }

    return res.json({
      message: 'Đã lưu danh mục chứng từ vào hồ sơ đơn hàng thành công!',
      documents: resolvedDocs,
      stage: resolvedStage,
      web_workflow: meta.web_workflow,
      order: serializeOrderWithAliases(updatedDocRow)
    });
  } catch (err) {
    console.error('uploadOrderDocuments Exception:', err);
    return res.status(err.statusCode || 500).json({ message: err.message || 'Internal Server Error' });
  }
};

module.exports = {
  updateAgreedPrice,
  customerAgreeOrderPrice,
  customerUploadDocuments,
  rejectOrderDocument,
  approveWebOrderDocuments,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting,
  sendContractToCustomer,
  confirmHardcopyContractReceived
};
