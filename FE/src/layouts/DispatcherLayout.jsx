import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Dropdown, Menu, Avatar, Badge, Breadcrumb, Input } from 'antd';
import { LayoutDashboard, Truck, Users, Settings, FileText, MapPin, Bell, Menu as MenuIcon, User, LogOut } from 'lucide-react';

const { Search: AntSearch } = Input;

const DispatcherLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();

  const profileMenu = (
    <Menu className="min-w-[150px] mt-2 rounded-xl shadow-lg border border-gray-100 p-2">
      <Menu.Item key="1" icon={<User size={16} />} className="rounded-md hover:bg-indigo-50 hover:text-indigo-600 transition-colors p-2 text-gray-700 font-medium">Hồ sơ</Menu.Item>
      <Menu.Item key="2" icon={<Settings size={16} />} className="rounded-md hover:bg-indigo-50 hover:text-indigo-600 transition-colors p-2 text-gray-700 font-medium">Cài đặt</Menu.Item>
      <Menu.Divider className="my-1 border-gray-100" />
      <Menu.Item key="3" icon={<LogOut size={16} />} className="rounded-md hover:bg-red-50 hover:text-red-600 transition-colors p-2 text-red-500 font-medium">
        <Link to="/">Đăng xuất</Link>
      </Menu.Item>
    </Menu>
  );

  const navItems = [
    { path: '/dispatcher', icon: LayoutDashboard, label: 'Tổng quan' },
    { path: '/dispatcher/orders', icon: FileText, label: 'Quản lý Đơn hàng' },
    { path: '/dispatcher/fleet', icon: Truck, label: 'Đội xe & Phân công' },
    { path: '/dispatcher/tracking', icon: MapPin, label: 'Bản đồ Theo dõi' },
  ];

  return (
    <div className="flex h-screen bg-[#f4f5f7] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#28243d] text-[#d6dce1] flex flex-col transition-all duration-300 ease-in-out shadow-xl z-20`}>
        <div className="h-16 flex items-center justify-center border-b border-[#3b355a] bg-[#28243d]">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#7367f0] flex items-center justify-center text-white font-bold text-xl">
                N
              </div>
              <span className="font-bold text-xl tracking-wide text-white">NEXLOG</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#7367f0] flex items-center justify-center text-white font-bold text-xl">
              N
            </div>
          )}
        </div>
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">{isSidebarOpen && 'Điều hướng'}</div>
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path || (item.path !== '/dispatcher' && location.pathname.startsWith(item.path));
            return (
              <Link key={index} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium group transition-all relative ${isActive ? 'bg-transparent text-[#7367f0]' : 'text-gray-400 hover:bg-[#3b355a] hover:text-white'}`}>
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#7367f0] rounded-r-md"></div>}
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Topbar */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 z-10 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-[#7367f0] hover:bg-indigo-50 p-2 rounded-lg transition-colors">
              <MenuIcon size={20} />
            </button>
            <Breadcrumb items={[{ title: 'Điều phối viên', className: 'font-semibold text-gray-800 text-lg' }]} className="hidden sm:block text-sm ml-4" />
          </div>
          <div className="flex items-center gap-6">
            <AntSearch placeholder="Tìm kiếm..." className="hidden md:block w-64 rounded-full" />
            
            <button className="text-gray-400 hover:text-blue-600 transition-colors relative">
              <Badge count={3} size="small" className="absolute -top-1 -right-1"><Bell size={22} className="text-gray-500" /></Badge>
            </button>
            
            <Dropdown overlay={profileMenu} trigger={['click']} placement="bottomRight">
              <div className="flex items-center gap-3 cursor-pointer pl-6 border-l border-gray-200 transition-colors">
                <Avatar style={{ backgroundColor: '#7367f0' }}>D</Avatar>
                <div className="hidden md:block text-sm text-left whitespace-nowrap">
                  <p className="font-semibold text-gray-700 leading-none mb-1">Dispatcher 01</p>
                  <p className="text-xs text-gray-500 leading-none">Admin</p>
                </div>
              </div>
            </Dropdown>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-[#f4f5f7]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DispatcherLayout;
