"use client";
import DriverShiftsPage from '../../../src/views/manager/DriverShiftsPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';
import ReadOnlyBanner from '../../../src/components/common/ReadOnlyBanner';

export default function DispatcherShiftsPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('DRIVER_SHIFT_MANAGE'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Lịch ca trực Tài xế (DRIVER_SHIFT_MANAGE)" />;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-6 lg:p-8 pb-0 max-w-[1600px] mx-auto">
        <ReadOnlyBanner moduleName="Lịch ca trực Tài xế (Chế độ xem chéo)" />
      </div>
      <DriverShiftsPage readOnly={true} />
    </div>
  );
}

