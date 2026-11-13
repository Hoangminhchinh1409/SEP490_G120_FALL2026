"use client";
import ManagerDashboard from '../../src/views/manager/ManagerDashboard';
import { useAuth } from '../../src/providers/AuthProvider';
import AccessDenied from '../../src/components/common/AccessDenied';

export default function Page() {
  const { user } = useAuth();
  const roleId = Number(user?.role_id);
  const isDispatcher = roleId === 3;

  if (isDispatcher) {
    return <AccessDenied moduleName="Bảng điều khiển Quản lý" />;
  }

  return <ManagerDashboard />;
}
