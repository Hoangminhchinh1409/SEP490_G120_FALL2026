import React from 'react';
import { Form, Input, Select } from 'antd';
import { Truck } from 'lucide-react';

const { Option } = Select;

export default function OrderFormVehicleSection({
  shippingDirection,
  estimatedPricing,
  routeInfo
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

