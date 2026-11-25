"use client";
import React from 'react';
import { Modal } from 'antd';

export default function IncidentEmailPreviewModal({
  open,
  onClose,
  emailPreviewType,
  setEmailPreviewType,
  isReadOnly,
  sendingEmail,
  onSendEmail,
  currentData,
  customerEmailDisplay,
  compensationAmount,
  incidentCode,
  orderCode,
  customerName,
  contactPerson,
  goodsHandlingMethod,
  contractClauseRef,
  claimCode,
  tripCode,
  incidentTitle,
  cargoDescription,
  declaredValue,
  damagePercentage,
  surveyOrgReport,
  resolutionNote,
  contactHotline,
  rejectionClause,
  rejectionReason
}) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2.5 pr-6">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            emailPreviewType === 'APPROVAL' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'
          }`}>
            <span className="material-symbols-outlined text-[20px]">mail</span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-primary">
              Thiết kế Bản Email Thông báo Bồi thường gửi Khách hàng
            </h4>
            <p className="text-[11px] text-on-surface-variant font-normal">
              Xem trước giao diện, màu sắc, bố cục và nội dung email sẽ tự động gửi tới khách hàng ({customerEmailDisplay})
            </p>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-surface-container">
          <div className="text-[11px] text-left">
            {currentData.email_sent ? (
              <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">mark_email_read</span>
                <span>
                  Đã gửi email tới {currentData.customer_email || customerEmailDisplay}
                  {currentData.email_sent_at ? ` (${new Date(currentData.email_sent_at).toLocaleString('vi-VN')})` : ''}
                </span>
              </span>
            ) : (
              <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">schedule_send</span>
                <span>Chưa ghi nhận lịch sử gửi email cho hồ sơ này</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs cursor-pointer border border-surface-container-highest"
            >
              Đóng
            </button>
            {!isReadOnly && (
              <button
                type="button"
                disabled={sendingEmail}
                onClick={onSendEmail}
                className={`h-9 px-4 rounded-xl text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                  emailPreviewType === 'REJECTION'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>
                  {sendingEmail
                    ? 'Đang gửi Email...'
                    : currentData.email_sent
                      ? 'Gửi lại Email tới Khách hàng'
                      : 'Gửi Email này tới Khách hàng'}
                </span>
              </button>
            )}
          </div>
        </div>
      }
      width={760}
      centered
    >
      <div className="space-y-3.5 pt-2">
        {/* Thanh chuyển đổi giữa 2 mẫu Email */}
        <div className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded-xl border border-surface-container">
          <button
            type="button"
            onClick={() => setEmailPreviewType('APPROVAL')}
            className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              emailPreviewType === 'APPROVAL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">check_circle</span>
            <span>Mẫu 1: Email Duyệt Bồi thường (Cam kết &amp; Hẹn liên hệ)</span>
          </button>

          <button
            type="button"
            onClick={() => setEmailPreviewType('REJECTION')}
            className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              emailPreviewType === 'REJECTION'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">cancel</span>
            <span>Mẫu 2: Email Từ chối Bồi thường (Kèm lý do chi tiết)</span>
          </button>
        </div>

        {/* Header giả lập trình đọc Email */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600">
          <div className="flex flex-wrap justify-between gap-2">
            <span><b>Từ:</b> ALS NEXLOG Claims &lt;claims@nexlog.vn&gt;</span>
            <span><b>Đến:</b> <span className="font-mono text-primary font-semibold">{customerEmailDisplay}</span></span>
          </div>
          <div>
            <b>Tiêu đề:</b>{' '}
            <span className="font-bold text-slate-900">
              {emailPreviewType === 'APPROVAL'
                ? `[ALS - NEXLOG] Phê duyệt bồi thường ${Number(compensationAmount || 0).toLocaleString('vi-VN')} đ — Hồ sơ ${incidentCode} (Đơn #${orderCode})`
                : `[ALS - NEXLOG] Thông báo kết quả thẩm định sự cố ${incidentCode} (Đơn #${orderCode})`}
            </span>
          </div>
        </div>

        {/* Khung Nội dung Email thiết kế */}
        <div className="max-h-[66vh] overflow-y-auto bg-slate-100 p-4 rounded-2xl border border-slate-200">
          {emailPreviewType === 'APPROVAL' ? (
            <div className="max-w-[620px] mx-auto bg-white rounded-2xl overflow-hidden shadow-md border border-slate-200 text-slate-800 font-sans">
              {/* Header xanh Navy - Ngọc lục bảo */}
              <div
                className="px-6 py-7 text-center text-white"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0d9488 55%, #059669 100%)' }}
              >
                <div className="text-[10px] font-bold tracking-[2px] uppercase opacity-85 mb-1.5">
                  ALS — NEXLOG SUPPLY CHAIN SOLUTION
                </div>
                <h3 className="text-lg font-extrabold tracking-wide m-0 text-white">
                  THÔNG BÁO PHÊ DUYỆT BỒI THƯỜNG HÀNG HÓA
                </h3>
                <p className="text-xs opacity-90 mt-1.5 mb-0">
                  Quyết định giải quyết hồ sơ sự cố #{incidentCode} · Đơn hàng #{orderCode}
                </p>
              </div>

              <div className="p-6 space-y-4 text-xs leading-relaxed">
                <div className="text-center">
                  <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-wide">
                    ✓ CHẤP THUẬN BỒI THƯỜNG THEO HỢP ĐỒNG
                  </span>
                </div>

                <div className="space-y-2 text-slate-600">
                  <p className="font-bold text-slate-900 text-sm m-0">
                    Kính gửi Quý khách hàng {customerName} ({contactPerson}),
                  </p>
                  <p className="m-0">
                    Trước hết, Công ty TNHH Vận tải &amp; Logistics Hàng không ALS (NEXLOG) xin gửi lời xin lỗi chân thành tới Quý khách vì sự cố phát sinh ngoài mong muốn trong quá trình vận chuyển đơn hàng <b>#{orderCode}</b>.
                  </p>
                  <p className="m-0">
                    Sau khi hoàn tất thẩm định hồ sơ hiện trường và đối chiếu điều khoản Hợp đồng vận chuyển, Ban Quản lý ALS trân trọng thông báo <b>chấp thuận chi trả bồi thường thiệt hại</b> với thông tin chi tiết như sau:
                  </p>
                </div>

                {/* Khung Highlight Số tiền duyệt */}
                <div className="p-4 rounded-xl border-2 border-emerald-500 text-center space-y-2" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%)' }}>
                  <div className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-widest">
                    Số tiền bồi thường được phê duyệt
                  </div>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {Number(compensationAmount || 0).toLocaleString('vi-VN')} VNĐ
                  </div>
                  <div className="inline-block bg-white/80 border border-emerald-200 rounded-lg px-3 py-1.5 text-[11px] text-emerald-900 leading-snug">
                    <div>
                      <b>Phương án xử lý:</b>{' '}
                      {goodsHandlingMethod === 'COMPANY_RECOVERY'
                        ? 'ALS thu hồi hàng hư hỏng về kho & Bồi thường 100% theo hạn mức'
                        : 'Giao phần hàng đạt chuẩn & Bồi thường phần thiệt hại cho Khách hàng'}
                    </div>
                    <div><b>Căn cứ áp dụng:</b> {contractClauseRef}</div>
                  </div>
                </div>

                {/* Bảng đối chiếu hồ sơ */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Chi tiết hồ sơ thẩm định &amp; đối chiếu
                  </div>
                  <div className="divide-y divide-dashed divide-slate-200 text-xs">
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Mã hồ sơ / Mã sự cố:</span>
                      <b className="font-mono text-emerald-700">{claimCode} / {incidentCode}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Đơn hàng / Chuyến xe:</span>
                      <b className="font-mono text-slate-900">{orderCode} · {tripCode}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Loại sự cố:</span>
                      <b className="text-slate-900 text-right">{incidentTitle}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Quy cách lô hàng:</span>
                      <b className="text-slate-900 text-right">{cargoDescription}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Giá trị khai báo / Tỷ lệ hỏng:</span>
                      <b className="font-mono text-slate-900">{declaredValue.toLocaleString('vi-VN')} đ · {damagePercentage}%</b>
                    </div>
                    {surveyOrgReport && (
                      <div className="py-1.5 flex justify-between gap-2">
                        <span className="text-slate-500">Biên bản giám định:</span>
                        <b className="text-slate-900 text-right">{surveyOrgReport}</b>
                      </div>
                    )}
                    {resolutionNote && (
                      <div className="py-1.5 flex justify-between gap-2">
                        <span className="text-slate-500 shrink-0">Kết luận Ban Quản lý:</span>
                        <span className="text-slate-800 text-right">{resolutionNote}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quy trình 3 bước cam kết liên hệ */}
                <div className="bg-blue-50 border border-blue-200 border-l-4 border-l-blue-600 rounded-xl p-4 space-y-2.5 text-blue-950">
                  <div className="text-xs font-extrabold text-blue-900 uppercase tracking-wide">
                    ⏳ Cam kết liên hệ &amp; Quy trình chi trả bồi thường
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="m-0 leading-snug">
                      <b>Liên hệ lại trong thời gian sớm nhất (tối đa 24 giờ làm việc):</b> Bộ phận Chăm sóc Khách hàng &amp; Pháp chế – Bồi thường ALS sẽ chủ động liên hệ trực tiếp với Quý khách để xác nhận tài khoản ngân hàng thụ hưởng.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="m-0 leading-snug">
                      <b>Giải ngân chuyển khoản:</b> Phòng Tài chính – Kế toán thực hiện chuyển khoản 100% số tiền <b>{Number(compensationAmount || 0).toLocaleString('vi-VN')} VNĐ</b> trong vòng <b>03 – 05 ngày làm việc</b> kể từ khi thống nhất thông tin thụ hưởng.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="m-0 leading-snug">
                      <b>Gửi chứng từ &amp; Đóng hồ sơ minh bạch:</b> Gửi ảnh Ủy nhiệm chi (UNC) qua email và cập nhật công khai trên cổng theo dõi đơn hàng.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3 text-center text-[11px] text-slate-600">
                  Hotline Bồi thường &amp; CSKH: <b>{contactHotline || '1900 1234'}</b> · Email: <b>claims@nexlog.vn</b>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-400 text-[10px] text-center py-4 px-5 space-y-0.5">
                <div className="font-bold text-slate-200">CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG (ALS) — HỆ THỐNG ĐIỀU VẬN NEXLOG</div>
                <div>Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội · © 2026 NEXLOG Logistics</div>
              </div>
            </div>
          ) : (
            <div className="max-w-[620px] mx-auto bg-white rounded-2xl overflow-hidden shadow-md border border-slate-200 text-slate-800 font-sans">
              {/* Header Đỏ Bordeaux trang trọng */}
              <div
                className="px-6 py-7 text-center text-white"
                style={{ background: 'linear-gradient(135deg, #450a0a 0%, #991b1b 50%, #dc2626 100%)' }}
              >
                <div className="text-[10px] font-bold tracking-[2px] uppercase opacity-85 mb-1.5">
                  ALS — NEXLOG SUPPLY CHAIN SOLUTION
                </div>
                <h3 className="text-lg font-extrabold tracking-wide m-0 text-white">
                  THÔNG BÁO KẾT QUẢ THẨM ĐỊNH SỰ CỐ &amp; BỒI THƯỜNG
                </h3>
                <p className="text-xs opacity-90 mt-1.5 mb-0">
                  Hồ sơ sự cố #{incidentCode} · Đơn hàng #{orderCode}
                </p>
              </div>

              <div className="p-6 space-y-4 text-xs leading-relaxed">
                <div className="text-center">
                  <span className="inline-block bg-red-50 text-red-700 border border-red-200 rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-wide">
                    THÔNG BÁO TỪ CHỐI BỒI THƯỜNG THEO ĐIỀU KHOẢN HỢP ĐỒNG
                  </span>
                </div>

                <div className="space-y-2 text-slate-600">
                  <p className="font-bold text-slate-900 text-sm m-0">
                    Kính gửi Quý khách hàng {customerName} ({contactPerson}),
                  </p>
                  <p className="m-0">
                    Công ty TNHH Vận tải &amp; Logistics Hàng không ALS (NEXLOG) trân trọng cảm ơn Quý khách đã phản ánh và phối hợp cung cấp thông tin đối với sự cố phát sinh trên đơn hàng <b>#{orderCode}</b>.
                  </p>
                  <p className="m-0">
                    Sau khi tiến hành rà soát toàn diện hồ sơ pháp lý, dữ liệu giám sát hành trình GPS và đối chiếu bằng chứng hình ảnh 3 khâu (Pickup – Niêm phong chì – POD giao hàng), Ban Thẩm định Sự cố ALS xin thông báo <b>chưa đủ cơ sở chấp thuận yêu cầu bồi thường</b> với căn cứ chi tiết như sau:
                  </p>
                </div>

                {/* Bảng hồ sơ đã thẩm định */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Thông tin hồ sơ đã thẩm định
                  </div>
                  <div className="divide-y divide-dashed divide-slate-200 text-xs">
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Mã hồ sơ / Mã sự cố:</span>
                      <b className="font-mono text-red-700">{claimCode} / {incidentCode}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Đơn hàng / Chuyến xe:</span>
                      <b className="font-mono text-slate-900">{orderCode} · {tripCode}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Phân loại sự cố:</span>
                      <b className="text-slate-900 text-right">{incidentTitle}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Thông tin lô hàng:</span>
                      <b className="text-slate-900 text-right">{cargoDescription}</b>
                    </div>
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-500">Kết quả thẩm định:</span>
                      <b className="text-red-600">Từ chối bồi thường · Đã đóng hồ sơ</b>
                    </div>
                  </div>
                </div>

                {/* Khung Căn cứ Pháp lý & Lý do từ chối */}
                <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-600 rounded-xl p-4 space-y-2.5 text-red-950">
                  <div className="text-xs font-extrabold text-red-900 uppercase tracking-wide">
                    ⚖️ Căn cứ hợp đồng &amp; Lý do từ chối chi tiết
                  </div>
                  <div>
                    <b className="block text-red-900">• Điều khoản Hợp đồng viện dẫn:</b>
                    <p className="m-0 mt-0.5 text-red-800">{rejectionClause || currentData.contract_clause_ref || 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng vận tải đã ký kết'}</p>
                  </div>
                  <div>
                    <b className="block text-red-900">• Lý do từ chối bồi thường:</b>
                    <p className="m-0 mt-0.5 text-red-800 font-medium">
                      {rejectionReason || currentData.rejection_reason || resolutionNote || 'Tổn thất không phát sinh do lỗi của đơn vị vận chuyển căn cứ theo hồ sơ đối chiếu hiện trường.'}
                    </p>
                  </div>
                  <div>
                    <b className="block text-red-900">• Kết luận đối chiếu chứng từ:</b>
                    <p className="m-0 mt-0.5 text-red-800">
                      Đã kiểm tra chéo ảnh chụp lúc nhận hàng (Pickup), tình trạng nguyên vẹn của tem niêm phong chì (Seal) và biên bản bàn giao thực tế (POD).
                    </p>
                  </div>
                </div>

                {/* Khung Hướng dẫn Phúc khảo */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-950 space-y-1 leading-relaxed">
                  <div className="font-bold">📌 Hướng dẫn Phúc khảo &amp; Hỗ trợ Khiếu nại:</div>
                  <p className="m-0">
                    Trường hợp Quý khách có thêm tài liệu đối chứng hoặc biên bản giám định độc lập mới, Quý khách vui lòng gửi đề nghị phúc khảo trong vòng <b>07 ngày làm việc</b> kể từ ngày nhận thông báo này.
                  </p>
                  <div>• Hotline Giải quyết Khiếu nại: <b className="font-mono text-red-800">{contactHotline || '1900 1234'}</b></div>
                  <div>• Email Bộ phận Pháp chế – Bồi thường: <b>claims@nexlog.vn</b></div>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-400 text-[10px] text-center py-4 px-5 space-y-0.5">
                <div className="font-bold text-slate-200">CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG (ALS) — HỆ THỐNG ĐIỀU VẬN NEXLOG</div>
                <div>Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội · © 2026 NEXLOG Logistics</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
