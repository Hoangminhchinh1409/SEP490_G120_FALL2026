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
  vendorTrackingCode,
  setVendorTrackingCode,
  vendors
}) {
  return (
    <div className="p-4 bg-gray-50 border border-gray-300 rounded space-y-3">
      <div className="font-semibold text-xs text-gray-700">
        Khi chọn &quot;Nhà xe đối tác&quot; <span className="text-gray-400 font-normal">(Bàn giao đơn hàng sang nhà xe 3PL đã duyệt)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div className="sm:col-span-4 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">Nhà xe đối tác *</label>
          <Select
            className="w-full text-xs"
            value={selectedVendor}
            onChange={setSelectedVendor}
          >
            <Option value="Công ty TNHH Vận tải & Tiếp vận Hà Nội (Hanoitrans)">Công ty TNHH Vận tải & Tiếp vận Hà Nội (Hanoitrans)</Option>
            <Option value="Công ty Cổ phần Giao nhận Á Châu (Asia Logistics)">Công ty Cổ phần Giao nhận Á Châu (Asia Logistics)</Option>
            <Option value="Vận tải Hải Long">Vận tải Hải Long</Option>
            {(vendors || [])
              .filter(v => v.name && !v.name.includes('Hanoitrans') && !v.name.includes('Asia Logistics'))
              .map(v => (
                <Option key={v.id} value={v.name}>{v.name}</Option>
              ))}
          </Select>
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">Mã vận đơn đối tác 3PL *</label>
          <Input
            className="text-xs font-mono"
            value={vendorTrackingCode}
            onChange={e => setVendorTrackingCode?.(e.target.value)}
            placeholder="VD: 3PL-HN-882910"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">Số xe thuê ngoài</label>
          <Input
            className="text-xs"
            type="number"
            value={vendorVehicleCount}
            onChange={e => setVendorVehicleCount(parseInt(e.target.value, 10) || 1)}
            min={1}
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">Chi phí dự kiến (VNĐ)</label>
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
