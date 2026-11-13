"use client";
import DispatcherDashboard from '../../src/views/dispatcher/DispatcherDashboard';
import { useAuth } from '../../src/providers/AuthProvider';
import AccessDenied from '../../src/components/common/AccessDenied';

export default function Page() {
  const { user } = useAuth();
  const roleId = Number(user?.role_id);
  const isManager = roleId === 2;

  if (isManager) {
    return <AccessDenied moduleName="Bảng điều khiển Điều phối viên" />;
  }

  return <DispatcherDashboard />;
}
