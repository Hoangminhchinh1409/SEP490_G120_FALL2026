"use client";
import React from 'react';
import { Button, Tag, message } from 'antd';
import {
  FileText,
  Upload,
  FileCheck,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { orderApi } from '../../../api/orderApi';
import { uploadApi } from '../../../api/uploadApi';

export default function ContractSigningSection({
  order,
  token,
  uploadingContractScan,
  setUploadingContractScan,
  setContractModalOpen,
  setOrder
}) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150 pb-3">
        <div>
          <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-indigo-600" size={18} />
            Ký kết Hợp đồng Vận chuyển Hàng hóa Nội địa (ALS)
          </span>
          <span className="text-xs text-slate-500 block mt-0.5">
            Quý khách vui lòng tải tệp hợp đồng đã được hệ thống tạo sẵn, in ra giấy, ký tên đóng dấu, sau đó scan/chụp ảnh tải lên hệ thống.
          </span>
        </div>
        <Tag color={order?.contract_file || order?.contract_uploaded ? 'success' : 'processing'} className="text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto">
          {order?.contract_file || order?.contract_uploaded ? '✓ ĐÃ TẢI LÊN BẢN SCAN' : 'CHỜ TẢI BẢN SCAN ĐÃ KÝ'}
        </Tag>
      </div>

      {/* Điều khoản bổ sung riêng */}
      {Array.isArray(order?.contract_custom_terms) && order.contract_custom_terms.length > 0 && (
        <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-1.5">
          <span className="text-xs font-bold text-indigo-950 block">
            📋 Các điều khoản bổ sung đã thống nhất với Điều phối viên:
          </span>
          <div className="space-y-1 text-xs text-indigo-900">
            {order.contract_custom_terms.map((term, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="font-bold">•</span>
                <span>{term}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2 Bước thực hiện: Online Scan & Offline Bưu điện */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Bước 1: Scan và upload online */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
          <div>
            <div className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
              Ký &amp; Tải lên bản Scan (PDF / Ảnh)
            </div>
            {!(order?.contract_file || order?.contract_uploaded) ? (
              <>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  Bấm <b>&ldquo;Xem &amp; In hợp đồng mẫu&rdquo;</b> bên dưới hoặc tải tệp gửi kèm trong Email, in ra giấy, ký tên đóng dấu tròn công ty và scan tải lại tại đây để Điều phối viên xác nhận xếp xe ngay.
                </p>

                {/* Nút xem & in hợp đồng mẫu chuẩn NĐ 158/2024/NĐ-CP (chỉ hiển thị khi chưa đính kèm tệp hợp đồng) */}
                <div className="pt-2.5">
                  <Button
                    type="default"
                    icon={<Eye size={13} className="text-indigo-600" />}
                    onClick={() => setContractModalOpen(true)}
                    className="w-full text-xs font-bold border-indigo-200 text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 flex items-center justify-center gap-1.5 h-9 rounded-xl"
                  >
                    📄 Xem, Tải Về &amp; In Hợp Đồng Mẫu Đã Lập
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-emerald-800 leading-relaxed m-0">
                Hợp đồng vận chuyển bản scan PDF đã được tải lên và lưu vào hồ sơ đơn hàng. Quý khách có thể đổi sang tệp khác nếu cần chỉnh sửa trước khi xe lăn bánh.
              </p>
            )}
          </div>

          <div className="pt-2">
            {order?.contract_file || order?.contract_uploaded ? (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-950 truncate max-w-[180px]">
                      {order.contract_file || 'hop-dong-da-ky.pdf'}
                    </div>
                    <div className="text-[10px] text-emerald-700">Đã tiếp nhận vào hồ sơ</div>
                  </div>
                </div>
                <label className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer">
                  Đổi tệp khác
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploadingContractScan(true);
                        const orderId = order.id || order.order_id;
                        const uploaded = await uploadApi.uploadToCloudinary(
                          file,
                          `nexlog/orders/${orderId}/contract`,
                          { requireAuthCookie: false }
                        );
                        await orderApi.uploadContractFile(orderId, {
                          file_name: file.name,
                          file_data: uploaded.url,
                          file_url: uploaded.url,
                          file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
                        });
                        message.success('Đã tải lên bản scan hợp đồng đã ký!');
                        const latest = await orderApi.getOrderByToken(token);
                        if (latest) setOrder(latest);
                      } catch (err) {
                        message.error(err.message || 'Lỗi khi tải tệp');
                      } finally {
                        setUploadingContractScan(false);
                      }
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-sm transition-all">
                <Upload size={14} />
                <span>{uploadingContractScan ? 'Đang tải lên...' : 'Tải lên Bản Scan Hợp đồng đã ký (PDF)'}</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingContractScan(true);
                      const orderId = order.id || order.order_id;
                      const uploaded = await uploadApi.uploadToCloudinary(
                        file,
                        `nexlog/orders/${orderId}/contract`,
                        { requireAuthCookie: false }
                      );
                      await orderApi.uploadContractFile(orderId, {
                        file_name: file.name,
                        file_data: uploaded.url,
                        file_url: uploaded.url,
                        file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      });
                      message.success('Đã tải lên bản scan hợp đồng đã ký thành công!');
                      const latest = await orderApi.getOrderByToken(token);
                      if (latest) setOrder(latest);
                    } catch (err) {
                      message.error(err.message || 'Lỗi khi tải tệp');
                    } finally {
                      setUploadingContractScan(false);
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Bước 2: Gửi bản cứng bưu điện (Bắt buộc) */}
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3 flex flex-col justify-between">
          <div>
            <div className="font-bold text-xs text-amber-950 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">2</span>
              Gửi bản cứng gốc qua bưu điện (Bắt buộc)
            </div>
            <p className="text-xs text-amber-900 leading-relaxed m-0">
              Theo quy chuẩn vận hành của ALS, <b>Quý khách có nghĩa vụ gửi bản cứng hợp đồng gốc có dấu đỏ</b> qua đường bưu điện/chuyển phát nhanh về cho Ban Điều phối ALS trong vòng 03 ngày làm việc để lưu trữ hồ sơ pháp lý đối soát.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-[11px] text-amber-950 space-y-1">
            <div>📍 <b>Địa chỉ nhận hợp đồng:</b> Cảng Hàng không Quốc tế Nội Bài, Phú Minh, Sóc Sơn, Hà Nội</div>
            <div>👤 <b>Người nhận:</b> Ban Điều phối Vận tải Hàng không ALS (NEXLOG)</div>
            <div>📞 <b>Hotline tiếp nhận:</b> 1900 3133 / {order?.dispatcher_phone || '0988 123 456'}</div>
            {order?.contract_hardcopy_received && (
              <div className="pt-1 text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> Điều phối viên đã xác nhận nhận đủ bản cứng gốc có dấu đỏ!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
