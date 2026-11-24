"use client";
import LocationsManagement from '../../../src/views/dispatcher/LocationsManagement';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';

export default function Page() {
  const { user } = useAuth();
  const roleId = Number(user?.role_id);
  const isManager = roleId === 2;

  if (isManager) {
    return <AccessDenied moduleName="Quản lý Điểm giao nhận (Locations)" />;
  }

  return <LocationsManagement />;
}
