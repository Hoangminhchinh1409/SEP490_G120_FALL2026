"use client";
import React from 'react';
import { Table, Tag, Button } from 'antd';
import { FileSignature } from 'lucide-react';

export default function VendorsPage() {
  const vendors = [
    { id: 'V001', name: 'Nhà xe Phương Trang', status: 'Đã phê duyệt', contractId: 'HD-PT-2026', expiry: '2026-12-31' },
    { id: 'V002', name: 'Vận tải Thành Bưởi', status: 'Đã phê duyệt', contractId: 'HD-TB-2026', expiry: '2027-06-30' },
    { id: 'V003', name: 'Logistics Hoa Mai', status: 'Chờ phê duyệt', contractId: 'HD-HM-2026 (Draft)', expiry: '-' },
  ];

  const columns = [
    { title: 'Mã Đối tác', dataIndex: 'id', key: 'id' },
    { title: 'Tên Nhà xe', dataIndex: 'name', key: 'name', render: t => <span className="font-semibold">{t}</span> },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: status => <Tag color={status === 'Đã phê duyệt' ? 'success' : 'warning'}>{status}</Tag>
    },
    { title: 'Số Hợp đồng', dataIndex: 'contractId', key: 'contractId' },
    { title: 'Ngày hết hạn', dataIndex: 'expiry', key: 'expiry' },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary" 
          ghost 
          size="small" 
          icon={<FileSignature size={14} />} 
          disabled={record.status === 'Đã phê duyệt'}
        >
          {record.status === 'Đã phê duyệt' ? 'Xem HĐ' : 'Phê duyệt HĐ'}
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Đối tác & Hợp đồng</h1>
        <p className="text-gray-500">Xem xét và phê duyệt danh sách Nhà xe ngoài (Vendor) và quản lý Hợp đồng vận chuyển.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <Table columns={columns} dataSource={vendors} rowKey="id" pagination={false} />
      </div>
    </div>
  );
}
