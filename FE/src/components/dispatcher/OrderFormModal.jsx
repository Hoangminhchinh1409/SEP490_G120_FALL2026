import { useState, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Select, Checkbox, Tag } from 'antd';
import { 
  FileText, 
  Calculator
} from 'lucide-react';
import { calculateRouteEstimate, getCoordsFromAddress } from '../../data/dispatcherPresets';
import RouteMapPicker from '../common/RouteMapPicker';
import LocationSearchInput from '../common/LocationSearchInput';

const { Option } = Select;

const OrderFormModal = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm();

  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);

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

  const chargeableWeight = useMemo(() => {
    if (!values) return '0.00';
    const { length_cm, width_cm, height_cm, weight_kg, cargo_type } = values;
    if (cargo_type === 'BULK') {
      return (Number(weight_kg) || 0).toFixed(2);
    }
    if (length_cm && width_cm && height_cm) {
      const volumeWeight = (length_cm * width_cm * height_cm) / 5000;
      return Math.max(Number(weight_kg) || 0, volumeWeight).toFixed(2);
    }
    return (Number(weight_kg) || 0).toFixed(2);
  }, [values]);

  const estimatedBaselineRate = useMemo(() => {
    if (!routeInfo.distanceKm) return 0;
    const dist = routeInfo.distanceKm;
    const weight = parseFloat(chargeableWeight) || 0;
    const baseFare = 1500000;
    const distanceFee = dist * 45000;
    const weightFee = weight * 850;
    return Math.round((baseFare + distanceFee + weightFee) / 50000) * 50000;
  }, [routeInfo, chargeableWeight]);

  const handleOk = () => {
    form.validateFields().then((fieldValues) => {
      const isBulk = fieldValues.cargo_type === 'BULK';
      const finalCargoType = fieldValues.cargo_type === 'OTHER' && fieldValues.other_cargo_type
        ? `OTHER: ${fieldValues.other_cargo_type}`
        : fieldValues.cargo_type;

      onSubmit({ 
        ...fieldValues, 
        length_cm: isBulk ? 0 : (fieldValues.length_cm || 0),
        width_cm: isBulk ? 0 : (fieldValues.width_cm || 0),
        height_cm: isBulk ? 0 : (fieldValues.height_cm || 0),
        cargo_type: finalCargoType,
        chargeable_weight: parseFloat(chargeableWeight) || (Number(fieldValues.weight_kg) || 0),
        pickup_coords: pickupCoords,
        delivery_coords: deliveryCoords,
        estimated_distance_km: routeInfo.distanceKm,
        estimated_duration_mins: routeInfo.durationMins,
        estimated_baseline_rate: estimatedBaselineRate,
        created_at: new Date().toISOString()
      });
      form.resetFields();
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
      }}
      width={900}
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
          is_stackable: true, 
          package_unit: 'Pallet',
          package_count: 1,
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
          <Tag color="green" className="text-[11px] font-semibold m-0">
            Đã chốt giá với khách (Sẵn sàng xếp xe)
          </Tag>
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

          <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100 flex flex-col justify-center text-xs mb-2">
            <span className="text-[11px] text-indigo-700 font-bold">Mã vận đơn (NEX - XXXXXX):</span>
            <span className="text-[10px] text-gray-500 mt-0.5">Sinh tự động sau khi xếp xe nội bộ, hoặc điền mã khi giao vendor ngoài</span>
          </div>

          {/* Địa chỉ khách hàng */}
          <Form.Item label="Địa chỉ" name="customer_address" className="lg:col-span-4 mb-2">
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
          <div className="lg:col-span-4 flex items-center -mt-1 mb-1">
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
            2. Điểm lấy hàng & Điểm giao hàng
          </div>
          <Form.Item name="pickup_same_as_customer" valuePropName="checked" className="mb-0">
            <Checkbox 
              className="text-xs font-semibold text-indigo-600"
              onChange={(e) => {
                if (e.target.checked) {
                  const custAddr = form.getFieldValue('customer_address') || form.getFieldValue('customer_name');
                  if (custAddr) {
                    form.setFieldsValue({ pickup_address: custAddr });
                    const coords = getCoordsFromAddress(custAddr, 'A');
                    setPickupCoords(coords);
                  }
                }
              }}
            >
              Địa điểm lấy hàng trùng với địa chỉ của khách
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

        {/* Phân vùng 3: Hàng hóa */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
          3. Quy cách hàng hóa & Tải trọng
        </div>
        <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Form.Item label="Loại hàng" name="cargo_type" rules={[{ required: true, message: 'Vui lòng chọn loại hàng' }]} className="mb-0">
              <Select placeholder="Chọn loại hàng...">
                <Option value="PALLET">Hàng Pallet (Tính kích thước &amp; trọng tải)</Option>
                <Option value="BULK">Hàng rời (Xếp tính theo trọng tải)</Option>
                <Option value="GENERAL">Hàng bách hóa thông thường</Option>
                <Option value="FRAGILE">Hàng điện tử dễ vỡ</Option>
                <Option value="VALUABLE">Hàng giá trị cao (Niêm chì)</Option>
                <Option value="OTHER">Khác</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Số lượng" name="package_count" rules={[{ required: true }]} className="mb-0">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            
            <Form.Item label="Đơn vị tính" name="package_unit" rules={[{ required: true, message: 'Nhập đơn vị' }]} className="mb-0">
              <Input placeholder="VD: Pallet, Kiện, Tấn..." />
            </Form.Item>

            <Form.Item label="Xếp chồng" name="is_stackable" valuePropName="checked" className="mb-0">
              <Switch checkedChildren="Cho phép" unCheckedChildren="Không" />
            </Form.Item>
          </div>

          {/* Ô nhập loại hàng khác khi chọn "Khác" */}
          {values?.cargo_type === 'OTHER' && (
            <div className="mb-3 pt-2 border-t border-gray-150">
              <Form.Item label="Chi tiết loại hàng khác" name="other_cargo_type" rules={[{ required: true, message: 'Vui lòng nhập tên loại hàng' }]} className="mb-0">
                <Input placeholder="VD: Hóa chất đặc thù, Vật liệu xây dựng, Cáp quang..." />
              </Form.Item>
            </div>
          )}

          {/* Chưa chọn loại hàng -> Hiển thị hướng dẫn */}
          {!values?.cargo_type && (
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-indigo-700 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100 flex items-center justify-center">
                <span>💡 Vui lòng chọn <b>Loại hàng</b> ở trên: nếu là <b>Hàng rời</b> sẽ tính theo trọng tải; nếu là <b>Hàng Pallet</b> sẽ tính cả trọng tải và kích thước dài rộng cao.</span>
              </div>
            </div>
          )}

          {/* Hàng rời -> Chỉ hiển thị trọng tải xe */}
          {values?.cargo_type === 'BULK' && (
            <div className="pt-2 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <Form.Item label="Trọng tải hàng rời (kg)" name="weight_kg" rules={[{ required: true, message: 'Vui lòng nhập trọng tải' }]} className="mb-0">
                  <InputNumber min={0.1} className="w-full font-semibold text-emerald-700" placeholder="VD: 5000" />
                </Form.Item>

                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex flex-col justify-center">
                  <span className="text-[11px] font-semibold text-emerald-900">Tải trọng tính cước hàng rời:</span>
                  <span className="text-lg font-bold text-emerald-600">{chargeableWeight} kg</span>
                </div>
              </div>
            </div>
          )}

          {/* Hàng Pallet / Đóng kiện -> Hiển thị cả Dài, Rộng, Cao & Trọng tải */}
          {values?.cargo_type && values?.cargo_type !== 'BULK' && (
            <div className="pt-2 border-t border-gray-200">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <Form.Item label="Dài (cm)" name="length_cm" rules={[{ required: true }]} className="mb-0">
                  <InputNumber className="w-full" min={1} placeholder="Dài" />
                </Form.Item>
                <Form.Item label="Rộng (cm)" name="width_cm" rules={[{ required: true }]} className="mb-0">
                  <InputNumber className="w-full" min={1} placeholder="Rộng" />
                </Form.Item>
                <Form.Item label="Cao (cm)" name="height_cm" rules={[{ required: true }]} className="mb-0">
                  <InputNumber className="w-full" min={1} placeholder="Cao" />
                </Form.Item>
                <Form.Item label="Trọng lượng (kg)" name="weight_kg" rules={[{ required: true }]} className="mb-0">
                  <InputNumber className="w-full" min={0.1} placeholder="Kg" />
                </Form.Item>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex flex-col justify-center col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-semibold text-amber-900">Tải trọng tính cước:</span>
                  <span className="text-base font-bold text-amber-600">{chargeableWeight} kg</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Phân vùng 4: Cước phí (Đã bỏ chọn chứng từ theo yêu cầu luồng nghiệp vụ) */}
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