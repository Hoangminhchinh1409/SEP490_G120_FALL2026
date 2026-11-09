"use client";
import React, { useState, useEffect } from 'react';
import { Table, Tag, Checkbox, Button, message, Card, Tooltip } from 'antd';
import { Shield, Save, RotateCcw, CheckCircle, Info, Eye, Lock } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

const PERMISSION_METADATA = {
  USER_ACCOUNT_MANAGE: { module: 'Tài khoản (Users)', name: 'Quản lý Tài khoản người dùng', defaultOwner: 1 },
  ROLES_PERMISSIONS_MANAGE: { module: 'Hệ thống (System)', name: 'Cấu hình Phân quyền & Vai trò', defaultOwner: 1 },
  ACTIVITY_LOG_VIEW: { module: 'Hệ thống (System)', name: 'Xem Nhật ký Hoạt động (Activity Logs)', defaultOwner: 1 },
  SYSTEM_SETTINGS_MANAGE: { module: 'Hệ thống (System)', name: 'Cấu hình Tham số Hệ thống (Settings)', defaultOwner: 1 },
  ORDER_MANAGE: { module: 'Đơn hàng (Orders)', name: 'Tạo, sửa và tiếp nhận Đơn hàng', defaultOwner: 3 },
  ORDER_ASSIGN: { module: 'Đơn hàng (Orders)', name: 'Điều phối & Lập Kế hoạch Chuyến xe', defaultOwner: 3 },
  TRIP_MONITOR: { module: 'Vận hành (Trips)', name: 'Giám sát Hành trình Chuyến xe (GPS/Trip)', defaultOwner: 3 },
  CONTRACT_MANAGE: { module: 'Hợp đồng (Contracts)', name: 'Quản lý Hợp đồng Vận chuyển Khách/Vendor', defaultOwner: 3 },
  FLEET_MANAGE: { module: 'Đội xe (Fleet)', name: 'Quản lý Thông tin Xe & Hồ sơ Tài xế', defaultOwner: 2 },
  DRIVER_SHIFT_MANAGE: { module: 'Đội xe (Fleet)', name: 'Quản lý & Phê duyệt Ca trực Tài xế (UC-20)', defaultOwner: 2 },
  VENDOR_MANAGE: { module: 'Đối tác (Vendors)', name: 'Quản lý & Phê duyệt Nhà xe Đối tác (API-07)', defaultOwner: 2 },
  INCIDENT_MANAGE: { module: 'Sự cố & Khiếu nại', name: 'Xử lý Sự cố & Duyệt Bồi thường (UC-47)', defaultOwner: 2 },
  NEWS_MANAGE: { module: 'Truyền thông (News)', name: 'Viết & Xuất bản Tin tức Website', defaultOwner: 2 },
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
  const [initialRoleMap, setInitialRoleMap] = useState({});
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
      const initialMapping = {};
      rList.forEach(r => {
        mapping[r.id] = new Set();
        initialMapping[r.id] = new Set();
      });

      rpList.forEach(rp => {
        if (mapping[rp.role_id]) {
          mapping[rp.role_id].add(rp.permission_id);
          initialMapping[rp.role_id].add(rp.permission_id);
        }
      });

      // Tự động đảm bảo các quyền chủ quản mặc định luôn có mặt trong Set của role đó
      pList.forEach(p => {
        const meta = PERMISSION_METADATA[p.key];
        if (meta && meta.defaultOwner && mapping[meta.defaultOwner]) {
          mapping[meta.defaultOwner].add(p.id);
          initialMapping[meta.defaultOwner].add(p.id);
        }
      });

      setRoleMap(mapping);
      setInitialRoleMap(initialMapping);
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
    const p = permissions.find(item => item.id === permissionId);
    const meta = p ? PERMISSION_METADATA[p.key] : null;

    // Không cho phép khóa quyền mặc định của vai trò chủ quản hoặc Admin
    if (Number(roleId) === 1 || (meta && Number(roleId) === meta.defaultOwner)) {
      message.warning('Đây là quyền chủ quản mặc định của vai trò, không thể khóa.');
      return;
    }

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
      // Chỉ tìm các role thực sự có thay đổi và bỏ qua role 1 (Administrator)
      const changedRoles = roles.filter(role => {
        if (Number(role.id) === 1) return false;
        const currentSet = roleMap[role.id] || new Set();
        const initialSet = initialRoleMap[role.id] || new Set();
        if (currentSet.size !== initialSet.size) return true;
        for (const id of currentSet) {
          if (!initialSet.has(id)) return true;
        }
        return false;
      });

      if (changedRoles.length === 0) {
        message.info('Không có thay đổi nào cần lưu');
        setHasChanges(false);
        return;
      }

      for (const role of changedRoles) {
        const permIds = Array.from(roleMap[role.id] || []);
        await adminApi.updateRolePermissions(role.id, permIds);
      }

      message.success(`Đã lưu thay đổi phân quyền cho ${changedRoles.length} vai trò thành công!`);

      const updatedInitial = {};
      roles.forEach(r => {
        updatedInitial[r.id] = new Set(roleMap[r.id] || []);
      });
      setInitialRoleMap(updatedInitial);
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
      width: 170,
      render: (text) => <span className="font-semibold text-slate-700">{text}</span>
    },
    {
      title: 'Quyền hạn (Chức năng hệ thống)',
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
      width: 190,
      render: (_, record) => {
        const meta = PERMISSION_METADATA[record.key] || {};
        const isDefaultOwner = Number(r.id) === 1 || Number(r.id) === meta.defaultOwner;

        // 1. Chức năng mặc định của Role (hoặc Administrator) -> Bất biến: Toàn quyền (Admin không thể khóa)
        if (isDefaultOwner) {
          return (
            <div className="flex flex-col items-center justify-center gap-0.5 py-1">
              <Tag
                color="green"
                className="font-bold text-[11px] px-2.5 py-0.5 rounded-full border-emerald-500/40 text-emerald-700 bg-emerald-50 m-0 flex items-center gap-1 shadow-xs"
              >
                <CheckCircle size={11} className="text-emerald-600" />
                <span>Toàn quyền (Mặc định)</span>
              </Tag>
              <span className="text-[9px] text-slate-400 font-medium">Cố định - Không thể khóa</span>
            </div>
          );
        }

        // 2. Chức năng của Role khác (Truy cập chéo) -> Chỉ xem (Read-only) nếu được Admin cấp
        const isChecked = roleMap[r.id]?.has(record.id) || false;

        return (
          <Tooltip
            title={
              isChecked
                ? `Được cấp quyền xem chéo: ${r.name} có thể vào xem dữ liệu ở chế độ CHỈ XEM (Read-only), không được chỉnh sửa.`
                : `Bị chặn: ${r.name} không được phép truy cập chức năng này.`
            }
          >
            <div className="flex flex-col items-center justify-center gap-1 cursor-pointer py-1">
              <Checkbox
                checked={isChecked}
                onChange={() => handleToggle(r.id, record.id)}
              />
              {isChecked ? (
                <Tag
                  color="blue"
                  className="font-semibold text-[10px] px-2 py-0.5 rounded text-blue-700 bg-blue-50 border-blue-200 m-0 flex items-center gap-1 shadow-xs"
                >
                  <Eye size={10} className="text-blue-600" />
                  <span>Chỉ xem (Read-only)</span>
                </Tag>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium">
                  Bị chặn
                </span>
              )}
            </div>
          </Tooltip>
        );
      }
    }))
  ];

  const dataSource = permissions.map(p => {
    const meta = PERMISSION_METADATA[p.key] || { module: 'Chức năng khác', name: p.key };
    return {
      key: p.key,
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
            Thiết lập quyền truy cập chức năng theo nguyên tắc: Quyền chủ quản mặc định (Full) & Quyền truy cập chéo (Chỉ xem - Read-Only).
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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
        {/* Banner Hướng Dẫn Nguyên Tắc Phân Quyền Mới */}
        <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-xl text-xs text-slate-700 leading-relaxed space-y-1">
          <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
            <Info size={16} className="text-blue-600" />
            <span>Quy tắc Phân quyền Vai trò Doanh nghiệp (Enterprise RBAC):</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-1 border-t border-blue-200/50">
            <div className="flex items-start gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
              <span>
                <b>Toàn quyền (Mặc định):</b> Vai trò chủ quản luôn sở hữu toàn bộ quyền hạn trên các trang thuộc cổng làm việc chính của mình. Administrator không thể khóa các quyền này.
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0"></span>
              <span>
                <b>Quyền chéo (Chỉ xem - Read-only):</b> Khi Admin cho phép một vai trò truy cập vào trang của vai trò khác, vai trò đó chỉ được phép xem dữ liệu. Mọi thao tác chỉnh sửa/duyệt/tạo mới sẽ tự động bị khóa để chống xung đột nghiệp vụ.
              </span>
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          loading={loading}
          bordered
          rowClassName="hover:bg-slate-50/60 transition-colors"
        />

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống phân quyền thời gian thực: Thay đổi được áp dụng ngay cho các phiên làm việc tiếp theo của người dùng.</span>
          <span className="font-semibold text-slate-700">Phiên bản: RBAC v2.0</span>
        </div>
      </div>
    </div>
  );
}
