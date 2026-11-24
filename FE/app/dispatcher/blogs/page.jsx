"use client";
import BlogManagementPage from '../../../src/views/manager/BlogManagementPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';
import ReadOnlyBanner from '../../../src/components/common/ReadOnlyBanner';

export default function DispatcherBlogsPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('NEWS_MANAGE'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Viết & Xuất bản Tin tức (NEWS_MANAGE)" />;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-6 lg:p-8 pb-0 max-w-[1600px] mx-auto">
        <ReadOnlyBanner moduleName="Viết & Xuất bản Tin tức (Chế độ xem chéo)" />
      </div>
      <BlogManagementPage readOnly={true} />
    </div>
  );
}

