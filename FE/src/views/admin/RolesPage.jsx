"use client";
import React from 'react';
import { Table, Tag, Checkbox } from 'antd';

export default function RolesPage() {
  const permissions = [
    { module: 'User Management', action: 'Create/Update', admin: true, manager: false, dispatcher: false, driver: false },
    { module: 'System Settings', action: 'Update Configs', admin: true, manager: false, dispatcher: false, driver: false },
    { module: 'Fleet & Driver', action: 'Manage Profiles', admin: true, manager: true, dispatcher: false, driver: false },
    { module: 'Orders', action: 'Reassign Orders', admin: true, manager: true, dispatcher: false, driver: false },
    { module: 'Incident', action: 'Approve Compensation', admin: true, manager: true, dispatcher: false, driver: false },
    { module: 'Orders', action: 'Create & Group', admin: true, manager: true, dispatcher: true, driver: false },
    { module: 'Trip', action: 'Update Status', admin: true, manager: true, dispatcher: true, driver: true },
  ];

  const columns = [
    { title: 'Module', dataIndex: 'module', key: 'module', render: t => <b>{t}</b> },
    { title: 'Thao tác (Action)', dataIndex: 'action', key: 'action' },
    { title: <Tag color="red">ADMINISTRATOR</Tag>, dataIndex: 'admin', key: 'admin', align: 'center', render: val => <Checkbox checked={val} disabled /> },
    { title: <Tag color="orange">MANAGER</Tag>, dataIndex: 'manager', key: 'manager', align: 'center', render: val => <Checkbox checked={val} disabled /> },
    { title: <Tag color="blue">DISPATCHER</Tag>, dataIndex: 'dispatcher', key: 'dispatcher', align: 'center', render: val => <Checkbox checked={val} disabled /> },
    { title: <Tag color="green">DRIVER</Tag>, dataIndex: 'driver', key: 'driver', align: 'center', render: val => <Checkbox checked={val} disabled /> },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Ma trận Phân quyền</h1>
        <p className="text-gray-500">Xem danh sách các vai trò mặc định và chi tiết danh mục quyền truy cập.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden p-4">
        <Table 
          columns={columns} 
          dataSource={permissions.map((p, i) => ({ ...p, key: i }))} 
          pagination={false}
          bordered
        />
      </div>
    </div>
  );
}
