import React, { useState } from 'react';
import { Tag, Button, InputNumber, Input, Popover, Select, message } from 'antd';
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
  CheckCircle2
} from 'lucide-react';
import RouteMapPicker from '../../common/RouteMapPicker';
import { getVehicleSpecByKey, VEHICLE_SPECS } from '../../../data/dispatcherPresets';
import { aiApi } from '../../../api/aiApi';
import { OrderVehicleRecommendationBox, OrderOverviewPreDocsBox } from './OrderOverviewSubSections';

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
  handleConfirmPriceAndOrder,
  documents = [],
  setDocuments,
  onOpenAssistant,
  onOpen3DModal,
  onOpenSplitModal
}) {
  const cleanPhone = (order.customer_phone || '').replace(/[^0-9]/g, '');
  const isClosed = order.status === 'CANCELLED' || order.status === 'CLOSED';
  const isLocked = isClosed || ['READY_FOR_PLANNING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'HANDED_OVER_VENDOR', 'DELIVERED', 'DELIVERED_EXCEPTION'].includes(order.status);
  const canEditPrice = order.status === 'DRAFT' && !isClosed && !isLocked;

  const currentProposedSpec = getVehicleSpecByKey(proposedVehicleType || order.vehicle_type_required || 'TRUCK_2.5T') || VEHICLE_SPECS[1];
  const customerInitialSpec = vehicleRecommendation?.customerSpec || getVehicleSpecByKey(order.customer_requested_vehicle || order.vehicle_type_required || 'TRUCK_2.5T') || VEHICLE_SPECS[1];
  const recommendedSpec = vehicleRecommendation?.recommendedSpec || currentProposedSpec;

  const [aiAnalyzingVehicle, setAiAnalyzingVehicle] = useState(false);
  const [aiVehicleInsight, setAiVehicleInsight] = useState(null);

  // State thêm chứng từ tùy biến ngay tại Overview Tab
  const [overviewSelectedSpecDoc, setOverviewSelectedSpecDoc] = useState('');
  const [overviewCustomDocName, setOverviewCustomDocName] = useState('');

  const handleAddOverviewCustomDoc = () => {
    const title = (overviewCustomDocName || overviewSelectedSpecDoc || '').trim();
    if (!title) {
      message.warning('Vui lòng chọn hoặc nhập tên loại chứng từ cần bổ sung!');
      return;
    }

    if (documents.some(d => d.name.toLowerCase() === title.toLowerCase())) {
      message.warning('Chứng từ này đã có trong danh mục!');
      return;
    }

    const newKey = `overview-doc-${Date.now()}`;
    const newDoc = {
      key: newKey,
      name: title,
      description: 'Chứng từ chuyên ngành do Điều phối viên yêu cầu bổ sung.',
      file: 'Chờ tải lên',
      status: 'WAITING_UPLOAD',
      size: '-',
      uploadDate: '-',
      isBasic: false,
      isCustom: true,
      categoryName: 'Chứng từ bổ sung'
    };

    setDocuments?.(prev => [...prev, newDoc]);
    setOverviewCustomDocName('');
    setOverviewSelectedSpecDoc('');
    message.success(`Đã thêm chứng từ: "${newDoc.name}"`);
  };

  const handleDeleteOverviewDoc = (docKey) => {
    setDocuments?.(prev => prev.filter(d => d.key !== docKey));
    message.info('Đã xóa loại chứng từ khỏi danh mục.');
  };

  const handleGeminiAnalyzeVehicle = async () => {
    try {
      setAiAnalyzingVehicle(true);
      const res = await aiApi.analyzeVehicleAndQuote({
        order,
        customerRequestedVehicle: customerInitialSpec.label,
        systemRecommendedVehicle: recommendedSpec.label,
        distanceKm: routeInfo?.distanceKm || 35,
        estimatedPriceVnd: estimatedBaselineRate
      });

      if (res?.recommendedVehicleKey) {
        const matchedSpec = getVehicleSpecByKey(res.recommendedVehicleKey);
        if (matchedSpec && canEditPrice) {
          setProposedVehicleType?.(matchedSpec.key);
        }
      }
      if (res?.customerAdvisoryNote && canEditPrice) {
        setVehicleAnalysisNote?.(res.customerAdvisoryNote);
      }
      setAiVehicleInsight(res);
      message.success(`Google Gemini AI (${res.model || 'Gemini Pro'}) đã phân tích phương án xe & soạn lời tư vấn!`);
    } catch (err) {
      message.error('Không thể kết nối Gemini AI lúc này');
    } finally {
      setAiAnalyzingVehicle(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner hướng dẫn luồng xử lý đối với đơn DRAFT */}
      {order.status === 'DRAFT' && (
        <div className="space-y-2">
          {/* Thông báo nếu khách yêu cầu chia xe ngay từ lúc tạo đơn */}
          {(order.request_split_trucks || order.web_workflow?.request_split_trucks || order.split_details || order.web_workflow?.split_details) && (
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-300 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="space-y-1">
                <span className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-indigo-600">call_split</span>
                  Khách hàng đã tích chọn &quot;Yêu cầu chia đi nhiều xe tải nhỏ&quot; khi tạo đơn:
                </span>
                <div className="text-indigo-900 text-xs">
                  • Mong muốn chia thành: <b>{(order.split_details || order.web_workflow?.split_details)?.split_count || 2} xe {(order.split_details || order.web_workflow?.split_details)?.vehicle_target_label || '2.5 tấn'}</b>
                </div>
                <div className="text-gray-600 text-[11px]">
                  • Lý do: <i>&ldquo;{(order.split_details || order.web_workflow?.split_details)?.reason || 'Đường kho hẹp / cấm xe to'}&rdquo;</i>
                </div>
              </div>
              {onOpenSplitModal && (
                <Button
                  type="primary"
                  onClick={onOpenSplitModal}
                  className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
                >
                  Mở chia tách xe ngay
                </Button>
              )}
            </div>
          )}

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
        </div>
      )}

      {/* 2. GỢI Ý XẾP XE BAN ĐẦU & PHÂN TÍCH CHỌN XE ĐÚNG */}
      <OrderVehicleRecommendationBox
        proposedVehicleType={proposedVehicleType}
        setProposedVehicleType={setProposedVehicleType}
        vehicleRecommendation={vehicleRecommendation}
        currentProposedSpec={currentProposedSpec}
        customerInitialSpec={customerInitialSpec}
        estimatedBaselineRate={estimatedBaselineRate}
        canEditPrice={canEditPrice}
        aiAnalyzingVehicle={aiAnalyzingVehicle}
        handleGeminiAnalyzeVehicle={handleGeminiAnalyzeVehicle}
        aiVehicleInsight={aiVehicleInsight}
        vehicleAnalysisNote={vehicleAnalysisNote}
        setVehicleAnalysisNote={setVehicleAnalysisNote}
        onOpen3DModal={onOpen3DModal}
        onOpenSplitModal={onOpenSplitModal}
        isClosed={isClosed}
        isLocked={isLocked}
      />

      {/* 3. Box Liên hệ khách hàng & Chốt giá cước thỏa thuận */}
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
                  <span>Giá cước thỏa thuận (kèm phương án xe):</span>
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
                              * Tính theo biểu giá vận tải chính thức của ALS (Hợp đồng FedEx Express).
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
                    icon={<CheckCircle2 size={14} />}
                    className="bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs shadow-xs"
                    onClick={handleConfirmPriceAndOrder}
                  >
                    Chốt xe &amp; Xác nhận giá
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

        {/* Danh mục chứng từ chuẩn bị trước khi gửi báo giá */}
        {order.status === 'DRAFT' && (
          <OrderOverviewPreDocsBox
            documents={documents}
            onOpenAssistant={onOpenAssistant}
            handleDeleteOverviewDoc={handleDeleteOverviewDoc}
            overviewSelectedSpecDoc={overviewSelectedSpecDoc}
            setOverviewSelectedSpecDoc={setOverviewSelectedSpecDoc}
            overviewCustomDocName={overviewCustomDocName}
            setOverviewCustomDocName={setOverviewCustomDocName}
            handleAddOverviewCustomDoc={handleAddOverviewCustomDoc}
          />
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
              Quãng đường: <b className="text-indigo-600 font-mono">{routeInfo.distanceKm} km</b>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              Thời gian xe chạy: <b className="text-indigo-600 font-mono">{routeInfo.durationMins} phút</b>
            </span>
          </div>
        </div>

        <RouteMapPicker
          pickupCoords={pickupCoords}
          deliveryCoords={deliveryCoords}
          pickupAddress={pickupAddress}
          deliveryAddress={deliveryAddress}
          height={280}
          onRouteChange={(calculated) => {
            if (calculated && (calculated.distanceKm !== routeInfo.distanceKm || calculated.durationMins !== routeInfo.durationMins)) {
              setRouteInfo(calculated);
            }
          }}
        />
      </div>

      {/* Thông tin Khách hàng & Địa điểm giao nhận */}
      <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-gray-400 block mb-1 font-medium">Khách hàng:</span>
          <span className="font-bold text-gray-800 text-sm block">{order.customer || order.customer_name}</span>
          <span className="text-gray-500 block mt-0.5">SĐT: {order.customer_phone || 'Chưa có'} | Email: {order.customer_email || 'Chưa có'}</span>
        </div>
        <div>
          <span className="text-gray-400 block mb-1 font-medium">Địa điểm giao nhận:</span>
          <div className="space-y-1">
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-blue-600 shrink-0">Điểm lấy:</span>
              <span className="text-gray-700">{pickupAddress}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-emerald-600 shrink-0">Điểm giao:</span>
              <span className="text-gray-700">{deliveryAddress}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Chỉ số hàng hóa */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
          <span className="text-[11px] text-gray-500 block mb-1 font-medium">Số lượng / Quy cách</span>
          <span className="font-bold text-gray-800 text-sm block">
            {order.package_count || 1} {order.package_type || 'Kiện'}
          </span>
        </div>

        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
          <span className="text-[11px] text-gray-500 block mb-1 font-medium">Kích thước (DxRxC)</span>
          <span className="font-bold text-gray-800 text-sm block">
            {order.length_cm || 0}x{order.width_cm || 0}x{order.height_cm || 0} cm
          </span>
        </div>

        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
          <span className="text-[11px] text-gray-500 block mb-1 font-medium">Trọng lượng thực</span>
          <span className="font-bold text-gray-800 text-sm block font-mono">
            {order.weight || order.weight_kg || 0} kg
          </span>
        </div>

        <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-center">
          <span className="text-[11px] text-amber-800 block mb-1 font-medium">Tải trọng tính cước</span>
          <span className="font-bold text-amber-600 text-sm block font-mono">
            {order.chargeable || order.chargeable_weight || order.weight || 0} kg
          </span>
        </div>
      </div>

      {/* Danh mục các loại hàng trong đơn */}
      {order.items && order.items.length > 0 && (
        <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200">
          <span className="text-xs font-bold text-gray-700 mb-2.5 flex items-center gap-1.5">
            <Package size={14} className="text-[#7367f0]" />
            Danh mục các loại hàng trong đơn ({order.items.length} loại)
          </span>
          <div className="space-y-2">
            {order.items.map((item, idx) => {
              const count = Number(item.package_count || item.quantity) || 1;
              const unitW = Number(item.weight) || 0;
              const totalW = unitW * count;
              const unit = item.package_unit || item.package_type || 'Kiện';
              const l = item.length_cm || item.length || 0;
              const w = item.width_cm || item.width || 0;
              const h = item.height_cm || item.height || 0;

              return (
                <div key={idx} className="p-2.5 bg-white rounded-lg border border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
                  <div>
                    <span className="font-bold text-gray-800">{idx + 1}. {item.name || item.cargo_name}</span>
                    <span className="text-[10px] text-gray-400 ml-1.5">({item.category || item.cargo_type || 'GENERAL'})</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600 font-mono text-[11px]">
                    <span>SL: <b>{count} {unit}</b></span>
                    <span>Kích thước: <b>{l}x{w}x{h} cm</b></span>
                    <span>
                      Trọng lượng: <b className="text-indigo-600">{totalW.toLocaleString('vi-VN')} kg</b>
                      {count > 1 && <span className="text-gray-400 font-normal"> ({unitW} kg/{unit})</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ghi chú yêu cầu của khách */}
      {order.order_notes && (
        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <div className="font-bold text-amber-900 flex items-center gap-1 mb-1">
            <AlertTriangle size={14} /> Ghi chú yêu cầu của khách:
          </div>
          <div>{order.order_notes}</div>
        </div>
      )}
    </div>
  );
}
