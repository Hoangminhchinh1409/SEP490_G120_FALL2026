"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { App, Spin, Empty, Modal, Tag } from "antd";
import {
  Truck,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Search,
  Eye,
  AlertCircle,
  PlayCircle,
  Check,
  ChevronRight,
  LogOut,
  Navigation,
  X
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { driverApi } from "../../api/driverApi";
import { useAuth } from "../../providers/AuthProvider";

dayjs.locale("vi");

export default function DriverTripsPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("UPCOMING"); // 'UPCOMING', 'HISTORY', 'ALL'
  
  // Data
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [historyTrips, setHistoryTrips] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Action states
  const [acceptingTripId, setAcceptingTripId] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const handledDeepLinkRef = useRef(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Load all trip data
  const fetchTripsData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [activeRes, historyRes] = await Promise.all([
        driverApi.getActiveTrip().catch(() => ({ trip: null, upcomingTrips: [] })),
        driverApi.getTripHistory({ page: 1, limit: 20 }).catch(() => ({ trips: [], total: 0 }))
      ]);

      const upcoming = activeRes?.upcomingTrips || (activeRes?.trip ? [activeRes.trip] : []);
      setUpcomingTrips(upcoming);

      const history = historyRes?.trips || [];
      setHistoryTrips(history);
      setHistoryTotal(historyRes?.total || history.length);

      // Tự động mở popup chi tiết chuyến khi bấm "Xem chuyến" từ Thông báo (/driver/trips?tripId=...)
      if (!handledDeepLinkRef.current && typeof window !== "undefined") {
        handledDeepLinkRef.current = true;
        const params = new URLSearchParams(window.location.search);
        const paramTripId = params.get("tripId");
        const paramTripCode = params.get("tripCode");
        if (paramTripId || paramTripCode) {
          const matchUpcoming = upcoming.find(
            (t) =>
              (paramTripId && Number(t.id) === Number(paramTripId)) ||
              (paramTripCode && String(t.trip_code || "").toUpperCase() === paramTripCode.toUpperCase())
          );
          const matchHistory = !matchUpcoming
            ? history.find(
                (t) =>
                  (paramTripId && Number(t.id) === Number(paramTripId)) ||
                  (paramTripCode && String(t.trip_code || "").toUpperCase() === paramTripCode.toUpperCase())
              )
            : null;
          const matched = matchUpcoming || matchHistory;
          if (matched) {
            setActiveTab(matchHistory ? "HISTORY" : "UPCOMING");
            setSelectedTrip(matched);
            setDetailModalOpen(true);
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      }
    } catch (err) {
      console.error("fetchTripsData error:", err);
      message.error("Không thể tải danh sách chuyến xe");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTripsData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTripsData]);

  // Handle Accept Trip
  const handleAcceptTrip = async (trip, e) => {
    if (e) e.stopPropagation();
    if (!trip?.id) return;

    try {
      setAcceptingTripId(trip.id);
      await driverApi.acceptTrip(trip.id);
      message.success(`Đã nhận chuyến ${trip.trip_code || `#${trip.id}`} thành công!`);

      // Update locally
      setUpcomingTrips((prev) =>
        prev.map((t) => (t.id === trip.id ? { ...t, status: "Accepted" } : t))
      );
      if (selectedTrip?.id === trip.id) {
        setSelectedTrip((prev) => ({ ...prev, status: "Accepted" }));
      }
    } catch (err) {
      console.error("Accept trip error:", err);
      message.error(err.message || "Lỗi khi nhận chuyến xe");
    } finally {
      setAcceptingTripId(null);
    }
  };

  // Navigate to execute trip on Driver Dashboard
  const handleGoToExecuteTrip = (tripId) => {
    router.push(`/driver?tripId=${tripId}`);
  };

  // Logout handler
  const handleConfirmLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
      setLoggingOut(false);
      setLogoutModalOpen(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case "Assigned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Chờ nhận
          </span>
        );
      case "Accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Check size={12} className="text-amber-400" />
            Đã nhận
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Đang chạy
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-700 text-slate-300 border border-slate-600">
            <CheckCircle size={12} className="text-emerald-400" />
            Đã hoàn thành
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            {status || "Không xác định"}
          </span>
        );
    }
  };

  // Filtered trips based on active tab and search
  const filteredUpcoming = upcomingTrips.filter(
    (t) =>
      !searchQuery.trim() ||
      t.trip_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.truck?.plate_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = historyTrips.filter(
    (t) =>
      !searchQuery.trim() ||
      t.trip_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.truck_assignments?.[0]?.truck?.plate_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allTrips = [...upcomingTrips, ...historyTrips].filter(
    (t) =>
      !searchQuery.trim() ||
      t.trip_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100 font-sans pb-24 relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-700/20 via-indigo-900/10 to-transparent pointer-events-none"></div>

      {/* Top Header Card */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 pt-4 pb-3 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/driver"
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 transition-colors"
            >
              <Truck size={17} />
            </Link>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                Sổ Quản Lý Chuyến Xe
              </h1>
              <p className="text-[11px] text-slate-400">
                Tài xế: <span className="text-blue-400 font-semibold">{user?.full_name || user?.username}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchTripsData(true)}
              disabled={refreshing}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 transition-colors disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-blue-400" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setLogoutModalOpen(true)}
              className="w-8 h-8 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 flex items-center justify-center text-red-400 transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã chuyến hoặc biển số xe..."
            className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Tab navigation pills */}
        <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("UPCOMING")}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "UPCOMING"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Sắp tới & Nhận</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === "UPCOMING" ? "bg-white/25 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {upcomingTrips.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HISTORY")}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "HISTORY"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Lịch sử đã chạy</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === "HISTORY" ? "bg-white/25 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {historyTrips.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === "ALL"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Tất cả</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-3 max-w-md mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Spin size="large" />
            <p className="mt-3 text-xs font-semibold">Đang tải danh sách chuyến...</p>
          </div>
        ) : activeTab === "UPCOMING" ? (
          /* TAB 1: UPCOMING & PENDING ACCEPTANCE */
          filteredUpcoming.length === 0 ? (
            <div className="py-16 text-center bg-slate-800/40 border border-slate-800 rounded-2xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <Truck size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-300 mb-1">Không có chuyến xe sắp tới</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Khi Điều phối viên gán chuyến mới cho bạn, chuyến sẽ hiển thị tại đây để bạn bấm <b>Nhận chuyến</b>.
              </p>
            </div>
          ) : (
            filteredUpcoming.map((t, idx) => {
              const truckPlate = t.truck?.plate_number || t.truck_assignments?.[0]?.truck?.plate_number || "Chưa gán xe";
              const truckPayload = t.truck?.allowed_payload || t.truck_assignments?.[0]?.truck?.allowed_payload || "";
              const stops = t.stops || [];
              const isAssigned = t.status === "Assigned";
              const isAccepted = t.status === "Accepted";
              const isInProgress = t.status === "In Progress";

              return (
                <div
                  key={t.id || idx}
                  onClick={() => {
                    setSelectedTrip(t);
                    setDetailModalOpen(true);
                  }}
                  className={`bg-slate-800/90 border rounded-2xl p-4 shadow-lg transition-all active:scale-[0.99] cursor-pointer ${
                    isInProgress
                      ? "border-emerald-500/50 shadow-emerald-500/10"
                      : isAssigned
                      ? "border-blue-500/50 shadow-blue-500/10"
                      : "border-slate-700/80"
                  }`}
                >
                  {/* Top Bar of Trip Card */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-white tracking-wide">
                        {t.trip_code || `TRIP-#${t.id}`}
                      </span>
                      {renderStatusBadge(t.status)}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 font-mono">
                      <Clock size={12} className="text-blue-400" />
                      {t.planned_start ? dayjs(t.planned_start).format("HH:mm • DD/MM") : "Chưa có giờ"}
                    </span>
                  </div>

                  {/* Vehicle Info */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/70 rounded-xl border border-slate-700/60 mb-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                      <Truck size={14} className="text-blue-400 shrink-0" />
                      <b className="text-white font-mono">{truckPlate}</b>
                      {truckPayload && <span className="text-slate-400">({truckPayload} kg)</span>}
                    </span>
                    <span className="text-slate-400 text-[11px] font-medium">
                      {stops.length} điểm dừng
                    </span>
                  </div>

                  {/* Route points preview */}
                  {stops.length > 0 && (
                    <div className="space-y-1.5 mb-3 text-xs">
                      {stops.slice(0, 2).map((s, sIdx) => (
                        <div key={s.id || sIdx} className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                              s.stop_type === "Pickup" ? "bg-blue-400" : "bg-emerald-400"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-semibold text-slate-300 truncate block">
                              {s.location?.name || `Điểm #${s.sequence}`}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate block">
                              {s.location?.address || "Địa chỉ cập nhật theo phiếu"}
                            </span>
                          </div>
                        </div>
                      ))}
                      {stops.length > 2 && (
                        <p className="text-[10px] text-blue-400 italic pl-4">
                          + thêm {stops.length - 2} điểm giao nhận tiếp theo...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-700/60 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isAssigned ? (
                      <button
                        type="button"
                        disabled={acceptingTripId === t.id}
                        onClick={(e) => handleAcceptTrip(t, e)}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Check size={14} />
                        {acceptingTripId === t.id ? "Đang nhận..." : "Nhận Chuyến Xe"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGoToExecuteTrip(t.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                      >
                        <PlayCircle size={14} />
                        Vào Thực Hiện Chuyến
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrip(t);
                        setDetailModalOpen(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all border border-slate-600/70 flex items-center gap-1"
                    >
                      <Eye size={13} />
                      Chi tiết
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : activeTab === "HISTORY" ? (
          /* TAB 2: COMPLETED TRIPS HISTORY */
          filteredHistory.length === 0 ? (
            <div className="py-16 text-center bg-slate-800/40 border border-slate-800 rounded-2xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <CheckCircle size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-300 mb-1">Chưa có lịch sử chuyến xe hoàn thành</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Các chuyến xe sau khi bạn hoàn thành toàn bộ các điểm giao nhận và ký biên bản giao nhận (POD) sẽ được lưu trữ tại đây.
              </p>
            </div>
          ) : (
            filteredHistory.map((t, idx) => {
              const truckPlate = t.truck_assignments?.[0]?.truck?.plate_number || "Xe đã hoàn thành";
              const stops = t.stops || [];

              return (
                <div
                  key={t.id || idx}
                  onClick={() => {
                    setSelectedTrip(t);
                    setDetailModalOpen(true);
                  }}
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded-2xl p-3.5 shadow-md transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold text-slate-100">
                      {t.trip_code || `#${t.id}`}
                    </span>
                    {renderStatusBadge(t.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="flex items-center gap-1">
                      <Truck size={13} className="text-slate-400" />
                      {truckPlate}
                    </span>
                    <span>
                      {t.created_at ? dayjs(t.created_at).format("DD/MM/YYYY") : "—"}
                    </span>
                  </div>

                  {stops.length > 0 && (
                    <div className="text-[11px] text-slate-300 p-2 bg-slate-900/60 rounded-xl border border-slate-700/50 flex items-center justify-between">
                      <span className="truncate max-w-[200px]">
                        Lộ trình: {stops[0]?.location?.name || "Điểm đi"} → {stops[stops.length - 1]?.location?.name || "Điểm đến"}
                      </span>
                      <span className="text-slate-400 shrink-0 font-medium ml-1">
                        {stops.length} điểm
                      </span>
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-blue-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Eye size={12} /> Bấm để xem chi tiết
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* TAB 3: ALL TRIPS */
          allTrips.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <p className="text-xs">Không tìm thấy chuyến xe nào</p>
            </div>
          ) : (
            allTrips.map((t, idx) => (
              <div
                key={t.id || idx}
                onClick={() => {
                  setSelectedTrip(t);
                  setDetailModalOpen(true);
                }}
                className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 shadow-md flex items-center justify-between cursor-pointer hover:border-slate-600"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-white">
                      {t.trip_code || `#${t.id}`}
                    </span>
                    {renderStatusBadge(t.status)}
                  </div>
                  <span className="text-[11px] text-slate-400 block font-mono">
                    {t.planned_start ? dayjs(t.planned_start).format("HH:mm • DD/MM/YYYY") : "—"}
                  </span>
                </div>
                <ChevronRight size={16} className="text-slate-500" />
              </div>
            ))
          )
        )}
      </div>

      {/* TRIP DETAIL MODAL (Pure Tailwind Dark Theme matching Driver PWA) */}
      {detailModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop click to close */}
          <div
            className="absolute inset-0"
            onClick={() => setDetailModalOpen(false)}
          />

          {/* Modal Dialog Card */}
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/90 rounded-3xl p-5 shadow-2xl text-slate-100 z-10 max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-800">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                  Thông tin chi tiết chuyến xe
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white font-mono truncate">
                    {selectedTrip.trip_code || `TRIP-#${selectedTrip.id}`}
                  </h3>
                  {renderStatusBadge(selectedTrip.status)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto pr-1 space-y-3.5 flex-1">
              {/* Box: Vehicle & Planned Start */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70">
                  <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1 mb-1">
                    <Truck size={12} className="text-blue-400" />
                    Xe vận chuyển:
                  </span>
                  <span className="text-xs font-bold text-white font-mono block">
                    {selectedTrip.truck?.plate_number || selectedTrip.truck_assignments?.[0]?.truck?.plate_number || "Chưa có"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {selectedTrip.truck?.allowed_payload ? `${selectedTrip.truck.allowed_payload} kg` : "Xe thùng kín"}
                  </span>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70">
                  <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1 mb-1">
                    <Clock size={12} className="text-blue-400" />
                    Khởi hành dự kiến:
                  </span>
                  <span className="text-xs font-bold text-blue-300 font-mono block">
                    {selectedTrip.planned_start ? dayjs(selectedTrip.planned_start).format("HH:mm") : "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {selectedTrip.planned_start ? dayjs(selectedTrip.planned_start).format("DD/MM/YYYY") : ""}
                  </span>
                </div>
              </div>

              {/* Box: Stops Sequence */}
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2 flex items-center justify-between">
                  <span>Lộ trình các điểm dừng:</span>
                  <span className="text-[11px] font-mono text-blue-400 font-normal">
                    {selectedTrip.stops?.length || 0} điểm
                  </span>
                </span>

                <div className="space-y-2">
                  {(selectedTrip.stops || []).map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="p-3 bg-slate-800/70 hover:bg-slate-800 rounded-2xl border border-slate-700/70 flex items-start gap-2.5 transition-colors"
                    >
                      <div
                        className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm ${
                          s.stop_type === "Pickup"
                            ? "bg-blue-600/30 text-blue-400 border border-blue-500/40"
                            : "bg-emerald-600/30 text-emerald-400 border border-emerald-500/40"
                        }`}
                      >
                        {s.sequence || idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {s.location?.name || `Điểm #${s.sequence}`}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.2 rounded-full font-bold uppercase shrink-0 ${
                              s.stop_type === "Pickup"
                                ? "bg-blue-500/15 text-blue-300 border border-blue-400/25"
                                : "bg-emerald-500/15 text-emerald-300 border border-emerald-400/25"
                            }`}
                          >
                            {s.stop_type === "Pickup" ? "Lấy hàng" : "Giao hàng"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                          {s.location?.address || "Địa chỉ kho khách hàng"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3.5 mt-3 border-t border-slate-800 flex items-center gap-2">
              {selectedTrip.status === "Assigned" && (
                <button
                  type="button"
                  disabled={acceptingTripId === selectedTrip.id}
                  onClick={(e) => handleAcceptTrip(selectedTrip, e)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} />
                  {acceptingTripId === selectedTrip.id ? "Đang nhận..." : "Nhận Chuyến Ngay"}
                </button>
              )}

              {(selectedTrip.status === "Accepted" || selectedTrip.status === "In Progress") && (
                <button
                  type="button"
                  onClick={() => handleGoToExecuteTrip(selectedTrip.id)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <PlayCircle size={14} />
                  Vào Thực Hiện Chuyến
                </button>
              )}

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL (Dark Theme) */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => !loggingOut && setLogoutModalOpen(false)}
          />
          <div className="relative w-full max-w-xs bg-slate-900 border border-slate-700/90 rounded-3xl p-5 shadow-2xl text-center z-10 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <LogOut size={22} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Xác nhận đăng xuất</h3>
            <p className="text-slate-300 text-xs mb-4">
              Bạn có chắc chắn muốn đăng xuất khỏi tài khoản tài xế?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
              >
                Ở lại
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all"
              >
                {loggingOut ? "Đang xử lý..." : "Đăng xuất"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

