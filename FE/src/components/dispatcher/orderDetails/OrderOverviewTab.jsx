import React from 'react';
import { Tag, Button, InputNumber, Input, Popover, Select } from 'antd';
import { 
  AlertTriangle, 
  PhoneCall, 
  MessageCircle, 
  Mail, 
  DollarSign, 
  Calculator, 
  Route, 
  Package,
  RefreshCw,
  CheckCircle2,
  Truck,
  Sparkles
} from 'lucide-react';
import RouteMapPicker from '../../common/RouteMapPicker';
import { VEHICLE_SPECS, getVehicleSpecByKey } from '../../../data/dispatcherPresets';

const { Option } = Select;

export default function OrderOverviewTab({
  order,
  routeInfo,
  setRouteInfo,
  pickupAddress,
  deliveryAddress,
  pickupCoords,
  deliveryCoords,
  pricingBreakdown,
  estimatedBaselineRate,
  currentAgreedPrice,
  setCurrentAgreedPrice,
  adjustmentReason,
  setAdjustmentReason,
  proposedVehicleType,
  setProposedVehicleType,
  vehicleAnalysisNote,
  setVehicleAnalysisNote,
  vehicleRecommendation,
  savingPrice,
  handleConfirmPriceAndOrder
}) {
  const cleanPhone = (order.customer_phone || '').replace(/[^0-9]/g, '');
  const isNegotiating = order.status === 'NEGOTIATING' || order.web_workflow?.stage === 'CUSTOMER_NEGOTIATING';
  const canEditPrice = order.status === 'DRAFT' || isNegotiating;
  const negotiation = order.web_workflow?.negotiation;
  const negotiationHistory = Array.isArray(order.web_workflow?.negotiation_history)
    ? order.web_workflow.negotiation_history
    : [];

  const currentProposedSpec = getVehicleSpecByKey(proposedVehicleType || order.vehicle_type_required || 'TRUCK_2.5T');
  const customerInitialSpec = vehicleRecommendation?.customerSpec || getVehicleSpecByKey(order.customer_requested_vehicle || order.vehicle_type_required || 'TRUCK_2.5T');
  const recommendedSpec = vehicleRecommendation?.recommendedSpec || currentProposedSpec;

  return (
    <div className="space-y-4">
      {/* 1. ĐẶT LÊN TRÊN CÙNG (TRƯỚC LIÊN HỆ KHÁCH HÀNG & CHỐT CƯỚC): Khối Khách hàng muốn thương lượng lại giá & phương án xe */}
      {isNegotiating && negotiation && (
        <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-300 text-xs space-y-2.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
            <span className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>Khách hàng yêu cầu thương lượng lại giá cước / phương án xe{negotiation.round > 1 ? ` (Lần ${negotiation.round})` : ''}:</span>
            </span>
            <span className="text-xs bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full font-bold border border-amber-300">
              Đang thương lượng
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-gray-800">
            <div>
              • Lý do khách yêu cầu: <b className="text-amber-950">{negotiation.feedback_reason || 'Giá cước vượt ngân sách'}</b>
            </div>
            {negotiation.proposed_price ? (
              <div className="flex items-center flex-wrap gap-1.5">
                <span>• Giá khách mong muốn:</span>
                <b className="text-emerald-700 text-sm font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {Number(negotiation.proposed_price).toLocaleString('vi-VN')} đ
                </b>
                <button
                  type="button"
                  onClick={() => setCurrentAgreedPrice(negotiation.proposed_price)}
                  className="text-[11px] text-indigo-600 underline font-bold hover:text-indigo-800 cursor-pointer"
                >
                  [Áp dụng mức giá này]
                </button>
              </div>
            ) : (
              <div>• Giá báo trước đó: <b className="font-mono">{(order.agreed_price || 0).toLocaleString('vi-VN')} đ</b></div>
            )}
            {negotiation.proposed_vehicle_type && (
              <div className="flex items-center flex-wrap gap-1.5">
                <span>• Loại xe khách đề xuất:</span>
                <b className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {getVehicleSpecByKey(negotiation.proposed_vehicle_type).label}
                </b>
                {setProposedVehicleType && (
                  <button
                    type="button"
                    onClick={() => setProposedVehicleType(negotiation.proposed_vehicle_type)}
                    className="text-[11px] text-indigo-600 underline font-bold hover:text-indigo-800 cursor-pointer"
                  >
                    [Chọn theo xe khách đề xuất]
                  </button>
                )}
              </div>
            )}
            {negotiation.proposed_pickup_date && (
              <div>• Ngày lấy hàng khách đề xuất: <b>{negotiation.proposed_pickup_date}</b></div>
            )}
            {negotiation.customer_note && (
              <div className="sm:col-span-2 bg-white p-2.5 rounded-lg border border-amber-200 text-gray-700">
                <span className="font-semibold text-amber-900 not-italic mr-1">Ghi chú từ khách hàng:</span>
                <span className="italic">&ldquo;{negotiation.customer_note}&rdquo;</span>
              </div>
            )}
          </div>

          {/* Lịch sử các lần thương lượng trước (nếu khách deal nhiều lần) */}
          {negotiationHistory.length > 0 && (
            <div className="pt-2 border-t border-amber-200/70 space-y-1">
              <div className="text-[11px] font-bold text-amber-900">Lịch sử thương lượng trước đó ({negotiationHistory.length} lần):</div>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {negotiationHistory.map((item, idx) => (
                  <div key={idx} className="text-[11px] bg-white/80 px-2.5 py-1.5 rounded border border-amber-100 flex flex-wrap justify-between gap-2">
                    <span>
                      <b>Lần {item.round || idx + 1}:</b> Khách đề xuất{' '}
                      <b className="text-emerald-700">
                        {item.customer_proposed_price ? `${Number(item.customer_proposed_price).toLocaleString('vi-VN')} đ` : 'điều chỉnh'}
                      </b>{' '}
                      ({item.customer_feedback_reason})
                    </span>
                    <span>
                      → Đã chốt lại: <b className="text-indigo-700">{Number(item.dispatcher_new_price || 0).toLocaleString('vi-VN')} đ</b>{' '}
                      {item.dispatcher_proposed_vehicle ? `[${getVehicleSpecByKey(item.dispatcher_proposed_vehicle).shortLabel}] ` : ''}
                      <span className="italic text-gray-500">({item.dispatcher_adjustment_reason})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Banner hướng dẫn luồng xử lý đối với đơn DRAFT chưa thương lượng */}
      {order.status === 'DRAFT' && !isNegotiating && (
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-indigo-50 rounded-xl border border-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-xs mb-1">
            <AlertTriangle size={15} className="text-amber-600" />
            <span>Quy trình xử lý đơn hàng nháp (Phân tích phương án xe &amp; Chốt cước):</span>
          </div>
          <div className="text-xs text-gray-700 space-y-0.5">
            <p>1. Kiểm tra <b>Gợi ý xếp xe &amp; Phân tích tải trọng/kích thước</b> bên dưới để chọn loại xe phù hợp nhất cho lô hàng.</p>
            <p>2. <b>Gọi điện / nhắn Zalo</b> trao đổi với khách hàng về phương án xe và thống nhất mức giá cước.</p>
            <p>3. Chọn phương án xe, nhập giá đã chốt và bấm <b>&quot;Chốt phương án xe &amp; Giá cước&quot;</b> để gửi báo giá cho khách đồng ý xác nhận.</p>
          </div>
        </div>
      )}

      {/* 2. KHỐI GỢI Ý XẾP XE BAN ĐẦU & PHÂN TÍCH CHỌN XE ĐÚNG ĐỂ TRAO ĐỔI VỚI KHÁCH HÀNG */}
      <div className="p-4 bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/60 rounded-xl border border-emerald-200 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
              <Truck size={15} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                Phân tích &amp; Gợi ý xếp xe phù hợp (Trao đổi chốt phương án xe với khách)
              </span>
              <span className="text-[11px] text-gray-500 block">
                Đối chiếu giữa xe khách chọn ban đầu và phân tích kỹ thuật theo tải trọng ({order.chargeable || order.weight || 0} kg) &amp; kích thước ({order.length_cm || 0}×{order.width_cm || 0}×{order.height_cm || 0} cm)
              </span>
            </div>
          </div>
          <Tag
            color={
              vehicleRecommendation?.status === 'UNDER_CAPACITY'
                ? 'warning'
                : vehicleRecommendation?.status === 'OVER_CAPACITY'
                  ? 'processing'
                  : 'success'
            }
            className="m-0 font-bold text-[11px] px-2.5 py-0.5 rounded-full"
          >
            {vehicleRecommendation?.status === 'UNDER_CAPACITY'
              ? '⚠️ Xe khách chọn thiếu tải / hẹp thùng — Cần tư vấn đổi xe'
              : vehicleRecommendation?.status === 'OVER_CAPACITY'
                ? '💡 Xe khách chọn dư tải — Có thể tối ưu'
                : '✓ Xe khách chọn phù hợp thông số hàng'}
          </Tag>
        </div>

        {/* So sánh 3 cột: Xe khách chọn vs Hệ thống phân tích gợi ý vs Phương án xe điều phối chốt */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Cột 1: Xe khách chọn ban đầu */}
          <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-1">
            <div className="text-[11px] text-gray-500 font-medium">1. Loại xe khách chọn khi tạo đơn:</div>
            <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              <span>🚛 {customerInitialSpec.label}</span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              {customerInitialSpec.boxDimText} · Tải {customerInitialSpec.maxPayloadKg.toLocaleString('vi-VN')} kg
            </div>
          </div>

          {/* Cột 2: Hệ thống phân tích & gợi ý xếp xe */}
          <div className={`p-3 rounded-lg border space-y-1 ${
            vehicleRecommendation?.status === 'UNDER_CAPACITY'
              ? 'bg-amber-50/80 border-amber-300'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}>
            <div className="text-[11px] font-semibold text-emerald-900 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles size={12} className="text-emerald-600" /> 2. Hệ thống phân tích gợi ý:
              </span>
              {canEditPrice && proposedVehicleType !== recommendedSpec.key && (
                <button
                  type="button"
                  onClick={() => {
                    setProposedVehicleType?.(recommendedSpec.key);
                    if (!vehicleAnalysisNote) {
                      setVehicleAnalysisNote?.(vehicleRecommendation?.reason || '');
                    }
                  }}
                  className="text-[11px] font-bold text-indigo-600 underline hover:text-indigo-800 cursor-pointer"
                >
                  [Áp dụng gợi ý]
                </button>
              )}
            </div>
            <div className="font-bold text-emerald-800 text-sm">
              ✨ {recommendedSpec.label}
            </div>
            <div className="text-[11px] text-emerald-700 font-mono">
              {recommendedSpec.boxDimText} · Tải {recommendedSpec.maxPayloadKg.toLocaleString('vi-VN')} kg ({recommendedSpec.volumeM3} m³)
            </div>
          </div>

          {/* Cột 3: Điều phối viên chọn phương án xe để chốt với khách */}
          <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200 space-y-1.5">
            <div className="text-[11px] font-bold text-indigo-900">
              3. Phương án xe Điều phối chốt với khách:
            </div>
            {canEditPrice ? (
              <Select
                className="w-full text-xs"
                size="small"
                value={proposedVehicleType || 'TRUCK_2.5T'}
                onChange={(val) => setProposedVehicleType?.(val)}
              >
                {VEHICLE_SPECS.map(v => (
                  <Option key={v.key} value={v.key}>
                    {v.label} ({v.boxDimText} · {v.maxPayloadKg.toLocaleString('vi-VN')}kg)
                  </Option>
                ))}
              </Select>
            ) : (
              <div className="font-bold text-indigo-700 text-sm flex items-center gap-1.5">
                <span>✓ {currentProposedSpec.label}</span>
                <Tag color="blue" className="m-0 text-[10px]">Đã thống nhất</Tag>
              </div>
            )}
            <div className="text-[10px] text-indigo-600">
              {currentProposedSpec.boxDimText} · Giá sàn tương ứng: <b>{estimatedBaselineRate.toLocaleString('vi-VN')} đ</b>
            </div>
          </div>
        </div>

        {/* Nhận xét phân tích tự động & Ghi chú tư vấn chọn xe gửi khách */}
        <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-xs space-y-2">
          <div className="text-gray-700 leading-relaxed">
            <b className="text-emerald-800">📊 Nhận định kỹ thuật xếp hàng: </b>
            <span>{vehicleRecommendation?.reason}</span>
          </div>
          {canEditPrice ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1.5 border-t border-gray-100">
              <span className="text-[11px] font-semibold text-gray-600 shrink-0">
                Ghi chú phương án xe gửi khách:
              </span>
              <Input
                size="small"
                value={vehicleAnalysisNote}
                onChange={(e) => setVehicleAnalysisNote?.(e.target.value)}
                placeholder="VD: Lô hàng 20 thùng (200x200x200cm) cần đi Xe tải 3.5 tấn (thùng rộng 2.05m) để xếp vừa an toàn không bị cấn thùng..."
                className="text-xs flex-1"
              />
            </div>
          ) : (
            vehicleAnalysisNote && (
              <div className="text-[11px] text-indigo-800 bg-indigo-50/60 px-2.5 py-1.5 rounded border border-indigo-100">
                <b>Ghi chú phương án xe đã chốt với khách:</b> {vehicleAnalysisNote}
              </div>
            )
          )}
        </div>
      </div>

      {/* 3. Box Liên hệ khách hàng & Chốt giá cước thỏa thuận (kèm Phương án xe) */}
      <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <PhoneCall size={14} className="text-indigo-600" /> Liên hệ khách hàng &amp; Chốt phương án xe + Giá cước:
            </span>
            <span className="text-xs text-gray-600 font-medium mt-0.5 block">
              {order.customer || order.customer_name} - SĐT: <b className="text-gray-900">{order.customer_phone || 'Chưa có'}</b>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cleanPhone && (
              <>
                <a 
                  href={`tel:${cleanPhone}`} 
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs shadow-xs"
                >
                  <PhoneCall size={13} /> Gọi điện
                </a>
                <a 
                  href={`https://zalo.me/${cleanPhone}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs shadow-xs"
                >
                  <MessageCircle size={13} /> Nhắn Zalo
                </a>
              </>
            )}
            {order.customer_email && (
              <a 
                href={`mailto:${order.customer_email}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium text-xs border border-gray-200"
              >
                <Mail size={13} /> Gửi Email
              </a>
            )}
          </div>
        </div>

        {/* Ô Chốt giá cước thỏa thuận */}
        <div className="p-3.5 bg-white rounded-lg border border-indigo-100 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
                <DollarSign size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                  <span>{isNegotiating ? 'Điều chỉnh & Chốt lại giá cước:' : 'Giá cước thỏa thuận (kèm phương án xe):'}</span>
                  <Tag color="geekblue" className="m-0 text-[10px] font-semibold">
                    Phương án xe: {currentProposedSpec.label}
                  </Tag>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {canEditPrice ? (
                    <span className="flex items-center gap-1 flex-wrap">
                      <span>Cước phí chốt với khách theo <b>{currentProposedSpec.shortLabel}</b> (Giá gợi ý hệ thống:</span>
                      <Popover
                        title={
                          <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 py-0.5 border-b border-indigo-50">
                            <Calculator size={14} /> Chi tiết công thức tính giá gợi ý hệ thống
                          </div>
                        }
                        content={
                          <div className="text-xs space-y-2.5 p-1 w-80">
                            <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 space-y-1.5 font-mono text-[11px]">
                              <div className="flex justify-between items-center text-gray-700 font-semibold border-b border-gray-200 pb-1 mb-1">
                                <span>Loại xe: {currentProposedSpec.label}</span>
                                <span className="text-indigo-600">{pricingBreakdown.timeSlot === 'AFTERNOON' ? 'Ca chiều (12-17h)' : 'Ca ngày (8-17h)'}</span>
                              </div>
                              <div className="flex justify-between items-center text-gray-600">
                                <span>1. {pricingBreakdown.isFixedRoute ? `Tuyến cố định (${pricingBreakdown.routeName}):` : `Cước vận tải (${pricingBreakdown.dist} km):`}</span>
                                <span className="font-semibold text-gray-800">{(pricingBreakdown.baseFare || 0).toLocaleString()} đ</span>
                              </div>
                              <div className="flex justify-between items-center text-gray-600">
                                <span>2. Phí dịch vụ làm thủ tục hải quan:</span>
                                <span className="font-semibold text-gray-800">{(pricingBreakdown.customsFee || 0).toLocaleString()} đ</span>
                              </div>
                              <div className="border-t border-gray-200 pt-1.5 mt-1 flex justify-between items-center text-gray-500 text-[10px]">
                                <span>Tổng dự toán hệ thống:</span>
                                <span className="font-bold text-gray-700">{(pricingBreakdown.totalRaw || 0).toLocaleString()} đ</span>
                              </div>
                            </div>

                            <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between">
                              <span className="font-semibold text-indigo-900 text-xs">Giá gợi ý hệ thống:</span>
                              <button
                                type="button"
                                onClick={() => setCurrentAgreedPrice(estimatedBaselineRate)}
                                className="font-bold text-sm text-indigo-700 font-mono underline cursor-pointer"
                              >
                                {(estimatedBaselineRate || 0).toLocaleString()} VNĐ [Áp dụng]
                              </button>
                            </div>

                            <div className="text-[10px] text-gray-400 italic">
                              * Tính theo biểu giá vận tải chính thức của ALS (Hợp đồng FedEx Express). Khi đổi loại xe ở mục Phân tích phía trên, giá sàn sẽ tự động cập nhật theo cỡ xe đó.
                            </div>
                          </div>
                        }
                        trigger="click"
                        placement="bottomLeft"
                      >
                        <button 
                          type="button"
                          className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70 px-1.5 py-0.5 rounded transition-all"
                          title="Bấm để xem công thức tính chi tiết"
                        >
                          <span>{estimatedBaselineRate.toLocaleString()} đ</span>
                          <Calculator size={12} className="text-indigo-500" />
                        </button>
                      </Popover>
                      <span>—</span>
                      <button
                        type="button"
                        onClick={() => setCurrentAgreedPrice(estimatedBaselineRate)}
                        className="text-indigo-600 underline font-semibold hover:text-indigo-800 cursor-pointer"
                      >
                        Lấy giá gợi ý
                      </button>
                      <span>)</span>
                    </span>
                  ) : (
                    <>Giá cước &amp; phương án <b>{currentProposedSpec.label}</b> đã chốt với khách hàng và ghi nhận vào hợp đồng</>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEditPrice ? (
                <>
                  <InputNumber 
                    className="w-44 font-bold text-blue-700"
                    value={currentAgreedPrice}
                    onChange={val => setCurrentAgreedPrice(val || 0)}
                    formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={val => val.replace(/\$\s?|(,*)/g, '')}
                    placeholder="Nhập giá cước..."
                    min={0}
                  />
                  <span className="text-xs text-gray-500 font-medium">VNĐ</span>
                  <Button 
                    type="primary" 
                    size="middle" 
                    loading={savingPrice}
                    icon={isNegotiating ? <RefreshCw size={14} /> : <CheckCircle2 size={14} />}
                    className={
                      isNegotiating
                        ? 'bg-amber-600 hover:bg-amber-700 border-amber-600 font-bold text-xs shadow-xs'
                        : 'bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs shadow-xs'
                    }
                    onClick={handleConfirmPriceAndOrder}
                  >
                    {isNegotiating ? 'Chốt lại giá & Xe' : 'Chốt xe & Xác nhận giá'}
                  </Button>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                  <span className="font-bold text-sm text-blue-700 font-mono bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200">
                    {currentAgreedPrice > 0 ? `${currentAgreedPrice.toLocaleString()} VNĐ` : 'Chưa nhập'}
                  </span>
                  {(order.status === 'CANCELLED' || order.status === 'CLOSED') && (order.cancel_reason || order.cancellation_reason) ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <Tag color="red" className="font-semibold text-xs py-0.5 px-2 m-0">
                        Đơn đã hủy
                      </Tag>
                      <span className="text-[11px] text-red-600 font-medium max-w-[260px] text-right truncate" title={order.cancel_reason || order.cancellation_reason}>
                        Lý do: <span className="italic">{order.cancel_reason || order.cancellation_reason}</span>
                      </span>
                    </div>
                  ) : (
                    <Tag color="blue" className="font-medium text-xs py-0.5 px-2">Đã chốt xe &amp; giá</Tag>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ô bắt buộc nhập Lý do điều chỉnh lại giá khi đang ở trạng thái Đang thương lượng */}
          {isNegotiating && (
            <div className="pt-2.5 border-t border-indigo-50 space-y-1.5">
              <label className="text-xs font-bold text-amber-900 flex items-center gap-1">
                <span>Lý do điều chỉnh lại giá cước / phương án xe</span>
                <span className="text-red-500">* (Bắt buộc)</span>
              </label>
              <Input
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Nhập rõ lý do điều chỉnh hoặc phản hồi báo giá & phương án xe cho khách (VD: Điều chỉnh sang Xe 3.5 tấn để vừa kích thước 200cm và hỗ trợ giá ưu đãi)..."
                className="text-xs border-amber-300 focus:border-amber-500"
              />
            </div>
          )}

          {/* Hiển thị lý do điều chỉnh gần nhất nếu đã chốt lại giá và đang chờ khách phản hồi */}
          {!isNegotiating && order.web_workflow?.adjustment_reason && (
            <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-600 flex items-center justify-between flex-wrap gap-2">
              <span>
                • Lý do chốt lại giá gần nhất: <b className="text-indigo-700">{order.web_workflow.adjustment_reason}</b>
              </span>
              {order.web_workflow?.stage === 'PRICE_AGREED_BY_DISPATCHER' && (
                <Tag color="processing" className="text-[10px] m-0">Đang chờ khách xác nhận xe &amp; giá mới</Tag>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bản đồ hình ảnh tuyến đường & Số km ước tính */}
      <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-bold text-gray-800 text-xs">
            <Route size={15} className="text-[#7367f0]" />
            <span>Bản đồ lộ trình &amp; Khoảng cách vận chuyển thực tế:</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              Quãng đường: <b className="text-indigo-700 font-mono text-sm">{routeInfo.distanceKm} km</b>
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">
              Thời gian xe chạy: <b className="text-indigo-700 font-mono text-sm">{routeInfo.durationMins} phút</b>
            </span>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-gray-200 h-64 w-full">
          <RouteMapPicker
            pickupAddress={pickupAddress}
            deliveryAddress={deliveryAddress}
            pickupCoords={pickupCoords}
            deliveryCoords={deliveryCoords}
            onRouteChange={setRouteInfo}
            height={256}
          />
        </div>
      </div>

      {/* Thông tin hàng hóa & Thông số tải trọng */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div>
          <div className="text-xs text-gray-500">Khách hàng:</div>
          <div className="font-bold text-gray-800 text-sm mt-0.5">{order.customer || order.customer_name}</div>
          <div className="text-xs text-gray-500 mt-1">Mã HAWB: <span className="font-mono font-semibold text-indigo-600">{order.hawb_code || order.order_id}</span></div>
          <div className="text-xs text-gray-500 mt-1">SĐT: {order.customer_phone || 'Chưa cung cấp'} | Email: {order.customer_email || 'Chưa cung cấp'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Địa điểm giao nhận:</div>
          <div className="font-medium text-gray-700 text-xs mt-1">
            <span className="font-bold text-blue-600">Điểm lấy:</span> {pickupAddress}
          </div>
          <div className="font-medium text-gray-700 text-xs mt-1">
            <span className="font-bold text-emerald-600">Điểm giao:</span> {deliveryAddress}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
          <div className="text-[11px] text-gray-500">Số lượng / Quy cách</div>
          <div className="font-bold text-gray-800 text-sm mt-0.5">{order.package_count || 1} {order.package_unit || (order.cargo_type === 'BULK' ? 'Chuyến' : 'Kiện')}</div>
        </div>
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
          <div className="text-[11px] text-gray-500">Kích thước (DxRxC)</div>
          <div className="font-bold text-gray-800 text-xs mt-1">
            {order.cargo_type === 'BULK' || (!order.length_cm && !order.width_cm && !order.height_cm)
              ? 'Hàng rời (Không đo)'
              : `${order.length_cm || 0}x${order.width_cm || 0}x${order.height_cm || 0} cm`}
          </div>
        </div>
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
          <div className="text-[11px] text-gray-500">{order.cargo_type === 'BULK' ? 'Trọng tải hàng rời' : 'Trọng lượng thực'}</div>
          <div className="font-bold text-gray-800 text-sm mt-0.5">{order.weight || order.weight_kg || 0} kg</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
          <div className="text-[11px] text-amber-800 font-medium">Tải trọng tính cước</div>
          <div className="font-bold text-amber-600 text-base mt-0.5">{order.chargeable || order.chargeable_weight || 0} kg</div>
        </div>
      </div>

      {/* Bảng danh sách mặt hàng nếu có nhiều loại hàng */}
      {order.items && Array.isArray(order.items) && order.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
          <div className="px-3.5 py-2 bg-indigo-50/70 border-b border-indigo-150 flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Package size={14} className="text-indigo-600" /> Danh mục các loại hàng trong đơn ({order.items.length} loại)
            </span>
          </div>
          <div className="divide-y divide-gray-100 text-xs">
            {order.items.map((it, idx) => (
              <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <span className="font-bold text-gray-800">{idx + 1}. {it.cargo_name}</span>
                  <span className="ml-2 text-gray-500 font-mono">({it.cargo_type})</span>
                </div>
                <div className="flex items-center gap-4 text-gray-600">
                  <span>SL: <b>{it.package_count} {it.package_unit}</b></span>
                  <span>Kích thước: <b>{it.length_cm}x{it.width_cm}x{it.height_cm} cm</b></span>
                  <span>Trọng lượng: <b className="text-indigo-600">{it.weight} kg</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ghi chú yêu cầu của khách (chỉ hiển thị ghi chú gốc khi đặt đơn, không lặp lại ghi chú đàm phán) */}
      {order.order_notes && 
       order.order_notes.trim().length > 0 && 
       !order.order_notes.includes('Đơn hàng nhận tư vấn từ Website') && 
       !order.order_notes.includes('Cần liên hệ tư vấn lộ trình') &&
       !order.order_notes.includes('[Khách hàng phản hồi đàm phán]') && (
        <div className="p-3 bg-yellow-50/80 rounded-xl border border-yellow-200 text-xs text-yellow-900">
          <div className="font-bold flex items-center gap-1 mb-1">
            <AlertTriangle size={14} /> Ghi chú yêu cầu của khách:
          </div>
          {order.order_notes}
        </div>
      )}
    </div>
  );
}
