import { useState, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Select, Checkbox, Tag } from 'antd';
import { 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  ShieldAlert, 
  MapPin, 
  Route, 
  Calculator, 
  Compass,
  PhoneCall
} from 'lucide-react';
import { 
  SAMPLE_ORDER_PRESETS, 
  DOCUMENT_TYPES, 
  POPULAR_LOCATIONS, 
  calculateRouteEstimate 
} from '../../data/dispatcherPresets';
import RouteMapPicker from '../common/RouteMapPicker';
import LocationSearchInput from '../common/LocationSearchInput';

const { Option } = Select;

const OrderFormModal = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm();
  const [noDocsRequired, setNoDocsRequired] = useState(false);
  const [activePreset, setActivePreset] = useState(null);

  const [pickupCoords, setPickupCoords] = useState({ lat: 21.1235, lng: 105.9876 });
  const [deliveryCoords, setDeliveryCoords] = useState({ lat: 21.2215, lng: 105.8078 });

  // Tự động tính toán lộ trình qua useMemo
  const routeInfo = useMemo(() => {
    if (pickupCoords?.lat && deliveryCoords?.lat) {
      return calculateRouteEstimate(
        pickupCoords.lat,
        pickupCoords.lng,
        deliveryCoords.lat,
        deliveryCoords.lng
      );
    }
    return { distanceKm: 38.5, durationMins: 45 };
  }, [pickupCoords, deliveryCoords]);

  const values = Form.useWatch([], form);

  const chargeableWeight = useMemo(() => {
    if (!values) return '0.00';
    const { length_cm, width_cm, height_cm, weight_kg } = values;
    if (length_cm && width_cm && height_cm) {
      const volumeWeight = (length_cm * width_cm * height_cm) / 5000;
      return Math.max(weight_kg || 0, volumeWeight).toFixed(2);
    }
    return (weight_kg || 0).toFixed(2);
  }, [values]);

  const estimatedBaselineRate = useMemo(() => {
    const dist = routeInfo.distanceKm || 35;
    const weight = parseFloat(chargeableWeight) || 0;
    const baseFare = 1500000;
    const distanceFee = dist * 45000;
    const weightFee = weight * 850;
    return Math.round((baseFare + distanceFee + weightFee) / 50000) * 50000;
  }, [routeInfo, chargeableWeight]);

  const applyPreset = (presetKey) => {
    const preset = SAMPLE_ORDER_PRESETS.find(p => p.key === presetKey);
    if (!preset) return;
    setActivePreset(presetKey);
    setNoDocsRequired(false);

    if (preset.data.pickup_coords) setPickupCoords(preset.data.pickup_coords);
    if (preset.data.delivery_coords) setDeliveryCoords(preset.data.delivery_coords);

    form.setFieldsValue({
      ...preset.data,
      no_documents: false
    });
  };

  const handleNoDocsChange = (e) => {
    const checked = e.target.checked;
    setNoDocsRequired(checked);
    if (checked) {
      form.setFieldsValue({ required_documents: [] });
    } else {
      form.setFieldsValue({ 
        required_documents: ['CUSTOMS_DECLARATION', 'DELIVERY_ORDER', 'COMMERCIAL_INVOICE', 'PACKING_LIST'] 
      });
    }
  };

  const handleOk = () => {
    form.validateFields().then((fieldValues) => {
      onSubmit({ 
        ...fieldValues, 
        chargeable_weight: parseFloat(chargeableWeight) || fieldValues.weight_kg,
        pickup_coords: pickupCoords,
        delivery_coords: deliveryCoords,
        estimated_distance_km: routeInfo.distanceKm,
        estimated_duration_mins: routeInfo.durationMins,
        estimated_baseline_rate: estimatedBaselineRate,
        created_at: new Date().toISOString()
      });
      form.resetFields();
      setActivePreset(null);
    });
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
      onOk={handleOk}
      onCancel={() => {
        onCancel();
        setActivePreset(null);
      }}
      width={900}
      okText="Xác nhận tạo đơn"
      cancelText="Đóng"
      okButtonProps={{ className: "bg-[#7367f0] hover:bg-[#5e50ee] font-semibold h-9 px-5" }}
      cancelButtonProps={{ className: "h-9 px-4" }}
    >
      {/* Nút bấm Chọn Dữ liệu mẫu */}
      <div className="mt-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500 fill-amber-400" />
            Dữ liệu mẫu:
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SAMPLE_ORDER_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                activePreset === preset.key 
                  ? 'border-indigo-500 bg-white shadow-sm ring-2 ring-indigo-100' 
                  : 'border-gray-200 bg-white hover:border-indigo-200'
              }`}
            >
              <div className="font-bold text-gray-800 flex items-center justify-between">
                <span>{preset.name}</span>
                {activePreset === preset.key && <CheckCircle2 size={14} className="text-indigo-600" />}
              </div>
              <div className="text-gray-500 line-clamp-1">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      <Form 
        form={form} 
        layout="vertical" 
        initialValues={{ 
          source: 'HOTLINE',
          status: 'READY_FOR_PLANNING',
          is_stackable: true, 
          cargo_type: 'GENERAL',
          package_unit: 'Pallet',
          package_count: 1,
          pickup_address: 'KCN Tiên Sơn (Nhà máy ADTEK), Bắc Ninh',
          delivery_address: 'Ga Hàng hóa NCTS Sân bay Nội Bài, Sóc Sơn, Hà Nội',
          required_documents: ['CUSTOMS_DECLARATION', 'DELIVERY_ORDER', 'COMMERCIAL_INVOICE', 'PACKING_LIST']
        }}
      >
        {/* Phân vùng 1: Thông tin Khách hàng */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
          1. Thông tin khách hàng & Vận đơn
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <Form.Item label="Nguồn tiếp nhận" name="source" className="mb-2">
            <Select>
              <Option value="HOTLINE">Hotline / Cuộc gọi</Option>
              <Option value="ZALO">Zalo / Tin nhắn</Option>
              <Option value="DIRECT">Trực tiếp tại văn phòng</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Trạng thái khởi tạo" name="status" className="mb-2">
            <Select>
              <Option value="READY_FOR_PLANNING">Sẵn sàng xếp xe</Option>
              <Option value="DRAFT">Lưu nháp</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Mã vận đơn HAWB" name="hawb_code" rules={[{ required: true, message: 'Nhập mã HAWB' }]} className="mb-2">
            <Input placeholder="Mã vận đơn" className="font-mono text-indigo-700 font-semibold" />
          </Form.Item>
          <Form.Item label="Mã số thuế" name="customer_tax_code" className="mb-2">
            <Input placeholder="Mã số thuế" />
          </Form.Item>
          <Form.Item label="Khách hàng" name="customer_name" rules={[{ required: true, message: 'Nhập tên khách hàng' }]} className="lg:col-span-2 mb-2">
            <Input placeholder="Tên công ty hoặc doanh nghiệp" />
          </Form.Item>
          <Form.Item label="Số điện thoại" name="customer_phone" rules={[{ required: true, message: 'Nhập SĐT' }]} className="mb-2">
            <Input placeholder="Số điện thoại liên hệ" />
          </Form.Item>
          <Form.Item label="Email" name="customer_email" rules={[{ required: true, type: 'email', message: 'Email hợp lệ' }]} className="mb-2">
            <Input placeholder="Email liên hệ" />
          </Form.Item>
          <Form.Item label="Nhà máy / Kho" name="factory_name" className="lg:col-span-4 mb-0">
            <Input placeholder="Nhà máy hoặc kho hàng" />
          </Form.Item>
        </div>

        {/* Phân vùng 2: Tuyến đường */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
          2. Điểm lấy hàng & Điểm giao hàng
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
                onChange={(val) => form.setFieldsValue({ pickup_address: val })}
                onSelectLocation={(loc) => {
                  setPickupCoords({ lat: loc.lat, lng: loc.lng });
                  form.setFieldsValue({ pickup_address: loc.address });
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
                onChange={(val) => form.setFieldsValue({ delivery_address: val })}
                onSelectLocation={(loc) => {
                  setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                  form.setFieldsValue({ delivery_address: loc.address });
                }}
                required
              />
            </Form.Item>
          </div>

          {/* Bản đồ Leaflet định vị lộ trình trực quan */}
          <div className="bg-white p-2 rounded-lg border border-gray-200">
            <RouteMapPicker
              pickupAddress={form.getFieldValue('pickup_address')}
              deliveryAddress={form.getFieldValue('delivery_address')}
              pickupCoords={pickupCoords}
              deliveryCoords={deliveryCoords}
              height={220}
            />
          </div>
        </div>

        {/* Phân vùng 3: Hàng hóa */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
          3. Quy cách hàng hóa & Tải trọng
        </div>
        <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            <Form.Item label="Số lượng" name="package_count" rules={[{ required: true }]} className="mb-0">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item label="Đơn vị tính" name="package_unit" className="mb-0">
              <Select>
                <Option value="Pallet">Pallet</Option>
                <Option value="Kiện gỗ">Kiện gỗ</Option>
                <Option value="Thùng carton">Thùng carton</Option>
                <Option value="Cuộn cáp">Cuộn cáp</Option>
              </Select>
            </Form.Item>
            <Form.Item label="Dài (cm)" name="length_cm" rules={[{ required: true }]} className="mb-0">
              <InputNumber className="w-full" min={1} />
            </Form.Item>
            <Form.Item label="Rộng (cm)" name="width_cm" rules={[{ required: true }]} className="mb-0">
              <InputNumber className="w-full" min={1} />
            </Form.Item>
            <Form.Item label="Cao (cm)" name="height_cm" rules={[{ required: true }]} className="mb-0">
              <InputNumber className="w-full" min={1} />
            </Form.Item>
            <Form.Item label="Trọng lượng (kg)" name="weight_kg" rules={[{ required: true }]} className="mb-0">
              <InputNumber className="w-full" min={1} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-2 border-t border-gray-200">
            <Form.Item label="Loại hàng" name="cargo_type" className="mb-0">
              <Select>
                <Option value="GENERAL">Hàng thông thường</Option>
                <Option value="FRAGILE">Hàng dễ vỡ</Option>
                <Option value="VALUABLE">Hàng giá trị cao</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Xếp chồng" name="is_stackable" valuePropName="checked" className="mb-0">
              <Switch checkedChildren="Cho phép" unCheckedChildren="Không" />
            </Form.Item>

            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-amber-900">Tải trọng tính cước:</span>
              <span className="text-lg font-bold text-amber-600">{chargeableWeight} kg</span>
            </div>
          </div>
        </div>

        {/* Phân vùng 4: Chứng từ */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-blue-600" />
            4. Danh mục chứng từ yêu cầu
          </span>
          <Checkbox checked={noDocsRequired} onChange={handleNoDocsChange} className="text-xs text-gray-600">
            Không yêu cầu chứng từ
          </Checkbox>
        </div>
        <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 mb-4">
          <Form.Item name="required_documents" className="mb-0">
            <Checkbox.Group className="w-full" disabled={noDocsRequired}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DOCUMENT_TYPES.map(doc => (
                  <div key={doc.key} className="p-2 bg-white rounded-lg border border-gray-200">
                    <Checkbox value={doc.key} className="w-full text-xs font-semibold text-gray-800">
                      <div>{doc.label}</div>
                      <div className="text-[11px] text-gray-400 font-normal mt-0.5">{doc.description}</div>
                    </Checkbox>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </div>

        {/* Phân vùng 5: Cước phí */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
          5. Cước phí vận chuyển
        </div>
        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-indigo-600" />
              <span className="text-xs text-gray-600">Cước tham chiếu theo lộ trình:</span>
            </div>
            <span className="text-sm font-bold text-indigo-700">
              ~ {estimatedBaselineRate.toLocaleString()} đ
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