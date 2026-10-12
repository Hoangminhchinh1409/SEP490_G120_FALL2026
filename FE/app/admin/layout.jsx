"use client";
import { ProtectedRoute } from '../../src/contexts/ProtectedRoute';
import AdminLayout from '../../src/layouts/AdminLayout';

export default function Layout({ children }) {
  return (
    <ProtectedRoute allowedRoles={[1]}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}
