"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRoles && !hasRole(allowedRoles)) {
        // Redirect unauthorized users to their default dashboard or login
        if (user.role === 'ADMINISTRATOR') router.push('/admin');
        else if (user.role === 'MANAGER') router.push('/manager');
        else if (user.role === 'DISPATCHER') router.push('/dispatcher');
        else if (user.role === 'DRIVER') router.push('/driver');
        else router.push('/login');
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
