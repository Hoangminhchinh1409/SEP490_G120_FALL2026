import React from 'react';
import { Form, Input, Select, Button } from 'antd';
import { Truck } from 'lucide-react';

const { Option } = Select;

export default function OrderFormVehicleSection({
  shippingDirection,
  estimatedPricing,
  routeInfo,
  totals,
  vehicleRecommendation,
  form,
  watchedValues
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Truck size={14} className="text-emerald-600" />
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          3. Thông tin người nhận &amp; Loại xe
        </div>
      </div>
      <div className="bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Form.Item 
            label={
              <span className="text-xs font-semibold">
                {shippingDirection === 'IMPORT' ? 'Tên người nhận hàng' : 'Tên người liên hệ'} <span className="text-red-500">*</span>
              </span>
            }
            name="receiver_name" 
            rules={[{ required: true, message: shippingDirection === 'IMPORT' ? 'Nhập tên người nhận hàng' : 'Nhập tên người liên hệ' }]} 
            className="mb-0"
          >
            <Input 
              placeholder={shippingDirection === 'IMPORT' ? 'Người nhận tại điểm giao' : 'Người liên hệ tại điểm gửi hàng'} 
              className="text-xs" 
            />
          </Form.Item>

          <Form.Item 
            label={
              <span className="text-xs font-semibold">
                {shippingDirection === 'IMPORT' ? 'SĐT người nhận hàng' : 'SĐT người liên hệ'} <span className="text-red-500">*</span>
              </span>
            }
            name="receiver_phone" 
            rules={[{ required: true, message: shippingDirection === 'IMPORT' ? 'Nhập SĐT người nhận hàng' : 'Nhập SĐT người liên hệ' }]} 
            className="mb-0"
          >
            <Input 
              placeholder={shippingDirection === 'IMPORT' ? 'SĐT liên hệ khi giao nhận' : 'SĐT người liên hệ gửi hàng'} 
              className="text-xs" 
            />
          </Form.Item>

          <Form.Item 
            label={<span className="text-xs font-semibold">Loại xe yêu cầu</span>}
            name="vehicle_type_required" 
            className="mb-0"
          >
            <Select className="text-xs w-full" placeholder="Chọn loại xe">
              <Option value="TRUCK_1.25T">🚐 Xe tải 1.25 tấn</Option>
              <Option value="TRUCK_2.5T">🚛 Xe tải 2.5 tấn</Option>
              <Option value="TRUCK_3.5T">🚛 Xe tải 3.5 tấn</Option>
              <Option value="TRUCK_5T">🚛 Xe tải 5 tấn</Option>
              <Option value="CONTAINER_20">📦 Container 20ft</Option>
              <Option value="CONTAINER_40">📦 Container 40ft</Option>
            </Select>
          </Form.Item>
        </div>

        {/* Khối cảnh báo vượt tải trọng hoặc gợi ý loại xe phù hợp */}
        {totals && parseFloat(totals.actualWeight) > 0 && vehicleRecommendation && (
          <div className={`mt-2.5 p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
            vehicleRecommendation.status === 'UNDER_CAPACITY'
              ? 'bg-red-50 border-red-300 text-red-950 shadow-xs'
              : 'bg-white border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-1.5 font-bold">
                {vehicleRecommendation.status === 'UNDER_CAPACITY' ? (
                  <span className="text-red-600 flex items-center gap-1">❌ CẢNH BÁO VƯỢT TẢI TRỌNG XE:</span>
                ) : (
                  <span>💡 Gợi ý xếp xe theo hàng hóa:</span>
                )}
                <b className="text-indigo-700">{vehicleRecommendation.recommendedSpec.label}</b>
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5">
                Quy cách thùng: {vehicleRecommendation.recommendedSpec.boxDimText} • Tải tối đa: <b>{vehicleRecommendation.recommendedSpec.maxPayloadKg.toLocaleString('vi-VN')} kg</b>
              </div>
              {vehicleRecommendation.status === 'UNDER_CAPACITY' && (
                <div className="text-[11px] text-red-700 font-semibold mt-1 bg-red-100/60 p-1.5 rounded">
                  ⚠️ {vehicleRecommendation.reason}
                </div>
              )}
            </div>
            {form && vehicleRecommendation.recommendedVehicleKey !== (watchedValues?.vehicle_type_required || 'TRUCK_2.5T') && (
              <Button
                size="small"
                type="primary"
                danger={vehicleRecommendation.status === 'UNDER_CAPACITY'}
                className="text-xs font-semibold h-8"
                onClick={() => form.setFieldsValue({ vehicle_type_required: vehicleRecommendation.recommendedVehicleKey })}
              >
                Đổi sang {vehicleRecommendation.recommendedSpec.shortLabel}
              </Button>
            )}
          </div>
        )}

        {/* Bảng chi tiết tính giá cước theo Biểu giá chuẩn ALS */}
        {estimatedPricing.totalRate > 0 && (
          <div className="mt-3 p-2.5 bg-white/90 rounded-lg border border-emerald-200 text-xs">
            <div className="flex flex-wrap items-center justify-between font-semibold text-emerald-900 border-b border-emerald-100 pb-1.5 mb-1.5">
              <span className="flex items-center gap-1">
                🏷️ {estimatedPricing.isFixedRoute ? `Tuyến cố định ALS: ${estimatedPricing.routeName}` : `Cước vận chuyển ước tính (${routeInfo.distanceKm} km)`}
              </span>
              <span className="text-sm font-bold text-emerald-700">
                Tổng tham chiếu: {estimatedPricing.totalRate.toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div>• Cước vận tải xe: <b className="text-gray-800">{estimatedPricing.baseTransportFee.toLocaleString('vi-VN')} đ</b></div>
              <div>• Phí hải quan: <b className="text-gray-800">{estimatedPricing.customsFee > 0 ? `${estimatedPricing.customsFee.toLocaleString('vi-VN')} đ` : '0 đ'}</b></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

