import { useState, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, Select, Button, message, Result } from 'antd';
import { Send, MapPin, Package, User } from 'lucide-react';
import RouteMapPicker from '../common/RouteMapPicker';
import LocationSearchInput from '../common/LocationSearchInput';
import { orderApi } from '../../api/orderApi';

const { Option } = Select;

const ConsultationBookingModal = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Tọa độ định vị lộ trình
  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState({ distanceKm: 0, durationMins: 0 });

  const values = Form.useWatch([], form);

  // Tính Chargeable weight
  const chargeableWeight = useMemo(() => {
    if (!values) return '0.00';
    const { length_cm, width_cm, height_cm, weight, cargo_type } = values;
    if (cargo_type === 'BULK') {
      return (Number(weight) || 0).toFixed(2);
    }
    if (length_cm && width_cm && height_cm) {
      const vol = (length_cm * width_cm * height_cm) / 5000;
      return Math.max(Number(weight) || 0, vol).toFixed(2);
    }
    return (Number(weight) || 0).toFixed(2);
  }, [values]);

  const handleSubmit = async () => {
    try {
      const formValues = await form.validateFields();
      setSubmitting(true);
      const isBulk = formValues.cargo_type === 'BULK';
      const newOrder = await orderApi.createConsultationOrder({
        ...formValues,
        length_cm: isBulk ? 0 : (formValues.length_cm || 0),
        width_cm: isBulk ? 0 : (formValues.width_cm || 0),
        height_cm: isBulk ? 0 : (formValues.height_cm || 0),
        chargeable_weight: parseFloat(chargeableWeight) || (Number(formValues.weight) || 0),
        pickup_coords: pickupCoords,
        delivery_coords: deliveryCoords,
        estimated_distance_km: routeInfo.distanceKm,
        estimated_duration_mins: routeInfo.durationMins
      });
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
    setSubmittedOrder(null);
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleReset}
      footer={null}
      width={800}
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
                <p>
                  Mã đơn nháp đã khởi tạo: <b className="text-indigo-600 font-mono text-base">{submittedOrder.order_id}</b>
                </p>
                <p className="bg-indigo-50 p-3 rounded-lg text-indigo-900 text-xs">
                  Yêu cầu của bạn đã được chuyển tới Điều phối viên NEXLOG. Chúng tôi sẽ liên hệ lại qua SĐT <b>{submittedOrder.customer_phone}</b> để tư vấn lộ trình và chốt giá cước trong ít phút!
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
              Điền thông tin lô hàng để hệ thống tính khoảng cách và điều phối viên liên hệ báo giá ưu đãi
            </p>
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              package_unit: '',
              package_count: 1,
              pickup_address: '',
              delivery_address: ''
            }}
          >
            {/* 1. Thông tin liên hệ */}
            <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
              <User size={14} className="text-indigo-600" /> 1. Thông tin liên hệ
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
              <Form.Item label="Họ tên / Doanh nghiệp" name="customer_name" rules={[{ required: true, message: 'Vui lòng nhập tên' }]} className="mb-0">
                <Input placeholder="VD: Công ty TNHH ADTEK" className="text-xs" />
              </Form.Item>
              <Form.Item label="Số điện thoại" name="customer_phone" rules={[{ required: true, message: 'Nhập số điện thoại' }]} className="mb-0">
                <Input placeholder="VD: 0988 123 456" className="text-xs font-semibold" />
              </Form.Item>
              <Form.Item label="Email" name="customer_email" rules={[{ type: 'email', message: 'Email hợp lệ' }]} className="mb-0">
                <Input placeholder="contact@company.com" className="text-xs" />
              </Form.Item>
            </div>

            {/* 2. Địa điểm giao nhận & Bản đồ */}
            <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
              <MapPin size={14} className="text-blue-600" /> 2. Địa điểm lấy hàng &amp; Giao hàng
            </div>
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Điểm lấy hàng */}
                <Form.Item name="pickup_address" rules={[{ required: true, message: 'Vui lòng nhập địa điểm lấy hàng' }]} className="mb-0">
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

                {/* Điểm giao hàng */}
                <Form.Item name="delivery_address" rules={[{ required: true, message: 'Vui lòng nhập địa điểm giao hàng' }]} className="mb-0">
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

              {/* Bản đồ tương tác trực quan */}
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <RouteMapPicker
                  pickupAddress={values?.pickup_address || form.getFieldValue('pickup_address')}
                  deliveryAddress={values?.delivery_address || form.getFieldValue('delivery_address')}
                  pickupCoords={pickupCoords}
                  deliveryCoords={deliveryCoords}
                  onRouteChange={setRouteInfo}
                  height={190}
                />
              </div>
            </div>

            {/* 3. Thông tin hàng hóa */}
            <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
              <Package size={14} className="text-emerald-600" /> 3. Thông tin hàng hóa &amp; Quy cách
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2.5">
                <Form.Item label="Tên hàng hóa" name="cargo_name" rules={[{ required: true, message: 'Nhập tên hàng' }]} className="mb-0">
                  <Input placeholder="VD: Linh kiện điện tử, Hàng xá..." className="text-xs" />
                </Form.Item>
                <Form.Item label="Loại hàng" name="cargo_type" rules={[{ required: true, message: 'Vui lòng chọn loại hàng' }]} className="mb-0">
                  <Select className="text-xs" placeholder="Chọn loại hàng...">
                    <Option value="PALLET">Hàng Pallet (Tính kích thước &amp; trọng tải)</Option>
                    <Option value="BULK">Hàng rời (Xếp tính theo trọng tải)</Option>
                    <Option value="GENERAL">Hàng bách hóa thông thường</Option>
                    <Option value="FRAGILE">Hàng điện tử dễ vỡ</Option>
                    <Option value="VALUABLE">Hàng giá trị cao (Niêm chì)</Option>
                    <Option value="OTHER">Khác</Option>
                  </Select>
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                  <Form.Item label="Số lượng" name="package_count" rules={[{ required: true, message: 'Nhập số lượng' }]} className="mb-0">
                    <InputNumber min={1} className="w-full" />
                  </Form.Item>
                  <Form.Item label="Đơn vị" name="package_unit" rules={[{ required: true, message: 'Nhập đơn vị' }]} className="mb-0">
                    <Input placeholder="VD: Kiện, Pallet, Tấn..." className="text-xs" />
                  </Form.Item>
                </div>
              </div>

              {values?.cargo_type === 'OTHER' && (
                <div className="mb-2.5">
                  <Form.Item label="Chi tiết loại hàng khác" name="other_cargo_type" rules={[{ required: true, message: 'Vui lòng mô tả loại hàng' }]} className="mb-0">
                    <Input placeholder="VD: Hóa chất lỏng, Thép cuộn công nghiệp..." className="text-xs" />
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

              {/* Hàng rời -> Chỉ tính theo trọng tải xe */}
              {values?.cargo_type === 'BULK' && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <Form.Item 
                      label="Trọng tải hàng rời (kg)" 
                      name="weight" 
                      rules={[{ required: true, message: 'Vui lòng nhập trọng tải' }]} 
                      className="mb-0"
                    >
                      <InputNumber min={0.1} className="w-full font-semibold text-emerald-700" placeholder="VD: 5000" />
                    </Form.Item>
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800">
                      <span>Quy cách: </span>
                      <b className="text-emerald-700 font-bold">{values?.weight || 0} kg</b> (Hàng rời xếp tính theo trọng tải xe)
                    </div>
                  </div>
                </div>
              )}

              {/* Hàng Pallet / Đóng kiện -> Bắt buộc nhập cả Dài, Rộng, Cao & Trọng tải */}
              {values?.cargo_type && values?.cargo_type !== 'BULK' && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    <Form.Item label="Dài (cm)" name="length_cm" rules={[{ required: true, message: 'Bắt buộc' }]} className="mb-0">
                      <InputNumber min={1} className="w-full" placeholder="Dài" />
                    </Form.Item>
                    <Form.Item label="Rộng (cm)" name="width_cm" rules={[{ required: true, message: 'Bắt buộc' }]} className="mb-0">
                      <InputNumber min={1} className="w-full" placeholder="Rộng" />
                    </Form.Item>
                    <Form.Item label="Cao (cm)" name="height_cm" rules={[{ required: true, message: 'Bắt buộc' }]} className="mb-0">
                      <InputNumber min={1} className="w-full" placeholder="Cao" />
                    </Form.Item>
                    <Form.Item label="Trọng lượng (kg)" name="weight" rules={[{ required: true, message: 'Bắt buộc' }]} className="mb-0">
                      <InputNumber min={0.1} className="w-full" placeholder="Kg" />
                    </Form.Item>
                  </div>

                  <div className="mt-2 text-right text-xs text-gray-500">
                    Tải trọng tính cước ước tính: <b className="text-amber-600 font-bold">{chargeableWeight} kg</b>
                  </div>
                </div>
              )}
            </div>

            {/* Ghi chú thêm */}
            <Form.Item label="Ghi chú yêu cầu đặc biệt (nếu có):" name="notes" className="mb-4">
              <Input.TextArea rows={2} placeholder="Thời gian lấy hàng mong muốn, yêu cầu nâng hạ bốc xếp..." className="text-xs" />
            </Form.Item>

            {/* Nút hành động */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
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