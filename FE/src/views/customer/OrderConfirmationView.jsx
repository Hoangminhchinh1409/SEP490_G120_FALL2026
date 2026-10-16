"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Result, Tag, Spin, message, Alert, Divider } from 'antd';
import { 
  Package, 
  MapPin, 
  CheckCircle2, 
  DollarSign, 
  FileText, 
  ShieldCheck, 
  Clock, 
  PhoneCall, 
  ArrowRight,
  Send,
  Building,
  Info
} from 'lucide-react';
import { orderApi } from '../../../src/api/orderApi';

export default function OrderConfirmationView() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreeing, setAgreeing] = useState(false);
  const [agreedSuccess, setAgreedSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    const loadOrder = async () => {
      try {
        setLoading(true);
        const data = await orderApi.getOrderByToken(token);
        setOrder(data);
        if (data.web_workflow?.stage === 'CUSTOMER_CONFIRMED' || 
            data.web_workflow?.stage === 'DOCS_UPLOADED' || 
            data.web_workflow?.stage === 'DOCS_APPROVED' || 
            data.web_workflow?.stage === 'CONTRACT_SIGNED') {
          setAgreedSuccess(true);
        }
      } catch (err) {
        console.error('Failed to load order by token:', err);
        message.error('Không tìm thấy thông tin đơn hàng hoặc đường link đã hết hạn.');
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [token]);

  const handleAgreePrice = async () => {
    try {
      setAgreeing(true);
      await orderApi.customerAgreeOrderPrice(token);
      message.success('Quý khách đã đồng ý chốt đơn hàng và giá cước thành công!');
      setAgreedSuccess(true);
      setTimeout(() => {
        router.push(`/customer/order-documents/${token}`);
      }, 1500);
    } catch (err) {
      console.error('Agree price error:', err);
      message.error(err.message || 'Lỗi khi xác nhận đơn hàng');
    } finally {
      setAgreeing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Spin size="large" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Đang tải thông tin xác nhận đơn hàng từ NEXLOG...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-lg rounded-2xl border-0">
          <Result
            status="404"
            title="Đường link không hợp lệ"
            subTitle="Không tìm thấy đơn hàng yêu cầu xác nhận hoặc link bảo mật đã hết hạn."
            extra={
              <Button type="primary" className="bg-[#4f46e5]" onClick={() => router.push('/')}>
                Về Trang Chủ
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wide uppercase">
            <ShieldCheck size={14} className="text-indigo-600" /> Cổng Xác Nhận Dịch Vụ Vận Tải Trực Tuyến NEXLOG
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Xác Nhận Đơn Hàng &amp; Chốt Giá Cước
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Kính gửi <b>{order.customer_name}</b>, bộ phận Điều phối NEXLOG đã tiếp nhận và thẩm định lộ trình vận chuyển của Quý khách.
          </p>
        </div>

        {/* Thẻ Giá cước nổi bật */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                <DollarSign size={15} /> Giá cước trọn gói thỏa thuận
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold mt-1 font-mono tracking-tight">
                {(order.agreed_price || 0).toLocaleString()} <span className="text-xl font-normal text-indigo-200">VNĐ</span>
              </div>
              <p className="text-xs text-indigo-100/90 mt-1.5">
                ✓ Đã bao gồm cước xe, bảo hiểm cơ bản &amp; theo dõi hành trình trực tuyến.
              </p>
            </div>
            
            <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-right shrink-0">
              <span className="text-[11px] text-indigo-200 block uppercase font-bold">Mã vận đơn</span>
              <span className="text-base font-bold font-mono text-white">{order.order_code}</span>
            </div>
          </div>
        </div>

        {/* Thông báo nếu đã chốt */}
        {agreedSuccess && (
          <Alert
            title="Quý khách đã đồng ý chốt đơn hàng và giá cước thành công!"
            description={
              <div className="space-y-2 mt-1 text-xs">
                <span>Vui lòng chuyển tiếp tới bước <b>Nộp hồ sơ chứng từ</b> để điều phối viên hoàn tất thủ tục cấp hợp đồng.</span>
                <div className="pt-2">
                  <Button 
                    type="primary" 
                    icon={<ArrowRight size={14} />} 
                    className="bg-indigo-600 font-semibold"
                    onClick={() => router.push(`/customer/order-documents/${token}`)}
                  >
                    Tiến hành Tải lên Chứng từ
                  </Button>
                </div>
              </div>
            }
            type="success"
            showIcon
            className="rounded-2xl border border-emerald-300 bg-emerald-50/90"
          />
        )}

        {/* Chi tiết đơn hàng */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 m-0">
              <Package size={18} className="text-indigo-600" /> Chi Tiết Lô Hàng Đã Tạo
            </h3>
            <Tag color="purple" className="font-semibold text-xs py-0.5 px-2.5 rounded-full">
              {order.source === 'HOMEPAGE' ? 'Đơn Đăng Ký Website' : order.source}
            </Tag>
          </div>

          {/* Lộ trình Giao nhận */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                <MapPin size={14} /> Điểm lấy hàng:
              </span>
              <p className="text-xs font-medium text-slate-700 m-0 leading-relaxed">
                {order.pickup_address}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <MapPin size={14} /> Điểm giao hàng:
              </span>
              <p className="text-xs font-medium text-slate-700 m-0 leading-relaxed">
                {order.delivery_address}
              </p>
            </div>
          </div>

          {/* Quy cách hàng & Trọng lượng */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="text-[11px] text-slate-500 block">Số lượng</span>
              <span className="text-sm font-bold text-slate-800">{order.package_count || 1} kiện</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="text-[11px] text-slate-500 block">Trọng lượng thực</span>
              <span className="text-sm font-bold text-slate-800">{order.actual_weight_kg || 0} kg</span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-150">
              <span className="text-[11px] text-indigo-700 block font-semibold">Tải trọng tính cước</span>
              <span className="text-sm font-extrabold text-indigo-700 font-mono">{order.chargeable_weight_kg || 0} kg</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="text-[11px] text-slate-500 block">Mã số thuế</span>
              <span className="text-xs font-bold font-mono text-slate-800">{order.customer_tax_code || 'Chưa cung cấp'}</span>
            </div>
          </div>

          {/* Danh sách hàng nếu có nhiều loại */}
          {order.items && Array.isArray(order.items) && order.items.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Danh mục chi tiết ({order.items.length} loại hàng):
              </span>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {order.items.map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs bg-slate-50/50">
                    <div>
                      <span className="font-bold text-slate-800">{idx + 1}. {it.cargo_name}</span>
                      <span className="ml-2 text-slate-500">({it.cargo_type})</span>
                    </div>
                    <div className="flex gap-4 text-slate-600">
                      <span>SL: <b>{it.package_count} {it.package_unit}</b></span>
                      <span>Trọng lượng: <b>{it.weight} kg</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ghi chú thật của khách */}
          {order.user_note && (
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900">
              <span className="font-bold block mb-1">Ghi chú yêu cầu của Quý khách:</span>
              <p className="m-0 italic">{order.user_note}</p>
            </div>
          )}

          {/* Cam kết dịch vụ */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Info size={14} className="text-indigo-600" /> Cam kết chất lượng vận chuyển NEXLOG:
            </span>
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5 m-0">
              <li>Phương tiện vận tải chuyên dùng đạt chuẩn kiểm định an toàn kỹ thuật.</li>
              <li>Hỗ trợ thủ tục kiểm duyệt chứng từ thông quan nhanh tại ga/kho ALS.</li>
              <li>Hợp đồng điện tử ký số hợp pháp theo Luật Giao dịch Điện tử.</li>
            </ul>
          </div>

          {/* Nút Hành Động Đồng Ý */}
          {!agreedSuccess ? (
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 text-center sm:text-left">
                Nhấn <b>"Đồng ý chốt đơn hàng &amp; Giá cước"</b> để chuyển sang bước tải lên chứng từ.
              </div>
              <Button
                type="primary"
                size="large"
                loading={agreeing}
                onClick={handleAgreePrice}
                icon={<CheckCircle2 size={18} />}
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-indigo-600/25 w-full sm:w-auto"
              >
                Đồng ý chốt đơn hàng &amp; Giá cước
              </Button>
            </div>
          ) : (
            <div className="pt-2 text-center">
              <Button
                type="primary"
                size="large"
                onClick={() => router.push(`/customer/order-documents/${token}`)}
                icon={<ArrowRight size={18} />}
                className="bg-[#4f46e5] font-bold px-8 h-12 rounded-xl"
              >
                Chuyển sang Bước Tải Chứng Từ Ngay
              </Button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
