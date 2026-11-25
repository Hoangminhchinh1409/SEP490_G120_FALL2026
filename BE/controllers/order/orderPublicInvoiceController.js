const prisma = require("../../config/prisma");
const crypto = require("crypto");
const { parseOrderMeta } = require("../../services/orderHelperService");
const {
  generateInvoicePdfBuffer,
  generateInvoiceXml,
} = require("../../services/pdfService");

const INVOICE_TOKEN_SECRET =
  process.env.JWT_SECRET || "nexlog-public-invoice-secret";
const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const signPublicToken = (payload, ttlMs) => {
  const data = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(data), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", INVOICE_TOKEN_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
};

const verifyPublicToken = (token, expectedPurpose) => {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", INVOICE_TOKEN_SECRET)
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (!decoded || decoded.purpose !== expectedPurpose) return null;
    if (!decoded.exp || Date.now() > Number(decoded.exp)) return null;
    return decoded;
  } catch {
    return null;
  }
};

const normalizeTaxCode = (value) => String(value ?? "").replace(/\D/g, "");
const normalizeInvoiceCode = (value) =>
  String(value ?? "").trim().toUpperCase();

const buildInvoiceFilePayload = (order, meta, customer) => {
  const inv = meta?.invoice || {};
  const invoiceNumber = meta?.invoice_number || inv.invoice_number;
  const totalAmount = Number(inv.total_amount ?? order.agreed_price ?? 0);
  const vatRate = Number(inv.vat_rate ?? 8);
  const vatAmount = Number(inv.vat_amount ?? 0);
  const subtotalAmount = Math.max(0, totalAmount - vatAmount);

  return {
    invoiceNumber,
    orderCode: order.order_code,
    issuedAt: inv.issued_at || meta?.invoice_issued_at || order.updated_at,
    issuedBy: inv.issued_by || "Bộ phận Điều phối / Kế toán vận tải",
    customer: {
      company_name: customer?.company_name || "",
      tax_code: customer?.tax_code || "",
      registered_address: customer?.registered_address || "",
    },
    subtotalAmount,
    vatRate,
    vatAmount,
    totalAmount,
    authorizedBank: inv.authorized_bank || meta?.authorized_bank || "",
    notes: inv.notes || "",
  };
};

// 5.1. KHÁCH HÀNG: TẠO MÃ CAPTCHA TRA CỨU HÓA ĐƠN (PUBLIC)
const getPublicInvoiceCaptcha = async (req, res) => {
  try {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      const idx = crypto.randomInt(0, CAPTCHA_CHARS.length);
      code += CAPTCHA_CHARS[idx];
    }
    const captchaToken = signPublicToken(
      { purpose: "INVOICE_CAPTCHA", code },
      5 * 60 * 1000
    );
    return res.json({
      captcha_code: code,
      captcha_token: captchaToken,
      expires_in_seconds: 300,
    });
  } catch (err) {
    console.error("getPublicInvoiceCaptcha Error:", err);
    return res.status(500).json({ message: "Không thể tạo mã xác thực" });
  }
};

// 5.2. KHÁCH HÀNG: TRA CỨU HÓA ĐƠN ĐIỆN TỬ CÔNG KHAI (PUBLIC)
const lookupPublicInvoice = async (req, res) => {
  try {
    const {
      invoice_number,
      tax_code,
      from_date,
      to_date,
      captcha_code,
      captcha_token,
    } = req.body || {};

    if (!invoice_number || !tax_code || !captcha_code || !captcha_token) {
      return res.status(400).json({
        message:
          "Vui lòng nhập đầy đủ số hóa đơn, mã số thuế bên mua và mã xác thực.",
      });
    }

    const verifiedCaptcha = verifyPublicToken(captcha_token, "INVOICE_CAPTCHA");
    if (
      !verifiedCaptcha ||
      String(captcha_code).trim().toUpperCase() !== verifiedCaptcha.code
    ) {
      return res.status(400).json({
        message:
          "Mã xác thực (Captcha) không chính xác hoặc đã hết hạn. Vui lòng thử lại.",
      });
    }

    const rawTaxCode = String(tax_code).trim();
    const normalizedTax = normalizeTaxCode(rawTaxCode);
    if (!/^\d{10}(\d{3})?$/.test(normalizedTax)) {
      return res.status(400).json({
        message: "Mã số thuế doanh nghiệp phải gồm 10 hoặc 13 chữ số.",
      });
    }

    const customer = await prisma.customers.findFirst({
      where: {
        OR: [{ tax_code: rawTaxCode }, { tax_code: normalizedTax }],
      },
      select: {
        id: true,
        company_name: true,
        tax_code: true,
        registered_address: true,
      },
    });

    if (!customer) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn điện tử phù hợp với thông tin đã nhập.",
      });
    }

    const fromBound =
      from_date && /^\d{4}-\d{2}-\d{2}$/.test(String(from_date).trim())
        ? new Date(`${String(from_date).trim()}T00:00:00+07:00`)
        : null;
    const toBound =
      to_date && /^\d{4}-\d{2}-\d{2}$/.test(String(to_date).trim())
        ? new Date(`${String(to_date).trim()}T23:59:59.999+07:00`)
        : null;

    if (fromBound && toBound && fromBound > toBound) {
      return res.status(400).json({
        message: "Khoảng thời gian phát hành không hợp lệ (từ ngày lớn hơn đến ngày).",
      });
    }

    const orders = await prisma.orders.findMany({
      where: { customer_id: customer.id },
      select: {
        id: true,
        order_code: true,
        agreed_price: true,
        updated_at: true,
        order_notes: {
          select: { id: true, content: true, created_at: true },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { updated_at: "desc" },
    });

    const targetInvoice = normalizeInvoiceCode(invoice_number);
    let matchedOrder = null;
    let matchedMeta = null;

    for (const order of orders) {
      const meta = parseOrderMeta(order);
      const inv = meta?.invoice || {};
      const invNum = meta?.invoice_number || inv.invoice_number;
      const isIssued =
        meta?.invoice_status === "ISSUED_TO_ACCOUNTING" ||
        inv.status === "ISSUED_TO_ACCOUNTING";

      if (!isIssued || !invNum) continue;
      if (normalizeInvoiceCode(invNum) !== targetInvoice) continue;

      const issuedDate = new Date(
        inv.issued_at || meta.invoice_issued_at || order.updated_at
      );
      if (fromBound && !Number.isNaN(issuedDate.getTime()) && issuedDate < fromBound) {
        continue;
      }
      if (toBound && !Number.isNaN(issuedDate.getTime()) && issuedDate > toBound) {
        continue;
      }

      matchedOrder = order;
      matchedMeta = meta;
      break;
    }

    if (!matchedOrder || !matchedMeta) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn điện tử phù hợp với thông tin đã nhập.",
      });
    }

    const payload = buildInvoiceFilePayload(matchedOrder, matchedMeta, customer);
    const downloadToken = signPublicToken(
      {
        purpose: "INVOICE_DOWNLOAD",
        order_id: String(matchedOrder.id),
        invoice_number: payload.invoiceNumber,
      },
      15 * 60 * 1000
    );

    return res.json({
      invoice: {
        invoice_number: payload.invoiceNumber,
        order_code: payload.orderCode,
        status: "ISSUED_TO_ACCOUNTING",
        status_label: "Đã phát hành / Bàn giao kế toán",
        issued_at: payload.issuedAt,
        issued_by: payload.issuedBy,
        customer_name: payload.customer.company_name,
        tax_code: payload.customer.tax_code,
        registered_address: payload.customer.registered_address,
        subtotal_amount: payload.subtotalAmount,
        vat_rate: payload.vatRate,
        vat_amount: payload.vatAmount,
        total_amount: payload.totalAmount,
        authorized_bank: payload.authorizedBank,
        notes: payload.notes,
        download_token: downloadToken,
      },
    });
  } catch (err) {
    console.error("lookupPublicInvoice Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 5.3. KHÁCH HÀNG: TẢI BẢN THỂ HIỆN PDF HOẶC XML HÓA ĐƠN ĐIỆN TỬ (PUBLIC)
const downloadPublicInvoiceFile = async (req, res) => {
  try {
    const { downloadToken } = req.params;
    const format = String(req.query?.format || "pdf").toLowerCase();

    const verified = verifyPublicToken(downloadToken, "INVOICE_DOWNLOAD");
    if (!verified || !verified.order_id) {
      return res.status(401).json({
        message:
          "Liên kết tải hóa đơn đã hết hạn hoặc không hợp lệ. Vui lòng tra cứu lại.",
      });
    }

    const order = await prisma.orders.findUnique({
      where: { id: BigInt(verified.order_id) },
      select: {
        id: true,
        order_code: true,
        agreed_price: true,
        updated_at: true,
        customers: {
          select: {
            company_name: true,
            tax_code: true,
            registered_address: true,
          },
        },
        order_notes: {
          select: { id: true, content: true, created_at: true },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    }

    const meta = parseOrderMeta(order);
    const inv = meta?.invoice || {};
    const invNum = meta?.invoice_number || inv.invoice_number;
    const isIssued =
      meta?.invoice_status === "ISSUED_TO_ACCOUNTING" ||
      inv.status === "ISSUED_TO_ACCOUNTING";

    if (
      !isIssued ||
      !invNum ||
      normalizeInvoiceCode(invNum) !== normalizeInvoiceCode(verified.invoice_number)
    ) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    }

    const payload = buildInvoiceFilePayload(order, meta, order.customers);
    const safeFileName = String(payload.invoiceNumber).replace(
      /[^A-Za-z0-9_-]/g,
      "_"
    );

    if (format === "xml") {
      const xmlContent = generateInvoiceXml(payload);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="HoaDon_${safeFileName}.xml"`
      );
      return res.send(xmlContent);
    }

    const pdfBuffer = await generateInvoicePdfBuffer(payload);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="HoaDon_${safeFileName}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("downloadPublicInvoiceFile Error:", err);
    return res.status(500).json({ message: "Không thể xuất tệp hóa đơn" });
  }
};

module.exports = {
  getPublicInvoiceCaptcha,
  lookupPublicInvoice,
  downloadPublicInvoiceFile,
};
