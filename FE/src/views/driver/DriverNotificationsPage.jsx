"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button, App, Spin, Empty, Modal } from "antd";
import {
  Bell,
  CheckCheck,
  Clock,
  ArrowRight,
  Calendar,
  Truck,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import Link from "next/link";
import { driverApi } from "../../api/driverApi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

export default function DriverNotificationsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);

  // States xem chi tiết phiên đồng bộ ngoại tuyến
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [loadingSyncDetail, setLoadingSyncDetail] = useState(false);
  const [selectedSyncLog, setSelectedSyncLog] = useState(null);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await driverApi.getDriverNotifications();
      setNotifications(res?.notifications || []);
    } catch (err) {
      console.error("fetchNotifications error:", err);
      message.error(err.message || "Không thể tải danh sách thông báo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      // Optimistic update ngay lập tức trên UI
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_time: new Date().toISOString() } : n))
      );
      await driverApi.markNotificationRead(id);
    } catch (err) {
      console.error("markNotificationRead error:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await driverApi.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_time: new Date().toISOString() }))
      );
      message.success("Đã đánh dấu tất cả thông báo là đã đọc!");
    } catch (err) {
      console.error("markAllNotificationsRead error:", err);
      message.error(err.message || "Thao tác thất bại");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenSyncModal = async (notif) => {
    setSelectedNotif(notif);
    setSelectedSyncLog(null);
    setSyncModalOpen(true);

    if (!notif.read_time) {
      handleMarkRead(notif.id);
    }

    if (notif.target_id) {
      try {
        setLoadingSyncDetail(true);
        const res = await driverApi.getSyncLogDetail(notif.target_id);
        setSelectedSyncLog(res?.log || null);
      } catch (err) {
        console.error("getSyncLogDetail error:", err);
      } finally {
        setLoadingSyncDetail(false);
      }
    }
  };

  const getNotificationIcon = (targetType) => {
    switch (targetType) {
      case "TRIP":
        return <Truck size={18} className="text-blue-400" />;
      case "SHIFT":
      case "DRIVER_SHIFT":
        return <Calendar size={18} className="text-emerald-400" />;
      case "OFFLINE_SYNC":
      case "SYNC":
        return <RefreshCw size={18} className="text-cyan-400" />;
      case "ORDER":
        return <ArrowRight size={18} className="text-indigo-400" />;
      default:
        return <Bell size={18} className="text-amber-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_time).length;

  return (
    <div className="p-4 max-w-md mx-auto text-slate-100 min-h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Bell className="text-blue-500" size={24} /> Thông báo
          </h1>
          <p className="text-xs text-slate-400">Cập nhật chuyến xe, ca làm &amp; đồng bộ ngoại tuyến</p>
        </div>
        {unreadCount > 0 && (
          <button
            disabled={markingAll}
            onClick={handleMarkAllRead}
            className="text-xs bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 hover:text-white px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <CheckCheck size={14} className="text-blue-300" />
            <span>{markingAll ? "Đang xử lý..." : "Đã đọc hết"}</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-12">
          <Spin size="large" />
        </div>
      ): notifications.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-800 rounded-3xl p-8 text-center mt-6">
          <Empty description={<span className="text-slate-400 text-xs">Bạn chưa có thông báo nào</span>} />
        </div>
      ): (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const isRead = !!notif.read_time;
            const timeAgo = dayjs(notif.created_time).fromNow();
            const isSyncNotif = notif.target_type === "OFFLINE_SYNC" || notif.target_type === "SYNC";

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (!isRead) handleMarkRead(notif.id);
                  if (isSyncNotif) handleOpenSyncModal(notif);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                  isRead
                    ? "bg-slate-900/60 border-slate-800 text-slate-400 opacity-75 hover:opacity-100"
                    : isSyncNotif
                    ? "bg-gradient-to-r from-slate-800 to-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10 text-white hover:border-cyan-400 ring-1 ring-cyan-500/20"
                    : "bg-gradient-to-r from-slate-800 to-slate-800/90 border-blue-500/60 shadow-lg shadow-blue-500/10 text-white hover:border-blue-400 ring-1 ring-blue-500/20"
                }`}
              >
                {/* Dải màu đánh dấu bên trái cho thông báo chưa đọc */}
                {!isRead && (
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isSyncNotif ? "bg-cyan-400" : "bg-blue-500"
                    }`}
                  />
                )}

                <div className="flex items-start gap-3 pl-1">
                  <div
                    className={`p-2.5 rounded-xl transition-colors ${
                      isRead
                        ? "bg-slate-800 text-slate-500"
                        : isSyncNotif
                        ? "bg-cyan-600/20 text-cyan-400"
                        : "bg-blue-600/20 text-blue-400"
                    }`}
                  >
                    {getNotificationIcon(notif.target_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-extrabold ${
                            isRead
                              ? "text-slate-500"
                              : isSyncNotif
                              ? "text-cyan-300"
                              : "text-blue-300"
                          }`}
                        >
                          {notif.target_type === "OFFLINE_SYNC"
                            ? "ĐỒNG BỘ NGOẠI TUYẾN"
                            : notif.target_type || "Hệ thống"}
                        </span>
                        {!isRead && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${
                              isSyncNotif
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/30"
                                : "bg-blue-500/20 text-blue-300 border-blue-400/30"
                            }`}
                          >
                            MỚI
                          </span>
                        )}
                      </div>
                      {!isRead && (
                        <span
                          className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse shrink-0 ${
                            isSyncNotif ? "bg-cyan-400" : "bg-blue-400"
                          }`}
                        />
                      )}
                    </div>
                    <p
                      className={`text-xs leading-relaxed mb-2 ${
                        isRead ? "font-normal text-slate-300" : "font-bold text-white"
                      }`}
                    >
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock
                          size={12}
                          className={
                            isRead
                              ? "text-slate-500"
                              : isSyncNotif
                              ? "text-cyan-400"
                              : "text-blue-400"
                          }
                        />{" "}
                        {timeAgo}
                      </span>
                      {notif.target_type === "TRIP" && (
                        <Link
                          href="/driver"
                          className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                        >
                          Xem chuyến <ArrowRight size={12} />
                        </Link>
                      )}
                      {isSyncNotif && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSyncModal(notif);
                          }}
                          className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer bg-cyan-950/50 hover:bg-cyan-900/60 px-2.5 py-1 rounded-xl border border-cyan-500/40 text-xs transition-colors shadow-xs"
                        >
                          Xem chi tiết các thao tác <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CHI TIẾT CÁC HÀNH ĐỘNG ĐÃ ĐỒNG BỘ TỪ DATABASE */}
      <Modal
        open={syncModalOpen}
        onCancel={() => setSyncModalOpen(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setSyncModalOpen(false)}
            className="bg-blue-600 hover:bg-blue-500 rounded-xl font-bold px-5"
          >
            Đóng
          </Button>
        ]}
        centered
        width="95%"
        style={{ maxWidth: 520 }}
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <RefreshCw size={18} className="text-cyan-600" />
            <span>Chi tiết phiên đồng bộ ngoại tuyến</span>
          </div>
        }
      >
        {loadingSyncDetail ? (
          <div className="py-12 text-center">
            <Spin size="large" />
            <p className="text-xs text-slate-500 mt-2">Đang tải dữ liệu kiểm tra từ máy chủ...</p>
          </div>
        ) : selectedSyncLog ? (
          <div className="py-2 text-xs space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            {/* Tóm tắt */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Trạng thái đồng bộ:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                    (selectedSyncLog.changes?.failedCount || 0) === 0
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-amber-100 text-amber-700 border border-amber-300"
                  }`}
                >
                  {(selectedSyncLog.changes?.failedCount || 0) === 0 ? "Thành công 100%" : "Có thao tác cần lưu ý"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Đã ghi nhận vào Database:</span>
                <span className="font-bold text-emerald-600">
                  {selectedSyncLog.changes?.syncedCount || 0} / {selectedSyncLog.changes?.totalCount || 0} thao tác
                </span>
              </div>
              {selectedSyncLog.changes?.failedCount > 0 && (
                <div className="flex items-center justify-between text-rose-600">
                  <span>Thao tác thất bại / Bị từ chối:</span>
                  <span className="font-bold">{selectedSyncLog.changes?.failedCount}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                <span>Thời gian máy chủ xác nhận:</span>
                <span className="font-medium text-slate-700">
                  {dayjs(selectedSyncLog.created_time).format("HH:mm:ss - DD/MM/YYYY")}
                </span>
              </div>
            </div>

            {/* Danh sách chi tiết các hành động được ghi nhận */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>DANH SÁCH THAO TÁC ĐÃ GHI NHẬN:</span>
                <span className="text-[10px] text-slate-400 font-normal">Nguồn: Database BE</span>
              </div>

              <div className="space-y-2">
                {(selectedSyncLog.changes?.items || []).map((item, idx) => {
                  const isSuccess = item.status === "SUCCESS";
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isSuccess
                          ? "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                          : "bg-rose-50/50 border-rose-200 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {isSuccess ? (
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle size={16} className="text-rose-500 shrink-0" />
                          )}
                          <span className="font-bold text-slate-800 text-xs">
                            {item.description || item.type}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                            isSuccess
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {isSuccess ? "THÀNH CÔNG" : "LỖI"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 pl-6">
                        <span>
                          Mã: <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono">{item.type}</code>
                        </span>
                        {item.clientTime && (
                          <span>
                            Giờ bấm trên máy: <b>{dayjs(item.clientTime).format("HH:mm:ss")}</b>
                          </span>
                        )}
                        {item.syncedAt && (
                          <span>
                            Giờ vào DB: <b>{dayjs(item.syncedAt).format("HH:mm:ss")}</b>
                          </span>
                        )}
                      </div>

                      {item.error && (
                        <div className="mt-1.5 ml-6 p-2 bg-rose-100/70 border border-rose-200 rounded-lg text-rose-700 text-[11px]">
                          <b>Nguyên nhân lỗi:</b> {item.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs">
            <p>{selectedNotif?.message}</p>
            <p className="text-[11px] text-slate-400 mt-2 italic">Phiên đồng bộ đã được ghi nhận tự động vào cơ sở dữ liệu.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
