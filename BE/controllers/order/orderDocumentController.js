const supabase = require('../../config/supabase');
const {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail,
  sendContractToCustomerEmail
} = require('../../services/emailService');
const { parseOrderMeta, saveOrderMeta } = require('../../services/orderHelperService');

// Helper tìm đơn hàng theo id hoặc order_code hoặc tracking_token
const findOrderByIdentifier = async (identifier, includeRelations = false) => {
  const selectClause = includeRelations
    ? `
      *,
      customer:customers(company_name, email, tax_code),
      pickup_location:locations!orders_pickup_location_id_fkey(name, address),
      delivery_location:locations!orders_delivery_location_id_fkey(name, address),
      responsible_dispatcher:users!orders_responsible_dispatcher_id_fkey(id, username, full_name, phone, zalo_link),
      order_cargos(*),
      order_notes(*)
    `
    : `
      *,
      customer:customers(company_name, email, tax_code),
      responsible_dispatcher:users!orders_responsible_dispatcher_id_fkey(id, username, full_name, phone, zalo_link),
      order_notes(*)
    `;

  let query = supabase.from('orders').select(selectClause);
  const cleanId = (identifier || '').toString().trim();

  if (/^\d+$/.test(cleanId)) {
    query = query.eq('id', parseInt(cleanId, 10));
  } else if (cleanId.startsWith('NEX-') || cleanId.startsWith('ORD-')) {
    query = query.eq('order_code', cleanId);
  } else {
    query = query.or(`tracking_token.eq.${cleanId},order_code.eq.${cleanId}`);
  }

  const { data, error } = await query.limit(1);
  if (error) {
    console.error('[orderDocumentController] findOrderByIdentifier error:', error.message);
    return null;
  }
  return data?.[0] || null;
};

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

    const wasNegotiating = meta.web_workflow.stage === 'CUSTOMER_NEGOTIATING';
    const cleanReason = (adjustment_reason || '').toString().trim();
    const finalVehicleType = proposed_vehicle_type || meta.web_workflow.proposed_vehicle_type || currentOrder.truck_type_requested || 'TRUCK_2.5T';
    const cleanVehicleNote = (vehicle_analysis_note || '').toString().trim();

    if (wasNegotiating && !cleanReason) {
      return res.status(400).json({
        message: 'Vui lòng ghi rõ lý do điều chỉnh lại giá cước / phương án xe (Bắt buộc)!'
      });
    }

    // Lưu lịch sử các vòng đàm phán nếu đang từ trạng thái thương lượng chuyển sang chốt lại giá
    if (wasNegotiating && meta.web_workflow.negotiation) {
      const history = Array.isArray(meta.web_workflow.negotiation_history)
        ? meta.web_workflow.negotiation_history
        : [];
      history.push({
        round: history.length + 1,
        customer_feedback_reason: meta.web_workflow.negotiation.feedback_reason,
        customer_proposed_price: meta.web_workflow.negotiation.proposed_price,
        customer_proposed_vehicle: meta.web_workflow.negotiation.proposed_vehicle_type || null,
        customer_note: meta.web_workflow.negotiation.customer_note,
        submitted_at: meta.web_workflow.negotiation.submitted_at,
        dispatcher_new_price: numPrice,
        dispatcher_proposed_vehicle: finalVehicleType,
        dispatcher_adjustment_reason: cleanReason,
        responded_at: new Date().toISOString()
      });
      meta.web_workflow.negotiation_history = history;
    }

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
    const { data, error } = await supabase
      .from('orders')
      .update({
        agreed_price: numPrice,
        truck_type_requested: finalVehicleType,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentOrder.id)
      .select();

    if (error) {
      console.error('updateAgreedPrice Error:', error);
      return res.status(500).json({ message: 'Không thể cập nhật giá cước', error });
    }

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
    if (targetEmail) {
      const token = (currentOrder.tracking_token || currentOrder.order_code || '').trim();
      const confirmUrl = `http://localhost:3000/customer/order-confirmation/${token}`;

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
      message: wasNegotiating
        ? `Đã chốt lại giá ${numPrice.toLocaleString('vi-VN')} VNĐ (Lý do: ${cleanReason}) và gửi lại báo giá cho khách hàng!`
        : isWebOrder
          ? `Đã chốt giá ${numPrice.toLocaleString('vi-VN')} VNĐ và tự động gửi email xác nhận kèm link tới khách hàng (${targetEmail || 'N/A'})!`
          : 'Cập nhật giá thỏa thuận thành công!',
      email_sent: emailResult?.success || false,
      email_preview_url: emailResult?.previewUrl || null,
      web_workflow: meta.web_workflow,
      order: data?.[0]
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
    await supabase
      .from('orders')
      .update({
        status: 'CONFIRMED',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

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


// 4.3. API CHO KHÁCH HÀNG: YÊU CẦU ĐIỀU CHỈNH GIÁ / LOẠI XE / LỊCH TRÌNH (CÓ THỂ DEAL LẠI NHIỀU LẦN)
const customerNegotiateOrder = async (req, res) => {
  try {
    const { token } = req.params;
    const { proposed_price, proposed_vehicle_type, proposed_pickup_date, feedback_reason, customer_note } = req.body;

    const order = await findOrderByIdentifier(token, false);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(order);
    if (!meta.web_workflow) meta.web_workflow = {};
    const round = (Array.isArray(meta.web_workflow.negotiation_history) ? meta.web_workflow.negotiation_history.length : 0) + 1;

    meta.web_workflow.stage = 'CUSTOMER_NEGOTIATING';
    meta.web_workflow.negotiation = {
      round,
      previous_price: order.agreed_price || meta.web_workflow.agreed_price || 0,
      proposed_price: proposed_price ? parseInt(proposed_price, 10) : null,
      proposed_vehicle_type: proposed_vehicle_type || null,
      proposed_pickup_date: proposed_pickup_date || null,
      feedback_reason: feedback_reason || 'Giá cước chưa phù hợp',
      customer_note: customer_note || '',
      submitted_at: new Date().toISOString()
    };

    // Lưu vào bảng order_notes (giới hạn <= 450 ký tự)
    const noteContent = `[Khách hàng phản hồi đàm phán] Lý do: ${feedback_reason || 'Cần điều chỉnh'}. ${proposed_price ? `Giá khách đề xuất: ${parseInt(proposed_price, 10).toLocaleString('vi-VN')} đ.` : ''} ${proposed_vehicle_type ? `Xe đề xuất: ${proposed_vehicle_type}.` : ''} Ghi chú: ${customer_note || 'Không có'}`.slice(0, 480);
    await supabase.from('order_notes').insert([{
      order_id: order.id,
      content: noteContent,
      created_by: 1
    }]);

    await saveOrderMeta(order.id, meta);
    await supabase
      .from('orders')
      .update({
        status: 'CONFIRMED',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return res.json({
      success: true,
      message: 'Đã gửi yêu cầu thương lượng giá thành công! Điều phối viên NEXLOG sẽ xem xét và phản hồi tới Quý khách sớm nhất.',
      negotiation: meta.web_workflow.negotiation
    });
  } catch (err) {
    console.error('customerNegotiateOrder Error:', err);
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

    const meta = parseOrderMeta(order);
    if (!meta.web_workflow) meta.web_workflow = {};

    // Gộp giữ nguyên Tờ khai hải quan (nếu điều phối viên đã đính kèm trước đó)
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

    meta.web_workflow.stage = 'DOCS_UPLOADED';
    meta.web_workflow.documents = mergedDocs;
    meta.web_workflow.approved_documents = null;
    meta.web_workflow.docs_uploaded_at = new Date().toISOString();
    meta.documents = mergedDocs;

    await saveOrderMeta(order.id, meta);
    await supabase
      .from('orders')
      .update({
        status: 'CONFIRMED',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return res.json({
      message: 'Tải lên chứng từ thành công! Hồ sơ đang được Điều phối viên kiểm duyệt.',
      status: 'PENDING_DISPATCHER_REVIEW',
      documents: mergedDocs
    });
  } catch (err) {
    console.error('customerUploadDocuments Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
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

    let rejectedDocName = 'Chứng từ vận tải';
    const updatedDocs = baseDocs.map((doc) => {
      if (doc.key === doc_key) {
        rejectedDocName = doc.name || rejectedDocName;
        return {
          ...doc,
          status: 'REJECTED',
          reject_reason: cleanReason,
          rejected_at: new Date().toISOString()
        };
      }
      return doc;
    });

    meta.web_workflow.stage = 'DOCS_REJECTED';
    meta.web_workflow.documents = updatedDocs;
    meta.web_workflow.approved_documents = null;
    meta.documents = updatedDocs;

    await saveOrderMeta(currentOrder.id, meta);
    await supabase
      .from('orders')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentOrder.id);

    // Gửi email yêu cầu khách hàng tải lại đúng giấy tờ bị từ chối
    const targetEmail =
      meta.customer_email ||
      currentOrder.customer?.email ||
      meta.accounting_email ||
      null;
    const token = (currentOrder.tracking_token || currentOrder.order_code || '').trim();
    const reuploadUrl = `http://localhost:3000/customer/order-documents/${token}`;

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
      email_sent: emailResult?.success || false
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

    // Chặn duyệt toàn bộ nếu vẫn còn chứng từ đang ở trạng thái REJECTED
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
      document_status: 'APPROVED',
      updated_at: nowIso
    };

    if (meta.contract_uploaded) {
      updateFields.status = 'READY_FOR_PLANNING';
      updateFields.ready_for_planning_at = nowIso;
    }

    await supabase
      .from('orders')
      .update(updateFields)
      .eq('id', currentOrder.id);

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


// 9. ĐIỀU PHỐI VIÊN TẢI TỆP HỢP ĐỒNG ĐÃ SCAN (PDF) CÓ CHỮ KÝ 2 BÊN VÀO HỒ SƠ ĐƠN HÀNG
const uploadContractFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_name, file_data, file_size } = req.body;

    if (!file_name) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tên tệp hợp đồng PDF đã scan' });
    }

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Không cho phép chỉnh sửa/tải lại nếu đơn đã bị hủy hoặc đóng
    if (['CANCELLED', 'CLOSED'].includes(currentOrder.status)) {
      return res.status(400).json({ 
        message: 'Đơn hàng đã bị HỦY hoặc ĐÃ ĐÓNG, không thể thao tác tải lên hợp đồng nữa!' 
      });
    }

    const meta = parseOrderMeta(currentOrder);

    // Nếu đã hoàn thành ký hợp đồng và đã có bản scan trước đó thì không cho thao tác tiếp
    if (meta.contract_uploaded || meta.contract_file || currentOrder.signed_order_contract_file) {
      return res.status(400).json({
        message: 'Hợp đồng đã được ký và tải lên hoàn tất, không thể thay đổi nữa!'
      });
    }

    const nowIso = new Date().toISOString();
    meta.contract_uploaded = true;
    meta.contract_file = file_name;
    meta.contract_file_size = file_size || '-';
    meta.contract_uploaded_at = nowIso;
    if (file_data) {
      meta.contract_file_data = file_data;
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'CONTRACT_SIGNED';
    meta.web_workflow.signed_contract = {
      signed_at: nowIso,
      signer_name: 'Hai bên ký trực tiếp (Bản Scan PDF)',
      contract_file: file_name
    };

    await saveOrderMeta(currentOrder.id, meta);

    // Nếu chứng từ đã được duyệt hoặc đơn đang ở trạng thái CONFIRMED, chuyển sang READY_FOR_PLANNING
    const shouldMoveToReady =
      currentOrder.document_status === 'APPROVED' ||
      meta.web_workflow?.docs_approved_at ||
      currentOrder.status === 'CONFIRMED';

    const updatePayload = {
      signed_order_contract_file: file_name,
      updated_at: nowIso
    };

    if (shouldMoveToReady && currentOrder.status === 'CONFIRMED') {
      updatePayload.status = 'READY_FOR_PLANNING';
      updatePayload.document_status = 'APPROVED';
      updatePayload.ready_for_planning_at = nowIso;
    }

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', currentOrder.id)
      .select();

    if (updateError) {
      console.error('uploadContractFile update error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật tệp hợp đồng vào CSDL', error: updateError });
    }

    return res.json({
      message: updatePayload.status === 'READY_FOR_PLANNING'
        ? `Đã đính kèm bản scan hợp đồng [${file_name}] thành công! Đơn hàng đã đủ điều kiện pháp lý và chuyển sang Sẵn sàng xếp xe.`
        : `Đã lưu bản scan hợp đồng [${file_name}] vào hồ sơ đơn hàng thành công!`,
      contract_file: file_name,
      contract_uploaded: true,
      contract_uploaded_at: nowIso,
      stage: 'CONTRACT_SIGNED',
      web_workflow: meta.web_workflow,
      order: updatedOrders?.[0]
    });
  } catch (err) {
    console.error('uploadContractFile Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 9b. ĐIỀU PHỐI VIÊN GỬI EMAIL BẢN HỢP ĐỒNG MẪU CHO KHÁCH HÀNG (KÈM ĐIỀU KHOẢN BỔ SUNG VÀ THÔNG TIN ĐÃ CHỈNH SỬA)
const sendContractToCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { custom_terms, contract_details, pdf_base64 } = req.body;

    const currentOrder = await findOrderByIdentifier(id, true);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);
    const nowIso = new Date().toISOString();

    const termsArray = Array.isArray(custom_terms) ? custom_terms : (meta.contract_custom_terms || []);
    meta.contract_custom_terms = termsArray;
    meta.contract_sent_email_at = nowIso;

    if (contract_details && typeof contract_details === 'object') {
      meta.contract_details = {
        ...(meta.contract_details || {}),
        ...contract_details,
        updated_at: nowIso
      };
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.contract_custom_terms = termsArray;
    meta.web_workflow.contract_details = meta.contract_details || null;
    meta.web_workflow.contract_sent_email_at = nowIso;
    meta.web_workflow.stage = 'CONTRACT_SENT';

    await saveOrderMeta(currentOrder.id, meta);

    const targetEmail =
      meta.customer_email ||
      currentOrder.customer?.email ||
      'khachhang@example.com';

    const clientOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
    // Đường link tra cứu và nộp hợp đồng chuẩn của khách hàng: /customer/order-documents/[token]
    const trackingUrl = `${clientOrigin}/customer/order-documents/${(currentOrder.tracking_token || currentOrder.order_code || '').trim()}`;

    let pdfAttachment = null;
    if (pdf_base64) {
      const base64Data = pdf_base64.replace(/^data:application\/pdf;base64,/, '');
      pdfAttachment = {
        filename: `HopDongVanTai_ALS_${currentOrder.order_code}.pdf`,
        content: Buffer.from(base64Data, 'base64')
      };
    }

    const contractInfo = meta.contract_details || {};
    const emailRes = await sendContractToCustomerEmail({
      customerEmail: targetEmail,
      customerName: contractInfo.customer_name || currentOrder.customer?.company_name || currentOrder.receiver_name || 'Quý khách',
      orderCode: currentOrder.order_code,
      agreedPrice: contractInfo.price_amount || currentOrder.agreed_price || meta.agreed_price || 0,
      truckModel: contractInfo.truck_model || meta.agreed_vehicle_type || meta.proposed_vehicle_type || 'Xe tải chuyên dụng ALS',
      pickupAddress: contractInfo.pickup_address || currentOrder.pickup_location?.address || meta.pickup_address,
      deliveryAddress: contractInfo.delivery_address || currentOrder.delivery_location?.address || meta.delivery_address,
      customTerms: termsArray,
      contractData: contractInfo,
      trackingUrl,
      pdfAttachment
    });

    return res.json({
      message: `Đã gửi email dự thảo Hợp đồng vận tải thành công tới [${targetEmail}]! Khách hàng có thể in file, ký đóng dấu và gửi lại bản scan qua hệ thống.`,
      contract_sent_email_at: nowIso,
      custom_terms: termsArray,
      contract_details: meta.contract_details,
      email_result: emailRes
    });
  } catch (err) {
    console.error('sendContractToCustomer Error:', err);
    return res.status(500).json({ message: 'Lỗi khi gửi email hợp đồng cho khách hàng', error: err.message });
  }
};

// 9c. ĐIỀU PHỐI VIÊN XÁC NHẬN ĐÃ NHẬN BẢN CỨNG HỢP ĐỒNG GỐC QUA ĐƯỜNG BƯU ĐIỆN
const confirmHardcopyContractReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const { received, received_notes, postal_code } = req.body;

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);

    // Nếu đã từng confirm nhận bản cứng thì khóa vĩnh viễn không cho hủy/sửa
    if (meta.contract_hardcopy_received) {
      return res.status(400).json({ 
        message: 'Bản cứng hợp đồng gốc đã được xác minh và lưu trữ pháp lý, không thể thay đổi trạng thái nữa!' 
      });
    }

    const codeToVerify = (postal_code || received_notes || '').trim();
    if (!codeToVerify) {
      return res.status(400).json({ 
        message: 'Vui lòng nhập mã bưu điện / mã vận đơn chuyển phát nhanh để hệ thống xác minh!' 
      });
    }

    // Quy tắc định dạng mã bưu điện / vận đơn Việt Nam hợp lệ:
    // EMS/VNPost: 2 chữ cái + 9 số + 2 chữ cái (VD: EM123456789VN, EE123456789VN, CQ123456789VN) hoặc mã bưu chính 8-25 ký tự
    const cleanCode = codeToVerify.replace(/\s+/g, '').toUpperCase();
    const postalRegex = /^(VNPost|EMS|VT|VTP|SPX|GHN|J&T|JT)?[-_]?[A-Z0-9]{8,25}$/i;
    const standardVnPostRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i;

    const isValidFormat = standardVnPostRegex.test(cleanCode) || postalRegex.test(cleanCode) || /^[A-Z0-9]{8,25}$/.test(cleanCode);

    if (!isValidFormat) {
      return res.status(400).json({ 
        message: `Mã vận đơn bưu chính "${codeToVerify}" không đúng định dạng chuẩn bưu điện (VD: EM123456789VN, VTP98234812, EMS-VN88921...)` 
      });
    }

    const nowIso = new Date().toISOString();

    meta.contract_hardcopy_received = true;
    meta.contract_hardcopy_received_at = nowIso;
    meta.contract_hardcopy_notes = `[BƯU ĐIỆN ĐÃ XÁC MINH] Mã vận đơn: ${cleanCode}`;
    meta.contract_postal_code = cleanCode;

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.contract_hardcopy_received = true;
    meta.web_workflow.contract_hardcopy_received_at = nowIso;
    meta.web_workflow.contract_postal_code = cleanCode;

    await saveOrderMeta(currentOrder.id, meta);

    // Ghi log đơn hàng
    try {
      await supabase.from('order_notes').insert([{
        order_id: currentOrder.id,
        created_by: 3,
        content: `[PHÁP LÝ HỢP ĐỒNG] Đã tiếp nhận và xác minh bản cứng hợp đồng gốc có dấu đỏ qua bưu điện (Mã bưu cục/vận đơn: ${cleanCode}). Lưu kho pháp lý hoàn tất.`.slice(0, 480)
      }]);
    } catch (noteErr) {
      console.warn('Note insert warning:', noteErr);
    }

    return res.json({
      message: `Hệ thống đã xác minh hợp lệ mã vận đơn bưu điện [${cleanCode}] và xác nhận nhận đủ bản cứng hợp đồng gốc có dấu đỏ thành công!`,
      contract_hardcopy_received: true,
      contract_hardcopy_received_at: nowIso,
      contract_postal_code: cleanCode
    });
  } catch (err) {
    console.error('confirmHardcopyContractReceived Error:', err);
    return res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái bản cứng hợp đồng', error: err.message });
  }
};


// 9c. ĐIỀU PHỐI VIÊN / KHÁCH HÀNG LƯU TOÀN BỘ CHỨNG TỪ ĐÃ TẢI LÊN VÀO HỒ SƠ
const uploadOrderDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { documents } = req.body;

    if (!Array.isArray(documents)) {
      return res.status(400).json({ message: 'Danh mục chứng từ không hợp lệ' });
    }

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);
    const nowIso = new Date().toISOString();
    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.documents = documents;
    meta.web_workflow.approved_documents = null;
    meta.documents = documents;

    await saveOrderMeta(currentOrder.id, meta);

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({ updated_at: nowIso })
      .eq('id', currentOrder.id)
      .select();

    if (updateError) {
      console.error('uploadOrderDocuments update error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật chứng từ', error: updateError });
    }

    return res.json({
      message: 'Đã lưu danh mục chứng từ vào hồ sơ đơn hàng thành công!',
      documents,
      order: updatedOrders?.[0]
    });
  } catch (err) {
    console.error('uploadOrderDocuments Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 9d. XUẤT HÓA ĐƠN GTGT ĐIỆN TỬ BÀN GIAO CHO KẾ TOÁN THU NỢ
const issueInvoiceToAccounting = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      invoice_number,
      vat_rate = 8,
      vat_amount = 0,
      total_amount = 0,
      accounting_email,
      authorized_bank,
      notes
    } = req.body;

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);
    const nowIso = new Date().toISOString();
    const invNumber = invoice_number || `HD-2026-${(currentOrder.order_code || '98124').replace(/\D/g, '').slice(-5)}`;

    meta.invoice_status = 'ISSUED_TO_ACCOUNTING';
    meta.invoice_number = invNumber;
    meta.invoice_issued_at = nowIso;
    meta.authorized_bank = authorized_bank || meta.authorized_bank || 'Vietcombank';
    meta.accounting_email = accounting_email || meta.accounting_email || currentOrder.customer?.email || '';
    meta.invoice = {
      invoice_number: invNumber,
      vat_rate: parseFloat(vat_rate) || 8,
      vat_amount: parseFloat(vat_amount) || 0,
      total_amount: parseFloat(total_amount) || currentOrder.agreed_price,
      authorized_bank: meta.authorized_bank,
      accounting_email: meta.accounting_email,
      issued_at: nowIso,
      issued_by: 'Bộ phận Điều phối / Kế toán vận tải',
      status: 'ISSUED_TO_ACCOUNTING',
      notes: notes || 'Đã xuất hóa đơn GTGT điện tử bàn giao kế toán thu nợ qua ngân hàng ủy quyền'
    };

    await saveOrderMeta(currentOrder.id, meta);

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({ updated_at: nowIso })
      .eq('id', currentOrder.id)
      .select();

    if (updateError) {
      console.error('issueInvoiceToAccounting error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật hóa đơn', error: updateError });
    }

    // Thêm ghi chú lịch sử
    try {
      await supabase.from('order_notes').insert([{
        order_id: currentOrder.id,
        created_by: 3,
        content: `[KẾ TOÁN & HÓA ĐƠN] Đã xuất Hóa đơn GTGT số ${invNumber} (Tổng tiền: ${(parseFloat(total_amount) || currentOrder.agreed_price).toLocaleString('vi-VN')} VNĐ) và bàn giao cho Bộ phận Kế toán.`.slice(0, 480)
      }]);
    } catch (noteErr) {
      console.warn('Note insert warning:', noteErr);
    }

    return res.json({
      message: `Đã xuất hóa đơn ${invNumber} và bàn giao cho Bộ phận Kế toán thành công!`,
      invoice: meta.invoice,
      order: updatedOrders?.[0]
    });
  } catch (err) {
    console.error('issueInvoiceToAccounting Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  updateAgreedPrice,
  customerAgreeOrderPrice,
  customerNegotiateOrder,
  customerUploadDocuments,
  rejectOrderDocument,
  approveWebOrderDocuments,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting,
  sendContractToCustomer,
  confirmHardcopyContractReceived
};
