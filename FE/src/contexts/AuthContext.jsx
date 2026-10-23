"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.warn('localStorage is not available:', e);
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (identifier, password) => {
    // Mock login based on identifier prefix
    let role = 'GUEST';
    
    if (identifier.startsWith('admin')) role = 'ADMINISTRATOR';
    else if (identifier.startsWith('manager')) role = 'MANAGER';
    else if (identifier.startsWith('dispatcher')) role = 'DISPATCHER';
    else if (identifier.startsWith('driver')) role = 'DRIVER';
    else throw new Error('Invalid credentials');

    const loggedInUser = {
      id: Math.random().toString(36).substr(2, 9),
      username: identifier,
      role: role,
      name: `${role.charAt(0) + role.slice(1).toLowerCase()} User`
    };

    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));

    // Redirect based on role
    switch (role) {
      case 'ADMINISTRATOR':
        window.location.href = '/admin';
        break;
      case 'MANAGER':
        window.location.href = '/manager';
        break;
      case 'DISPATCHER':
        window.location.href = '/dispatcher';
        break;
      case 'DRIVER':
        window.location.href = '/driver';
        break;
      default:
        window.location.href = '/';
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const hasRole = (allowedRoles) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
