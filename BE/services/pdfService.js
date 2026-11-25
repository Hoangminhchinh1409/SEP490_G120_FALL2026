let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  PDFDocument = null;
}
const fs = require('fs');

/**
 * Hàm đọc số thành chữ tiếng Việt (hỗ trợ đến hàng trăm tỷ)
 */
function readVietnameseCurrency(number) {
  if (!number || isNaN(number) || number === 0) return 'Không đồng';
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const units = ['', 'nghìn', 'triệu', 'tỷ'];

  function readThreeDigits(n, full) {
    let res = '';
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;

    if (h > 0 || full) {
      res += digits[h] + ' trăm ';
    }
    if (t > 1) {
      res += digits[t] + ' mươi ';
      if (o === 1) res += 'mốt ';
      else if (o === 5) res += 'lăm ';
      else if (o > 0) res += digits[o] + ' ';
    } else if (t === 1) {
      res += 'mười ';
      if (o === 5) res += 'lăm ';
      else if (o > 0) res += digits[o] + ' ';
    } else if (t === 0 && o > 0) {
      if (h > 0 || full) res += 'lẻ ';
      res += digits[o] + ' ';
    }
    return res;
  }

  let num = Math.abs(Math.round(number));
  let result = '';
  let unitIndex = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkStr = readThreeDigits(chunk, num >= 1000);
      result = chunkStr + units[unitIndex] + ' ' + result;
    }
    num = Math.floor(num / 1000);
    unitIndex++;
  }

  result = result.trim();
  if (!result) return 'Không đồng';
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn';
}

/**
 * Sinh file PDF Hợp đồng vận chuyển hàng hóa đường bộ
 * Chuẩn xác 100% theo bản mẫu PDF Nghị định 158/2024/NĐ-CP & Luật Đường bộ 2024 (16OACyc_-IgKSIT68P9uKx0FTZUxnABm1nkkZ7vAfeSw.pdf)
 * @param {Object} params
 * @returns {Promise<Buffer>}
 */
const generateContractPdfBuffer = async ({
  orderCode,
  contractDetails = {},
  customTerms = [],
  customer = {}
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 45,
        size: 'A4',
        info: {
          Title: `HopDongVanTai_${orderCode}`,
          Author: 'NEXLOG - ALS Logistics',
          Subject: 'Hợp đồng vận chuyển hàng hóa đường bộ (NĐ 158/2024/NĐ-CP)'
        }
      });

      // Đăng ký font Times New Roman chuẩn Windows hỗ trợ tiếng Việt
      const regularFont = 'C:/Windows/Fonts/times.ttf';
      const boldFont = 'C:/Windows/Fonts/timesbd.ttf';
      const italicFont = 'C:/Windows/Fonts/timesi.ttf';
      const boldItalicFont = 'C:/Windows/Fonts/timesbi.ttf';

      const hasTimes = fs.existsSync(regularFont);
      if (hasTimes) {
        doc.registerFont('Times', regularFont);
        doc.registerFont('Times-Bold', boldFont);
        doc.registerFont('Times-Italic', italicFont);
        doc.registerFont('Times-BoldItalic', boldItalicFont);
      }

      const fontReg = hasTimes ? 'Times' : 'Helvetica';
      const fontBold = hasTimes ? 'Times-Bold' : 'Helvetica-Bold';
      const fontItalic = hasTimes ? 'Times-Italic' : 'Helvetica-Oblique';

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();

      // TRANG 1: TIÊU ĐỀ & CHỦ THỂ & ĐIỀU 1
      doc.font(fontBold).fontSize(13).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });
      doc.font(fontBold).fontSize(12).text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });
      doc.font(fontReg).fontSize(11).text('---o0o---', { align: 'center' });
      doc.moveDown(0.7);

      doc.font(fontBold).fontSize(16).text('HỢP ĐỒNG VẬN TẢI', { align: 'center' });
      doc.font(fontItalic).fontSize(11).text(`Số: ${orderCode}/HĐVT-${year}`, { align: 'center' });
      doc.moveDown(0.7);

      doc.font(fontItalic).fontSize(10.5);
      doc.text('- Căn cứ Bộ luật Dân sự số 91/2015/QH13;');
      doc.text('- Căn cứ Luật Đường bộ số 35/2024/QH15;');
      doc.text('- Căn cứ Nghị định số 158/2024/NĐ-CP quy định về hoạt động vận tải đường bộ;');
      doc.text(`- Hôm nay, ngày ${day} tháng ${month} năm ${year}, tại Trụ sở Ban Điều vận ALS Nội Bài, chúng tôi gồm có:`);
      doc.moveDown(0.7);

      // BÊN A
      doc.font(fontBold).fontSize(11).text('BÊN VẬN TẢI (BÊN A): ĐƠN VỊ KINH DOANH VẬN TẢI');
      doc.font(fontReg).fontSize(10.5);
      doc.text(`● Tên đơn vị kinh doanh vận tải: ${contractDetails.carrier_name || 'CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG (ALS)'}`);
      doc.text(`● Địa chỉ trụ sở: ${contractDetails.carrier_address || 'Cảng Hàng không Quốc tế Nội Bài, Xã Phú Minh, Huyện Sóc Sơn, TP. Hà Nội'}`);
      doc.text(`● Điện thoại liên hệ: ${contractDetails.carrier_phone || '1900 3133 / 0988 123 456'}`);
      doc.text(`● Mã số thuế: ${contractDetails.carrier_tax_code || '0102345678'}`);
      doc.text(`● Đại diện theo pháp luật / Người ủy quyền ký hợp đồng: ${contractDetails.carrier_rep || 'Ban Điều phối Vận tải Hàng không ALS'}`);
      doc.text(`● Số định danh cá nhân (Số CCCD): ${contractDetails.carrier_cid || '001092008899'}`);
      doc.moveDown(0.7);

      // BÊN B
      const custName = contractDetails.customer_name || customer.company_name || 'Khách hàng NEXLOG';
      const custTax = contractDetails.customer_tax_code || customer.tax_code || 'Chưa cung cấp';
      const custAddr = contractDetails.customer_address || customer.registered_address || 'Theo địa chỉ khách hàng cung cấp';
      const custPhone = contractDetails.customer_phone || customer.phone || 'Chưa cung cấp';
      const custEmail = contractDetails.customer_email || customer.email || 'Chưa cung cấp';

      doc.font(fontBold).fontSize(11).text('BÊN THUÊ VẬN TẢI / HÀNH KHÁCH (BÊN B)');
      doc.font(fontReg).fontSize(10.5);
      doc.text(`● Tên tổ chức / cá nhân thuê vận tải: ${custName}`);
      doc.text(`● Số định danh cá nhân (Số CCCD) / Mã số doanh nghiệp: ${custTax}`);
      doc.text(`● Địa chỉ: ${custAddr}`);
      doc.text(`● Số điện thoại liên hệ: ${custPhone}    |  Email: ${custEmail}`);
      doc.moveDown(0.7);

      doc.font(fontItalic).fontSize(10.5).text('Hai bên cùng thỏa thuận và ký kết Hợp đồng vận tải với các điều khoản cụ thể sau đây:');
      doc.moveDown(0.7);

      // ĐIỀU 1
      doc.font(fontBold).fontSize(11).text('Điều 1. Thông tin chi tiết về việc thực hiện hợp đồng');
      doc.font(fontReg).fontSize(10.5);
      doc.text('1. Thời gian thực hiện:');
      doc.text(`   ○ Thời gian bắt đầu thực hiện (ngày, giờ): ${contractDetails.pickup_time || 'Theo thông báo điều vận của ALS'}`);
      doc.text(`   ○ Thời gian kết thúc hợp đồng: ${contractDetails.delivery_time || 'Sau khi hoàn tất giao trả hàng hóa và ký nhận Biên bản giao nhận (POD)'}`);
      doc.text('2. Hành trình vận chuyển:');
      doc.text(`   ○ Địa chỉ điểm đầu: ${contractDetails.pickup_address || 'Kho hàng theo chỉ định'}`);
      doc.text(`   ○ Địa chỉ điểm cuối: ${contractDetails.delivery_address || 'Kho giao hàng theo chỉ định'}`);
      doc.text('   ○ Các điểm đón, trả khách (hoặc xếp, dỡ hàng hóa) trên hành trình: Theo lộ trình gán chuyến của Điều phối viên ALS');
      doc.text(`   ○ Cự ly của hành trình vận chuyển: ${contractDetails.distance_km || 35.5} km.`);
      doc.text('3. Số lượng đối tượng vận chuyển:');
      doc.text(`   ○ Khối lượng hàng hóa thực tế: ${contractDetails.weight || 0} kg  |  Trọng lượng tính cước: ${contractDetails.chargeable_weight || contractDetails.weight || 0} kg  |  Quy cách: ${contractDetails.package_info || (contractDetails.cargo_name || 'Hàng hóa thông thường')}`);
      doc.text(`   ○ Phương án phương tiện Bên A bố trí: ${contractDetails.truck_model || 'Xe tải chuyên dụng ALS'}`);

      // TRANG 2: ĐIỀU 2 ĐẾN ĐIỀU 6 & CHỮ KÝ
      doc.addPage();

      // ĐIỀU 2
      const priceNum = Number(contractDetails.price_amount || 0);
      const formattedPrice = priceNum.toLocaleString('vi-VN');
      const priceInWords = readVietnameseCurrency(priceNum);

      doc.font(fontBold).fontSize(11).text('Điều 2. Giá trị hợp đồng và phương thức thanh toán');
      doc.font(fontReg).fontSize(10.5);
      doc.text(`1. Tổng giá trị hợp đồng: ${formattedPrice} VNĐ (Bằng chữ: ${priceInWords}) (Mức giá trên đã bao gồm toàn bộ chi phí cầu đường, nhiên liệu tiêu chuẩn và các nghĩa vụ thuế theo quy định của pháp luật).`);
      doc.text(`2. Phương thức thanh toán: ${contractDetails.payment_method || 'Chuyển khoản ngân hàng hoặc tiền mặt'}`);
      doc.text(`3. Thời hạn thanh toán: ${contractDetails.payment_term || 'Trong vòng 07 ngày làm việc kể từ ngày hoàn tất giao hàng kèm xuất trình biên bản giao nhận có chữ ký (POD đầy đủ).'}`);
      doc.moveDown(0.7);

      // ĐIỀU 3
      doc.font(fontBold).fontSize(11).text('Điều 3. Quyền và nghĩa vụ của Bên A (Bên vận tải)');
      doc.font(fontReg).fontSize(10.5);
      doc.text('1. Cung cấp phương tiện vận chuyển đúng chất lượng, đúng thời gian và địa điểm đã thỏa thuận tại Điều 1; đảm bảo phương tiện đáp ứng đầy đủ các điều kiện an toàn kỹ thuật theo quy định pháp luật.');
      doc.text('2. Thực hiện nghiêm chỉnh các nghĩa vụ thuế đối với Nhà nước liên quan đến hoạt động cung cấp dịch vụ vận tải theo hợp đồng này.');
      doc.text('3. Mua bảo hiểm trách nhiệm dân sự của chủ xe cơ giới đối với hàng hóa theo quy định pháp luật.');
      doc.text('4. Có quyền yêu cầu Bên B thanh toán đầy đủ, đúng hạn giá trị hợp đồng; từ chối vận chuyển nếu Bên B vi phạm các quy định về an toàn, cấm vận chuyển hàng hóa nguy hiểm, chất cấm.');
      doc.text(`5. Đường dây nóng tiếp nhận phản ánh, khiếu nại, tố cáo: ${contractDetails.carrier_phone || '1900 3133 / 0988 123 456'}.`);
      doc.moveDown(0.7);

      // ĐIỀU 4
      doc.font(fontBold).fontSize(11).text('Điều 4. Quyền và nghĩa vụ của Bên B (Bên thuê vận tải / Khách hàng)');
      doc.font(fontReg).fontSize(10.5);
      doc.text('1. Thanh toán đầy đủ giá trị hợp đồng cho Bên A theo đúng thời hạn và phương thức đã thỏa thuận.');
      doc.text('2. Cung cấp chính xác, đầy đủ thông tin về hàng hóa và tạo điều kiện thuận lợi để Bên A thực hiện việc xếp dỡ hàng hóa đúng tiến độ.');
      doc.text('3. Chấp hành nghiêm chỉnh các quy định về an toàn giao thông, nội quy trên phương tiện vận chuyển; không gửi hàng cấm, vũ khí, chất cháy nổ hoặc hàng hóa vi phạm pháp luật.');
      doc.text('4. Có quyền yêu cầu Bên A bồi thường thiệt hại nếu Bên A vi phạm cam kết trong hợp đồng gây thiệt hại về hàng hóa.');
      doc.moveDown(0.7);

      // ĐIỀU 5
      doc.font(fontBold).fontSize(11).text('Điều 5. Cam kết thực hiện và đền bù thiệt hại');
      doc.font(fontReg).fontSize(10.5);
      doc.text('1. Hai bên cam kết thực hiện nghiêm túc các điều khoản đã thỏa thuận trong hợp đồng này. Mọi sửa đổi, bổ sung phải được sự đồng ý bằng văn bản của cả hai bên.');
      doc.text('2. Quy định về đền bù thiệt hại:');
      doc.text('   ○ Trường hợp Bên A vi phạm cam kết dẫn đến việc chậm trễ thời gian, hủy chuyến hoặc làm hư hỏng, mất mát tài sản (hàng hóa) của Bên B do lỗi chủ quan của Bên A, Bên A chịu trách nhiệm đền bù thiệt hại thỏa đáng theo thỏa thuận hoặc theo quy định của pháp luật hiện hành.');
      doc.text('   ○ Trường hợp miễn trách nhiệm cho Bên A: Nếu Bên A đã chủ động liên hệ trước với Bên B để thông báo về lịch trình/thời gian di chuyển, nhưng khi phương tiện hoặc nhân sự của Bên A đến điểm giao nhận đúng theo thông báo mà đại diện hoặc người nhận của Bên B vắng mặt, không có người tiếp nhận, thì mọi gián đoạn, phát sinh hoặc thiệt hại liên quan được tính là lỗi thuộc về Bên B. Trong trường hợp này, Bên A được miễn toàn bộ trách nhiệm về việc chậm trễ các điểm tiếp theo và có quyền áp dụng chi phí chờ đợi (100.000 VNĐ / block 30 phút sau 60 phút miễn phí), chi phí lưu kho/bãi hoặc chi phí vận chuyển phát sinh (nếu có) theo quy định của công ty.');
      doc.text('   ○ Trường hợp Bên B hủy hợp đồng hoặc vi phạm các nghĩa vụ gây thiệt hại cho Bên A, Bên B chịu trách nhiệm bồi thường chi phí phát sinh thực tế cho Bên A.');
      doc.moveDown(0.7);

      // ĐIỀU 6
      doc.font(fontBold).fontSize(11).text('Điều 6. Điều khoản thi hành');
      doc.font(fontReg).fontSize(10.5);
      doc.text('1. Hợp đồng này có hiệu lực kể từ ngày ký.');
      doc.text('2. Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện.');
      doc.moveDown(1.5);

      // KÝ TÊN HAI BÊN
      const signY = doc.y;
      doc.font(fontBold).fontSize(11);
      doc.text('ĐẠI DIỆN BÊN A (VẬN TẢI)', 45, signY, { width: 230, align: 'center' });
      doc.text('ĐẠI DIỆN BÊN B (THUÊ VẬN TẢI)', 320, signY, { width: 230, align: 'center' });

      doc.font(fontItalic).fontSize(10);
      doc.text('(Ký, đóng dấu và ghi rõ họ tên)', 45, signY + 16, { width: 230, align: 'center' });
      doc.text('(Ký và ghi rõ họ tên)', 320, signY + 16, { width: 230, align: 'center' });

      doc.font(fontBold).fontSize(10.5);
      doc.text(contractDetails.carrier_rep || 'Ban Điều phối Vận tải Hàng không ALS', 45, signY + 75, { width: 230, align: 'center' });
      doc.text(custName, 320, signY + 75, { width: 230, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const escapeXml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const formatVnDate = (isoOrDate) => {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatVnMoney = (num) => `${Math.round(Number(num) || 0).toLocaleString('vi-VN')} VNĐ`;

/**
 * Sinh bản thể hiện PDF Hóa đơn GTGT điện tử (Thông tư 78 / NĐ-123)
 */
const generateInvoicePdfBuffer = async ({
  invoiceNumber,
  orderCode,
  issuedAt,
  issuedBy,
  customer = {},
  subtotalAmount = 0,
  vatRate = 8,
  vatAmount = 0,
  totalAmount = 0,
  authorizedBank = '',
  notes = ''
}) => {
  return new Promise((resolve, reject) => {
    try {
      if (!PDFDocument) {
        return reject(new Error('Thư viện pdfkit chưa được cài đặt'));
      }

      const doc = new PDFDocument({
        margin: 45,
        size: 'A4',
        info: {
          Title: `HoaDonGTGT_${invoiceNumber}`,
          Author: 'NEXLOG Logistics',
          Subject: 'Hóa đơn giá trị gia tăng điện tử'
        }
      });

      const regularFont = 'C:/Windows/Fonts/times.ttf';
      const boldFont = 'C:/Windows/Fonts/timesbd.ttf';
      const italicFont = 'C:/Windows/Fonts/timesi.ttf';
      const hasTimes = fs.existsSync(regularFont);
      if (hasTimes) {
        doc.registerFont('Times', regularFont);
        doc.registerFont('Times-Bold', boldFont);
        doc.registerFont('Times-Italic', italicFont);
      }

      const fontReg = hasTimes ? 'Times' : 'Helvetica';
      const fontBold = hasTimes ? 'Times-Bold' : 'Helvetica-Bold';
      const fontItalic = hasTimes ? 'Times-Italic' : 'Helvetica-Oblique';

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const issuedDateStr = formatVnDate(issuedAt);
      const custName = customer.company_name || 'Khách hàng NEXLOG';
      const custTax = customer.tax_code || '';
      const custAddr = customer.registered_address || 'Chưa cập nhật';

      // Header
      doc.font(fontBold).fontSize(15).text('HÓA ĐƠN GIÁ TRỊ GIA TĂNG', { align: 'center' });
      doc.font(fontItalic).fontSize(10.5).text('(Bản thể hiện của hóa đơn điện tử)', { align: 'center' });
      doc.moveDown(0.5);
      doc.font(fontReg).fontSize(10.5).text(`Số hóa đơn: ${invoiceNumber}   |   Ngày phát hành: ${issuedDateStr}`, { align: 'center' });
      if (orderCode) {
        doc.text(`Mã đơn vận chuyển tham chiếu: ${orderCode}`, { align: 'center' });
      }
      doc.moveDown(1);

      // Seller info
      doc.font(fontBold).fontSize(11).text('ĐƠN VỊ BÁN HÀNG (BÊN CUNG CẤP DỊCH VỤ)');
      doc.font(fontReg).fontSize(10.5);
      doc.text('• Tên đơn vị: HỆ THỐNG ĐIỀU PHỐI VẬN TẢI NEXLOG');
      doc.text('• Email liên hệ: nexlogcustomerservice@gmail.com');
      if (authorizedBank) {
        doc.text(`• Ngân hàng ủy quyền thu hộ: ${authorizedBank}`);
      }
      doc.moveDown(0.8);

      // Buyer info
      doc.font(fontBold).fontSize(11).text('ĐƠN VỊ MUA HÀNG (KHÁCH HÀNG)');
      doc.font(fontReg).fontSize(10.5);
      doc.text(`• Tên đơn vị: ${custName}`);
      doc.text(`• Mã số thuế: ${custTax}`);
      doc.text(`• Địa chỉ: ${custAddr}`);
      doc.moveDown(1);

      // Financial breakdown
      doc.font(fontBold).fontSize(11).text('CHI TIẾT DỊCH VỤ & THANH TOÁN');
      doc.moveDown(0.4);
      doc.font(fontReg).fontSize(10.5);
      doc.text(`• Nội dung dịch vụ: Dịch vụ vận chuyển hàng hóa (Đơn ${orderCode || invoiceNumber})`);
      doc.text(`• Cộng tiền hàng (chưa bao gồm thuế GTGT): ${formatVnMoney(subtotalAmount)}`);
      doc.text(`• Thuế suất GTGT: ${Number(vatRate) || 0}%`);
      doc.text(`• Tiền thuế GTGT: ${formatVnMoney(vatAmount)}`);
      doc.font(fontBold).fontSize(11.5).text(`• Tổng cộng tiền thanh toán: ${formatVnMoney(totalAmount)}`);
      doc.font(fontItalic).fontSize(10.5).text(`Số tiền viết bằng chữ: ${readVietnameseCurrency(totalAmount)}.`);
      if (notes) {
        doc.moveDown(0.5);
        doc.font(fontReg).fontSize(10).text(`Ghi chú: ${notes}`);
      }

      doc.moveDown(1.5);
      const signY = doc.y;
      doc.font(fontBold).fontSize(10.5).text('NGƯỜI LẬP / ĐƠN VỊ PHÁT HÀNH', 300, signY, { width: 240, align: 'center' });
      doc.font(fontItalic).fontSize(9.5).text('(Đã phát hành điện tử trên hệ thống NEXLOG)', 300, signY + 16, { width: 240, align: 'center' });
      doc.font(fontBold).fontSize(10).text(issuedBy || 'Bộ phận Điều phối / Kế toán vận tải', 300, signY + 55, { width: 240, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Sinh chuỗi XML Hóa đơn GTGT điện tử theo cấu trúc Thông tư 78 / NĐ-123
 */
const generateInvoiceXml = ({
  invoiceNumber,
  orderCode,
  issuedAt,
  issuedBy,
  customer = {},
  subtotalAmount = 0,
  vatRate = 8,
  vatAmount = 0,
  totalAmount = 0,
  authorizedBank = '',
  notes = ''
}) => {
  const issuedIso = issuedAt ? new Date(issuedAt).toISOString() : new Date().toISOString();
  const totalRounded = Math.round(Number(totalAmount) || 0);
  const vatRounded = Math.round(Number(vatAmount) || 0);
  const subtotalRounded = Math.round(Number(subtotalAmount) || 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <PBan>2.0.1</PBan>
      <THDon>Hóa đơn giá trị gia tăng</THDon>
      <SHDon>${escapeXml(invoiceNumber)}</SHDon>
      <NLap>${escapeXml(issuedIso.slice(0, 10))}</NLap>
      <DVTTe>VND</DVTTe>
      <TGia>1</TGia>
      <MaDonVanChuyen>${escapeXml(orderCode || '')}</MaDonVanChuyen>
      <NguoiPhatHanh>${escapeXml(issuedBy || 'NEXLOG')}</NguoiPhatHanh>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>HỆ THỐNG ĐIỀU PHỐI VẬN TẢI NEXLOG</Ten>
        <DCTDTu>nexlogcustomerservice@gmail.com</DCTDTu>
        <NganHangUyQuyen>${escapeXml(authorizedBank)}</NganHangUyQuyen>
      </NBan>
      <NMua>
        <Ten>${escapeXml(customer.company_name || '')}</Ten>
        <MST>${escapeXml(customer.tax_code || '')}</MST>
        <DChi>${escapeXml(customer.registered_address || '')}</DChi>
      </NMua>
      <DSHHDVu>
        <HHDVu>
          <STT>1</STT>
          <THHDVu>Dịch vụ vận chuyển hàng hóa (${escapeXml(orderCode || invoiceNumber)})</THHDVu>
          <ThTien>${subtotalRounded}</ThTien>
          <TSuat>${Number(vatRate) || 0}%</TSuat>
        </HHDVu>
      </DSHHDVu>
      <TToan>
        <TgTCThue>${subtotalRounded}</TgTCThue>
        <TgTThue>${vatRounded}</TgTThue>
        <TgTTTBSo>${totalRounded}</TgTTTBSo>
        <TgTTTBChu>${escapeXml(readVietnameseCurrency(totalRounded))}</TgTTTBChu>
        <GhiChu>${escapeXml(notes)}</GhiChu>
      </TToan>
    </NDHDon>
  </DLHDon>
</HDon>`;
};

module.exports = {
  generateContractPdfBuffer,
  generateInvoicePdfBuffer,
  generateInvoiceXml,
  readVietnameseCurrency
};
