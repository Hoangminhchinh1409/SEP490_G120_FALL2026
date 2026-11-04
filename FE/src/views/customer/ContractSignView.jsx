"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Spin, Alert, Divider, Tag } from 'antd';
import { 
  FileCheck, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowLeft
} from 'lucide-react';
import { orderApi } from '../../../src/api/orderApi';

export default function ContractSignView() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const loadOrder = async () => {
      try {
        setLoading(true);
        const data = await orderApi.getOrderByToken(token);
        setOrder(data);
      } catch (err) {
        console.error('Load contract error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Spin size="large" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Đang tải thông tin Hợp đồng Vận chuyển...</p>
      </div>
    );
  }

  const hasUploadedScannedContract =
    Boolean(order?.contract_uploaded) ||
    Boolean(order?.signed_order_contract_file) ||
    order?.web_workflow?.stage === 'CONTRACT_SIGNED';

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            icon={<ArrowLeft size={14} />}
            onClick={() => router.push(`/customer/order-documents/${token}`)}
            className="text-xs text-slate-600"
          >
            Quay lại Hồ sơ Chứng từ
          </Button>
          {order?.order_code && (
            <Tag color="geekblue" className="font-mono text-xs px-3 py-1 rounded-full">
              Mã đơn: <b>{order.order_code}</b>
            </Tag>
          )}
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wide">
            <ShieldCheck size={14} /> Quy Trình Ký Kết Hợp Đồng Pháp Lý Hai Bên
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hợp Đồng Vận Chuyển Hàng Hóa (Ký Trực Tiếp &amp; Scan PDF)
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
            Theo quy định pháp lý, hợp đồng vận chuyển bắt buộc phải được hai bên (Khách hàng &amp; NEXLOG) ký kết trực tiếp và đóng dấu pháp nhân. Hệ thống không sử dụng chữ ký vẽ trực tuyến trên web.
          </p>
        </div>

        <Alert
          title={
            hasUploadedScannedContract
              ? 'Bộ phận Điều phối đã đính kèm bản scan PDF hợp đồng 2 bên ký kết!'
              : 'Hồ sơ đang chờ Điều phối viên đính kèm bản scan PDF hợp đồng đã ký của 2 bên'
          }
          description={
            <div className="space-y-1 text-xs text-slate-700 mt-1">
              <p className="m-0">
                Sau khi đại diện Quý khách hàng và đại diện Công ty Cổ phần Logistics NEXLOG ký trực tiếp lên hợp đồng, Điều phối viên phụ trách sẽ thực hiện scan và đính kèm tệp PDF hợp đồng vào hồ sơ đơn hàng.
              </p>
              {hasUploadedScannedContract && (
                <p className="m-0 text-emerald-700 font-semibold">
                  ✓ Tệp hợp đồng đã đính kèm: <b>{order?.contract_file || order?.signed_order_contract_file || `HD-${order?.order_code}.pdf`}</b> — Đơn hàng đã chuyển sang trạng thái <b>SẴN SÀNG XẾP XE</b>.
                </p>
              )}
            </div>
          }
          type={hasUploadedScannedContract ? 'success' : 'info'}
          showIcon
          className="rounded-2xl"
        />

        {/* Thông tin tóm tắt hợp đồng */}
        {order && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 space-y-6">
            <div className="text-center border-b border-slate-200 pb-6 space-y-1">
              <div className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </div>
              <div className="text-[11px] text-slate-500 font-semibold">
                Độc lập - Tự do - Hạnh phúc
              </div>
              <div className="pt-3">
                <h2 className="text-lg sm:text-xl font-extrabold text-indigo-900 m-0 uppercase tracking-tight">
                  HỢP ĐỒNG DỊCH VỤ VẬN TẢI HÀNG HÓA
                </h2>
                <div className="text-xs font-mono text-slate-500 mt-1">
                  Số HĐ: <b className="text-indigo-600">NEX/2026/HDVT-{order?.order_code}</b>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-1">
                <span className="font-bold text-slate-800 uppercase block text-[11px]">BÊN A (BÊN VẬN CHUYỂN):</span>
                <div className="font-bold text-indigo-700">CÔNG TY CỔ PHẦN LOGISTICS NEXLOG</div>
                <div className="text-slate-600">ĐKKD / MST: 0109988776</div>
                <div className="text-slate-600">Địa chỉ: Tầng 6, ALS Building, Cảng HKQT Nội Bài, Hà Nội</div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 uppercase block text-[11px]">BÊN B (KHÁCH HÀNG):</span>
                <div className="font-bold text-slate-800">{order?.customer_name}</div>
                <div className="text-slate-600">Mã số thuế: <b>{order?.customer_tax_code || 'Chưa cung cấp'}</b></div>
                <div className="text-slate-600">Số điện thoại: {order?.customer_phone}</div>
              </div>
            </div>

            <Divider className="my-2" />

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <FileCheck size={20} className="text-indigo-600" />
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Phương thức xác nhận hợp đồng: Hai bên ký trực tiếp &amp; Điều phối viên đính kèm bản scan PDF
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Đảm bảo đầy đủ tính pháp lý và dấu mộc của hai doanh nghiệp trước khi lăn bánh.
                  </div>
                </div>
              </div>
              {hasUploadedScannedContract ? (
                <Tag color="success" className="font-bold text-xs px-3 py-1 flex items-center gap-1 m-0">
                  <CheckCircle2 size={13} /> ĐÃ ĐÍNH KÈM BẢN SCAN PDF
                </Tag>
              ) : (
                <Tag color="warning" className="font-bold text-xs px-3 py-1 m-0">
                  CHỜ ĐIỀU PHỐI ĐÍNH KÈM BẢN SCAN PDF
                </Tag>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
