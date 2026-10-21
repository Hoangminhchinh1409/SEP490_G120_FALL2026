"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button, Tag, message, Spin, Empty } from "antd";
import { Bell, CheckCheck, Clock, ArrowRight, ShieldAlert, Calendar, Truck } from "lucide-react";
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
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await driverApi.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_time: new Date().toISOString() } : n)
      );
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
          <Button
            size="small"
            type="text"
            loading={markingAll}
            onClick={handleMarkAllRead}
            className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 p-0"
          >
            <CheckCheck size={14} /> Đã đọc hết
          </Button>
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
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isRead
                    ? "bg-slate-800/60 border-slate-700/50 text-slate-300"
                    : "bg-slate-800 border-blue-500/40 shadow-lg shadow-blue-500/5 text-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${isRead ? "bg-slate-700/50" : "bg-blue-600/20"}`}>
                    {getNotificationIcon(notif.target_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                        {notif.target_type || "Hệ thống"}
                      </span>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-relaxed mb-2">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {timeAgo}
                      </span>
                      {notif.target_type === "TRIP" && (
                        <Link href="/driver" className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1">
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
