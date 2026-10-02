"use client";
import React from 'react';

const DriverLayout = ({ children }) => {
  return (
    <div className="bg-slate-900 min-h-screen">
      {/* Mobile-first PWA Layout wrapper */}
      {/* The bottom navigation is currently implemented within DriverDashboard.jsx */}
      <main className="w-full max-w-md mx-auto h-full min-h-screen shadow-2xl relative bg-slate-900 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default DriverLayout;
