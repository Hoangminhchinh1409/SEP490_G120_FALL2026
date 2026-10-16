import { useState, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, Select, Checkbox, Button, Tooltip, message } from 'antd';
import { 
  FileText, 
  Calculator,
  Plus,
  Trash2,
  Package
} from 'lucide-react';
import { calculateRouteEstimate, getCoordsFromAddress } from '../../data/dispatcherPresets';
import RouteMapPicker from '../common/RouteMapPicker';
import LocationSearchInput from '../common/LocationSearchInput';

const { Option } = Select;

const OrderFormModal = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm();

  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);

  // Danh sách mặt hàng (hỗ trợ nhiều loại hàng hóa linh hoạt)
  const [cargoItems, setCargoItems] = useState([
    {
      id: 1,
      cargo_name: '',
      cargo_type: undefined,
      package_count: null,
      package_unit: '',
      length_cm: null,
      width_cm: null,
      height_cm: null,
      weight: null
    }
  ]);

  // Tự động tính toán lộ trình qua useMemo khi cả 2 tọa độ đã được chọn
  const routeInfo = useMemo(() => {
    if (pickupCoords?.lat && deliveryCoords?.lat) {
      return calculateRouteEstimate(
        pickupCoords.lat,
        pickupCoords.lng,
        deliveryCoords.lat,
        deliveryCoords.lng
      );
    }
    return { distanceKm: 0, durationMins: 0 };
  }, [pickupCoords, deliveryCoords]);

  const values = Form.useWatch([], form);

  // Thêm mặt hàng mới
  const handleAddCargoItem = () => {
    setCargoItems(prev => [
      ...prev,
      {
        id: Date.now(),
        cargo_name: '',
        cargo_type: undefined,
        package_count: null,
        package_unit: '',
        length_cm: null,
        width_cm: null,
        height_cm: null,
        weight: null
      }
    ]);
  };

  // Xóa mặt hàng
  const handleRemoveCargoItem = (id) => {
    if (cargoItems.length <= 1) {
      message.warning('Đơn hàng cần tối thiểu 1 loại hàng hóa!');
      return;
    }
    setCargoItems(prev => prev.filter(it => it.id !== id));
  };

  // Cập nhật từng trường mặt hàng
  const handleUpdateCargoItem = (id, field, val) => {
    setCargoItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));
  };

  // Tính tổng trọng lượng thực, tổng tính cước và tổng số kiện
  const totals = useMemo(() => {
    let totalActual = 0;
    let totalChargeable = 0;
    let totalCount = 0;

    cargoItems.forEach(item => {
      const w = Number(item.weight) || 0;
      const count = Number(item.package_count) || 1;
      totalActual += w;
      totalCount += count;

      if (item.cargo_type === 'BULK') {
        totalChargeable += w;
      } else {
        const l = Number(item.length_cm) || 0;
        const wid = Number(item.width_cm) || 0;
        const h = Number(item.height_cm) || 0;
        const vol = (l * wid * h) / 5000;
        totalChargeable += Math.max(w, vol);
      }
    });

    return {
      actualWeight: totalActual.toFixed(2),
      chargeableWeight: totalChargeable.toFixed(2),
      totalCount
    };
  }, [cargoItems]);

  const estimatedBaselineRate = useMemo(() => {
    if (!routeInfo.distanceKm) return 0;
    const dist = routeInfo.distanceKm;
    const weight = parseFloat(totals.chargeableWeight) || 0;
    const baseFare = 1500000;
    const distanceFee = dist * 45000;
    const weightFee = weight * 850;
    return Math.round((baseFare + distanceFee + weightFee) / 50000) * 50000;
  }, [routeInfo, totals.chargeableWeight]);

  const handleOk = () => {
    // Validate hàng hóa
    for (let i = 0; i < cargoItems.length; i++) {
      const it = cargoItems[i];
      if (!it.cargo_name || !it.cargo_name.trim()) {
        message.error(`Vui lòng nhập tên hàng cho mặt hàng #${i + 1}`);
        return;
      }
      if (!it.cargo_type) {
        message.error(`Vui lòng chọn loại hàng cho mặt hàng #${i + 1}`);
        return;
      }
      if (!it.weight || Number(it.weight) <= 0) {
        message.error(`Vui lòng nhập trọng lượng hợp lệ (> 0 kg) cho mặt hàng #${i + 1}`);
        return;
      }
    }

    form.validateFields().then((fieldValues) => {
      const primaryItem = cargoItems[0] || {};
      const cargoDescription = cargoItems
        .map(it => `${it.cargo_name}${it.package_count ? ` (${it.package_count} ${it.package_unit || 'kiện'})` : ''}`)
        .join(', ');

      onSubmit({ 
        ...fieldValues, 
        items: cargoItems,
        cargo_name: cargoDescription,
        cargo_type: primaryItem.cargo_type || 'GENERAL',
        package_count: totals.totalCount || 1,
        package_unit: cargoItems.length > 1 ? 'Loại hàng kết hợp' : (primaryItem.package_unit || 'Kiện'),
        length_cm: primaryItem.cargo_type === 'BULK' ? 0 : (primaryItem.length_cm || 0),
        width_cm: primaryItem.cargo_type === 'BULK' ? 0 : (primaryItem.width_cm || 0),
        height_cm: primaryItem.cargo_type === 'BULK' ? 0 : (primaryItem.height_cm || 0),
        weight_kg: parseFloat(totals.actualWeight) || 0,
        chargeable_weight: parseFloat(totals.chargeableWeight) || 0,
        pickup_coords: pickupCoords,
        delivery_coords: deliveryCoords,
        estimated_distance_km: routeInfo.distanceKm,
        estimated_duration_mins: routeInfo.durationMins,
        estimated_baseline_rate: estimatedBaselineRate,
        created_at: new Date().toISOString()
      });

      handleReset();
    });
  };

  const handleReset = () => {
    form.resetFields();
    setCargoItems([
      {
        id: 1,
        cargo_name: '',
        cargo_type: undefined,
        package_count: null,
        package_unit: '',
        length_cm: null,
        width_cm: null,
        height_cm: null,
        weight: null
      }
    ]);
    setPickupCoords(null);
    setDeliveryCoords(null);
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Tạo đơn vận chuyển</h3>
          </div>
        </div>
      }
      open={open}
      destroyOnHidden={true}
      onOk={handleOk}
      onCancel={handleReset}
      width={920}
      okText="Xác nhận tạo đơn"
      cancelText="Đóng"
      okButtonProps={{ className: "bg-[#7367f0] hover:bg-[#5e50ee] font-semibold h-9 px-5" }}
      cancelButtonProps={{ className: "h-9 px-4" }}
    >
      <div className="pt-2"></div>

      <Form 
        form={form} 
        layout="vertical" 
        initialValues={{ 
          source: 'HOTLINE',
          status: 'READY_FOR_PLANNING',
          is_new_customer: false,
          pickup_same_as_customer: false,
          pickup_address: '',
          delivery_address: '',
          customer_address: ''
        }}
      >
        {/* Phân vùng 1: Thông tin Khách hàng */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
            1. Thông tin khách hàng &amp; Tiếp nhận
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <Form.Item label="Nguồn tiếp nhận" name="source" className="mb-2">
            <Select>
              <Option value="HOTLINE">Hotline / Cuộc gọi</Option>
              <Option value="ZALO">Zalo / Tin nhắn</Option>
              <Option value="DIRECT">Trực tiếp tại văn phòng</Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="Mã số thuế" name="customer_tax_code" className="mb-2">
            <Input placeholder="Mã số thuế" />
          </Form.Item>

          <Form.Item label="Khách hàng" name="customer_name" rules={[{ required: true, message: 'Nhập tên khách hàng' }]} className="mb-2">
            <Input placeholder="Tên công ty hoặc doanh nghiệp" />
          </Form.Item>

          <Form.Item label="Số điện thoại" name="customer_phone" rules={[{ required: true, message: 'Nhập SĐT' }]} className="mb-2">
            <Input placeholder="Số điện thoại liên hệ" />
          </Form.Item>

          <Form.Item label="Email" name="customer_email" rules={[{ required: true, type: 'email', message: 'Email hợp lệ' }]} className="mb-2">
            <Input placeholder="Email liên hệ" />
          </Form.Item>

          {/* Địa chỉ khách hàng */}
          <Form.Item label="Địa chỉ" name="customer_address" className="sm:col-span-2 lg:col-span-3 mb-2">
            <Input 
              placeholder="Địa chỉ trụ sở hoặc văn phòng của khách hàng" 
              onChange={(e) => {
                if (form.getFieldValue('pickup_same_as_customer')) {
                  form.setFieldsValue({ pickup_address: e.target.value });
                }
              }}
            />
          </Form.Item>

          {/* Khách hàng mới đặt bên dưới địa chỉ */}
          <div className="sm:col-span-2 lg:col-span-3 flex items-center -mt-1 mb-1">
            <Form.Item name="is_new_customer" valuePropName="checked" className="mb-0">
              <Checkbox className="text-xs font-semibold text-indigo-600">
                Khách hàng mới
              </Checkbox>
            </Form.Item>
          </div>
        </div>

        {/* Phân vùng 2: Tuyến đường */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
            2. Điểm lấy hàng &amp; Điểm giao hàng
          </div>
          <Form.Item name="pickup_same_as_customer" valuePropName="checked" className="mb-0">
            <Checkbox 
              className="text-xs font-semibold text-indigo-600"
              onChange={(e) => {
                if (e.target.checked) {
                  const custAddr = form.getFieldValue('customer_address') || form.getFieldValue('customer_name');
                  if (custAddr) {
                    form.setFieldsValue({ delivery_address: custAddr });
                    const coords = getCoordsFromAddress(custAddr, 'B');
                    setDeliveryCoords(coords);
                  }
                }
              }}
            >
              Địa điểm nhận hàng trùng với địa chỉ của khách
            </Checkbox>
          </Form.Item>
        </div>

        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Điểm Lấy hàng */}
            <Form.Item name="pickup_address" rules={[{ required: true, message: 'Nhập địa chỉ lấy hàng' }]} className="mb-0">
              <LocationSearchInput
                label="Điểm lấy hàng"
                markerLetter="A"
                markerColor="#2563eb"
                placeholder="Gõ tìm địa chỉ lấy hàng (VD: Thái Hà, Nội Bài...)..."
                value={form.getFieldValue('pickup_address')}
                onChange={(val) => {
                  form.setFieldsValue({ pickup_address: val });
                  if (!val || val.trim().length === 0) setPickupCoords(null);
                }}
                onSelectLocation={(loc) => {
                  if (loc && loc.lat && loc.lng) {
                    setPickupCoords({ lat: loc.lat, lng: loc.lng });
                    form.setFieldsValue({ pickup_address: loc.address });
                  } else {
                    setPickupCoords(null);
                    if (loc?.address) form.setFieldsValue({ pickup_address: loc.address });
                  }
                }}
                required
              />
            </Form.Item>

            {/* Điểm Giao hàng */}
            <Form.Item name="delivery_address" rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]} className="mb-0">
              <LocationSearchInput
                label="Điểm giao hàng"
                markerLetter="B"
                markerColor="#10b981"
                placeholder="Gõ tìm địa chỉ giao hàng (VD: Láng Hạ, Tiên Sơn...)..."
                value={form.getFieldValue('delivery_address')}
                onChange={(val) => {
                  form.setFieldsValue({ delivery_address: val });
                  if (!val || val.trim().length === 0) setDeliveryCoords(null);
                }}
                onSelectLocation={(loc) => {
                  if (loc && loc.lat && loc.lng) {
                    setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                    form.setFieldsValue({ delivery_address: loc.address });
                  } else {
                    setDeliveryCoords(null);
                    if (loc?.address) form.setFieldsValue({ delivery_address: loc.address });
                  }
                }}
                required
              />
            </Form.Item>
          </div>

          {/* Bản đồ Leaflet định vị lộ trình trực quan */}
          <div className="bg-white p-2 rounded-lg border border-gray-200">
            <RouteMapPicker
              pickupAddress={values?.pickup_address || form.getFieldValue('pickup_address')}
              deliveryAddress={values?.delivery_address || form.getFieldValue('delivery_address')}
              pickupCoords={pickupCoords}
              deliveryCoords={deliveryCoords}
              height={220}
            />
          </div>
        </div>

        {/* Phân vùng 3: Hàng hóa (Hỗ trợ thêm nhiều loại hàng) */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
            <Package size={15} className="text-emerald-600" />
            3. Danh mục hàng hóa &amp; Quy cách ({cargoItems.length} mặt hàng)
          </div>
          <Button 
            type="dashed" 
            size="small" 
            icon={<Plus size={14} />} 
            onClick={handleAddCargoItem}
            className="text-xs text-emerald-700 border-emerald-300 hover:border-emerald-500 font-semibold"
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
                        placeholder="Kiện, Pallet..." 
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

                {/* Kích thước nếu không phải hàng rời */}
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
                  <div className="pt-1.5 border-t border-gray-150 text-[11px] text-emerald-700 italic">
                    ℹ️ Hàng rời: Hệ thống tự động tính tải trọng trực tiếp theo trọng lượng thực ({Number(item.weight) || 0} kg)
                  </div>
                )}
              </div>
            );
          })}

          {/* Bảng tổng kết tải trọng nhiều mặt hàng */}
          <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between text-xs">
            <div>
              <span className="text-gray-600">Tổng số lượng: </span>
              <b className="text-gray-900">{totals.totalCount} kiện/mặt hàng</b>
            </div>
            <div>
              <span className="text-gray-600">Tổng trọng lượng thực: </span>
              <b className="text-indigo-700">{totals.actualWeight} kg</b>
            </div>
            <div>
              <span className="text-gray-600">Tải trọng tính cước ước tính: </span>
              <b className="text-amber-700 font-bold">{totals.chargeableWeight} kg</b>
            </div>
          </div>
        </div>

        {/* Phân vùng 4: Cước phí */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
          4. Cước phí vận chuyển
        </div>
        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-indigo-600" />
              <span className="text-xs text-gray-600">Cước tham chiếu theo lộ trình:</span>
            </div>
            <span className="text-sm font-bold text-indigo-700">
              ~ {estimatedBaselineRate.toLocaleString()} VNĐ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Form.Item label="Giá cước thỏa thuận (VNĐ)" name="agreed_price" rules={[{ required: true, message: 'Nhập giá thỏa thuận' }]} className="mb-0">
              <InputNumber 
                className="w-full font-bold text-blue-700" 
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                parser={value => value.replace(/\$\s?|(,*)/g, '')} 
                min={0}
              />
            </Form.Item>

            <Form.Item label="Phí phụ trội (VNĐ)" name="extra_fees_surcharge" className="mb-0">
              <InputNumber 
                className="w-full text-indigo-700" 
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                parser={value => value.replace(/\$\s?|(,*)/g, '')} 
                min={0} 
              />
            </Form.Item>

            <Form.Item label="Phí phát sinh (VNĐ)" name="extra_fees_collection" className="mb-0">
              <InputNumber 
                className="w-full text-emerald-700" 
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                parser={value => value.replace(/\$\s?|(,*)/g, '')} 
                min={0} 
              />
            </Form.Item>
          </div>
        </div>

        {/* Ghi chú */}
        <Form.Item label="Ghi chú vận hành" name="order_notes" className="mb-0">
          <Input.TextArea rows={2} placeholder="Ghi chú cho tài xế hoặc điều phối..." />
        </Form.Item>

      </Form>
    </Modal>
  );
};

export default OrderFormModal;