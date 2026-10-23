"use client";
import React, { useState, useEffect } from 'react';
import { Table, Input, DatePicker, Select, Tag, Button, Tooltip, message } from 'antd';
import { Search, RotateCcw, FileText, Shield, User, Globe } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

const { RangePicker } = DatePicker;

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 15,
    total: 0
  });

  const [filters, setFilters] = useState({
    action: 'ALL',
    targetType: 'ALL',
    startDate: null,
    endDate: null,
    keyword: ''
  });

  useEffect(() => {
    let ignore = false;
    const loadLogs = async () => {
      try {
        const res = await adminApi.getActivityLogs({
          page: pagination.current,
          limit: pagination.pageSize,
          action: filters.action !== 'ALL' ? filters.action : null,
          targetType: filters.targetType !== 'ALL' ? filters.targetType : null,
          startDate: filters.startDate,
          endDate: filters.endDate,
          keyword: filters.keyword
        });

        if (!ignore) {
          setLogs(res.logs || []);
          setPagination(prev => ({
            ...prev,
            current: res.page || prev.current,
            pageSize: res.limit || prev.pageSize,
            total: res.total || 0
          }));
        }
      } catch (error) {
        if (!ignore) {
          console.error('Lỗi khi tải nhật ký hoạt động:', error);
          message.error(error.message || 'Không thể tải nhật ký hoạt động');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadLogs();
    return () => {
      ignore = true;
    };
  }, [filters, pagination.current, pagination.pageSize]);

  const handleTableChange = (newPagination) => {
    setLoading(true);
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const handleDateChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      setFilters(prev => ({
        ...prev,
        startDate: dates[0].startOf('day').toISOString(),
        endDate: dates[1].endOf('day').toISOString()
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        startDate: null,
        endDate: null
      }));
    }
  };

  const handleActionChange = (value) => {
    setFilters(prev => ({ ...prev, action: value }));
  };

  const handleTargetTypeChange = (value) => {
    setFilters(prev => ({ ...prev, targetType: value }));
  };

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, keyword: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      action: 'ALL',
      targetType: 'ALL',
      startDate: null,
      endDate: null,
      keyword: ''
    });
  };

  // Helper render màu cho từng loại hành động
  const renderActionTag = (action) => {
    switch (action) {
      case 'CREATE_USER':
      case 'CREATE_ORDER':
      case 'ACTIVATE_USER':
        return <Tag color="green" className="font-semibold">{action}</Tag>;
      case 'LOCK_USER':
      case 'DEACTIVATE_USER':
      case 'CANCEL_ORDER':
      case 'DELETE_USER':
        return <Tag color="red" className="font-semibold">{action}</Tag>;
      case 'UPDATE_USER':
      case 'UPDATE_SETTING':
      case 'REASSIGN_ORDER':
        return <Tag color="blue" className="font-semibold">{action}</Tag>;
      case 'INCIDENT_REPORT':
        return <Tag color="orange" className="font-semibold">{action}</Tag>;
      case 'SYSTEM_INIT':
        return <Tag color="purple" className="font-semibold">{action}</Tag>;
      default:
        return <Tag color="default">{action}</Tag>;
    }
  };

  // Helper render format thời gian Việt Nam
  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const d = new Date(timeStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'created_time',
      key: 'created_time',
      width: 175,
      render: (time) => (
        <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
          {formatTime(time)}
        </span>
      )
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'actor',
      key: 'actor',
      width: 180,
      render: (_, record) => {
        if (record.actor) {
          const roleName = record.actor.role_id === 1 ? 'Admin' : record.actor.role_id === 2 ? 'Manager' : record.actor.role_id === 3 ? 'Dispatcher' : 'Driver';
          return (
            <div>
              <div className="font-medium text-slate-800 text-sm flex items-center gap-1.5">
                <User size={13} className="text-slate-400" />
                {record.actor.full_name || record.actor.username}
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                <span>@{record.actor.username}</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-600 font-semibold">{roleName}</span>
              </div>
            </div>
          );
        }
        return (
          <span className="text-xs text-slate-500 italic flex items-center gap-1">
            <Shield size={12} className="text-slate-400" />
            {record.actor_type || 'Hệ thống'}
          </span>
        );
      }
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 160,
      render: (action) => renderActionTag(action)
    },
    {
      title: 'Đối tượng tác động',
      key: 'target',
      width: 160,
      render: (_, record) => (
        <div className="text-xs">
          <Tag color="geekblue" className="mr-1">{record.target_type}</Tag>
          <span className="font-mono text-slate-600 font-semibold">#{record.target_id}</span>
        </div>
      )
    },
    {
      title: 'Lý do & Chi tiết thay đổi',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason, record) => {
        let parsedChanges = null;
        if (record.changes) {
          try {
            parsedChanges = typeof record.changes === 'string' ? JSON.parse(record.changes) : record.changes;
          } catch {
            parsedChanges = record.changes;
          }
        }

        return (
          <div className="space-y-1">
            <div className="text-sm text-slate-800 font-medium">
              {reason || 'Thao tác hợp lệ từ giao diện'}
            </div>
            {parsedChanges && typeof parsedChanges === 'object' && (
              <Tooltip title={JSON.stringify(parsedChanges, null, 2)}>
                <div className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded inline-block max-w-md truncate border border-slate-100">
                  Thay đổi: {Object.keys(parsedChanges).map(k => `${k}: ${parsedChanges[k]}`).join(', ')}
                </div>
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      title: 'Địa chỉ IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (ip) => (
        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
          <Globe size={12} className="text-slate-300" />
          {ip || '127.0.0.1'}
        </span>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText size={22} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Nhật ký Hoạt động (Activity Logs)</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1.5">
            Ghi nhận vết thao tác toàn hệ thống theo thời gian thực (Dữ liệu chỉ thêm mới <b>Append-only</b> theo chuẩn bảo mật BR-28/BR-47).
          </p>
        </div>
        <Button
          icon={<RotateCcw size={15} />}
          onClick={() => fetchLogs(pagination.current, pagination.pageSize)}
          loading={loading}
          className="flex items-center gap-1.5 font-medium rounded-xl h-10 px-4 bg-slate-50 hover:bg-slate-100 border-slate-200"
        >
          Làm mới
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
        <RangePicker
          className="h-10 rounded-xl"
          placeholder={['Từ ngày', 'Đến ngày']}
          onChange={handleDateChange}
        />

        <Select
          defaultValue="ALL"
          value={filters.action}
          style={{ width: 190 }}
          className="h-10"
          onChange={handleActionChange}
          options={[
            { value: 'ALL', label: 'Tất cả hành động' },
            { value: 'CREATE_USER', label: 'Tạo tài khoản' },
            { value: 'UPDATE_USER', label: 'Sửa tài khoản' },
            { value: 'LOCK_USER', label: 'Khóa tài khoản' },
            { value: 'ACTIVATE_USER', label: 'Mở khóa tài khoản' },
            { value: 'CREATE_ORDER', label: 'Tạo đơn hàng' },
            { value: 'REASSIGN_ORDER', label: 'Chuyển giao đơn' },
            { value: 'INCIDENT_REPORT', label: 'Báo sự cố' },
            { value: 'UPDATE_SETTING', label: 'Cập nhật cấu hình' },
            { value: 'SYSTEM_INIT', label: 'Khởi tạo hệ thống' }
          ]}
        />

        <Select
          defaultValue="ALL"
          value={filters.targetType}
          style={{ width: 170 }}
          className="h-10"
          onChange={handleTargetTypeChange}
          options={[
            { value: 'ALL', label: 'Mọi đối tượng' },
            { value: 'USER', label: 'Người dùng (USER)' },
            { value: 'ORDER', label: 'Đơn hàng (ORDER)' },
            { value: 'TRIP', label: 'Chuyến xe (TRIP)' },
            { value: 'SYSTEM', label: 'Hệ thống (SYSTEM)' }
          ]}
        />

        <div className="flex-1 min-w-[220px]">
          <Input.Search
            placeholder="Tìm theo người thực hiện, lý do, hành động..."
            allowClear
            enterButton={<Search size={16} />}
            onSearch={handleSearch}
            className="h-10 rounded-xl"
          />
        </div>

        {(filters.action !== 'ALL' || filters.targetType !== 'ALL' || filters.startDate || filters.keyword) && (
          <Button type="link" onClick={handleResetFilters} className="text-slate-500 hover:text-slate-800 text-xs font-semibold">
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '20', '50'],
            showTotal: (total, range) => (
              <span className="text-xs text-slate-500">
                Hiển thị <b>{range[0]}-{range[1]}</b> trên tổng <b>{total}</b> bản ghi
              </span>
            )
          }}
          onChange={handleTableChange}
          size="middle"
          locale={{
            emptyText: (
              <div className="py-12 text-center text-slate-400">
                <FileText size={40} className="mx-auto mb-2 opacity-40" />
                <p>Không có bản ghi nhật ký nào phù hợp với bộ lọc.</p>
              </div>
            )
          }}
        />
      </div>
    </div>
  );
}
