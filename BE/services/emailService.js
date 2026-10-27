const nodemailer = require('nodemailer');

// Cấu hình SMTP transport hoặc test account
let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  // Sử dụng cấu hình SMTP thật từ .env (Tham khảo chuẩn dự án FITFLOW)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const realTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
        auth: {
          user: process.env.SMTP_USER.trim(),
          pass: process.env.SMTP_PASS.replace(/\s+/g, ''),
        },
      });
      await realTransporter.verify();
      transporter = realTransporter;
      console.log('[EmailService] Connected & verified Gmail SMTP Service with account:', process.env.SMTP_USER);
      return transporter;
    } catch (smtpErr) {
      console.warn(
        `[EmailService] Gmail SMTP verify failed for ${process.env.SMTP_USER} (${smtpErr.message}). Falling back to Ethereal test email...`
      );
    }
  }

  // Chế độ Development / Demo: Sử dụng Ethereal hoặc console preview
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[EmailService] Created ethereal test email account:', testAccount.user);
    return transporter;
  } catch (err) {
    console.warn('[EmailService] Could not create Ethereal test account, fallback to direct console log:', err.message);
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('--------------------------------------------------');
        console.log('[EMAIL PREVIEW MOCK SENT]');
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('--------------------------------------------------');
        return { messageId: `mock-${Date.now()}` };
      }
    };
    return transporter;
  }
};

/**
 * Gửi email xác nhận tiếp nhận đơn & gửi link chốt giá cước tới khách hàng
 */
const sendOrderPriceConfirmationEmail = async ({
  customerEmail,
  customerName,
  orderCode,
  orderType,
  agreedPrice,
  pickupAddress,
  deliveryAddress,
  cargoDescription,
  pickupDate,
  flightSchedule,
  confirmUrl
}) => {
  const mailTransporter = await getTransporter();
  const formattedPrice = (agreedPrice || 0).toLocaleString('vi-VN');
  const isExport = (orderType || '').toUpperCase().includes('EXPORT') || (orderType || '').toUpperCase().includes('XUẤT');
  const typeText = isExport ? 'ĐƠN HÀNG XUẤT KHẨU (AIR CARGO EXPORT)' : 'ĐƠN HÀNG NHẬP KHẨU (AIR CARGO IMPORT)';
  const typeBadgeColor = isExport ? '#4f46e5' : '#0284c7';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
        .container { max-width: 620px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, ${typeBadgeColor} 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
        .type-badge { display: inline-block; padding: 6px 14px; background: #e0e7ff; color: #3730a3; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 12px; }
        .info-card { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #cbd5e1; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 600; text-align: right; }
        .warning-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; color: #92400e; line-height: 1.5; }
        .price-box { background: #eef2ff; border: 2px dashed #6366f1; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
        .price-label { font-size: 13px; color: #4338ca; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .price-val { font-size: 28px; color: #4f46e5; font-weight: 800; margin-top: 4px; font-family: monospace; }
        .btn-container { text-align: center; margin: 32px 0 16px; }
        .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35); }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>NEXLOG LOGISTICS</h1>
          <p>Xác nhận Yêu cầu Đơn hàng &amp; Báo giá Cước vận chuyển</p>
        </div>
        <div class="content">
          <div class="greeting">Kính gửi Quý khách: ${customerName || 'Quý khách hàng'},</div>
          <div style="text-align: center;">
            <span class="type-badge">📦 ${typeText}</span>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Bộ phận Điều phối NEXLOG xin chân thành cảm ơn Quý khách đã tin tưởng và gửi yêu cầu vận chuyển từ Hệ thống. 
            Dưới đây là thông tin chi tiết đơn hàng, lịch trình đề xuất và mức giá cước thỏa thuận đã được thẩm định:
          </p>

          <div class="info-card">
            <div class="info-row">
              <span class="info-label">Mã vận đơn:</span>
              <span class="info-value" style="color: #4f46e5; font-family: monospace;">${orderCode}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phân loại đơn:</span>
              <span class="info-value" style="color: ${isExport ? '#4338ca' : '#0369a1'};">${isExport ? 'Hàng Xuất Khẩu (Export)' : 'Hàng Nhập Khẩu (Import)'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Hàng hóa &amp; Quy cách:</span>
              <span class="info-value">${cargoDescription || 'Hàng bách hóa / Linh kiện'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Điểm lấy hàng:</span>
              <span class="info-value">${pickupAddress}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Điểm giao hàng:</span>
              <span class="info-value">${deliveryAddress}</span>
            </div>
            ${pickupDate ? `
            <div class="info-row">
              <span class="info-label">${isExport ? 'Lịch xe đến lấy hàng đề xuất:' : 'Ngày giờ dự kiến dỡ hàng khỏi máy bay:'}</span>
              <span class="info-value" style="color: #b45309; font-weight: 700;">${pickupDate}</span>
            </div>
            ` : ''}
            ${flightSchedule ? `
            <div class="info-row">
              <span class="info-label">${isExport ? 'Lịch bay xuất khẩu (ETD):' : 'Lịch hạ cánh:'}</span>
              <span class="info-value" style="color: #0369a1; font-weight: 600;">${flightSchedule}</span>
            </div>
            ` : ''}
          </div>

          ${isExport ? `
          <div class="warning-box">
            <b>⚠️ QUY ĐỊNH VẬN CHUYỂN HÀNG XUẤT KHẨU:</b><br/>
            - Thời gian đến lấy hàng trên đã được Điều phối tính toán dựa trên khoảng cách di chuyển và thời gian cut-off kho ALS / kiểm tra an ninh sân bay.<br/>
            - Quý khách vui lòng kiểm tra và thống nhất ngày lấy hàng. <b>Trường hợp Quý khách vẫn quyết định chọn ngày lấy hàng trễ hơn khuyến nghị dẫn đến muộn lịch bay, chi phí đổi chuyến bay khác hoặc chi phí lưu kho phát sinh sẽ do Quý khách tự chịu trách nhiệm. Hệ thống và điều phối NEXLOG sẽ không chịu trách nhiệm trong trường hợp này.</b>
          </div>
          ` : ''}

          <div class="price-box">
            <div class="price-label">Giá cước trọn gói thỏa thuận</div>
            <div class="price-val">${formattedPrice} VNĐ</div>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; margin: 16px 0; text-align: center;">
            <div style="font-size: 13px; font-weight: bold; color: #166534; margin-bottom: 6px;">
              💬 Cần thương lượng giá hoặc đổi lịch trình ngay?
            </div>
            <p style="font-size: 12px; color: #15803d; margin: 0 0 10px;">
              Quý khách có thể trao đổi trực tiếp với Điều phối viên phụ trách đơn hàng qua Hotline hoặc Zalo:
            </p>
            <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
              <a href="tel:0988123456" style="display: inline-block; background: #16a34a; color: #ffffff !important; padding: 8px 18px; border-radius: 8px; font-weight: bold; font-size: 12px; text-decoration: none;">
                📞 Gọi Hotline: 0988 123 456
              </a>
              <a href="https://zalo.me/0988123456" target="_blank" style="display: inline-block; background: #0284c7; color: #ffffff !important; padding: 8px 18px; border-radius: 8px; font-weight: bold; font-size: 12px; text-decoration: none;">
                💬 Chat Zalo Điều Phối
              </a>
            </div>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
            Quý khách đồng ý với thông tin trên vui lòng nhấn vào nút bên dưới để chốt đơn và chuyển sang nộp chứng từ:
          </p>

          <div class="btn-container">
            <a href="${confirmUrl}" class="btn" target="_blank">Xem Chi Tiết &amp; Chốt Đơn Hàng</a>
          </div>
          
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">
            Link xác nhận trực tiếp: <br/>
            <a href="${confirmUrl}" style="color: #6366f1; word-break: break-all;">${confirmUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p>Hotline Điều phối: 1900 6868 | Email: dispatch@nexlog.vn</p>
          <p>© 2026 NEXLOG Supply Chain Solution. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || `NEXLOG Logistics <${process.env.SMTP_USER || 'no-reply@nexlog.vn'}>`;
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: customerEmail || 'khachhang@example.com',
      subject: `[NEXLOG] Xác nhận ${isExport ? 'Đơn hàng Xuất Khẩu' : 'Đơn hàng Nhập Khẩu'} & Báo giá cước #${orderCode}`,
      html: htmlContent
    });
    console.log('[EmailService] Order confirmation email sent:', info.messageId);
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    if (previewUrl) {
      console.log('[EmailService] Ethereal Preview URL:', previewUrl);
    }
    return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
  } catch (error) {
    console.error('[EmailService] Error sending confirmation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email thông báo từ chối chứng từ & yêu cầu khách hàng tải lại chứng từ
 */
const sendDocumentRejectionEmail = async ({
  customerEmail,
  customerName,
  orderCode,
  rejectedDocName,
  rejectReason,
  reuploadUrl
}) => {
  const mailTransporter = await getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
        .container { max-width: 620px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .content { padding: 28px; }
        .reject-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 18px 0; color: #991b1b; }
        .btn-container { text-align: center; margin: 28px 0 12px; }
        .btn { display: inline-block; background: #dc2626; color: #ffffff !important; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; }
        .footer { background: #f8fafc; padding: 18px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>YÊU CẦU CẬP NHẬT LẠI CHỨNG TỪ</h1>
          <p>Đơn hàng vận chuyển #${orderCode}</p>
        </div>
        <div class="content">
          <p style="font-size: 14px; line-height: 1.6;">
            Kính gửi Quý khách <b>${customerName || 'Quý khách'}</b>,<br/>
            Trong quá trình kiểm duyệt hồ sơ pháp lý cho đơn hàng <b>#${orderCode}</b>, Bộ phận Điều phối NEXLOG phát hiện chứng từ sau cần được cung cấp lại:
          </p>

          <div class="reject-box">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">
              ❌ Chứng từ bị từ chối: ${rejectedDocName}
            </div>
            <div style="font-size: 13px;">
              <b>Lý do yêu cầu tải lại:</b> ${rejectReason || 'Tệp đính kèm chưa hợp lệ hoặc bị mờ, vui lòng tải lại tệp đúng quy định.'}
            </div>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Quý khách vui lòng nhấn vào đường liên kết bên dưới để tải lại tệp mới cho mục <b>${rejectedDocName}</b>. Sau khi nhận được tệp bổ sung hợp lệ, Điều phối viên sẽ phê duyệt và gửi Hợp đồng điện tử ngay lập tức:
          </p>

          <div class="btn-container">
            <a href="${reuploadUrl}" class="btn" target="_blank">Tải Lại Chứng Từ Ngay</a>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px;">
            Link cập nhật chứng từ trực tiếp:<br/>
            <a href="${reuploadUrl}" style="color: #dc2626; word-break: break-all;">${reuploadUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p>NEXLOG Logistics - Hotline Điều phối: 1900 6868</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || `NEXLOG Logistics <${process.env.SMTP_USER || 'no-reply@nexlog.vn'}>`;
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: customerEmail || 'khachhang@example.com',
      subject: `[NEXLOG] Yêu cầu tải lại chứng từ "${rejectedDocName}" - Đơn hàng #${orderCode}`,
      html: htmlContent
    });
    console.log('[EmailService] Document rejection email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending document rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email kèm hợp đồng điện tử & Link ký chữ ký số sau khi Điều phối viên duyệt chứng từ
 */
const sendContractSigningEmail = async ({
  customerEmail,
  customerName,
  orderCode,
  agreedPrice,
  contractSignUrl
}) => {
  const mailTransporter = await getTransporter();
  const formattedPrice = (agreedPrice || 0).toLocaleString('vi-VN');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
        .container { max-width: 620px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 32px 28px; }
        .badge-success { display: inline-block; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 999px; padding: 6px 16px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
        .btn-container { text-align: center; margin: 32px 0 16px; }
        .btn { display: inline-block; background: #059669; color: #ffffff !important; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35); }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>HỢP ĐỒNG VẬN TẢI ĐIỆN TỬ</h1>
          <p>Hồ sơ chứng từ đã được phê duyệt hợp lệ</p>
        </div>
        <div class="content">
          <div style="text-align: center;">
            <span class="badge-success">✓ HỒ SƠ CHỨNG TỪ ĐÃ ĐƯỢC DUYỆT</span>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Kính gửi Quý khách <b>${customerName || 'Quý khách'}</b>,<br/>
            Hồ sơ chứng từ xuất nhập khẩu cho đơn hàng <b>${orderCode}</b> (Giá trị: <b>${formattedPrice} VNĐ</b>) đã được Bộ phận Điều phối NEXLOG thẩm định đạt chuẩn pháp lý.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Chúng tôi đã khởi tạo bản Hợp đồng vận chuyển điện tử. Quý khách vui lòng kiểm tra và ký số trực tuyến trên giao diện ký điện tử chính thức:
          </p>

          <div class="btn-container">
            <a href="${contractSignUrl}" class="btn" target="_blank">Ký Chữ Ký Số Hợp Đồng</a>
          </div>

          <p style="font-size: 12px; color: #64748b; line-height: 1.6; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px dashed #cbd5e1;">
            💡 Sau khi Quý khách hoàn tất ký số, hệ thống sẽ tự động lưu hợp đồng vào hồ sơ đơn hàng và kích hoạt công đoạn xếp phương tiện &amp; điều xe vận chuyển ngay lập tức.
          </p>
        </div>
        <div class="footer">
          <p>NEXLOG Logistics - Dịch vụ Vận tải Hàng không &amp; Đường bộ tiêu chuẩn Quốc tế</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = process.env.SMTP_FROM || `NEXLOG Logistics <${process.env.SMTP_USER || 'contracts@nexlog.vn'}>`;
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: customerEmail || 'khachhang@example.com',
      subject: `[NEXLOG] Hợp đồng vận chuyển điện tử & Chữ ký số #${orderCode}`,
      html: htmlContent
    });
    console.log('[EmailService] Contract signing email sent:', info.messageId);
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    if (previewUrl) {
      console.log('[EmailService] Ethereal Preview URL:', previewUrl);
    }
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || null
    };
  } catch (error) {
    console.error('[EmailService] Error sending contract signing email:', error);
    return { success: false, error: error.message };
  }
};

const sendPasswordResetEmail = async ({ email, customerName, resetUrl }) => {
  const mailTransporter = await getTransporter();
  const fromAddress = process.env.SMTP_FROM || `NEXLOG Logistics <${process.env.SMTP_USER || 'no-reply@nexlog.vn'}>`;

  const info = await mailTransporter.sendMail({
    from: fromAddress,
    to: email,
    subject: '[NEXLOG] Yêu cầu đặt lại mật khẩu',
    text: `Xin chào ${customerName || 'bạn'},\n\nĐể đặt lại mật khẩu NEXLOG, hãy mở liên kết sau (có hiệu lực trong 60 phút):\n${resetUrl}\n\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 24px auto; color: #1e293b;">
        <h2>Đặt lại mật khẩu NEXLOG</h2>
        <p>Xin chào,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Liên kết có hiệu lực trong 60 phút.</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px;">Đặt lại mật khẩu</a></p>
        <p>Nếu nút không hoạt động, hãy sao chép liên kết sau vào trình duyệt:<br><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
      </div>
    `
  });

  if (info.messageId && info.messageId.startsWith('mock-')) {
    throw new Error('Password reset email was not delivered because SMTP is not configured');
  }

  return { success: true, messageId: info.messageId };
};

module.exports = {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail,
  sendContractSigningEmail,
  sendPasswordResetEmail
};
