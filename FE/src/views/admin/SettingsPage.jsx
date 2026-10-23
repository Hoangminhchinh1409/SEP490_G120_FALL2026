"use client";
import React, { useState, useEffect } from 'react';
import { Form, InputNumber, Input, Button, Switch, Divider, message, Card, Popconfirm, Alert } from 'antd';
import { Save, Settings, ShieldAlert, Database, Clock, Truck, ShieldCheck, Scale, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsList = await adminApi.getSystemSettings();
        const settingsMap = {};
        if (Array.isArray(settingsList)) {
          settingsList.forEach(s => {
            let val = s.value;
            if (/^\d+$/.test(val)) val = Number(val);
            else if (val === 'true') val = true;
            else if (val === 'false') val = false;
            settingsMap[s.key] = val;
          });
        }

        const isMaint = settingsMap.maintenance_mode === true || settingsMap.maintenance_mode === 'true';
        setMaintenanceOn(isMaint);

        form.setFieldsValue({
          // Chế độ bảo trì
          maintenance_mode: isMaint,
          // Doanh nghiệp
          company_name: settingsMap.company_name || 'NEXLOG Logistics Corp',
          order_code_prefix: settingsMap.order_code_prefix || 'ALS',
          default_geofence_radius_meters: settingsMap.default_geofence_radius_meters || 200,
          // Khiếu nại & Vận hành
          claim_window_days: settingsMap.claim_window_days || 14,
          document_deadline_hours: settingsMap.document_deadline_hours || 24,
          waiting_too_long_minutes: settingsMap.waiting_too_long_minutes || 60,
          minimum_driver_rest_hours: 11, // Cố định luật định (BR-34)
          speed_limit_kmh: settingsMap.speed_limit_kmh || 80,
          // Lưu trữ
          document_retention_days: settingsMap.document_retention_days || 730,
          gps_track_retention_days: settingsMap.gps_track_retention_days || 90,
          file_size_limit_mb: settingsMap.file_size_limit_mb || 10,
          // Bảo mật & AI
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
      setMaintenanceOn(values.maintenance_mode === true);
      message.success('Đã lưu toàn bộ cấu hình hệ thống thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu cấu hình:', error);
      message.error(error.message || 'Lưu cấu hình thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Settings size={22} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cấu hình Tham số Hệ thống (System Settings)</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1.5">
            Quản trị các tham số hoạt động, thời hạn khiếu nại, chế độ bảo trì và các quy chuẩn vận hành theo SRS v2 (UC-36).
          </p>
        </div>
      </div>

      <Form 
        form={form} 
        layout="horizontal" 
        labelCol={{ span: 10 }} 
        wrapperCol={{ span: 14 }}
        disabled={fetching}
        onFinish={handleSave}
        className="space-y-6"
      >
        {/* KHỐI 1: CHẾ ĐỘ BẢO TRÌ HỆ THỐNG (MSG86) */}
        <div className={`rounded-2xl border p-6 transition-all shadow-sm ${
          maintenanceOn ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${maintenanceOn ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
              <ShieldAlert size={28} />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    Chế độ Bảo trì Hệ thống (Maintenance Mode)
                    {maintenanceOn && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-semibold">ĐANG BẬT</span>}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Khi kích hoạt, chỉ có tài khoản <b>Administrator</b> mới được phép đăng nhập. Các vai trò khác (Manager, Dispatcher, Driver) sẽ bị từ chối đăng nhập với thông báo hệ thống <b>MSG86</b>.
                  </p>
                </div>

                <Form.Item name="maintenance_mode" valuePropName="checked" className="mb-0">
                  <Switch 
                    checkedChildren="BẢO TRÌ" 
                    unCheckedChildren="HOẠT ĐỘNG"
                    className={maintenanceOn ? 'bg-amber-500' : ''}
                    onChange={(checked) => setMaintenanceOn(checked)}
                  />
                </Form.Item>
              </div>

              {maintenanceOn && (
                <div className="mt-3.5 p-3 bg-amber-100/70 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                  <span>Cảnh báo: Toàn bộ nhân viên không phải Quản trị viên khi đăng nhập sẽ nhìn thấy: <i>"Hệ thống đang bảo trì. Vui lòng quay lại sau."</i> (MSG86)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KHỐI 2: KHIẾU NẠI & NGHIỆP VỤ VẬN HÀNH (BR-59, UC-47, BR-25, BR-34) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-base border-b border-slate-100 pb-3">
            <Scale size={20} /> Khiếu nại Bồi thường & Ràng buộc Vận hành (Claims & Operations)
          </div>

          <Form.Item 
            name="claim_window_days" 
            label="Thời hạn khiếu nại bồi thường (ngày)" 
            extra="Số ngày tối đa sau khi đơn giao thành công (Delivered) khách được gửi khiếu nại trên trang tra cứu (UC-47, BR-59). Mặc định: 14 ngày."
          >
            <InputNumber min={1} max={90} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Form.Item 
            name="document_deadline_hours" 
            label="Thời hạn bổ sung chứng từ (giờ)" 
            extra="Thời hạn yêu cầu khách upload giấy tờ sau khi tạo đơn nháp (BR-25). Mặc định: 24 giờ."
          >
            <InputNumber min={1} max={72} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Form.Item 
            name="waiting_too_long_minutes" 
            label="Giới hạn cảnh báo chờ tại kho (phút)" 
            extra="Thời gian chờ dỡ hàng tối đa tại kho trước khi hệ thống kích hoạt cảnh báo chờ quá lâu (BR-25)."
          >
            <InputNumber min={15} max={240} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Form.Item 
            name="minimum_driver_rest_hours" 
            label="Thời gian nghỉ tối thiểu của tài xế (giờ)" 
            extra="Quy định pháp lý bắt buộc theo BR-34 (Luật định hiển thị để giám sát, khóa không cho thay đổi)."
          >
            <InputNumber disabled className="w-36 h-10 rounded-lg bg-slate-100 font-bold" />
          </Form.Item>

          <Form.Item 
            name="speed_limit_kmh" 
            label="Tốc độ xe tối đa cảnh báo (km/h)" 
            extra="Ngưỡng kích hoạt cảnh báo vượt quá tốc độ an toàn trên bản đồ giám sát hành trình."
          >
            <InputNumber min={40} max={120} className="w-36 h-10 rounded-lg" />
          </Form.Item>
        </div>

        {/* KHỐI 3: THÔNG TIN DOANH NGHIỆP & GEOFENCE */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-base border-b border-slate-100 pb-3">
            <Truck size={20} /> Cài đặt Doanh nghiệp & Vận hành chung
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
        </div>

        {/* KHỐI 4: LƯU TRỮ DỮ LIỆU & BẢO MẬT */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-base border-b border-slate-100 pb-3">
            <Database size={20} /> Lưu trữ Dữ liệu & Tệp tin (Data Retention - BR-22)
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

          <div className="flex items-center gap-2 text-emerald-600 font-bold text-base mb-4 border-b border-slate-100 pb-2">
            <Clock size={18} /> Bảo mật & Tiện ích AI
          </div>

          <Form.Item name="password_reset_expiry_minutes" label="Thời hạn hiệu lực link đặt lại mật khẩu (phút)">
            <InputNumber min={5} max={120} className="w-36 h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="document_assistant_enabled" label="Bật Trợ lý AI OCR bóc tách chứng từ" valuePropName="checked">
            <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
          </Form.Item>
        </div>

        {/* Nút lưu */}
        <div className="flex justify-end pt-4">
          <Button
            type="primary"
            htmlType="submit"
            icon={<Save size={16} />}
            loading={loading}
            className="h-12 px-8 font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 text-base"
          >
            Lưu toàn bộ Cấu hình
          </Button>
        </div>
      </Form>
    </div>
  );
}
