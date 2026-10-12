import { useState, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Select, Checkbox, Tooltip } from 'antd';
import { Sparkles, FileText, CheckCircle2, ShieldAlert, HelpCircle } from 'lucide-react';
import { SAMPLE_ORDER_PRESETS, DOCUMENT_TYPES } from '../../data/dispatcherPresets';

const { Option } = Select;

const OrderFormModal = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm();
  const [noDocsRequired, setNoDocsRequired] = useState(false);
  const [activePreset, setActivePreset] = useState(null);

  // Watch for dimension changes to auto-calculate chargeable weight (BR-02)
  const values = Form.useWatch([], form);

  // BR-02: Tính trực tiếp Max giữa Trọng lượng thực tế và Trọng lượng quy đổi (D*R*C/5000)
  const chargeableWeight = useMemo(() => {
    if (!values) return '0.00';
    const { length_cm, width_cm, height_cm, weight_kg } = values;
    if (length_cm && width_cm && height_cm) {
      const volumeWeight = (length_cm * width_cm * height_cm) / 5000;
      return Math.max(weight_kg || 0, volumeWeight).toFixed(2);
    }
    return (weight_kg || 0).toFixed(2);
  }, [values]);

  const applyPreset = (presetKey) => {
    const preset = SAMPLE_ORDER_PRESETS.find(p => p.key === presetKey);
    if (!preset) return;
    setActivePreset(presetKey);
    setNoDocsRequired(false);
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
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Tạo Đơn Hàng Vận Tải Mới (Order Intake)</h3>
            <p className="text-xs text-gray-500 font-normal">Tiếp nhận đơn, chốt giá thỏa thuận & thiết lập chứng từ hải quan bắt buộc</p>
          </div>
        </div>
      }
      open={open}
      onOk={handleOk}
      onCancel={() => {
        onCancel();
        setActivePreset(null);
      }}
      width={860}
      okText="Xác nhận Tạo Đơn Nháp"
      cancelText="Đóng"
      okButtonProps={{ className: "bg-[#7367f0] hover:bg-[#5e50ee] font-semibold h-9 px-5" }}
      cancelButtonProps={{ className: "h-9 px-4" }}
    >
      {/* Nút bấm Chọn Dữ liệu mẫu thực tế */}
      <div className="mt-3 mb-4 p-3.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500 fill-amber-400" />
            Nạp nhanh hồ sơ mẫu thực tế (Adtek & Lô 2):
          </span>
          <span className="text-xs text-gray-500">Tự động điền đầy đủ dữ liệu & chứng từ mẫu</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SAMPLE_ORDER_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                activePreset === preset.key 
                  ? 'border-indigo-500 bg-white shadow-sm ring-2 ring-indigo-200' 
                  : 'border-blue-200 bg-white/70 hover:bg-white hover:border-indigo-300'
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
          is_stackable: true, 
          cargo_type: 'GENERAL',
          package_unit: 'Pallet',
          package_count: 1,
          required_documents: ['CUSTOMS_DECLARATION', 'DELIVERY_ORDER', 'COMMERCIAL_INVOICE', 'PACKING_LIST']
        }}
      >
        {/* Phân vùng 1: Thông tin Khách hàng & Mã HAWB */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center gap-2">
          <span>1. Thông tin Khách hàng & Mã Vận Đơn (HAWB)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <Form.Item label="Khách hàng / Doanh nghiệp" name="customer_name" rules={[{ required: true, message: 'Nhập tên khách hàng' }]} className="lg:col-span-2 mb-2">
            <Input placeholder="VD: ADTEK VIETNAM CO., LTD" />
          </Form.Item>
          <Form.Item label="Mã HAWB / Số vận đơn" name="hawb_code" rules={[{ required: true, message: 'Nhập mã HAWB' }]} className="mb-2">
            <Input placeholder="VD: HNAE25090222" className="font-mono text-indigo-700 font-semibold" />
          </Form.Item>
          <Form.Item label="Mã số thuế Doanh nghiệp" name="customer_tax_code" className="mb-2">
            <Input placeholder="VD: 2300987654" />
          </Form.Item>
          <Form.Item label="Số điện thoại liên hệ" name="customer_phone" rules={[{ required: true, message: 'Nhập SĐT' }]} className="mb-0">
            <Input placeholder="0977887918" />
          </Form.Item>
          <Form.Item label="Email nhận Tracking Link" name="customer_email" rules={[{ required: true, type: 'email', message: 'Email hợp lệ' }]} className="mb-0">
            <Input placeholder="ops@company.com" />
          </Form.Item>
          <Form.Item label="Nhà máy / Bộ phận giao" name="factory_name" className="lg:col-span-2 mb-0">
            <Input placeholder="VD: Nhà máy ADTEK KCN Tiên Sơn / Kho ngoại quan Nội Bài" />
          </Form.Item>
        </div>

        {/* Phân vùng 2: Tuyến đường Giao Nhận */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center gap-2">
          <span>2. Địa điểm Lấy hàng & Điểm Giao nhận</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <Form.Item label="Điểm lấy hàng (Kho ALS / Nhà máy xuất phát)" name="pickup_address" rules={[{ required: true, message: 'Nhập điểm lấy' }]} className="mb-0">
            <Input.TextArea rows={2} placeholder="Nhập địa chỉ chi tiết hoặc chọn Kho ALS Nội Bài, KCN Tiên Sơn..." />
          </Form.Item>
          <Form.Item label="Điểm giao hàng thực tế (Kho nhận / Cảng)" name="delivery_address" rules={[{ required: true, message: 'Nhập điểm giao' }]} className="mb-0">
            <Input.TextArea rows={2} placeholder="Nhập địa chỉ nhà máy người nhận, bãi ICD hoặc Ga hàng hóa..." />
          </Form.Item>
        </div>

        {/* Phân vùng 3: Quy cách Hàng hóa & Tính toán Tải trọng Quy đổi */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center justify-between">
          <span>3. Quy cách Lô hàng & Tải trọng Quy đổi</span>
          <span className="text-gray-400 font-normal">Công thức: max(Trọng lượng thực, D x R x C / 5000)</span>
        </div>
        <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            <Form.Item label="Số lượng" name="package_count" rules={[{ required: true }]} className="mb-0">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item label="Đơn vị tính" name="package_unit" className="mb-0">
              <Select>
                <Option value="Pallet">Pallet</Option>
                <Option value="Kiện thùng gỗ">Kiện / Crate</Option>
                <Option value="Thùng carton">Thùng carton</Option>
                <Option value="Cuộn cáp">Cuộn / Reel</Option>
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
            <Form.Item label="TL thực tế (kg)" name="weight_kg" rules={[{ required: true }]} className="mb-0">
              <InputNumber className="w-full" min={1} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-2 border-t border-gray-200">
            <Form.Item label="Tính chất hàng hóa" name="cargo_type" className="mb-0">
              <Select>
                <Option value="GENERAL">Hàng bách hóa thông thường (General)</Option>
                <Option value="FRAGILE">Hàng điện tử dễ vỡ (Fragile)</Option>
                <Option value="VALUABLE">Hàng giá trị cao (High Value / Seal Lock)</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Cho phép xếp chồng (Stackable)" name="is_stackable" valuePropName="checked" className="mb-0">
              <Switch checkedChildren="Cho phép chồng tầng" unCheckedChildren="Cấm xếp chồng" />
            </Form.Item>

            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-amber-900">Tải trọng tính cước (Chargeable Weight):</span>
              <span className="text-lg font-bold text-amber-600">{chargeableWeight} kg</span>
            </div>
          </div>
        </div>

        {/* Phân vùng 4: Thiết lập Chứng từ Hải quan Bắt buộc */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-blue-600" />
            4. Danh mục Chứng từ Hải quan Thu thập Bắt buộc
          </span>
          <Checkbox checked={noDocsRequired} onChange={handleNoDocsChange} className="text-xs text-gray-600">
            Không cần chứng từ hải quan (Hàng nội địa thuần túy)
          </Checkbox>
        </div>
        <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 mb-4">
          <p className="text-xs text-gray-500 mb-2.5">
            Hệ thống sẽ tạo checklist trên Tracking Link để khách hàng tải lên các file scan tương ứng trước khi Dispatcher xác nhận duyệt (Ready for Planning).
          </p>
          <Form.Item name="required_documents" className="mb-0">
            <Checkbox.Group className="w-full" disabled={noDocsRequired}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DOCUMENT_TYPES.map(doc => (
                  <div key={doc.key} className="p-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300">
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

        {/* Phân vùng 5: Tài chính & Phân định Phí Phát sinh */}
        <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center justify-between">
          <span>5. Giá Thỏa thuận Chốt ngoài & Phân định Thu hộ</span>
          <span className="text-emerald-600 font-semibold text-xs">Doanh thu ALS vs. Cô lập Thuế VAT</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
          <Form.Item 
            label={
              <span className="flex items-center gap-1">
                Giá cước chốt thỏa thuận (Agreed Price - VNĐ)
                <Tooltip title="Giá cước vận tải thỏa thuận trực tiếp qua Zalo/Hotline, chưa bao gồm các phụ phí"><HelpCircle size={13} className="text-gray-400" /></Tooltip>
              </span>
            } 
            name="agreed_price" 
            rules={[{ required: true, message: 'Nhập giá thỏa thuận' }]} 
            className="mb-0"
          >
            <InputNumber 
              className="w-full font-bold text-blue-700" 
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
              parser={value => value.replace(/\$\s?|(,*)/g, '')} 
              min={0}
            />
          </Form.Item>

          <Form.Item 
            label={
              <span className="flex items-center gap-1">
                Phí phụ trội Surcharge (Doanh thu ALS - VNĐ)
                <Tooltip title="Lưu đêm, bốc dỡ thêm, chờ xe - Tính vào doanh thu ALS và chịu thuế VAT"><HelpCircle size={13} className="text-gray-400" /></Tooltip>
              </span>
            } 
            name="extra_fees_surcharge" 
            className="mb-0"
          >
            <InputNumber 
              className="w-full text-indigo-700" 
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
              parser={value => value.replace(/\$\s?|(,*)/g, '')} 
              min={0} 
            />
          </Form.Item>

          <Form.Item 
            label={
              <span className="flex items-center gap-1">
                Phí Thu hộ chi hộ (Off-book - VNĐ)
                <Tooltip title="Chi hộ hải quan, hạ bãi cảng, lệ phí biên phòng - Không tính doanh thu ALS, cô lập VAT"><HelpCircle size={13} className="text-gray-400" /></Tooltip>
              </span>
            } 
            name="extra_fees_collection" 
            className="mb-0"
          >
            <InputNumber 
              className="w-full text-emerald-700" 
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
              parser={value => value.replace(/\$\s?|(,*)/g, '')} 
              min={0} 
            />
          </Form.Item>
        </div>

        {/* Ghi chú vận hành */}
        <Form.Item label="Ghi chú Vận hành (Order Notes)" name="order_notes" className="mb-0">
          <Input.TextArea rows={2} placeholder="Yêu cầu kiểm tra niêm phong chì, số điện thoại tài xế, khung giờ nhận hàng..." />
        </Form.Item>

      </Form>
    </Modal>
  );
};

export default OrderFormModal;
