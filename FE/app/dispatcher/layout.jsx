"use client";
import DispatcherLayout from '../../src/layouts/DispatcherLayout';
import { ProtectedRoute } from '../../src/contexts/ProtectedRoute';

export default function Layout({ children }) {
  return (
    <ProtectedRoute allowedRoles={[3]}>
      <DispatcherLayout>{children}</DispatcherLayout>
    </ProtectedRoute>
  );
}