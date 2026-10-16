"use client";
import React, { useState, useEffect } from 'react';
import { Form, InputNumber, Input, Button, Switch, Divider, message, Card } from 'antd';
import { Save, Settings, ShieldAlert, Database, Clock, Truck } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsList = await adminApi.getSystemSettings();
        const settingsMap = {};
        if (Array.isArray(settingsList)) {
          settingsList.forEach(s => {
            let val = s.value;
            // Parse numbers if applicable
            if (/^\d+$/.test(val)) val = Number(val);
            else if (val === 'true') val = true;
            else if (val === 'false') val = false;
            settingsMap[s.key] = val;
          });
        }

        form.setFieldsValue({
          company_name: settingsMap.company_name || 'NEXLOG Logistics',
          order_code_prefix: settingsMap.order_code_prefix || 'ALS',
          default_geofence_radius_meters: settingsMap.default_geofence_radius_meters || 200,
          document_retention_days: settingsMap.document_retention_days || 730,
          gps_track_retention_days: settingsMap.gps_track_retention_days || 90,
          file_size_limit_mb: settingsMap.file_size_limit_mb || 10,
          password_reset_expiry_minutes: settingsMap.password_reset_expiry_minutes || 30,
          document_assistant_enabled: settingsMap.document_assistant_enabled ?? true
        });
      } catch (error) {
        console.error('Lỗi khi tải cấu hình hệ thống:', error);
        message.error('Không thể tải cấu hình hệ thống');
      } finally {
        setFetching(false);
      }
    };

    fetchSettings();
  }, [form]);

  const handleSave = async (values) => {
    setLoading(true);
    try {
      // Lưu từng cấu hình
      for (const [key, val] of Object.entries(values)) {
        await adminApi.updateSystemSetting({
          key,
          value: String(val)
        });
      }
      message.success('Đã lưu toàn bộ cấu hình hệ thống thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu cấu hình:', error);
      message.error(error.message || 'Lưu cấu hình thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Settings size={22} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cấu hình Tham số Hệ thống (System Settings)</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1.5">
          Điều chỉnh các tham số vận hành, thời gian lưu trữ dữ liệu và bảo mật thời gian thực theo đặc tả SRS (UC-36).
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <Form 
          form={form} 
          layout="horizontal" 
          labelCol={{ span: 10 }} 
          wrapperCol={{ span: 14 }}
          disabled={fetching}
          onFinish={handleSave}
          className="space-y-4"
        >
          {/* Thông tin chung */}
          <div className="flex items-center gap-2 text-blue-600 font-bold text-base mb-4 border-b border-slate-100 pb-2">
            <Settings size={18} /> Cài đặt Doanh nghiệp & Vận hành chung
          </div>

          <Form.Item name="company_name" label="Tên doanh nghiệp vận hành">
            <Input className="h-10 rounded-lg max-w-md" />
          </Form.Item>

          <Form.Item name="order_code_prefix" label="Tiền tố mã đơn hàng (Order Code Prefix)" extra="Mặc định là ALS (ví dụ: ALS260930-0001)">
            <Input className="h-10 rounded-lg w-40 font-mono font-bold" />
          </Form.Item>

          <Form.Item name="default_geofence_radius_meters" label="Bán kính hàng rào địa lý kho (mét)" extra="Khoảng cách cho phép để tài xế bấm xác nhận Đến kho (BR-36)">
            <InputNumber min={50} max={2000} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Divider />

          {/* Lưu trữ & Dữ liệu */}
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-base mb-4 border-b border-slate-100 pb-2">
            <Database size={18} /> Lưu trữ Dữ liệu & Tệp tin (Data Retention)
          </div>

          <Form.Item name="document_retention_days" label="Thời hạn lưu trữ chứng từ/POD (ngày)" extra="Lưu trữ tối thiểu 2 năm (730 ngày) theo quy định BR-22">
            <InputNumber min={60} max={1825} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="gps_track_retention_days" label="Thời hạn lưu vết hành trình GPS (ngày)" extra="Vết tọa độ di chuyển của xe tải (JOB-01)">
            <InputNumber min={30} max={365} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="file_size_limit_mb" label="Dung lượng tệp tải lên tối đa (MB)">
            <InputNumber min={1} max={50} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Divider />

          {/* Bảo mật & Tiện ích */}
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-base mb-4 border-b border-slate-100 pb-2">
            <Clock size={18} /> Bảo mật & Tiện ích AI
          </div>

          <Form.Item name="password_reset_expiry_minutes" label="Thời hạn hiệu lực link đặt lại mật khẩu (phút)">
            <InputNumber min={5} max={120} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="document_assistant_enabled" label="Bật Trợ lý AI OCR bóc tách chứng từ" valuePropName="checked">
            <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
          </Form.Item>

          <div className="flex justify-end pt-6 border-t border-slate-100">
            <Button
              type="primary"
              htmlType="submit"
              icon={<Save size={16} />}
              loading={loading}
              className="h-11 px-6 font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20"
            >
              Lưu thay đổi cấu hình
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
