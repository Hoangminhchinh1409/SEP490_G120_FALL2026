"use client";
import React, { useState, useEffect } from "react";
import { Form, Input, Button, Upload, Select, message, Alert } from "antd";
import { Camera, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { driverApi, queueOfflineAction } from "../../api/driverApi";

export default function ReportIncidentPage() {
  const [form] = Form.useForm();
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      return !navigator.onLine;
    }
    return false;
  });
  const [submitting, setSubmitting] = useState(false);
  const [tripId, setTripId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // Lấy thông tin chuyến xe đang chạy để gán trip_id
    driverApi.getActiveTrip()
      .then(res => {
        if (res?.trip?.id) setTripId(res.trip.id);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleReport = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const photoList = values.photos || [];
      const photoUrls = photoList.length > 0 
        ? photoList.map(p => p.url || p.thumbUrl || p.response?.url || "https://cdn.nexlog.vn/incident-sample.jpg")
        : ["https://cdn.nexlog.vn/incident-default.jpg"];

      const payload = {
        trip_id: tripId || 9,
        type: values.type || "Other",
        description: values.description,
        photos: photoUrls
      };

      if (isOffline) {
        queueOfflineAction({
          type: "REPORT_INCIDENT",
          payload: {
            ...payload,
            clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
          }
        });
        message.warning("Đang mất kết nối mạng. Sự cố đã được lưu tạm trên máy (Offline First) và sẽ tự động gửi ngay khi có mạng (BR-27)!");
      } else {
        await driverApi.reportIncident(payload);
        message.success("Đã báo sự cố. Điều phối viên đã được báo (MSG21)!");
      }

      setTimeout(() => router.push("/driver"), 1500);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || "Không thể gửi báo cáo sự cố");
    } finally {
      setSubmitting(false);
    }
  };

  const normFile = (e) => {
    if (Array.isArray(e)) return e;
    return e?.fileList;
  };

  return (
    <div className="p-4 max-w-lg mx-auto bg-slate-900 min-h-screen text-slate-100 font-sans">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/driver" className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-800 rounded-xl border border-slate-700">
          <ArrowLeft size={20}/>
        </Link>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={24}/> Báo cáo Sự cố Khẩn cấp
          </h1>
          <p className="text-xs text-slate-400">Ghi nhận sự cố trên tuyến đường (BF-04 / UC-32)</p>
        </div>
      </div>

      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 p-5 rounded-3xl shadow-2xl">
        <Alert 
          title="Thông báo tự động đến Điều phối"
          description="Báo cáo này sẽ được chuyển ngay lập tức lên màn hình Điều phối viên để hỗ trợ cứu hộ hoặc thay xe/tài xế." 
          type="warning" 
          showIcon 
          className="mb-6 rounded-2xl bg-amber-500/10 border-amber-500/20 text-amber-200" 
        />

        <Form form={form} layout="vertical">
          <Form.Item 
            name="type" 
            label={<span className="text-slate-200 font-bold text-xs uppercase tracking-wider">Phân loại sự cố</span>} 
            rules={[{ required: true, message: "Vui lòng chọn loại sự cố" }]}
          >
            <Select placeholder="Chọn phân loại..." className="w-full">
              <Select.Option value="Breakdown">Hỏng xe / Nổ lốp (Breakdown)</Select.Option>
              <Select.Option value="Accident">Tai nạn giao thông (Accident)</Select.Option>
              <Select.Option value="Cargo Damaged">Hàng hóa hư hỏng (Cargo Damaged)</Select.Option>
              <Select.Option value="Cargo Lost">Thất thoát hàng hóa (Cargo Lost)</Select.Option>
              <Select.Option value="Road Ban">Cấm đường / Thời tiết xấu (Road Ban)</Select.Option>
              <Select.Option value="Other">Khác (Other)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item 
            name="description" 
            label={<span className="text-slate-200 font-bold text-xs uppercase tracking-wider">Mô tả chi tiết</span>} 
            rules={[{ required: true, message: "Vui lòng nhập mô tả chi tiết" }]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder="Nhập chi tiết tình trạng sự cố đang gặp phải, vị trí cụ thể, ước lượng mức độ nghiêm trọng..." 
              className="bg-slate-900 border-slate-700 text-white placeholder-slate-500 rounded-xl"
            />
          </Form.Item>

          <Form.Item 
            name="photos" 
            label={<span className="text-slate-200 font-bold text-xs uppercase tracking-wider">Ảnh hiện trường (Tối đa 5 ảnh)</span>}
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload 
              listType="picture-card" 
              maxCount={5} 
              multiple 
              beforeUpload={() => false}
              className="upload-dark"
            >
              <div className="text-slate-400 flex flex-col items-center">
                <Camera className="mb-1" size={22}/>
                <span className="text-xs font-semibold">Chụp ảnh</span>
              </div>
            </Upload>
          </Form.Item>

          <Button 
            type="primary" 
            danger 
            size="large" 
            loading={submitting}
            className="w-full mt-4 flex items-center justify-center gap-2 font-black rounded-2xl h-14 bg-gradient-to-r from-red-600 to-rose-600 border-none shadow-lg shadow-red-600/30 text-base" 
            onClick={handleReport}
          >
            <AlertTriangle size={20}/> GỬI BÁO CÁO KHẨN
          </Button>
        </Form>
      </div>
    </div>
  );
}
