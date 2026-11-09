"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, Calendar, Bell, AlertTriangle, LogOut } from 'lucide-react';
import { Modal } from 'antd';
import { driverApi } from '../api/driverApi';
import { useAuth } from '../providers/AuthProvider';
import { getPendingCount } from '../utils/offlineQueue';

const DriverLayout = ({ children }) => {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  useEffect(() => {
    // Tải số lượng thông báo chưa đọc
    driverApi.getDriverNotifications()
      .then(res => {
        const unread = (res?.notifications || []).filter(n => !n.read_time).length;
        setUnreadCount(unread);
      })
      .catch(() => {});
  }, [pathname]);

  const handleOpenLogoutModal = async () => {
    try {
      const count = await getPendingCount();
      setPendingOfflineCount(count);
    } catch {
      setPendingOfflineCount(0);
    }
    setLogoutModalOpen(true);
  };

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

  const navItems = [
    { label: "Chuyến xe", href: "/driver", icon: Truck },
    { label: "Đăng ký ca", href: "/driver/shifts", icon: Calendar },
    { label: "Thông báo", href: "/driver/notifications", icon: Bell, badge: unreadCount },
    { label: "Sự cố", href: "/driver/incidents", icon: AlertTriangle }
  ];

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 font-sans flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Mobile-first PWA Layout wrapper with Safe Area support */}
      <main className="w-full max-w-md mx-auto min-h-screen relative bg-slate-900 shadow-2xl flex flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        {children}

        {/* Global Mobile Bottom Navigation Bar with Safe Area support */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
          <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all active:scale-95 touch-manipulation relative ${
                    isActive 
                      ? "text-blue-500 font-bold" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="relative">
                    <Icon size={19} className={isActive ? "stroke-[2.5]" : "stroke-2"} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-sm">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-1 tracking-tight select-none truncate max-w-[65px]">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-1 w-6 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* Logout button in Mobile Bottom Navigation */}
            <button
              type="button"
              onClick={handleOpenLogoutModal}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 transition-all active:scale-95 touch-manipulation relative text-slate-400 hover:text-red-400"
              title="Đăng xuất"
            >
              <div className="relative">
                <LogOut size={19} className="stroke-2 text-slate-400 hover:text-red-400" />
              </div>
              <span className="text-[10px] mt-1 tracking-tight select-none truncate max-w-[65px]">Đăng xuất</span>
            </button>
          </div>
        </nav>
      </main>

      {/* Confirmation Modal for Driver Logout */}
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
            Bạn có chắc chắn muốn đăng xuất khỏi tài khoản tài xế{" "}
            {user?.full_name ? (
              <span className="font-semibold text-blue-400">{user.full_name}</span>
            ) : user?.username ? (
              <span className="font-semibold text-blue-400">@{user.username}</span>
            ) : null}
            ?
          </p>

          {pendingOfflineCount > 0 && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left text-xs text-amber-200">
              <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-300">
                <AlertTriangle size={14} /> Chú ý: Chưa đồng bộ hết dữ liệu
              </p>
              <p className="text-[11px] leading-relaxed text-amber-200/90">
                Bạn đang có <b>{pendingOfflineCount} thao tác ngoại tuyến</b> chưa gửi lên máy chủ. Bạn nên bấm <b>"Đồng bộ ngay"</b> trên trang chủ trước khi đăng xuất để tránh chậm trễ báo cáo.
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
              onClick={handleConfirmLogout}
              className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loggingOut ? "Đang xử lý..." : "Đăng xuất"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DriverLayout;
