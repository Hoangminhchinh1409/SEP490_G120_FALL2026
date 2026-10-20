"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Tag, Button, Modal, Upload, Input, InputNumber, message, Spin } from "antd";
import { 
  MapPin, Camera, CheckCircle, AlertTriangle, CloudOff, Cloud, 
  Package, Navigation2, Truck, RefreshCw 
} from "lucide-react";
import Link from "next/link";
import { driverApi, queueOfflineAction } from "@/api/driverApi";

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

  // Modal States
  const [sealModalOpen, setSealModalOpen] = useState(false);
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [activeStopTarget, setActiveStopTarget] = useState(null);

  // Form Inputs for Seal & Pickup
  const [sealNumber, setSealNumber] = useState("");
  const [loadedPackages, setLoadedPackages] = useState(50);
  const [loadedWeight, setLoadedWeight] = useState(500);
  const [sealPhotoUrl, setSealPhotoUrl] = useState("https://cdn.nexlog.vn/seal-sample.jpg");

  // Form Inputs for POD & Delivery
  const [podPhotoUrl, setPodPhotoUrl] = useState("https://cdn.nexlog.vn/pod-sample.jpg");
  const [receiverName, setReceiverName] = useState("");
  const [extraFees, setExtraFees] = useState(0);

  // 1. Tải dữ liệu chuyến xe hiện tại
  const fetchDashboardData = useCallback(async () => {
    try {
      const [profileRes, activeTripRes] = await Promise.allSettled([
        driverApi.getMyProfile(),
        driverApi.getActiveTrip()
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.profile);
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
    let ignore = false;

    const loadInitialData = async () => {
      try {
        const [profileRes, activeTripRes] = await Promise.allSettled([
          driverApi.getMyProfile(),
          driverApi.getActiveTrip()
        ]);

        if (!ignore) {
          if (profileRes.status === "fulfilled") {
            setProfile(profileRes.value.profile);
          }
          if (activeTripRes.status === "fulfilled") {
            setTripData(activeTripRes.value);
          }
        }
      } catch (err) {
        console.error("loadInitialData error:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

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
      ignore = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchDashboardData]);

  // Helper lấy tọa độ GPS hiện tại của điện thoại
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

  // 3. Workflow Action: Nhận Chuyến Xe (UC-29)
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
          message.warning("Đã ghi nhận đến nơi. Cảnh báo: Tọa độ ngoài bán kính kho (MSG50)!");
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

  // 5. Workflow Action: Bốc Hàng & Niêm Chì (BR-11, BR-31, BR-33)
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

    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const payload = {
        seal_number: sealNumber.trim(),
        seal_photo_url: sealPhotoUrl,
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
        message.success("Ghi nhận lấy hàng và niêm chì thành công!");
      }
      setSealModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Lỗi khi ghi nhận bốc hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Workflow Action: Giao Hàng & POD (BR-12, BR-39, BR-24)
  const handleSubmitDelivery = async () => {
    if (!activeStopTarget || !tripData?.trip?.id) return;
    if (!podPhotoUrl.trim()) {
      message.error("Hãy chụp biên bản giao nhận đã ký (MSG20)");
      return;
    }

    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const payload = {
        pod_photo_url: podPhotoUrl,
        receiver_name: receiverName.trim() || undefined,
        extra_fees: extraFees || 0,
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

  // Mở Google Maps dẫn đường tới điểm dừng
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

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-100 relative pb-28">
      {/* Background gradient */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-b-[40px] opacity-80 pointer-events-none overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-40"></div>
        <div className="absolute top-20 left-[-50px] w-48 h-48 bg-indigo-500 rounded-full blur-[60px] opacity-40"></div>
      </div>

      {/* PWA Connection Status Bar */}
      <div className={`fixed top-0 left-0 w-full z-50 px-4 py-2 text-center text-xs font-bold text-white transition-all backdrop-blur-md border-b flex items-center justify-center gap-2 ${isOffline ? "bg-red-500/80 border-red-500/50" : "bg-emerald-500/80 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"}`}>
        {isOffline ? (
          <><CloudOff size={14}/> LƯU TẠM (OFFLINE FIRST - BR-27)</>
        ) : (
          <><Cloud size={14}/> KẾT NỐI MẠNG ỔN ĐỊNH</>
        )}
      </div>

      <div className="max-w-lg mx-auto pt-14 px-4 relative z-10">
        
        {/* Header Section */}
        <div className="mb-6 flex items-center justify-between">
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
            className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center shadow-lg active:scale-95 transition-all"
            title="Làm mới"
          >
            <RefreshCw className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Chưa có chuyến xe */}
        {!trip ? (
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 text-center shadow-2xl mt-8">
            <Package className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-white mb-2">Hiện chưa có chuyến xe</h3>
            <p className="text-slate-400 text-sm mb-6">
              Bạn đang ở trạng thái sẵn sàng. Khi có chuyến xe mới được Điều phối viên phân bổ, thông tin sẽ xuất hiện ngay tại đây.
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
            <div className="mb-3 flex justify-between items-end">
              <h2 className="text-lg font-bold text-white tracking-wide">Chuyến xe hiện tại</h2>
              <div className="bg-blue-500/20 text-blue-200 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-inner">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                {trip.status.toUpperCase()}
              </div>
            </div>

            {/* Trip Summary Card */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-5 mb-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px]"></div>
              
              <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4 relative z-10">
                <div>
                  <p className="text-[10px] text-blue-200/80 font-bold uppercase tracking-widest mb-1">Mã Chuyến</p>
                  <h3 className="text-xl font-black text-white tracking-tight drop-shadow-sm">{trip.trip_code}</h3>
                  {truck && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-200 font-semibold mt-1">
                      <Truck size={14}/>
                      <span>Xe: {truck.plate_number}</span>
                      <span className="text-blue-300/70">({truck.model} - Tải trọng: {truck.allowed_payload} kg)</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-sm border border-white/10 text-white font-semibold text-xs">
                  <Package size={14} />
                  <span>{stops.length} Điểm dừng</span>
                </div>
              </div>

              {/* Stop Timeline */}
              <div className="space-y-4 relative z-10 pl-2">
                <div className="absolute left-[15px] top-6 bottom-4 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-500 opacity-50 z-0"></div>
                
                {stops.map((stop) => {
                  const isDone = stop.status === "Done";
                  const isArrived = stop.status === "Arrived";
                  const isPickup = stop.stop_type === "Pickup";

                  return (
                    <div key={stop.id} className="flex gap-4 relative z-10">
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-1 shadow-lg ${
                        isDone 
                          ? "bg-emerald-500 border-2 border-emerald-300" 
                          : isArrived 
                            ? "bg-amber-400 border-2 border-amber-200 animate-ping" 
                            : isPickup 
                              ? "bg-slate-900 border-[3px] border-blue-400" 
                              : "bg-slate-900 border-[3px] border-indigo-400"
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold tracking-wide uppercase text-blue-200/80">
                            #{stop.sequence} {isPickup ? "ĐIỂM LẤY HÀNG (PICKUP)" : "ĐIỂM GIAO HÀNG (DROP-OFF)"}
                          </p>
                          <Tag color={isDone ? "success" : isArrived ? "warning" : "default"} className="text-[10px] font-bold m-0">
                            {stop.status}
                          </Tag>
                        </div>
                        <p className="font-semibold text-white leading-tight mt-0.5 text-sm">
                          {stop.location?.name || stop.location?.address || "Kho hàng"}
                        </p>
                        <p className="text-xs text-slate-300/80 mt-0.5">
                          {stop.location?.address}
                        </p>
                        {stop.order && (
                          <div className="text-[11px] text-blue-200 mt-1 flex items-center gap-2">
                            <span>Mã đơn: <b>{stop.order.order_code}</b></span>
                            {stop.order.receiver_name && <span>• Người nhận: {stop.order.receiver_name}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workflow Control Box */}
            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-3xl p-5 mb-6 shadow-2xl">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Navigation2 className="w-4 h-4 text-indigo-400" />
                Thao tác Hành trình
              </h3>

              {/* Case 1: Trip is Assigned -> Need to Accept (UC-29) */}
              {trip.status === "Assigned" && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-center">
                  <p className="text-sm text-blue-200 font-semibold mb-3">
                    Chuyến xe đã được phân bổ cho bạn. Vui lòng xác nhận nhận chuyến để bắt đầu.
                  </p>
                  <Button 
                    type="primary" 
                    size="large"
                    loading={actionLoading}
                    onClick={() => handleAcceptTrip(trip.id)}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 border-none font-black rounded-xl h-12 shadow-lg shadow-blue-600/30"
                  >
                    XÁC NHẬN NHẬN CHUYẾN XE (UC-29)
                  </Button>
                </div>
              )}

              {/* Case 2: Trip Accepted or In Progress -> Process active stop */}
              {(trip.status === "Accepted" || trip.status === "In Progress") && currentStop && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400 font-bold uppercase">Điểm dừng tiếp theo</span>
                      <Tag color="processing" className="font-bold">Điểm #{currentStop.sequence}</Tag>
                    </div>
                    <p className="text-white font-bold text-sm">{currentStop.location?.name || currentStop.location?.address}</p>
                    <p className="text-xs text-slate-400">{currentStop.location?.address}</p>
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

                  {/* Step B: If Arrived & Pickup -> Bốc hàng & Niêm chì Modal */}
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

                  {/* Step C: If Arrived & Drop-off -> Giao hàng & POD Modal */}
                  {currentStop.status === "Arrived" && currentStop.stop_type === "Drop-off" && (
                    <Button 
                      type="primary" 
                      size="large"
                      onClick={() => {
                        setActiveStopTarget(currentStop);
                        setPodModalOpen(true);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 border-none font-black rounded-xl h-12 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                    >
                      <Camera size={18}/> GIAO HÀNG & CHỤP BIÊN BẢN POD (BR-12)
                    </Button>
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

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-800/90 backdrop-blur-xl border-t border-slate-700/60 p-4 pb-8 flex gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40 rounded-t-3xl">
        <Link 
          href="/driver/incidents" 
          className="flex-1 flex flex-col h-14 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 items-center justify-center text-red-400 font-bold rounded-2xl transition-colors active:scale-95"
        >
          <AlertTriangle size={18} className="mb-0.5"/>
          <span className="text-[10px] tracking-wide uppercase">Báo Sự cố</span>
        </Link>
        <button 
          onClick={() => handleOpenNavigation(
            currentStop?.location?.address || trip?.stops?.[0]?.location?.address,
            currentStop?.location?.latitude,
            currentStop?.location?.longitude
          )}
          className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 flex flex-row gap-2 h-14 items-center justify-center text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all active:scale-95"
        >
          <MapPin size={20}/>
          <span className="text-sm tracking-wide uppercase">Dẫn đường (Bản đồ)</span>
        </button>
      </div>

      {/* MODAL 1: BỐC HÀNG & NIÊM CHÌ (BR-11, BR-31, BR-33) */}
      <Modal 
        open={sealModalOpen} 
        onCancel={() => setSealModalOpen(false)} 
        title={<span className="font-bold text-slate-800">Ghi nhận Lấy hàng & Chụp Niêm Chì (BR-11)</span>} 
        okText="Lưu dữ liệu"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-blue-600 font-bold" }}
        onOk={handleSubmitPickup}
      >
        <div className="space-y-4 py-2">
          <p className="text-slate-500 text-xs">
            Bắt buộc chụp ảnh rõ số niêm chì kèm biển số xe tải. Nhập số chì và kiểm tra khối lượng hàng không vượt tải trọng cho phép.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Số chì niêm phong (*)</label>
            <Input 
              value={sealNumber} 
              onChange={(e) => setSealNumber(e.target.value)} 
              placeholder="VD: SEAL-8899" 
              className="py-2 rounded-lg font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Số kiện thực tế (*)</label>
              <InputNumber 
                min={1} 
                value={loadedPackages} 
                onChange={setLoadedPackages} 
                className="w-full py-1 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Khối lượng bốc (kg) (*)</label>
              <InputNumber 
                min={1} 
                value={loadedWeight} 
                onChange={setLoadedWeight} 
                className="w-full py-1 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Ảnh chụp niêm chì & biển số xe (*)</label>
            <Upload 
              listType="picture-card" 
              maxCount={1} 
              beforeUpload={() => false}
              defaultFileList={[{ uid: "-1", name: "seal.jpg", status: "done", url: sealPhotoUrl }]}
              onChange={(info) => {
                const file = info.fileList[0];
                if (file) setSealPhotoUrl(file.thumbUrl || file.url || "https://cdn.nexlog.vn/seal-sample.jpg");
              }}
            >
              <div className="text-slate-400 flex flex-col items-center">
                <Camera size={20} className="mb-1"/>
                <span className="text-xs">Chụp ảnh</span>
              </div>
            </Upload>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: GIAO HÀNG & BIÊN BẢN POD (BR-12, BR-39, BR-24) */}
      <Modal 
        open={podModalOpen} 
        onCancel={() => setPodModalOpen(false)} 
        title={<span className="font-bold text-slate-800">Biên bản Giao nhận Hàng POD (BR-12)</span>} 
        okText="Hoàn tất Giao hàng"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-emerald-600 font-bold" }}
        onOk={handleSubmitDelivery}
      >
        <div className="space-y-4 py-2">
          <p className="text-slate-500 text-xs">
            Bắt buộc chụp ảnh biên bản giao nhận hàng hóa (POD) đã có đầy đủ chữ ký xác nhận của bên nhận.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Ảnh chụp biên bản POD có chữ ký (*)</label>
            <Upload 
              listType="picture-card" 
              maxCount={2} 
              beforeUpload={() => false}
              defaultFileList={[{ uid: "-1", name: "pod.jpg", status: "done", url: podPhotoUrl }]}
              onChange={(info) => {
                const file = info.fileList[0];
                if (file) setPodPhotoUrl(file.thumbUrl || file.url || "https://cdn.nexlog.vn/pod-sample.jpg");
              }}
            >
              <div className="text-slate-400 flex flex-col items-center">
                <Camera size={20} className="mb-1"/>
                <span className="text-xs">Chụp POD</span>
              </div>
            </Upload>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Tên người nhận hàng (Tùy chọn)</label>
            <Input 
              value={receiverName} 
              onChange={(e) => setReceiverName(e.target.value)} 
              placeholder="VD: Trần Thị B" 
              className="py-2 rounded-lg"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Phụ phí phát sinh (VND) - Nếu có (BR-40)</label>
            <InputNumber 
              min={0} 
              step={10000} 
              value={extraFees} 
              onChange={setExtraFees} 
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              className="w-full py-1 rounded-lg"
            />
          </div>
        </div>
      </Modal>

      {/* Global CSS overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        .driver-steps-override .ant-steps-item-title,
        .driver-steps-override .ant-steps-item-description {
          color: #cbd5e1 !important;
        }
        .driver-steps-override .ant-steps-item-wait .ant-steps-item-icon {
          background-color: #1e293b;
          border-color: #475569;
        }
        .driver-steps-override .ant-steps-item-wait .ant-steps-icon {
          color: #94a3b8;
        }
        .driver-steps-override .ant-steps-item-process .ant-steps-item-icon {
          background-color: #2563eb;
          border-color: #2563eb;
        }
      `}} />
    </div>
  );
}
