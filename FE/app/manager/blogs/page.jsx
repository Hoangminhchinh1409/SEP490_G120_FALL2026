"use client";
import BlogManagementPage from '../../../src/views/manager/BlogManagementPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function Page() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const isDispatcher = roleId === 3;
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('NEWS_MANAGE'));

  if (isDispatcher && !hasAccess) {
    return <AccessDenied moduleName="Viết & Xuất bản Tin tức (NEWS_MANAGE)" />;
  }

  return <BlogManagementPage />;
}
