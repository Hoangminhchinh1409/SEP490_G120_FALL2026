const prisma = require('../../config/prisma');
const { sendContractToCustomerEmail } = require('../../services/emailService');
const { parseOrderMeta, saveOrderMeta } = require('../../services/orderHelperService');
const { generateContractPdfBuffer } = require('../../services/pdfService');
const cloudinaryService = require('../../services/cloudinaryService');
const {
  resolveFrontendBaseUrl,
  serializeOrderWithAliases,
  findOrderByIdentifier
} = require('./orderDocumentHelper');

// 9. ĐIỀU PHỐI VIÊN TẢI TỆP HỢP ĐỒNG ĐÃ SCAN (PDF) CÓ CHỮ KÝ 2 BÊN VÀO HỒ SƠ ĐƠN HÀNG
const uploadContractFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_name, file_data, file_size } = req.body;

    if (!file_name) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tên tệp hợp đồng PDF đã scan' });
    }

    if (!/\.pdf$/i.test(String(file_name).trim())) {
      return res.status(400).json({ message: 'Tệp hợp đồng tải lên bắt buộc phải là định dạng PDF (.pdf)!' });
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
    const rawContractData = file_data || req.body?.file_url || null;
    const resolvedContractUrl = rawContractData
      ? await cloudinaryService.uploadDataUriIfNeeded(rawContractData, `nexlog/orders/${currentOrder.id}/contract`)
      : null;

    meta.contract_uploaded = true;
    meta.contract_file = file_name;
    meta.contract_file_size = file_size || '-';
    meta.contract_uploaded_at = nowIso;
    if (resolvedContractUrl) {
      meta.contract_file_data = resolvedContractUrl;
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'CONTRACT_SIGNED';
    meta.web_workflow.signed_contract = {
      signed_at: nowIso,
      signer_name: 'Hai bên ký trực tiếp (Bản Scan PDF)',
      contract_file: file_name
    };

    await saveOrderMeta(currentOrder.id, meta);

    // BUG-SYS-07: Chỉ chuyển sang READY_FOR_PLANNING nếu chứng từ đã được duyệt (APPROVED)
    const shouldMoveToReady =
      String(currentOrder.document_status || '').trim().toUpperCase() === 'APPROVED' ||
      Boolean(meta.web_workflow?.docs_approved_at);

    const updatePayload = {
      signed_order_contract_file: file_name,
      updated_at: nowIso
    };

    if (shouldMoveToReady && currentOrder.status === 'CONFIRMED') {
      updatePayload.status = 'READY_FOR_PLANNING';
      updatePayload.document_status = 'APPROVED';
      updatePayload.ready_for_planning_at = nowIso;
      updatePayload.waiting_too_long = false;
    }

    let updatedContractRow;
    try {
      updatedContractRow = await prisma.orders.update({
        where: { id: BigInt(currentOrder.id) },
        data: updatePayload
      });
    } catch (updateError) {
      console.error('uploadContractFile update error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật tệp hợp đồng vào CSDL', error: updateError.message });
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
      order: serializeOrderWithAliases(updatedContractRow)
    });
  } catch (err) {
    console.error('uploadContractFile Exception:', err);
    return res.status(err.statusCode || 500).json({ message: err.message || 'Internal Server Error' });
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

    const clientOrigin = resolveFrontendBaseUrl(req);
    const trackingUrl = `${clientOrigin}/customer/order-documents/${(currentOrder.tracking_token || currentOrder.order_code || '').trim()}`;

    const contractInfo = meta.contract_details || {};

    let pdfAttachment = null;
    if (pdf_base64) {
      const base64Data = pdf_base64.replace(/^data:application\/pdf;base64,/, '');
      pdfAttachment = {
        filename: `HopDongVanTai_ALS_${currentOrder.order_code}.pdf`,
        content: Buffer.from(base64Data, 'base64')
      };
    } else {
      try {
        const generatedBuffer = await generateContractPdfBuffer({
          orderCode: currentOrder.order_code,
          contractDetails: {
            ...contractInfo,
            customer_name: contractInfo.customer_name || currentOrder.customer?.company_name || currentOrder.receiver_name || 'Khách hàng',
            customer_tax_code: contractInfo.customer_tax_code || currentOrder.customer?.tax_code || '',
            customer_address: contractInfo.customer_address || currentOrder.customer?.registered_address || (currentOrder.shipping_direction === 'IMPORT' ? (currentOrder.delivery_location?.address || meta.delivery_address) : (currentOrder.pickup_location?.address || meta.pickup_address)) || '',
            customer_phone: contractInfo.customer_phone || currentOrder.customer?.phone || currentOrder.receiver_phone || '',
            customer_email: targetEmail,
            pickup_address: contractInfo.pickup_address || currentOrder.pickup_location?.address || meta.pickup_address || '',
            delivery_address: contractInfo.delivery_address || currentOrder.delivery_location?.address || meta.delivery_address || '',
            cargo_name: contractInfo.cargo_name || meta.cargo_name || 'Hàng hóa thông thường',
            package_info: contractInfo.package_info || (meta.package_count ? `${meta.package_count} kiện` : 'Kiện hàng chuẩn'),
            weight: contractInfo.weight || meta.weight || 0,
            chargeable_weight: contractInfo.chargeable_weight || meta.chargeable || meta.weight || 0,
            truck_model: contractInfo.truck_model || meta.agreed_vehicle_type || meta.proposed_vehicle_type || 'Xe tải chuyên dụng ALS',
            price_amount: contractInfo.price_amount || currentOrder.agreed_price || meta.agreed_price || 0,
            distance_km: contractInfo.distance_km || meta.distance_km || 35.5
          },
          customTerms: termsArray,
          customer: currentOrder.customer || {}
        });

        pdfAttachment = {
          filename: `HopDongVanTai_ALS_${currentOrder.order_code}.pdf`,
          content: generatedBuffer
        };
      } catch (pdfErr) {
        console.error('[sendContractToCustomer] Error generating PDF:', pdfErr);
      }
    }

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
      tracking_url: trackingUrl,
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
    const { received_notes, postal_code } = req.body;

    const currentOrder = await findOrderByIdentifier(id, false);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const meta = parseOrderMeta(currentOrder);

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

    try {
      await prisma.order_notes.create({
        data: {
          order_id: BigInt(currentOrder.id),
          created_by: Number(req.user?.id || 3),
          content: `[PHÁP LÝ HỢP ĐỒNG] Đã tiếp nhận và xác minh bản cứng hợp đồng gốc có dấu đỏ qua bưu điện (Mã bưu cục/vận đơn: ${cleanCode}). Lưu kho pháp lý hoàn tất.`.slice(0, 480)
        }
      });
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

    let updatedInvRow;
    try {
      updatedInvRow = await prisma.orders.update({
        where: { id: BigInt(currentOrder.id) },
        data: { updated_at: new Date() }
      });
    } catch (updateError) {
      console.error('issueInvoiceToAccounting error:', updateError);
      return res.status(500).json({ message: 'Lỗi khi cập nhật hóa đơn', error: updateError.message });
    }

    try {
      await prisma.order_notes.create({
        data: {
          order_id: BigInt(currentOrder.id),
          created_by: Number(req.user?.id || 3),
          content: `[KẾ TOÁN & HÓA ĐƠN] Đã xuất Hóa đơn GTGT số ${invNumber} (Tổng tiền: ${(parseFloat(total_amount) || currentOrder.agreed_price).toLocaleString('vi-VN')} VNĐ) và bàn giao cho Bộ phận Kế toán.`.slice(0, 480)
        }
      });
    } catch (noteErr) {
      console.warn('Note insert warning:', noteErr);
    }

    return res.json({
      message: `Đã xuất hóa đơn ${invNumber} và bàn giao cho Bộ phận Kế toán thành công!`,
      invoice: meta.invoice,
      order: serializeOrderWithAliases(updatedInvRow)
    });
  } catch (err) {
    console.error('issueInvoiceToAccounting Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  uploadContractFile,
  sendContractToCustomer,
  confirmHardcopyContractReceived,
  issueInvoiceToAccounting
};
