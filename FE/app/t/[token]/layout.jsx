"use client";
import React from 'react';
import Header from '../../../src/components/common/Header';

export default function GuestLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-gray-500 text-sm">
        <p>© 2026 NEXLOG Smart Logistics. All rights reserved.</p>
      </footer>
    </div>
  );
}
