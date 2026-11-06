// FE/src/views/driver/components/OfflineSyncStatus.jsx
"use client";
import React, { useState, useEffect, useCallback } from "react";
import { CloudOff, Cloud, RefreshCw } from "lucide-react";
import { getPendingCount, clearOfflineQueue, getPendingActions } from "../../../utils/offlineQueue";
import { driverApi } from "../../../api/driverApi";
import { message } from "antd";

export default function OfflineSyncStatus({ onSyncCompleted }) {
  const [isOnline, setIsOnline] = useState(() => (typeof window !== "undefined" ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const triggerSync = useCallback(async (isManual = true) => {
    if (syncing) return;
    const actions = await getPendingActions();
    if (!actions || actions.length === 0) {
      if (isManual) message.info("Không có dữ liệu ngoại tuyến nào cần đồng bộ.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
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
  }, [syncing, refreshCount, onSyncCompleted]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshCount();
    }, 0);

    const handleOnline = () => {
      setIsOnline(true);
      void triggerSync(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      void refreshCount();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    const interval = setInterval(refreshCount, 4000);

    return () => {
      clearTimeout(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
      clearInterval(interval);
    };
  }, [refreshCount, triggerSync]);

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-2.5 mb-3 flex items-center justify-between gap-2 shadow-lg">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
            isOnline
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
          }`}
        >
          {isOnline ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-white truncate">
              {isOnline ? "Trực tuyến (Online)" : "Ngoại tuyến (Offline)"}
            </span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[9px] font-black animate-pulse">
                {pendingCount} chờ
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {pendingCount > 0
              ? `${pendingCount} thao tác lưu tạm (BR-27)`
              : "Dữ liệu đã đồng bộ với máy chủ"}
          </p>
        </div>
      </div>

      <button
        onClick={() => triggerSync(true)}
        disabled={syncing || !isOnline}
        className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all shadow-md ${
          syncing
            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
            : !isOnline
            ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            : "bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-600/30"
        }`}
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
        <span>{syncing ? "Đang gửi..." : "Đồng bộ ngay"}</span>
      </button>
    </div>
  );
}
