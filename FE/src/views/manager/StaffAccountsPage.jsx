"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  Button, 
  Input, 
  Select, 
  Modal, 
  Form, 
  Switch, 
  message, 
  Tooltip, 
  Popconfirm
} from 'antd';
import { 
  Search, 
  Plus, 
  Edit3, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Users, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Mail, 
  Phone, 
  User, 
  Calendar
} from 'lucide-react';
import { managerApi } from '../../api/managerApi';

export default function StaffAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modal Screen 27 (Chi tiết & Tạo mới)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusTogglingId, setStatusTogglingId] = useState(null);

  const [form] = Form.useForm();

  // Load danh sách tài khoản
  const fetchAccounts = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await managerApi.getStaffAccounts({
        search: searchText,
        role: selectedRole,
        status: selectedStatus
      });
      setAccounts(res.accounts || []);
    } catch (error) {
      console.error('Lỗi khi tải danh sách tài khoản:', error);
      message.error(error.message || 'Không thể tải danh sách tài khoản nhân viên.');
    } finally {
      setLoading(false);
    }
  }, [searchText, selectedRole, selectedStatus]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await managerApi.getStaffAccounts({
          search: searchText,
          role: selectedRole,
          status: selectedStatus
        });
        if (isMounted) {
          setAccounts(res.accounts || []);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Lỗi khi tải danh sách tài khoản:', error);
          setLoading(false);
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, [selectedRole, selectedStatus, searchText]);

  // Tìm kiếm khi nhấn Enter hoặc bấm tìm
  const handleSearch = () => {
    fetchAccounts();
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setSelectedAccount(null);
    setIsModalOpen(true);
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        role: 'DISPATCHER',
        status: true
      });
    }, 0);
  };

  // Mở modal chi tiết / cập nhật (Screen 27)
  const handleOpenEditModal = (account) => {
    setIsEditMode(true);
    setSelectedAccount(account);
    setIsModalOpen(true);
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        id: account.id,
        username: account.username,
        full_name: account.full_name,
        email: account.email,
        phone: account.phone,
        role: account.role_id === 3 ? 'DISPATCHER' : 'DRIVER',
        status: account.status === 'ACTIVE'
      });
    }, 0);
  };

  // Xử lý submit form Screen 27
  const handleSubmitForm = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        username: values.username,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        role: values.role,
        status: values.status ? 'ACTIVE' : 'LOCKED'
      };

      if (values.password && values.password.trim() !== '') {
        payload.password = values.password.trim();
      }

      if (isEditMode) {
        await managerApi.updateStaffAccount(selectedAccount.id, payload);
        message.success(`Cập nhật thông tin tài khoản "${values.username}" thành công!`);
      } else {
        const res = await managerApi.createStaffAccount(payload);
        message.success(`Đã tạo tài khoản "${values.username}" thành công! Mật khẩu khởi tạo: ${res.account?.initial_password || 'Nexlog@2026'}`);
      }

      setIsModalOpen(false);
      fetchAccounts();
    } catch (error) {
      if (error?.errorFields) return; // Validation error của Antd
      console.error('Lỗi khi lưu tài khoản:', error);
      message.error(error.message || 'Thao tác không thành công.');
    } finally {
      setSubmitting(false);
    }
  };

  // Khóa hoặc mở khóa tài khoản
  const handleToggleStatus = async (account) => {
    try {
      setStatusTogglingId(account.id);
      const targetStatus = account.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
      const res = await managerApi.toggleStaffAccountStatus(account.id, targetStatus);
      message.success(res.message || 'Cập nhật trạng thái thành công.');
      fetchAccounts();
    } catch (error) {
      console.error('Lỗi khi đổi trạng thái:', error);
      message.error(error.message || 'Không thể đổi trạng thái tài khoản.');
    } finally {
      setStatusTogglingId(null);
    }
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = accounts.length;
    const dispatchers = accounts.filter(a => a.role_id === 3 || a.role === 'DISPATCHER').length;
    const drivers = accounts.filter(a => a.role_id === 4 || a.role === 'DRIVER').length;
    const active = accounts.filter(a => a.status === 'ACTIVE').length;
    const locked = accounts.filter(a => a.status === 'LOCKED').length;
    return { total, dispatchers, drivers, active, locked };
  }, [accounts]);

  // Cấu hình các cột của Bảng Screen 26
  const columns = [
    {
      title: 'Nhân viên',
      key: 'user_info',
      render: (_, record) => {
        const initial = (record.full_name || record.username || 'U').charAt(0).toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-sm ${
              record.role_id === 3 ? 'bg-gradient-to-tr from-blue-600 to-indigo-500' : 'bg-gradient-to-tr from-emerald-600 to-teal-500'
            }`}>
              {initial}
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-[14px]">
                {record.full_name || 'Chưa cập nhật tên'}
              </div>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <span>@{record.username}</span>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      title: 'Thông tin liên hệ',
      key: 'contact',
      render: (_, record) => (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>{record.email || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{record.phone || 'Chưa có SĐT'}</span>
          </div>
        </div>
      )
    },
    {
      title: 'Vai trò (Role)',
      dataIndex: 'role_id',
      key: 'role',
      align: 'center',
      render: (roleId, record) => {
        const isDispatcher = roleId === 3 || record.role === 'DISPATCHER';
        return (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
            isDispatcher 
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDispatcher ? 'bg-blue-600' : 'bg-emerald-600'}`}></span>
            {isDispatcher ? 'Điều phối viên (Dispatcher)' : 'Tài xế (Driver)'}
          </span>
        );
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => {
        const isActive = status === 'ACTIVE';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isActive 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {isActive ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
            {isActive ? 'Hoạt động (Active)' : 'Đã khóa (Locked)'}
          </span>
        );
      }
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => (
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {date ? new Date(date).toLocaleDateString('vi-VN') : '—'}
        </span>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <div className="flex items-center justify-end gap-1.5">
          <Tooltip title="Xem & Cập nhật chi tiết (Screen 27)">
            <Button 
              type="text" 
              size="small"
              className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 flex items-center gap-1"
              onClick={() => handleOpenEditModal(record)}
            >
              <Edit3 className="w-4 h-4" />
              <span className="text-xs">Chi tiết</span>
            </Button>
          </Tooltip>

          <Popconfirm
            title={record.status === 'ACTIVE' ? "Xác nhận khóa tài khoản?" : "Xác nhận mở khóa tài khoản?"}
            description={
              record.status === 'ACTIVE' 
                ? `Tài khoản ${record.username} sẽ không thể đăng nhập và hiển thị lỗi MSG06.` 
                : `Cho phép tài khoản ${record.username} đăng nhập lại hệ thống.`
            }
            onConfirm={() => handleToggleStatus(record)}
            okText={record.status === 'ACTIVE' ? "Khóa tài khoản" : "Mở khóa"}
            cancelText="Hủy"
            okButtonProps={{ danger: record.status === 'ACTIVE', loading: statusTogglingId === record.id }}
          >
            <Tooltip title={record.status === 'ACTIVE' ? "Khóa tài khoản" : "Mở khóa tài khoản"}>
              <Button 
                type="text" 
                size="small"
                danger={record.status === 'ACTIVE'}
                className={record.status === 'ACTIVE' ? 'hover:bg-red-50 text-red-500' : 'hover:bg-emerald-50 text-emerald-600'}
                loading={statusTogglingId === record.id}
              >
                {record.status === 'ACTIVE' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </Button>
            </Tooltip>
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Tiêu đề trang & Nút hành động */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800">
              Nhóm 1: Accounts
            </span>
            <span className="text-xs text-slate-400 font-medium">Screen 26 & 27</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Quản lý Tài khoản Nhân viên Vận hành
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tra cứu, cấp mới, cập nhật thông tin và quản trị trạng thái đăng nhập của Điều phối viên (Dispatcher) & Tài xế (Driver).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            icon={<RefreshCw className="w-4 h-4" />} 
            onClick={fetchAccounts}
            loading={loading}
            className="rounded-xl flex items-center gap-1.5 h-11"
          >
            Làm mới
          </Button>
          <Button 
            type="primary" 
            icon={<Plus className="w-4 h-4" />} 
            onClick={handleOpenCreateModal}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-1.5 h-11 shadow-sm shadow-blue-500/20"
          >
            + Thêm tài khoản
          </Button>
        </div>
      </div>

      {/* Thông báo nghiệp vụ BR-28 */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-sm">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-950">Quy tắc nghiệp vụ BR-28: </span>
          <span>
            Manager chỉ được quản lý tài khoản cấp dưới (Điều phối viên và Tài xế). Manager không được quản lý tài khoản của Manager khác hay Admin, và không được cấu hình phân quyền hệ thống.
          </span>
        </div>
      </div>

      {/* Thẻ thống kê (Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng nhân sự</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-slate-800">{stats.total}</span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Điều phối viên</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-blue-700">{stats.dispatchers}</span>
            <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">Dispatcher</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Tài xế</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-700">{stats.drivers}</span>
            <span className="text-xs font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">Driver</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">Đang hoạt động</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-teal-700">{stats.active}</span>
            <CheckCircle className="w-5 h-5 text-teal-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Đã khóa (Locked)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-rose-700">{stats.locked}</span>
            <Lock className="w-5 h-5 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Screen 26: Toolbar tìm kiếm & bộ lọc */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Input
            placeholder="Tìm kiếm theo Tên, Username hoặc Email..."
            prefix={<Search className="w-4 h-4 text-slate-400 mr-1" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            className="rounded-xl h-10"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Bộ lọc Role */}
          <Select
            value={selectedRole}
            onChange={(val) => setSelectedRole(val)}
            style={{ width: 170 }}
            className="rounded-xl h-10"
            options={[
              { value: 'ALL', label: 'Tất cả vai trò' },
              { value: 'DISPATCHER', label: 'Điều phối viên' },
              { value: 'DRIVER', label: 'Tài xế' }
            ]}
          />

          {/* Bộ lọc Status */}
          <Select
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            style={{ width: 160 }}
            className="rounded-xl h-10"
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE', label: 'Đang hoạt động' },
              { value: 'LOCKED', label: 'Đã bị khóa' }
            ]}
          />

          <Button 
            type="default" 
            onClick={handleSearch}
            className="h-10 px-4 rounded-xl font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border-none"
          >
            Tìm kiếm
          </Button>
        </div>
      </div>

      {/* Screen 26: Bảng danh sách tài khoản */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} trên tổng số ${total} tài khoản`,
            className: "p-4"
          }}
          locale={{
            emptyText: (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto stroke-[1.5] mb-2 text-slate-300" />
                <p className="text-base font-medium">Không tìm thấy tài khoản nhân viên nào</p>
                <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc tìm kiếm hoặc nhấn nút &quot;+ Thêm tài khoản&quot;.</p>
              </div>
            )
          }}
        />
      </div>

      {/* Screen 27: Modal Chi tiết & Tạo mới tài khoản (Staff Account Details) */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              {isEditMode ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">
                {isEditMode ? 'Chi tiết & Cập nhật tài khoản' : 'Thêm mới tài khoản nhân viên'}
              </h2>
              <span className="text-xs text-slate-400 mt-0.5 block">Staff Account Details (Screen 27)</span>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsModalOpen(false)} className="rounded-xl">
            Đóng
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitting} 
            onClick={handleSubmitForm}
            className="bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold"
          >
            {isEditMode ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        ]}
        width={560}
        destroyOnHidden
        className="rounded-2xl overflow-hidden"
      >
        <Form
          form={form}
          layout="vertical"
          className="pt-4 space-y-1"
        >
          {/* Username */}
          <Form.Item
            name="username"
            label={<span className="font-semibold text-slate-700">Tên đăng nhập (Username)</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập Username (Bắt buộc, duy nhất)' },
              { min: 3, message: 'Username tối thiểu 3 ký tự' },
              { pattern: /^[a-zA-Z0-9_.-]+$/, message: 'Username chỉ được gồm chữ cái, số, dấu gạch dưới hoặc chấm' }
            ]}
            extra={isEditMode ? "Tên đăng nhập không thể thay đổi sau khi tạo." : "Tên đăng nhập là duy nhất và dùng để đăng nhập vào hệ thống."}
          >
            <Input 
              prefix={<User className="w-4 h-4 text-slate-400" />} 
              placeholder="VD: dispatcher_nam, driver_minh" 
              disabled={isEditMode}
              className="rounded-xl h-10"
            />
          </Form.Item>

          {/* Full Name */}
          <Form.Item
            name="full_name"
            label={<span className="font-semibold text-slate-700">Họ và tên (Full name)</span>}
            rules={[{ required: true, message: 'Vui lòng nhập Họ và tên nhân viên' }]}
          >
            <Input 
              placeholder="VD: Nguyễn Văn Nam" 
              className="rounded-xl h-10"
            />
          </Form.Item>

          {/* Email */}
          <Form.Item
            name="email"
            label={<span className="font-semibold text-slate-700">Email (Duy nhất & nhận link đặt lại mật khẩu)</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập Email' },
              { type: 'email', message: 'Email không đúng định dạng' }
            ]}
            extra="Email bắt buộc, duy nhất — dùng để nhận liên kết đặt lại mật khẩu một lần khi quên mật khẩu."
          >
            <Input 
              prefix={<Mail className="w-4 h-4 text-slate-400" />} 
              placeholder="VD: nam.nguyen@nexlog.vn" 
              className="rounded-xl h-10"
            />
          </Form.Item>

          {/* Phone */}
          <Form.Item
            name="phone"
            label={<span className="font-semibold text-slate-700">Số điện thoại (Phone)</span>}
            rules={[
              { pattern: /^[0-9+() -]{9,15}$/, message: 'Số điện thoại không hợp lệ' }
            ]}
          >
            <Input 
              prefix={<Phone className="w-4 h-4 text-slate-400" />} 
              placeholder="VD: 0912345678" 
              className="rounded-xl h-10"
            />
          </Form.Item>

          {/* Role (Chỉ cho chọn Dispatcher hoặc Driver - Tuân thủ BR-28) */}
          <Form.Item
            name="role"
            label={<span className="font-semibold text-slate-700">Vai trò (Role - Chỉ Dispatcher hoặc Driver)</span>}
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
            extra="Theo quy tắc BR-28, Manager chỉ có quyền cấp phát vai trò Điều phối viên hoặc Tài xế."
          >
            <Select 
              className="rounded-xl h-10"
              options={[
                { value: 'DISPATCHER', label: 'Điều phối viên (Dispatcher)' },
                { value: 'DRIVER', label: 'Tài xế (Driver)' }
              ]}
            />
          </Form.Item>

          {/* Password (Tùy chọn) */}
          <Form.Item
            name="password"
            label={
              <span className="font-semibold text-slate-700">
                {isEditMode ? 'Đặt lại mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu ban đầu (Tùy chọn)'}
              </span>
            }
            extra={isEditMode ? null : "Nếu để trống, mật khẩu mặc định khởi tạo sẽ là: Nexlog@2026"}
          >
            <Input.Password 
              placeholder={isEditMode ? "Nhập mật khẩu mới nếu muốn đổi" : "Mặc định: Nexlog@2026"} 
              className="rounded-xl h-10"
            />
          </Form.Item>

          {/* Status (Active / Locked - Báo lỗi MSG06 khi đăng nhập nếu Locked) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 text-sm block">Trạng thái tài khoản (Status)</span>
                <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.status !== cur?.status}>
                  {({ getFieldValue }) => (
                    <span className="text-xs text-slate-500">
                      {getFieldValue('status') !== false 
                        ? 'Tài khoản đang hoạt động bình thường (ACTIVE).' 
                        : 'Tài khoản bị KHÓA (LOCKED) — người dùng sẽ không thể đăng nhập và hiển thị lỗi MSG06.'}
                    </span>
                  )}
                </Form.Item>
              </div>
              <Form.Item name="status" valuePropName="checked" className="mb-0">
                <Switch 
                  checkedChildren="ACTIVE" 
                  unCheckedChildren="LOCKED"
                  className="bg-slate-300"
                />
              </Form.Item>
            </div>
          </div>
        </Form>
      </Modal>

    </div>
  );
}
