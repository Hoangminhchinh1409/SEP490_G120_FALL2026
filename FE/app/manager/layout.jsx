"use client";
import { ProtectedRoute } from '../../src/contexts/ProtectedRoute';
import ManagerLayout from '../../src/layouts/ManagerLayout';

export default function Layout({ children }) {
  return (
    <ProtectedRoute allowedRoles={[1, 2]}>
      <ManagerLayout>{children}</ManagerLayout>
    </ProtectedRoute>
  );
}
