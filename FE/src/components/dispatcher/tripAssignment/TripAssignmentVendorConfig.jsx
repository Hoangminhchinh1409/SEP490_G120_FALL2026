import React from 'react';
import { Select, Input } from 'antd';

const { Option } = Select;

export default function TripAssignmentVendorConfig({
  selectedVendor,
  setSelectedVendor,
  vendorVehicleCount,
  setVendorVehicleCount,
  vendorCost,
  setVendorCost,
  vendors
}) {
  return (
    <div className="p-4 bg-gray-50 border border-gray-300 rounded space-y-3">
      <div className="font-semibold text-xs text-gray-700">
        Khi chọn &quot;Nhà xe đối tác&quot; <span className="text-gray-400 font-normal">(xe nội bộ, tài xế, điểm dừng chỉ cho đơn Sẵn sàng điều xe)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div className="sm:col-span-5 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">Nhà xe đối tác *</label>
          <Select
            className="w-full text-xs"
            value={selectedVendor}
            onChange={setSelectedVendor}
          >
            <Option value="Vận tải Hải Long">Vận tải Hải Long</Option>
            <Option value="Vận tải Á Châu">Vận tải Á Châu</Option>
            <Option value="Logistics Hưng Phát">Logistics Hưng Phát</Option>
            {vendors.map(v => (
              <Option key={v.id} value={v.name}>{v.name}</Option>
            ))}
          </Select>
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">Số xe thuê ngoài</label>
          <Input 
            className="text-xs" 
            type="number" 
            value={vendorVehicleCount} 
            onChange={e => setVendorVehicleCount(parseInt(e.target.value, 10) || 1)} 
            min={1} 
          />
        </div>

        <div className="sm:col-span-4 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">Chi phí thuê ngoài dự kiến (VNĐ)</label>
          <Input 
            className="text-xs font-mono" 
            value={vendorCost} 
            onChange={e => setVendorCost(e.target.value)} 
            placeholder="VD: 3.500.000" 
          />
        </div>
      </div>
    </div>
  );
}

