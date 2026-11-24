"use client";
import FleetPage from '../../../src/views/manager/FleetPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function Page() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const isDispatcher = roleId === 3;
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('FLEET_MANAGE'));

  if (isDispatcher && !hasAccess) {
    return <AccessDenied moduleName="Quản lý Đội xe & Tài xế (FLEET_MANAGE)" />;
  }

  return <FleetPage />;
}
