"use client";
import React, { useState } from 'react';
import { Form, Input, Button, Upload, Select, message, Alert } from 'antd';
import { Camera, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ReportIncidentPage() {
  const [form] = Form.useForm();
  const [isOffline, setIsOffline] = useState(false);
  const router = useRouter();

  const handleReport = () => {
    form.validateFields().then(values => {
      message.success(isOffline ? 'Đã lưu báo cáo Sự cố (Offline). Sẽ gửi khi có mạng.' : 'Đã gửi báo cáo Sự cố về Trung tâm Điều phối!');
      setTimeout(() => router.push('/driver'), 1500);
    });
  };

  return (
    <div className="p-4 max-w-lg mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/driver" className="text-gray-500 hover:text-gray-800"><ArrowLeft size={24}/></Link>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <AlertTriangle className="text-red-500"/> Báo cáo Sự cố
        </h1>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm">
        <Alert title="Lưu ý: Báo cáo này sẽ được gửi trực tiếp đến màn hình của Điều phối viên." type="warning" showIcon className="mb-6 rounded-lg text-sm" />

        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Loại sự cố" rules={[{ required: true, message: 'Vui lòng chọn loại sự cố' }]}>
            <Select placeholder="Chọn phân loại...">
              <Select.Option value="breakdown">Hỏng xe / Nổ lốp</Select.Option>
              <Select.Option value="accident">Tai nạn giao thông</Select.Option>
              <Select.Option value="cargo_damage">Hàng hóa hư hỏng / mất mát</Select.Option>
              <Select.Option value="authority">Bị công an/hải quan giữ</Select.Option>
              <Select.Option value="other">Khác</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Mô tả chi tiết" rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}>
            <Input.TextArea rows={4} placeholder="Nhập chi tiết tình trạng sự cố đang gặp phải..." />
          </Form.Item>

          <Form.Item name="photos" label="Ảnh hiện trường (Tối đa 5 ảnh)">
            <Upload listType="picture-card" maxCount={5} multiple action="/api/upload">
              <div className="text-gray-500 flex flex-col items-center">
                <Camera className="mb-1" size={20}/>
                <span className="text-xs">Thêm ảnh</span>
              </div>
            </Upload>
          </Form.Item>

          <Button type="primary" danger size="large" className="w-full mt-4 flex items-center justify-center gap-2 font-bold rounded-xl h-12" onClick={handleReport}>
            <AlertTriangle size={18}/> GỬI BÁO CÁO KHẨN
          </Button>
        </Form>
      </div>
    </div>
  );
}
