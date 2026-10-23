import { useState, useMemo, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Checkbox, Button, message, Result, Tooltip } from 'antd';
import { Send, MapPin, Package, User, Plus, Trash2, FileText, ShieldCheck } from 'lucide-react';
import LocationSearchInput from '../common/LocationSearchInput';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';
import { calculateRouteEstimate, ALS_NOI_BAI_TERMINAL } from '../../data/dispatcherPresets';

const { Option } = Select;

const CUSTOMS_SERVICE_FEE = 500000; // Phí dịch vụ làm thủ tục hải quan hộ (VNĐ)

const ConsultationBookingModal = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dbLocations, setDbLocations] = useState([]);
  
  // Quản lý chế độ chọn địa điểm: 'PRESET' (chọn từ danh mục kho có sẵn) hoặc 'CUSTOM' (nhập địa chỉ kho riêng)
  const [pickupMode, setPickupMode] = useState('PRESET');
  const [deliveryMode, setDeliveryMode] = useState('CUSTOM');
  const [selectedPickupPreset, setSelectedPickupPreset] = useState('ALS_NOI_BAI');
  const [selectedDeliveryPreset, setSelectedDeliveryPreset] = useState('ALS_NOI_BAI');
  const [customsServiceRequired, setCustomsServiceRequired] = useState(false);
  
  // Khởi tạo tọa độ mặc định ban đầu là Nhập khẩu: Lấy hàng từ Ga ALS Nội Bài
  const [pickupCoords, setPickupCoords] = useState({ lat: 21.2187, lng: 105.8042 });
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

  // Danh sách nhiều loại hàng hóa (Multiple Cargo Items)
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

  // Chiều vận chuyển: IMPORT (Nhập khẩu) hoặc EXPORT (Xuất khẩu)
  const [shippingDirection, setShippingDirection] = useState('IMPORT');

  const handleDirectionChange = (val) => {
    setShippingDirection(val);
    form.setFieldsValue({ shipping_direction: val });
    if (val === 'IMPORT') {
      // Nhập khẩu: Lấy hàng từ kho ALS (hoặc kho hệ thống), giao về địa chỉ khách
      setPickupMode('PRESET');
      setSelectedPickupPreset('ALS_NOI_BAI');
      form.setFieldsValue({
        pickup_address: 'Kho ALS tại Sân Bay Nội Bài',
        delivery_address: ''
      });
      setPickupCoords({ lat: 21.2187, lng: 105.8042 });
      setDeliveryCoords(null);
      setDeliveryMode('CUSTOM');
    } else {
      // Xuất khẩu: Lấy hàng từ địa chỉ khách, giao đến kho ALS (hoặc kho hệ thống)
      setDeliveryMode('PRESET');
      setSelectedDeliveryPreset('ALS_NOI_BAI');
      form.setFieldsValue({
        pickup_address: '',
        delivery_address: 'Kho ALS tại Sân Bay Nội Bài'
      });
      setPickupCoords(null);
      setDeliveryCoords({ lat: 21.2187, lng: 105.8042 });
      setPickupMode('CUSTOM');
    }
  };

  // Xử lý khi chọn từ dropdown địa điểm điểm lấy
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

  // Xử lý khi chọn từ dropdown địa điểm điểm giao
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

  // Ước tính cự ly ngầm khi có tọa độ
  const routeInfo = useMemo(() => {
    if (pickupCoords?.lat && pickupCoords?.lng && deliveryCoords?.lat && deliveryCoords?.lng) {
      return calculateRouteEstimate(pickupCoords.lat, pickupCoords.lng, deliveryCoords.lat, deliveryCoords.lng);
    }
    return { distanceKm: 0, durationMins: 0 };
  }, [pickupCoords, deliveryCoords]);

  // Tính tổng trọng lượng thực & trọng lượng tính cước của tất cả các mặt hàng
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

  // Ước tính giá cước bao gồm phí dịch vụ hải quan (nếu tích chọn)
  const estimatedPricing = useMemo(() => {
    if (!routeInfo.distanceKm) return { baselineRate: 0, customsFee: 0, totalRate: 0 };
    const dist = routeInfo.distanceKm;
    const weight = parseFloat(totals.chargeableWeight) || 0;
    const base = Math.round((1500000 + dist * 45000 + weight * 850) / 50000) * 50000;
    const customs = customsServiceRequired ? CUSTOMS_SERVICE_FEE : 0;
    return {
      baselineRate: base,
      customsFee: customs,
      totalRate: base + customs
    };
  }, [routeInfo, totals.chargeableWeight, customsServiceRequired]);

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

  const handleRemoveCargoItem = (id) => {
    if (cargoItems.length <= 1) {
      message.warning('Đơn hàng cần tối thiểu 1 loại hàng hóa!');
      return;
    }
    setCargoItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateCargoItem = (id, field, value) => {
    setCargoItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const handleSubmit = async () => {
    try {
      const formValues = await form.validateFields();
      
      // Kiểm tra tính hợp lệ của danh sách hàng hóa
      for (let i = 0; i < cargoItems.length; i++) {
        const it = cargoItems[i];
        if (!it.cargo_name || !it.cargo_name.trim()) {
          message.error(`Vui lòng nhập tên hàng hóa cho mặt hàng #${i + 1}`);
          return;
        }
        if (!it.cargo_type) {
          message.error(`Vui lòng chọn loại hàng cho mặt hàng #${i + 1}`);
          return;
        }
        if (!it.weight || it.weight <= 0) {
          message.error(`Vui lòng nhập trọng lượng hợp lệ cho mặt hàng #${i + 1}`);
          return;
        }
      }

      setSubmitting(true);

      const payload = {
        ...formValues,
        shipping_direction: shippingDirection,
        customs_service_required: customsServiceRequired,
        customs_fee: customsServiceRequired ? CUSTOMS_SERVICE_FEE : 0,
        estimated_price: estimatedPricing.totalRate,
        items: cargoItems,
        cargo_name: cargoItems.map(it => `${it.cargo_name} (${it.package_count} ${it.package_unit})`).join(', '),
        cargo_type: cargoItems[0]?.cargo_type || 'GENERAL',
        package_count: totals.totalCount,
        package_unit: cargoItems.length > 1 ? 'Loại hàng kết hợp' : (cargoItems[0]?.package_unit || 'Kiện'),
        weight: parseFloat(totals.actualWeight),
        chargeable_weight: parseFloat(totals.chargeableWeight),
        length_cm: cargoItems[0]?.length_cm || 0,
        width_cm: cargoItems[0]?.width_cm || 0,
        height_cm: cargoItems[0]?.height_cm || 0,
        pickup_coords: pickupCoords,
        delivery_coords: deliveryCoords,
        estimated_distance_km: routeInfo.distanceKm,
        estimated_duration_mins: routeInfo.durationMins
      };

      const newOrder = await orderApi.createConsultationOrder(payload);
      setSubmittedOrder(newOrder);
      if (onSuccess) onSuccess(newOrder);
      window.dispatchEvent(new Event('nexlog_orders_updated'));
      message.success('Đã gửi yêu cầu tư vấn thành công tới hệ thống!');
    } catch (err) {
      console.error('Submit error:', err);
      message.error(err.message || 'Không thể gửi yêu cầu tư vấn');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setShippingDirection('IMPORT');
    setPickupMode('PRESET');
    setDeliveryMode('CUSTOM');
    setSelectedPickupPreset('ALS_NOI_BAI');
    setSelectedDeliveryPreset('ALS_NOI_BAI');
    setCustomsServiceRequired(false);
    setPickupCoords({ lat: 21.2187, lng: 105.8042 });
    setDeliveryCoords(null);
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
    setSubmittedOrder(null);
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleReset}
      destroyOnHidden={true}
      footer={null}
      width={880}
      centered
      className="consultation-modal"
    >
      {submittedOrder ? (
        <div className="py-6 text-center">
          <Result
            status="success"
            title={<span className="text-xl font-bold text-gray-800">Gửi Yêu Cầu Vận Chuyển Thành Công!</span>}
            subTitle={
              <div className="text-sm text-gray-600 max-w-md mx-auto space-y-2 mt-2">
                <p className="bg-indigo-50 p-3 rounded-lg text-indigo-900 text-xs">
                  Yêu cầu của bạn đã được chuyển tới Điều phối viên NEXLOG. Chúng tôi sẽ liên hệ lại qua SĐT <b>{submittedOrder.customer_phone}</b> để tư vấn lộ trình và chốt giá cước trong ít phút!
                </p>
                <p className="text-xs text-gray-400">
                  Mã đơn hàng: <b className="font-mono text-indigo-600">{submittedOrder.order_id}</b>
                </p>
              </div>
            }
            extra={[
              <Button type="primary" key="close" className="bg-[#7367f0] px-6 h-9" onClick={handleReset}>
                Hoàn tất
              </Button>
            ]}
          />
        </div>
      ) : (
        <div className="py-2">
          {/* Header */}
          <div className="border-b border-gray-100 pb-3 mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Send size={18} /></span>
              Đăng ký nhận tư vấn &amp; Báo giá vận chuyển
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Điền thông tin lô hàng để điều phối viên liên hệ tư vấn lộ trình và báo giá ưu đãi
            </p>
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              shipping_direction: 'IMPORT',
              pickup_address: 'Nhà Ga Hàng Hóa ALS Nội Bài',
              delivery_address: '',
              customer_tax_code: '',
              loading_unloading_required: false
            }}
          >
            {/* ── PHẦN 1: Thông tin liên hệ & Doanh nghiệp ── */}
            <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
              <User size={14} className="text-indigo-600" /> 1. Thông tin liên hệ &amp; Doanh nghiệp
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
              <Form.Item label="Họ tên / Doanh nghiệp" name="customer_name" rules={[{ required: true, message: 'Vui lòng nhập tên' }]} className="mb-0">
                <Input placeholder="VD: Công ty TNHH ADTEK" className="text-xs" />
              </Form.Item>
              <Form.Item label="Mã số thuế" name="customer_tax_code" className="mb-0">
                <Input placeholder="VD: 0101234567" className="text-xs font-mono" />
              </Form.Item>
              <Form.Item label="Số điện thoại" name="customer_phone" rules={[{ required: true, message: 'Nhập số điện thoại' }]} className="mb-0">
                <Input placeholder="VD: 0988 123 456" className="text-xs font-semibold" />
              </Form.Item>
              <Form.Item label="Email" name="customer_email" rules={[{ required: true, type: 'email', message: 'Email hợp lệ để nhận hợp đồng' }]} className="mb-0">
                <Input placeholder="contact@company.com" className="text-xs" />
              </Form.Item>
            </div>

            {/* ── PHẦN 2: Luồng vận chuyển & Địa điểm ── */}
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

            {/* ── PHẦN 3: Thông tin Người nhận & Thời gian ── */}
            <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
              <span>👤</span> 3. Thông tin người nhận &amp; Thời gian giao hàng
            </div>
            <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  label={<span className="text-xs font-semibold">Ngày giao hàng yêu cầu</span>}
                  name="required_delivery_date"
                  className="mb-0"
                >
                  <Input
                    type="date"
                    className="text-xs"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="text-xs font-semibold">Yêu cầu bốc xếp hàng?</span>}
                  name="loading_unloading_required"
                  className="mb-0"
                >
                  <Select className="text-xs w-full">
                    <Option value={false}>Không cần (tự bốc xếp)</Option>
                    <Option value={true}>Có — Cần nhân công bốc xếp</Option>
                  </Select>
                </Form.Item>
              </div>
              <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100">
                ℹ️ Thông tin người nhận và deadline giúp điều phối viên ưu tiên và lên kế hoạch xe chính xác hơn.
              </div>
            </div>

            {/* ── PHẦN 4: Danh mục hàng hóa ── */}
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

            {/* ── PHẦN 5: Dịch vụ Hải quan ── */}
            <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 p-3 rounded-xl border border-blue-200 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                  <ShieldCheck size={16} />
                </div>
                <span className="text-xs font-bold text-gray-800">
                  Làm Dịch vụ làm thủ tục hải quan
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                  +500.000 VNĐ / tờ khai
                </span>
              </div>

              <div>
                <Checkbox checked={customsServiceRequired} onChange={(e) => setCustomsServiceRequired(e.target.checked)} />
              </div>
            </div>

            {/* Ghi chú thêm */}
            <Form.Item label="Ghi chú yêu cầu đặc biệt (nếu có):" name="notes" className="mb-4">
              <Input.TextArea rows={2} placeholder="Thời gian lấy hàng mong muốn, yêu cầu nhiệt độ bảo quản, ghi chú lộ trình... (để trống nếu không có)" className="text-xs" />
            </Form.Item>

            {/* Nút hành động */}
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-gray-100">
              <Button onClick={handleReset}>Đóng</Button>
              <Button 
                type="primary" 
                onClick={handleSubmit} 
                loading={submitting}
                icon={<Send size={15} />} 
                className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold px-6"
              >
                Gửi yêu cầu vận chuyển
              </Button>
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
};

export default ConsultationBookingModal;