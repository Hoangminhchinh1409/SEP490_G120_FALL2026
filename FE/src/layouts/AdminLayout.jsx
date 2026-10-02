"use client";
import DashboardLayout from '../components/layout/DashboardLayout';
import { LayoutDashboard, Settings, FileText, User } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

const AdminLayout = ({ children }) => {
  const { user } = useAuth();

  const navItems = [
    { href: '/admin', icon: LayoutDashboard, name: 'Tổng quan' },
    { href: '/admin/users', icon: User, name: 'Quản lý Tài khoản' },
    { href: '/admin/roles', icon: Settings, name: 'Phân quyền' },
    { href: '/admin/logs', icon: FileText, name: 'Nhật ký Hoạt động' },
    { href: '/admin/settings', icon: Settings, name: 'Cấu hình Hệ thống' },
  ];

  return (
    <DashboardLayout
      role="admin"
      menuItems={navItems}
      user={{
        name: user?.name || 'Administrator User',
        roleText: user?.role || 'Quản trị viên'
      }}
    >
      {children}
    </DashboardLayout>
  );
};

export default AdminLayout;
