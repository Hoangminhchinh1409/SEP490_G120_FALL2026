import React from 'react';
import { Form, Input, Select, Button, Tooltip, InputNumber } from 'antd';
import { Package, Plus, Trash2 } from 'lucide-react';

const { Option } = Select;

export function ConsultationReceiverSection({
  watchedValues,
  totals,
  vehicleRecommendation,
  form
}) {
  return (
    <div>
      <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
        <span>👤</span> 3. Thông tin người nhận &amp; Loại xe yêu cầu
      </div>
      <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Form.Item
            label={<span className="text-xs font-semibold">Tên người nhận hàng <span className="text-red-500">*</span></span>}
            name="receiver_name"
            rules={[{ required: true, message: 'Nhập tên người nhận' }]}
            className="mb-0"
          >
            <Input placeholder="Người nhận tại điểm giao" className="text-xs" />
          </Form.Item>

          <Form.Item
            label={<span className="text-xs font-semibold">SĐT người nhận <span className="text-red-500">*</span></span>}
            name="receiver_phone"
            rules={[{ required: true, message: 'Nhập SĐT người nhận' }]}
            className="mb-0"
          >
            <Input placeholder="SĐT liên hệ khi giao" className="text-xs" />
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

        {parseFloat(totals.actualWeight) > 0 && (
          <div className={`mt-2.5 p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
            vehicleRecommendation.status === 'UNDER_CAPACITY'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-white border-emerald-200 text-emerald-900'
          }`}>
            <div>
              <span className="font-bold">💡 Gợi ý xếp xe theo hàng hóa: </span>
              <b className="text-indigo-700">{vehicleRecommendation.recommendedSpec.label}</b>{' '}
              <span className="text-gray-500">({vehicleRecommendation.recommendedSpec.boxDimText}, tải tối đa {vehicleRecommendation.recommendedSpec.maxPayloadKg.toLocaleString('vi-VN')} kg)</span>
              {vehicleRecommendation.status === 'UNDER_CAPACITY' && (
                <div className="text-[11px] text-amber-800 mt-0.5">
                  ⚠️ {vehicleRecommendation.reason}
                </div>
              )}
            </div>
            {vehicleRecommendation.recommendedVehicleKey !== (watchedValues?.vehicle_type_required || 'TRUCK_2.5T') && (
              <Button
                size="small"
                type="primary"
                ghost
                className="text-[11px] font-semibold border-indigo-500 text-indigo-700"
                onClick={() => form.setFieldsValue({ vehicle_type_required: vehicleRecommendation.recommendedVehicleKey })}
              >
                Chọn {vehicleRecommendation.recommendedSpec.shortLabel}
              </Button>
            )}
          </div>
        )}

        <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100">
          ℹ️ <b>Lưu ý:</b> Điều phối viên ALS sẽ tiếp nhận yêu cầu, phân tích phương án chọn xe tối ưu theo kích thước/tải trọng và liên hệ thống nhất cả loại xe &amp; giá cước với quý khách.
        </div>
      </div>
    </div>
  );
}

export function ConsultationCargoSection({
  cargoItems,
  totals,
  handleAddCargoItem,
  handleRemoveCargoItem,
  handleUpdateCargoItem
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
          <Package size={14} className="text-emerald-600" /> 4. Danh mục hàng hóa &amp; Quy cách ({cargoItems.length} mặt hàng)
        </div>
        <Button 
          type="dashed"
          size="small"
          icon={<Plus size={13} className="text-indigo-600" />}
          className="text-xs font-semibold text-indigo-600 border-indigo-300 hover:border-indigo-500"
          onClick={handleAddCargoItem}
        >
          Thêm hàng hóa
        </Button>
      </div>

      <div className="space-y-3 mb-4">
        {cargoItems.map((item, index) => {
          const isBulk = item.cargo_type === 'BULK';
          return (
            <div key={item.id} className="bg-gray-50/90 p-3 rounded-xl border border-gray-200 relative transition-all hover:border-indigo-200">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-800">
                    Mặt hàng #{index + 1}
                  </span>
                </div>
                {cargoItems.length > 1 && (
                  <Tooltip title="Xóa mặt hàng này">
                    <Button 
                      type="text" 
                      danger 
                      size="small" 
                      icon={<Trash2 size={13} />} 
                      onClick={() => handleRemoveCargoItem(item.id)} 
                      className="p-1 h-auto"
                    />
                  </Tooltip>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-2.5">
                <div>
                  <div className="text-[11px] font-medium text-gray-600 mb-1">Tên hàng hóa *</div>
                  <Input 
                    placeholder="VD: Linh kiện, Nông sản..." 
                    value={item.cargo_name}
                    onChange={(e) => handleUpdateCargoItem(item.id, 'cargo_name', e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <div className="text-[11px] font-medium text-gray-600 mb-1">Loại hàng *</div>
                  <Select 
                    placeholder="Chọn loại hàng..."
                    value={item.cargo_type} 
                    onChange={(val) => handleUpdateCargoItem(item.id, 'cargo_type', val)}
                    className="text-xs w-full"
                    allowClear
                  >
                    <Option value="GENERAL">Hàng bách hóa thông thường</Option>
                    <Option value="PALLET">Hàng Pallet (Đo kích thước)</Option>
                    <Option value="BULK">Hàng rời (Tính theo tải trọng)</Option>
                    <Option value="FRAGILE">Hàng điện tử dễ vỡ</Option>
                    <Option value="VALUABLE">Hàng giá trị cao (Niêm chì)</Option>
                    <Option value="OTHER">Khác</Option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <div className="text-[11px] font-medium text-gray-600 mb-1">Số lượng</div>
                    <InputNumber 
                      min={1} 
                      placeholder="Số lượng"
                      value={item.package_count} 
                      onChange={(val) => handleUpdateCargoItem(item.id, 'package_count', val)}
                      className="w-full text-xs"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-gray-600 mb-1">Đơn vị</div>
                    <Input 
                      placeholder="Kiện, Thùng..." 
                      value={item.package_unit}
                      onChange={(e) => handleUpdateCargoItem(item.id, 'package_unit', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-gray-600 mb-1">Trọng lượng (kg) *</div>
                  <InputNumber 
                    min={0.1} 
                    value={item.weight} 
                    onChange={(val) => handleUpdateCargoItem(item.id, 'weight', val)}
                    placeholder="Nhập kg..."
                    className="w-full text-xs font-semibold text-emerald-700"
                  />
                </div>
              </div>

              {!isBulk ? (
                <div className="pt-2 border-t border-gray-150 grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500">Dài (cm):</span>
                    <InputNumber 
                      min={1} 
                      placeholder="Dài..."
                      value={item.length_cm} 
                      onChange={(val) => handleUpdateCargoItem(item.id, 'length_cm', val)}
                      className="w-full text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">Rộng (cm):</span>
                    <InputNumber 
                      min={1} 
                      placeholder="Rộng..."
                      value={item.width_cm} 
                      onChange={(val) => handleUpdateCargoItem(item.id, 'width_cm', val)}
                      className="w-full text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">Cao (cm):</span>
                    <InputNumber 
                      min={1} 
                      placeholder="Cao..."
                      value={item.height_cm} 
                      onChange={(val) => handleUpdateCargoItem(item.id, 'height_cm', val)}
                      className="w-full text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 rounded text-[11px] text-emerald-800">
                  ✓ Hàng rời xếp theo trọng tải xe (Không đo kích thước DxRxC)
                </div>
              )}
            </div>
          );
        })}

        {/* Tổng kết quy cách toàn bộ lô hàng */}
        <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between text-xs text-indigo-900">
          <div>
            Tổng số lượng: <b>{totals.totalCount}</b> kiện/mặt hàng
          </div>
          <div>
            Tổng trọng lượng thực: <b>{totals.actualWeight} kg</b>
          </div>
          <div>
            Tải trọng tính cước ước tính: <b className="text-amber-700 text-sm font-bold">{totals.chargeableWeight} kg</b>
          </div>
        </div>
      </div>
    </div>
  );
}

