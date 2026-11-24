"use client";
import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from 'antd';
import { useRouter } from 'next/navigation';

export default function AccessDenied({ moduleName = "trang này" }) {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl border border-red-200 flex items-center justify-center mb-4 shadow-sm">
        <ShieldAlert size={32} />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1.5">Truy Cập Bị Từ Chối (403 Forbidden)</h2>
      <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        Vai trò hiện tại của bạn không có quyền truy cập vào {moduleName} (MSG30). Vui lòng liên hệ Quản trị viên hệ thống để được cấp quyền xem chức năng này.
      </p>
      <Button
        type="primary"
        icon={<ArrowLeft size={16} />}
        onClick={() => router.back()}
        className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold"
      >
        Quay lại trang trước
      </Button>
    </div>
  );
}

