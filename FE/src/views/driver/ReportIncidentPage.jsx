"use client";
import React, { useState, useEffect } from "react";
import { Form, Input, Button, Upload, Select, Alert, App, Tag, Spin } from "antd";
import { Camera, AlertTriangle, ArrowLeft, Truck, MapPin, Info, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { driverApi, queueOfflineAction } from "../../api/driverApi";
import { uploadApi } from "../../api/uploadApi";

export default function ReportIncidentPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      return !navigator.onLine;
    }
    return false;
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [gpsCoords, setGpsCoords] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTripId = searchParams?.get("trip_id");

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    let isCancelled = false;
    // Lấy thông tin chuyến xe đang chạy của tài xế để tự động gắn với sự cố
    driverApi.getActiveTrip()
      .then(res => {
        if (isCancelled) return;
        let foundTrip = res?.trip || null;
        if (!foundTrip && Array.isArray(res?.upcomingTrips) && res.upcomingTrips.length > 0) {
          if (paramTripId) {
            foundTrip = res.upcomingTrips.find(t => String(t.id) === String(paramTripId)) || res.upcomingTrips[0];
          } else {
            foundTrip = res.upcomingTrips[0];
          }
        }
        if (foundTrip) {
          setActiveTrip(foundTrip);
          setTripId(foundTrip.id);
          const fallbackStop = (foundTrip.stops || []).find(s => s.status !== "Done" && s.location?.latitude) || (foundTrip.stops || []).find(s => s.location?.latitude);
          if (fallbackStop?.location?.latitude && fallbackStop?.location?.longitude) {
            setGpsCoords((prev) => prev || {
              lat: Number(fallbackStop.location.latitude),
              lng: Number(fallbackStop.location.longitude),
              source: "Tọa độ trạm hiện tại"
            });
          }
        } else if (paramTripId) {
          setTripId(Number(paramTripId));
        }
      })
      .catch(err => {
        console.warn("Lỗi tải chuyến xe hoạt động:", err?.message);
        if (paramTripId) setTripId(Number(paramTripId));
      })
      .finally(() => {
        setLoadingTrip(false);
      });

    // Tự động lấy tọa độ GPS hiện trường từ thiết bị tài xế khi mở form báo cáo
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            source: "GPS thiết bị"
          });
        },
        () => {
          // Giữ nguyên fallback theo tọa độ trạm nếu người dùng từ chối cấp quyền vị trí
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }

    return () => {
      isCancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [paramTripId]);

  const handleReport = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const photoList = values.photos || [];
      const photoUrls = photoList
        .map(p => p.url || p.response?.url || (isOffline ? p.thumbUrl : null))
        .filter(Boolean);

      // Tìm điểm dừng chưa hoàn thành của chuyến đang chạy
      const currentStop = (activeTrip?.stops || []).find(s => s.status !== "Done") || activeTrip?.stops?.[0];

      const resolvedTripId = tripId || activeTrip?.id || (paramTripId ? Number(paramTripId) : undefined);
      const resolvedLat = gpsCoords?.lat ?? (currentStop?.location?.latitude ? Number(currentStop.location.latitude) : null);
      const resolvedLng = gpsCoords?.lng ?? (currentStop?.location?.longitude ? Number(currentStop.location.longitude) : null);
      const payload = {
        trip_id: resolvedTripId,
        trip_stop_id: currentStop?.id,
        type: values.type || "Other",
        description: values.description,
        photos: photoUrls,
        incident_lat: resolvedLat,
        incident_lng: resolvedLng
      };

      if (isOffline) {
        await queueOfflineAction({
          type: "REPORT_INCIDENT",
          payload: {
            ...payload,
            clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID(): undefined
          }
        });
        message.warning("Đang mất kết nối mạng. Sự cố đã được lưu tạm trên máy (Offline First) và sẽ tự động gửi ngay khi có mạng!");
        form.resetFields();
      } else {
        const res = await driverApi.reportIncident(payload);
        message.success(res?.message || "Đã báo sự cố. Điều phối viên đã được thông báo!");
        setTimeout(() => router.push("/driver"), 1500);
      }
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

  // Xác định tuyến đường tóm tắt
  const pickupStop = (activeTrip?.stops || []).find(s => s.stop_type === "Pickup") || activeTrip?.stops?.[0];
  const dropoffStop = (activeTrip?.stops || []).slice().reverse().find(s => s.stop_type === "Drop-off") || activeTrip?.stops?.[activeTrip?.stops?.length - 1];
  const nextActiveStop = (activeTrip?.stops || []).find(s => s.status !== "Done");

  return (
    <div className="p-4 max-w-md mx-auto bg-slate-900 min-h-screen text-slate-100 font-sans">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/driver" className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-800 rounded-xl border border-slate-700">
          <ArrowLeft size={20}/>
        </Link>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={24}/> Báo cáo Sự cố Khẩn cấp
          </h1>
          <p className="text-xs text-slate-400">Ghi nhận sự cố trên chuyến xe đang chạy</p>
        </div>
      </div>

      {/* THÔNG TIN CHUYẾN XE HIỆN TẠI ĐƯỢC GẮN VỚI SỰ CỐ */}
      {loadingTrip ? (
        <div className="mb-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <Spin size="small" /> Đang nhận diện chuyến xe của bạn...
        </div>
      ) : activeTrip ? (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-800/90 to-indigo-950/80 border border-blue-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Truck size={14} className="text-blue-400" /> Chuyến xe đang chạy
            </span>
            <Tag color={activeTrip.status === "In Progress" ? "processing" : "warning"} className="text-[10px] font-bold m-0 border-none">
              {activeTrip.status || "In Progress"}
            </Tag>
          </div>

          <div className="text-base font-extrabold text-white flex items-center gap-2">
            <span>{activeTrip.trip_code || `TRIP-${activeTrip.id}`}</span>
            {activeTrip.truck?.plate_number && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700/80 text-amber-300 font-mono font-semibold">
                {activeTrip.truck.plate_number}
              </span>
            )}
          </div>

          {(pickupStop || dropoffStop) && (
            <div className="text-xs text-slate-300 mt-2 flex items-start gap-1.5">
              <MapPin size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="truncate">
                <span className="text-emerald-300 font-medium">{pickupStop?.location?.name || "Điểm lấy"}</span>
                <span className="text-slate-400 mx-1">→</span>
                <span className="text-blue-300 font-medium">{dropoffStop?.location?.name || "Điểm giao"}</span>
              </div>
            </div>
          )}

          {nextActiveStop && (
            <div className="text-[11px] text-amber-300/90 mt-1.5 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
              <span className="font-bold">Điểm dừng hiện tại:</span>
              <span className="truncate">#{nextActiveStop.sequence} - {nextActiveStop.location?.name || nextActiveStop.location?.address}</span>
            </div>
          )}

          <div className="text-[11px] text-blue-300/80 mt-2.5 pt-2 border-t border-slate-700/50 space-y-1">
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-blue-400 shrink-0" />
              <span>Sự cố này sẽ tự động gắn trực tiếp vào chuyến xe trên.</span>
            </div>
            {gpsCoords && (
              <div className="flex items-center gap-1.5 text-emerald-300 font-mono text-[10px]">
                <MapPin size={11} className="text-emerald-400 shrink-0" />
                <span>Vị trí GPS ghi nhận ({gpsCoords.source}): {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
          <Info size={16} className="text-amber-400 shrink-0" />
          <span>Bạn hiện chưa có chuyến xe đang lăn bánh. Báo cáo sẽ được lưu và liên kết với lịch trình công tác gần nhất.</span>
        </div>
      )}

      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 p-5 rounded-3xl shadow-2xl">
        <Alert 
          title="Thông báo tự động đến Điều phối viên"
          description="Báo cáo này được cập nhật ngay lập tức lên bản đồ giám sát GPS và bảng điều phối để hỗ trợ cứu hộ hoặc đổi xe/tài xế khẩn cấp." 
          type="warning" 
          showIcon 
          className="mb-5 rounded-2xl bg-amber-500/10 border-amber-500/20 text-amber-200 text-xs" 
        />

        <Form form={form} layout="vertical">
          <Form.Item 
            name="type" 
            label={<span className="text-slate-200 font-bold text-xs uppercase tracking-wider">Phân loại sự cố</span>} 
            rules={[{ required: true, message: "Vui lòng chọn loại sự cố" }]}
          >
            <Select placeholder="Chọn phân loại sự cố..." className="w-full">
              <Select.Option value="Breakdown">Hỏng xe / Nổ lốp (Breakdown)</Select.Option>
              <Select.Option value="Accident">Tai nạn giao thông (Accident)</Select.Option>
              <Select.Option value="Cargo Damaged">Hàng hóa hư hỏng (Cargo Damaged)</Select.Option>
              <Select.Option value="Cargo Lost">Thất thoát niêm phong / Hàng hóa (Cargo Lost)</Select.Option>
              <Select.Option value="Road Ban">Cấm đường / Ngập lụt (Road Ban)</Select.Option>
              <Select.Option value="Other">Sự cố vận hành khác (Other)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item 
            name="description" 
            label={<span className="text-slate-200 font-bold text-xs uppercase tracking-wider">Mô tả chi tiết tình hình</span>} 
            rules={[{ required: true, message: "Vui lòng nhập mô tả chi tiết sự cố" }]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder="Nhập chi tiết tình trạng sự cố đang gặp phải, vị trí cụ thể (Km số mấy, đoạn đường nào), ước tính mức độ ảnh hưởng..." 
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
              accept="image/*"
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  if (isOffline) {
                    const dataUrl = await uploadApi.fileToDataUrl(file);
                    onSuccess?.({ url: dataUrl });
                    message.info("Đã lưu ảnh hiện trường tạm ngoại tuyến.");
                    return;
                  }
                  const uploaded = await uploadApi.uploadToCloudinary(file, "nexlog/incidents");
                  onSuccess?.({ url: uploaded.url });
                  message.success("Đã tải ảnh hiện trường lên Cloudinary.");
                } catch (err) {
                  message.error(err.message || "Lỗi tải ảnh lên Cloudinary");
                  onError?.(err);
                }
              }}
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
            <AlertTriangle size={20}/> GỬI BÁO CÁO SỰ CỐ
          </Button>
        </Form>
      </div>
    </div>
  );
}
