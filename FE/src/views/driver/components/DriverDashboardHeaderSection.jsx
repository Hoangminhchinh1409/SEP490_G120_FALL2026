"use client";
import React from "react";
import { Modal } from "antd";
import {
  AlertTriangle,
  CloudOff,
  Cloud,
  RefreshCw,
  Clock,
  LogOut,
} from "lucide-react";
import { driverApi } from "../../../api/driverApi";
import { getPendingCount } from "../../../utils/offlineQueue";
import OfflineSyncStatus from "./OfflineSyncStatus";

export function DriverConnectionStatusBar({
  isOffline,
  setIsOffline,
  fetchDashboardData,
  message,
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        const willBeOffline = !isOffline;
        setIsOffline(willBeOffline);
        if (willBeOffline) {
          message.warning(
            "Đã bật chế độ Ngoại Tuyến (Offline). Mọi thao tác và ảnh upload sẽ được lưu vào máy!",
          );
        } else {
          message.success(
            "Đã bật lại Trực Tuyến. Đang tự động đồng bộ lên máy chủ...",
          );
          try {
            const syncRes = await driverApi.syncPendingQueue();
            if (syncRes && syncRes.syncedCount > 0) {
              message.success(
                `Đã đồng bộ thành công ${syncRes.syncedCount} tác vụ lên máy chủ!`,
              );
            }
          } catch (err) {
            console.error("Auto sync failed:", err);
          }
          void fetchDashboardData();
        }
      }}
      title="Bấm vào đây để Bật/Tắt chế độ Mất Mạng để Test cực dễ"
      className={`fixed top-0 left-0 right-0 max-w-md mx-auto z-40 px-3 pt-[max(0.4rem,env(safe-area-inset-top,0px))] pb-1.5 text-center text-xs font-bold text-white transition-all backdrop-blur-md border-b flex items-center justify-center gap-1.5 shadow-md cursor-pointer hover:opacity-95 active:scale-98 ${
        isOffline
          ? "bg-amber-600/95 border-amber-500/50"
          : "bg-emerald-600/90 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
      }`}
    >
      {isOffline ? (
        <>
          <CloudOff size={13} className="animate-pulse" /> NGOẠI TUYẾN (BẤM VÀO
          ĐÂY ĐỂ BẬT LẠI MẠNG)
        </>
      ) : (
        <>
          <Cloud size={13} /> KẾT NỐI MẠNG ỔN ĐỊNH (BẤM ĐỂ TEST MẤT MẠNG)
        </>
      )}
    </button>
  );
}

export default function DriverDashboardHeaderSection({
  profile,
  drivingHours,
  restDeadlineText,
  fetchDashboardData,
  setPendingOfflineCount,
  setLogoutModalOpen,
}) {
  return (
    <>
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
              {profile?.user?.full_name ||
                profile?.user?.username ||
                "Tài xế"}
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
              CẢNH BÁO GIỚI HẠN GIỜ LÁI XE
            </span>
            Tài xế sắp vượt giới hạn lái xe (4 giờ). Cần nghỉ ngơi trước{" "}
            {restDeadlineText}.
          </div>
        </div>
      )}

      {/* WIDGET: Giờ lái an toàn còn lại - Chỉ giữ giới hạn 4h liên tục */}
      {drivingHours && (
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 mb-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock size={13} className="text-blue-400" /> Giờ lái liên tục còn
              lại
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
                  drivingHours.continuous_hours_left < 1
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {drivingHours.continuous_hours_left}h
                <span className="text-xs text-slate-400 font-normal ml-1">
                  / 4h
                </span>
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden my-2 border border-slate-700/80">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  drivingHours.continuous_hours_left < 1
                    ? "bg-amber-400"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round(
                        ((4 - drivingHours.continuous_hours_left) / 4) * 100,
                      ),
                    ),
                  )}%`,
                }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
              <span>
                Đã chạy:{" "}
                {Math.max(0, 4 - drivingHours.continuous_hours_left).toFixed(1)}
                h
              </span>
              <span>
                Còn lại: {drivingHours.continuous_hours_left}h (nghỉ tối thiểu
                15 phút)
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DriverLogoutModal({
  logoutModalOpen,
  setLogoutModalOpen,
  loggingOut,
  setLoggingOut,
  profile,
  pendingOfflineCount,
  logout,
}) {
  return (
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
          color: "#f8fafc",
        },
      }}
    >
      <div className="text-center">
        <div className="w-14 h-14 bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-red-500/10">
          <LogOut size={26} />
        </div>
        <h3 className="text-lg font-bold text-white mb-1.5">
          Xác nhận đăng xuất
        </h3>
        <p className="text-slate-300 text-xs leading-relaxed mb-4">
          Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc tài xế{" "}
          {profile?.user?.full_name ? (
            <span className="font-semibold text-blue-400">
              {profile.user.full_name}
            </span>
          ) : null}
          ?
        </p>

        {pendingOfflineCount > 0 && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left text-xs text-amber-200">
            <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-300">
              <AlertTriangle size={14} /> Chú ý: Chưa đồng bộ hết dữ liệu
            </p>
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              Bạn đang có <b>{pendingOfflineCount} thao tác ngoại tuyến</b> chưa
              gửi lên máy chủ. Bạn nên bấm <b>&quot;Đồng bộ ngay&quot;</b> trước
              khi đăng xuất để tránh mất hoặc chậm trễ cập nhật chuyến xe.
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
  );
}
