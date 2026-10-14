"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

export default function ManagerLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { href: '/manager', icon: 'insights', name: 'Tổng quan Hiệu suất' },
    { href: '/manager/orders', icon: 'package_2', name: 'Quản lý Đơn hàng' },
    { href: '/manager/fleet', icon: 'local_shipping', name: 'Quản lý Đội xe' },
    { href: '/manager/vendors', icon: 'handshake', name: 'Quản lý Đối tác' },
    { href: '/manager/approvals', icon: 'fact_check', name: 'Duyệt yêu cầu' },
    { href: '/manager/blogs', icon: 'newspaper', name: 'Quản lý tin tức' },
  ];

  const isActive = (href) => {
    if (href === '/manager') return pathname === '/manager';
    return pathname?.startsWith(href);
  };

  const handleLogout = async () => {
    if (logout) {
      await logout();
      router.push('/login');
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      {/* Executive Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col">
        {/* Logo Section */}
        <div className="h-16 px-space-lg flex items-center gap-space-sm">
          <Link href="/manager" className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary font-headline-sm font-bold shadow-sm">
              <span className="material-symbols-outlined text-[20px] text-on-primary">local_shipping</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm tracking-tight text-primary font-bold">NEXLOG</span>
              <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase font-semibold">Logistics OS</span>
            </div>
          </Link>
        </div>

        <div className="px-space-md py-space-sm">
          <div className="h-[1px] w-full bg-surface-container"></div>
        </div>

        <div className="px-space-md py-space-xs">
          <span className="px-space-sm font-label-sm text-label-sm text-outline tracking-wider uppercase font-semibold">
            Quản trị vận hành
          </span>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-space-md py-space-xs space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-xl font-label-lg text-label-lg transition-colors ${
                  active
                    ? 'bg-secondary text-on-secondary font-semibold shadow-[0_1px_3px_0_rgba(15,43,92,0.04)]'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${active ? 'text-on-secondary' : ''}`}>
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Gateway sync status indicator */}
        <div className="p-space-md">
          <div className="p-space-md bg-surface-container-low rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">cloud_done</span>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">Gateway Hà Nội</span>
                <span className="font-body-sm text-body-sm text-outline">Đồng bộ thời gian thực</span>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="pl-64 flex flex-col min-h-screen">
        {/* Fixed Top Header */}
        <header className="fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-space-lg flex items-center justify-between">
          <div className="flex items-center gap-space-md">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                search
              </span>
              <input
                className="w-80 h-10 pl-9 pr-space-md bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary transition-all"
                placeholder="Tìm kiếm mã vận đơn, xe, tài xế..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-space-lg">
            {/* Notification */}
            <div className="relative flex items-center">
              <button
                className="w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors relative cursor-pointer"
                type="button"
                title="Thông báo hệ thống"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest"></span>
              </button>
            </div>

            <div className="h-6 w-[1px] bg-surface-container"></div>

            {/* User Profile Pill */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-space-md pl-space-xs hover:opacity-85 transition-opacity cursor-pointer"
                type="button"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-container-lowest"></span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface leading-tight">
                    {user?.full_name || 'Nguyễn Quản Lý'}
                  </span>
                  <span className="font-body-sm text-body-sm text-outline leading-tight">
                    {user?.role_name || (user?.role_id === 1 ? 'Quản trị viên' : 'Quản lý Vận hành')}
                  </span>
                </div>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 top-12 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container py-1 z-50">
                  <div className="px-4 py-2 border-b border-surface-container text-xs text-outline">
                    Đăng nhập: <strong className="text-on-surface">{user?.username}</strong>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-error hover:bg-surface-container-low flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="w-full pt-16 bg-background flex-1 px-space-lg py-space-lg">
          {children}
        </main>
      </div>
    </div>
  );
}
