"use client";
import React from 'react';
import { Button, Modal } from 'antd';
import { FileText, Printer } from 'lucide-react';

export default function ContractPreviewModal({ open, onClose, order }) {
  return (
    <Modal
      title={
        <div className="flex items-center justify-between w-full pr-8">
          <div className="flex items-center gap-2 text-indigo-900 text-sm font-bold">
            <FileText size={16} className="text-indigo-600" />
            <span>Hợp Đồng Vận Tải Đường Bộ (NĐ 158/2024/NĐ-CP) — Mã đơn: #{order?.order_code || order?.id}</span>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={860}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<Printer size={14} />}
          onClick={() => {
            const printContents = document.getElementById('customer-contract-printable-area')?.innerHTML;
            if (!printContents) {
              window.print();
              return;
            }
            const win = window.open('', '_blank');
            win.document.write(`
              <html>
                <head>
                  <title>Hop_Dong_Van_Tai_${order?.order_code || 'ALS'}</title>
                  <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 25px; line-height: 1.6; font-size: 13px; color: #000; }
                    h2, h3, h4 { text-align: center; margin-bottom: 5px; }
                    .text-center { text-align: center; }
                    .italic { font-style: italic; }
                    .bold { font-weight: bold; }
                    .section { margin-top: 15px; }
                    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .signature-box { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
                    .signature-col { width: 45%; }
                    @media print {
                      body { margin: 0; padding: 15mm; }
                    }
                  </style>
                </head>
                <body>
                  ${printContents}
                </body>
              </html>
            `);
            win.document.close();
            win.focus();
            setTimeout(() => {
              win.print();
              win.close();
            }, 300);
          }}
          className="bg-indigo-600 text-white font-bold"
        >
          In Bản Hợp Đồng Này
        </Button>
      ]}
    >
      <div
        id="customer-contract-printable-area"
        className="max-h-[72vh] overflow-y-auto p-6 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 space-y-4 font-sans leading-relaxed"
      >
        {/* Quốc hiệu & Tiêu ngữ */}
        <div className="text-center space-y-1">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-800">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="font-semibold text-xs text-slate-800">Độc lập - Tự do - Hạnh phúc</div>
          <div className="text-slate-400 text-xs">---o0o---</div>
          <div className="font-bold text-base text-indigo-950 uppercase mt-2">HỢP ĐỒNG VẬN TẢI HÀNG HÓA ĐƯỜNG BỘ</div>
          <div className="text-slate-500 italic text-[11px]">
            Số: {order?.order_code || order?.id}/HĐVT-{new Date().getFullYear()}
          </div>
          <div className="text-[10px] text-slate-400 italic space-y-0.5 pt-1">
            <div>- Căn cứ Bộ luật Dân sự số 91/2015/QH13;</div>
            <div>- Căn cứ Luật Đường bộ số 35/2024/QH15;</div>
            <div>- Căn cứ Nghị định số 158/2024/NĐ-CP quy định về kinh doanh và điều kiện kinh doanh vận tải đường bộ;</div>
            <div>- Hôm nay, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}, chúng tôi gồm có:</div>
          </div>
        </div>

        <div className="border-t border-slate-200 my-2" />

        {/* BÊN A */}
        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1 text-[11px]">
          <div className="font-bold text-xs text-indigo-950 uppercase">
            BÊN VẬN TẢI (BÊN A): CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG (ALS) — NEXLOG
          </div>
          <div>• Tên đơn vị vận tải: <b>{order?.contract_details?.carrier_name || 'Công ty Cổ phần Logistics Hàng không (ALS) — Hệ thống NEXLOG'}</b></div>
          <div>• Mã số thuế: <b>{order?.contract_details?.carrier_tax_code || '0102376888'}</b></div>
          <div>• Địa chỉ trụ sở: {order?.contract_details?.carrier_address || 'Tầng 4, Ga Hàng hóa Kéo dài ALS, Cảng Hàng không Quốc tế Nội Bài, Phú Minh, Sóc Sơn, Hà Nội'}</div>
          <div>• Hotline hỗ trợ 24/7: <b>{order?.contract_details?.carrier_phone || '1900 3133 / 0988 123 456'}</b></div>
          <div>• Đại diện theo pháp luật: <b>{order?.contract_details?.carrier_rep || 'Ban Giám đốc Khối Vận tải Đường bộ ALS'}</b> (Số CCCD: {order?.contract_details?.carrier_cid || '001089012345'})</div>
        </div>

        {/* BÊN B */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px]">
          <div className="font-bold text-xs text-slate-900 uppercase">
            BÊN THUÊ VẬN TẢI (BÊN B): {order?.contract_details?.customer_name || order?.customer?.company_name || order?.receiver_name || 'Quý Khách Hàng'}
          </div>
          <div>• Tên tổ chức / cá nhân: <b>{order?.contract_details?.customer_name || order?.customer?.company_name || order?.receiver_name}</b></div>
          <div>• Mã số thuế / CCCD: <b>{order?.contract_details?.customer_tax_code || order?.customer?.tax_code || 'Chưa cung cấp'}</b></div>
          <div>• Địa chỉ liên hệ: {order?.contract_details?.customer_address || order?.delivery_location?.address || order?.delivery_address}</div>
          <div>• Số điện thoại: <b>{order?.contract_details?.customer_phone || order?.receiver_phone || order?.customer_phone || 'Chưa cung cấp'}</b></div>
        </div>

        {/* ĐIỀU 1 */}
        <div className="space-y-1 text-[11px]">
          <div className="font-bold text-indigo-900 uppercase">ĐIỀU 1: HÀNG HÓA VẬN CHUYỂN &amp; PHƯƠNG TIỆN</div>
          <div>1. Tên loại hàng hóa: <b>{order?.contract_details?.cargo_name || order?.cargo_description || 'Hàng bách hóa / Linh kiện điện tử'}</b></div>
          <div>2. Quy cách &amp; Khối lượng tính cước: <b>{order?.contract_details?.package_count_text || `${order?.package_count || 1} kiện`}</b> | Trọng lượng tính cước: <b>{(order?.contract_details?.chargeable_weight_kg || order?.chargeable_weight_kg || 0).toLocaleString()} kg</b></div>
          <div>3. Phương tiện vận chuyển chuyên dụng: <b>{order?.contract_details?.truck_model || order?.proposed_vehicle_type || 'Xe tải thùng kín chuyên dụng ALS'}</b></div>
        </div>

        {/* ĐIỀU 2 */}
        <div className="space-y-1 text-[11px]">
          <div className="font-bold text-indigo-900 uppercase">ĐIỀU 2: ĐỊA ĐIỂM, THỜI GIAN GIAO NHẬN VÀ LỘ TRÌNH</div>
          <div>1. Địa điểm lấy hàng (Xếp hàng): <b>{order?.contract_details?.pickup_address || order?.pickup_location?.address || order?.pickup_address}</b></div>
          <div>2. Địa điểm giao hàng (Trả hàng): <b>{order?.contract_details?.delivery_address || order?.delivery_location?.address || order?.delivery_address}</b></div>
          <div>3. Cự ly vận chuyển ước tính: <b>{order?.contract_details?.distance_km || order?.distance_km || 30} km</b></div>
        </div>

        {/* ĐIỀU 3 */}
        <div className="space-y-1 text-[11px]">
          <div className="font-bold text-indigo-900 uppercase">ĐIỀU 3: CƯỚC PHÍ VẬN CHUYỂN VÀ PHƯƠNG THỨC THANH TOÁN</div>
          <div>1. Tổng giá cước vận tải thỏa thuận: <b className="text-emerald-700 text-xs">{(order?.contract_details?.price_amount || order?.agreed_price || 0).toLocaleString()} VNĐ</b> (Bằng chữ: {order?.contract_details?.price_in_words || 'Theo thỏa thuận chốt trên đơn'})</div>
          <div>2. Hình thức thanh toán: <b>{order?.contract_details?.payment_method || 'Chuyển khoản ngân hàng hoặc thanh toán khi giao nhận'}</b></div>
          <div>3. Thời hạn thanh toán: <b>{order?.contract_details?.payment_terms || 'Trong vòng 07 ngày làm việc kể từ ngày nhận đủ biên bản giao nhận có chữ ký (POD)'}</b></div>
        </div>

        {/* ĐIỀU 4 & 5 */}
        <div className="space-y-1 text-[11px]">
          <div className="font-bold text-indigo-900 uppercase">ĐIỀU 4: THỜI GIAN CHỜ VÀ PHÍ PHẠT LƯU XE BỐC DỠ</div>
          <div>• Định mức giờ chờ miễn phí: <b>{order?.contract_details?.free_waiting_time || '60 phút'}</b> kể từ thời điểm lái xe Bên A có mặt tại kho.</div>
          <div>• Phí lưu ca/chờ phát sinh vượt định mức: <b>{order?.contract_details?.waiting_fee_per_block || '100.000 VNĐ / mỗi block 30 phút'}</b>.</div>
        </div>

        {/* ĐIỀU 6: ĐIỀU KHOẢN BỔ SUNG */}
        {Array.isArray(order?.contract_custom_terms) && order.contract_custom_terms.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1 text-[11px]">
            <div className="font-bold text-amber-950 uppercase">ĐIỀU 5: CÁC ĐIỀU KHOẢN BỔ SUNG RIÊNG THỐNG NHẤT CHO ĐƠN NÀY</div>
            {order.contract_custom_terms.map((term, i) => (
              <div key={i} className="text-amber-900">• {term}</div>
            ))}
          </div>
        )}

        {/* Chữ ký 2 bên */}
        <div className="pt-6 grid grid-cols-2 text-center text-xs">
          <div className="space-y-12">
            <div className="font-bold uppercase text-slate-800">ĐẠI DIỆN BÊN B (KHÁCH HÀNG)<br/><span className="text-[10px] font-normal italic">(Ký, ghi rõ họ tên và đóng dấu)</span></div>
            <div className="text-slate-400 italic text-[10px]">[Khách hàng ký và đóng dấu tròn công ty]</div>
          </div>
          <div className="space-y-12">
            <div className="font-bold uppercase text-indigo-950">ĐẠI DIỆN BÊN A (ALS / NEXLOG)<br/><span className="text-[10px] font-normal italic">(Đã ký số điện tử và đóng dấu đỏ)</span></div>
            <div className="text-emerald-700 font-bold text-xs">✓ ĐÃ KÝ ĐIỆN TỬ BỞI ALS LOGISTICS</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
