import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Select, Divider } from 'antd';

const { Option } = Select;

const OrderFormModal = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm();
  const [chargeableWeight, setChargeableWeight] = useState(0);

  // Watch for dimension changes to auto-calculate chargeable weight
  const values = Form.useWatch([], form);

  useEffect(() => {
    if (values) {
      const { length_cm, width_cm, height_cm, weight_kg } = values;
      if (length_cm && width_cm && height_cm) {
        const volumeWeight = (length_cm * width_cm * height_cm) / 5000;
        // Lấy Max giữa Trọng lượng thực tế và Trọng lượng thể tích
        const finalWeight = Math.max(weight_kg || 0, volumeWeight);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChargeableWeight(finalWeight.toFixed(2));
      }
    }
  }, [values]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      onSubmit({ ...values, chargeable_weight: chargeableWeight });
      form.resetFields();
    });
  };

  return (
    <Modal
      title={<span className="text-lg font-bold text-[#0056a0]">Tạo Đơn Hàng Mới (Order Ingestion)</span>}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={700}
      okText="Tạo Đơn"
      cancelText="Hủy"
      okButtonProps={{ className: "bg-[#0056a0]" }}
    >
      <Form form={form} layout="vertical" className="mt-4" initialValues={{ is_stackable: true, cargo_type: 'GENERAL' }}>
        
        <div className="grid grid-cols-2 gap-4">
          <Form.Item label="Khách hàng" name="customer_name" rules={[{ required: true, message: 'Nhập tên KH' }]}>
            <Input placeholder="Tên khách hàng" />
          </Form.Item>
          <Form.Item label="Mã số thuế (Tùy chọn)" name="customer_tax_code">
            <Input placeholder="Mã số thuế" />
          </Form.Item>
          <Form.Item label="Số điện thoại" name="customer_phone" rules={[{ required: true, message: 'Nhập SĐT' }]}>
            <Input placeholder="Số điện thoại" />
          </Form.Item>
          <Form.Item label="Email nhận Link Tracking" name="customer_email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="Email" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item label="Kho ALS lấy hàng" name="pickup_address" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Nhập địa chỉ lấy hàng..." />
          </Form.Item>
          <Form.Item label="Địa chỉ giao hàng thực tế" name="delivery_address" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Nhập địa chỉ giao hàng..." />
          </Form.Item>
        </div>

        <Divider className="my-2" titlePlacement="left">Thông số Hàng hóa</Divider>

        <div className="grid grid-cols-4 gap-2">
          <Form.Item label="Dài (cm)" name="length_cm" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={1} />
          </Form.Item>
          <Form.Item label="Rộng (cm)" name="width_cm" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={1} />
          </Form.Item>
          <Form.Item label="Cao (cm)" name="height_cm" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={1} />
          </Form.Item>
          <Form.Item label="TL thực (kg)" name="weight_kg" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={1} />
          </Form.Item>
        </div>

        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg mb-4">
          <span className="font-semibold text-gray-700">Trọng lượng quy đổi (Chargeable Weight):</span>
          <span className="font-bold text-xl text-[#e59f1f]">{chargeableWeight} kg</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item label="Loại hàng hóa" name="cargo_type">
            <Select>
              <Option value="GENERAL">Hàng bách hóa (General Cargo)</Option>
              <Option value="FRAGILE">Hàng dễ vỡ (Fragile)</Option>
              <Option value="VALUABLE">Hàng giá trị cao (Valuable)</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Cho phép xếp chồng" name="is_stackable" valuePropName="checked">
            <Switch checkedChildren="Có" unCheckedChildren="Không" />
          </Form.Item>
        </div>

        <Divider className="my-2" titlePlacement="left">Tài chính & Phí phát sinh</Divider>
        <div className="grid grid-cols-3 gap-4">
          <Form.Item label="Giá trị chốt ngoài (VNĐ)" name="agreed_price" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          <Form.Item label="Phí phụ trội (VNĐ)" name="extra_fees_surcharge">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          <Form.Item label="Phí Thu hộ (COD - VNĐ)" name="extra_fees_collection">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
        </div>
        
        <Form.Item label="Ghi chú vận hành" name="order_notes">
          <Input.TextArea rows={2} placeholder="Nhập ghi chú cho tài xế..." />
        </Form.Item>

      </Form>
    </Modal>
  );
};

export default OrderFormModal;
