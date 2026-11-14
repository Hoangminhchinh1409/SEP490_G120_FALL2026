"use client";
import MajorIncidentListPage from '../../../src/views/manager/MajorIncidentListPage';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function Page() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const isDispatcher = roleId === 3;
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('INCIDENT_MANAGE'));

  if (isDispatcher && !hasAccess) {
    return <AccessDenied moduleName="Duyệt Khiếu nại & Bồi thường (INCIDENT_MANAGE)" />;
  }

  return <MajorIncidentListPage />;
}
