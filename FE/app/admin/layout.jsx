"use client";
import { ProtectedRoute } from '../../src/contexts/ProtectedRoute';
import AdminLayout from '../../src/layouts/AdminLayout';

export default function Layout({ children }) {
  return (
    <ProtectedRoute allowedRoles={['ADMINISTRATOR']}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}
