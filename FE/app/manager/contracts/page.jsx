"use client";
import VendorsPage from '../../../src/views/manager/VendorsPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';
import ReadOnlyBanner from '../../../src/components/common/ReadOnlyBanner';

export default function ManagerContractsPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || (hasPermission && hasPermission('CONTRACT_MANAGE'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Quản lý Hợp đồng Vận chuyển (CONTRACT_MANAGE)" />;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-6 lg:p-8 pb-0 max-w-[1600px] mx-auto">
        <ReadOnlyBanner moduleName="Hợp đồng Vận chuyển Khách/Vendor (Chế độ xem chéo Quản lý)" />
      </div>
      <VendorsPage readOnly={true} initialTab="CONTRACTS" />
    </div>
  );
}

