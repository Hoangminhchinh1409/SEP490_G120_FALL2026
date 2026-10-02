"use client";
import React, { useState } from 'react';
import { Table, Tag, Button, Input, Select, Modal, Form, Switch } from 'antd';
import { Search, Plus, Edit, Lock, Unlock } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([
    { id: '1', username: 'admin01', fullName: 'Nguyễn Văn A', role: 'ADMINISTRATOR', status: 'ACTIVE' },
    { id: '2', username: 'manager01', fullName: 'Trần Thị B', role: 'MANAGER', status: 'ACTIVE' },
    { id: '3', username: 'dispatcher01', fullName: 'Lê Văn C', role: 'DISPATCHER', status: 'LOCKED' },
  ]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    { title: 'Tên đăng nhập', dataIndex: 'username', key: 'username' },
    { title: 'Họ & Tên', dataIndex: 'fullName', key: 'fullName' },
    { 
      title: 'Vai trò', 
      dataIndex: 'role', 
      key: 'role',
      render: (role) => (
        <Tag color={
          role === 'ADMINISTRATOR' ? 'red' : 
          role === 'MANAGER' ? 'orange' : 
          role === 'DISPATCHER' ? 'blue' : 'green'
        }>
          {role}
        </Tag>
      )
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'error'}>
          {status}
        </Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button type="text" icon={<Edit size={16} />} onClick={() => editUser(record)} />
          <Button type="text" danger icon={record.status === 'ACTIVE' ? <Lock size={16} /> : <Unlock size={16} />} 
            onClick={() => toggleStatus(record.id)} />
        </div>
      ),
    },
  ];

  const editUser = (record) => {
    form.setFieldsValue({
      ...record,
      status: record.status === 'ACTIVE'
    });
    setIsModalVisible(true);
  };

  const toggleStatus = (id) => {
    setUsers(users.map(u => u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' } : u));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Tài khoản</h1>
          <p className="text-gray-500">Tạo mới, cập nhật và khóa/mở khóa tài khoản hệ thống.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => { form.resetFields(); setIsModalVisible(true); }}>
          Tạo tài khoản mới
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex gap-4">
        <Input prefix={<Search size={16} className="text-gray-400" />} placeholder="Tìm theo tên đăng nhập hoặc họ tên..." className="max-w-md" />
        <Select defaultValue="ALL" style={{ width: 150 }} options={[
          { value: 'ALL', label: 'Tất cả vai trò' },
          { value: 'ADMINISTRATOR', label: 'Administrator' },
          { value: 'MANAGER', label: 'Manager' },
        ]} />
        <Select defaultValue="ALL" style={{ width: 150 }} options={[
          { value: 'ALL', label: 'Tất cả trạng thái' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'LOCKED', label: 'Locked' },
        ]} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table columns={columns} dataSource={users} rowKey="id" pagination={{ pageSize: 10 }} />
      </div>

      <Modal 
        title="Thông tin Tài khoản" 
        open={isModalVisible} 
        onCancel={() => setIsModalVisible(false)}
        onOk={() => {
          form.validateFields().then(values => {
            const newUser = {
              id: values.id || Math.random().toString(),
              username: values.username,
              fullName: values.fullName,
              role: values.role,
              status: values.status ? 'ACTIVE' : 'LOCKED'
            };
            if (values.id) {
              setUsers(users.map(u => u.id === values.id ? newUser : u));
            } else {
              setUsers([...users, newUser]);
            }
            setIsModalVisible(false);
          });
        }}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={[
              { value: 'ADMINISTRATOR', label: 'Administrator' },
              { value: 'MANAGER', label: 'Manager' },
              { value: 'DISPATCHER', label: 'Dispatcher' },
              { value: 'DRIVER', label: 'Driver' },
            ]} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái kích hoạt" valuePropName="checked">
            <Switch checkedChildren="ACTIVE" unCheckedChildren="LOCKED" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
