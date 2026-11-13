"use client";
import StaffAccountsPage from '../../../src/views/manager/StaffAccountsPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function Page() {
  const { user } = useAuth();
  const roleId = Number(user?.role_id);
  const isDispatcher = roleId === 3;

  if (isDispatcher) {
    return <AccessDenied moduleName="Tài khoản Nhân viên" />;
  }

  return <StaffAccountsPage />;
}
