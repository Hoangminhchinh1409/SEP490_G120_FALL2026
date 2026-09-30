"use client";
import React, { useState } from 'react';
import { Tabs, Table, Tag, Button, Modal, Form, Input, Select, DatePicker } from 'antd';
import { Plus, Edit } from 'lucide-react';

export default function FleetPage() {
  const [form] = Form.useForm();
  const [isDriverModalVisible, setIsDriverModalVisible] = useState(false);

  const trucks = [
    { id: '29H-123.45', type: 'Thaco 1.25T', payload: '1250 kg', status: 'Sẵn sàng' },
    { id: '29H-543.21', type: 'Thaco 1.25T', payload: '1250 kg', status: 'Đang chạy' },
    { id: '29H-987.65', type: 'Thaco 1.25T', payload: '1250 kg', status: 'Bảo dưỡng' },
  ];

  const drivers = [
    { id: 'D01', name: 'Nguyễn Văn Tài', phone: '0901234567', license: 'B2', expiry: '2028-12-31', status: 'ACTIVE' },
    { id: 'D02', name: 'Trần Bình Trọng', phone: '0987654321', license: 'C', expiry: '2025-06-30', status: 'ACTIVE' },
  ];

  const truckColumns = [
    { title: 'Biển số xe', dataIndex: 'id', key: 'id', render: text => <span className="font-bold">{text}</span> },
    { title: 'Loại xe', dataIndex: 'type', key: 'type' },
    { title: 'Tải trọng', dataIndex: 'payload', key: 'payload' },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: status => <Tag color={status === 'Sẵn sàng' ? 'success' : status === 'Đang chạy' ? 'processing' : 'error'}>{status}</Tag>
    },
  ];

  const driverColumns = [
    { title: 'Mã TX', dataIndex: 'id', key: 'id' },
    { title: 'Họ tên', dataIndex: 'name', key: 'name' },
    { title: 'SĐT', dataIndex: 'phone', key: 'phone' },
    { title: 'Bằng lái', dataIndex: 'license', key: 'license' },
    { title: 'Ngày hết hạn', dataIndex: 'expiry', key: 'expiry' },
    { 
      title: 'Tài khoản', 
      dataIndex: 'status', 
      key: 'status',
      render: status => <Tag color={status === 'ACTIVE' ? 'success' : 'error'}>{status}</Tag>
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: () => <Button type="link" size="small">Sửa</Button>
    }
  ];

  const items = [
    {
      key: '1',
      label: 'Đội xe nội bộ (6 xe Thaco 1.25T)',
      children: (
        <div>
          <Table columns={truckColumns} dataSource={trucks} rowKey="id" pagination={false} />
        </div>
      )
    },
    {
      key: '2',
      label: 'Hồ sơ Tài xế (18 người)',
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Button type="primary" icon={<Plus size={16}/>} onClick={() => setIsDriverModalVisible(true)}>Thêm tài xế</Button>
          </div>
          <Table columns={driverColumns} dataSource={drivers} rowKey="id" pagination={false} />
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Đội xe & Tài xế</h1>
        <p className="text-gray-500">Quản lý danh mục xe nội bộ ALS và hồ sơ, lịch làm việc của tài xế.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <Tabs defaultActiveKey="1" items={items} />
      </div>

      <Modal title="Thêm/Sửa Tài xế" open={isDriverModalVisible} onCancel={() => setIsDriverModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Họ tên" rules={[{required: true}]}><Input /></Form.Item>
          <Form.Item name="phone" label="SĐT" rules={[{required: true}]}><Input /></Form.Item>
          <Form.Item name="license" label="Hạng bằng lái"><Select options={[{value:'B2',label:'B2'},{value:'C',label:'C'}]} /></Form.Item>
          <Form.Item name="expiry" label="Ngày hết hạn bằng"><DatePicker className="w-full" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
