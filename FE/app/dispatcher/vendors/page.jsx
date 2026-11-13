"use client";
import VendorsPage from '../../../src/views/manager/VendorsPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';
import ReadOnlyBanner from '../../../src/components/common/ReadOnlyBanner';

export default function DispatcherVendorsPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('VENDOR_MANAGE'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Nhà xe Đối tác & Hợp đồng (VENDOR_MANAGE)" />;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-6 lg:p-8 pb-0 max-w-[1600px] mx-auto">
        <ReadOnlyBanner moduleName="Nhà xe Đối tác & Hợp đồng (Chế độ xem chéo)" />
      </div>
      <VendorsPage readOnly={true} />
    </div>
  );
}

