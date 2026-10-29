"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Tag, Button, Modal, Upload, Input, InputNumber, message, Spin, Progress, Checkbox, Select } from "antd";
import { 
  MapPin, Camera, CheckCircle, AlertTriangle, CloudOff, Cloud, 
  Package, Navigation2, Truck, RefreshCw, Clock, FileText, DollarSign, Ban, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { driverApi, queueOfflineAction } from "../../api/driverApi";
import DriverDashboardModals from "./components/DriverDashboardModals";

export default function DriverDashboard() {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      return !navigator.onLine;
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [sealModalOpen, setSealModalOpen] = useState(false);
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [refusalModalOpen, setRefusalModalOpen] = useState(false);
  const [extraFeeModalOpen, setExtraFeeModalOpen] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [activeStopTarget, setActiveStopTarget] = useState(null);

  // Form Inputs for Pickup (BR-11, BR-33)
  const [cargoPhotoUrl, setCargoPhotoUrl] = useState("https://cdn.nexlog.vn/cargo-check-sample.jpg");
  const [loadedCargoPhotoUrl, setLoadedCargoPhotoUrl] = useState("https://cdn.nexlog.vn/cargo-loaded-sample.jpg");
  const [sealPhotoUrl, setSealPhotoUrl] = useState("https://cdn.nexlog.vn/seal-sample.jpg");
  const [sealNumber, setSealNumber] = useState("");
  const [loadedPackages, setLoadedPackages] = useState(50);
  const [loadedWeight, setLoadedWeight] = useState(500);

  // Form Inputs for POD & Delivery (BR-12)
  const [podPhotoUrl, setPodPhotoUrl] = useState("https://cdn.nexlog.vn/pod-sample.jpg");
  const [cutSealPhotoUrl, setCutSealPhotoUrl] = useState("https://cdn.nexlog.vn/cut-seal-sample.jpg");
  const [unloadedCargoPhotoUrl, setUnloadedCargoPhotoUrl] = useState("https://cdn.nexlog.vn/unloaded-sample.jpg");
  const [receiverName, setReceiverName] = useState("");
  const [docsHandedOver, setDocsHandedOver] = useState(true);
  const [deliveredPackages, setDeliveredPackages] = useState(50);

  // Form Inputs for Customer Refusal (BR-57)
  const [refusalReason, setRefusalReason] = useState("");
  const [refusalCargoPhoto, setRefusalCargoPhoto] = useState("https://cdn.nexlog.vn/refusal-sample.jpg");
  const [refusalNote, setRefusalNote] = useState("");

  // Form Inputs for Extra Fee (BR-30)
  const [feeType, setFeeType] = useState("Bốc xếp thêm");
  const [feeAmount, setFeeAmount] = useState(200000);
  const [feeReason, setFeeReason] = useState("");
  const [feePhotoUrl, setFeePhotoUrl] = useState("https://cdn.nexlog.vn/fee-receipt.jpg");

  // 1. Tải dữ liệu chuyến xe hiện tại & hồ sơ tài xế
  const fetchDashboardData = useCallback(async () => {
    try {
      const [profileRes, activeTripRes] = await Promise.allSettled([
        driverApi.getMyProfile(),
        driverApi.getActiveTrip()
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.profile || profileRes.value);
      }

      if (activeTripRes.status === "fulfilled") {
        setTripData(activeTripRes.value);
      }
    } catch (err) {
      console.error("fetchDashboardData error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Lắng nghe trạng thái Online / Offline & Tự động đồng bộ (BR-27)
  useEffect(() => {
    fetchDashboardData();

    const handleOnline = async () => {
      setIsOffline(false);
      message.success("Đã kết nối lại Internet. Đang đồng bộ dữ liệu ngoại tuyến (BR-27)...");
      try {
        const syncRes = await driverApi.syncPendingQueue();
        if (syncRes && syncRes.syncedCount > 0) {
          message.success(`Đã đồng bộ thành công ${syncRes.syncedCount} tác vụ lên máy chủ!`);
        }
      } catch (e) {
        console.error("Auto sync failed", e);
      }
      fetchDashboardData();
    };

    const handleOffline = () => {
      setIsOffline(true);
      message.warning("Mất kết nối Internet. Chế độ Ngoại tuyến (Offline-First) đã được kích hoạt.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchDashboardData]);

  // Helper lấy tọa độ GPS
  const getCurrentGps = () => {
    return new Promise((resolve) => {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ phoneLat: pos.coords.latitude, phoneLng: pos.coords.longitude }),
          () => resolve({ phoneLat: null, phoneLng: null }),
          { timeout: 5000, enableHighAccuracy: true }
        );
      } else {
        resolve({ phoneLat: null, phoneLng: null });
      }
    });
  };

  // 3. Workflow Action: Nhận Chuyến Xe (MSG17, BR-09)
  const handleAcceptTrip = async (tripId) => {
    try {
      setActionLoading(true);
      const clientActionId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined;
      
      if (isOffline) {
        queueOfflineAction({
          type: "ACCEPT_TRIP",
          tripId,
          payload: { clientActionId, phoneTime: new Date().toISOString() }
        });
        message.info("Đã ghi nhận nhận chuyến xe (Ngoại tuyến).");
      } else {
        const res = await driverApi.acceptTrip(tripId, { clientActionId });
        message.success(res.message || "Đã nhận chuyến xe thành công!");
      }
      setAcceptModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Không thể nhận chuyến xe");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Workflow Action: Báo Đến Điểm Dừng (BR-36)
  const handleArriveStop = async (tripId, stopId) => {
    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const clientActionId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined;

      if (isOffline) {
        queueOfflineAction({
          type: "ARRIVE_STOP",
          tripId,
          stopId,
          payload: { ...coords, clientActionId, phoneTime: new Date().toISOString() }
        });
        message.info("Đã ghi nhận đến điểm dừng (Ngoại tuyến).");
      } else {
        const res = await driverApi.arriveStop(tripId, stopId, { ...coords, clientActionId });
        if (res.isOutsideRadius) {
          message.warning("Đã ghi nhận đến nơi. Cảnh báo: Tọa độ ngoài bán kính cho phép (MSG50)!");
        } else {
          message.success("Đã ghi nhận đến điểm dừng!");
        }
      }
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Không thể cập nhật đến nơi");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Workflow Action: Bốc Hàng & Niêm Chì 3 Bước (BR-11, BR-33, MSG45)
  const handleSubmitPickup = async () => {
    if (!activeStopTarget || !tripData?.trip?.id) return;
    if (!sealNumber.trim()) {
      message.error("Hãy chụp rõ số chì và biển số xe, rồi nhập số chì (MSG18)");
      return;
    }
    if (!loadedPackages || !loadedWeight) {
      message.error("Vui lòng nhập số kiện và khối lượng hàng bốc thực tế (MSG02)");
      return;
    }

    const truckPayload = tripData.trip.truck?.allowed_payload || 5000;
    if (parseFloat(loadedWeight) > truckPayload) {
      message.error(`Tổng khối lượng ${loadedWeight} kg vượt tải trọng cho phép ${truckPayload} kg của xe. (MSG45)`);
      return;
    }

    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const payload = {
        cargo_photo_url: cargoPhotoUrl,
        loaded_cargo_photo_url: loadedCargoPhotoUrl,
        seal_photo_url: sealPhotoUrl,
        seal_number: sealNumber.trim(),
        loaded_packages: loadedPackages,
        loaded_weight: loadedWeight,
        ...coords,
        clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
      };

      if (isOffline) {
        queueOfflineAction({
          type: "RECORD_PICKUP",
          tripId: tripData.trip.id,
          stopId: activeStopTarget.id,
          payload
        });
        message.info("Đã lưu bốc hàng và niêm chì (Ngoại tuyến).");
      } else {
        await driverApi.recordPickup(tripData.trip.id, activeStopTarget.id, payload);
        message.success("Ghi nhận lấy hàng và niêm chì thành công! (BR-11)");
      }
      setSealModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Lỗi khi ghi nhận bốc hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Workflow Action: Giao Hàng & POD (BR-12, BR-19, BR-24)
  const handleSubmitDelivery = async () => {
    if (!activeStopTarget || !tripData?.trip?.id) return;
    const isExport = activeStopTarget.order?.order_type === "Export";

    if (isExport) {
      if (!cutSealPhotoUrl || !unloadedCargoPhotoUrl) {
        message.error("Hàng xuất khẩu bắt buộc chụp ảnh cắt chì và ảnh dỡ hàng (BR-12)");
        return;
      }
    } else {
      if (!podPhotoUrl || !podPhotoUrl.trim()) {
        message.error("Hãy chụp biên bản giao nhận đã ký (MSG20)");
        return;
      }
    }

    if (!docsHandedOver) {
      message.error("Vui lòng xác nhận đã bàn giao đủ chứng từ (BR-12)");
      return;
    }

    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const payload = {
        pod_photo_url: podPhotoUrl,
        cut_seal_photo_url: cutSealPhotoUrl,
        unloaded_cargo_photo_url: unloadedCargoPhotoUrl,
        receiver_name: receiverName.trim() || undefined,
        documents_handed_over: true,
        delivered_packages: deliveredPackages,
        ...coords,
        clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
      };

      if (isOffline) {
        queueOfflineAction({
          type: "RECORD_DELIVERY",
          tripId: tripData.trip.id,
          stopId: activeStopTarget.id,
          payload
        });
        message.info("Đã lưu biên bản giao nhận POD (Ngoại tuyến).");
      } else {
        const res = await driverApi.recordDelivery(tripData.trip.id, activeStopTarget.id, payload);
        if (res.isTripCompleted) {
          message.success("Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe (BR-24)!");
        } else {
          message.success("Ghi nhận giao hàng và lưu POD thành công!");
        }
      }
      setPodModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Lỗi khi ghi nhận giao hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Workflow Action: Khách không nhận hàng (BR-57, MSG74, MSG75)
  const handleSubmitRefusal = async () => {
    if (!activeStopTarget || !tripData?.trip?.id) return;
    if (!refusalReason.trim()) {
      message.error("Vui lòng nhập lý do khách từ chối nhận hàng (MSG02)");
      return;
    }
    if (!refusalCargoPhoto.trim()) {
      message.error("Vui lòng chụp ảnh hàng hóa bị từ chối (MSG02)");
      return;
    }

    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const payload = {
        reason: refusalReason.trim(),
        cargo_photo: refusalCargoPhoto.trim(),
        note: refusalNote.trim() || undefined,
        ...coords,
        clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
      };

      if (isOffline) {
        queueOfflineAction({
          type: "REFUSE_CARGO",
          tripId: tripData.trip.id,
          stopId: activeStopTarget.id,
          payload
        });
        message.info("Đã lưu báo cáo khách không nhận hàng (Ngoại tuyến).");
      } else {
        const res = await driverApi.reportCustomerRefusal(tripData.trip.id, activeStopTarget.id, payload);
        message.success(res.message || "Đã ghi nhận khách không nhận hàng. (MSG74)");
      }
      setRefusalModalOpen(false);
      setRefusalReason("");
      setRefusalNote("");
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Lỗi khi gửi báo cáo từ chối nhận hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Workflow Action: Đề xuất phụ phí (BR-30, MSG85)
  const handleSubmitExtraFee = async () => {
    if (!tripData?.trip?.id) return;
    if (!feeAmount || feeAmount <= 0) {
      message.error("Vui lòng nhập số tiền phụ phí hợp lệ");
      return;
    }
    if (!feeReason.trim()) {
      message.error("Vui lòng nhập lý do phát sinh phụ phí");
      return;
    }
    if (!feePhotoUrl.trim()) {
      message.error("Vui lòng chụp ảnh biên lai/chứng từ");
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        fee_type: feeType,
        amount: feeAmount,
        reason: feeReason.trim(),
        photo_url: feePhotoUrl.trim(),
        order_id: activeStopTarget?.order_id || undefined,
        clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
      };

      if (isOffline) {
        queueOfflineAction({
          type: "PROPOSE_EXTRA_FEE",
          tripId: tripData.trip.id,
          payload
        });
        message.info("Đã lưu đề xuất phụ phí (Ngoại tuyến).");
      } else {
        const res = await driverApi.proposeExtraFee(tripData.trip.id, payload);
        message.success(res.message || "Đã gửi đề xuất phụ phí cho Điều phối viên! (MSG85)");
      }
      setExtraFeeModalOpen(false);
      setFeeReason("");
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Lỗi khi gửi đề xuất phụ phí");
    } finally {
      setActionLoading(false);
    }
  };

  // Mở Google Maps dẫn đường
  const handleOpenNavigation = (destinationAddress, lat, lng) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    } else if (destinationAddress) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationAddress)}`, "_blank");
    } else {
      message.info("Không có thông tin địa chỉ để mở bản đồ");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200 p-6">
        <Spin size="large" />
        <p className="mt-4 font-semibold text-slate-300">Đang tải dữ liệu chuyến xe...</p>
      </div>
    );
  }

  const trip = tripData?.trip;
  const currentStop = tripData?.currentStop;
  const stops = trip?.stops || [];
  const truck = trip?.truck;
  const drivingHours = tripData?.drivingHours || profile?.drivingHours;

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-100 relative">
      {/* Background gradient */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-b-[40px] opacity-80 pointer-events-none overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-40"></div>
        <div className="absolute top-20 left-[-50px] w-48 h-48 bg-indigo-500 rounded-full blur-[60px] opacity-40"></div>
      </div>

      {/* PWA Connection Status Bar */}
      <div className={`fixed top-0 left-0 w-full z-40 px-4 py-2 text-center text-xs font-bold text-white transition-all backdrop-blur-md border-b flex items-center justify-center gap-2 ${
        isOffline 
          ? "bg-red-500/80 border-red-500/50" 
          : "bg-emerald-500/80 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
      }`}>
        {isOffline ? (
          <><CloudOff size={14}/> LƯU TẠM (OFFLINE FIRST - BR-27)</>
        ) : (
          <><Cloud size={14}/> KẾT NỐI MẠNG ỔN ĐỊNH</>
        )}
      </div>

      <div className="max-w-md mx-auto pt-14 px-4 relative z-10">
        
        {/* Header Section */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-md">NEXLOG Driver</h1>
            <p className="text-blue-200 text-sm font-medium">
              Xin chào, {profile?.user?.full_name || profile?.user?.username || "Tài xế"}
            </p>
            {profile?.license_number && (
              <span className="text-[11px] text-blue-300/80 font-mono">
                Bằng lái: {profile.license_number} ({profile.license_class})
              </span>
            )}
          </div>
          <button 
            onClick={fetchDashboardData} 
            className="w-11 h-11 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center shadow-lg active:scale-95 transition-all text-white"
            title="Làm mới"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* WIDGET: Giờ lái an toàn còn lại (Screen 6.1 (4), BR-34) */}
        {drivingHours && (
          <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-3xl p-4 mb-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock size={14} className="text-blue-400" /> Giờ lái còn lại (BR-34)
              </span>
              <span className="text-[10px] text-slate-400">Luật ATGT</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Liên tục (max 4h)</span>
                <span className={`text-base font-black ${drivingHours.continuous_hours_left < 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {drivingHours.continuous_hours_left}h
                </span>
                <Progress 
                  percent={Math.min(100, Math.round(((4 - drivingHours.continuous_hours_left) / 4) * 100))} 
                  size="small" 
                  showInfo={false} 
                  strokeColor={drivingHours.continuous_hours_left < 1 ? '#f59e0b' : '#3b82f6'}
                />
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Hôm nay (max 10h)</span>
                <span className="text-base font-black text-blue-400">
                  {drivingHours.daily_hours_left}h
                </span>
                <Progress 
                  percent={Math.min(100, Math.round(((10 - drivingHours.daily_hours_left) / 10) * 100))} 
                  size="small" 
                  showInfo={false} 
                  strokeColor="#3b82f6"
                />
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Tuần này (max 48h)</span>
                <span className="text-base font-black text-indigo-400">
                  {drivingHours.weekly_hours_left}h
                </span>
                <Progress 
                  percent={Math.min(100, Math.round(((48 - drivingHours.weekly_hours_left) / 48) * 100))} 
                  size="small" 
                  showInfo={false} 
                  strokeColor="#6366f1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Chưa có chuyến xe */}
        {!trip ? (
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 text-center shadow-2xl mt-4">
            <Package className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-white mb-2">Hiện chưa có chuyến xe</h3>
            <p className="text-slate-400 text-sm mb-6">
              Bạn đang ở trạng thái sẵn sàng. Khi có chuyến xe mới được phân bổ, thông tin sẽ xuất hiện ngay tại đây.
            </p>
            <Button 
              type="primary" 
              onClick={fetchDashboardData}
              className="bg-blue-600 font-bold rounded-xl h-11 px-6 shadow-lg shadow-blue-600/30"
            >
              Kiểm tra lại
            </Button>
          </div>
        ) : (
          <>
            {/* Trip Info Header */}
            <div className="mb-3 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white tracking-wide">Chuyến xe hiện tại</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDocsModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <FileText size={12} /> Chứng từ chuyến (6.1)
                </button>
                <div className="bg-blue-500/20 text-blue-200 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                  {trip.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Trip Summary Card */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-4 mb-4 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-white/10 pb-3 mb-3">
                <div>
                  <p className="text-[10px] text-blue-200/80 font-bold uppercase tracking-widest mb-0.5">Mã Chuyến</p>
                  <h3 className="text-xl font-black text-white tracking-tight">{trip.trip_code}</h3>
                  {truck && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-200 font-semibold mt-1">
                      <Truck size={14}/>
                      <span>Xe: {truck.plate_number}</span>
                      <span className="text-blue-300/70">({truck.model} - Tải trọng: {truck.allowed_payload} kg)</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-xl text-white font-semibold text-xs">
                  <Package size={13} />
                  <span>{stops.length} Điểm dừng</span>
                </div>
              </div>

              {/* Stop Timeline */}
              <div className="space-y-3 relative pl-2">
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-500 opacity-50 z-0"></div>
                
                {stops.map((stop) => {
                  const isDone = stop.status === "Done";
                  const isArrived = stop.status === "Arrived";
                  const isPickup = stop.stop_type === "Pickup";

                  return (
                    <div key={stop.id} className="flex gap-3 relative z-10">
                      <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1 shadow-lg ${
                        isDone 
                          ? "bg-emerald-500 border-2 border-emerald-300" 
                          : isArrived 
                            ? "bg-amber-400 border-2 border-amber-200 animate-ping" 
                            : isPickup 
                              ? "bg-slate-900 border-[2.5px] border-blue-400" 
                              : "bg-slate-900 border-[2.5px] border-indigo-400"
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold tracking-wide uppercase text-blue-200/80">
                            #{stop.sequence} {isPickup ? "LẤY HÀNG (PICKUP)" : "GIAO HÀNG (DROP-OFF)"}
                          </p>
                          <Tag color={isDone ? "success" : isArrived ? "warning" : "default"} className="text-[10px] font-bold m-0 py-0 px-1.5">
                            {stop.status}
                          </Tag>
                        </div>
                        <p className="font-semibold text-white leading-tight text-xs mt-0.5">
                          {stop.location?.name || stop.location?.address || "Kho hàng"}
                        </p>
                        <p className="text-[11px] text-slate-300/80">
                          {stop.location?.address}
                        </p>
                        {stop.order && (
                          <div className="text-[10px] text-blue-200 mt-0.5 flex items-center gap-2">
                            <span>Đơn: <b>{stop.order.order_code}</b></span>
                            {stop.order.receiver_name && <span>• Nhận: {stop.order.receiver_name}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workflow Control Box */}
            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-3xl p-4 mb-4 shadow-2xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Navigation2 className="w-4 h-4 text-indigo-400" /> Thao tác Chuyến xe
                </span>
                {/* Propose Fee Button (Screen 6.2 (10)) */}
                <button
                  onClick={() => {
                    setActiveStopTarget(currentStop);
                    setExtraFeeModalOpen(true);
                  }}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30 transition-colors"
                >
                  <DollarSign size={13} /> Đề xuất phí (BR-30)
                </button>
              </h3>

              {/* Case 1: Trip is Assigned -> Need to Accept (MSG17, BR-09) */}
              {trip.status === "Assigned" && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-center">
                  <p className="text-xs text-blue-200 font-semibold mb-3">
                    Chuyến xe đã được điều phối cho bạn. Xác nhận nhận chuyến để bắt đầu.
                  </p>
                  <Button 
                    type="primary" 
                    size="large"
                    loading={actionLoading}
                    onClick={() => setAcceptModalOpen(true)}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 border-none font-black rounded-xl h-12 shadow-lg shadow-blue-600/30"
                  >
                    NHẬN CHUYẾN XE (MSG17)
                  </Button>
                </div>
              )}

              {/* Case 2: Trip Accepted or In Progress -> Process active stop */}
              {(trip.status === "Accepted" || trip.status === "In Progress") && currentStop && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Điểm dừng tiếp theo</span>
                        <Tag color="processing" className="font-bold text-[10px] m-0 py-0">#{currentStop.sequence}</Tag>
                      </div>
                      <p className="text-white font-bold text-xs">{currentStop.location?.name || currentStop.location?.address}</p>
                    </div>
                    <button
                      onClick={() => handleOpenNavigation(
                        currentStop.location?.address,
                        currentStop.location?.latitude,
                        currentStop.location?.longitude
                      )}
                      className="p-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-xl border border-blue-500/40"
                      title="Mở Google Maps"
                    >
                      <MapPin size={18} />
                    </button>
                  </div>

                  {/* Step A: If Pending -> Arrive Button */}
                  {currentStop.status === "Pending" && (
                    <Button 
                      type="primary" 
                      size="large"
                      loading={actionLoading}
                      onClick={() => handleArriveStop(trip.id, currentStop.id)}
                      className="w-full bg-blue-600 hover:bg-blue-500 border-none font-black rounded-xl h-12 shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                    >
                      <MapPin size={18}/> ĐÃ ĐẾN NƠI (ĐIỂM #{currentStop.sequence})
                    </Button>
                  )}

                  {/* Step B: If Arrived & Pickup -> Bốc hàng & Niêm chì Modal (BR-11) */}
                  {currentStop.status === "Arrived" && currentStop.stop_type === "Pickup" && (
                    <Button 
                      type="primary" 
                      size="large"
                      onClick={() => {
                        setActiveStopTarget(currentStop);
                        setSealModalOpen(true);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 border-none font-black rounded-xl h-12 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                    >
                      <Camera size={18}/> BỐC HÀNG & CHỤP ẢNH NIÊM CHÌ (BR-11)
                    </Button>
                  )}

                  {/* Step C: If Arrived & Drop-off -> Giao hàng & POD Modal / Từ chối (BR-12, BR-57) */}
                  {currentStop.status === "Arrived" && currentStop.stop_type === "Drop-off" && (
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        type="primary" 
                        size="large"
                        onClick={() => {
                          setActiveStopTarget(currentStop);
                          setPodModalOpen(true);
                        }}
                        className="col-span-2 bg-emerald-600 hover:bg-emerald-500 border-none font-black rounded-xl h-12 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 text-xs"
                      >
                        <Camera size={16}/> GIAO HÀNG & POD (BR-12)
                      </Button>

                      <Button 
                        danger
                        size="large"
                        onClick={() => {
                          setActiveStopTarget(currentStop);
                          setRefusalModalOpen(true);
                        }}
                        className="col-span-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold rounded-xl h-12 flex flex-col items-center justify-center text-[10px]"
                      >
                        <Ban size={14}/> KHÁCH TỪ CHỐI (BR-57)
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Case 3: Completed */}
              {trip.status === "Completed" && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-emerald-200 font-bold">
                    Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Xe và hồ sơ tài xế đã được giải phóng về trạng thái sẵn sàng (BR-24).</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <DriverDashboardModals
        trip={trip}
        tripData={tripData}
        stops={stops}
        truck={truck}
        activeStopTarget={activeStopTarget}
        actionLoading={actionLoading}
        acceptModalOpen={acceptModalOpen}
        setAcceptModalOpen={setAcceptModalOpen}
        handleAcceptTrip={handleAcceptTrip}
        sealModalOpen={sealModalOpen}
        setSealModalOpen={setSealModalOpen}
        handleSubmitPickup={handleSubmitPickup}
        cargoPhotoUrl={cargoPhotoUrl}
        setCargoPhotoUrl={setCargoPhotoUrl}
        loadedCargoPhotoUrl={loadedCargoPhotoUrl}
        setLoadedCargoPhotoUrl={setLoadedCargoPhotoUrl}
        sealPhotoUrl={sealPhotoUrl}
        setSealPhotoUrl={setSealPhotoUrl}
        sealNumber={sealNumber}
        setSealNumber={setSealNumber}
        loadedPackages={loadedPackages}
        setLoadedPackages={setLoadedPackages}
        loadedWeight={loadedWeight}
        setLoadedWeight={setLoadedWeight}
        podModalOpen={podModalOpen}
        setPodModalOpen={setPodModalOpen}
        handleSubmitDelivery={handleSubmitDelivery}
        podPhotoUrl={podPhotoUrl}
        setPodPhotoUrl={setPodPhotoUrl}
        cutSealPhotoUrl={cutSealPhotoUrl}
        setCutSealPhotoUrl={setCutSealPhotoUrl}
        unloadedCargoPhotoUrl={unloadedCargoPhotoUrl}
        setUnloadedCargoPhotoUrl={setUnloadedCargoPhotoUrl}
        receiverName={receiverName}
        setReceiverName={setReceiverName}
        deliveredPackages={deliveredPackages}
        setDeliveredPackages={setDeliveredPackages}
        docsHandedOver={docsHandedOver}
        setDocsHandedOver={setDocsHandedOver}
        refusalModalOpen={refusalModalOpen}
        setRefusalModalOpen={setRefusalModalOpen}
        handleSubmitRefusal={handleSubmitRefusal}
        refusalReason={refusalReason}
        setRefusalReason={setRefusalReason}
        refusalCargoPhoto={refusalCargoPhoto}
        setRefusalCargoPhoto={setRefusalCargoPhoto}
        refusalNote={refusalNote}
        setRefusalNote={setRefusalNote}
        extraFeeModalOpen={extraFeeModalOpen}
        setExtraFeeModalOpen={setExtraFeeModalOpen}
        handleSubmitExtraFee={handleSubmitExtraFee}
        feeType={feeType}
        setFeeType={setFeeType}
        feeAmount={feeAmount}
        setFeeAmount={setFeeAmount}
        feeReason={feeReason}
        setFeeReason={setFeeReason}
        feePhotoUrl={feePhotoUrl}
        setFeePhotoUrl={setFeePhotoUrl}
        docsModalOpen={docsModalOpen}
        setDocsModalOpen={setDocsModalOpen}
      />
    </div>
  );
}
