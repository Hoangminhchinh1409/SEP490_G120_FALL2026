"use client";
import FleetPage from '../../../src/views/manager/FleetPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function DispatcherFleetPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('FLEET_MANAGE'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Quản lý Thông tin Xe & Hồ sơ Tài xế (FLEET_MANAGE)" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-[1600px] mx-auto">
      <FleetPage readOnly={true} />
    </div>
  );
}
