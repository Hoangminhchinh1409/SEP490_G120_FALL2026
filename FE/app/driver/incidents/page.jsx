"use client";
import React, { Suspense } from 'react';
import ReportIncidentPage from '../../../src/views/driver/ReportIncidentPage';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-slate-400 text-xs">Đang tải biểu mẫu báo cáo sự cố...</div>}>
      <ReportIncidentPage />
    </Suspense>
  );
}
