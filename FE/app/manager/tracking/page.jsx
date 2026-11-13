"use client";
import dynamic from 'next/dynamic';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';
import ReadOnlyBanner from '../../../src/components/common/ReadOnlyBanner';

const TrackingMap = dynamic(() => import('../../../src/views/dispatcher/TrackingMap'), { ssr: false });

export default function ManagerTrackingPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || (hasPermission && hasPermission('TRIP_MONITOR'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Giám sát Hành trình Chuyến xe (TRIP_MONITOR)" />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] min-h-[700px] space-y-3">
      <div className="px-2 pt-1">
        <ReadOnlyBanner moduleName="Giám sát Hành trình Chuyến xe (Chế độ xem chéo Quản lý)" />
      </div>
      <div className="flex-1 w-full h-[calc(100%-60px)] min-h-[640px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
        <TrackingMap />
      </div>
    </div>
  );
}
