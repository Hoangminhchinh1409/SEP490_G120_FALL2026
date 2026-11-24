"use client";
import OrderManagement from '../../../src/views/dispatcher/OrderManagement';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function ManagerAllOrdersPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || (hasPermission && hasPermission('ORDER_MANAGE'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Quản lý Đơn hàng (ORDER_MANAGE)" />;
  }

  return <OrderManagement />;
}

