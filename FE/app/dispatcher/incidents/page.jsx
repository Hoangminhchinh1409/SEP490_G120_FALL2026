"use client";
import React, { useState } from 'react';
import { Tabs } from 'antd';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../src/providers/AuthProvider';
import AccessDenied from '../../../src/components/common/AccessDenied';
import ReadOnlyBanner from '../../../src/components/common/ReadOnlyBanner';
import MajorIncidentListPage from '../../../src/views/manager/MajorIncidentListPage';
import ApprovalsPage from '../../../src/views/manager/ApprovalsPage';

export default function DispatcherIncidentsPage() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('incidents');
  const roleId = Number(user?.role_id);
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('INCIDENT_MANAGE'));

  if (!hasAccess) {
    return <AccessDenied moduleName="Xử lý Sự cố & Duyệt Bồi thường (INCIDENT_MANAGE)" />;
  }

  const tabItems = [
    {
      key: 'incidents',
      label: (
        <span className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={16} className="text-amber-500" />
          Sự cố lớn trên tuyến
        </span>
      ),
      children: <MajorIncidentListPage readOnly={true} />
    },
    {
      key: 'approvals',
      label: (
        <span className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={16} className="text-emerald-500" />
          Duyệt Bồi thường &amp; Khiếu nại
        </span>
      ),
      children: <ApprovalsPage readOnly={true} />
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-[1600px] mx-auto">
      <ReadOnlyBanner moduleName="Xử lý Sự cố & Duyệt Bồi thường (Chế độ xem chéo Điều phối viên)" />
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </div>
    </div>
  );
}

