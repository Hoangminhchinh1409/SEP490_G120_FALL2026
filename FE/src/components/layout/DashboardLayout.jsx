"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Menu, X, Bell, Search, Truck } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

export default function DashboardLayout({
  children,
  role = "admin",
  menuItems = [],
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();

  const roleNames = {
    ADMIN: "Quản trị viên",
    ADMINISTRATOR: "Quản trị viên",
    MANAGER: "Quản lý",
    DISPATCHER: "Điều phối viên",
    DRIVER: "Tài xế",
  };

  const roleText = roleNames[user.role] || "Người dùng";

  const defaultItems = [
    { name: "Tổng quan", href: `/${role}/dashboard`, icon: LayoutDashboard },
    { name: "Người dùng", href: `/${role}/users`, icon: Users },
    { name: "Đơn hàng", href: `/${role}/orders`, icon: FileText },
    { name: "Cài đặt", href: `/${role}/settings`, icon: Settings },
  ];

  const items = menuItems.length > 0 ? menuItems : defaultItems;
  const isMapPage = pathname && pathname.includes("tracking");

  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div>Đang tải...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-800">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} 
        bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col relative z-20`}
      >
        <div className="h-20 flex items-center justify-center border-b border-slate-100 shrink-0 px-4">
          <div className="flex items-center gap-3 w-full justify-center">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-2 rounded-xl text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            {sidebarOpen && <h1 className="font-black text-2xl tracking-tight text-slate-800 truncate">NEXLOG</h1>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (pathname && pathname.startsWith(item.href) && item.href !== `/${role}`);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/50'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                title={!sidebarOpen ? item.name : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {sidebarOpen && <span className="font-medium whitespace-nowrap">{item.name}</span>}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-100 shrink-0">
          <button onClick={logout} className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-red-500 hover:bg-red-50 transition-colors group">
            <LogOut className="w-5 h-5 shrink-0 text-red-400 group-hover:text-red-500" />
            {sidebarOpen && <span className="font-medium whitespace-nowrap">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-screen">
        <header className="h-20 shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2.5 w-64 lg:w-96 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all border border-transparent focus-within:border-blue-500/30">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className="bg-transparent border-none outline-none w-full text-sm text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                {(user.name || user.username || "U")
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <div className="hidden sm:block text-sm">
                <p className="font-semibold text-slate-700">
                  {user.name || user.username || "Người dùng"}
                </p>
                <p className="text-slate-400 text-xs font-medium">
                  {roleText}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto ${isMapPage ? '' : 'p-6 lg:p-8'}`}>
          <div className={`${isMapPage ? 'w-full h-full' : 'max-w-7xl mx-auto w-full'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
