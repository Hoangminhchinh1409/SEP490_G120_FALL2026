import React from 'react';
import { Tag, Button, message, Alert } from 'antd';
import { CheckCircle2, Download, Upload, FileCheck, ShieldCheck } from 'lucide-react';

export default function OrderContractTab({
  order,
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
  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-gray-800 text-sm m-0">Ký kết &amp; Đính kèm Hợp đồng Vận chuyển (Scan PDF)</h4>
          {contractUploaded ? (
            <Tag color="success" className="font-bold text-xs py-0.5 px-2.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> ĐÃ ĐÍNH KÈM HỢP ĐỒNG SCAN (PDF)
            </Tag>
          ) : (
            <Tag color="warning" className="font-bold text-xs py-0.5 px-2.5">CHƯA ĐÍNH KÈM HỢP ĐỒNG ĐÃ SCAN</Tag>
          )}
        </div>

        <Alert
          type="info"
          showIcon
          icon={<ShieldCheck size={16} className="text-indigo-600 mt-0.5" />}
          className="mb-3 rounded-xl border-indigo-200 bg-indigo-50/70"
          title={<span className="text-xs font-bold text-indigo-950">Quy định pháp lý ký kết hợp đồng vận tải</span>}
          description={
            <span className="text-xs text-indigo-900">
              Hợp đồng vận chuyển bắt buộc phải có đầy đủ chữ ký trực tiếp và con dấu pháp lý của cả 2 bên (Khách hàng &amp; NEXLOG). Không sử dụng chữ ký vẽ trực tuyến hoặc gửi email ký số. Sau khi hai bên ký kết hoàn tất, Điều phối viên thực hiện đính kèm bản scan PDF hợp đồng lên hệ thống.
            </span>
          }
        />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button 
              icon={<Download size={15} />} 
              onClick={() => {
                const element = document.createElement('a');
                const file = new Blob([
                  `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nHỢP ĐỒNG VẬN CHUYỂN HÀNG HÓA\nSố: HD-${order.order_id || '2026'}\n\nBÊN A: CÔNG TY CỔ PHẦN LOGISTICS NEXLOG\nBÊN B: ${order.customer || 'Khách hàng'}\n\nCước phí thỏa thuận: ${currentAgreedPrice?.toLocaleString()} VNĐ\nĐiểm lấy: ${pickupAddress}\nĐiểm giao: ${deliveryAddress}\n\nĐẠI DIỆN BÊN A (Ký, ghi rõ họ tên & đóng dấu)          ĐẠI DIỆN BÊN B (Ký, ghi rõ họ tên & đóng dấu)`
                ], { type: 'text/plain;charset=utf-8' });
                element.href = URL.createObjectURL(file);
                element.download = `Mau_Hop_Dong_Van_Chuyen_${order.order_id || 'NEXLOG'}.txt`;
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
                message.success('Đã tải xuống mẫu hợp đồng vận chuyển để in ký trực tiếp 2 bên!');
              }}
            >
              Tải mẫu hợp đồng để 2 bên ký
            </Button>
            <Button 
              type={contractUploaded ? "default" : "primary"}
              icon={<Upload size={15} />} 
              loading={uploadingContract}
              className={!contractUploaded ? "bg-[#7367f0] hover:bg-[#5e50ee] font-semibold" : "font-semibold"}
              onClick={() => {
                if (contractInputRef.current) {
                  contractInputRef.current.value = '';
                  contractInputRef.current.click();
                }
              }}
            >
              {contractUploaded ? 'Tải lên bản scan PDF thay thế' : 'Đính kèm hợp đồng đã scan (PDF)'}
            </Button>
          </div>

          {/* Hộp hiển thị thông tin tệp hợp đồng scan PDF đã tải lên */}
          {contractUploaded && contractFile && (
            <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileCheck size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    <span className="truncate">{contractFile}</span>
                    <Tag color="green" className="text-[10px] m-0 px-1.5 py-0 font-medium">Bản scan PDF 2 bên đã ký</Tag>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Thời gian đính kèm: {contractUploadedAt ? new Date(contractUploadedAt).toLocaleString('vi-VN') : 'Vừa xong'}
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
                    message.success(`Đang mở / tải xuống bản scan hợp đồng: ${contractFile}`);
                  }}
                  className="text-indigo-600 font-semibold text-xs"
                >
                  Tải tệp PDF về
                </Button>
              )}
            </div>
          )}
        </div>

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
