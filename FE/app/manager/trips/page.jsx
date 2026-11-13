"use client";
import { useRouter } from 'next/navigation';
import { Result, Button, Spin } from 'antd';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../src/providers/AuthProvider';
import TripPlanningAndMonitoring from '../../../src/views/dispatcher/TripPlanningAndMonitoring';

export default function Page() {
  const router = useRouter();
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  const roleId = Number(user?.role_id);
  const isManager = roleId === 2;
  const hasAccess = roleId === 1 || (hasPermission && (hasPermission('ORDER_ASSIGN') || hasPermission('TRIP_MONITOR')));

  if (isManager && !hasAccess) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <Result
          status="403"
          icon={<ShieldAlert size={64} className="text-red-500 mx-auto" />}
          title={<span className="text-xl font-bold text-gray-800">403 - Quyền truy cập bị từ chối</span>}
          subTitle={
            <span className="text-gray-600 text-sm">
              Bạn không có quyền xem hoặc thao tác trên trang <b>Kế hoạch chuyến xe</b>. Vui lòng liên hệ Quản trị viên hệ thống để được cấp quyền xem chéo trong Ma trận phân quyền.
            </span>
          }
          extra={
            <Button
              type="primary"
              className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold"
              onClick={() => router.push('/manager')}
            >
              Quay lại Bảng điều khiển Quản lý
            </Button>
          }
        />
      </div>
    );
  }

  return <TripPlanningAndMonitoring readOnly={true} />;
}
