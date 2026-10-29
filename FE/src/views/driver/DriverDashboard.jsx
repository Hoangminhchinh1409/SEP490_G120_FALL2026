"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Tag,
  Button,
  Modal,
  Upload,
  Input,
  InputNumber,
  message,
  Spin,
  Progress,
  Checkbox,
  Select,
} from "antd";
import {
  MapPin,
  Camera,
  CheckCircle,
  AlertTriangle,
  CloudOff,
  Cloud,
  Package,
  Navigation2,
  Truck,
  RefreshCw,
  Clock,
  FileText,
  DollarSign,
  Ban,
} from "lucide-react";
import { driverApi, queueOfflineAction } from "../../api/driverApi";
import OfflineSyncStatus from "./components/OfflineSyncStatus";
import {
  cacheTripDocuments,
  getCachedTripDocuments,
} from "../../utils/offlineQueue";

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
  const [cargoPhotoUrl, setCargoPhotoUrl] = useState(
    "https://cdn.nexlog.vn/cargo-check-sample.jpg",
  );
  const [loadedCargoPhotoUrl, setLoadedCargoPhotoUrl] = useState(
    "https://cdn.nexlog.vn/cargo-loaded-sample.jpg",
  );
  const [sealPhotoUrl, setSealPhotoUrl] = useState(
    "https://cdn.nexlog.vn/seal-sample.jpg",
  );
  const [sealNumber, setSealNumber] = useState("");
  const [loadedPackages, setLoadedPackages] = useState(50);
  const [loadedWeight, setLoadedWeight] = useState(500);

  // Form Inputs for POD & Delivery (BR-12)
  const [podPhotoUrl, setPodPhotoUrl] = useState(
    "https://cdn.nexlog.vn/pod-sample.jpg",
  );
  const [cutSealPhotoUrl, setCutSealPhotoUrl] = useState(
    "https://cdn.nexlog.vn/cut-seal-sample.jpg",
  );
  const [unloadedCargoPhotoUrl, setUnloadedCargoPhotoUrl] = useState(
    "https://cdn.nexlog.vn/unloaded-sample.jpg",
  );
  const [receiverName, setReceiverName] = useState("");
  const [docsHandedOver, setDocsHandedOver] = useState(true);
  const [deliveredPackages, setDeliveredPackages] = useState(50);

  // Form Inputs for Customer Refusal (BR-57)
  const [refusalReason, setRefusalReason] = useState("");
  const [refusalCargoPhoto, setRefusalCargoPhoto] = useState(
    "https://cdn.nexlog.vn/refusal-sample.jpg",
  );
  const [refusalNote, setRefusalNote] = useState("");

  // Form Inputs for Extra Fee (BR-30)
  const [feeType, setFeeType] = useState("Bốc xếp thêm");
  const [feeAmount, setFeeAmount] = useState(200000);
  const [feeReason, setFeeReason] = useState("");
  const [feePhotoUrl, setFeePhotoUrl] = useState(
    "https://cdn.nexlog.vn/fee-receipt.jpg",
  );

  const restDeadlineText = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  // 1. Tải dữ liệu chuyến xe hiện tại & hồ sơ tài xế
  const fetchDashboardData = useCallback(async () => {
    try {
      const [profileRes, activeTripRes] = await Promise.allSettled([
        driverApi.getMyProfile(),
        driverApi.getActiveTrip(),
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.profile || profileRes.value);
      }

      if (activeTripRes.status === "fulfilled" && activeTripRes.value?.trip) {
        setTripData(activeTripRes.value);
        // Lưu cache chứng từ chuyến xe ngoại tuyến (Mục 6781)
        await cacheTripDocuments(
          activeTripRes.value.trip.id,
          activeTripRes.value,
        );
      } else if (isOffline) {
        // Nếu ngoại tuyến và không lấy được từ server -> Đọc từ cache
        const cached = await getCachedTripDocuments("active");
        if (cached) {
          setTripData(cached);
        }
      }
    } catch (err) {
      console.error("fetchDashboardData error:", err);
    } finally {
      setLoading(false);
    }
  }, [isOffline]);

  // 2. Lắng nghe trạng thái Online / Offline & Tự động đồng bộ (BR-27)
  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchDashboardData();
    }, 0);

    const handleOnline = async () => {
      setIsOffline(false);
      message.success(
        "Đã kết nối lại Internet. Đang đồng bộ dữ liệu ngoại tuyến (BR-27)...",
      );
      try {
        const syncRes = await driverApi.syncPendingQueue();
        if (syncRes && syncRes.syncedCount > 0) {
          message.success(
            `Đã đồng bộ thành công ${syncRes.syncedCount} tác vụ lên máy chủ!`,
          );
        }
      } catch (e) {
        console.error("Auto sync failed", e);
      }
      void fetchDashboardData();
    };

    const handleOffline = () => {
      setIsOffline(true);
      message.warning(
        "Mất kết nối Internet. Chế độ Ngoại tuyến (Offline-First) đã được kích hoạt.",
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchDashboardData]);

  // Helper lấy tọa độ GPS
  const getCurrentGps = () => {
    return new Promise((resolve) => {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              phoneLat: pos.coords.latitude,
              phoneLng: pos.coords.longitude,
            }),
          () => resolve({ phoneLat: null, phoneLng: null }),
          { timeout: 5000, enableHighAccuracy: true },
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
      const clientActionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : undefined;

      if (isOffline) {
        queueOfflineAction({
          type: "ACCEPT_TRIP",
          tripId,
          payload: { clientActionId, phoneTime: new Date().toISOString() },
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
      const clientActionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : undefined;

      if (isOffline) {
        queueOfflineAction({
          type: "ARRIVE_STOP",
          tripId,
          stopId,
          payload: {
            ...coords,
            clientActionId,
            phoneTime: new Date().toISOString(),
          },
        });
        message.info("Đã ghi nhận đến điểm dừng (Ngoại tuyến).");
      } else {
        const res = await driverApi.arriveStop(tripId, stopId, {
          ...coords,
          clientActionId,
        });
        if (res.isOutsideRadius) {
          message.warning(
            "Đã ghi nhận đến nơi. Cảnh báo: Tọa độ ngoài bán kính cho phép (MSG50)!",
          );
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

  // 4b. Workflow Action: Bắt đầu bốc/dỡ hàng (Loading Started - BR-30, BR-36)
  const handleStartLoading = async (tripId, stopId) => {
    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const clientActionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : undefined;

      if (isOffline) {
        await queueOfflineAction({
          type: "RECORD_STOP_EVENT",
          tripId,
          stopId,
          payload: {
            eventType: "Loading Started",
            ...coords,
            clientActionId,
            phoneTime: new Date().toISOString(),
          },
        });
        message.info("Đã ghi nhận bắt đầu bốc/dỡ (Ngoại tuyến).");
      } else {
        const res = await driverApi.recordStopEvent(tripId, stopId, {
          eventType: "Loading Started",
          ...coords,
          clientActionId,
        });

        if (res.suggestedWaitingFee && res.suggestedWaitingFee > 0) {
          message.warning(
            `Thời gian chờ ${res.waitingMinutes}p vượt hạn mức (${res.freeWaitingMinutes}p). Gợi ý phụ phí chờ: ${res.suggestedWaitingFee.toLocaleString("vi-VN")} đ (BR-30)`,
          );
          setFeeType("Bốc xếp thêm");
          setFeeAmount(res.suggestedWaitingFee);
          setFeeReason(
            `Phí chờ bốc dỡ quá hạn ${res.waitingMinutes} phút tại điểm dừng #${currentStop?.sequence || ""}`,
          );
          setActiveStopTarget(currentStop);
          setExtraFeeModalOpen(true);
        } else {
          message.success(
            `Đã bắt đầu bốc/dỡ hàng. Thời gian chờ: ${res.waitingMinutes || 0} phút.`,
          );
        }
      }
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Không thể cập nhật bắt đầu bốc/dỡ");
    } finally {
      setActionLoading(false);
    }
  };

  // 4c. Workflow Action: Rời khỏi điểm dừng (Left - BR-36)
  const handleLeftStop = async (tripId, stopId) => {
    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const clientActionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : undefined;

      if (isOffline) {
        await queueOfflineAction({
          type: "RECORD_STOP_EVENT",
          tripId,
          stopId,
          payload: {
            eventType: "Left",
            ...coords,
            clientActionId,
            phoneTime: new Date().toISOString(),
          },
        });
        message.info("Đã ghi nhận rời đi (Ngoại tuyến).");
      } else {
        await driverApi.recordStopEvent(tripId, stopId, {
          eventType: "Left",
          ...coords,
          clientActionId,
        });
        message.success("Đã ghi nhận rời đi, tiếp tục hành trình!");
      }
      fetchDashboardData();
    } catch (err) {
      message.error(err.message || "Không thể cập nhật rời đi");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Workflow Action: Bốc Hàng & Niêm Chì 3 Bước (BR-11, BR-33, MSG45)
  const handleSubmitPickup = async () => {
    if (!activeStopTarget || !tripData?.trip?.id) return;
    if (!sealNumber.trim()) {
      message.error(
        "Hãy chụp rõ số chì và biển số xe, rồi nhập số chì (MSG18)",
      );
      return;
    }
    if (!loadedPackages || !loadedWeight) {
      message.error(
        "Vui lòng nhập số kiện và khối lượng hàng bốc thực tế (MSG02)",
      );
      return;
    }

    const truckPayload = tripData.trip.truck?.allowed_payload || 5000;
    if (parseFloat(loadedWeight) > truckPayload) {
      message.error(
        `Tổng khối lượng ${loadedWeight} kg vượt tải trọng cho phép ${truckPayload} kg của xe. (MSG45)`,
      );
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
        clientActionId:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : undefined,
      };

      if (isOffline) {
        queueOfflineAction({
          type: "RECORD_PICKUP",
          tripId: tripData.trip.id,
          stopId: activeStopTarget.id,
          payload,
        });
        message.info("Đã lưu bốc hàng và niêm chì (Ngoại tuyến).");
      } else {
        await driverApi.recordPickup(
          tripData.trip.id,
          activeStopTarget.id,
          payload,
        );
        await driverApi.recordStopEvent(tripData.trip.id, activeStopTarget.id, {
          eventType: "Loading Done",
        });
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
        message.error(
          "Hàng xuất khẩu bắt buộc chụp ảnh cắt chì và ảnh dỡ hàng (BR-12)",
        );
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
        clientActionId:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : undefined,
      };

      if (isOffline) {
        queueOfflineAction({
          type: "RECORD_DELIVERY",
          tripId: tripData.trip.id,
          stopId: activeStopTarget.id,
          payload,
        });
        message.info("Đã lưu biên bản giao nhận POD (Ngoại tuyến).");
      } else {
        const res = await driverApi.recordDelivery(
          tripData.trip.id,
          activeStopTarget.id,
          payload,
        );
        await driverApi.recordStopEvent(tripData.trip.id, activeStopTarget.id, {
          eventType: "Loading Done",
        });
        if (res.isTripCompleted) {
          message.success(
            "Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe (BR-24)!",
          );
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
        clientActionId:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : undefined,
      };

      if (isOffline) {
        queueOfflineAction({
          type: "REFUSE_CARGO",
          tripId: tripData.trip.id,
          stopId: activeStopTarget.id,
          payload,
        });
        message.info("Đã lưu báo cáo khách không nhận hàng (Ngoại tuyến).");
      } else {
        const res = await driverApi.reportCustomerRefusal(
          tripData.trip.id,
          activeStopTarget.id,
          payload,
        );
        message.success(
          res.message || "Đã ghi nhận khách không nhận hàng. (MSG74)",
        );
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
        clientActionId:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : undefined,
      };

      if (isOffline) {
        queueOfflineAction({
          type: "PROPOSE_EXTRA_FEE",
          tripId: tripData.trip.id,
          payload,
        });
        message.info("Đã lưu đề xuất phụ phí (Ngoại tuyến).");
      } else {
        const res = await driverApi.proposeExtraFee(tripData.trip.id, payload);
        message.success(
          res.message || "Đã gửi đề xuất phụ phí cho Điều phối viên! (MSG85)",
        );
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
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        "_blank",
      );
    } else if (destinationAddress) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationAddress)}`,
        "_blank",
      );
    } else {
      message.info("Không có thông tin địa chỉ để mở bản đồ");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200 p-6">
        <Spin size="large" />
        <p className="mt-4 font-semibold text-slate-300">
          Đang tải dữ liệu chuyến xe...
        </p>
      </div>
    );
  }

  const trip = tripData?.trip;
  const currentStop = tripData?.currentStop;
  const stops = trip?.stops || [];
  const truck = trip?.truck;
  const drivingHours = tripData?.drivingHours || profile?.drivingHours;

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-100 relative overflow-x-hidden">
      {/* Ambient background glow (Seamless gradient, no awkward cutoff arch) */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-700/20 via-indigo-900/10 to-transparent pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -right-10 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl"></div>
        <div className="absolute top-0 -left-10 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl"></div>
      </div>

      {/* PWA Connection Status Bar with Safe Area support */}
      <div
        className={`fixed top-0 left-0 right-0 max-w-md mx-auto z-40 px-3 pt-[max(0.4rem,env(safe-area-inset-top,0px))] pb-1.5 text-center text-xs font-bold text-white transition-all backdrop-blur-md border-b flex items-center justify-center gap-1.5 shadow-md ${
          isOffline
            ? "bg-red-600/90 border-red-500/50"
            : "bg-emerald-600/90 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
        }`}
      >
        {isOffline ? (
          <>
            <CloudOff size={13} /> LƯU TẠM (OFFLINE FIRST - BR-27)
          </>
        ) : (
          <>
            <Cloud size={13} /> KẾT NỐI MẠNG ỔN ĐỊNH
          </>
        )}
      </div>

      <div className="w-full pt-[calc(3rem+env(safe-area-inset-top,0px))] px-3.5 relative z-10">
        {/* Header Hero Card (Blue-Purple Gradient Element) */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-900 border border-blue-400/25 rounded-3xl p-4 mb-3 shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10 gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-black tracking-tight text-white drop-shadow-sm">
                  NEXLOG Driver
                </h1>
                <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-md">
                  PWA
                </span>
              </div>
              <p className="text-blue-100 text-xs font-semibold truncate">
                Xin chào,{" "}
                {profile?.user?.full_name || profile?.user?.username || "Tài xế"}
              </p>
              {profile?.license_number && (
                <span className="text-[10px] text-blue-200/90 font-mono block mt-0.5">
                  Bằng lái: {profile.license_number} ({profile.license_class})
                </span>
              )}
            </div>
            <button
              onClick={fetchDashboardData}
              className="w-10 h-10 shrink-0 bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md rounded-2xl border border-white/25 flex items-center justify-center shadow-md transition-all text-white"
              title="Làm mới"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* OFFLINE SYNC STATUS & MANUAL SYNC BUTTON (BR-27, BR-37, MSG39) */}
        <OfflineSyncStatus onSyncCompleted={fetchDashboardData} />

        {/* CẢNH BÁO GIỚI HẠN GIỜ LÁI XE TỨC THỜI (BR-34, MSG65) */}
        {drivingHours && Number(drivingHours.continuous_hours_left) <= 0.5 && (
          <div className="mb-3 p-3 bg-amber-500/20 border border-amber-500/50 rounded-2xl flex items-center gap-2.5 text-amber-200 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold block text-amber-300">
                CẢNH BÁO GIỚI HẠN GIỜ LÁI XE (MSG65)
              </span>
              Tài xế sắp vượt giới hạn lái xe (4 giờ). Cần nghỉ ngơi trước{" "}
              {restDeadlineText}.
            </div>
          </div>
        )}

        {/* WIDGET: Giờ lái an toàn còn lại (Screen 6.1 (4), BR-34) */}
        {drivingHours && (
          <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 mb-3 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock size={13} className="text-blue-400" /> Giờ lái còn lại
                (BR-34)
              </span>
              <span className="text-[9px] text-slate-400">Luật ATGT</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                <span className="text-[9px] text-slate-400 block font-medium truncate">
                  Liên tục (max 4h)
                </span>
                <span
                  className={`text-sm font-black ${drivingHours.continuous_hours_left < 1 ? "text-amber-400" : "text-emerald-400"}`}
                >
                  {drivingHours.continuous_hours_left}h
                </span>
                <Progress
                  percent={Math.min(
                    100,
                    Math.round(
                      ((4 - drivingHours.continuous_hours_left) / 4) * 100,
                    ),
                  )}
                  size="small"
                  showInfo={false}
                  strokeColor={
                    drivingHours.continuous_hours_left < 1
                      ? "#f59e0b"
                      : "#3b82f6"
                  }
                />
              </div>

              <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                <span className="text-[9px] text-slate-400 block font-medium truncate">
                  Hôm nay (max 10h)
                </span>
                <span className="text-sm font-black text-blue-400">
                  {drivingHours.daily_hours_left}h
                </span>
                <Progress
                  percent={Math.min(
                    100,
                    Math.round(
                      ((10 - drivingHours.daily_hours_left) / 10) * 100,
                    ),
                  )}
                  size="small"
                  showInfo={false}
                  strokeColor="#3b82f6"
                />
              </div>

              <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                <span className="text-[9px] text-slate-400 block font-medium truncate">
                  Tuần này (max 48h)
                </span>
                <span className="text-sm font-black text-indigo-400">
                  {drivingHours.weekly_hours_left}h
                </span>
                <Progress
                  percent={Math.min(
                    100,
                    Math.round(
                      ((48 - drivingHours.weekly_hours_left) / 48) * 100,
                    ),
                  )}
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
            <h3 className="text-lg font-bold text-white mb-2">
              Hiện chưa có chuyến xe
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Bạn đang ở trạng thái sẵn sàng. Khi có chuyến xe mới được phân bổ,
              thông tin sẽ xuất hiện ngay tại đây.
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
            <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Chuyến xe hiện tại
              </h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setDocsModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <FileText size={11} /> Chứng từ
                </button>
                <div className="bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                  {trip.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Trip Summary Card */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-3 mb-3 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-white/10 pb-2 mb-2 gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-blue-200/80 font-bold uppercase tracking-wider mb-0.5">
                    Mã Chuyến
                  </p>
                  <h3 className="text-lg font-black text-white tracking-tight truncate">
                    {trip.trip_code}
                  </h3>
                  {truck && (
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-blue-200 font-semibold mt-1">
                      <span className="flex items-center gap-1 shrink-0">
                        <Truck size={12} /> Xe: {truck.plate_number}
                      </span>
                      <span className="text-blue-300/70 text-[10px]">
                        ({truck.model} • {truck.allowed_payload ? `${truck.allowed_payload}kg` : ''})
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-xl text-white font-semibold text-[11px] shrink-0">
                  <Package size={12} />
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
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1 shadow-lg ${
                          isDone
                            ? "bg-emerald-500 border-2 border-emerald-300"
                            : isArrived
                              ? "bg-amber-400 border-2 border-amber-200 animate-ping"
                              : isPickup
                                ? "bg-slate-900 border-[2.5px] border-blue-400"
                                : "bg-slate-900 border-[2.5px] border-indigo-400"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold tracking-wide uppercase text-blue-200/80">
                            #{stop.sequence}{" "}
                            {isPickup
                              ? "LẤY HÀNG (PICKUP)"
                              : "GIAO HÀNG (DROP-OFF)"}
                          </p>
                          <Tag
                            color={
                              isDone
                                ? "success"
                                : isArrived
                                  ? "warning"
                                  : "default"
                            }
                            className="text-[10px] font-bold m-0 py-0 px-1.5"
                          >
                            {stop.status}
                          </Tag>
                        </div>
                        <p className="font-semibold text-white leading-tight text-xs mt-0.5">
                          {stop.location?.name ||
                            stop.location?.address ||
                            "Kho hàng"}
                        </p>
                        <p className="text-[11px] text-slate-300/80">
                          {stop.location?.address}
                        </p>
                        {stop.order && (
                          <div className="text-[10px] text-blue-200 mt-0.5 flex items-center gap-2">
                            <span>
                              Đơn: <b>{stop.order.order_code}</b>
                            </span>
                            {stop.order.receiver_name && (
                              <span>• Nhận: {stop.order.receiver_name}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workflow Control Box */}
            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 mb-4 shadow-2xl">
              <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation2 className="w-3.5 h-3.5 text-indigo-400" /> Thao tác Chuyến xe
                </span>
                {/* Propose Fee Button (Screen 6.2 (10)) */}
                <button
                  onClick={() => {
                    setActiveStopTarget(currentStop);
                    setExtraFeeModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30 transition-colors shrink-0"
                >
                  <DollarSign size={12} /> Đề xuất phí (BR-30)
                </button>
              </div>

              {/* Case 1: Trip is Assigned -> Need to Accept (MSG17, BR-09) */}
              {trip.status === "Assigned" && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-center">
                  <p className="text-xs text-blue-200 font-semibold mb-3">
                    Chuyến xe đã được điều phối cho bạn. Xác nhận nhận chuyến để
                    bắt đầu.
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
              {(trip.status === "Accepted" || trip.status === "In Progress") &&
                currentStop && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            Điểm dừng tiếp theo
                          </span>
                          <Tag
                            color="processing"
                            className="font-bold text-[10px] m-0 py-0"
                          >
                            #{currentStop.sequence}
                          </Tag>
                        </div>
                        <p className="text-white font-bold text-xs">
                          {currentStop.location?.name ||
                            currentStop.location?.address}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleOpenNavigation(
                            currentStop.location?.address,
                            currentStop.location?.latitude,
                            currentStop.location?.longitude,
                          )
                        }
                        className="p-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-xl border border-blue-500/40"
                        title="Mở Google Maps"
                      >
                        <MapPin size={18} />
                      </button>
                    </div>

                    {/* 4-Step Progress Stepper (BR-36, Workflow Spec Giai đoạn 3) */}
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/80 mb-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
                        <span>
                          Tiến trình điểm dừng #{currentStop.sequence} (Chuỗi 4
                          bước)
                        </span>
                        <span className="text-blue-300 font-mono">
                          {currentStop.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                        {/* Step 1: Arrived */}
                        <div
                          className={`p-2 rounded-xl border transition-all ${
                            currentStop.status !== "Pending"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                          }`}
                        >
                          <span className="block text-xs mb-0.5">
                            {currentStop.status !== "Pending" ? "✓" : "1"}
                          </span>
                          <span>Đã đến</span>
                        </div>

                        {/* Step 2: Loading Started */}
                        <div
                          className={`p-2 rounded-xl border transition-all ${
                            [
                              "Loading Started",
                              "Loading Done",
                              "Done",
                            ].includes(currentStop.status)
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : currentStop.status === "Arrived"
                                ? "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                                : "bg-slate-800 border-slate-700 text-slate-500"
                          }`}
                        >
                          <span className="block text-xs mb-0.5">
                            {[
                              "Loading Started",
                              "Loading Done",
                              "Done",
                            ].includes(currentStop.status)
                              ? "✓"
                              : "2"}
                          </span>
                          <span>Bắt đầu</span>
                        </div>

                        {/* Step 3: Loading Done */}
                        <div
                          className={`p-2 rounded-xl border transition-all ${
                            ["Loading Done", "Done"].includes(
                              currentStop.status,
                            )
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : currentStop.status === "Loading Started"
                                ? "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                                : "bg-slate-800 border-slate-700 text-slate-500"
                          }`}
                        >
                          <span className="block text-xs mb-0.5">
                            {["Loading Done", "Done"].includes(
                              currentStop.status,
                            )
                              ? "✓"
                              : "3"}
                          </span>
                          <span>
                            {currentStop.stop_type === "Pickup"
                              ? "Bốc/Chì"
                              : "Dỡ/POD"}
                          </span>
                        </div>

                        {/* Step 4: Left */}
                        <div
                          className={`p-2 rounded-xl border transition-all ${
                            currentStop.status === "Done"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : currentStop.status === "Loading Done"
                                ? "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                                : "bg-slate-800 border-slate-700 text-slate-500"
                          }`}
                        >
                          <span className="block text-xs mb-0.5">
                            {currentStop.status === "Done" ? "✓" : "4"}
                          </span>
                          <span>Rời đi</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 1: If Pending -> Arrive Button */}
                    {currentStop.status === "Pending" && (
                      <Button
                        type="primary"
                        size="large"
                        loading={actionLoading}
                        onClick={() =>
                          handleArriveStop(trip.id, currentStop.id)
                        }
                        className="w-full bg-blue-600 hover:bg-blue-500 border-none font-bold rounded-xl h-auto py-2.5 shadow-lg shadow-blue-600/30 flex items-center justify-center text-center text-white"
                      >
                        <div className="flex flex-col items-center justify-center w-full leading-tight">
                          <span className="text-xs font-black flex items-center gap-1.5">
                            <MapPin size={15} /> BƯỚC 1: ĐÃ ĐẾN NƠI (ARRIVED)
                          </span>
                          <span className="text-[10px] font-normal opacity-85">
                            Ghi nhận mốc giờ thực tế
                          </span>
                        </div>
                      </Button>
                    )}

                    {/* Step 2: If Arrived -> Bắt đầu bốc / dỡ (Loading Started - BR-30) */}
                    {currentStop.status === "Arrived" && (
                      <Button
                        type="primary"
                        size="large"
                        loading={actionLoading}
                        onClick={() =>
                          handleStartLoading(trip.id, currentStop.id)
                        }
                        className="w-full bg-amber-600 hover:bg-amber-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-amber-600/30 flex items-center justify-center text-center text-white"
                      >
                        <div className="flex flex-col items-center justify-center w-full leading-tight">
                          <span className="text-xs font-black flex items-center gap-1.5">
                            <Clock size={15} /> BƯỚC 2: BẮT ĐẦU BỐC / DỠ
                          </span>
                          <span className="text-[10px] font-normal opacity-85">
                            (Loading Started - BR-30)
                          </span>
                        </div>
                      </Button>
                    )}

                    {/* Step 3: If Loading Started & Pickup -> Bốc hàng & Niêm chì Modal (BR-11) */}
                    {currentStop.status === "Loading Started" &&
                      currentStop.stop_type === "Pickup" && (
                        <Button
                          type="primary"
                          size="large"
                          onClick={() => {
                            setActiveStopTarget(currentStop);
                            setSealModalOpen(true);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center text-center text-white"
                        >
                          <div className="flex flex-col items-center justify-center w-full leading-tight">
                            <span className="text-xs font-black flex items-center gap-1.5">
                              <Camera size={15} /> BƯỚC 3: BỐC HÀNG & ẢNH CHÌ
                            </span>
                            <span className="text-[10px] font-normal opacity-85">
                              (Record Cargo Pickup - BR-11)
                            </span>
                          </div>
                        </Button>
                      )}

                    {/* Step 3: If Loading Started & Drop-off -> Giao hàng & POD Modal / Từ chối (BR-12, BR-57) */}
                    {currentStop.status === "Loading Started" &&
                      currentStop.stop_type === "Drop-off" && (
                        <div className="grid grid-cols-5 gap-1.5">
                          <Button
                            type="primary"
                            size="large"
                            onClick={() => {
                              setActiveStopTarget(currentStop);
                              setPodModalOpen(true);
                            }}
                            className="col-span-3 bg-emerald-600 hover:bg-emerald-500 border-none rounded-xl h-auto py-2 shadow-lg shadow-emerald-600/30 flex flex-col items-center justify-center text-center text-white"
                          >
                            <span className="text-[11px] font-black flex items-center gap-1">
                              <Camera size={13} /> GIAO HÀNG & POD
                            </span>
                            <span className="text-[9px] opacity-85">(BR-12)</span>
                          </Button>

                          <Button
                            danger
                            size="large"
                            onClick={() => {
                              setActiveStopTarget(currentStop);
                              setRefusalModalOpen(true);
                            }}
                            className="col-span-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-xl h-auto py-2 flex flex-col items-center justify-center text-center"
                          >
                            <span className="text-[11px] font-bold flex items-center gap-1">
                              <Ban size={12} /> TỪ CHỐI
                            </span>
                            <span className="text-[9px] opacity-80">(BR-57)</span>
                          </Button>
                        </div>
                      )}

                    {/* Step 4: If Loading Done -> Rời khỏi điểm dừng (Left - BR-36) */}
                    {currentStop.status === "Loading Done" && (
                      <Button
                        type="primary"
                        size="large"
                        loading={actionLoading}
                        onClick={() => handleLeftStop(trip.id, currentStop.id)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-emerald-600/30 flex items-center justify-center text-center text-white"
                      >
                        <div className="flex flex-col items-center justify-center w-full leading-tight">
                          <span className="text-xs font-black flex items-center gap-1.5">
                            <CheckCircle size={15} /> BƯỚC 4: RỜI ĐI (LEFT)
                          </span>
                          <span className="text-[10px] font-normal opacity-85">
                            Tiếp tục lộ trình
                          </span>
                        </div>
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
                  <p className="text-xs text-slate-400 mt-1">
                    Xe và hồ sơ tài xế đã được giải phóng về trạng thái sẵn sàng
                    (BR-24).
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL 0: XÁC NHẬN NHẬN CHUYẾN (MSG17, BR-09) */}
      <Modal
        open={acceptModalOpen}
        centered
        width="94%"
        style={{ maxWidth: 440 }}
        onCancel={() => setAcceptModalOpen(false)}
        title={
          <span className="font-bold text-slate-800">
            Xác nhận nhận chuyến xe
          </span>
        }
        okText="Tôi đồng ý nhận chuyến"
        cancelText="Đóng"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-blue-600 font-bold" }}
        onOk={() => handleAcceptTrip(trip?.id)}
      >
        <p className="text-sm text-slate-600 my-2">
          Bạn có chắc chắn muốn nhận chuyến xe <b>{trip?.trip_code}</b> không?
          (MSG17)
        </p>
        <p className="text-xs text-slate-400">
          Sau khi xác nhận, chuyến xe sẽ chuyển sang trạng thái Đã nhận
          (Accepted).
        </p>
      </Modal>

      {/* MODAL 1: BỐC HÀNG & NIÊM CHÌ 3 BƯỚC (BR-11, BR-31, BR-33, MSG45) */}
      <Modal
        open={sealModalOpen}
        centered
        width="94%"
        style={{ maxWidth: 460 }}
        onCancel={() => setSealModalOpen(false)}
        title={
          <span className="font-bold text-slate-800">
            Lấy hàng & Niêm chì 3 Bước (BR-11)
          </span>
        }
        okText="Lưu lấy hàng (BR-11)"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-blue-600 font-bold" }}
        onOk={handleSubmitPickup}
      >
        <div className="space-y-3 py-2 text-xs">
          <p className="text-slate-500">
            Bắt buộc chụp đủ 3 ảnh: Hàng trước bốc, Hàng trong thùng xe, và Niêm
            chì kèm biển số xe.
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                1. Hàng trước bốc (*)
              </label>
              <Upload
                listType="picture-card"
                maxCount={1}
                beforeUpload={() => false}
                defaultFileList={[
                  {
                    uid: "-1",
                    name: "cargo.jpg",
                    status: "done",
                    url: cargoPhotoUrl,
                  },
                ]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f) setCargoPhotoUrl(f.thumbUrl || f.url || cargoPhotoUrl);
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16} />
                  <span className="text-[10px]">Trước bốc</span>
                </div>
              </Upload>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                2. Hàng trên xe (*)
              </label>
              <Upload
                listType="picture-card"
                maxCount={1}
                beforeUpload={() => false}
                defaultFileList={[
                  {
                    uid: "-2",
                    name: "loaded.jpg",
                    status: "done",
                    url: loadedCargoPhotoUrl,
                  },
                ]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f)
                    setLoadedCargoPhotoUrl(
                      f.thumbUrl || f.url || loadedCargoPhotoUrl,
                    );
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16} />
                  <span className="text-[10px]">Trong thùng</span>
                </div>
              </Upload>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                3. Chì & Biển số (*)
              </label>
              <Upload
                listType="picture-card"
                maxCount={1}
                beforeUpload={() => false}
                defaultFileList={[
                  {
                    uid: "-3",
                    name: "seal.jpg",
                    status: "done",
                    url: sealPhotoUrl,
                  },
                ]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f) setSealPhotoUrl(f.thumbUrl || f.url || sealPhotoUrl);
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16} />
                  <span className="text-[10px]">Chì & biển</span>
                </div>
              </Upload>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Số chì niêm phong (*)
            </label>
            <Input
              value={sealNumber}
              onChange={(e) => setSealNumber(e.target.value)}
              placeholder="VD: SEAL-998811"
              className="py-1.5 font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Số kiện bốc (*)
              </label>
              <InputNumber
                min={1}
                value={loadedPackages}
                onChange={setLoadedPackages}
                className="w-full"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Khối lượng (kg) (*)
              </label>
              <InputNumber
                min={1}
                value={loadedWeight}
                onChange={setLoadedWeight}
                className="w-full"
              />
            </div>
          </div>
          {tripData?.trip?.truck && (
            <span className="text-[11px] text-slate-400 block">
              Tải trọng cho phép của xe:{" "}
              <b>{tripData.trip.truck.allowed_payload} kg</b> (BR-33)
            </span>
          )}
        </div>
      </Modal>

      {/* MODAL 2: GIAO HÀNG & BIÊN BẢN POD (BR-12, BR-39, BR-24) */}
      <Modal
        open={podModalOpen}
        centered
        width="94%"
        style={{ maxWidth: 460 }}
        onCancel={() => setPodModalOpen(false)}
        title={
          <span className="font-bold text-slate-800">
            Biên bản Giao nhận Hàng POD (BR-12)
          </span>
        }
        okText="Lưu giao hàng (BR-12)"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-emerald-600 font-bold" }}
        onOk={handleSubmitDelivery}
      >
        <div className="space-y-3 py-2 text-xs">
          {activeStopTarget?.order?.order_type === "Export" ? (
            <div>
              <p className="text-blue-600 font-bold mb-2">
                Đơn hàng Xuất Khẩu: Chụp ảnh cắt chì & ảnh dỡ hàng
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Ảnh cắt chì (*)
                  </label>
                  <Upload
                    listType="picture-card"
                    maxCount={1}
                    beforeUpload={() => false}
                    defaultFileList={[
                      {
                        uid: "-1",
                        name: "cut.jpg",
                        status: "done",
                        url: cutSealPhotoUrl,
                      },
                    ]}
                    onChange={(i) => {
                      const f = i.fileList[0];
                      if (f)
                        setCutSealPhotoUrl(
                          f.thumbUrl || f.url || cutSealPhotoUrl,
                        );
                    }}
                  >
                    <div className="flex flex-col items-center text-slate-400">
                      <Camera size={16} />
                      <span className="text-[10px]">Cắt chì</span>
                    </div>
                  </Upload>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Ảnh dỡ hàng (*)
                  </label>
                  <Upload
                    listType="picture-card"
                    maxCount={1}
                    beforeUpload={() => false}
                    defaultFileList={[
                      {
                        uid: "-2",
                        name: "unloaded.jpg",
                        status: "done",
                        url: unloadedCargoPhotoUrl,
                      },
                    ]}
                    onChange={(i) => {
                      const f = i.fileList[0];
                      if (f)
                        setUnloadedCargoPhotoUrl(
                          f.thumbUrl || f.url || unloadedCargoPhotoUrl,
                        );
                    }}
                  >
                    <div className="flex flex-col items-center text-slate-400">
                      <Camera size={16} />
                      <span className="text-[10px]">Dỡ hàng</span>
                    </div>
                  </Upload>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Ảnh biên bản POD có ký nhận (*)
              </label>
              <Upload
                listType="picture-card"
                maxCount={1}
                beforeUpload={() => false}
                defaultFileList={[
                  {
                    uid: "-1",
                    name: "pod.jpg",
                    status: "done",
                    url: podPhotoUrl,
                  },
                ]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f) setPodPhotoUrl(f.thumbUrl || f.url || podPhotoUrl);
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16} />
                  <span className="text-[10px]">Chụp POD</span>
                </div>
              </Upload>
              <div>
                <label className="font-bold text-slate-700 block mb-1 mt-2">
                  Họ tên người nhận hàng (*)
                </label>
                <Input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="VD: Nguyễn Văn C"
                  className="py-1.5"
                />
              </div>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Số kiện đã giao thực tế
            </label>
            <InputNumber
              min={1}
              value={deliveredPackages}
              onChange={setDeliveredPackages}
              className="w-full"
            />
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Hiển thị:{" "}
              <b>
                {deliveredPackages} trên tổng {loadedPackages} kiện
              </b>
            </span>
          </div>

          <div className="pt-1">
            <Checkbox
              checked={docsHandedOver}
              onChange={(e) => setDocsHandedOver(e.target.checked)}
              className="font-bold text-slate-700"
            >
              Đã bàn giao đủ chứng từ (BR-12)
            </Checkbox>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: KHÁCH KHÔNG NHẬN HÀNG (Screen 6.2 (9), BR-57, MSG74, MSG75) */}
      <Modal
        open={refusalModalOpen}
        centered
        width="94%"
        style={{ maxWidth: 460 }}
        onCancel={() => setRefusalModalOpen(false)}
        title={
          <span className="font-bold text-red-600 flex items-center gap-1.5">
            <Ban size={18} /> Khách không nhận hàng (BR-57)
          </span>
        }
        okText="Gửi báo cáo từ chối"
        confirmLoading={actionLoading}
        okButtonProps={{ danger: true, className: "font-bold" }}
        onOk={handleSubmitRefusal}
      >
        <div className="space-y-3 py-2 text-xs">
          <p className="text-slate-500">
            Ghi nhận khách từ chối nhận hàng tại điểm giao. Đơn hàng sẽ được
            chuyển sang <b>Delivered (Exception)</b> và gửi cảnh báo cho Điều
            phối viên (MSG75).
          </p>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Lý do từ chối (*) (Bắt buộc)
            </label>
            <Input
              value={refusalReason}
              onChange={(e) => setRefusalReason(e.target.value)}
              placeholder="VD: Hàng móp méo, khách không nhận; sai địa chỉ..."
              className="py-1.5"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Ảnh hiện trường hàng hóa (*) (Bắt buộc)
            </label>
            <Upload
              listType="picture-card"
              maxCount={1}
              beforeUpload={() => false}
              defaultFileList={[
                {
                  uid: "-1",
                  name: "refusal.jpg",
                  status: "done",
                  url: refusalCargoPhoto,
                },
              ]}
              onChange={(i) => {
                const f = i.fileList[0];
                if (f)
                  setRefusalCargoPhoto(
                    f.thumbUrl || f.url || refusalCargoPhoto,
                  );
              }}
            >
              <div className="flex flex-col items-center text-slate-400">
                <Camera size={16} />
                <span className="text-[10px]">Ảnh hàng</span>
              </div>
            </Upload>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Ghi chú bổ sung (Tùy chọn)
            </label>
            <Input.TextArea
              rows={2}
              value={refusalNote}
              onChange={(e) => setRefusalNote(e.target.value)}
              placeholder="Ý kiến của khách, thời gian chờ..."
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 4: ĐỀ XUẤT PHỤ PHÍ (Screen 6.2 (10), BR-30, MSG85) */}
      <Modal
        open={extraFeeModalOpen}
        centered
        width="94%"
        style={{ maxWidth: 460 }}
        onCancel={() => setExtraFeeModalOpen(false)}
        title={
          <span className="font-bold text-amber-600 flex items-center gap-1.5">
            <DollarSign size={18} /> Đề xuất Phụ phí (BR-30)
          </span>
        }
        okText="Gửi đề xuất phí (MSG85)"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-amber-600 font-bold" }}
        onOk={handleSubmitExtraFee}
      >
        <div className="space-y-3 py-2 text-xs">
          <p className="text-slate-500">
            Phụ phí đề xuất sẽ ở trạng thái <b>Proposed</b>. Điều phối viên sẽ
            nhận được thông báo để xác nhận hoặc từ chối (BR-30).
          </p>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Loại phụ phí (*) (Bắt buộc)
            </label>
            <Select value={feeType} onChange={setFeeType} className="w-full">
              <Select.Option value="Bốc xếp thêm">Bốc xếp thêm</Select.Option>
              <Select.Option value="Nâng hạ">Nâng hạ</Select.Option>
              <Select.Option value="Trả kho thay khách">
                Trả kho thay khách
              </Select.Option>
            </Select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Số tiền đề xuất (VND) (*)
            </label>
            <InputNumber
              min={1000}
              step={10000}
              value={feeAmount}
              onChange={setFeeAmount}
              formatter={(val) =>
                `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Lý do phát sinh (*) (Bắt buộc)
            </label>
            <Input
              value={feeReason}
              onChange={(e) => setFeeReason(e.target.value)}
              placeholder="VD: Không có xe nâng, phải thuê nhân công bốc dỡ ngoài..."
              className="py-1.5"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Ảnh chứng từ / Biên lai (*) (Bắt buộc)
            </label>
            <Upload
              listType="picture-card"
              maxCount={1}
              beforeUpload={() => false}
              defaultFileList={[
                {
                  uid: "-1",
                  name: "receipt.jpg",
                  status: "done",
                  url: feePhotoUrl,
                },
              ]}
              onChange={(i) => {
                const f = i.fileList[0];
                if (f) setFeePhotoUrl(f.thumbUrl || f.url || feePhotoUrl);
              }}
            >
              <div className="flex flex-col items-center text-slate-400">
                <Camera size={16} />
                <span className="text-[10px]">Chứng từ</span>
              </div>
            </Upload>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: CHỨNG TỪ CHUYẾN XE (Screen 6.1 (5), 6.2 (2)) */}
      <Modal
        open={docsModalOpen}
        centered
        width="94%"
        style={{ maxWidth: 460 }}
        onCancel={() => setDocsModalOpen(false)}
        title={
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <FileText size={18} /> Chứng từ chuyến xe
          </span>
        }
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setDocsModalOpen(false)}
          >
            Đóng
          </Button>,
        ]}
      >
        <div className="py-2 text-xs space-y-3">
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              1. Giấy vận tải điện tử (Waybill)
            </span>
            <p className="text-slate-600">
              Mã chuyến: <b>{trip?.trip_code}</b>
            </p>
            <p className="text-slate-600">
              Xe phụ trách: <b>{truck?.plate_number}</b> ({truck?.model})
            </p>
            <p className="text-slate-600">Lộ trình: {stops.length} điểm dừng</p>
          </div>

          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              2. Chứng từ khách hàng đính kèm
            </span>
            {stops.map((s) => (
              <div
                key={s.id}
                className="py-1 border-b border-slate-200 last:border-0"
              >
                <span className="font-semibold text-slate-700">
                  Điểm #{s.sequence} - Đơn {s.order?.order_code || "N/A"}:
                </span>
                <p className="text-slate-500 text-[11px]">
                  Người nhận: {s.order?.receiver_name || "Khách hàng"} • ĐT:{" "}
                  {s.order?.receiver_phone || "N/A"}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            Chứng từ chuyến xe đã được lưu đệm trên thiết bị để bạn có thể xem
            lại ngay cả khi mất sóng (BR-27).
          </p>
        </div>
      </Modal>
    </div>
  );
}
