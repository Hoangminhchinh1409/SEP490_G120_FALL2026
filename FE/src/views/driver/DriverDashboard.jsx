"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { App, Spin } from "antd";
import dayjs from "dayjs";
import { driverApi } from "../../api/driverApi";
import { useAuth } from "../../providers/AuthProvider";
import {
  cacheTripDocuments,
  getCachedTripDocuments,
} from "../../utils/offlineQueue";
import DriverDashboardModals from "./components/DriverDashboardModals";
import DriverDashboardHeaderSection, {
  DriverConnectionStatusBar,
  DriverLogoutModal,
} from "./components/DriverDashboardHeaderSection";
import DriverTripSummarySection from "./components/DriverTripSummarySection";
import DriverWorkflowControlBox from "./components/DriverWorkflowControlBox";
import DriverDeviceGpsCard from "./components/DriverDeviceGpsCard";
import { getMondayOfWeek } from "./components/driverDashboardHelpers";
import { useDriverWorkflowActions } from "./components/useDriverWorkflowActions";

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
        "Đã kết nối lại Internet. Đang tự động đồng bộ dữ liệu...",
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
  }, [fetchDashboardData, message]);

  const upcomingTrips =
    tripData?.upcomingTrips || (tripData?.trip ? [tripData.trip] : []);
  const trip =
    (selectedTripId
      ? upcomingTrips.find((t) => t.id === selectedTripId)
      : null) ||
    tripData?.trip ||
    null;
  const currentStop =
    (trip?.stops && trip.stops.find((s) => s.status !== "Done")) ||
    tripData?.currentStop;
  const stops = trip?.stops || [];
  const truck = trip?.truck;
  const drivingHours = tripData?.drivingHours || profile?.drivingHours;

  const actions = useDriverWorkflowActions({
    tripData,
    setTripData,
    selectedTripId,
    currentStop,
    isOffline,
    fetchDashboardData,
    message,
  });

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

  const selectedWeekMonday = getMondayOfWeek(dayjs()).add(
    tripWeekOffset,
    "week",
  );
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

      {/* PWA Connection Status Bar with Safe Area support & One-Click Offline Test Toggle */}
      <DriverConnectionStatusBar
        isOffline={isOffline}
        setIsOffline={setIsOffline}
        fetchDashboardData={fetchDashboardData}
        message={message}
      />

      <div className="w-full pt-[calc(3rem+env(safe-area-inset-top,0px))] px-3.5 relative z-10">
        <DriverDashboardHeaderSection
          profile={profile}
          drivingHours={drivingHours}
          restDeadlineText={restDeadlineText}
          fetchDashboardData={fetchDashboardData}
          setPendingOfflineCount={setPendingOfflineCount}
          setLogoutModalOpen={setLogoutModalOpen}
        />

        <DriverTripSummarySection
          trip={trip}
          upcomingTrips={upcomingTrips}
          tripWeekOffset={tripWeekOffset}
          setTripWeekOffset={setTripWeekOffset}
          selectedWeekMonday={selectedWeekMonday}
          selectedWeekSunday={selectedWeekSunday}
          weekTitleLabel={weekTitleLabel}
          filteredWeekTrips={filteredWeekTrips}
          setSelectedTripId={setSelectedTripId}
          setDocsModalOpen={actions.setDocsModalOpen}
          truck={truck}
          stops={stops}
          fetchDashboardData={fetchDashboardData}
        />

        <DriverDeviceGpsCard trip={trip} message={message} />

        {trip && (
          <DriverWorkflowControlBox
            trip={trip}
            currentStop={currentStop}
            stops={stops}
            actionLoading={actions.actionLoading}
            setActionLoading={actions.setActionLoading}
            setActiveStopTarget={actions.setActiveStopTarget}
            setExtraFeeModalOpen={actions.setExtraFeeModalOpen}
            setSealModalOpen={actions.setSealModalOpen}
            setPodModalOpen={actions.setPodModalOpen}
            setRefusalModalOpen={actions.setRefusalModalOpen}
            handleOpenNavigation={actions.handleOpenNavigation}
            handleArriveStop={actions.handleArriveStop}
            handleStartLoading={actions.handleStartLoading}
            handleLeftStop={actions.handleLeftStop}
            fetchDashboardData={fetchDashboardData}
            setSelectedTripId={setSelectedTripId}
            setTripData={setTripData}
            message={message}
          />
        )}
      </div>

      <DriverDashboardModals
        trip={trip}
        tripData={tripData}
        stops={stops}
        truck={truck}
        activeStopTarget={actions.activeStopTarget}
        actionLoading={actions.actionLoading}
        acceptModalOpen={actions.acceptModalOpen}
        setAcceptModalOpen={actions.setAcceptModalOpen}
        handleAcceptTrip={actions.handleAcceptTrip}
        sealModalOpen={actions.sealModalOpen}
        setSealModalOpen={actions.setSealModalOpen}
        handleSubmitPickup={actions.handleSubmitPickup}
        cargoPhotoUrl={actions.cargoPhotoUrl}
        setCargoPhotoUrl={actions.setCargoPhotoUrl}
        loadedCargoPhotoUrl={actions.loadedCargoPhotoUrl}
        setLoadedCargoPhotoUrl={actions.setLoadedCargoPhotoUrl}
        sealPhotoUrl={actions.sealPhotoUrl}
        setSealPhotoUrl={actions.setSealPhotoUrl}
        sealNumber={actions.sealNumber}
        setSealNumber={actions.setSealNumber}
        loadedPackages={actions.loadedPackages}
        setLoadedPackages={actions.setLoadedPackages}
        loadedWeight={actions.loadedWeight}
        setLoadedWeight={actions.setLoadedWeight}
        podModalOpen={actions.podModalOpen}
        setPodModalOpen={actions.setPodModalOpen}
        handleSubmitDelivery={actions.handleSubmitDelivery}
        podPhotoUrl={actions.podPhotoUrl}
        setPodPhotoUrl={actions.setPodPhotoUrl}
        cutSealPhotoUrl={actions.cutSealPhotoUrl}
        setCutSealPhotoUrl={actions.setCutSealPhotoUrl}
        unloadedCargoPhotoUrl={actions.unloadedCargoPhotoUrl}
        setUnloadedCargoPhotoUrl={actions.setUnloadedCargoPhotoUrl}
        receiverName={actions.receiverName}
        setReceiverName={actions.setReceiverName}
        deliveredPackages={actions.deliveredPackages}
        setDeliveredPackages={actions.setDeliveredPackages}
        docsHandedOver={actions.docsHandedOver}
        setDocsHandedOver={actions.setDocsHandedOver}
        refusalModalOpen={actions.refusalModalOpen}
        setRefusalModalOpen={actions.setRefusalModalOpen}
        handleSubmitRefusal={actions.handleSubmitRefusal}
        refusalReason={actions.refusalReason}
        setRefusalReason={actions.setRefusalReason}
        refusalCargoPhoto={actions.refusalCargoPhoto}
        setRefusalCargoPhoto={actions.setRefusalCargoPhoto}
        refusalNote={actions.refusalNote}
        setRefusalNote={actions.setRefusalNote}
        extraFeeModalOpen={actions.extraFeeModalOpen}
        setExtraFeeModalOpen={actions.setExtraFeeModalOpen}
        handleSubmitExtraFee={actions.handleSubmitExtraFee}
        feeType={actions.feeType}
        setFeeType={actions.setFeeType}
        feeAmount={actions.feeAmount}
        setFeeAmount={actions.setFeeAmount}
        feeReason={actions.feeReason}
        setFeeReason={actions.setFeeReason}
        feePhotoUrl={actions.feePhotoUrl}
        setFeePhotoUrl={actions.setFeePhotoUrl}
        docsModalOpen={actions.docsModalOpen}
        setDocsModalOpen={actions.setDocsModalOpen}
      />

      <DriverLogoutModal
        logoutModalOpen={logoutModalOpen}
        setLogoutModalOpen={setLogoutModalOpen}
        loggingOut={loggingOut}
        setLoggingOut={setLoggingOut}
        profile={profile}
        pendingOfflineCount={pendingOfflineCount}
        logout={logout}
      />
    </div>
  );
}
