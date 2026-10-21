"use client";
import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Input, Select, Modal, Form, Switch, message, Popconfirm, Tooltip } from 'antd';
import { Search, Plus, Edit, Lock, Unlock, RotateCcw, User, Mail, Phone, Shield } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [submitting, setSubmitting] = useState(false);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [filters, setFilters] = useState({
    roleId: 'ALL',
    status: 'ALL',
    keyword: ''
  });

  const [form] = Form.useForm();

  // 1. Tải danh mục Roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const rolesData = await adminApi.getRoles();
        setRoles(rolesData || []);
      } catch (error) {
        console.error('Lỗi tải danh mục vai trò:', error);
      }
    };
    fetchRoles();
  }, []);

  // 2. Tải danh sách Users thông qua Effect (chuẩn React 19)
  useEffect(() => {
    let ignore = false;
    const loadUsers = async () => {
      try {
        const res = await adminApi.getUsers({
          page: pagination.current,
          limit: pagination.pageSize,
          roleId: filters.roleId !== 'ALL' ? filters.roleId : null,
          status: filters.status !== 'ALL' ? filters.status : null,
          keyword: filters.keyword
        });

        if (!ignore) {
          setUsers(res.users || []);
          setPagination(prev => ({
            ...prev,
            current: res.page || prev.current,
            pageSize: res.limit || prev.pageSize,
            total: res.total || 0
          }));
        }
      } catch (error) {
        if (!ignore) {
          console.error('Lỗi khi tải danh sách người dùng:', error);
          message.error(error.message || 'Không thể tải danh sách tài khoản');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadUsers();
    return () => {
      ignore = true;
    };
  }, [filters, pagination.current, pagination.pageSize]);

  // Hàm refresh thủ công (dành cho thao tác người dùng: đổi trang, submit form, đổi status)
  const refreshUsers = async (targetPage, targetPageSize) => {
    setLoading(true);
    try {
      const currentPage = targetPage || pagination.current;
      const currentPageSize = targetPageSize || pagination.pageSize;
      const res = await adminApi.getUsers({
        page: currentPage,
        limit: currentPageSize,
        roleId: filters.roleId !== 'ALL' ? filters.roleId : null,
        status: filters.status !== 'ALL' ? filters.status : null,
        keyword: filters.keyword
      });

      setUsers(res.users || []);
      setPagination(prev => ({
        ...prev,
        current: res.page || currentPage,
        pageSize: res.limit || currentPageSize,
        total: res.total || 0
      }));
    } catch (error) {
      console.error('Lỗi khi tải danh sách người dùng:', error);
      message.error(error.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setLoading(true);
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const handleRoleFilterChange = (value) => {
    setFilters(prev => ({ ...prev, roleId: value }));
  };

  const handleStatusFilterChange = (value) => {
    setFilters(prev => ({ ...prev, status: value }));
  };

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, keyword: value }));
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    form.resetFields();
    form.setFieldsValue({
      status: true,
      role_id: 3 // Default Dispatcher
    });
    setModalVisible(true);
  };

  // Mở modal chỉnh sửa
  const handleOpenEditModal = (record) => {
    setModalMode('EDIT');
    form.resetFields();
    form.setFieldsValue({
      id: record.id,
      username: record.username,
      full_name: record.full_name,
      email: record.email,
      phone: record.phone,
      zalo_link: record.zalo_link,
      role_id: record.role_id,
      status: record.status === 'ACTIVE'
    });
    setModalVisible(true);
  };

  // Submit form tạo / sửa
  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        username: values.username,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || null,
        zalo_link: values.zalo_link || null,
        role_id: Number(values.role_id),
        status: values.status ? 'ACTIVE' : 'LOCKED'
      };

      if (values.password && values.password.trim()) {
        payload.password = values.password.trim();
      }

      if (modalMode === 'CREATE') {
        await adminApi.createUser(payload);
        message.success('Tạo tài khoản mới thành công!');
      } else {
        await adminApi.updateUser(values.id, payload);
        message.success('Cập nhật thông tin tài khoản thành công!');
      }

      setModalVisible(false);
      refreshUsers(pagination.current, pagination.pageSize);
    } catch (error) {
      if (error.errorFields) return; // Form validation failed
      message.error(error.message || 'Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  // Đổi trạng thái Khóa / Mở khóa
  const handleToggleStatus = async (record) => {
    const nextStatus = record.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await adminApi.updateUserStatus(record.id, nextStatus);
      message.success(`Đã chuyển trạng thái tài khoản sang ${nextStatus}!`);
      refreshUsers(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error(error.message || 'Không thể đổi trạng thái tài khoản');
    }
  };

  const getRoleName = (roleId, roleObj) => {
    if (roleObj?.name) return roleObj.name;
    const r = roles.find(item => item.id === roleId);
    return r ? r.name : (roleId === 1 ? 'ADMINISTRATOR' : roleId === 2 ? 'MANAGER' : roleId === 3 ? 'DISPATCHER' : 'DRIVER');
  };

  const columns = [
    {
      title: 'Tài khoản',
      key: 'user_info',
      width: 220,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
            <User size={14} className="text-blue-500" />
            {record.full_name || record.username}
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">
            @{record.username}
          </div>
        </div>
      )
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      width: 220,
      render: (_, record) => (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Mail size={12} className="text-slate-400" />
            <span>{record.email}</span>
          </div>
          {record.phone && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Phone size={12} className="text-slate-400" />
              <span>{record.phone}</span>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Vai trò',
      dataIndex: 'role_id',
      key: 'role_id',
      width: 160,
      render: (roleId, record) => {
        const roleName = getRoleName(roleId, record.role);
        const color = roleName === 'ADMINISTRATOR' ? 'red' : roleName === 'MANAGER' ? 'orange' : roleName === 'DISPATCHER' ? 'blue' : 'green';
        return (
          <Tag color={color} className="font-semibold">
            {roleName}
          </Tag>
        );
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'error'} className="font-semibold">
          {status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa (Locked)'}
        </Tag>
      )
    },
    {
      title: 'Đăng nhập gần nhất',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 160,
      render: (time) => time ? (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(time).toLocaleString('vi-VN')}
        </span>
      ) : (
        <span className="text-xs text-slate-400 italic">Chưa đăng nhập</span>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record) => {
        const isSelfAdmin = record.role_id === 1 && record.username === 'admin';
        return (
          <div className="flex items-center gap-1">
            <Tooltip title="Chỉnh sửa thông tin">
              <Button
                type="text"
                icon={<Edit size={16} className="text-slate-600 hover:text-blue-600" />}
                onClick={() => handleOpenEditModal(record)}
              />
            </Tooltip>

            {!isSelfAdmin && (
              <Popconfirm
                title={record.status === 'ACTIVE' ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
                description={record.status === 'ACTIVE' ? 'Người dùng sẽ không thể đăng nhập sau khi bị khóa.' : 'Người dùng sẽ có thể đăng nhập bình thường.'}
                onConfirm={() => handleToggleStatus(record)}
                okText="Đồng ý"
                cancelText="Hủy"
                okButtonProps={{ danger: record.status === 'ACTIVE' }}
              >
                <Tooltip title={record.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}>
                  <Button
                    type="text"
                    danger={record.status === 'ACTIVE'}
                    icon={record.status === 'ACTIVE' ? <Lock size={16} className="text-red-500" /> : <Unlock size={16} className="text-emerald-500" />}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Shield size={22} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Quản lý Tài khoản (User Accounts)</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1.5">
            Quản trị danh sách người dùng toàn hệ thống, gán vai trò quyền hạn và quản lý trạng thái kích hoạt (BR-28).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<RotateCcw size={15} />}
            onClick={() => refreshUsers(pagination.current, pagination.pageSize)}
            loading={loading}
            className="flex items-center gap-1.5 font-medium rounded-xl h-10 px-3 bg-slate-50 hover:bg-slate-100 border-slate-200"
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 font-medium rounded-xl h-10 px-4 bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20"
          >
            Tạo tài khoản mới
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[260px]">
          <Input.Search
            placeholder="Tìm theo tên đăng nhập, họ tên, email, SĐT..."
            allowClear
            enterButton={<Search size={16} />}
            onSearch={handleSearch}
            className="h-10 rounded-xl"
          />
        </div>

        <Select
          defaultValue="ALL"
          value={filters.roleId}
          style={{ width: 180 }}
          className="h-10"
          onChange={handleRoleFilterChange}
          options={[
            { value: 'ALL', label: 'Tất cả vai trò' },
            ...roles.map(r => ({ value: r.id, label: r.name }))
          ]}
        />

        <Select
          defaultValue="ALL"
          value={filters.status}
          style={{ width: 170 }}
          className="h-10"
          onChange={handleStatusFilterChange}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            { value: 'ACTIVE', label: 'Đang hoạt động' },
            { value: 'LOCKED', label: 'Đã khóa (Locked)' },
          ]}
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => (
              <span className="text-xs text-slate-500">
                Hiển thị <b>{range[0]}-{range[1]}</b> trên tổng <b>{total}</b> tài khoản
              </span>
            )
          }}
          onChange={handleTableChange}
          size="middle"
        />
      </div>

      {/* Modal Tạo / Sửa User */}
      <Modal
        title={
          <div className="text-lg font-bold text-slate-800 pb-2 border-b border-slate-100">
            {modalMode === 'CREATE' ? 'Tạo Tài khoản Người dùng Mới' : 'Cập nhật Thông tin Tài khoản'}
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={submitting}
        okText={modalMode === 'CREATE' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
        cancelText="Hủy"
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={form} layout="vertical" className="mt-4 space-y-2">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[
              { required: true, message: 'Vui lòng nhập tên đăng nhập' },
              { min: 3, message: 'Tối thiểu 3 ký tự' }
            ]}
          >
            <Input placeholder="ví dụ: dispatcher_hanoi" disabled={modalMode === 'EDIT'} className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="full_name"
            label="Họ và tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
          >
            <Input placeholder="ví dụ: Nguyễn Văn A" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Địa chỉ Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không đúng định dạng' }
            ]}
          >
            <Input placeholder="ví dụ: user@nexlog.vn" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="password"
            label={modalMode === 'CREATE' ? 'Mật khẩu khởi tạo' : 'Mật khẩu mới (Để trống nếu không đổi)'}
            rules={modalMode === 'CREATE' ? [
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }
            ] : []}
          >
            <Input.Password placeholder="••••••••" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Nhập lại mật khẩu"
            dependencies={['password']}
            rules={[
              modalMode === 'CREATE' ? { required: true, message: 'Vui lòng xác nhận mật khẩu' } : {},
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('password') && value !== getFieldValue('password')) {
                    return Promise.reject(new Error('Mật khẩu nhập lại không khớp.')); // MSG82
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password placeholder="••••••••" className="h-10 rounded-lg" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="phone" label="Số điện thoại">
              <Input placeholder="0901234567" className="h-10 rounded-lg" />
            </Form.Item>

            <Form.Item name="zalo_link" label="Zalo liên hệ">
              <Input placeholder="https://zalo.me/..." className="h-10 rounded-lg" />
            </Form.Item>
          </div>

          <Form.Item
            name="role_id"
            label="Vai trò (Role)"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select
              className="h-10"
              options={roles.map(r => ({ value: r.id, label: r.name }))}
              placeholder="Chọn vai trò..."
            />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái kích hoạt" valuePropName="checked">
            <Switch checkedChildren="ACTIVE (Hoạt động)" unCheckedChildren="LOCKED (Đã khóa)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
