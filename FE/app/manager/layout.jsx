"use client";
import { ProtectedRoute } from '../../src/contexts/ProtectedRoute';
import ManagerLayout from '../../src/layouts/ManagerLayout';

export default function Layout({ children }) {
  return (
    <ProtectedRoute allowedRoles={['MANAGER']}>
      <ManagerLayout>{children}</ManagerLayout>
    </ProtectedRoute>
  );
}
