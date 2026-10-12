"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRoles && !hasRole(allowedRoles)) {
        const roleRoutes = {
          1: '/admin',
          2: '/manager',
          3: '/dispatcher',
          4: '/driver',
        };
        router.push(roleRoutes[user.role_id] || '/login');
      }
    }
  }, [user, loading, allowedRoles, router, hasRole]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || (allowedRoles && !hasRole(allowedRoles))) {
    return null; // Will redirect in useEffect
  }

  return children;
};
