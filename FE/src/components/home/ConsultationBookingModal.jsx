import { useState, useMemo, useEffect } from 'react';
import { Modal, Form, Input, Checkbox, Button, message, Result } from 'antd';
import { Send, User, ShieldCheck } from 'lucide-react';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';
import { calculateRouteEstimate, calculateAlsPricing, calculateExportPickupSuggestion, analyzeVehicleRecommendation } from '../../data/dispatcherPresets';
import { ConsultationRouteSection } from './consultation/ConsultationRouteSection';
import { ConsultationReceiverSection, ConsultationCargoSection } from './consultation/ConsultationSections';

const CUSTOMS_SERVICE_FEE = 500000;

const ConsultationBookingModal = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dbLocations, setDbLocations] = useState([]);
  
  // Quản lý chế độ chọn địa điểm: 'PRESET' hoặc 'CUSTOM'
  const [pickupMode, setPickupMode] = useState('PRESET');
  const [deliveryMode, setDeliveryMode] = useState('CUSTOM');
  const [selectedPickupPreset, setSelectedPickupPreset] = useState('ALS_NOI_BAI');
  const [selectedDeliveryPreset, setSelectedDeliveryPreset] = useState('ALS_NOI_BAI');
  const [customsServiceRequired, setCustomsServiceRequired] = useState(false);
  
  // Khởi tạo tọa độ mặc định ban đầu: Ga ALS Nội Bài
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

  // Chiều vận chuyển: IMPORT hoặc EXPORT
  const [shippingDirection, setShippingDirection] = useState('IMPORT');

  const handleDirectionChange = (val) => {
    setShippingDirection(val);
    form.setFieldsValue({ shipping_direction: val });
    if (val === 'IMPORT') {
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

  // Tính tổng trọng lượng thực & trọng lượng tính cước
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

  const watchedValues = Form.useWatch([], form);

  // Phân tích gợi ý loại xe tự động
  const vehicleRecommendation = useMemo(() => {
    return analyzeVehicleRecommendation({
      actualWeightKg: parseFloat(totals.actualWeight) || 0,
      chargeableWeightKg: parseFloat(totals.chargeableWeight) || 0,
      items: cargoItems,
      customerRequestedVehicle: watchedValues?.vehicle_type_required || 'TRUCK_2.5T'
    });
  }, [totals.actualWeight, totals.chargeableWeight, cargoItems, watchedValues?.vehicle_type_required]);

  // Ước tính giá cước chính xác theo Biểu giá chuẩn ALS
  const estimatedPricing = useMemo(() => {
    return calculateAlsPricing({
      distanceKm: routeInfo.distanceKm,
      chargeableWeightKg: parseFloat(totals.chargeableWeight) || 0,
      vehicleType: watchedValues?.vehicle_type_required || 'TRUCK_2.5T',
      timeSlot: watchedValues?.operating_time_slot || 'FULL_DAY',
      pickupAddress: watchedValues?.pickup_address || (form.getFieldValue('pickup_address') || ''),
      deliveryAddress: watchedValues?.delivery_address || (form.getFieldValue('delivery_address') || ''),
      loadingUnloadingRequired: watchedValues?.loading_unloading_required === true,
      customsServiceRequired: customsServiceRequired
    });
  }, [
    routeInfo.distanceKm,
    totals.chargeableWeight,
    watchedValues?.vehicle_type_required,
    watchedValues?.operating_time_slot,
    watchedValues?.pickup_address,
    watchedValues?.delivery_address,
    watchedValues?.loading_unloading_required,
    customsServiceRequired,
    form
  ]);

  const flightDatetime = watchedValues?.flight_datetime;
  const exportPickupSuggestion = useMemo(() => {
    if (shippingDirection !== 'EXPORT' || !flightDatetime) return null;
    return calculateExportPickupSuggestion(flightDatetime, routeInfo.distanceKm || 30);
  }, [shippingDirection, flightDatetime, routeInfo.distanceKm]);

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

      const resolvedPickupAddr =
        formValues.pickup_address ||
        form.getFieldValue('pickup_address') ||
        (shippingDirection === 'IMPORT' ? 'Nhà Ga Hàng Hóa ALS Nội Bài' : '');
      const resolvedDeliveryAddr =
        formValues.delivery_address ||
        form.getFieldValue('delivery_address') ||
        (shippingDirection === 'EXPORT' ? 'Nhà Ga Hàng Hóa ALS Nội Bài' : '');

      const payload = {
        ...formValues,
        pickup_address: resolvedPickupAddr,
        delivery_address: resolvedDeliveryAddr,
        required_pickup_date: shippingDirection === 'IMPORT' 
          ? (formValues.flight_arrival_date || formValues.required_pickup_date || null)
          : (formValues.required_pickup_date || null),
        required_delivery_date: formValues.required_pickup_date || null,
        flight_arrival_date: formValues.flight_arrival_date || null,
        flight_arrival_time: formValues.flight_arrival_time || null,
        flight_datetime: formValues.flight_datetime || null,
        export_pickup_suggestion: exportPickupSuggestion?.latestPickupFormatted || null,
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
              vehicle_type_required: 'TRUCK_2.5T',
              operating_time_slot: 'FULL_DAY',
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
            <ConsultationRouteSection
              shippingDirection={shippingDirection}
              handleDirectionChange={handleDirectionChange}
              selectedPickupPreset={selectedPickupPreset}
              handleSelectPickupPreset={handleSelectPickupPreset}
              dbLocations={dbLocations}
              pickupMode={pickupMode}
              form={form}
              setPickupCoords={setPickupCoords}
              selectedDeliveryPreset={selectedDeliveryPreset}
              handleSelectDeliveryPreset={handleSelectDeliveryPreset}
              deliveryMode={deliveryMode}
              setDeliveryCoords={setDeliveryCoords}
            />

            {/* ── PHẦN 3: Thông tin Người nhận & Loại xe ── */}
            <ConsultationReceiverSection
              watchedValues={watchedValues}
              totals={totals}
              vehicleRecommendation={vehicleRecommendation}
              form={form}
            />

            {/* ── PHẦN 4: Danh mục hàng hóa ── */}
            <ConsultationCargoSection
              cargoItems={cargoItems}
              totals={totals}
              handleAddCargoItem={handleAddCargoItem}
              handleRemoveCargoItem={handleRemoveCargoItem}
              handleUpdateCargoItem={handleUpdateCargoItem}
            />

            {/* ── PHẦN 5: Dịch vụ Hải quan ── */}
            <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 p-3 rounded-xl border border-blue-200 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                  <ShieldCheck size={16} />
                </div>
                <span className="text-xs font-bold text-gray-800">
                  Dịch vụ làm thủ tục hải quan
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
