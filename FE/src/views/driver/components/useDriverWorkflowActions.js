"use client";
import { useState } from "react";
import { driverApi, queueOfflineAction } from "../../../api/driverApi";
import { getCurrentGps, isReturnWarehouseStop } from "./driverDashboardHelpers";

export function useDriverWorkflowActions({
  tripData,
  setTripData,
  selectedTripId,
  currentStop,
  isOffline,
  fetchDashboardData,
  message,
}) {
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
  const [cargoPhotoUrl, setCargoPhotoUrl] = useState("");
  const [loadedCargoPhotoUrl, setLoadedCargoPhotoUrl] = useState("");
  const [sealPhotoUrl, setSealPhotoUrl] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [loadedPackages, setLoadedPackages] = useState(50);
  const [loadedWeight, setLoadedWeight] = useState(500);

  // Form Inputs for POD & Delivery (BR-12)
  const [podPhotoUrl, setPodPhotoUrl] = useState("");
  const [cutSealPhotoUrl, setCutSealPhotoUrl] = useState("");
  const [unloadedCargoPhotoUrl, setUnloadedCargoPhotoUrl] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [docsHandedOver, setDocsHandedOver] = useState(true);
  const [deliveredPackages, setDeliveredPackages] = useState(50);

  // Form Inputs for Customer Refusal (BR-57)
  const [refusalReason, setRefusalReason] = useState("");
  const [refusalCargoPhoto, setRefusalCargoPhoto] = useState("");
  const [refusalNote, setRefusalNote] = useState("");

  // Form Inputs for Extra Fee (BR-30)
  const [feeType, setFeeType] = useState("Bốc xếp thêm");
  const [feeAmount, setFeeAmount] = useState(200000);
  const [feeReason, setFeeReason] = useState("");
  const [feePhotoUrl, setFeePhotoUrl] = useState("");

  const getActiveDisplayedTrip = () => {
    const list =
      tripData?.upcomingTrips || (tripData?.trip ? [tripData.trip] : []);
    return (
      (selectedTripId ? list.find((t) => t.id === selectedTripId) : null) ||
      tripData?.trip ||
      null
    );
  };

  const patchTripState = (targetTripId, tripUpdater, stopUpdater) => {
    setTripData((prev) => {
      if (!prev) return prev;
      const nextUpcoming = (prev.upcomingTrips || []).map((t) =>
        t.id === targetTripId ? tripUpdater(t) : t,
      );
      const nextMainTrip =
        prev.trip && prev.trip.id === targetTripId
          ? tripUpdater(prev.trip)
          : prev.trip;
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
              s.id === stopId
                ? { ...s, status: "Arrived", actual_arrival: nowIso }
                : s,
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
            "Đã ghi nhận đến nơi. Cảnh báo: Tọa độ ngoài bán kính cho phép!",
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
            `Thời gian chờ ${res.waitingMinutes}p vượt hạn mức (${res.freeWaitingMinutes}p). Gợi ý phụ phí chờ: ${res.suggestedWaitingFee.toLocaleString("vi-VN")} đ`,
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
          (_prev, nextMain) =>
            (nextMain?.stops || []).find((s) => s.status !== "Done") || null,
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
    if (
      !cargoPhotoUrl.trim() ||
      !loadedCargoPhotoUrl.trim() ||
      !sealPhotoUrl.trim()
    ) {
      message.error(
        "Vui lòng chụp/tải đủ 3 ảnh (hàng trước bốc, trên xe, niêm chì & biển số)!",
      );
      return;
    }
    if (!sealNumber.trim()) {
      message.error("Hãy chụp rõ số chì và biển số xe, rồi nhập số chì");
      return;
    }
    if (!loadedPackages || !loadedWeight) {
      message.error("Vui lòng nhập số kiện và khối lượng hàng bốc thực tế");
      return;
    }

    const truckPayload = targetTrip.truck?.allowed_payload || 5000;
    if (parseFloat(loadedWeight) > truckPayload) {
      message.error(
        `Tổng khối lượng ${loadedWeight} kg vượt tải trọng cho phép ${truckPayload} kg của xe.`,
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
        message.success("Ghi nhận lấy hàng và niêm chì thành công!");
        await fetchDashboardData();
      }
      setSealModalOpen(false);
    } catch (err) {
      message.error(err.message || "Lỗi khi ghi nhận bốc hàng");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Workflow Action: Giao Hàng & POD (hoặc Hạ hàng hoàn tại Kho ALS & Đóng đơn)
  const handleSubmitDelivery = async () => {
    const targetTrip = getActiveDisplayedTrip();
    if (!activeStopTarget || !targetTrip?.id) return;
    const isReturnToAls = isReturnWarehouseStop(activeStopTarget);
    const isExport =
      !isReturnToAls && activeStopTarget.order?.order_type === "Export";

    if (isReturnToAls) {
      if (!unloadedCargoPhotoUrl?.trim() && !podPhotoUrl?.trim()) {
        message.error(
          "Vui lòng chụp ảnh hàng hóa đã hạ xuống Kho ALS lưu giữ!",
        );
        return;
      }
    } else if (isExport) {
      if (!cutSealPhotoUrl || !unloadedCargoPhotoUrl) {
        message.error(
          "Hàng xuất khẩu bắt buộc chụp ảnh cắt chì và ảnh dỡ hàng",
        );
        return;
      }
    } else {
      if (!podPhotoUrl || !podPhotoUrl.trim()) {
        message.error("Hãy chụp biên bản giao nhận đã ký (POD)");
        return;
      }
    }

    if (!isReturnToAls && !docsHandedOver) {
      message.error("Vui lòng xác nhận đã bàn giao đủ chứng từ");
      return;
    }

    try {
      setActionLoading(true);
      const coords = await getCurrentGps();
      const payload = {
        pod_photo_url: isReturnToAls
          ? podPhotoUrl || unloadedCargoPhotoUrl
          : podPhotoUrl,
        cut_seal_photo_url: cutSealPhotoUrl,
        unloaded_cargo_photo_url: isReturnToAls
          ? unloadedCargoPhotoUrl || podPhotoUrl
          : unloadedCargoPhotoUrl,
        receiver_name:
          receiverName.trim() ||
          (isReturnToAls ? "Thủ kho ALS nhận hàng hoàn" : undefined),
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
            const nextUndone = (nextMain?.stops || []).find(
              (s) => s.status !== "Done",
            );
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
          message.success("Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe!");
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

  // 7. Workflow Action: Khách không nhận hàng
  const handleSubmitRefusal = async () => {
    const targetTrip = getActiveDisplayedTrip();
    if (!activeStopTarget || !targetTrip?.id) return;
    if (!refusalReason.trim()) {
      message.error("Vui lòng nhập lý do khách từ chối nhận hàng");
      return;
    }
    if (!refusalCargoPhoto.trim()) {
      message.error("Vui lòng chụp ảnh hàng hóa bị từ chối");
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
        message.success(res.message || "Đã ghi nhận khách không nhận hàng.");
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
      setRefusalCargoPhoto("");
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
          res.message || "Đã gửi đề xuất phụ phí cho Điều phối viên!",
        );
      }
      setExtraFeeModalOpen(false);
      setFeeReason("");
      setFeePhotoUrl("");
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

  return {
    actionLoading,
    setActionLoading,
    acceptModalOpen,
    setAcceptModalOpen,
    sealModalOpen,
    setSealModalOpen,
    podModalOpen,
    setPodModalOpen,
    refusalModalOpen,
    setRefusalModalOpen,
    extraFeeModalOpen,
    setExtraFeeModalOpen,
    docsModalOpen,
    setDocsModalOpen,
    activeStopTarget,
    setActiveStopTarget,
    cargoPhotoUrl,
    setCargoPhotoUrl,
    loadedCargoPhotoUrl,
    setLoadedCargoPhotoUrl,
    sealPhotoUrl,
    setSealPhotoUrl,
    sealNumber,
    setSealNumber,
    loadedPackages,
    setLoadedPackages,
    loadedWeight,
    setLoadedWeight,
    podPhotoUrl,
    setPodPhotoUrl,
    cutSealPhotoUrl,
    setCutSealPhotoUrl,
    unloadedCargoPhotoUrl,
    setUnloadedCargoPhotoUrl,
    receiverName,
    setReceiverName,
    docsHandedOver,
    setDocsHandedOver,
    deliveredPackages,
    setDeliveredPackages,
    refusalReason,
    setRefusalReason,
    refusalCargoPhoto,
    setRefusalCargoPhoto,
    refusalNote,
    setRefusalNote,
    feeType,
    setFeeType,
    feeAmount,
    setFeeAmount,
    feeReason,
    setFeeReason,
    feePhotoUrl,
    setFeePhotoUrl,
    handleAcceptTrip,
    handleArriveStop,
    handleStartLoading,
    handleLeftStop,
    handleSubmitPickup,
    handleSubmitDelivery,
    handleSubmitRefusal,
    handleSubmitExtraFee,
    handleOpenNavigation,
  };
}
