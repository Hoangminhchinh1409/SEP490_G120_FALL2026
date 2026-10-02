"use client";
import React, { useState } from 'react';
import { Form, InputNumber, Button, Switch, Divider, message } from 'antd';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('Đã lưu cấu hình thành công!');
    }, 1000);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Cấu hình Tham số Hệ thống</h1>
        <p className="text-gray-500">Thay đổi các tham số vận hành động mà không cần khởi động lại hệ thống.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <Form 
          form={form} 
          layout="horizontal" 
          labelCol={{ span: 10 }} 
          wrapperCol={{ span: 14 }}
          initialValues={{
            file_retention_days: 60,
            waiting_limit_minutes: 30,
            min_rest_minutes: 120,
            max_file_size_mb: 10,
            assign_window_hours: 24,
            daily_operating_hours: 14,
            maintenance_mode: false
          }}
          onFinish={handleSave}
        >
          <h3 className="font-semibold text-lg text-[#0056a0] mb-4">Lưu trữ & Dữ liệu</h3>
          <Form.Item name="file_retention_days" label="Thời hạn tự động xóa tệp chứng từ/POD (ngày)" extra="Quy định 60-90 ngày theo Nghị định 13/2023/NĐ-CP">
            <InputNumber min={30} max={365} className="w-32" />
          </Form.Item>
          <Form.Item name="max_file_size_mb" label="Dung lượng tệp tải lên tối đa (MB)">
            <InputNumber min={1} max={50} className="w-32" />
          </Form.Item>

          <Divider />
          <h3 className="font-semibold text-lg text-[#0056a0] mb-4">Vận hành Điều phối & Đội xe</h3>
          <Form.Item name="waiting_limit_minutes" label="Giới hạn thời gian đơn bị nghẽn (phút)" extra="Thời gian cảnh báo khi đơn hàng ở trạng thái 'Ready for Planning' quá lâu">
            <InputNumber min={5} max={1440} className="w-32" />
          </Form.Item>
          <Form.Item name="min_rest_minutes" label="Thời gian nghỉ tối thiểu của tài xế (phút)" extra="Giữa 2 chuyến làm việc liên tiếp">
            <InputNumber min={30} max={720} className="w-32" />
          </Form.Item>
          <Form.Item name="assign_window_hours" label="Khung giờ gán chuyến tối đa (giờ)">
            <InputNumber min={1} max={72} className="w-32" />
          </Form.Item>
          <Form.Item name="daily_operating_hours" label="Số giờ hoạt động tối đa trong ngày (giờ)/tài xế">
            <InputNumber min={4} max={16} className="w-32" />
          </Form.Item>

          <Divider />
          <h3 className="font-semibold text-lg text-red-600 mb-4">Bảo trì</h3>
          <Form.Item name="maintenance_mode" label="Chế độ bảo trì hệ thống" valuePropName="checked" extra="Ngăn người dùng đăng nhập khi hệ thống đang cập nhật">
            <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
          </Form.Item>

          <div className="flex justify-end mt-8">
            <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={loading} size="large" className="bg-[#0056a0]">
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
