import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Result, Tag, Spin, message, Alert, Modal, Input, InputNumber, Select, Form } from 'antd';
import { 
  Package, 
  MapPin, 
  CheckCircle2, 
  DollarSign, 
  ShieldCheck, 
  PhoneCall, 
  ArrowRight,
  Info,
  MessageSquare,
  RefreshCw,
  Truck
} from 'lucide-react';
import { orderApi } from '../../../src/api/orderApi';
import { VEHICLE_SPECS, getVehicleSpecByKey } from '../../../src/data/dispatcherPresets';

const { TextArea } = Input;
const { Option } = Select;

export default function OrderConfirmationView() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreeing, setAgreeing] = useState(false);
  const [agreedSuccess, setAgreedSuccess] = useState(false);

  // Negotiation Modal
  const [negotiateModalOpen, setNegotiateModalOpen] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [negotiateForm] = Form.useForm();

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
        if (data.web_workflow?.stage === 'CUSTOMER_NEGOTIATING') {
          setFeedbackSuccess(true);
        } else {
          setFeedbackSuccess(false);
        }
      } catch (err) {
        console.error('Failed to load order by token:', err);
        message.error('Không tìm thấy thông tin đơn hàng hoặc đường link đã hết hạn.');
      } finally {
        setLoading(false);
      }
    };
    loadOrder();

    // Polling tự động mỗi 3 giây để cập nhật ngay khi điều phối chốt lại giá / xe
    const interval = setInterval(async () => {
      try {
        const latestData = await orderApi.getOrderByToken(token);
        if (latestData) {
          setOrder(prev => {
            if (!prev) return latestData;
            const stageChangedToQuoted =
              prev.web_workflow?.stage === 'CUSTOMER_NEGOTIATING' &&
              latestData.web_workflow?.stage === 'PRICE_AGREED_BY_DISPATCHER';
            const priceChanged = prev.agreed_price !== latestData.agreed_price;
            const vehicleChanged = prev.proposed_vehicle_type !== latestData.proposed_vehicle_type;

            if (stageChangedToQuoted || priceChanged || vehicleChanged) {
              setFeedbackSuccess(false);
              const vSpec = getVehicleSpecByKey(latestData.proposed_vehicle_type || latestData.vehicle_type_required);
              message.info(
                `Điều phối viên vừa cập nhật phương án ${vSpec.label} & chốt lại mức giá: ${Number(latestData.agreed_price).toLocaleString('vi-VN')} VNĐ${
                  latestData.web_workflow?.adjustment_reason
                    ? ` (Lý do: ${latestData.web_workflow.adjustment_reason})`
                    : ''
                }!`
              );
            }
            return latestData;
          });
        }
      } catch (e) {
        // bỏ qua lỗi polling ngầm
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token]);

  const handleAgreePrice = async () => {
    try {
      setAgreeing(true);
      await orderApi.customerAgreeOrderPrice(token);
      message.success('Quý khách đã đồng ý chốt Phương án xe & Giá cước thành công!');
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

  const handleOpenNegotiateModal = () => {
    negotiateForm.resetFields();
    negotiateForm.setFieldsValue({
      feedback_reason: 'Giá cước vượt ngân sách',
      proposed_price: order?.web_workflow?.negotiation?.proposed_price || undefined,
      proposed_vehicle_type: order?.proposed_vehicle_type || order?.vehicle_type_required || '2.5T',
      customer_note: ''
    });
    setNegotiateModalOpen(true);
  };

  const handleNegotiateSubmit = async () => {
    try {
      const values = await negotiateForm.validateFields();
      setSubmittingFeedback(true);
      await orderApi.customerNegotiateOrder(token, values);
      message.success('Đã gửi yêu cầu thương lượng giá & phương án xe thành công! Điều phối viên sẽ phản hồi sớm nhất.');
      setFeedbackSuccess(true);
      setNegotiateModalOpen(false);
      // Reload order info
      const updatedData = await orderApi.getOrderByToken(token);
      setOrder(updatedData);
    } catch (err) {
      console.error('Negotiate submit error:', err);
      message.error(err.message || 'Không thể gửi yêu cầu đàm phán');
    } finally {
      setSubmittingFeedback(false);
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

  const isCurrentlyNegotiating = feedbackSuccess || order.web_workflow?.stage === 'CUSTOMER_NEGOTIATING';
  const hasDispatcherRequoted =
    !isCurrentlyNegotiating &&
    Boolean(order.web_workflow?.adjustment_reason) &&
    order.web_workflow?.stage === 'PRICE_AGREED_BY_DISPATCHER';

  const customerInitialVehicleKey = order.customer_requested_vehicle || order.vehicle_type_required || '2.5T';
  const proposedVehicleKey = order.agreed_vehicle_type || order.proposed_vehicle_type || order.vehicle_type_required || '2.5T';
  const customerVehicleSpec = getVehicleSpecByKey(customerInitialVehicleKey);
  const proposedVehicleSpec = getVehicleSpecByKey(proposedVehicleKey);
  const isVehicleAdjustedByDispatcher = customerVehicleSpec.key !== proposedVehicleSpec.key;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wide uppercase">
            <ShieldCheck size={14} className="text-indigo-600" /> Cổng Xác Nhận Dịch Vụ Vận Tải Trực Tuyến NEXLOG
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Xác Nhận Phương Án Xe &amp; Chốt Giá Cước
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Kính gửi <b>{order.customer_name}</b>, bộ phận Điều phối NEXLOG đã phân tích kích thước/tải trọng hàng hóa và lập phương án xe tối ưu cho Quý khách.
          </p>
        </div>

        {/* Thẻ Giá cước & Phương án xe nổi bật */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                  <DollarSign size={15} /> Giá cước trọn gói ({proposedVehicleSpec.label})
                </span>
                {isCurrentlyNegotiating && (
                  <span className="text-[11px] bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded-full">
                    Đang thương lượng
                  </span>
                )}
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold mt-1 font-mono tracking-tight">
                {(order.agreed_price || 0).toLocaleString()} <span className="text-xl font-normal text-indigo-200">VNĐ</span>
              </div>
              <p className="text-xs text-indigo-100/90 mt-1.5">
                ✓ Phương tiện chốt vận chuyển: <b>{proposedVehicleSpec.label}</b> ({proposedVehicleSpec.boxText}, tải {proposedVehicleSpec.maxPayloadKg.toLocaleString('vi-VN')} kg)
              </p>
            </div>
            
            <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-right shrink-0">
              <span className="text-[11px] text-indigo-200 block uppercase font-bold">Mã vận đơn</span>
              <span className="text-base font-bold font-mono text-white">{order.order_code}</span>
            </div>
          </div>

          {/* Thanh tương tác tức thì (Không delay) */}
          <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-indigo-100 flex items-center gap-1.5 font-medium">
              <span>⚡</span> Trao đổi trực tiếp không delay với Điều phối viên:
            </span>
            <div className="flex items-center gap-2">
              <a
                href="tel:0988123456"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all"
              >
                <PhoneCall size={13} /> Gọi Hotline 24/7
              </a>
              <a
                href="https://zalo.me/0988123456"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-all"
              >
                <MessageSquare size={13} /> Chat Zalo Ngay
              </a>
            </div>
          </div>
        </div>

        {/* KHỐI PHÂN TÍCH & ĐỀ XUẤT PHƯƠNG ÁN XE CỦA ĐIỀU PHỐI VIÊN */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-indigo-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-bold text-indigo-950 flex items-center gap-2">
              <Truck size={18} className="text-indigo-600" />
              Phương án xếp xe &amp; Thẩm định kỹ thuật của Điều phối viên
            </span>
            {isVehicleAdjustedByDispatcher ? (
              <Tag color="gold" className="m-0 font-bold text-[11px]">
                Đề xuất điều chỉnh loại xe phù hợp kích thước / tải trọng
              </Tag>
            ) : (
              <Tag color="green" className="m-0 font-bold text-[11px]">
                Khớp với loại xe Quý khách chọn ban đầu
              </Tag>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">1. Xe Quý khách chọn ban đầu</span>
              <div className="text-sm font-bold text-slate-800 mt-1">{customerVehicleSpec.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {customerVehicleSpec.boxText} · Tối đa {customerVehicleSpec.maxPayloadKg.toLocaleString('vi-VN')} kg ({customerVehicleSpec.maxVolumeM3} m³)
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200">
              <span className="text-[11px] font-bold text-indigo-700 uppercase block">2. Phương án xe Điều phối đề xuất chốt</span>
              <div className="text-sm font-extrabold text-indigo-900 mt-1">{proposedVehicleSpec.label}</div>
              <div className="text-[11px] text-indigo-700 mt-0.5">
                {proposedVehicleSpec.boxText} · Tối đa {proposedVehicleSpec.maxPayloadKg.toLocaleString('vi-VN')} kg ({proposedVehicleSpec.maxVolumeM3} m³)
              </div>
            </div>
          </div>

          {order.vehicle_analysis_note && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950">
              <span className="font-bold block mb-0.5">💬 Phân tích &amp; tư vấn xếp xe từ Điều phối viên:</span>
              <span>{order.vehicle_analysis_note}</span>
            </div>
          )}
        </div>

        {/* Thông báo phản hồi giá mới từ Điều phối viên sau khi thương lượng */}
        {hasDispatcherRequoted && !agreedSuccess && (
          <Alert
            title={
              <span className="font-bold text-indigo-950">
                Điều phối viên đã cập nhật phương án {proposedVehicleSpec.label} &amp; chốt lại giá cước mới: {(order.agreed_price || 0).toLocaleString('vi-VN')} VNĐ
              </span>
            }
            description={
              <div className="text-xs text-indigo-900 space-y-1 mt-1">
                <div>
                  • Lý do điều chỉnh / phản hồi từ Điều phối viên: <b>&ldquo;{order.web_workflow.adjustment_reason}&rdquo;</b>
                </div>
                <div className="text-slate-600 pt-0.5">
                  Nếu Quý khách đồng ý với phương án xe và mức giá trên, vui lòng bấm <b>&ldquo;Đồng ý chốt Phương án xe &amp; Giá cước&rdquo;</b>. Nếu chưa ưng ý, Quý khách có thể bấm <b>&ldquo;Thương lượng lại giá (Deal lại)&rdquo;</b> bên dưới để tiếp tục đề xuất!
                </div>
              </div>
            }
            type="info"
            showIcon
            className="rounded-2xl border border-indigo-300 bg-indigo-50/90"
          />
        )}

        {/* Thông báo nếu đã chốt */}
        {agreedSuccess && (
          <Alert
            title="Quý khách đã đồng ý chốt Phương án xe và Giá cước thành công!"
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
              {order.source === 'HOMEPAGE' || order.source === 'Web' ? 'Đơn Đăng Ký Website' : order.source}
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
              <span className="text-[11px] text-slate-500 block">Số lượng / Quy cách</span>
              <span className="text-sm font-bold text-slate-800">
                {order.package_count || 1} {order.package_unit || 'kiện'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="text-[11px] text-slate-500 block">Kích thước (DxRxC)</span>
              <span className="text-sm font-bold text-slate-800">
                {order.length_cm || 0}×{order.width_cm || 0}×{order.height_cm || 0} cm
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="text-[11px] text-slate-500 block">Trọng lượng thực</span>
              <span className="text-sm font-bold text-slate-800">{order.actual_weight_kg || 0} kg</span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-150">
              <span className="text-[11px] text-indigo-700 block font-semibold">Tải trọng tính cước</span>
              <span className="text-sm font-extrabold text-indigo-700 font-mono">{order.chargeable_weight_kg || 0} kg</span>
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
                  <div key={idx} className="p-3 flex items-center justify-between text-xs bg-slate-50/50 flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-slate-800">{idx + 1}. {it.cargo_name}</span>
                      <span className="ml-2 text-slate-500">({it.cargo_type})</span>
                    </div>
                    <div className="flex gap-4 text-slate-600">
                      <span>SL: <b>{it.package_count} {it.package_unit}</b></span>
                      {(it.length_cm || it.width_cm || it.height_cm) ? (
                        <span>KT: <b>{it.length_cm || 0}×{it.width_cm || 0}×{it.height_cm || 0} cm</b></span>
                      ) : null}
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

          {/* Thông báo nếu khách đang yêu cầu đàm phán lại */}
          {isCurrentlyNegotiating && (
            <Alert
              title={
                <span className="font-bold text-amber-950">
                  Trạng thái: Đang thương lượng — Yêu cầu điều chỉnh giá / phương án xe của Quý khách đã được gửi tới Điều phối viên!
                </span>
              }
              description={
                <div className="text-xs text-amber-900 space-y-1 mt-1">
                  <div>• Lý do: <b>{order.web_workflow?.negotiation?.feedback_reason || 'Cần điều chỉnh thêm'}</b></div>
                  {order.web_workflow?.negotiation?.proposed_price && (
                    <div>• Mức giá Quý khách đề xuất: <b>{order.web_workflow.negotiation.proposed_price.toLocaleString('vi-VN')} VNĐ</b></div>
                  )}
                  {order.web_workflow?.negotiation?.proposed_vehicle_type && (
                    <div>• Loại xe Quý khách đề xuất: <b>{getVehicleSpecByKey(order.web_workflow.negotiation.proposed_vehicle_type).label}</b></div>
                  )}
                  {order.web_workflow?.negotiation?.customer_note && (
                    <div>• Ghi chú: <i>&ldquo;{order.web_workflow.negotiation.customer_note}&rdquo;</i></div>
                  )}
                  <div className="pt-1 text-slate-600">
                    Điều phối viên NEXLOG đang xem xét và sẽ chốt lại mức giá kèm phương án xe ngay trên trang này (tự động cập nhật).
                  </div>
                </div>
              }
              type="warning"
              showIcon
              className="rounded-2xl border border-amber-300 bg-amber-50/90"
            />
          )}

          {/* Nút Hành Động Đồng Ý & Thương Lượng Lại (Có thể deal lại nhiều lần cho đến khi ưng ý) */}
          {!agreedSuccess ? (
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="large"
                  icon={hasDispatcherRequoted ? <RefreshCw size={16} /> : <MessageSquare size={16} />}
                  onClick={handleOpenNegotiateModal}
                  className="border-amber-400 text-amber-800 hover:text-amber-900 hover:border-amber-500 bg-amber-50/60 font-semibold h-12 rounded-xl w-full sm:w-auto"
                >
                  {hasDispatcherRequoted
                    ? 'Chưa ưng phương án / giá này? Thương lượng lại (Deal lại)'
                    : isCurrentlyNegotiating
                      ? 'Cập nhật lại đề xuất thương lượng'
                      : 'Yêu cầu thương lượng lại giá / phương án xe'}
                </Button>
              </div>

              <Button
                type="primary"
                size="large"
                loading={agreeing}
                onClick={handleAgreePrice}
                icon={<CheckCircle2 size={18} />}
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-indigo-600/25 w-full sm:w-auto"
              >
                Đồng ý chốt Phương án xe &amp; Giá cước
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

        {/* MODAL YÊU CẦU ĐIỀU CHỈNH GIÁ / PHƯƠNG ÁN XE / LỊCH TRÌNH */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-base font-bold text-slate-800">
              <MessageSquare size={18} className="text-amber-600" />
              Thương lượng lại Giá cước &amp; Phương án xe vận chuyển
            </div>
          }
          open={negotiateModalOpen}
          onCancel={() => setNegotiateModalOpen(false)}
          onOk={handleNegotiateSubmit}
          confirmLoading={submittingFeedback}
          okText="Gửi đề xuất thương lượng"
          cancelText="Đóng"
          okButtonProps={{ className: 'bg-[#4f46e5] font-semibold' }}
          destroyOnHidden
          centered
        >
          <div className="py-2 space-y-3">
            <p className="text-xs text-slate-600">
              Nếu mức giá hiện tại <b>{(order.agreed_price || 0).toLocaleString()} VNĐ</b> hoặc phương án xe <b>{proposedVehicleSpec.label}</b> chưa phù hợp, vui lòng gửi đề xuất bên dưới. Điều phối viên sẽ thẩm định và chốt lại cho Quý khách ngay:
            </p>

            <Form form={negotiateForm} layout="vertical" initialValues={{ feedback_reason: 'Giá cước vượt ngân sách' }}>
              <Form.Item label={<span className="text-xs font-semibold">Lý do thương lượng (*)</span>} name="feedback_reason" rules={[{ required: true }]}>
                <Select className="text-xs">
                  <Option value="Giá cước vượt ngân sách">💰 Giá cước vượt ngân sách dự toán</Option>
                  <Option value="Muốn thương lượng giảm thêm giá cước">🤝 Muốn thương lượng giảm thêm giá cước</Option>
                  <Option value="Muốn đổi loại phương tiện">🚛 Muốn trao đổi lại loại xe tải vận chuyển</Option>
                  <Option value="Muốn thay đổi ngày/giờ lấy hàng">📅 Muốn thay đổi ngày / giờ lấy hàng</Option>
                  <Option value="Thay đổi số lượng hoặc quy cách hàng">📦 Thay đổi số lượng / quy cách hàng</Option>
                  <Option value="Lý do khác">Khác (nhập chi tiết bên dưới)</Option>
                </Select>
              </Form.Item>

              <Form.Item label={<span className="text-xs font-semibold">Phương án xe Quý khách mong muốn</span>} name="proposed_vehicle_type">
                <Select className="text-xs">
                  {VEHICLE_SPECS.map((v) => (
                    <Option key={v.key} value={v.key}>
                      {v.label} — {v.boxText} (Tối đa {v.maxPayloadKg.toLocaleString('vi-VN')} kg)
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label={<span className="text-xs font-semibold">Mức giá Quý khách đề xuất (VNĐ)</span>} name="proposed_price">
                <InputNumber
                  placeholder="VD: 2,300,000"
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val.replace(/\$\s?|(,*)/g, '')}
                  className="w-full font-bold text-indigo-700"
                  min={100000}
                />
              </Form.Item>

              <Form.Item label={<span className="text-xs font-semibold">Ghi chú cụ thể gửi Điều phối viên (*)</span>} name="customer_note" rules={[{ required: true, message: 'Vui lòng nhập nội dung đề xuất của Quý khách' }]}>
                <TextArea rows={3} placeholder="VD: Hàng 20 thùng carton của mình xếp gọn được trên xe 2.5 tấn, bên bạn xem xét giảm cước nhé..." className="text-xs" />
              </Form.Item>
            </Form>
          </div>
        </Modal>

      </div>
    </div>
  );
}
