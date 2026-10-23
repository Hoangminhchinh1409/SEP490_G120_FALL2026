"use client";
import React, { useState, useEffect } from 'react';
import { Table, Tag, Checkbox, Button, message, Card, Tooltip, Popconfirm } from 'antd';
import { Shield, Save, RotateCcw, CheckCircle, Info } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

const PERMISSION_METADATA = {
  USER_ACCOUNT_MANAGE: { module: 'Tài khoản (Users)', name: 'Quản lý Tài khoản người dùng' },
  ROLES_PERMISSIONS_MANAGE: { module: 'Hệ thống (System)', name: 'Cấu hình Phân quyền & Vai trò' },
  ACTIVITY_LOG_VIEW: { module: 'Hệ thống (System)', name: 'Xem Nhật ký Hoạt động (Activity Logs)' },
  SYSTEM_SETTINGS_MANAGE: { module: 'Hệ thống (System)', name: 'Cấu hình Tham số Hệ thống (Settings)' },
  ORDER_MANAGE: { module: 'Đơn hàng (Orders)', name: 'Tạo, sửa và tiếp nhận Đơn hàng' },
  ORDER_ASSIGN: { module: 'Đơn hàng (Orders)', name: 'Điều phối & Lập Kế hoạch Chuyến xe' },
  TRIP_MONITOR: { module: 'Vận hành (Trips)', name: 'Giám sát Hành trình Chuyến xe (GPS/Trip)' },
  FLEET_MANAGE: { module: 'Đội xe (Fleet)', name: 'Quản lý Thông tin Xe & Hồ sơ Tài xế' },
  DRIVER_SHIFT_MANAGE: { module: 'Đội xe (Fleet)', name: 'Quản lý & Phê duyệt Ca trực Tài xế (UC-20)' },
  VENDOR_MANAGE: { module: 'Đối tác (Vendors)', name: 'Quản lý & Phê duyệt Nhà xe Đối tác (API-07)' },
  CONTRACT_MANAGE: { module: 'Hợp đồng (Contracts)', name: 'Quản lý Hợp đồng Vận chuyển Khách/Vendor' },
  INCIDENT_MANAGE: { module: 'Sự cố & Khiếu nại', name: 'Xử lý Sự cố & Duyệt Bồi thường (UC-47)' },
  NEWS_MANAGE: { module: 'Truyền thông (News)', name: 'Viết & Xuất bản Tin tức Website' },
};

const ROLE_COLORS = {
  1: { tag: 'red', name: 'ADMINISTRATOR' },
  2: { tag: 'orange', name: 'MANAGER' },
  3: { tag: 'blue', name: 'DISPATCHER' },
  4: { tag: 'green', name: 'DRIVER' }
};

export default function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  // roleMap: { [roleId]: Set of permissionIds }
  const [roleMap, setRoleMap] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPermissionsMatrix();
      const rList = data.roles || [];
      const pList = data.permissions || [];
      const rpList = data.rolePermissions || [];

      setRoles(rList);
      setPermissions(pList);

      const mapping = {};
      rList.forEach(r => {
        mapping[r.id] = new Set();
      });

      rpList.forEach(rp => {
        if (mapping[rp.role_id]) {
          mapping[rp.role_id].add(rp.permission_id);
        }
      });

      setRoleMap(mapping);
      setHasChanges(false);
    } catch (error) {
      console.error('Lỗi khi tải ma trận phân quyền:', error);
      message.error(error.message || 'Không thể tải ma trận phân quyền');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const handleToggle = (roleId, permissionId) => {
    setRoleMap(prev => {
      const currentSet = new Set(prev[roleId] || []);
      if (currentSet.has(permissionId)) {
        currentSet.delete(permissionId);
      } else {
        currentSet.add(permissionId);
      }
      return {
        ...prev,
        [roleId]: currentSet
      };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Cập nhật từng role đã thay đổi
      for (const role of roles) {
        const permIds = Array.from(roleMap[role.id] || []);
        await adminApi.updateRolePermissions(role.id, permIds);
      }
      message.success('Đã lưu toàn bộ thay đổi ma trận phân quyền thành công!');
      setHasChanges(false);
    } catch (error) {
      console.error('Lỗi khi lưu phân quyền:', error);
      message.error(error.message || 'Cập nhật phân quyền thất bại');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Nhóm chức năng',
      dataIndex: 'module',
      key: 'module',
      width: 180,
      render: (text) => <span className="font-semibold text-slate-700">{text}</span>
    },
    {
      title: 'Quyền hạn (Permission Description)',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div className="font-medium text-slate-900">{text}</div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">{record.key}</div>
        </div>
      )
    },
    ...roles.map(r => ({
      title: (
        <div className="text-center py-1">
          <Tag color={ROLE_COLORS[r.id]?.tag || 'default'} className="font-bold uppercase tracking-wider text-xs px-2.5 py-0.5 rounded-full">
            {r.name}
          </Tag>
        </div>
      ),
      dataIndex: `role_${r.id}`,
      key: `role_${r.id}`,
      align: 'center',
      width: 140,
      render: (_, record) => {
        const isChecked = roleMap[r.id]?.has(record.id) || false;
        // Administrator luôn giữ toàn quyền hệ thống để đảm bảo an toàn vận hành
        const isAdmin = Number(r.id) === 1;

        return (
          <Tooltip title={isAdmin ? 'Administrator mặc định có đầy đủ quyền hạn' : `Bật/Tắt quyền cho ${r.name}`}>
            <Checkbox
              checked={isChecked}
              disabled={isAdmin}
              onChange={() => handleToggle(r.id, record.id)}
            />
          </Tooltip>
        );
      }
    }))
  ];

  const dataSource = permissions.map(p => {
    const meta = PERMISSION_METADATA[p.key] || { module: 'Chức năng khác', name: p.key };
    return {
      key: p.id,
      id: p.id,
      module: meta.module,
      name: meta.name
    };
  });

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Shield size={22} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Ma Trận Phân Quyền Vai Trò (Roles & Permissions)</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1.5">
            Thiết lập quyền truy cập cho từng chức năng theo Bảng ma trận phân quyền chuẩn của SRS (UC-34).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            icon={<RotateCcw size={16} />}
            onClick={fetchMatrix}
            disabled={loading || saving}
            className="h-10 rounded-xl font-medium"
          >
            Tải lại
          </Button>

          <Button
            type="primary"
            icon={<Save size={16} />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
            className={`h-10 px-5 rounded-xl font-semibold shadow-sm ${
              hasChanges ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : ''
            }`}
          >
            Lưu thay đổi phân quyền
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6">
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          loading={loading}
          bordered
          rowClassName="hover:bg-slate-50/60 transition-colors"
        />

        <div className="mt-4 p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-blue-700">
          <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <span>
            <b>Lưu ý kỹ thuật:</b> Thay đổi ma trận phân quyền sẽ có hiệu lực ngay lập tức khi người dùng thuộc vai trò tương ứng thực hiện phiên làm việc tiếp theo. Vai trò <b>ADMINISTRATOR</b> được cố định toàn quyền kiểm soát hệ thống.
          </span>
        </div>
      </div>
    </div>
  );
}
