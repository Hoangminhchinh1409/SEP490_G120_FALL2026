"use client";
import DashboardLayout from '../components/layout/DashboardLayout';
import { LayoutDashboard, Truck, FileText, MapPin } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

const DispatcherLayout = ({ children }) => {
  const { user } = useAuth();

  const navItems = [
    { href: '/dispatcher', icon: LayoutDashboard, name: 'Tổng quan' },
    { href: '/dispatcher/orders', icon: FileText, name: 'Quản lý Đơn hàng' },
    { href: '/dispatcher/fleet', icon: Truck, name: 'Đội xe & Phân công' },
    { href: '/dispatcher/tracking', icon: MapPin, name: 'Bản đồ Theo dõi' },
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
