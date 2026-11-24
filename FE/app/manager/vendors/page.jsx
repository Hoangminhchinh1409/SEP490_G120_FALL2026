"use client";
import VendorsPage from '../../../src/views/manager/VendorsPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function Page() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const isDispatcher = roleId === 3;
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('VENDOR_MANAGE'));

  if (isDispatcher && !hasAccess) {
    return <AccessDenied moduleName="Quản lý Nhà xe & Hợp đồng Đối tác (VENDOR_MANAGE)" />;
  }

  return <VendorsPage />;
}
