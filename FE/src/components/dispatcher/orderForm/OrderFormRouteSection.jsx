import React from 'react';
import { Form, Input, Select, Checkbox } from 'antd';
import { PlaneTakeoff, Calendar } from 'lucide-react';
import RouteMapPicker from '../../common/RouteMapPicker';
import LocationSearchInput from '../../common/LocationSearchInput';

const { Option } = Select;

export default function OrderFormRouteSection({
  form,
  shippingDirection,
  applyDirectionPreset,
  pickupMode,
  deliveryMode,
  selectedPickupPreset,
  selectedDeliveryPreset,
  handleSelectPickupPreset,
  handleSelectDeliveryPreset,
  pickupCoords,
  deliveryCoords,
  setPickupCoords,
  setDeliveryCoords,
  dbLocations,
  routeInfo,
  exportPickupSuggestion
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          2. Điểm lấy hàng &amp; Điểm giao hàng
        </div>
        <Form.Item name="address_same_as_customer" valuePropName="checked" className="mb-0">
          <Checkbox 
            className="text-xs font-semibold text-indigo-600"
            onChange={(e) => {
              if (e.target.checked) {
                const custAddr = form.getFieldValue('customer_address') || form.getFieldValue('customer_name');
                if (custAddr) {
                  if (shippingDirection === 'IMPORT') form.setFieldsValue({ delivery_address: custAddr });
                  else form.setFieldsValue({ pickup_address: custAddr });
                }
              }
            }}
          >
            {shippingDirection === 'IMPORT' ? 'Địa điểm nhận hàng trùng với địa chỉ của khách' : 'Địa điểm lấy hàng trùng với địa chỉ của khách'}
          </Checkbox>
        </Form.Item>
      </div>

      <div className="bg-gradient-to-r from-blue-50/40 via-white to-indigo-50/40 p-3.5 rounded-xl border border-blue-100 mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-150 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-700">Chiều vận chuyển:</span>
            <span className="text-[11px] text-gray-500">
              {shippingDirection === 'IMPORT' ? 'Từ Sân Bay Nội Bài về kho khách' : 'Từ kho khách đến Sân Bay Nội Bài'}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-xs">
            <button 
              type="button" 
              onClick={() => applyDirectionPreset('IMPORT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${shippingDirection === 'IMPORT' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <span>🛬</span><span>Nhập khẩu</span>
            </button>
            <button 
              type="button" 
              onClick={() => applyDirectionPreset('EXPORT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${shippingDirection === 'EXPORT' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <span>🛫</span><span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Điểm lấy hàng */}
          <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200">
            <div className="text-[11px] font-bold text-blue-900 uppercase flex items-center justify-between mb-2">
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">A</span>
                Điểm lấy hàng {shippingDirection === 'IMPORT' ? '(Kho/Cảng nhập)' : ''}
              </span>
              {shippingDirection === 'IMPORT' && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Hệ thống kho</span>
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
                      label="Địa chỉ kho bên ngoài của khách"
                      markerLetter="A"
                      markerColor="#2563eb"
                      placeholder="Gõ tìm địa chỉ kho ngoài..."
                      value={form.getFieldValue('pickup_address')}
                      onChange={(val) => { form.setFieldsValue({ pickup_address: val }); if (!val?.trim()) setPickupCoords(null); }}
                      onSelectLocation={(loc) => { if (loc?.lat && loc?.lng) { setPickupCoords({ lat: loc.lat, lng: loc.lng }); form.setFieldsValue({ pickup_address: loc.address }); } else { setPickupCoords(null); if (loc?.address) form.setFieldsValue({ pickup_address: loc.address }); } }}
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
                <Form.Item name="pickup_address" rules={[{ required: true, message: 'Nhập địa chỉ kho lấy hàng' }]} className="mb-0">
                  <LocationSearchInput
                    label="Địa chỉ kho lấy hàng của khách"
                    markerLetter="A"
                    markerColor="#2563eb"
                    placeholder="Gõ tìm địa chỉ kho lấy hàng..."
                    value={form.getFieldValue('pickup_address')}
                    onChange={(val) => { form.setFieldsValue({ pickup_address: val }); if (!val?.trim()) setPickupCoords(null); }}
                    onSelectLocation={(loc) => { if (loc?.lat && loc?.lng) { setPickupCoords({ lat: loc.lat, lng: loc.lng }); form.setFieldsValue({ pickup_address: loc.address }); } else { setPickupCoords(null); if (loc?.address) form.setFieldsValue({ pickup_address: loc.address }); } }}
                    required
                  />
                </Form.Item>
              </div>
            )}

            {/* Thời gian hàng hạ cánh (Nhập khẩu) hoặc Lịch bay (Xuất khẩu) */}
            <div className="mt-2.5 pt-2.5 border-t border-blue-200">
              {shippingDirection === 'IMPORT' ? (
                <div>
                  <div className="text-[11px] font-semibold text-blue-900 mb-1.5 flex items-center gap-1">
                    <span>🛬</span>
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
                    <span>Lịch bay dự kiến của hàng xuất (Flight ETD) <span className="text-red-500">*</span></span>
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

                  <div className="mt-2 pt-2 border-t border-dashed border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-blue-900 flex items-center gap-1">
                        <Calendar size={12} className="text-blue-600" /> Lịch chốt xe đến lấy hàng tại kho khách:
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Form.Item
                        name="required_pickup_date"
                        rules={[{ required: true, message: 'Chọn ngày lấy hàng' }]}
                        className="mb-0"
                      >
                        <Input
                          type="date"
                          className="text-xs bg-white"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </Form.Item>
                      <Form.Item
                        name="operating_time_slot"
                        className="mb-0"
                      >
                        <Select className="text-xs w-full bg-white">
                          <Option value="FULL_DAY">☀️ Ca ngày (8:00 - 17:00)</Option>
                          <Option value="AFTERNOON">🌤️ Ca chiều (12:00 - 17:00)</Option>
                        </Select>
                      </Form.Item>
                    </div>
                  </div>

                  {exportPickupSuggestion && (
                    <div className="mt-1.5 p-1.5 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-900">
                      ⏱️ <b>Khuyến nghị lấy trước {exportPickupSuggestion.latestPickupFormatted}</b> (cách {routeInfo.distanceKm} km, đã gồm {exportPickupSuggestion.travelHours}h xe chạy + 4h cut-off kho). Khách tự chịu phí nếu chốt muộn hơn.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Điểm giao hàng */}
          <div className="p-3 bg-indigo-50/70 rounded-lg border border-indigo-200">
            <div className="text-[11px] font-bold text-indigo-900 uppercase flex items-center justify-between mb-2">
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">B</span>
                Điểm giao hàng {shippingDirection === 'EXPORT' ? '(Kho/Cảng xuất)' : ''}
              </span>
              {shippingDirection === 'EXPORT' && (
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Hệ thống kho</span>
              )}
            </div>

            {shippingDirection === 'EXPORT' ? (
              <div className="space-y-2">
                <Select
                  className="w-full text-xs"
                  value={selectedDeliveryPreset}
                  onChange={handleSelectDeliveryPreset}
                  placeholder="Chọn kho giao hàng..."
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
                  <Form.Item name="delivery_address" rules={[{ required: true, message: 'Nhập địa chỉ kho giao hàng bên ngoài' }]} className="mb-0">
                    <LocationSearchInput
                      label="Địa chỉ kho giao ngoài của khách"
                      markerLetter="B"
                      markerColor="#4f46e5"
                      placeholder="Gõ tìm địa chỉ kho ngoài..."
                      value={form.getFieldValue('delivery_address')}
                      onChange={(val) => { form.setFieldsValue({ delivery_address: val }); if (!val?.trim()) setDeliveryCoords(null); }}
                      onSelectLocation={(loc) => { if (loc?.lat && loc?.lng) { setDeliveryCoords({ lat: loc.lat, lng: loc.lng }); form.setFieldsValue({ delivery_address: loc.address }); } else { setDeliveryCoords(null); if (loc?.address) form.setFieldsValue({ delivery_address: loc.address }); } }}
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
                <Form.Item name="delivery_address" rules={[{ required: true, message: 'Nhập địa chỉ kho giao hàng' }]} className="mb-0">
                  <LocationSearchInput
                    label="Địa chỉ kho giao hàng của khách"
                    markerLetter="B"
                    markerColor="#4f46e5"
                    placeholder="Gõ tìm địa chỉ kho giao hàng..."
                    value={form.getFieldValue('delivery_address')}
                    onChange={(val) => { form.setFieldsValue({ delivery_address: val }); if (!val?.trim()) setDeliveryCoords(null); }}
                    onSelectLocation={(loc) => { if (loc?.lat && loc?.lng) { setDeliveryCoords({ lat: loc.lat, lng: loc.lng }); form.setFieldsValue({ delivery_address: loc.address }); } else { setDeliveryCoords(null); if (loc?.address) form.setFieldsValue({ delivery_address: loc.address }); } }}
                    required
                  />
                </Form.Item>
              </div>
            )}
          </div>
        </div>

        {/* Bản đồ định tuyến */}
        <div className="bg-white p-2 rounded-lg border border-gray-200">
          <RouteMapPicker
            pickupAddress={form.getFieldValue('pickup_address') || (shippingDirection === 'IMPORT' ? 'Kho ALS tại Sân Bay Nội Bài' : '')}
            deliveryAddress={form.getFieldValue('delivery_address') || (shippingDirection === 'EXPORT' ? 'Kho ALS tại Sân Bay Nội Bài' : '')}
            pickupCoords={pickupCoords || (shippingDirection === 'IMPORT' ? { lat: 21.2187, lng: 105.8042 } : null)}
            deliveryCoords={deliveryCoords || (shippingDirection === 'EXPORT' ? { lat: 21.2187, lng: 105.8042 } : null)}
            height={220}
          />
        </div>
      </div>
    </>
  );
}

