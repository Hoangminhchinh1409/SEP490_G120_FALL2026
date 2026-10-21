import { useState, useMemo, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Checkbox, Button, Tooltip, message, Tag } from 'antd';
import { 
  FileText, 
  Calculator,
  Plus,
  Trash2,
  Package,
  Truck,
  ShieldCheck
} from 'lucide-react';
import { 
  calculateRouteEstimate, 
  getCoordsFromAddress,
  ALS_NOI_BAI_TERMINAL,
  ALS_ICD_LOCATIONS,
  ALS_NOI_BAI_WAREHOUSES
} from '../../data/dispatcherPresets';
import { dispatcherApi } from '../../api/dispatcherApi';
import RouteMapPicker from '../common/RouteMapPicker';
import LocationSearchInput from '../common/LocationSearchInput';

const { Option } = Select;

const CUSTOMS_SERVICE_FEE = 500000; // Phí dịch vụ làm thủ tục hải quan hộ (VNĐ)

const OrderFormModal = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm();
  const [dbLocations, setDbLocations] = useState([]);

  // Chế độ chọn kho bãi: 'PRESET' hoặc 'CUSTOM'
  const [pickupMode, setPickupMode] = useState('PRESET');
  const [deliveryMode, setDeliveryMode] = useState('CUSTOM');
  const [selectedPickupPreset, setSelectedPickupPreset] = useState('ALS_NOI_BAI');
  const [selectedDeliveryPreset, setSelectedDeliveryPreset] = useState('ALS_NOI_BAI');

  // Tích chọn làm thủ tục hải quan hộ
  const [customsServiceRequired, setCustomsServiceRequired] = useState(false);

  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);

  // Tải danh sách điểm giao nhận từ database
  useEffect(() => {
    let active = true;
    const fetchLocations = async () => {
      try {
        const locs = await dispatcherApi.getLocations();
        if (active && Array.isArray(locs)) {
          setDbLocations(locs);
        }
      } catch (err) {
        console.error('Không tải được danh sách điểm giao nhận:', err);
      }
    };
    if (open) {
      fetchLocations();
    }
    return () => { active = false; };
  }, [open]);

  // Danh sách mặt hàng
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

  const [shippingDirection, setShippingDirection] = useState('IMPORT');
  const [assignedWarehouse, setAssignedWarehouse] = useState('WH-1');
  const [customsLocation, setCustomsLocation] = useState('NOI_BAI');
  const [customsChannel, setCustomsChannel] = useState('GREEN');
  const [sealNumber, setSealNumber] = useState('');
  // --- Kịch bản hải quan ---
  const [customsScenario, setCustomsScenario] = useState('NOI_BAI_DIRECT');

  const activeScenario = CUSTOMS_SCENARIOS.find(s => s.value === customsScenario) || CUSTOMS_SCENARIOS[0];

  // Tự động phân bổ ngẫu nhiên 1 trong 4 kho hàng của ALS tại Nội Bài
  const handleRandomizeWarehouse = () => {
    const randomIndex = Math.floor(Math.random() * ALS_NOI_BAI_WAREHOUSES.length);
    const chosen = ALS_NOI_BAI_WAREHOUSES[randomIndex];
    setAssignedWarehouse(chosen.id);
    form.setFieldsValue({ assigned_warehouse: chosen.id });
  };

  // Khởi tạo địa chỉ theo chiều vận chuyển
  const applyDirectionPreset = (direction) => {
    setShippingDirection(direction);
    form.setFieldsValue({ shipping_direction: direction });
    const custAddr = form.getFieldValue('customer_address') || '';

    if (direction === 'IMPORT') {
      setPickupMode('PRESET');
      setSelectedPickupPreset('ALS_NOI_BAI');
      form.setFieldsValue({
        pickup_address: 'Kho ALS tại Sân Bay Nội Bài',
        delivery_address: custAddr || ''
      });
      setPickupCoords({ lat: 21.2187, lng: 105.8042 });
      setDeliveryMode('CUSTOM');
      if (!custAddr) setDeliveryCoords(null);
    } else {
      setDeliveryMode('PRESET');
      setSelectedDeliveryPreset('ALS_NOI_BAI');
      form.setFieldsValue({
        pickup_address: custAddr || '',
        delivery_address: 'Kho ALS tại Sân Bay Nội Bài'
      });
      setPickupMode('CUSTOM');
      if (!custAddr) setPickupCoords(null);
      setDeliveryCoords({ lat: 21.2187, lng: 105.8042 });
    }
  };

  // Chọn kho lấy hàng từ dropdown
  const handleSelectPickupPreset = (val) => {
    setSelectedPickupPreset(val);
    if (val === 'CUSTOM') {
      setPickupMode('CUSTOM');
      form.setFieldsValue({ pickup_address: '' });
      setPickupCoords(null);
      return;
    }
    setPickupMode('PRESET');
    const matched = dbLocations.find(l => (l.raw_id || l.id) === val);
    if (matched) {
      form.setFieldsValue({ pickup_address: matched.address || matched.name });
      setPickupCoords({ lat: matched.lat || 21.2187, lng: matched.lng || 105.8042 });
    } else {
      form.setFieldsValue({ pickup_address: 'Kho ALS tại Sân Bay Nội Bài' });
      setPickupCoords({ lat: 21.2187, lng: 105.8042 });
    }
  };

  // Chọn kho giao hàng từ dropdown
  const handleSelectDeliveryPreset = (val) => {
    setSelectedDeliveryPreset(val);
    if (val === 'CUSTOM') {
      setDeliveryMode('CUSTOM');
      form.setFieldsValue({ delivery_address: '' });
      setDeliveryCoords(null);
      return;
    }
    setDeliveryMode('PRESET');
    const matched = dbLocations.find(l => (l.raw_id || l.id) === val);
    if (matched) {
      form.setFieldsValue({ delivery_address: matched.address || matched.name });
      setDeliveryCoords({ lat: matched.lat || 21.2187, lng: matched.lng || 105.8042 });
    } else {
      form.setFieldsValue({ delivery_address: 'Kho ALS tại Sân Bay Nội Bài' });
      setDeliveryCoords({ lat: 21.2187, lng: 105.8042 });
    }
  };

  // Tính lộ trình
  const routeInfo = useMemo(() => {
    if (pickupCoords?.lat && deliveryCoords?.lat) {
      return calculateRouteEstimate(
        pickupCoords.lat, pickupCoords.lng,
        deliveryCoords.lat, deliveryCoords.lng
      );
    }
    return { distanceKm: 0, durationMins: 0 };
  }, [pickupCoords, deliveryCoords]);

  const values = Form.useWatch([], form);

  // Thêm mặt hàng mới
  const handleAddCargoItem = () => {
    setCargoItems(prev => [
      ...prev,
      { id: Date.now(), cargo_name: '', cargo_type: undefined, package_count: null, package_unit: '', length_cm: null, width_cm: null, height_cm: null, weight: null }
    ]);
  };

  const handleRemoveCargoItem = (id) => {
    if (cargoItems.length <= 1) { message.warning('Đơn hàng cần tối thiểu 1 loại hàng hóa!'); return; }
    setCargoItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateCargoItem = (id, field, val) => {
    setCargoItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));
  };

  // Tính tổng trọng lượng
  const totals = useMemo(() => {
    let totalActual = 0, totalChargeable = 0, totalCount = 0;
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
        totalChargeable += Math.max(w, (l * wid * h) / 5000);
      }
    });
    return { actualWeight: totalActual.toFixed(2), chargeableWeight: totalChargeable.toFixed(2), totalCount };
  }, [cargoItems]);

  const estimatedBaselineRate = useMemo(() => {
    if (!routeInfo.distanceKm) return 0;
    const dist = routeInfo.distanceKm;
    const weight = parseFloat(totals.chargeableWeight) || 0;
    const base = Math.round((1500000 + dist * 45000 + weight * 850) / 50000) * 50000;
    const customs = customsServiceRequired ? CUSTOMS_SERVICE_FEE : 0;
    return base + customs;
  }, [routeInfo, totals.chargeableWeight, customsServiceRequired]);

  // Cập nhật giá thỏa thuận mặc định khi cước tham chiếu thay đổi
  useEffect(() => {
    if (estimatedBaselineRate > 0 && !form.isFieldTouched('agreed_price')) {
      form.setFieldsValue({ agreed_price: estimatedBaselineRate });
    }
  }, [estimatedBaselineRate, form]);

  const handleOk = () => {
    // Validate hàng hóa
    for (let i = 0; i < cargoItems.length; i++) {
      const it = cargoItems[i];
      if (!it.cargo_name?.trim()) { message.error(`Vui lòng nhập tên hàng cho mặt hàng #${i + 1}`); return; }
      if (!it.cargo_type) { message.error(`Vui lòng chọn loại hàng cho mặt hàng #${i + 1}`); return; }
      if (!it.weight || Number(it.weight) <= 0) { message.error(`Vui lòng nhập trọng lượng hợp lệ (> 0 kg) cho mặt hàng #${i + 1}`); return; }
    }

    form.validateFields().then((fieldValues) => {
      const primaryItem = cargoItems[0] || {};
      const cargoDescription = cargoItems
        .map(it => `${it.cargo_name}${it.package_count ? ` (${it.package_count} ${it.package_unit || 'kiện'})` : ''}`)
        .join(', ');

      onSubmit({
        ...fieldValues,
        shipping_direction: shippingDirection,
        customs_service_required: customsServiceRequired,
        customs_fee: customsServiceRequired ? CUSTOMS_SERVICE_FEE : 0,
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
    setCargoItems([{ id: 1, cargo_name: '', cargo_type: undefined, package_count: null, package_unit: '', length_cm: null, width_cm: null, height_cm: null, weight: null }]);
    setPickupCoords(null);
    setDeliveryCoords(null);
    setPickupMode('PRESET');
    setDeliveryMode('CUSTOM');
    setSelectedPickupPreset('ALS_NOI_BAI');
    setSelectedDeliveryPreset('ALS_NOI_BAI');
    setCustomsServiceRequired(false);
    onCancel();
  };

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        applyDirectionPreset('IMPORT');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Tạo đơn vận chuyển</h3>
            <p className="text-xs text-gray-500 font-normal">Điều phối viên tạo đơn trực tiếp</p>
          </div>
        </div>
      }
      open={open}
      destroyOnHidden={true}
      onOk={handleOk}
      onCancel={handleReset}
      width={960}
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
          address_same_as_customer: true,
          pickup_address: '',
          delivery_address: '',
          customer_address: '',
          vehicle_type_required: 'TRUCK_2T',
          loading_unloading_required: false
        }}
      >
        {/* ── PHẦN 1: Thông tin Khách hàng ── */}
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

          <Form.Item label="Địa chỉ" name="customer_address" className="sm:col-span-2 lg:col-span-3 mb-2">
            <Input 
              placeholder="Địa chỉ trụ sở hoặc văn phòng của khách hàng" 
              onChange={(e) => {
                const val = e.target.value;
                if (form.getFieldValue('address_same_as_customer')) {
                  if (shippingDirection === 'IMPORT') form.setFieldsValue({ delivery_address: val });
                  else form.setFieldsValue({ pickup_address: val });
                }
              }}
            />
          </Form.Item>

          <div className="sm:col-span-2 lg:col-span-3 flex items-center -mt-1 mb-1">
            <Form.Item name="is_new_customer" valuePropName="checked" className="mb-0">
              <Checkbox className="text-xs font-semibold text-indigo-600">Khách hàng mới</Checkbox>
            </Form.Item>
          </div>
        </div>

        {/* ── PHẦN 2: Điểm lấy hàng & Điểm giao hàng ── */}
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

        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4 space-y-3">
          {/* Chọn chiều vận chuyển */}
          <div className="p-2.5 bg-white rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-semibold text-gray-700">Chiều vận chuyển:</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => applyDirectionPreset('IMPORT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${shippingDirection === 'IMPORT' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              ><span>🛬</span><span>Nhập khẩu</span></button>
              <button type="button" onClick={() => applyDirectionPreset('EXPORT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${shippingDirection === 'EXPORT' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              ><span>🛫</span><span>Xuất khẩu</span></button>
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
                      <Form.Item name="pickup_address" rules={[{ required: true, message: 'Nhập địa chỉ lấy hàng' }]} className="mb-0">
                        <LocationSearchInput
                          label="Điểm lấy hàng của khách"
                          markerLetter="A"
                          markerColor="#2563eb"
                          placeholder="Gõ tìm địa chỉ lấy hàng..."
                          value={form.getFieldValue('pickup_address')}
                          onChange={(val) => { form.setFieldsValue({ pickup_address: val }); if (!val?.trim()) setPickupCoords(null); }}
                          onSelectLocation={(loc) => { if (loc?.lat && loc?.lng) { setPickupCoords({ lat: loc.lat, lng: loc.lng }); form.setFieldsValue({ pickup_address: loc.address }); } else { setPickupCoords(null); if (loc?.address) form.setFieldsValue({ pickup_address: loc.address }); } }}
                          required
                        />
                      </Form.Item>
                    </div>
                  )}
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
                            label="Địa chỉ kho bên ngoài của khách"
                            markerLetter="B"
                            markerColor="#10b981"
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
                      <Form.Item name="delivery_address" rules={[{ required: true, message: 'Nhập địa chỉ nhận hàng' }]} className="mb-0">
                        <LocationSearchInput
                          label="Điểm nhận hàng của khách"
                          markerLetter="B"
                          markerColor="#10b981"
                          placeholder="Gõ tìm địa chỉ nhận hàng..."
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

              {/* Bản đồ */}
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

            {/* ── PHẦN 3: Người liên hệ & Lịch trình & Loại xe ── */}
            <div className="flex items-center gap-2 mb-2">
              <Truck size={14} className="text-emerald-600" />
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                3. Thông tin liên hệ &amp; Lịch trình &amp; Loại xe
              </div>
            </div>
            <div className="bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Nhập khẩu: Tên, SĐT người nhận hàng */}
                {/* Xuất khẩu: Tên, SĐT người liên hệ */}
                <Form.Item 
                  label={
                    <span className="text-xs font-semibold">
                      {shippingDirection === 'IMPORT' ? 'Tên người nhận hàng' : 'Tên người liên hệ'} <span className="text-red-500">*</span>
                    </span>
                  }
                  name="receiver_name" 
                  rules={[{ required: true, message: shippingDirection === 'IMPORT' ? 'Nhập tên người nhận hàng' : 'Nhập tên người liên hệ' }]} 
                  className="mb-0"
                >
                  <Input 
                    placeholder={shippingDirection === 'IMPORT' ? 'Người nhận tại điểm giao' : 'Người liên hệ tại điểm gửi hàng'} 
                    className="text-xs" 
                  />
                </Form.Item>

                <Form.Item 
                  label={
                    <span className="text-xs font-semibold">
                      {shippingDirection === 'IMPORT' ? 'SĐT người nhận hàng' : 'SĐT người liên hệ'} <span className="text-red-500">*</span>
                    </span>
                  }
                  name="receiver_phone" 
                  rules={[{ required: true, message: shippingDirection === 'IMPORT' ? 'Nhập SĐT người nhận hàng' : 'Nhập SĐT người liên hệ' }]} 
                  className="mb-0"
                >
                  <Input 
                    placeholder={shippingDirection === 'IMPORT' ? 'SĐT liên hệ khi giao nhận' : 'SĐT người liên hệ gửi hàng'} 
                    className="text-xs" 
                  />
                </Form.Item>

                <Form.Item label={<span className="text-xs font-semibold">Ngày lấy hàng yêu cầu</span>}
                  name="required_pickup_date" className="mb-0">
                  <Input type="date" className="text-xs" min={new Date().toISOString().split('T')[0]} />
                </Form.Item>

                <Form.Item label={<span className="text-xs font-semibold">Loại xe yêu cầu</span>}
                  name="vehicle_type_required" className="mb-0">
                  <Select className="text-xs w-full">
                    <Option value="TRUCK_1T">🚐 Xe tải 1 tấn</Option>
                    <Option value="TRUCK_2T">🚛 Xe tải 2 tấn</Option>
                    <Option value="TRUCK_5T">🚛 Xe tải 5 tấn</Option>
                    <Option value="TRUCK_10T">🚛 Xe tải 10 tấn</Option>
                    <Option value="CONTAINER_20">📦 Container 20ft</Option>
                    <Option value="CONTAINER_40">📦 Container 40ft</Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="text-xs font-semibold">Yêu cầu bốc xếp?</span>}
                  name="loading_unloading_required" className="mb-0">
                  <Select className="text-xs w-full">
                    <Option value={false}>Không cần (tự bốc xếp)</Option>
                    <Option value={true}>Có — Cần nhân công bốc xếp</Option>
                  </Select>
                </Form.Item>
              </div>
            </div>

        {/* ── PHẦN 4: Hàng hóa ── */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
            <Package size={15} className="text-emerald-600" />
            4. Danh mục hàng hóa &amp; Quy cách ({cargoItems.length} mặt hàng)
          </div>
          <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddCargoItem}
            className="text-xs text-emerald-700 border-emerald-300 hover:border-emerald-500 font-semibold">
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
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">{index + 1}</span>
                    <span className="text-xs font-bold text-gray-800">Mặt hàng #{index + 1}</span>
                  </div>
                  {cargoItems.length > 1 && (
                    <Tooltip title="Xóa mặt hàng này">
                      <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={() => handleRemoveCargoItem(item.id)} className="p-1 h-auto" />
                    </Tooltip>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-2.5">
                  <div>
                    <div className="text-[11px] font-medium text-gray-600 mb-1">Tên hàng hóa *</div>
                    <Input placeholder="VD: Linh kiện, Nông sản..." value={item.cargo_name}
                      onChange={(e) => handleUpdateCargoItem(item.id, 'cargo_name', e.target.value)} className="text-xs" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-gray-600 mb-1">Loại hàng *</div>
                    <Select placeholder="Chọn loại hàng..." value={item.cargo_type}
                      onChange={(val) => handleUpdateCargoItem(item.id, 'cargo_type', val)} className="text-xs w-full" allowClear>
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
                      <InputNumber min={1} placeholder="Số lượng" value={item.package_count}
                        onChange={(val) => handleUpdateCargoItem(item.id, 'package_count', val)} className="w-full text-xs" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-gray-600 mb-1">Đơn vị</div>
                      <Input placeholder="Kiện, Pallet..." value={item.package_unit}
                        onChange={(e) => handleUpdateCargoItem(item.id, 'package_unit', e.target.value)} className="text-xs" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-gray-600 mb-1">Trọng lượng (kg) *</div>
                    <InputNumber min={0.1} value={item.weight} onChange={(val) => handleUpdateCargoItem(item.id, 'weight', val)}
                      placeholder="Nhập kg..." className="w-full text-xs font-semibold text-emerald-700" />
                  </div>
                </div>

                {!isBulk ? (
                  <div className="pt-2 border-t border-gray-150 grid grid-cols-3 gap-2">
                    <div><span className="text-[10px] text-gray-500">Dài (cm):</span>
                      <InputNumber min={1} placeholder="Dài..." value={item.length_cm} onChange={(val) => handleUpdateCargoItem(item.id, 'length_cm', val)} className="w-full text-xs" /></div>
                    <div><span className="text-[10px] text-gray-500">Rộng (cm):</span>
                      <InputNumber min={1} placeholder="Rộng..." value={item.width_cm} onChange={(val) => handleUpdateCargoItem(item.id, 'width_cm', val)} className="w-full text-xs" /></div>
                    <div><span className="text-[10px] text-gray-500">Cao (cm):</span>
                      <InputNumber min={1} placeholder="Cao..." value={item.height_cm} onChange={(val) => handleUpdateCargoItem(item.id, 'height_cm', val)} className="w-full text-xs" /></div>
                  </div>
                ) : (
                  <div className="pt-1.5 border-t border-gray-150 text-[11px] text-emerald-700 italic">
                    ℹ️ Hàng rời: Hệ thống tự động tính tải trọng trực tiếp theo trọng lượng thực ({Number(item.weight) || 0} kg)
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

        {/* ── PHẦN 5: Dịch vụ Hải quan & Cước phí vận chuyển ── */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center gap-1.5">
          <Calculator size={15} className="text-indigo-600" />
          5. Dịch vụ Hải quan &amp; Cước phí vận chuyển
        </div>

        {/* Khối đăng ký làm thủ tục hải quan hộ */}
        <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 p-3.5 rounded-xl border border-blue-200 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-lg mt-0.5">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 flex items-center gap-2">
                  Dịch vụ Làm thủ tục Hải quan hộ
                  <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                    +500.000 VNĐ / tờ khai
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Đội OPS chuyên nghiệp sẽ đại diện làm việc với hải quan cảng/ga, kiểm hóa và thông quan nhanh chóng.
                </p>
              </div>
            </div>

            <div className="sm:self-center shrink-0">
              <Checkbox
                checked={customsServiceRequired}
                onChange={(e) => setCustomsServiceRequired(e.target.checked)}
                className="font-semibold text-xs text-blue-900"
              >
                Tích chọn làm thủ tục hải quan hộ
              </Checkbox>
            </div>
          </div>
        </div>

        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-indigo-600" />
              <span className="text-xs text-gray-600">Cước tham chiếu theo lộ trình:</span>
              {customsServiceRequired && (
                <span className="text-[11px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                  (Đã gồm +500.000đ hải quan)
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-indigo-700">
              ~ {estimatedBaselineRate.toLocaleString()} VNĐ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Form.Item label="Giá cước thỏa thuận (VNĐ)" name="agreed_price" rules={[{ required: true, message: 'Nhập giá thỏa thuận' }]} className="mb-0">
              <InputNumber className="w-full font-bold text-blue-700"
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\$\s?|(,*)/g, '')} min={0} />
            </Form.Item>

            <Form.Item label="Phí phụ trội (VNĐ)" name="extra_fees_surcharge" className="mb-0">
              <InputNumber className="w-full text-indigo-700"
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\$\s?|(,*)/g, '')} min={0} />
            </Form.Item>

            <Form.Item label="Phí phát sinh (VNĐ)" name="extra_fees_collection" className="mb-0">
              <InputNumber className="w-full text-emerald-700"
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\$\s?|(,*)/g, '')} min={0} />
            </Form.Item>
          </div>
        </div>

        {/* Ghi chú */}
        <Form.Item label="Ghi chú vận hành" name="order_notes" className="mb-0">
          <Input.TextArea rows={2} placeholder="Ghi chú cho tài xế, yêu cầu đặc biệt về bốc xếp, nhiệt độ bảo quản..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default OrderFormModal;