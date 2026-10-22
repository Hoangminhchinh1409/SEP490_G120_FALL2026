const supabase = require('../../config/supabase');
const { sendOrderPriceConfirmationEmail, sendContractSigningEmail } = require('../../services/emailService');

// 4. CẬP NHẬT GIÁ CƯỚC THỎA THUẬN (VÀ TỰ ĐỘNG GỬI EMAIL XÁC NHẬN CHO KHÁCH HÀNG NẾU LÀ ĐƠN WEB)
const updateAgreedPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price } = req.body;

    const numPrice = parseInt(agreed_price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ message: 'Giá cước không hợp lệ (phải > 0 VNĐ)' });
    }

    // Kiểm tra đơn hàng hiện tại
    let findQuery = supabase.from('orders').select(`
      id, 
      order_code, 
      status, 
      agreed_price, 
      cancel_reason, 
      source, 
      tracking_email, 
      tracking_token,
      cargo_description,
      ai_input_text,
      customer:customers(company_name, email, tax_code),
      pickup_location:locations!orders_pickup_location_id_fkey(name, address),
      delivery_location:locations!orders_delivery_location_id_fkey(name, address)
    `);

    if (/^\d+$/.test(id)) {
      findQuery = findQuery.eq('id', parseInt(id));
    } else {
      findQuery = findQuery.eq('order_code', id);
    }
    const { data: currentOrderList } = await findQuery;
    const currentOrder = currentOrderList?.[0];

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    if (currentOrder.status === 'CLOSED' || currentOrder.status === 'CANCELLED' || currentOrder.cancel_reason) {
      return res.status(400).json({ message: 'Đơn hàng đã bị hủy hoặc đã đóng, không thể sửa giá cước!' });
    }

    // Cập nhật meta workflow
    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) {
      meta.web_workflow = {};
    }
    meta.web_workflow.stage = 'PRICE_AGREED_BY_DISPATCHER';
    meta.web_workflow.agreed_price = numPrice;

    // Cập nhật giá thỏa thuận vào DB
    let query = supabase.from('orders').update({ 
      agreed_price: numPrice,
      ai_input_text: JSON.stringify(meta),
      updated_at: new Date().toISOString()
    });
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('updateAgreedPrice Error:', error);
      return res.status(500).json({ message: 'Không thể cập nhật giá cước', error });
    }

    // NẾU LÀ ĐƠN TỪ WEB (HOMEPAGE) -> TỰ ĐỘNG GỬI GMAIL CHO KHÁCH KÈM LINK XÁC NHẬN
    const isWebOrder = currentOrder.source === 'HOMEPAGE';
    const targetEmail = currentOrder.tracking_email || currentOrder.customer?.email;

    if (isWebOrder && targetEmail) {
      const token = currentOrder.tracking_token;
      const confirmUrl = `http://localhost:3000/customer/order-confirmation/${token}`;
      
      sendOrderPriceConfirmationEmail({
        customerEmail: targetEmail,
        customerName: currentOrder.customer?.company_name || 'Quý khách',
        orderCode: currentOrder.order_code,
        agreedPrice: numPrice,
        pickupAddress: currentOrder.pickup_location?.address || currentOrder.pickup_location?.name || 'Hà Nội',
        deliveryAddress: currentOrder.delivery_location?.address || currentOrder.delivery_location?.name || 'Bắc Ninh',
        cargoDescription: currentOrder.cargo_description,
        confirmUrl
      }).catch(err => console.error('Auto-email error:', err));
    }

    return res.json({ 
      message: isWebOrder 
        ? `Đã chốt giá ${numPrice.toLocaleString()} VNĐ và tự động gửi email xác nhận kèm link tới khách hàng!` 
        : 'Cập nhật giá thỏa thuận thành công!', 
      order: data?.[0] 
    });
  } catch (err) {
    console.error('updateAgreedPrice Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 4.2. API CHO KHÁCH HÀNG: ĐỒNG Ý CHỐT ĐƠN VÀ GIÁ CƯỚC (CHUYỂN SANG BƯỚC UPLOAD CHỨNG TỪ)
const customerAgreeOrderPrice = async (req, res) => {
  try {
    const { token } = req.params;

    let query = supabase.from('orders').select('id, order_code, ai_input_text, agreed_price');
    if (token.startsWith('NEX-') || token.startsWith('ORD-')) {
      query = query.eq('order_code', token);
    } else {
      query = query.or(`tracking_token.eq.${token},order_code.eq.${token}`);
    }
    const { data: orders } = await query.limit(1);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    let meta = {};
    try {
      meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'CUSTOMER_CONFIRMED';
    meta.web_workflow.customer_confirmed_at = new Date().toISOString();

    await supabase
      .from('orders')
      .update({
        ai_input_text: JSON.stringify(meta),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return res.json({
      message: 'Quý khách đã đồng ý chốt đơn hàng! Vui lòng hoàn tất nộp chứng từ.',
      next_url: `/customer/order-documents/${token}`
    });
  } catch (err) {
    console.error('customerAgreeOrderPrice Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 4.3. API CHO KHÁCH HÀNG: UPLOAD CHỨNG TỪ THEO LOẠI HÀNG ĐÃ TẠO
const customerUploadDocuments = async (req, res) => {
  try {
    const { token } = req.params;
    const { documents } = req.body;

    let query = supabase.from('orders').select('id, order_code, ai_input_text');
    if (token.startsWith('NEX-') || token.startsWith('ORD-')) {
      query = query.eq('order_code', token);
    } else {
      query = query.or(`tracking_token.eq.${token},order_code.eq.${token}`);
    }
    const { data: orders } = await query.limit(1);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    let meta = {};
    try {
      meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'DOCS_UPLOADED';
    meta.web_workflow.documents = documents || [];
    meta.web_workflow.docs_uploaded_at = new Date().toISOString();

    await supabase
      .from('orders')
      .update({
        ai_input_text: JSON.stringify(meta),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return res.json({
      message: 'Tải lên chứng từ thành công! Hồ sơ đang được Điều phối viên kiểm duyệt.',
      status: 'PENDING_DISPATCHER_REVIEW'
    });
  } catch (err) {
    console.error('customerUploadDocuments Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 4.4. ĐIỀU PHỐI VIÊN PHÊ DUYỆT CHỨNG TỪ (ĐỐI VỚI ĐƠN WEB) -> TỰ ĐỘNG GỬI EMAIL KÈM HỢP ĐỒNG & LINK KÝ CHỮ KÝ SỐ
const approveWebOrderDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_documents } = req.body;

    let findQuery = supabase
      .from('orders')
      .select(`
        id, 
        order_code, 
        status, 
        agreed_price, 
        source, 
        tracking_email, 
        tracking_token,
        ai_input_text,
        customer:customers(company_name, email)
      `);

    if (/^\d+$/.test(id)) {
      findQuery = findQuery.eq('id', parseInt(id));
    } else {
      findQuery = findQuery.eq('order_code', id);
    }
    const { data: currentOrderList } = await findQuery;
    const currentOrder = currentOrderList?.[0];

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'DOCS_APPROVED';
    meta.web_workflow.approved_documents = approved_documents || meta.web_workflow.documents;
    meta.web_workflow.docs_approved_at = new Date().toISOString();

    await supabase
      .from('orders')
      .update({
        ai_input_text: JSON.stringify(meta),
        docs_confirmed_at: new Date().toISOString(),
        docs_confirmed_by: 3,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentOrder.id);

    // Gửi email hợp đồng và link ký số cho khách hàng
    const targetEmail = currentOrder.tracking_email || currentOrder.customer?.email;
    const token = currentOrder.tracking_token;
    const contractSignUrl = `http://localhost:3000/customer/contract-sign/${token}`;

    if (targetEmail) {
      sendContractSigningEmail({
        customerEmail: targetEmail,
        customerName: currentOrder.customer?.company_name || 'Quý khách',
        orderCode: currentOrder.order_code,
        agreedPrice: currentOrder.agreed_price,
        contractSignUrl
      }).catch(err => console.error('Contract email error:', err));
    }

    return res.json({
      message: 'Đã duyệt hồ sơ chứng từ! Hệ thống đã tự động gửi hợp đồng điện tử và link ký số qua email khách hàng.',
      stage: 'DOCS_APPROVED',
      contractSignUrl
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

    let query = supabase.from('orders').select('id, order_code, agreed_price, ai_input_text');
    if (token.startsWith('NEX-') || token.startsWith('ORD-')) {
      query = query.eq('order_code', token);
    } else {
      query = query.or(`tracking_token.eq.${token},order_code.eq.${token}`);
    }
    const { data: orders } = await query.limit(1);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    let meta = {};
    try {
      meta = order.ai_input_text ? JSON.parse(order.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.stage = 'CONTRACT_SIGNED';
    meta.web_workflow.signed_contract = {
      signed_at: new Date().toISOString(),
      signer_name: signer_name || 'Đại diện Khách hàng',
      signature_data: signature_data,
      contract_file: `HD-${order.order_code}-SIGNED.pdf`
    };

    // Tự động chuyển trạng thái đơn hàng sang READY_FOR_PLANNING để tiến hành xếp xe
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({
        status: 'READY_FOR_PLANNING',
        ready_for_planning_at: new Date().toISOString(),
        ai_input_text: JSON.stringify(meta),
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

    let findQuery = supabase
      .from('orders')
      .select('id, order_code, status, ai_input_text');

    if (/^\d+$/.test(id)) {
      findQuery = findQuery.eq('id', parseInt(id));
    } else {
      findQuery = findQuery.eq('order_code', id);
    }

    const { data: currentOrders, error: findError } = await findQuery;
    const currentOrder = currentOrders?.[0];

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    const nowIso = new Date().toISOString();
    meta.contract_uploaded = true;
    meta.contract_file = file_name;
    meta.contract_file_size = file_size || '-';
    meta.contract_uploaded_at = nowIso;
    if (file_data) {
      meta.contract_file_data = file_data; // Base64 url hoặc đường dẫn
    }

    // Nếu đơn hàng đang ở trạng thái DRAFT hoặc PENDING, có thể cập nhật thời gian hoàn tất hồ sơ
    const updates = {
      ai_input_text: JSON.stringify(meta),
      updated_at: nowIso
    };

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update(updates)
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

    let findQuery = supabase.from('orders').select('id, order_code, ai_input_text');
    if (/^\d+$/.test(id)) {
      findQuery = findQuery.eq('id', parseInt(id));
    } else {
      findQuery = findQuery.eq('order_code', id);
    }

    const { data: currentOrders, error: findError } = await findQuery;
    const currentOrder = currentOrders?.[0];

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    const nowIso = new Date().toISOString();
    if (!meta.web_workflow) meta.web_workflow = {};
    meta.web_workflow.documents = documents;
    meta.documents = documents;

    const updates = {
      ai_input_text: JSON.stringify(meta),
      updated_at: nowIso
    };

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update(updates)
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

    let findQuery = supabase.from('orders').select('*');
    if (/^\d+$/.test(id)) {
      findQuery = findQuery.eq('id', parseInt(id));
    } else {
      findQuery = findQuery.eq('order_code', id);
    }

    const { data: currentOrders, error: findError } = await findQuery;
    const currentOrder = currentOrders?.[0];

    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    let meta = {};
    try {
      meta = currentOrder.ai_input_text ? JSON.parse(currentOrder.ai_input_text) : {};
    } catch (e) {
      meta = {};
    }

    const nowIso = new Date().toISOString();
    const invNumber = invoice_number || `HD-2026-${(currentOrder.order_code || '98124').replace(/\D/g, '').slice(-5)}`;
    
    meta.invoice_status = 'ISSUED_TO_ACCOUNTING';
    meta.invoice_number = invNumber;
    meta.invoice_issued_at = nowIso;
    meta.authorized_bank = authorized_bank || meta.authorized_bank || 'Vietcombank';
    meta.accounting_email = accounting_email || meta.accounting_email || currentOrder.tracking_email;
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

    const updates = {
      ai_input_text: JSON.stringify(meta),
      updated_at: nowIso
    };

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update(updates)
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
        author_id: 3,
        content: `[KẾ TOÁN & HÓA ĐƠN] Đã xuất Hóa đơn GTGT số ${invNumber} (Tổng tiền: ${(parseFloat(total_amount) || currentOrder.agreed_price).toLocaleString()} VNĐ) và bàn giao cho Bộ phận Kế toán để đối soát và thu tiền khách hàng qua ngân hàng ủy quyền ${meta.authorized_bank}.`
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
  customerUploadDocuments,
  approveWebOrderDocuments,
  customerSignContract,
  uploadContractFile,
  uploadOrderDocuments,
  issueInvoiceToAccounting
};