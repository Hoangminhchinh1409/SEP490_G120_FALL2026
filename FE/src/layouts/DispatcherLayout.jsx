"use client";
import DashboardLayout from '../components/layout/DashboardLayout';
import { LayoutDashboard, Truck, FileText, MapPin, Route, ScrollText, Compass, AlertTriangle, Building2 } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

const DispatcherLayout = ({ children }) => {
  const { user, hasPermission } = useAuth();

  const allNavItems = [
    { href: '/dispatcher', icon: LayoutDashboard, name: 'Tổng quan' },
    { href: '/dispatcher/orders', icon: FileText, name: 'Quản lý Đơn hàng', permission: 'ORDER_MANAGE' },
    { href: '/dispatcher/trips', icon: Route, name: 'Kế hoạch & Chuyến xe', permission: 'ORDER_ASSIGN' },
    { href: '/dispatcher/locations', icon: MapPin, name: 'Điểm giao nhận' },
    { href: '/dispatcher/contracts', icon: ScrollText, name: 'Hợp đồng vận tải', permission: 'CONTRACT_MANAGE' },
    { href: '/dispatcher/fleet', icon: Truck, name: 'Đội xe & Tài xế' },
    { href: '/dispatcher/tracking', icon: Compass, name: 'Bản đồ Theo dõi', permission: 'TRIP_MONITOR' },
    // Menu xem chéo được cấp quyền bởi Admin (Chỉ xem - Read-only)
    { href: '/manager/approvals', icon: AlertTriangle, name: 'Sự cố & Bồi thường (Chỉ xem)', permission: 'INCIDENT_MANAGE', isCrossRole: true },
    { href: '/manager/vendors', icon: Building2, name: 'Nhà xe & Thầu phụ (Chỉ xem)', permission: 'VENDOR_MANAGE', isCrossRole: true },
  ];

  const navItems = allNavItems.filter(item => {
    if (!item.permission) return true;
    if (item.isCrossRole) {
      return hasPermission && hasPermission(item.permission);
    }
    if (Number(user?.role_id) === 1 || Number(user?.role_id) === 3) return true;
    return hasPermission ? hasPermission(item.permission) : true;
  });

  return (
    <DashboardLayout
      role="dispatcher"
      menuItems={navItems}
      user={{
        name: user?.name || user?.full_name || 'Dispatcher User',
        roleText: user?.role || user?.role_name || 'Điều phối viên'
      }}
    >
      {children}
    </DashboardLayout>
  );
};

export default DispatcherLayout;
