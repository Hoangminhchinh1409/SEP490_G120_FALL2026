import React from 'react';
import { Form, Select, Input } from 'antd';
import { MapPin, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import LocationSearchInput from '../../common/LocationSearchInput';

const { Option } = Select;

export function ConsultationRouteSection({
  shippingDirection,
  handleDirectionChange,
  selectedPickupPreset,
  handleSelectPickupPreset,
  dbLocations,
  pickupMode,
  form,
  setPickupCoords,
  selectedDeliveryPreset,
  handleSelectDeliveryPreset,
  deliveryMode,
  setDeliveryCoords
}) {
  return (
    <div>
      <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
        <MapPin size={14} className="text-blue-600" /> 2. Luồng vận chuyển &amp; Địa điểm giao nhận
      </div>

      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 mb-4">
        {/* Chọn chiều Nhập khẩu / Xuất khẩu */}
        <div className="mb-3 p-2 bg-white rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-semibold text-gray-700">
            Chiều vận chuyển:
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDirectionChange('IMPORT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                shippingDirection === 'IMPORT' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>🛬</span>
              <span>Nhập khẩu</span>
            </button>
            <button
              type="button"
              onClick={() => handleDirectionChange('EXPORT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                shippingDirection === 'EXPORT' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>🛫</span>
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Điểm lấy hàng */}
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
            <div className="text-[11px] font-bold text-blue-900 uppercase flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">A</span>
                Điểm lấy hàng {shippingDirection === 'IMPORT' ? '(Kho/Cảng nhập khẩu)' : ''}
              </span>
              {shippingDirection === 'IMPORT' && (
                <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">Hệ thống kho</span>
              )}
            </div>

            {shippingDirection === 'IMPORT' ? (
              <div className="space-y-2">
                <Select
                  className="w-full text-xs"
                  value={selectedPickupPreset}
                  onChange={handleSelectPickupPreset}
                  placeholder="Chọn kho lấy hàng..."
                >
                  <Select.OptGroup label="Kho bãi có sẵn trong hệ thống">
                    <Option value="ALS_NOI_BAI">🏢 Kho ALS tại Sân Bay Nội Bài (Mặc định)</Option>
                    {dbLocations.filter(loc => !loc.name?.toLowerCase().includes('sân bay nội bài')).map(loc => (
                      <Option key={loc.raw_id || loc.id} value={loc.raw_id || loc.id}>
                        📍 {loc.name} {loc.province ? `(${loc.province})` : ''}
                      </Option>
                    ))}
                  </Select.OptGroup>
                  <Select.OptGroup label="Kho khác bên ngoài">
                    <Option value="CUSTOM">➕ Khác (Nhập địa chỉ kho của khách bên ngoài)</Option>
                  </Select.OptGroup>
                </Select>

                {pickupMode === 'CUSTOM' ? (
                  <Form.Item name="pickup_address" rules={[{ required: true, message: 'Nhập địa chỉ kho bên ngoài' }]} className="mb-0">
                    <LocationSearchInput
                      label="Địa chỉ kho bên ngoài của bạn"
                      markerLetter="A"
                      markerColor="#2563eb"
                      placeholder="Gõ tìm địa chỉ kho ngoài..."
                      value={form.getFieldValue('pickup_address')}
                      onChange={(val) => form.setFieldsValue({ pickup_address: val })}
                      onSelectLocation={(loc) => {
                        setPickupCoords({ lat: loc.lat, lng: loc.lng });
                        form.setFieldsValue({ pickup_address: loc.address });
                      }}
                      required
                    />
                  </Form.Item>
                ) : (
                  <div className="text-xs text-blue-950 font-medium bg-white p-2 rounded border border-blue-100">
                    {form.getFieldValue('pickup_address') || 'Kho ALS tại Sân Bay Nội Bài'}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Form.Item name="pickup_address" rules={[{ required: true, message: 'Vui lòng nhập địa điểm lấy hàng' }]} className="mb-0">
                  <LocationSearchInput
                    label="Địa chỉ lấy hàng của khách"
                    markerLetter="A"
                    markerColor="#2563eb"
                    placeholder="Gõ tìm địa chỉ lấy hàng..."
                    value={form.getFieldValue('pickup_address')}
                    onChange={(val) => form.setFieldsValue({ pickup_address: val })}
                    onSelectLocation={(loc) => {
                      setPickupCoords({ lat: loc.lat, lng: loc.lng });
                      form.setFieldsValue({ pickup_address: loc.address });
                    }}
                    required
                  />
                </Form.Item>
              </div>
            )}

            {/* Lịch trình hàng hóa */}
            <div className="mt-2.5 pt-2 border-t border-blue-100">
              {shippingDirection === 'IMPORT' ? (
                <div>
                  <div className="text-[11px] font-semibold text-blue-900 mb-1.5 flex items-center gap-1">
                    <PlaneLanding size={13} className="text-blue-600" />
                    <span>Thời gian hàng xuống khỏi máy bay (Flight Arrival Time) <span className="text-red-500">*</span></span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Form.Item
                      label={<span className="text-[10px] text-gray-500">Ngày máy bay hạ cánh</span>}
                      name="flight_arrival_date"
                      rules={[{ required: true, message: 'Chọn ngày hàng hạ cánh' }]}
                      className="mb-0"
                    >
                      <Input
                        type="date"
                        className="text-xs bg-white"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </Form.Item>
                    <Form.Item
                      label={<span className="text-[10px] text-gray-500">Giờ máy bay hạ cánh</span>}
                      name="flight_arrival_time"
                      rules={[{ required: true, message: 'Nhập giờ hạ cánh' }]}
                      className="mb-0"
                    >
                      <Input
                        type="time"
                        className="text-xs bg-white"
                      />
                    </Form.Item>
                  </div>
                  <div className="mt-1.5 p-1.5 bg-blue-100/60 rounded text-[10px] text-blue-800 flex items-center gap-1">
                    <span>ℹ️</span> Điều phối sẽ tự động điều xe đến cửa kho ALS lấy hàng ngay sau khi hàng hoàn tất dỡ khỏi máy bay và nhập kho.
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] font-semibold text-indigo-900 mb-1.5 flex items-center gap-1">
                    <PlaneTakeoff size={13} className="text-indigo-600" />
                    <span>Lịch bay dự kiến của lô hàng xuất khẩu (Flight ETD) <span className="text-red-500">*</span></span>
                  </div>
                  <Form.Item
                    name="flight_datetime"
                    rules={[{ required: true, message: 'Vui lòng chọn ngày giờ bay dự kiến' }]}
                    className="mb-1"
                  >
                    <Input
                      type="datetime-local"
                      className="text-xs bg-white"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </Form.Item>

                  <div className="mt-1.5 p-1.5 bg-indigo-50 rounded text-[10px] text-indigo-900 flex items-center gap-1">
                    <span>ℹ️</span> Điều phối sẽ căn cứ khoảng cách để liên hệ chốt giờ lấy hàng phù hợp với lịch bay.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Điểm giao hàng */}
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200">
            <div className="text-[11px] font-bold text-indigo-900 uppercase flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">B</span>
                Điểm nhận hàng {shippingDirection === 'EXPORT' ? '(Kho/Cảng xuất khẩu)' : ''}
              </span>
              {shippingDirection === 'EXPORT' && (
                <span className="text-[10px] text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded font-medium">Hệ thống kho</span>
              )}
            </div>

            {shippingDirection === 'EXPORT' ? (
              <div className="space-y-2">
                <Select
                  className="w-full text-xs"
                  value={selectedDeliveryPreset}
                  onChange={handleSelectDeliveryPreset}
                  placeholder="Chọn kho giao hàng xuất..."
                >
                  <Select.OptGroup label="Kho bãi có sẵn trong hệ thống">
                    <Option value="ALS_NOI_BAI">🏢 Kho ALS tại Sân Bay Nội Bài (Mặc định)</Option>
                    {dbLocations.filter(loc => !loc.name?.toLowerCase().includes('sân bay nội bài')).map(loc => (
                      <Option key={loc.raw_id || loc.id} value={loc.raw_id || loc.id}>
                        📍 {loc.name} {loc.province ? `(${loc.province})` : ''}
                      </Option>
                    ))}
                  </Select.OptGroup>
                  <Select.OptGroup label="Kho khác bên ngoài">
                    <Option value="CUSTOM">➕ Khác (Nhập địa chỉ kho của khách bên ngoài)</Option>
                  </Select.OptGroup>
                </Select>

                {deliveryMode === 'CUSTOM' ? (
                  <Form.Item name="delivery_address" rules={[{ required: true, message: 'Nhập địa chỉ kho bên ngoài' }]} className="mb-0">
                    <LocationSearchInput
                      label="Địa chỉ kho bên ngoài của bạn"
                      markerLetter="B"
                      markerColor="#10b981"
                      placeholder="Gõ tìm địa chỉ kho ngoài..."
                      value={form.getFieldValue('delivery_address')}
                      onChange={(val) => form.setFieldsValue({ delivery_address: val })}
                      onSelectLocation={(loc) => {
                        setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                        form.setFieldsValue({ delivery_address: loc.address });
                      }}
                      required
                    />
                  </Form.Item>
                ) : (
                  <div className="text-xs text-indigo-950 font-medium bg-white p-2 rounded border border-indigo-100">
                    {form.getFieldValue('delivery_address') || 'Kho ALS tại Sân Bay Nội Bài'}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Form.Item name="delivery_address" rules={[{ required: true, message: 'Vui lòng nhập địa điểm nhận hàng' }]} className="mb-0">
                  <LocationSearchInput
                    label="Địa chỉ nhận hàng của khách"
                    markerLetter="B"
                    markerColor="#10b981"
                    placeholder="Gõ tìm địa chỉ nhận hàng..."
                    value={form.getFieldValue('delivery_address')}
                    onChange={(val) => form.setFieldsValue({ delivery_address: val })}
                    onSelectLocation={(loc) => {
                      setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                      form.setFieldsValue({ delivery_address: loc.address });
                    }}
                    required
                  />
                </Form.Item>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

