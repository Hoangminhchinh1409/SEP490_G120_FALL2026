import React from 'react';
import { Tag, Button, InputNumber, Popover } from 'antd';
import { 
  AlertTriangle, 
  PhoneCall, 
  MessageCircle, 
  Mail, 
  DollarSign, 
  Calculator, 
  Route, 
  Package 
} from 'lucide-react';
import RouteMapPicker from '../../common/RouteMapPicker';

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
  savingPrice,
  handleConfirmPriceAndOrder
}) {
  const cleanPhone = (order.customer_phone || '').replace(/[^0-9]/g, '');

  return (
    <div className="space-y-4">
      {/* Banner hướng dẫn luồng xử lý đối với đơn DRAFT */}
      {order.status === 'DRAFT' && (
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-indigo-50 rounded-xl border border-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-xs mb-1">
            <AlertTriangle size={15} className="text-amber-600" />
            <span>Quy trình xử lý đơn hàng nháp (Chưa chốt cước):</span>
          </div>
          <div className="text-xs text-gray-700 space-y-0.5">
            <p>1. Quan sát <b>hình ảnh bản đồ tuyến đường, số km và cước tham chiếu</b> bên dưới để chuẩn bị phương án báo giá.</p>
            <p>2. <b>Gọi điện / nhắn Zalo</b> cho khách hàng để tư vấn lộ trình và thống nhất giá cước thỏa thuận.</p>
            <p>3. Nhập giá đã chốt và bấm <b>&quot;Chốt giá &amp; Xác nhận đơn&quot;</b> để chuyển sang bước kiểm duyệt chứng từ và ký hợp đồng.</p>
          </div>
        </div>
      )}

      {/* Box Liên hệ khách hàng & Chốt giá cước thỏa thuận */}
      <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <PhoneCall size={14} className="text-indigo-600" /> Liên hệ khách hàng &amp; Chốt cước:
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
        <div className="p-3 bg-white rounded-lg border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
              <DollarSign size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-800">Giá cước thỏa thuận:</div>
              <div className="text-[11px] text-gray-400">
                {order.status === 'DRAFT' ? (
                  <span className="flex items-center gap-1 flex-wrap">
                    <span>Cước phí chốt với khách sau khi tư vấn (Giá gợi ý hệ thống:</span>
                    <Popover
                      title={
                        <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 py-0.5 border-b border-indigo-50">
                          <Calculator size={14} /> Chi tiết công thức tính giá gợi ý hệ thống
                        </div>
                      }
                      content={
                        <div className="text-xs space-y-2.5 p-1 w-72">
                          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 space-y-1.5 font-mono text-[11px]">
                            <div className="flex justify-between items-center text-gray-600">
                              <span>1. Cước xuất bến / mở chuyến:</span>
                              <span className="font-semibold text-gray-800">{pricingBreakdown.baseFare.toLocaleString()} đ</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-600">
                              <span>2. Cước cự ly ({pricingBreakdown.dist} km × 45.000đ):</span>
                              <span className="font-semibold text-gray-800">{pricingBreakdown.distanceFee.toLocaleString()} đ</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-600">
                              <span>3. Cước tải trọng ({pricingBreakdown.weight} kg × 850đ):</span>
                              <span className="font-semibold text-gray-800">{pricingBreakdown.weightFee.toLocaleString()} đ</span>
                            </div>
                            <div className="border-t border-gray-200 pt-1.5 mt-1 flex justify-between items-center text-gray-500 text-[10px]">
                              <span>Tổng thô chưa làm tròn:</span>
                              <span>{pricingBreakdown.totalRaw.toLocaleString()} đ</span>
                            </div>
                          </div>

                          <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between">
                            <span className="font-semibold text-indigo-900 text-xs">Giá gợi ý (làm tròn 50k):</span>
                            <span className="font-bold text-sm text-indigo-700 font-mono">
                              {estimatedBaselineRate.toLocaleString()} VNĐ
                            </span>
                          </div>

                          <div className="text-[10px] text-gray-400 italic">
                            * Điều phối viên có thể dựa vào mức giá sàn này để thương lượng và chốt giá cuối cùng phù hợp với khách hàng.
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
                    <span>)</span>
                  </span>
                ) : (
                  <>Giá cước cố định đã chốt với khách hàng và ghi nhận vào hợp đồng</>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.status === 'DRAFT' ? (
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
                  className="bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs shadow-xs"
                  onClick={handleConfirmPriceAndOrder}
                >
                  Chốt giá &amp; Xác nhận đơn
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
                  <Tag color="blue" className="font-medium text-xs py-0.5 px-2">Đã chốt giá</Tag>
                )}
              </div>
            )}
          </div>
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

      {/* Ghi chú yêu cầu của khách */}
      {order.order_notes && 
       order.order_notes.trim().length > 0 && 
       !order.order_notes.includes('Đơn hàng nhận tư vấn từ Website') && 
       !order.order_notes.includes('Cần liên hệ tư vấn lộ trình') && (
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
