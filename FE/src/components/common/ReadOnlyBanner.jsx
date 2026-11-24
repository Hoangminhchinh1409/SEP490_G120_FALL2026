"use client";
import React from 'react';
import { Eye } from 'lucide-react';

export default function ReadOnlyBanner({ moduleName = "chức năng này" }) {
  return (
    <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl flex items-center gap-3 shadow-xs">
      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
        <Eye size={18} />
      </div>
      <div className="text-xs leading-relaxed">
        <span className="font-bold block text-blue-900">
          Chế độ xem thông tin (Read-Only Mode)
        </span>
        <span>
          Tài khoản của bạn được cấp quyền xem dữ liệu đối với {moduleName}. Các tính năng thêm mới, chỉnh sửa, xoá và phê duyệt đã bị vô hiệu hoá theo quy định phân quyền của hệ thống.
        </span>
      </div>
    </div>
  );
}

