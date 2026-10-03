"use client";
import DashboardLayout from '../components/layout/DashboardLayout';
import { BarChart3, Truck, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ManagerLayout = ({ children }) => {
  const { user } = useAuth();
  
  const navItems = [
    { href: '/manager', icon: BarChart3, name: 'Tổng quan Hiệu suất' },
    { href: '/manager/orders', icon: FileText, name: 'Quản lý Đơn hàng' },
    { href: '/manager/fleet', icon: Truck, name: 'Quản lý Đội xe' },
    { href: '/manager/approvals', icon: CheckCircle, name: 'Duyệt yêu cầu' },
  ];

  return (
    <DashboardLayout 
      role="manager" 
      menuItems={navItems} 
      user={{ 
        name: user?.name || 'Manager User', 
        roleText: user?.role || 'Quản lý Vận hành' 
      }}
    >
      {children}
    </DashboardLayout>
  );
};

export default ManagerLayout;
