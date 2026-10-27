"use client";
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Menu, X, Bell, Search, UserRound } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

export default function DashboardLayout({
  children,
  role = "admin",
  menuItems = [],
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  const roleNames = {
    1: "Quản trị viên",
    2: "Quản lý Vận hành",
    3: "Điều phối viên",
    4: "Tài xế",
  };

  const roleText = roleNames[user?.role_id] || (role === 'dispatcher' ? "Điều phối viên" : "Người dùng");

  const defaultItems = [
    { name: "Tổng quan", href: `/${role}/dashboard`, icon: LayoutDashboard },
    { name: "Người dùng", href: `/${role}/users`, icon: Users },
    { name: "Đơn hàng", href: `/${role}/orders`, icon: FileText },
    { name: "Cài đặt", href: `/${role}/settings`, icon: Settings },
  ];

  const items = menuItems.length > 0 ? menuItems : defaultItems;
  const isMapPage = pathname && pathname.includes("tracking");
  const profileHref = `/${role}/profile`;
  const isProfileActive = pathname === profileHref || Boolean(pathname?.startsWith(`${profileHref}/`));

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Đóng user dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    if (logout) {
      await logout();
      router.push('/login');
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-medium text-slate-500">
        Đang tải hệ thống...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-800">
      {/* Sidebar đồng bộ hoàn toàn với phong cách Manager */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} 
        bg-white border-r border-slate-200/80 transition-all duration-300 ease-in-out flex flex-col relative z-20 shrink-0 shadow-[0_1px_8px_rgba(0,0,0,0.03)]`}
      >
        {/* Logo (Trái) & Thiết kế tên dự án (Phải) */}
        <div className="h-16 flex items-center px-4 border-b border-slate-100 shrink-0">
          <Link href={`/${role}`} className="flex items-center gap-2.5 w-full overflow-hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
              <img 
                src="/logo-icon.png" 
                alt="Logo" 
                className="w-full h-full object-contain drop-shadow-sm" 
              />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col justify-center min-w-0">
                <img 
                  src="/logo-text.png" 
                  alt="NEXLOG" 
                  className="h-6 w-auto object-contain object-left" 
                />
                <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase leading-none mt-0.5">
                  LOGISTICS OS
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Tiêu đề phân hệ / Spacing */}
        {sidebarOpen && (
          <div className="px-5 pt-4 pb-1">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              {role === 'dispatcher' ? 'Điều hành & Điều phối' : 'Quản trị vận hành'}
            </span>
          </div>
        )}

        {/* Danh sách Menu Items với màu chữ & trạng thái active đồng bộ */}
        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (pathname && pathname.startsWith(item.href) && item.href !== `/${role}`);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-sm ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
                title={!sidebarOpen ? item.name : undefined}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {sidebarOpen && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}

          <div className="mx-2 my-2 border-t border-slate-100" />

          <Link
            href={profileHref}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-sm ${
              isProfileActive
                ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
            title={!sidebarOpen ? 'Hồ sơ cá nhân' : undefined}
          >
            <UserRound className={`w-4.5 h-4.5 shrink-0 transition-colors ${isProfileActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {sidebarOpen && <span className="whitespace-nowrap">Hồ sơ cá nhân</span>}
          </Link>
        </div>

        {/* Gateway sync indicator ở đáy sidebar (giống Manager, bỏ nút logout đỏ ở đây) */}
        {sidebarOpen ? (
          <div className="p-4 border-t border-slate-100 shrink-0">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  N
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-800">Gateway Hà Nội</span>
                  <span className="text-[10px] text-slate-400">Đồng bộ thời gian thực</span>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-slate-100 flex justify-center shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
        )}
      </aside>

      {/* Main Content & Top Header */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-screen">
        {/* Top Header */}
        <header className="h-16 shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-6 sticky top-0 z-30 shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              title={sidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="hidden md:flex items-center bg-slate-100/80 rounded-xl px-3.5 py-2 w-72 lg:w-80 border border-slate-200/60 focus-within:ring-1 focus-within:ring-blue-500 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
              <input
                type="text"
                placeholder="Tìm kiếm mã vận đơn, xe, tài xế..."
                className="bg-transparent border-none outline-none w-full text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer" title="Thông báo hệ thống">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>
            <div className="h-6 w-[1px] bg-slate-200"></div>

            {/* User Profile Pill với Dropdown đăng xuất giống Manager */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 pl-1 hover:opacity-90 transition-opacity cursor-pointer select-none"
                type="button"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[#0f2b5c] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-tight">
                    {user?.full_name || user?.username || 'Nguyễn Điều Phối'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium leading-tight">
                    {roleText}
                  </span>
                </div>
              </button>

              {/* User Dropdown chứa nút Đăng xuất */}
              {showUserMenu && (
                <div className="absolute right-0 top-11 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">
                    Đăng nhập: <strong className="text-slate-800 font-semibold">{user?.username || 'dispatcher'}</strong>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Nội dung trang: giữ nguyên 100% dữ liệu và component bên trong */}
        <main className={`flex-1 overflow-y-auto ${isMapPage ? 'p-0' : 'p-6 lg:p-8'}`}>
          <div className={`${isMapPage ? 'w-full h-full' : 'max-w-[1600px] mx-auto w-full space-y-6'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
