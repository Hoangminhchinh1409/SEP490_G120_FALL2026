"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Tag,
  Button,
  Modal,
  Upload,
  Input,
  InputNumber,
  App,
  Spin,
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
  LogOut,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { driverApi, queueOfflineAction } from "../../api/driverApi";
import Link from "next/link";
import dayjs from "dayjs";
import { useAuth } from "../../providers/AuthProvider";
import { getPendingCount } from "../../utils/offlineQueue";
import OfflineSyncStatus from "./components/OfflineSyncStatus";
import DriverDashboardModals from "./components/DriverDashboardModals";
import {
  cacheTripDocuments,
  getCachedTripDocuments,
} from "../../utils/offlineQueue";

// Helper nhận diện điểm lấy hàng (Pickup) hay điểm giao hàng (Drop-off) chuẩn nghiệp vụ ALS
const isPickupStop = (stop) => {
  if (!stop) return false;
  const raw = String(stop.stop_type || stop.type || "").trim().toUpperCase();
  if (raw === "PICKUP" || raw === "LẤY HÀNG" || raw === "LAY HANG") return true;
  if (
    raw === "DROPOFF" ||
    raw === "DROP-OFF" ||
    raw === "DROP_OFF" ||
    raw === "DELIVERY" ||
    raw === "GIAO HÀNG" ||
    raw === "GIAO HANG" ||
    raw === "REST" ||
    raw === "TRANSIT"
  ) {
    return false;
  }
  // Quy chuẩn nghiệp vụ vận tải ALS: Điểm dừng sequence 1 luôn là điểm lấy hàng (Pickup)
  return stop.sequence === 1;
};

const isDropoffStop = (stop) => {
  if (!stop) return false;
  return !isPickupStop(stop);
};

// Chuẩn hóa nhãn trạng thái điểm dừng sang tiếng Việt
const formatStopStatus = (status, stopType = "Pickup") => {
  switch (status) {
    case "Pending":
      return "Chờ xử lý";
    case "Arrived":
      return "Đã đến nơi";
    case "Loading Started":
      return stopType === "Pickup" ? "Đang bốc hàng" : "Đang dỡ hàng";
    case "Loading Done":
      return stopType === "Pickup" ? "Đã bốc xong" : "Đã dỡ xong";
    case "Done":
      return "Hoàn thành";
    case "Skipped":
      return "Bỏ qua";
    case "Cancelled":
      return "Đã hủy";
    default:
      return status || "Chờ xử lý";
  }
};

// Chuẩn hóa nhãn trạng thái chuyến xe sang tiếng Việt
const formatTripStatus = (status) => {
  switch (status) {
    case "Assigned":
      return "Sắp tới";
    case "Accepted":
      return "Đã nhận";
    case "In Progress":
      return "Đang chạy";
    case "Completed":
      return "Hoàn thành";
    case "Cancelled":
      return "Đã hủy";
    default:
      return status || "Không xác định";
  }
};

export default function DriverDashboard() {
  const { message } = App.useApp();
  const { logout } = useAuth();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      return !navigator.onLine;
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [tripWeekOffset, setTripWeekOffset] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramId = params.get("tripId");
      if (paramId) {
        setTimeout(() => {
          setSelectedTripId(Number(paramId));
        }, 0);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);
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


  const formatTripDateTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}p`;
    if (h > 0) return `${h}h`;
    return `${m}p`;
  };

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

      if (activeTripRes.status === "fulfilled") {
        if (activeTripRes.value?.trip) {
          setTripData(activeTripRes.value);
          // Lưu cache chứng từ chuyến xe ngoại tuyến (Mục 6781)
          await cacheTripDocuments(
            activeTripRes.value.trip.id,
            activeTripRes.value,
          );
        } else if (!isOffline) {
          // Khi server trả về không có chuyến xe nào đang hoạt động
          setTripData((prev) => {
            // Giữ lại giao diện chúc mừng hoàn tất chuyến xe nếu chuyến vừa kết thúc trong phiên
            if (prev?.trip?.status === "Completed") return prev;
            return activeTripRes.value || { hasActiveTrip: false, trip: null };
          });
        }
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

  const getActiveDisplayedTrip = () => {
    const list = tripData?.upcomingTrips || (tripData?.trip ? [tripData.trip] : []);
    return (selectedTripId ? list.find((t) => t.id === selectedTripId) : null) || tripData?.trip || null;
  };

  const patchTripState = (targetTripId, tripUpdater, stopUpdater) => {
    setTripData((prev) => {
      if (!prev) return prev;
      const nextUpcoming = (prev.upcomingTrips || []).map((t) =>
        t.id === targetTripId ? tripUpdater(t) : t,
      );
      const nextMainTrip =
        prev.trip && prev.trip.id === targetTripId ? tripUpdater(prev.trip) : prev.trip;
      const nextStop =
        typeof stopUpdater === "function"
          ? stopUpdater(prev, nextMainTrip)
          : stopUpdater !== undefined
            ? stopUpdater
            : prev.currentStop;
      return {
        ...prev,
        hasActiveTrip: true,
        trip: nextMainTrip,
        upcomingTrips: nextUpcoming,
        currentStop: nextStop,
      };
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
        await queueOfflineAction({
          type: "ACCEPT_TRIP",
          tripId,
          payload: { clientActionId, phoneTime: new Date().toISOString() },
        });
        message.info("Đã ghi nhận nhận chuyến xe (Ngoại tuyến).");
        patchTripState(
          tripId,
          (t) => ({ ...t, status: "Accepted" }),
          (prev, nextMain) => {
            const firstStop =
              (nextMain?.stops || []).find((s) => s.status !== "Done") ||
              nextMain?.stops?.[0] ||
              null;
            return prev.currentStop || firstStop;
          },
        );
      } else {
        const res = await driverApi.acceptTrip(tripId, { clientActionId });
        message.success(res.message || "Đã nhận chuyến xe thành công!");
        await fetchDashboardData();
      }
      setAcceptModalOpen(false);
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
        await queueOfflineAction({
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
        const nowIso = new Date().toISOString();
        patchTripState(
          tripId,
          (t) => ({
            ...t,
            status: "In Progress",
            stops: (t.stops || []).map((s) =>
              s.id === stopId ? { ...s, status: "Arrived", actual_arrival: nowIso } : s,
            ),
          }),
          (prev) => ({
            ...(prev.currentStop || {}),
            status: "Arrived",
            actual_arrival: nowIso,
          }),
        );
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
        await fetchDashboardData();
      }
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
        patchTripState(
          tripId,
          (t) => ({
            ...t,
            stops: (t.stops || []).map((s) =>
              s.id === stopId ? { ...s, status: "Loading Started" } : s,
            ),
          }),
          (prev) => ({
            ...(prev.currentStop || {}),
            status: "Loading Started",
          }),
        );
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
        await fetchDashboardData();
      }
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
        patchTripState(
          tripId,
          (t) => {
            const updatedStops = (t.stops || []).map((s) =>
              s.id === stopId ? { ...s, status: "Done" } : s,
            );
            const hasMore = updatedStops.some((s) => s.status !== "Done");
            return {
              ...t,
              status: hasMore ? "In Progress" : "Completed",
              stops: updatedStops,
            };
          },
          (_prev, nextMain) => (nextMain?.stops || []).find((s) => s.status !== "Done") || null,
        );
      } else {
        await driverApi.recordStopEvent(tripId, stopId, {
          eventType: "Left",
          ...coords,
          clientActionId,
        });
        message.success("Đã ghi nhận rời đi, tiếp tục hành trình!");
        await fetchDashboardData();
      }
    } catch (err) {
      message.error(err.message || "Không thể cập nhật rời đi");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Workflow Action: Bốc Hàng & Niêm Chì 3 Bước (BR-11, BR-33, MSG45)
  const handleSubmitPickup = async () => {
    const targetTrip = getActiveDisplayedTrip();
    if (!activeStopTarget || !targetTrip?.id) return;
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

    const truckPayload = targetTrip.truck?.allowed_payload || 5000;
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
        await queueOfflineAction({
          type: "RECORD_PICKUP",
          tripId: targetTrip.id,
          stopId: activeStopTarget.id,
          payload,
        });
        message.info("Đã lưu bốc hàng và niêm chì (Ngoại tuyến).");
        patchTripState(
          targetTrip.id,
          (t) => ({
            ...t,
            stops: (t.stops || []).map((s) =>
              s.id === activeStopTarget.id
                ? {
                    ...s,
                    status: "Loading Done",
                    loaded_packages: payload.loaded_packages,
                    loaded_weight: payload.loaded_weight,
                  }
                : s,
            ),
          }),
          (prev) => ({
            ...(prev.currentStop || {}),
            status: "Loading Done",
          }),
        );
      } else {
        await driverApi.recordPickup(
          targetTrip.id,
          activeStopTarget.id,
          payload,
        );
        await driverApi.recordStopEvent(targetTrip.id, activeStopTarget.id, {
          eventType: "Loading Done",
        });
        message.success("Ghi nhận lấy hàng và niêm chì thành công! (BR-11)");
        await fetchDashboardData();
      }
      setSealModalOpen(false);
    } catch (err) {
      message.error(err.message || "Lỗi khi ghi nhận bốc hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Workflow Action: Giao Hàng & POD (BR-12, BR-19, BR-24)
  const handleSubmitDelivery = async () => {
    const targetTrip = getActiveDisplayedTrip();
    if (!activeStopTarget || !targetTrip?.id) return;
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

      const applyDeliveryUpdate = (forceComplete) => {
        patchTripState(
          targetTrip.id,
          (t) => {
            const updatedStops = (t.stops || []).map((s) =>
              s.id === activeStopTarget.id
                ? {
                    ...s,
                    status: "Done",
                    delivered_quantity: payload.delivered_packages,
                  }
                : s,
            );
            const hasMore = updatedStops.some((s) => s.status !== "Done");
            return {
              ...t,
              status: forceComplete || !hasMore ? "Completed" : "In Progress",
              stops: updatedStops,
            };
          },
          (_prev, nextMain) => {
            const nextUndone = (nextMain?.stops || []).find((s) => s.status !== "Done");
            return nextUndone || { ...activeStopTarget, status: "Done" };
          },
        );
      };

      if (isOffline) {
        await queueOfflineAction({
          type: "RECORD_DELIVERY",
          tripId: targetTrip.id,
          stopId: activeStopTarget.id,
          payload,
        });
        message.info("Đã lưu biên bản giao nhận POD (Ngoại tuyến).");
        applyDeliveryUpdate(false);
      } else {
        const res = await driverApi.recordDelivery(
          targetTrip.id,
          activeStopTarget.id,
          payload,
        );
        if (res.isTripCompleted) {
          message.success(
            "Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe (BR-24)!",
          );
          applyDeliveryUpdate(true);
        } else {
          message.success("Ghi nhận giao hàng và lưu POD thành công!");
          await fetchDashboardData();
        }
      }
      setPodModalOpen(false);
    } catch (err) {
      message.error(err.message || "Lỗi khi ghi nhận giao hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Workflow Action: Khách không nhận hàng (BR-57, MSG74, MSG75)
  const handleSubmitRefusal = async () => {
    const targetTrip = getActiveDisplayedTrip();
    if (!activeStopTarget || !targetTrip?.id) return;
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
        await queueOfflineAction({
          type: "REFUSE_CARGO",
          tripId: targetTrip.id,
          stopId: activeStopTarget.id,
          payload,
        });
        message.info("Đã lưu báo cáo khách không nhận hàng (Ngoại tuyến).");
        patchTripState(
          targetTrip.id,
          (t) => ({
            ...t,
            stops: (t.stops || []).map((s) =>
              s.id === activeStopTarget.id ? { ...s, status: "Done" } : s,
            ),
          }),
          { ...activeStopTarget, status: "Done" },
        );
      } else {
        const res = await driverApi.reportCustomerRefusal(
          targetTrip.id,
          activeStopTarget.id,
          payload,
        );
        message.success(
          res.message || "Đã ghi nhận khách không nhận hàng. (MSG74)",
        );
        patchTripState(
          targetTrip.id,
          (t) => ({
            ...t,
            stops: (t.stops || []).map((s) =>
              s.id === activeStopTarget.id ? { ...s, status: "Done" } : s,
            ),
          }),
          { ...activeStopTarget, status: "Done" },
        );
        await fetchDashboardData();
      }
      setRefusalModalOpen(false);
      setRefusalReason("");
      setRefusalNote("");
    } catch (err) {
      message.error(err.message || "Lỗi khi gửi báo cáo từ chối nhận hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Workflow Action: Đề xuất phụ phí (BR-30, MSG85)
  const handleSubmitExtraFee = async () => {
    const targetTrip = getActiveDisplayedTrip();
    if (!targetTrip?.id) return;
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
        await queueOfflineAction({
          type: "PROPOSE_EXTRA_FEE",
          tripId: targetTrip.id,
          payload,
        });
        message.info("Đã lưu đề xuất phụ phí (Ngoại tuyến).");
      } else {
        const res = await driverApi.proposeExtraFee(targetTrip.id, payload);
        message.success(
          res.message || "Đã gửi đề xuất phụ phí cho Điều phối viên! (MSG85)",
        );
      }
      setExtraFeeModalOpen(false);
      setFeeReason("");
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

  const upcomingTrips = tripData?.upcomingTrips || (tripData?.trip ? [tripData.trip] : []);
  const trip = (selectedTripId ? upcomingTrips.find((t) => t.id === selectedTripId) : null) || tripData?.trip || null;
  const currentStop = (trip?.stops && trip.stops.find((s) => s.status !== "Done")) || tripData?.currentStop;
  const stops = trip?.stops || [];
  const truck = trip?.truck;
  const drivingHours = tripData?.drivingHours || profile?.drivingHours;

  const getMondayOfWeek = (d) => {
    const day = d.day();
    const diff = day === 0 ? -6 : 1 - day;
    return d.startOf("day").add(diff, "day");
  };
  const selectedWeekMonday = getMondayOfWeek(dayjs()).add(tripWeekOffset, "week");
  const selectedWeekSunday = selectedWeekMonday.add(6, "day");
  const weekStartStr = selectedWeekMonday.format("YYYY-MM-DD");
  const weekEndStr = selectedWeekSunday.format("YYYY-MM-DD");
  const weekTitleLabel =
    tripWeekOffset === 0
      ? "Tuần này"
      : tripWeekOffset === 1
        ? "Tuần sau"
        : tripWeekOffset === -1
          ? "Tuần trước"
          : `Tuần ${selectedWeekMonday.format("DD/MM")}`;
  const filteredWeekTrips = upcomingTrips.filter((t) => {
    const rawDate = t.planned_start || t.created_at;
    if (!rawDate) return tripWeekOffset === 0;
    const dStr = dayjs(rawDate).format("YYYY-MM-DD");
    return dStr >= weekStartStr && dStr <= weekEndStr;
  });

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
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={fetchDashboardData}
                className="w-9 h-9 bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md rounded-2xl border border-white/25 flex items-center justify-center shadow-md transition-all text-white"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  try {
                    const count = await getPendingCount();
                    setPendingOfflineCount(count);
                  } catch {
                    setPendingOfflineCount(0);
                  }
                  setLogoutModalOpen(true);
                }}
                className="w-9 h-9 bg-red-500/20 hover:bg-red-500/35 active:scale-95 backdrop-blur-md rounded-2xl border border-red-400/30 flex items-center justify-center shadow-md transition-all text-red-100 hover:text-white"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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

        {/* WIDGET: Giờ lái an toàn còn lại (Screen 6.1 (4), BR-34) - Chỉ giữ giới hạn 4h liên tục */}
        {drivingHours && (
          <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 mb-3 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock size={13} className="text-blue-400" /> Giờ lái liên tục còn lại (BR-34)
              </span>
              <span className="text-[9px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700/60">
                Luật ATGT • Tối đa 4h
              </span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Thời gian lái liên tục cho phép:
                </span>
                <span
                  className={`text-base font-black ${
                    drivingHours.continuous_hours_left < 1 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {drivingHours.continuous_hours_left}h
                  <span className="text-xs text-slate-400 font-normal ml-1">/ 4h</span>
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden my-2 border border-slate-700/80">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    drivingHours.continuous_hours_left < 1 ? "bg-amber-400" : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, Math.round(((4 - drivingHours.continuous_hours_left) / 4) * 100))
                    )}%`
                  }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                <span>Đã chạy: {Math.max(0, 4 - drivingHours.continuous_hours_left).toFixed(1)}h</span>
                <span>Còn lại: {drivingHours.continuous_hours_left}h (nghỉ tối thiểu 15 phút)</span>
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
            {/* BỘ CHỌN CHUYẾN XE SẮP TỚI THEO TỪNG TUẦN */}
            {upcomingTrips && upcomingTrips.length > 0 && (
              <div className="mb-3 bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 shadow-xl space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-slate-200 flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-400" />
                      Chuyến xe sắp tới
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {dayjs().format("DD/MM/YYYY")}
                    </span>
                  </div>
                  <Link
                    href="/driver/trips"
                    className="text-[10px] text-slate-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Sổ chuyến ({upcomingTrips.length})</span>
                    <span>→</span>
                  </Link>
                </div>

                {/* Bộ chuyển tuần (chỉ hiển thị chuyến trong từng tuần) */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/75 border border-slate-700/60 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setTripWeekOffset((w) => w - 1)}
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Tuần trước"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripWeekOffset(0)}
                    className="flex-1 text-center text-[11px] text-slate-200 font-semibold cursor-pointer"
                    title="Bấm để quay về tuần hiện tại"
                  >
                    <span>{weekTitleLabel}</span>{" "}
                    <span className="font-mono text-slate-400 text-[10px]">
                      ({selectedWeekMonday.format("DD/MM")} – {selectedWeekSunday.format("DD/MM")})
                    </span>{" "}
                    <span className="ml-1 inline-block px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                      {filteredWeekTrips.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripWeekOffset((w) => w + 1)}
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Tuần sau"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {filteredWeekTrips.length === 0 ? (
                  <div className="py-3 text-center text-[11px] text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800/70">
                    Không có chuyến xe nào trong tuần {selectedWeekMonday.format("DD/MM")} – {selectedWeekSunday.format("DD/MM")}.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {filteredWeekTrips.map((t, idx) => {
                      const isSelected = t.id === trip?.id;
                      const tripDate = t.planned_start ? dayjs(t.planned_start) : null;
                      const isToday = tripDate ? tripDate.isSame(dayjs(), "day") : false;
                      const isTomorrow = tripDate ? tripDate.isSame(dayjs().add(1, "day"), "day") : false;
                      const timeStr = tripDate ? tripDate.format("HH:mm") : "Chờ xếp";
                      const dateBadge = isToday
                        ? "Hôm nay"
                        : isTomorrow
                        ? "Ngày mai"
                        : tripDate ? tripDate.format("DD/MM") : "";

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTripId(t.id)}
                          className={`p-2 rounded-xl text-left transition-all border ${
                            isSelected
                              ? "bg-blue-600/30 border-blue-400 shadow-md shadow-blue-500/20 ring-1 ring-blue-400"
                              : "bg-slate-900/60 border-slate-700/60 hover:border-slate-600 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-[10px] font-bold ${isSelected ? "text-white" : "text-slate-400"}`}>
                              #{idx + 1}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                t.status === "In Progress"
                                  ? "bg-amber-400 animate-pulse"
                                  : t.status === "Accepted"
                                  ? "bg-emerald-400"
                                  : "bg-blue-400"
                              }`}
                            />
                          </div>
                          <p className={`text-[11px] font-extrabold truncate ${isSelected ? "text-blue-200" : "text-slate-200"}`}>
                            {t.trip_code}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[9px]">
                            <span className="font-mono text-slate-300 font-semibold">{timeStr}</span>
                            <span className={`px-1 py-0.2 rounded font-medium ${
                              isToday
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                                : "bg-slate-800 text-slate-400"
                            }`}>
                              {dateBadge}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
                <div
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                    trip.status === "Completed"
                      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
                      : "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      trip.status === "Completed"
                        ? "bg-emerald-400"
                        : "bg-blue-400 animate-pulse"
                    }`}
                  ></div>
                  {formatTripStatus(trip.status).toUpperCase()}
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

                  {/* THÔNG TIN NGÀY GIỜ VÀ HÀNH TRÌNH CHUYẾN XE */}
                  {(trip.planned_start || trip.created_at) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-blue-100 font-medium mt-2 pt-2 border-t border-white/10">
                      <span className="flex items-center gap-1.5 text-[11px] text-blue-100 bg-white/10 px-2 py-0.5 rounded-md">
                        <Calendar size={12} className="text-blue-300 shrink-0" />
                        <span>Khởi hành: <b className="text-white">{formatTripDateTime(trip.planned_start || trip.created_at)}</b></span>
                      </span>
                      {trip.planned_duration && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-200/90">
                          <Clock size={12} className="text-blue-300 shrink-0" />
                          <span>Dự kiến: {formatDuration(trip.planned_duration)}</span>
                        </span>
                      )}
                      {trip.planned_distance && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-200/90">
                          <Navigation2 size={12} className="text-blue-300 shrink-0" />
                          <span>{trip.planned_distance} km</span>
                        </span>
                      )}
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
                  const isPickup = isPickupStop(stop);

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
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isDone
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : isArrived
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : stop.status === "Loading Started" || stop.status === "Loading Done"
                                ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {formatStopStatus(stop.status, isPickup ? "Pickup" : "Drop-off")}
                          </span>
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
                {trip.status !== "Completed" && (
                  <button
                    onClick={() => {
                      setActiveStopTarget(currentStop);
                      setExtraFeeModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30 transition-colors shrink-0"
                  >
                    <DollarSign size={12} /> Đề xuất phí (BR-30)
                  </button>
                )}
              </div>

              {/* Auto vào thực hiện chuỗi 4 bước cho chuyến xe được điều phối */}
              {trip.status !== "Completed" && currentStop && (
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
                          {formatStopStatus(currentStop.status, isPickupStop(currentStop) ? "Pickup" : "Drop-off")}
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
                            {isPickupStop(currentStop)
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
                      isPickupStop(currentStop) && (
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

                    {/* Step 3: If Loading Started & Drop-off -> Giao hàng & POD Modal (BR-12) */}
                    {currentStop.status === "Loading Started" &&
                      isDropoffStop(currentStop) && (
                        <Button
                          type="primary"
                          size="large"
                          onClick={() => {
                            setActiveStopTarget(currentStop);
                            setPodModalOpen(true);
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-emerald-600/30 flex items-center justify-center text-center text-white"
                        >
                          <div className="flex flex-col items-center justify-center w-full leading-tight">
                            <span className="text-xs font-black flex items-center gap-1.5">
                              <Camera size={15} /> BƯỚC 3: GIAO HÀNG & POD
                            </span>
                            <span className="text-[10px] font-normal opacity-85">
                              (Record Cargo Delivery & POD - BR-12)
                            </span>
                          </div>
                        </Button>
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
                  <Button
                    type="primary"
                    onClick={() => {
                      setSelectedTripId(null);
                      setTripData({ hasActiveTrip: false, trip: null });
                      fetchDashboardData();
                    }}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-10 px-6 shadow-lg shadow-emerald-600/30"
                  >
                    Hoàn tất & Sẵn sàng nhận chuyến mới
                  </Button>
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
      {/* Modal Xác nhận Đăng xuất cho Tài xế */}
      <Modal
        open={logoutModalOpen}
        onCancel={() => !loggingOut && setLogoutModalOpen(false)}
        footer={null}
        centered
        closable={false}
        styles={{
          content: {
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "1.5rem",
            padding: "1.5rem",
            color: "#f8fafc"
          }
        }}
      >
        <div className="text-center">
          <div className="w-14 h-14 bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-red-500/10">
            <LogOut size={26} />
          </div>
          <h3 className="text-lg font-bold text-white mb-1.5">Xác nhận đăng xuất</h3>
          <p className="text-slate-300 text-xs leading-relaxed mb-4">
            Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc tài xế{" "}
            {profile?.user?.full_name ? (
              <span className="font-semibold text-blue-400">{profile.user.full_name}</span>
            ) : null}
            ?
          </p>

          {pendingOfflineCount > 0 && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left text-xs text-amber-200">
              <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-300">
                <AlertTriangle size={14} /> Chú ý: Chưa đồng bộ hết dữ liệu
              </p>
              <p className="text-[11px] leading-relaxed text-amber-200/90">
                Bạn đang có <b>{pendingOfflineCount} thao tác ngoại tuyến</b> chưa gửi lên máy chủ. Bạn nên bấm <b>&quot;Đồng bộ ngay&quot;</b> trước khi đăng xuất để tránh mất hoặc chậm trễ cập nhật chuyến xe.
              </p>
            </div>
          )}

          <div className="flex gap-2.5 mt-5">
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => setLogoutModalOpen(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all disabled:opacity-50"
            >
              Ở lại
            </button>
            <button
              type="button"
              disabled={loggingOut}
              onClick={async () => {
                try {
                  setLoggingOut(true);
                  await logout();
                } catch (err) {
                  console.error("Logout error:", err);
                  setLoggingOut(false);
                  setLogoutModalOpen(false);
                }
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loggingOut ? "Đang xử lý..." : "Đăng xuất"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}