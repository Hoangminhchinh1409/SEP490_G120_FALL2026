const nodemailer = require('nodemailer');

// Cấu hình SMTP transport hoặc test account
let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  // Nếu có cấu hình SMTP thật trong .env
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
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
  agreedPrice,
  pickupAddress,
  deliveryAddress,
  cargoDescription,
  confirmUrl
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
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
        .info-card { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #cbd5e1; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 600; text-align: right; }
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
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Bộ phận Điều phối NEXLOG xin chân thành cảm ơn Quý khách đã tin tưởng và gửi yêu cầu vận chuyển từ Hệ thống Website. 
            Dưới đây là thông tin chi tiết đơn hàng và mức giá cước thỏa thuận đã được điều phối viên thẩm định lộ trình:
          </p>

          <div class="info-card">
            <div class="info-row">
              <span class="info-label">Mã vận đơn:</span>
              <span class="info-value" style="color: #4f46e5; font-family: monospace;">${orderCode}</span>
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
          </div>

          <div class="price-box">
            <div class="price-label">Giá cước trọn gói thỏa thuận</div>
            <div class="price-val">${formattedPrice} VNĐ</div>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
            Quý khách vui lòng nhấn vào nút bên dưới để xem lại thông tin chi tiết, chốt giá cước và hoàn thiện việc nộp chứng từ hồ sơ vận tải:
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
    const info = await mailTransporter.sendMail({
      from: '"NEXLOG Logistics" <no-reply@nexlog.vn>',
      to: customerEmail || 'khachhang@example.com',
      subject: `[NEXLOG] Xác nhận thông tin đơn hàng & Báo giá cước #${orderCode}`,
      html: htmlContent
    });
    console.log('[EmailService] Order confirmation email sent:', info.messageId);
    if (nodemailer.getTestMessageUrl && info) {
      console.log('[EmailService] Ethereal Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error('[EmailService] Error sending confirmation email:', error);
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
    const info = await mailTransporter.sendMail({
      from: '"NEXLOG Logistics" <contracts@nexlog.vn>',
      to: customerEmail || 'khachhang@example.com',
      subject: `[NEXLOG] Hợp đồng vận chuyển điện tử & Chữ ký số #${orderCode}`,
      html: htmlContent
    });
    console.log('[EmailService] Contract signing email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending contract signing email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOrderPriceConfirmationEmail,
  sendContractSigningEmail
};
