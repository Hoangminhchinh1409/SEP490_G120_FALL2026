import React from 'react';
import { Tag, Button, message } from 'antd';
import { CheckCircle2, Download, Upload, FileCheck } from 'lucide-react';

export default function OrderContractTab({
  order,
  isWebOrder,
  contractUploaded,
  contractFile,
  contractFileData,
  contractUploadedAt,
  uploadingContract,
  contractInputRef,
  currentAgreedPrice,
  pickupAddress,
  deliveryAddress
}) {
  const signedContractData = order.web_workflow?.signed_contract;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-gray-800 text-sm m-0">Ký kết &amp; Quản lý Hợp đồng Vận chuyển</h4>
          {signedContractData ? (
            <Tag color="success" className="font-bold text-xs py-0.5 px-2.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> ĐÃ KÝ CHỮ KÝ SỐ ĐIỆN TỬ
            </Tag>
          ) : contractUploaded ? (
            <Tag color="success" className="font-bold text-xs py-0.5 px-2.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> ĐÃ NỘP HỢP ĐỒNG ĐÃ KÝ
            </Tag>
          ) : isWebOrder ? (
            <Tag color="processing" className="font-bold text-xs py-0.5 px-2.5">
              CHỜ KHÁCH HÀNG KÝ SỐ TRỰC TUYẾN
            </Tag>
          ) : (
            <Tag color="warning" className="font-bold text-xs py-0.5 px-2.5">CHƯA TẢI TỆP HỢP ĐỒNG</Tag>
          )}
        </div>

        {/* ĐỐI VỚI ĐƠN WEB: HIỂN THỊ TRẠNG THÁI KÝ SỐ VÀ CHỮ KÝ TRỰC TIẾP */}
        {isWebOrder ? (
          <div className="p-3.5 bg-white rounded-xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Hợp đồng điện tử ký số tự động (Đơn Web):</span>
                <span className="text-[11px] text-gray-500">
                  Hợp đồng được hệ thống sinh tự động và gửi cho khách ký số qua email sau khi điều phối viên duyệt chứng từ.
                </span>
              </div>
              {signedContractData ? (
                <Tag color="cyan" className="font-mono text-xs">
                  {signedContractData.contract_file || `HD-${order.order_id}-SIGNED.pdf`}
                </Tag>
              ) : (
                <Tag color="gold" className="text-xs">Đang chờ khách ký qua link mail</Tag>
              )}
            </div>

            {signedContractData && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Chữ ký số đã được ghi nhận vào hồ sơ:
                </div>
                <div className="text-emerald-900">
                  Người ký: <b>{signedContractData.signer_name}</b> | Thời gian ký: <b>{new Date(signedContractData.signed_at).toLocaleString('vi-VN')}</b>
                </div>
                {signedContractData.signature_data && (
                  <div className="mt-2 bg-white p-2 rounded border border-emerald-200 inline-block">
                    <img 
                      src={signedContractData.signature_data} 
                      alt="Chữ ký điện tử của khách hàng" 
                      className="h-14 object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ĐƠN NỘI BỘ / HOTLINE: NÚT TẢI MẪU VÀ TẢI TỆP HỢP ĐỒNG THẬT LÊN CƠ SỞ DỮ LIỆU */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button 
                icon={<Download size={15} />} 
                onClick={() => {
                  const element = document.createElement('a');
                  const file = new Blob([
                    `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nHỢP ĐỒNG VẬN CHUYỂN HÀNG HÓA\nSố: HD-${order.order_id || '2026'}\n\nBÊN A: CÔNG TY CỔ PHẦN LOGISTICS NEXLOG\nBÊN B: ${order.customer || 'Khách hàng'}\n\nCước phí thỏa thuận: ${currentAgreedPrice?.toLocaleString()} VNĐ\nĐiểm lấy: ${pickupAddress}\nĐiểm giao: ${deliveryAddress}`
                  ], { type: 'text/plain;charset=utf-8' });
                  element.href = URL.createObjectURL(file);
                  element.download = `Mau_Hop_Dong_Van_Chuyen_${order.order_id || 'NEXLOG'}.txt`;
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                  message.success('Đã tải xuống tệp mẫu hợp đồng vận chuyển!');
                }}
              >
                Tải mẫu hợp đồng
              </Button>
              <Button 
                type={contractUploaded ? "default" : "primary"}
                icon={<Upload size={15} />} 
                loading={uploadingContract}
                className={!contractUploaded ? "bg-[#7367f0] hover:bg-[#5e50ee]" : ""}
                onClick={() => {
                  if (contractInputRef.current) {
                    contractInputRef.current.value = '';
                    contractInputRef.current.click();
                  }
                }}
              >
                {contractUploaded ? 'Tải lên tệp thay thế' : 'Tải lên tệp hợp đồng đã ký'}
              </Button>
            </div>

            {/* Hộp hiển thị thông tin tệp hợp đồng thật đã tải lên */}
            {contractUploaded && contractFile && (
              <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-800 flex items-center gap-2">
                      <span className="truncate">{contractFile}</span>
                      <Tag color="green" className="text-[10px] m-0 px-1.5 py-0 font-medium">Đã lưu trữ vào CSDL</Tag>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Thời gian nộp: {contractUploadedAt ? new Date(contractUploadedAt).toLocaleString('vi-VN') : 'Vừa xong'}
                    </div>
                  </div>
                </div>
                {contractFileData && (
                  <Button 
                    size="small" 
                    type="link" 
                    icon={<Download size={13} />}
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = contractFileData;
                      a.download = contractFile;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      message.success(`Đang mở / tải xuống tệp: ${contractFile}`);
                    }}
                    className="text-indigo-600 font-semibold text-xs"
                  >
                    Tải tệp về
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-3.5 bg-white rounded-lg border border-gray-200">
          <div className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <FileCheck size={14} className="text-indigo-600" /> Điều khoản hợp đồng vận chuyển áp dụng:
          </div>
          <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4 m-0">
            <li>Thời gian chờ bốc xếp miễn phí tại kho: <b>60 phút</b>. Phí lưu ca phát sinh: <b>150.000 VNĐ / giờ</b>.</li>
            <li>Hủy đơn trước khi điều xe (nháp hoặc đang duyệt hồ sơ): <b>Miễn phí phạt (0 VNĐ)</b>.</li>
            <li>Hủy sau khi điều xe đến lấy hàng: <b>Tính tiền công tài xế &amp; phí điều xe</b> theo thỏa thuận.</li>
            <li>Hạn mức bồi thường hàng hóa: <b>100% giá trị khai báo</b> có niêm phong kẹp chì nguyên vẹn.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
