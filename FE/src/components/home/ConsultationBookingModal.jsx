import { useState, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, Select, Button, message, Result, Space, Tooltip } from 'antd';
import { Send, MapPin, Package, User, Plus, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import LocationSearchInput from '../common/LocationSearchInput';
import { orderApi } from '../../api/orderApi';
import { calculateRouteEstimate } from '../../data/dispatcherPresets';

const { Option } = Select;

const ConsultationBookingModal = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Tọa độ định vị lộ trình
  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);

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
      width={840}
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
              pickup_address: '',
              delivery_address: '',
              customer_tax_code: ''
            }}
          >
            {/* 1. Thông tin liên hệ & Mã số thuế */}
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

            {/* 2. Địa điểm lấy hàng & Giao hàng */}
            <div className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
              <MapPin size={14} className="text-blue-600" /> 2. Địa điểm lấy hàng &amp; Giao hàng
            </div>
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 mb-4">
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
            </div>

            {/* 3. Thông tin hàng hóa & Nút Thêm hàng hóa (Nhiều loại hàng) */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                <Package size={14} className="text-emerald-600" /> 3. Danh mục hàng hóa &amp; Quy cách ({cargoItems.length} mặt hàng)
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

            {/* Ghi chú thêm - CHỈ HIỂN THỊ NẾU KHÁCH NHẬP */}
            <Form.Item label="Ghi chú yêu cầu đặc biệt (nếu có):" name="notes" className="mb-4">
              <Input.TextArea rows={2} placeholder="Thời gian lấy hàng mong muốn, yêu cầu nâng hạ bốc xếp (để trống nếu không có)..." className="text-xs" />
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