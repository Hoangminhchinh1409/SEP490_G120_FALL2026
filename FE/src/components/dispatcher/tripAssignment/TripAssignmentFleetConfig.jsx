import React from 'react';
import { Tag, Select, Radio } from 'antd';
import { Truck, AlertTriangle } from 'lucide-react';
import { getVehicleSpecByKey } from '../../../data/dispatcherPresets';

const { Option } = Select;

export default function TripAssignmentFleetConfig({
  order,
  orderCode,
  hawbCode,
  customerName,
  actualWeight,
  chargeableWeight,
  cargoVolume,
  plannedStart,
  routeSummary,
  vehicleAnalysis,
  transportMode,
  setTransportMode,
  multiDropMode,
  handleChangeMultiDropMode,
  stops,
  selectedTruckPlate,
  setSelectedTruckPlate,
  selectedTruckSpec,
  INTERNAL_FLEET_OPTIONS,
  trucks,
  driverCount,
  setDriverCount,
  totalTripHours,
  selectedDriver1,
  setSelectedDriver1,
  selectedDriver2,
  setSelectedDriver2,
  drivers
}) {
  return (
    <div className="space-y-3.5">
      {/* Cấu hình điểm trả hàng */}
      <div className="p-3 bg-white border border-gray-300 rounded text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">
            Cấu hình điểm trả hàng: <span className="text-gray-500 font-normal">Mặc định 1 điểm trả chuẩn theo đơn</span>
          </span>
          <Tag color={multiDropMode === 'MULTI_POINTS' ? 'blue' : 'green'} className="m-0 text-[10px] font-semibold">
            {multiDropMode === 'MULTI_POINTS' ? `${stops.filter(s => s.type === 'DROPOFF').length} điểm trả` : '1 điểm trả duy nhất'}
          </Tag>
        </div>
        
        <Radio.Group 
          value={multiDropMode} 
          onChange={e => handleChangeMultiDropMode(e.target.value)}
          className="space-y-1.5 block"
        >
          <Radio value="STANDALONE" className="text-xs text-gray-700 block">
            <b>Chuyến thẳng 1 điểm trả (Mặc định):</b> Xe chạy tuyến ngắn nhất trả toàn bộ hàng tại 1 điểm giao duy nhất của đơn
          </Radio>
          <Radio value="MULTI_POINTS" className="text-xs text-gray-700 block">
            <b>Ghép chuyến nhiều điểm trả theo yêu cầu:</b> Khi khách yêu cầu chia hàng trả tại nhiều kho/điểm nhận khác nhau (bổ sung vào thứ tự điểm dừng bên dưới)
          </Radio>
        </Radio.Group>
      </div>

      {/* Chọn Xe và Số tài xế */}
      <div className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-8 space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">
              Xe (tỉnh, độ dài, đăng kiểm còn hạn) *
            </label>
            <span className="text-[11px] text-indigo-600 font-medium">
              Thùng: {selectedTruckSpec.boxText} · Tối đa {selectedTruckSpec.maxPayloadKg.toLocaleString()} kg
            </span>
          </div>
          <Select
            className="w-full text-xs"
            value={selectedTruckPlate}
            onChange={setSelectedTruckPlate}
          >
            {INTERNAL_FLEET_OPTIONS.map(opt => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
            {trucks
              .filter(t => !INTERNAL_FLEET_OPTIONS.some(o => o.plate === t.plate))
              .map(t => (
                <Option key={t.plate} value={`${t.plate} - ${t.payload_kg} kg - ${t.status}`}>
                  {t.plate} · {t.payload_kg} kg · {t.status}
                </Option>
              ))}
          </Select>
        </div>

        <div className="col-span-4 space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">
            Số tài xế *
          </label>
          <div className="inline-flex rounded border border-gray-300 overflow-hidden w-full">
            <button
              type="button"
              onClick={() => setDriverCount(1)}
              className={`flex-1 py-1 text-xs font-semibold transition ${
                driverCount === 1 
                  ? 'bg-blue-100 text-blue-900 border-r border-blue-200' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-300'
              }`}
            >
              1 tài xế
            </button>
            <button
              type="button"
              onClick={() => setDriverCount(2)}
              className={`flex-1 py-1 text-xs font-semibold transition ${
                driverCount === 2 
                  ? 'bg-blue-100 text-blue-900' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              2 tài xế
            </button>
          </div>
        </div>
      </div>

      {/* Cảnh báo quá tải hoặc ca chạy dài */}
      {chargeableWeight > selectedTruckSpec.maxPayloadKg && (
        <div className="p-2.5 bg-red-50 border border-red-300 rounded text-[11px] text-red-900 flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-red-600 shrink-0" />
          <span>
            Cảnh báo quá tải (BR-25 / MSG66): Khối lượng hàng (<b>{chargeableWeight.toLocaleString()} kg</b>) vượt tải trọng xe đang chọn (<b>{selectedTruckSpec.maxPayloadKg.toLocaleString()} kg</b>). Đề xuất chọn <b>{vehicleAnalysis?.recommendedVehicle?.label}</b>!
          </span>
        </div>
      )}

      {totalTripHours > 8 && (
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          <span>
            Chỉ còn đủ thời gian chuyển &gt; 8 giờ: <b>Thời gian chạy dự kiến {totalTripHours.toFixed(1)} giờ – đề xuất 2 tài xế (MSG62)</b>
          </span>
        </div>
      )}

      {/* Chọn Tài xế 1 & Tài xế 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">
            Tài xế 1 *
          </label>
          <Select
            className="w-full text-xs"
            value={selectedDriver1}
            onChange={setSelectedDriver1}
            placeholder="Chọn tài xế 1"
          >
            {drivers.map(d => (
              <Option 
                key={d.id} 
                value={d.name}
                disabled={d.status === 'Chờ khám' || d.hours_driven >= 9}
              >
                {d.name} · {d.status} · Đã lái {d.hours_driven}h {d.hours_driven >= 9 ? '(Vượt trần MSG64)' : ''}
              </Option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700 block">
            Tài xế 2 {driverCount === 2 ? '*' : '(chỉ khi chọn 2 tài xế)'}
          </label>
          <Select
            className="w-full text-xs"
            value={selectedDriver2}
            onChange={setSelectedDriver2}
            placeholder={driverCount === 2 ? "Chọn tài xế 2" : "Không áp dụng"}
            disabled={driverCount === 1}
          >
            {drivers.map(d => (
              <Option 
                key={d.id} 
                value={d.name}
                disabled={d.name === selectedDriver1 || d.status === 'Chờ khám' || d.hours_driven >= 9}
              >
                {d.name} · {d.status} · Đã lái {d.hours_driven}h
              </Option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

