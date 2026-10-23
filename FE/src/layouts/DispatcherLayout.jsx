"use client";
import DashboardLayout from '../components/layout/DashboardLayout';
import { LayoutDashboard, Truck, FileText, MapPin, Route, ScrollText, Compass } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

const DispatcherLayout = ({ children }) => {
  const { user } = useAuth();

  const navItems = [
    { href: '/dispatcher', icon: LayoutDashboard, name: 'Tổng quan' },
    { href: '/dispatcher/orders', icon: FileText, name: 'Quản lý Đơn hàng' },
    { href: '/dispatcher/trips', icon: Route, name: 'Kế hoạch & Chuyến xe' },
    { href: '/dispatcher/locations', icon: MapPin, name: 'Điểm giao nhận' },
    { href: '/dispatcher/contracts', icon: ScrollText, name: 'Hợp đồng vận tải' },
    { href: '/dispatcher/fleet', icon: Truck, name: 'Đội xe & Tài xế' },
    { href: '/dispatcher/tracking', icon: Compass, name: 'Bản đồ Theo dõi' },
  ];

  return (
    <DashboardLayout
      role="dispatcher"
      menuItems={navItems}
      user={{
        name: user?.name || 'Dispatcher User',
        roleText: user?.role || 'Điều phối viên'
      }}
    >
      {children}
    </DashboardLayout>
  );
};

export default DispatcherLayout;
