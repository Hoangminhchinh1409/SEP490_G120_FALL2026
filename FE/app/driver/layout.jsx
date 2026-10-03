"use client";
import { ProtectedRoute } from '../../src/contexts/ProtectedRoute';
import DriverLayout from '../../src/layouts/DriverLayout';

export default function Layout({ children }) {
  return (
    <ProtectedRoute allowedRoles={['DRIVER']}>
      <DriverLayout>{children}</DriverLayout>
    </ProtectedRoute>
  );
}
