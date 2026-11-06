"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, Calendar, Bell, AlertTriangle } from 'lucide-react';
import { driverApi } from '../api/driverApi';

const DriverLayout = ({ children }) => {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Tải số lượng thông báo chưa đọc
    driverApi.getDriverNotifications()
      .then(res => {
        const unread = (res?.notifications || []).filter(n => !n.read_time).length;
        setUnreadCount(unread);
      })
      .catch(() => {});
  }, [pathname]);

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
          <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
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
                    <Icon size={20} className={isActive ? "stroke-[2.5]" : "stroke-2"} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-sm">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] mt-1 tracking-tight select-none">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-1 w-6 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
};

export default DriverLayout;
