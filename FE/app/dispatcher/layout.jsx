"use client";
import DispatcherLayout from '../../src/layouts/DispatcherLayout';
import { ProtectedRoute } from '../../src/contexts/ProtectedRoute';

export default function Layout({ children }) { 
  return (
    <ProtectedRoute allowedRoles={['DISPATCHER']}>
      <DispatcherLayout>{children}</DispatcherLayout>
    </ProtectedRoute>
  ); 
}