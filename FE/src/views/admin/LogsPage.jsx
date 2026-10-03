"use client";
import React from 'react';
import { Table, Input, DatePicker, Select } from 'antd';
import { Search } from 'lucide-react';

const { RangePicker } = DatePicker;

export default function LogsPage() {
  const logs = [
    { id: '1', timestamp: '30-09-2026 19:45:00', actor: 'dispatcher01', ip: '192.168.1.100', action: 'CREATE_ORDER', target: 'Order #ALS260930-0001', details: 'Created order successfully' },
    { id: '2', timestamp: '30-09-2026 19:50:22', actor: 'manager01', ip: '192.168.1.105', action: 'REASSIGN_ORDER', target: 'Order #ALS260930-0001', details: 'Reassigned from dispatcher01 to dispatcher02' },
    { id: '3', timestamp: '30-09-2026 20:05:11', actor: 'driver12', ip: '10.0.0.54', action: 'INCIDENT_REPORT', target: 'Trip #T123', details: 'Reported tire flat incident' },
    { id: '4', timestamp: '30-09-2026 20:10:00', actor: 'admin01', ip: '11.22.33.44', action: 'LOCK_USER', target: 'User #3', details: 'Locked dispatcher01 due to multiple failed logins' },
  ];

  const columns = [
    { title: 'Thời gian', dataIndex: 'timestamp', key: 'timestamp', width: 170 },
    { title: 'Người thực hiện', dataIndex: 'actor', key: 'actor', width: 150 },
    { title: 'Địa chỉ IP', dataIndex: 'ip', key: 'ip', width: 130 },
    { title: 'Hành động', dataIndex: 'action', key: 'action', width: 180 },
    { title: 'Đối tượng', dataIndex: 'target', key: 'target', width: 180 },
    { title: 'Chi tiết', dataIndex: 'details', key: 'details' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nhật ký Hoạt động</h1>
        <p className="text-gray-500">Tra cứu và lọc nhật ký thao tác toàn hệ thống (Dữ liệu chỉ ghi, không thể sửa/xóa).</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4">
        <RangePicker className="w-64" />
        <Input prefix={<Search size={16} className="text-gray-400" />} placeholder="Tìm theo người dùng, đối tượng..." className="w-64" />
        <Select defaultValue="ALL" style={{ width: 180 }} options={[
          { value: 'ALL', label: 'Tất cả hành động' },
          { value: 'CREATE_ORDER', label: 'Tạo đơn' },
          { value: 'REASSIGN_ORDER', label: 'Chuyển giao đơn' },
          { value: 'INCIDENT_REPORT', label: 'Báo sự cố' },
        ]} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={logs} 
          rowKey="id" 
          pagination={{ pageSize: 20 }} 
          size="middle"
        />
      </div>
    </div>
  );
}
