// FE/src/views/driver/components/OfflineSyncStatus.jsx
"use client";
import React, { useState, useEffect } from "react";
import { CloudOff, Cloud, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { getPendingCount, clearOfflineQueue, getPendingActions } from "../../../utils/offlineQueue";
import { driverApi } from "../../../api/driverApi";
import { message } from "antd";

export default function OfflineSyncStatus({ onSyncCompleted }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (e) {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = setInterval(refreshCount, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerSync = async (isManual = true) => {
    if (syncing) return;
    const actions = await getPendingActions();
    if (!actions || actions.length === 0) {
      if (isManual) message.info("Không có dữ liệu ngoại tuyến nào cần đồng bộ.");
      return;
    }

    if (!navigator.onLine) {
      if (isManual) message.warning("Thiết bị đang ngoại tuyến. Vui lòng kết nối mạng để đồng bộ.");
      return;
    }

    setSyncing(true);
    try {
      const res = await driverApi.syncOffline(actions);
      await clearOfflineQueue();
      await refreshCount();
      message.success(`Đã đồng bộ thành công ${res.syncedCount || actions.length} hành động lên máy chủ!`);
      if (onSyncCompleted) onSyncCompleted();
    } catch (err) {
      console.error("Sync failed:", err);
      message.error(err.message || "Đồng bộ thất bại, sẽ thử lại khi có sóng tốt hơn.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-3 mb-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isOnline
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
          }`}
        >
          {isOnline ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">
              {isOnline ? "Trực tuyến (Online)" : "Ngoại tuyến (Offline)"}
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-black animate-pulse">
                {pendingCount} chờ gửi
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            {pendingCount > 0
              ? `${pendingCount} thao tác đã lưu tạm tại điện thoại (BR-27)`
              : "Dữ liệu đã được đồng bộ với máy chủ"}
          </p>
        </div>
      </div>

      <button
        onClick={() => triggerSync(true)}
        disabled={syncing || !isOnline}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
          syncing
            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
            : !isOnline
            ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            : "bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-600/30"
        }`}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        <span>{syncing ? "Đang gửi..." : "Đồng bộ ngay"}</span>
      </button>
    </div>
  );
}
