"use client";
import React from 'react';
import { Modal, Alert } from 'antd';

export default function IncidentContractViewerModal({
  open,
  onClose,
  contractViewerTab,
  setContractViewerTab,
  hasFrameworkContract,
  contractNumber,
  orderCode,
  tripCode,
  customerName,
  contactPerson,
  contactPhone,
  contractCap,
  truckPlate,
  driverName,
  driverPhone,
  agreedPrice,
  routeDisplay,
  cargoDescription,
  declaredValue,
  effectiveLiabilityCap,
  currentData
}) {
  return (
    <Modal
      title={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-8 gap-2">
          <div>
            <h4 className="font-bold text-sm text-primary">
              {hasFrameworkContract ? 'Hồ sơ Hợp đồng Pháp lý (02 Bản)' : 'Hợp đồng Vận tải Theo chuyến (Khách hàng vãng lai)'}
            </h4>
            <p className="text-[11px] text-on-surface-variant font-normal">
              {hasFrameworkContract
                ? 'Hồ sơ bao gồm Hợp đồng nguyên tắc đối tác và Hợp đồng vận tải hàng hóa theo chuyến'
                : 'Đơn hàng chưa có Hợp đồng nguyên tắc dài hạn · Áp dụng giới hạn trách nhiệm 500.000.000 VNĐ theo Nghị định 163/2017/NĐ-CP'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold cursor-pointer transition-colors border border-slate-300"
            >
              In hợp đồng
            </button>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
    >
      <div className="space-y-3 pt-1">
        {/* THANH CHUYỂN TAB: CHỈ HIỆN 2 TAB KHI ĐƠN HÀNG CÓ HỢP ĐỒNG ĐỐI TÁC KHUNG */}
        {hasFrameworkContract ? (
          <div className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded-xl border border-surface-container">
            <button
              type="button"
              onClick={() => setContractViewerTab('FRAMEWORK')}
              className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center ${
                contractViewerTab === 'FRAMEWORK'
                  ? 'bg-white text-secondary shadow-xs border border-surface-container'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span>1. Hợp đồng Nguyên tắc Đối tác ({contractNumber})</span>
            </button>

            <button
              type="button"
              onClick={() => setContractViewerTab('ORDER_TRIP')}
              className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center ${
                contractViewerTab === 'ORDER_TRIP'
                  ? 'bg-white text-secondary shadow-xs border border-surface-container'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span>2. Hợp đồng Vận tải Theo chuyến ({orderCode})</span>
            </button>
          </div>
        ) : (
          <Alert
            type="warning"
            title={<b className="text-xs">Đơn hàng không có Hợp đồng Nguyên tắc Đối tác (Khách hàng vãng lai)</b>}
            description="Doanh nghiệp này chưa ký hợp đồng nguyên tắc dài hạn. Mọi chế tài bồi thường được thẩm định trực tiếp theo Hợp đồng vận tải từng chuyến dưới đây và giới hạn trách nhiệm luật định 500.000.000 VNĐ theo Nghị định 163/2017/NĐ-CP."
            className="rounded-xl p-3 border border-amber-300"
          />
        )}

        {/* NỘI DUNG VĂN BẢN HỢP ĐỒNG ĐƯỢC CHỌN */}
        <div className="max-h-[70vh] overflow-y-auto p-6 bg-white rounded-xl border border-surface-container text-xs text-slate-800 space-y-4 font-sans leading-relaxed shadow-inner">
          {/* BẢN 1: HỢP ĐỒNG NGUYÊN TẮC KHUNG (FRAMEWORK) */}
          {(hasFrameworkContract && contractViewerTab === 'FRAMEWORK') && (
            <div className="space-y-4">
              <div className="text-center space-y-1 pb-3 border-b border-slate-200">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div className="font-semibold text-xs text-slate-800">
                  Độc lập - Tự do - Hạnh phúc
                </div>
                <div className="text-slate-400 text-xs">---o0o---</div>
                <div className="font-black text-base text-primary uppercase mt-2">
                  HỢP ĐỒNG NGUYÊN TẮC VẬN CHUYỂN HÀNG HÓA ĐƯỜNG BỘ
                </div>
                <div className="text-slate-500 italic text-[11px] font-mono">
                  Số: {contractNumber} / ALS-NEXLOG
                </div>
                <div className="text-[10px] text-slate-400 italic space-y-0.5 pt-1">
                  <div>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội ban hành ngày 24/11/2015;</div>
                  <div>- Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005;</div>
                  <div>- Căn cứ Hợp đồng khung hợp tác cung ứng dịch vụ logistics giữa hai Bên.</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                <div className="space-y-1">
                  <strong className="text-primary uppercase block font-bold text-xs">BÊN A (BÊN VẬN CHUYỂN):</strong>
                  <div><strong>CÔNG TY TNHH VẬN TẢI &amp; LOGISTICS HÀNG KHÔNG ALS (NEXLOG)</strong></div>
                  <div>Địa chỉ: Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội</div>
                  <div>Mã số thuế: 0102345678 · Điện thoại: 1900 3133 / 0988 123 456</div>
                  <div>Đại diện: Ban Giám đốc Vận tải Hàng không ALS</div>
                </div>

                <div className="space-y-1">
                  <strong className="text-primary uppercase block font-bold text-xs">BÊN B (ĐỐI TÁC DOANH NGHIỆP):</strong>
                  <div><strong>{customerName}</strong></div>
                  <div>Người liên hệ: {contactPerson} · SĐT: {contactPhone}</div>
                  <div>Hạn mức tín dụng &amp; thanh toán: 30 ngày kể từ ngày chốt bảng kê công nợ tháng</div>
                </div>
              </div>

              <div className="space-y-3 pt-1 text-slate-700">
                <div>
                  <strong className="text-primary font-bold text-xs block mb-0.5">
                    ĐIỀU 4: MIỄN TRỪ TRÁCH NHIỆM (CĂN CỨ TỪ CHỐI BỒI THƯỜNG)
                  </strong>
                  <p className="p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                    <b>Khoản 4.2:</b> Bên A được hoàn toàn miễn trừ trách nhiệm bồi thường nếu hàng hóa bị hư hỏng, rách nát xuất phát từ lỗi đóng gói không đúng quy chuẩn bảo vệ của chủ hàng, hoặc hàng hóa đã bị tổn thất từ trước thời điểm bàn giao bốc xếp lên phương tiện vận chuyển của Bên A (căn cứ theo ảnh chụp đối chiếu lúc nhận hàng).
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-950 space-y-1.5">
                  <strong className="text-primary font-bold text-xs block uppercase">
                    ĐIỀU 8: TRÁCH NHIỆM BỒI THƯỜNG THIỆT HẠI HÀNG HÓA (CĂN CỨ DUYỆT BỒI THƯỜNG)
                  </strong>
                  <p>
                    <b>Khoản 8.1:</b> Bên A chịu trách nhiệm bồi thường đối với các tổn thất, móp vỡ, hư hỏng hoặc mất mát phát sinh đối với hàng hóa trong quá trình vận chuyển do lỗi trực tiếp từ phương tiện hoặc nhân viên lái xe của Bên A.
                  </p>
                  <p>
                    <b>Khoản 8.2:</b> Mức bồi thường được xác định theo công thức:
                    <br />
                    <span className="font-mono font-bold text-primary pl-4 block py-1">
                      Số tiền bồi thường = Tỷ lệ hư hỏng thực tế (%) × Giá trị khai báo của từng đơn hàng
                    </span>
                    Trong mọi trường hợp, tổng mức trách nhiệm bồi thường tối đa của Bên A cho mỗi vụ việc không vượt quá Hạn mức trách nhiệm hợp đồng đối tác là: <b className="font-mono text-error font-bold">{contractCap.toLocaleString('vi-VN')} VNĐ</b>.
                  </p>
                  <p>
                    <b>Khoản 8.3:</b> Thời hạn khách hàng lập yêu cầu khiếu nại bồi thường tối đa 14 ngày kể từ thời điểm bàn giao hàng hóa. Quá thời hạn trên, quyền khiếu nại không còn hiệu lực.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-center">
                <div className="space-y-1">
                  <strong className="block font-bold text-xs text-primary uppercase">ĐẠI DIỆN BÊN B (DOANH NGHIỆP)</strong>
                  <div className="h-14 flex items-center justify-center">
                    <div className="px-3 py-1 bg-slate-50 border border-slate-300 rounded text-slate-800 text-[11px] font-bold">
                      ĐÃ KÝ SỐ ĐỐI TÁC KHUNG
                    </div>
                  </div>
                  <strong className="block text-primary font-bold text-xs">{contactPerson}</strong>
                </div>

                <div className="space-y-1">
                  <strong className="block font-bold text-primary uppercase text-xs">ĐẠI DIỆN BÊN A (ALS LOGISTICS)</strong>
                  <div className="h-14 flex items-center justify-center">
                    <div className="px-3 py-1 bg-slate-50 border border-slate-300 rounded text-slate-800 text-[11px] font-bold">
                      CHỨNG THƯ SỐ ALS LOGISTICS
                    </div>
                  </div>
                  <strong className="block text-primary font-bold text-xs">TỔNG GIÁM ĐỐC ALS</strong>
                </div>
              </div>
            </div>
          )}

          {/* BẢN 2: HỢP ĐỒNG VẬN TẢI THEO CHUYẾN (ORDER SPECIFIC CONTRACT) */}
          {(!hasFrameworkContract || contractViewerTab === 'ORDER_TRIP') && (
            <div className="space-y-4">
              <div className="text-center space-y-1 pb-3 border-b border-slate-200">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div className="font-semibold text-xs text-slate-800">
                  Độc lập - Tự do - Hạnh phúc
                </div>
                <div className="text-slate-400 text-xs">---o0o---</div>
                <div className="font-black text-base text-primary uppercase mt-2">
                  HỢP ĐỒNG VẬN TẢI HÀNG HÓA THEO CHUYẾN
                </div>
                <div className="text-slate-500 italic text-[11px] font-mono">
                  Số: {orderCode}/HĐVT-{new Date().getFullYear()}
                </div>
                <div className="text-[10px] text-slate-400 italic space-y-0.5 pt-1">
                  <div>- Lập và lưu trữ trực tiếp tại hồ sơ Đơn hàng: <b>{orderCode}</b> (Chuyến xe: <b>{tripCode}</b>)</div>
                  <div>- Căn cứ xác nhận ký kết giữa Điều phối viên ALS và Khách hàng.</div>
                </div>
              </div>

              {/* NẾU ĐƠN HÀNG CÓ TỆP SCAN HỢP ĐỒNG PDF ĐÍNH KÈM THẬT */}
              {(currentData.order?.order_contract?.contract_file || currentData.order?.signed_order_contract_file) && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Tệp bản sao hợp đồng đã ký của đơn hàng:
                    </span>
                    <span className="font-mono text-slate-700 text-[11px]">
                      {currentData.order?.order_contract?.contract_file || currentData.order?.signed_order_contract_file}
                    </span>
                  </div>
                  {currentData.order?.order_contract?.contract_file_data ? (
                    <a
                      href={currentData.order.order_contract.contract_file_data}
                      download={currentData.order.order_contract.contract_file || `Hop_Dong_${orderCode}.pdf`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-[11px] hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      Tải tệp PDF
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-600 italic">Đã lưu trữ hồ sơ điện tử</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                <div className="space-y-1">
                  <strong className="text-primary uppercase block font-bold text-xs">ĐƠN VỊ VẬN CHUYỂN:</strong>
                  <div><strong>CÔNG TY TNHH VẬN TẢI &amp; LOGISTICS HÀNG KHÔNG ALS</strong></div>
                  <div>Xe vận chuyển: <b className="font-mono text-primary">{truckPlate}</b></div>
                  <div>Tài xế phụ trách: <b>{driverName}</b> ({driverPhone})</div>
                  <div>Cước phí chuyến: <b className="font-mono text-error font-bold">{agreedPrice.toLocaleString('vi-VN')} VNĐ</b></div>
                </div>

                <div className="space-y-1">
                  <strong className="text-primary uppercase block font-bold text-xs">BÊN THUÊ VẬN CHUYỂN:</strong>
                  <div><strong>{customerName}</strong></div>
                  <div>Người liên hệ nhận/giao: {contactPerson} ({contactPhone})</div>
                  <div>Lộ trình: <span className="font-medium text-primary">{routeDisplay}</span></div>
                  <div>Quy cách lô hàng: <b className="text-primary">{cargoDescription}</b></div>
                </div>
              </div>

              <div className="space-y-3 pt-1 text-slate-700">
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1">
                  <strong className="text-amber-950 font-bold text-xs block">
                    GIÁ TRỊ KHAI BÁO CỦA LÔ HÀNG ĐƯỢC BẢO HIỂM:
                  </strong>
                  <div className="flex items-center justify-between text-xs">
                    <span>Giá trị khai báo tính bồi thường:</span>
                    <strong className="font-mono text-error font-bold text-sm">
                      {declaredValue.toLocaleString('vi-VN')} VNĐ
                    </strong>
                  </div>
                  <p className="text-[11px] text-on-surface-variant italic pt-0.5">
                    (Được trích xuất từ hồ sơ chứng từ của đơn hàng {orderCode} do khách hàng nộp đã được duyệt).
                  </p>
                </div>

                {/* NẾU ĐƠN HÀNG CÓ CÁC ĐIỀU KHOẢN TÙY BIẾN DO ĐIỀU PHỐI VIÊN SOẠN THẢO */}
                {Array.isArray(currentData.order?.order_contract?.contract_custom_terms) && currentData.order.order_contract.contract_custom_terms.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <strong className="text-primary font-bold text-xs block">
                      ĐIỀU KHOẢN BỔ SUNG CỦA ĐƠN HÀNG:
                    </strong>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700">
                      {currentData.order.order_contract.contract_custom_terms.map((term, tIdx) => (
                        <li key={tIdx}>{term}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <strong className="text-primary font-bold text-xs block mb-0.5">
                    ĐIỀU KHOẢN TRÁCH NHIỆM &amp; HẠN MỨC BỒI THƯỜNG:
                  </strong>
                  <p>
                    1. Bên vận chuyển cam kết bảo quản nguyên đai nguyên kiện và nguyên tem niêm phong chì trong suốt hành trình từ điểm nhận đến điểm giao.
                  </p>
                  <p>
                    2. Trường hợp xảy ra móp vỡ, đổ vỡ do lỗi vận hành xe: Mức bồi thường = <b>Tỷ lệ hư hỏng (%) × Giá trị khai báo ({declaredValue.toLocaleString('vi-VN')} VNĐ)</b>.
                  </p>
                  <p>
                    3. Giới hạn trách nhiệm tối đa áp dụng: <b className="font-mono font-bold text-error">{effectiveLiabilityCap.toLocaleString('vi-VN')} VNĐ</b> {!hasFrameworkContract && '(Theo mức trần luật định Nghị định 163/2017/NĐ-CP)'}.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-center">
                <div className="space-y-1">
                  <strong className="block font-bold text-xs text-primary uppercase">XÁC NHẬN CỦA KHÁCH HÀNG</strong>
                  <div className="h-14 flex items-center justify-center">
                    <div className="px-3 py-1 bg-slate-50 border border-slate-300 rounded text-slate-800 text-[11px] font-bold">
                      ĐÃ KÝ XÁC NHẬN CHUYẾN
                    </div>
                  </div>
                  <strong className="block text-primary font-bold text-xs">{contactPerson}</strong>
                </div>

                <div className="space-y-1">
                  <strong className="block font-bold text-primary uppercase text-xs">ĐIỀU PHỐI VIÊN ALS</strong>
                  <div className="h-14 flex items-center justify-center">
                    <div className="px-3 py-1 bg-slate-50 border border-slate-300 rounded text-slate-800 text-[11px] font-bold">
                      ĐÃ XÁC NHẬN ĐƠN HÀNG
                    </div>
                  </div>
                  <strong className="block text-primary font-bold text-xs">BAN ĐIỀU PHỐI VẬN TẢI</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
