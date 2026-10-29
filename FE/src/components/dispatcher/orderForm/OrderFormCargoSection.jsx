import React from 'react';
import { Form, Input, InputNumber, Select, Button, Tooltip } from 'antd';
import { Package, Plus, Trash2 } from 'lucide-react';

const { Option } = Select;

export default function OrderFormCargoSection({
  cargoItems,
  updateCargoItem,
  removeCargoItem,
  addCargoItem,
  totals
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          <Package size={15} className="text-indigo-600" />
          4. Chi tiết mặt hàng vận chuyển
        </div>
        <Button 
          type="dashed" 
          size="small" 
          icon={<Plus size={13} />} 
          onClick={addCargoItem}
          className="text-indigo-600 border-indigo-300 hover:text-indigo-700 text-xs font-medium"
        >
          Thêm mặt hàng khác
        </Button>
      </div>

      <div className="space-y-3 mb-4">
        {cargoItems.map((item, idx) => {
          const isBulk = item.cargo_type === 'BULK';
          const isPallet = item.cargo_type === 'PALLET';
          const volM3 = (!isBulk && item.length_cm && item.width_cm && item.height_cm)
            ? ((item.length_cm * item.width_cm * item.height_cm) / 1000000).toFixed(2)
            : null;
          const dimWeightKg = volM3 ? (volM3 * 167).toFixed(1) : null;

          return (
            <div key={item.id} className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 relative group">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">
                    {idx + 1}
                  </span>
                  Mặt hàng #{idx + 1}
                </span>
                {cargoItems.length > 1 && (
                  <Button 
                    type="text" 
                    danger 
                    size="small" 
                    icon={<Trash2 size={13} />} 
                    onClick={() => removeCargoItem(item.id)}
                    className="h-6 px-1.5 text-xs"
                  >
                    Xóa
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">Tên hàng hóa <span className="text-red-500">*</span></label>
                  <Input 
                    placeholder="VD: Linh kiện điện tử, Trái cây..." 
                    className="text-xs" 
                    value={item.cargo_name}
                    onChange={e => updateCargoItem(item.id, 'cargo_name', e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">Loại hàng <span className="text-red-500">*</span></label>
                  <Select 
                    className="text-xs w-full" 
                    placeholder="Chọn loại hàng"
                    value={item.cargo_type}
                    onChange={val => updateCargoItem(item.id, 'cargo_type', val)}
                  >
                    <Option value="GENERAL">📦 Hàng bách hóa / Kiện rời</Option>
                    <Option value="PALLET">🪵 Hàng đóng Pallet</Option>
                    <Option value="BULK">🚛 Hàng xao / Hàng rời (nguyên xe)</Option>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">Số lượng / Quy cách</label>
                  <div className="flex gap-1">
                    <InputNumber 
                      className="w-1/2 text-xs" 
                      placeholder="SL" 
                      min={1}
                      value={item.package_count}
                      onChange={val => updateCargoItem(item.id, 'package_count', val)}
                    />
                    <Input 
                      className="w-1/2 text-xs" 
                      placeholder={isBulk ? "Xe/Chuyến" : isPallet ? "Pallet" : "Thùng/Kiện"} 
                      value={item.package_unit}
                      onChange={e => updateCargoItem(item.id, 'package_unit', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                    {isBulk ? 'Trọng tải hàng rời (kg)' : 'Trọng lượng thực (kg)'} <span className="text-red-500">*</span>
                  </label>
                  <InputNumber 
                    className="w-full text-xs font-semibold text-indigo-700" 
                    placeholder="VD: 500" 
                    min={0.1}
                    value={item.weight}
                    onChange={val => updateCargoItem(item.id, 'weight', val)}
                  />
                </div>
              </div>

              {/* Kích thước 3 chiều */}
              {!isBulk && (
                <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-500">Kích thước (Dài x Rộng x Cao) - Đơn vị: cm:</span>
                    {volM3 && (
                      <span className="text-[11px] text-indigo-600 font-medium">
                        Thể tích: <b>{volM3} m³</b> • Quy đổi thể tích (IATA): <b>{dimWeightKg} kg</b>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <InputNumber 
                      className="w-full text-xs" 
                      placeholder="Dài (cm)" 
                      min={0}
                      value={item.length_cm}
                      onChange={val => updateCargoItem(item.id, 'length_cm', val)}
                    />
                    <InputNumber 
                      className="w-full text-xs" 
                      placeholder="Rộng (cm)" 
                      min={0}
                      value={item.width_cm}
                      onChange={val => updateCargoItem(item.id, 'width_cm', val)}
                    />
                    <InputNumber 
                      className="w-full text-xs" 
                      placeholder="Cao (cm)" 
                      min={0}
                      value={item.height_cm}
                      onChange={val => updateCargoItem(item.id, 'height_cm', val)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Tổng kết */}
        <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between text-xs">
          <div><span className="text-gray-600">Tổng số lượng: </span><b className="text-gray-900">{totals.totalCount} kiện/mặt hàng</b></div>
          <div><span className="text-gray-600">Tổng trọng lượng thực: </span><b className="text-indigo-700">{totals.actualWeight} kg</b></div>
          <div><span className="text-gray-600">Tải trọng tính cước ước tính: </span><b className="text-amber-700 font-bold">{totals.chargeableWeight} kg</b></div>
        </div>
      </div>
    </>
  );
}

