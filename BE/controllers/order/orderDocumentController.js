const supabase = require('../../config/supabase');
const {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail,
  sendContractSigningEmail
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


// 4.4. ĐIỀU PHỐI VIÊN PHÊ DUYỆT CHỨNG TỪ (ĐỐI VỚI ĐƠN WEB) -> TỰ ĐỘNG GỬI EMAIL KÈM HỢP ĐỒNG & LINK KÝ CHỮ KÝ SỐ
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
        message: `Không thể duyệt hồ sơ và gửi hợp đồng vì đang có ${rejectedList.length} chứng từ bị TỪ CHỐI (${rejectedList.map((d) => d.name).join(', ')}). Vui lòng chờ khách hàng tải lại chứng từ hợp lệ!`
      });
    }

    const finalizedDocs = docsToCheck.map((d) => ({
      ...d,
      status: 'APPROVED',
      reject_reason: null
    }));

    meta.web_workflow.stage = 'DOCS_APPROVED';
    meta.web_workflow.documents = finalizedDocs;
    meta.web_workflow.approved_documents = finalizedDocs;
    meta.web_workflow.docs_approved_at = new Date().toISOString();
    meta.documents = finalizedDocs;

    await saveOrderMeta(currentOrder.id, meta);
    await supabase
      .from('orders')
      .update({
        document_status: 'APPROVED',
        updated_at: new Date().toISOString()
      })
      .eq('id', currentOrder.id);

    // Gửi email hợp đồng và link ký số cho khách hàng
    const targetEmail =
      meta.customer_email ||
      currentOrder.customer?.email ||
      meta.accounting_email ||
      null;
    const token = (currentOrder.tracking_token || currentOrder.order_code || '').trim();
    const contractSignUrl = `http://localhost:3000/customer/contract-sign/${token}`;

    let emailResult = null;
    if (targetEmail) {
      emailResult = await sendContractSigningEmail({
        customerEmail: targetEmail,
        customerName: currentOrder.customer?.company_name || currentOrder.receiver_name || 'Quý khách',
        orderCode: currentOrder.order_code,
        agreedPrice: currentOrder.agreed_price,
        contractSignUrl
      });
    }

    return res.json({
      message: 'Đã duyệt toàn bộ hồ sơ chứng từ! Hệ thống đã tự động gửi hợp đồng điện tử và link ký số qua email khách hàng.',
      stage: 'DOCS_APPROVED',
      documents: finalizedDocs,
      web_workflow: meta.web_workflow,
      contractSignUrl,
      email_sent: emailResult?.success || false,
      email_preview_url: emailResult?.previewUrl || null
    });
  } catch (err) {
    console.error('approveWebOrderDocuments Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 4.5. KHÁCH HÀNG KÝ CHỮ KÝ SỐ VÀ LƯU HỢP ĐỒNG ĐÃ KÝ VÀO HỒ SƠ ĐIỀU PHỐI -> CHUYỂN SANG READY_FOR_PLANNING (XẾP XE)
const customerSignContract = async (req, res) => {
  try {
    const { token } = req.params;
    const { signature_data, signer_name } = req.body;

    if (!signature_data) {
      return res.status(400).json({ message: 'Vui lòng cung cấp chữ ký điện tử' });
    }

    const order = await findOrderByIdentifier(token, false);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(order);
    if (!meta.web_workflow) meta.web_workflow = {};
    const signedContractFile = `HD-${order.order_code}-SIGNED.pdf`;
    meta.web_workflow.stage = 'CONTRACT_SIGNED';
    meta.web_workflow.signed_contract = {
      signed_at: new Date().toISOString(),
      signer_name: signer_name || 'Đại diện Khách hàng',
      signature_data: signature_data,
      contract_file: signedContractFile
    };
    meta.contract_uploaded = true;
    meta.contract_file = signedContractFile;
    meta.contract_uploaded_at = new Date().toISOString();

    await saveOrderMeta(order.id, meta);

    // Cập nhật file hợp đồng đã ký và chuyển sang sẵn sàng xếp xe
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({
        status: 'READY_FOR_PLANNING',
        document_status: 'APPROVED',
        signed_order_contract_file: signedContractFile,
        ready_for_planning_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .select();

    if (error) {
      console.error('customerSignContract Update Error:', error);
      return res.status(500).json({ message: error.message || 'Lỗi cập nhật hợp đồng' });
    }

    return res.json({
      message: 'Ký số hợp đồng thành công! Đơn hàng đã hoàn tất thủ tục và chuyển sang công đoạn Xếp xe.',
      order: updatedOrder?.[0],
      stage: 'CONTRACT_SIGNED'
    });
  } catch (err) {
    console.error('customerSignContract Exception:', err);
    return res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
};


// 9. ĐIỀU PHỐI VIÊN TẢI TỆP HỢP ĐỒNG ĐÃ KÝ THẬT VÀO HỒ SƠ ĐƠN HÀNG
const uploadContractFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_name, file_data, file_size } = req.body;

    if (!file_name) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tên tệp hợp đồng' });
    }

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);
    const nowIso = new Date().toISOString();
    meta.contract_uploaded = true;
    meta.contract_file = file_name;
    meta.contract_file_size = file_size || '-';
    meta.contract_uploaded_at = nowIso;
    if (file_data) {
      meta.contract_file_data = file_data;
    }

    await saveOrderMeta(currentOrder.id, meta);

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({
        signed_order_contract_file: file_name,
        updated_at: nowIso
      })
      .eq('id', currentOrder.id)
      .select();

    if (updateError) {
      console.error('uploadContractFile update error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật tệp hợp đồng vào CSDL', error: updateError });
    }

    return res.json({
      message: `Đã lưu tệp hợp đồng [${file_name}] vào hồ sơ đơn hàng thành công!`,
      contract_file: file_name,
      contract_uploaded: true,
      contract_uploaded_at: nowIso,
      order: updatedOrders?.[0]
    });
  } catch (err) {
    console.error('uploadContractFile Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
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
  customerSignContract,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting
};
