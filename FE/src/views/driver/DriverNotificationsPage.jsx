"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button, message, Spin, Empty } from "antd";
import { Bell, CheckCheck, Clock, ArrowRight, Calendar, Truck } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import Link from "next/link";
import { driverApi } from "../../api/driverApi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

export default function DriverNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);

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
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_time: new Date().toISOString() } : n)
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
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_time: new Date().toISOString() }))
      );
      message.success("Đã đánh dấu tất cả thông báo là đã đọc!");
    } catch (err) {
      console.error("markAllNotificationsRead error:", err);
      message.error(err.message || "Thao tác thất bại");
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationIcon = (targetType) => {
    switch (targetType) {
      case "TRIP":
        return <Truck size={18} className="text-blue-400" />;
      case "DRIVER_SHIFT":
        return <Calendar size={18} className="text-emerald-400" />;
      case "ORDER":
        return <ArrowRight size={18} className="text-indigo-400" />;
      default:
        return <Bell size={18} className="text-amber-400" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read_time).length;

  return (
    <div className="p-4 max-w-md mx-auto text-slate-100 min-h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Bell className="text-blue-500" size={24} /> Thông báo
          </h1>
          <p className="text-xs text-slate-400">Cập nhật chuyến xe & duyệt ca (Screen 6.5)</p>
        </div>
        {unreadCount > 0 && (
          <button
            disabled={markingAll}
            onClick={handleMarkAllRead}
            className="text-xs bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 hover:text-white px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm"
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
      ) : notifications.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-800 rounded-3xl p-8 text-center mt-6">
          <Empty description={<span className="text-slate-400 text-xs">Bạn chưa có thông báo nào</span>} />
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const isRead = !!notif.read_time;
            const timeAgo = dayjs(notif.created_time).fromNow();

            return (
              <div
                key={notif.id}
                onClick={() => !isRead && handleMarkRead(notif.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                  isRead
                    ? "bg-slate-900/60 border-slate-800 text-slate-400 opacity-75 hover:opacity-100"
                    : "bg-gradient-to-r from-slate-800 to-slate-800/90 border-blue-500/60 shadow-lg shadow-blue-500/10 text-white hover:border-blue-400 ring-1 ring-blue-500/20"
                }`}
              >
                {/* Dải màu đánh dấu bên trái cho thông báo chưa đọc */}
                {!isRead && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
                )}

                <div className="flex items-start gap-3 pl-1">
                  <div
                    className={`p-2.5 rounded-xl transition-colors ${
                      isRead ? "bg-slate-800 text-slate-500" : "bg-blue-600/20 text-blue-400"
                    }`}
                  >
                    {getNotificationIcon(notif.target_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-extrabold ${
                            isRead ? "text-slate-500" : "text-blue-300"
                          }`}
                        >
                          {notif.target_type || "Hệ thống"}
                        </span>
                        {!isRead && (
                          <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded-full font-bold border border-blue-400/30">
                            MỚI
                          </span>
                        )}
                      </div>
                      {!isRead && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse shrink-0" />
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
                        <Clock size={12} className={isRead ? "text-slate-500" : "text-blue-400"} />{" "}
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
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
