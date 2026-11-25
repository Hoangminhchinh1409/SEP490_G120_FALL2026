const { nodemailer, escapeHtml, getTransporter } = require('./emailTransporter');

const sendIncidentCompensationApprovalEmail = async ({
  customerEmail,
  customerName,
  contactPerson,
  orderCode,
  tripCode,
  incidentCode,
  claimCode,
  incidentType,
  cargoDescription,
  declaredValue,
  damagePercentage,
  approvedAmount,
  goodsHandlingMethod,
  contractClauseRef,
  resolutionNote,
  surveyOrgReport,
  contactHotline = '1900 1234',
  trackingUrl
}) => {
  const mailTransporter = await getTransporter();
  const formattedApproved = Number(approvedAmount || 0).toLocaleString('vi-VN');
  const formattedDeclared = Number(declaredValue || 0).toLocaleString('vi-VN');
  const handlingText =
    goodsHandlingMethod === 'COMPANY_RECOVERY'
      ? 'ALS thu hồi hàng hư hỏng về kho & Bồi thường 100% theo hạn mức'
      : 'Giao phần hàng đạt chuẩn & Bồi thường phần thiệt hại cho Khách hàng';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px 10px; color: #1e293b; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #0d9488 55%, #059669 100%); padding: 34px 28px; text-align: center; color: #ffffff; }
        .header-brand { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin-bottom: 8px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.4px; line-height: 1.3; }
        .header p { margin: 8px 0 0; font-size: 13px; opacity: 0.92; }
        .content { padding: 30px 28px; }
        .badge-wrap { text-align: center; margin-bottom: 20px; }
        .status-badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 999px; padding: 7px 18px; font-size: 12px; font-weight: 800; letter-spacing: 0.4px; }
        .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .lead { font-size: 14px; line-height: 1.68; color: #475569; margin: 0 0 20px; }
        .amount-card { background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%); border: 2px solid #10b981; border-radius: 14px; padding: 22px 20px; text-align: center; margin: 20px 0; }
        .amount-label { font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 1px; }
        .amount-value { font-size: 32px; font-weight: 900; color: #047857; font-family: 'Consolas', monospace; margin: 6px 0 10px; }
        .amount-sub { font-size: 12px; color: #065f46; line-height: 1.5; background: rgba(255,255,255,0.75); display: inline-block; padding: 8px 14px; border-radius: 8px; border: 1px solid #a7f3d0; }
        .detail-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 20px 0; }
        .detail-title { font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        .detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .detail-table td { padding: 7px 4px; border-bottom: 1px dashed #e2e8f0; vertical-align: top; }
        .detail-table tr:last-child td { border-bottom: none; }
        .td-label { color: #64748b; width: 185px; font-weight: 500; }
        .td-val { color: #0f172a; font-weight: 600; text-align: right; }
        .steps-box { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 12px; padding: 18px 20px; margin: 22px 0; }
        .steps-title { font-size: 13px; font-weight: 800; color: #1e3a8a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.4px; }
        .step-item { display: flex; align-items: flex-start; margin-bottom: 10px; font-size: 13px; line-height: 1.55; color: #1e40af; }
        .step-item:last-child { margin-bottom: 0; }
        .step-num { display: inline-block; min-width: 22px; height: 22px; line-height: 22px; border-radius: 50%; background: #2563eb; color: #ffffff; text-align: center; font-size: 11px; font-weight: 800; margin-right: 10px; margin-top: 1px; }
        .btn-wrap { text-align: center; margin: 26px 0 14px; }
        .btn { display: inline-block; background: #059669; color: #ffffff !important; padding: 13px 30px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3); }
        .support-bar { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #475569; text-align: center; margin-top: 18px; line-height: 1.6; }
        .footer { background: #0f172a; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-brand">ALS — NEXLOG SUPPLY CHAIN SOLUTION</div>
          <h1>THÔNG BÁO PHÊ DUYỆT BỒI THƯỜNG HÀNG HÓA</h1>
          <p>Quyết định giải quyết hồ sơ sự cố vận chuyển #${escapeHtml(incidentCode || 'INC')} · Đơn hàng #${escapeHtml(orderCode || '')}</p>
        </div>

        <div class="content">
          <div class="badge-wrap">
            <span class="status-badge">✓ CHẤP THUẬN BỒI THƯỜNG THEO HỢP ĐỒNG</span>
          </div>

          <div class="greeting">Kính gửi Quý khách hàng ${escapeHtml(customerName || 'Quý đối tác')}${contactPerson ? ` (Người liên hệ: ${escapeHtml(contactPerson)})` : ''},</div>
          <p class="lead">
            Trước hết, Công ty TNHH Vận tải &amp; Logistics Hàng không ALS (NEXLOG) xin gửi lời xin lỗi chân thành tới Quý khách vì sự cố phát sinh ngoài mong muốn trong quá trình vận chuyển lô hàng thuộc đơn <b>#${escapeHtml(orderCode || '')}</b>.
            <br/><br/>
            Sau khi tiếp nhận đầy đủ hồ sơ hiện trường, biên bản giám định và đối chiếu điều khoản Hợp đồng vận chuyển, Ban Quản lý ALS trân trọng thông báo <b>chấp thuận chi trả bồi thường thiệt hại</b> với thông tin cụ thể như sau:
          </p>

          <div class="amount-card">
            <div class="amount-label">Số tiền bồi thường được phê duyệt</div>
            <div class="amount-value">${formattedApproved} VNĐ</div>
            <div class="amount-sub">
              <b>Phương án xử lý:</b> ${escapeHtml(handlingText)}<br/>
              <b>Căn cứ áp dụng:</b> ${escapeHtml(contractClauseRef || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa')}
            </div>
          </div>

          <div class="detail-box">
            <div class="detail-title">Chi tiết hồ sơ thẩm định &amp; đối chiếu</div>
            <table class="detail-table">
              <tr>
                <td class="td-label">Mã hồ sơ / Mã sự cố:</td>
                <td class="td-val" style="font-family: monospace; color: #047857;">${escapeHtml(claimCode || '')} / ${escapeHtml(incidentCode || '')}</td>
              </tr>
              <tr>
                <td class="td-label">Mã đơn hàng / Chuyến xe:</td>
                <td class="td-val" style="font-family: monospace;">${escapeHtml(orderCode || '')} · ${escapeHtml(tripCode || '')}</td>
              </tr>
              <tr>
                <td class="td-label">Loại sự cố ghi nhận:</td>
                <td class="td-val">${escapeHtml(incidentType || 'Sự cố vận chuyển hàng hóa')}</td>
              </tr>
              <tr>
                <td class="td-label">Quy cách lô hàng:</td>
                <td class="td-val">${escapeHtml(cargoDescription || 'Theo chứng từ vận đơn')}</td>
              </tr>
              <tr>
                <td class="td-label">Giá trị khai báo / Tỷ lệ hư hỏng:</td>
                <td class="td-val">${formattedDeclared} đ · <b>${Number(damagePercentage || 0)}%</b></td>
              </tr>
              ${surveyOrgReport ? `
              <tr>
                <td class="td-label">Đơn vị / Số biên bản giám định:</td>
                <td class="td-val">${escapeHtml(surveyOrgReport)}</td>
              </tr>
              ` : ''}
              ${resolutionNote ? `
              <tr>
                <td class="td-label">Kết luận của Ban Quản lý:</td>
                <td class="td-val" style="font-weight: 500; text-align: right;">${escapeHtml(resolutionNote)}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div class="steps-box">
            <div class="steps-title">⏳ Cam kết liên hệ &amp; Quy trình chi trả bồi thường</div>
            <div class="step-item">
              <span class="step-num">1</span>
              <div><b>Liên hệ lại trong thời gian sớm nhất (tối đa 24 giờ làm việc):</b> Bộ phận Chăm sóc Khách hàng &amp; Pháp chế – Bồi thường ALS sẽ chủ động gọi điện/nhắn email xác nhận thông tin tài khoản ngân hàng thụ hưởng của Quý khách.</div>
            </div>
            <div class="step-item">
              <span class="step-num">2</span>
              <div><b>Giải ngân chuyển khoản qua Ngân hàng:</b> Phòng Tài chính – Kế toán sẽ thực hiện chuyển khoản 100% số tiền <b>${formattedApproved} VNĐ</b> trong vòng <b>03 – 05 ngày làm việc</b> kể từ khi hai Bên thống nhất thông tin thụ hưởng.</div>
            </div>
            <div class="step-item">
              <span class="step-num">3</span>
              <div><b>Gửi chứng từ &amp; Đóng hồ sơ minh bạch:</b> Ngay sau khi hoàn tất giao dịch, hệ thống sẽ gửi ảnh Ủy nhiệm chi (UNC) qua email và cập nhật trạng thái hoàn tất trên cổng theo dõi đơn hàng.</div>
            </div>
          </div>

          ${trackingUrl ? `
          <div class="btn-wrap">
            <a href="${escapeHtml(trackingUrl)}" class="btn" target="_blank">Theo Dõi Tiến Trình Chi Trả Bồi Thường</a>
          </div>
          ` : ''}

          <div class="support-bar">
            Nếu Quý khách cần trao đổi gấp thông tin tài khoản thụ hưởng hoặc có câu hỏi bổ sung, vui lòng liên hệ Hotline Bồi thường &amp; CSKH: <b>${escapeHtml(contactHotline || '1900 1234')}</b> hoặc phản hồi trực tiếp email này (<b>claims@nexlog.vn</b>).
          </div>
        </div>

        <div class="footer">
          <div><b>CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG (ALS) — HỆ THỐNG ĐIỀU VẬN NEXLOG</b></div>
          <div>Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội · © 2026 NEXLOG Logistics. All rights reserved.</div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || `ALS NEXLOG Claims <${process.env.SMTP_USER || 'claims@nexlog.vn'}>`;
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: customerEmail || 'khachhang@example.com',
      subject: `[ALS - NEXLOG] Phê duyệt bồi thường ${formattedApproved} đ — Hồ sơ ${incidentCode || ''} (Đơn #${orderCode || ''})`,
      html: htmlContent
    });
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    console.log('[EmailService] Incident compensation approval email sent:', info.messageId, previewUrl || '');
    return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
  } catch (error) {
    console.error('[EmailService] Error sending incident approval email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email thông báo TỪ CHỐI BỒI THƯỜNG sự cố kèm lý do & điều khoản hợp đồng tới Khách hàng
 */
const sendIncidentCompensationRejectionEmail = async ({
  customerEmail,
  customerName,
  contactPerson,
  orderCode,
  tripCode,
  incidentCode,
  claimCode,
  incidentType,
  cargoDescription,
  rejectionReason,
  rejectionClause,
  resolutionNote,
  contactHotline = '1900 1234',
  trackingUrl
}) => {
  const mailTransporter = await getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px 10px; color: #1e293b; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #450a0a 0%, #991b1b 50%, #dc2626 100%); padding: 34px 28px; text-align: center; color: #ffffff; }
        .header-brand { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin-bottom: 8px; }
        .header h1 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: 0.4px; line-height: 1.35; }
        .header p { margin: 8px 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 30px 28px; }
        .badge-wrap { text-align: center; margin-bottom: 20px; }
        .status-badge { display: inline-block; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 999px; padding: 7px 18px; font-size: 12px; font-weight: 800; letter-spacing: 0.4px; }
        .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .lead { font-size: 14px; line-height: 1.68; color: #475569; margin: 0 0 20px; }
        .detail-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 18px 0; }
        .detail-title { font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        .detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .detail-table td { padding: 7px 4px; border-bottom: 1px dashed #e2e8f0; vertical-align: top; }
        .detail-table tr:last-child td { border-bottom: none; }
        .td-label { color: #64748b; width: 175px; font-weight: 500; }
        .td-val { color: #0f172a; font-weight: 600; text-align: right; }
        .reject-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .reject-title { font-size: 13px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .reject-item { font-size: 13px; line-height: 1.65; color: #7f1d1d; margin-bottom: 10px; }
        .reject-item:last-child { margin-bottom: 0; }
        .appeal-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px 18px; margin: 20px 0; font-size: 13px; color: #78350f; line-height: 1.6; }
        .btn-wrap { text-align: center; margin: 24px 0 12px; }
        .btn { display: inline-block; background: #1e293b; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 13px; text-decoration: none; }
        .footer { background: #0f172a; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-brand">ALS — NEXLOG SUPPLY CHAIN SOLUTION</div>
          <h1>THÔNG BÁO KẾT QUẢ THẨM ĐỊNH SỰ CỐ &amp; BỒI THƯỜNG</h1>
          <p>Hồ sơ sự cố #${escapeHtml(incidentCode || 'INC')} · Đơn hàng #${escapeHtml(orderCode || '')}</p>
        </div>

        <div class="content">
          <div class="badge-wrap">
            <span class="status-badge">THÔNG BÁO TỪ CHỐI BỒI THƯỜNG THEO ĐIỀU KHOẢN HỢP ĐỒNG</span>
          </div>

          <div class="greeting">Kính gửi Quý khách hàng ${escapeHtml(customerName || 'Quý đối tác')}${contactPerson ? ` (Người liên hệ: ${escapeHtml(contactPerson)})` : ''},</div>
          <p class="lead">
            Công ty TNHH Vận tải &amp; Logistics Hàng không ALS (NEXLOG) trân trọng cảm ơn Quý khách đã phản ánh và phối hợp cung cấp thông tin đối với sự cố phát sinh trên đơn hàng <b>#${escapeHtml(orderCode || '')}</b>.
            <br/><br/>
            Sau khi tiến hành rà soát độc lập toàn bộ hồ sơ pháp lý, dữ liệu giám sát hành trình GPS và đối chiếu bằng chứng hình ảnh 3 khâu (Pickup – Niêm phong chì – POD giao hàng), Ban Thẩm định Sự cố ALS xin thông báo <b>chưa đủ cơ sở chấp thuận yêu cầu bồi thường</b> với căn cứ chi tiết dưới đây:
          </p>

          <div class="detail-box">
            <div class="detail-title">Thông tin hồ sơ đã thẩm định</div>
            <table class="detail-table">
              <tr>
                <td class="td-label">Mã hồ sơ / Mã sự cố:</td>
                <td class="td-val" style="font-family: monospace; color: #b91c1c;">${escapeHtml(claimCode || '')} / ${escapeHtml(incidentCode || '')}</td>
              </tr>
              <tr>
                <td class="td-label">Mã đơn hàng / Chuyến xe:</td>
                <td class="td-val" style="font-family: monospace;">${escapeHtml(orderCode || '')} · ${escapeHtml(tripCode || '')}</td>
              </tr>
              <tr>
                <td class="td-label">Phân loại sự cố:</td>
                <td class="td-val">${escapeHtml(incidentType || 'Sự cố vận chuyển')}</td>
              </tr>
              <tr>
                <td class="td-label">Thông tin lô hàng:</td>
                <td class="td-val">${escapeHtml(cargoDescription || 'Theo chứng từ vận đơn')}</td>
              </tr>
              <tr>
                <td class="td-label">Kết quả thẩm định:</td>
                <td class="td-val" style="color: #dc2626;">Từ chối bồi thường · Đã đóng hồ sơ</td>
              </tr>
            </table>
          </div>

          <div class="reject-box">
            <div class="reject-title">⚖️ Căn cứ hợp đồng &amp; Lý do từ chối chi tiết</div>
            <div class="reject-item">
              <b>• Điều khoản Hợp đồng viện dẫn:</b><br/>
              ${escapeHtml(rejectionClause || 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng vận tải đã ký kết')}
            </div>
            <div class="reject-item">
              <b>• Lý do từ chối bồi thường:</b><br/>
              ${escapeHtml(rejectionReason || resolutionNote || 'Tổn thất không phát sinh do lỗi của đơn vị vận chuyển căn cứ theo hồ sơ đối chiếu hiện trường.')}
            </div>
            <div class="reject-item">
              <b>• Kết luận đối chiếu chứng từ:</b><br/>
              Đã kiểm tra chéo ảnh chụp lúc nhận hàng (Pickup), tình trạng nguyên vẹn của tem niêm phong chì (Seal) và biên bản bàn giao thực tế (POD).
            </div>
          </div>

          <div class="appeal-box">
            <b>📌 Hướng dẫn Phúc khảo &amp; Hỗ trợ Khiếu nại:</b><br/>
            Trường hợp Quý khách có thêm tài liệu đối chứng hoặc biên bản giám định độc lập mới làm thay đổi bản chất sự việc, Quý khách vui lòng gửi đề nghị phúc khảo trong vòng <b>07 ngày làm việc</b> kể từ ngày nhận thông báo này.<br/>
            • Hotline Giải quyết Khiếu nại: <b style="color: #991b1b; font-family: monospace;">${escapeHtml(contactHotline || '1900 1234')}</b><br/>
            • Email Bộ phận Pháp chế – Bồi thường: <b>claims@nexlog.vn</b>
          </div>

          ${trackingUrl ? `
          <div class="btn-wrap">
            <a href="${escapeHtml(trackingUrl)}" class="btn" target="_blank">Xem Chi Tiết Hồ Sơ &amp; Minh Chứng Đơn Hàng</a>
          </div>
          ` : ''}
        </div>

        <div class="footer">
          <div><b>CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG (ALS) — HỆ THỐNG ĐIỀU VẬN NEXLOG</b></div>
          <div>Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội · © 2026 NEXLOG Logistics. All rights reserved.</div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || `ALS NEXLOG Claims <${process.env.SMTP_USER || 'claims@nexlog.vn'}>`;
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: customerEmail || 'khachhang@example.com',
      subject: `[ALS - NEXLOG] Thông báo kết quả thẩm định sự cố ${incidentCode || ''} (Đơn #${orderCode || ''})`,
      html: htmlContent
    });
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    console.log('[EmailService] Incident compensation rejection email sent:', info.messageId, previewUrl || '');
    return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
  } catch (error) {
    console.error('[EmailService] Error sending incident rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email thông báo ĐÃ CHI TRẢ TIỀN BỒI THƯỜNG kèm chứng từ để Khách hàng xác nhận (BF-04)
 */
const sendClaimPaymentRecordedEmail = async ({
  customerEmail,
  customerName,
  contactPerson,
  orderCode,
  claimCode,
  approvedAmount,
  paymentDate,
  transactionCode,
  paymentProofUrl,
  paymentNote,
  contactHotline = '1900 1234',
  trackingUrl
}) => {
  const mailTransporter = await getTransporter();
  const formattedAmount = Number(approvedAmount || 0).toLocaleString('vi-VN');
  const formattedDate = paymentDate ? escapeHtml(paymentDate) : new Date().toISOString().split('T')[0];

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px 10px; color: #1e293b; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #064e3b 0%, #059669 60%, #10b981 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
        .header-brand { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin-bottom: 8px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; line-height: 1.3; }
        .header p { margin: 8px 0 0; font-size: 13px; opacity: 0.92; }
        .content { padding: 28px; }
        .amount-card { background: #ecfdf5; border: 2px solid #10b981; border-radius: 14px; padding: 20px; text-align: center; margin: 18px 0; }
        .amount-label { font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 1px; }
        .amount-value { font-size: 30px; font-weight: 900; color: #047857; font-family: 'Consolas', monospace; margin: 6px 0; }
        .detail-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 18px 0; }
        .detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .detail-table td { padding: 7px 4px; border-bottom: 1px dashed #e2e8f0; vertical-align: top; }
        .detail-table tr:last-child td { border-bottom: none; }
        .td-label { color: #64748b; width: 180px; font-weight: 500; }
        .td-val { color: #0f172a; font-weight: 600; text-align: right; }
        .notice-box { background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 12px; padding: 16px 18px; margin: 18px 0; font-size: 13px; color: #78350f; line-height: 1.6; }
        .btn-wrap { text-align: center; margin: 24px 0 12px; }
        .btn { display: inline-block; background: #059669; color: #ffffff !important; padding: 13px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; text-decoration: none; }
        .proof-link { display: inline-block; margin-top: 8px; color: #0284c7; font-weight: 700; font-size: 13px; }
        .footer { background: #0f172a; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-brand">ALS · NEXLOG COMPENSATION PAYMENT</div>
          <h1>Thông Báo Đã Chuyển Khoản Bồi Thường</h1>
          <p>Hồ sơ ${escapeHtml(claimCode || '')} · Đơn hàng #${escapeHtml(orderCode || '')}</p>
        </div>
        <div class="content">
          <p style="font-size:15px;font-weight:700;margin-bottom:8px;">Kính gửi ${escapeHtml(customerName || 'Quý khách hàng')}${contactPerson ? ` (${escapeHtml(contactPerson)})` : ''},</p>
          <p style="font-size:14px;line-height:1.65;color:#475569;">
            Công ty Cổ phần Logistics Hàng không (ALS) đã hoàn tất thanh toán khoản bồi thường cho yêu cầu <b>${escapeHtml(claimCode || '')}</b> của đơn hàng <b>#${escapeHtml(orderCode || '')}</b>.
          </p>

          <div class="amount-card">
            <div class="amount-label">Số tiền đã chi trả</div>
            <div class="amount-value">${formattedAmount} VNĐ</div>
            <div style="font-size:12px;color:#065f46;">Ngày chuyển khoản: <b>${formattedDate}</b></div>
          </div>

          <div class="detail-box">
            <table class="detail-table">
              <tr><td class="td-label">Mã yêu cầu bồi thường:</td><td class="td-val">${escapeHtml(claimCode || 'N/A')}</td></tr>
              <tr><td class="td-label">Đơn hàng:</td><td class="td-val">#${escapeHtml(orderCode || 'N/A')}</td></tr>
              <tr><td class="td-label">Mã giao dịch (UNC):</td><td class="td-val">${escapeHtml(transactionCode || 'N/A')}</td></tr>
              <tr><td class="td-label">Ngày thanh toán:</td><td class="td-val">${formattedDate}</td></tr>
              ${paymentNote ? `<tr><td class="td-label">Ghi chú thanh toán:</td><td class="td-val">${escapeHtml(paymentNote)}</td></tr>` : ''}
            </table>
            ${paymentProofUrl ? `<div style="text-align:right;"><a href="${escapeHtml(paymentProofUrl)}" target="_blank" class="proof-link">Xem chứng từ / biên lai chuyển khoản &rarr;</a></div>` : ''}
          </div>

          <div class="notice-box">
            <b>Xác nhận đã nhận tiền (BF-04):</b><br/>
            Quý khách vui lòng truy cập trang tra cứu đơn hàng bên dưới và bấm nút <b>"Xác nhận đã nhận tiền bồi thường"</b> sau khi kiểm tra tài khoản.<br/>
            Lưu ý: Nếu không có phản hồi sau <b>07 ngày</b> kể từ ngày thanh toán, hệ thống sẽ tự động đóng hồ sơ với trạng thái đã bồi thường. Mọi thắc mắc vui lòng liên hệ Hotline <b>${escapeHtml(contactHotline || '1900 1234')}</b>.
          </div>

          ${trackingUrl ? `
          <div class="btn-wrap">
            <a href="${escapeHtml(trackingUrl)}" class="btn" target="_blank">Xác Nhận Đã Nhận Tiền Bồi Thường</a>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <div><b>CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG (ALS) — HỆ THỐNG ĐIỀU VẬN NEXLOG</b></div>
          <div>Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội · © 2026 NEXLOG Logistics. All rights reserved.</div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || `ALS NEXLOG Claims <${process.env.SMTP_USER || 'claims@nexlog.vn'}>`;
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: customerEmail || 'khachhang@example.com',
      subject: `[ALS - NEXLOG] Đã chuyển khoản bồi thường ${claimCode || ''} (Đơn #${orderCode || ''})`,
      html: htmlContent
    });
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    console.log('[EmailService] Claim payment recorded email sent:', info.messageId, previewUrl || '');
    return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
  } catch (error) {
    console.error('[EmailService] Error sending claim payment recorded email:', error);
    return { success: false, error: error.message };
  }
};


module.exports = {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail
};
