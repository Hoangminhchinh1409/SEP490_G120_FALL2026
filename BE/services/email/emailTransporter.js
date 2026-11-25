const nodemailer = require('nodemailer');

const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
      console.log('[EmailService] SMTP transport connected and verified.');
      return transporter;
    } catch (smtpErr) {
      console.warn(
        `[EmailService] SMTP verification failed (${smtpErr.code || smtpErr.name}). Falling back to Ethereal test email...`
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
    console.log('[EmailService] Created an Ethereal test email account.');
    return transporter;
  } catch (err) {
    console.warn('[EmailService] Could not create an Ethereal test email account.');
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('--------------------------------------------------');
        console.log('[EMAIL PREVIEW MOCK SENT]');
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

module.exports = {
  nodemailer,
  escapeHtml,
  getTransporter
};
