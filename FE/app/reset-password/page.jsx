"use client";
import { Suspense } from 'react';
import ResetPasswordPage from '../../src/views/auth/ResetPasswordPage';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-medium text-slate-500">
          Đang tải...
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
