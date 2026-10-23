"use client";
import React, { useState, useEffect } from 'react';
import { Tag, Button, Skeleton, Progress, message, Tooltip } from 'antd';
import {
  Users,
  Activity,
  CheckCircle2,
  Lock,
  Shield,
  ArrowRight,
  UserPlus,
  RotateCcw,
  Clock,
  Server,
  Zap,
  TrendingUp,
  FileText,
  Settings,
  ShieldCheck,
  Radio
} from 'lucide-react';
import Link from 'next/link';
import { adminApi } from '../../api/adminApi';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, logsData] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getActivityLogs({ page: 1, limit: 6 })
      ]);

      setStats(statsData || null);
      setRecentLogs(logsData?.logs || []);
    } catch (error) {
      console.error('Lỗi tải dữ liệu Dashboard:', error);
      message.error(error.message || 'Không thể tải thống kê Dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const initData = async () => {
      try {
        const [statsData, logsData] = await Promise.all([
          adminApi.getDashboardStats(),
          adminApi.getActivityLogs({ page: 1, limit: 6 })
        ]);
        if (!ignore) {
          setStats(statsData || null);
          setRecentLogs(logsData?.logs || []);
        }
      } catch (error) {
        if (!ignore) {
          console.error('Lỗi tải dữ liệu Dashboard:', error);
          message.error(error.message || 'Không thể tải thống kê Dashboard');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    initData();
    return () => {
      ignore = true;
    };
  }, []);

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const d = new Date(timeStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalUsers = stats?.totalUsers || 0;
  const activeUsers = stats?.activeUsers || 0;
  const lockedUsers = stats?.lockedUsers || 0;
  const recentLogs24h = stats?.recentLogs24h || 0;

  const roleStats = [
    {
      name: 'Administrator',
      roleKey: 'ADMINISTRATOR',
      count: stats?.usersByRole?.ADMINISTRATOR || 0,
      color: 'bg-red-500',
      badgeColor: 'red',
      desc: 'Quản trị hệ thống toàn quyền'
    },
    {
      name: 'Manager',
      roleKey: 'MANAGER',
      count: stats?.usersByRole?.MANAGER || 0,
      color: 'bg-amber-500',
      badgeColor: 'orange',
      desc: 'Quản lý vận hành & Báo cáo'
    },
    {
      name: 'Dispatcher',
      roleKey: 'DISPATCHER',
      count: stats?.usersByRole?.DISPATCHER || 0,
      color: 'bg-blue-500',
      badgeColor: 'blue',
      desc: 'Điều phối viên ca & chuyến'
    },
    {
      name: 'Driver',
      roleKey: 'DRIVER',
      count: stats?.usersByRole?.DRIVER || 0,
      color: 'bg-emerald-500',
      badgeColor: 'green',
      desc: 'Tài xế thực hiện giao nhận'
    }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl shadow-md text-white border border-slate-700/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Hệ thống Vận hành Trực tuyến
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Tổng quan Hệ thống
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Bảng điều khiển trung tâm dành cho Quản trị viên: theo dõi lưu lượng hoạt động, tình trạng phân bổ người dùng và nhật ký truy vết bảo mật thời gian thực.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button
            icon={<RotateCcw size={15} />}
            onClick={fetchDashboardData}
            loading={loading}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 font-medium rounded-xl h-10 px-4 bg-slate-800/80 hover:bg-slate-700 text-white border-slate-600"
          >
            Làm mới
          </Button>
          <Link href="/admin/users" className="flex-1 md:flex-initial">
            <Button
              type="primary"
              icon={<UserPlus size={16} />}
              className="w-full flex items-center justify-center gap-1.5 font-medium rounded-xl h-10 px-4 bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 border-0"
            >
              Thêm tài khoản
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              Toàn hệ thống
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Tổng số tài khoản</h3>
          <div className="text-3xl font-extrabold text-slate-800 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : totalUsers}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <Users size={12} /> Bao gồm 4 vai trò tác nhân
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Sẵn sàng truy cập
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Tài khoản Hoạt động</h3>
          <div className="text-3xl font-extrabold text-emerald-600 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : activeUsers}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Tỷ lệ hoạt động:</span>
            <span className="font-semibold text-emerald-600">
              {totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Locked Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-rose-50 text-rose-500 p-3 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
              Bảo mật / Khóa
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Tài khoản Bị khóa</h3>
          <div className="text-3xl font-extrabold text-rose-500 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : lockedUsers}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <Shield size={12} /> Chặn truy cập trái phép
          </div>
        </div>

        {/* Activity Logs in 24h */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-purple-50 text-purple-600 p-3 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              24 giờ qua
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Lưu lượng Thao tác</h3>
          <div className="text-3xl font-extrabold text-purple-600 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : recentLogs24h}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <Radio size={12} className="text-purple-500" /> Ghi vết Append-only
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Roles Distribution & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Shield size={18} className="text-blue-500" /> Phân bổ theo Vai trò
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Cơ cấu tài khoản phân quyền trên hệ thống</p>
            </div>
            <Link href="/admin/users" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              Chi tiết <ArrowRight size={13} />
            </Link>
          </div>

          <div className="space-y-4">
            {roleStats.map((role) => {
              const percent = totalUsers > 0 ? Math.round((role.count / totalUsers) * 100) : 0;
              return (
                <div key={role.roleKey} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${role.color}`}></div>
                      <span className="text-sm font-bold text-slate-800">{role.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">({percent}%)</span>
                      <Tag color={role.badgeColor} className="font-semibold text-xs m-0">
                        {role.count} người
                      </Tag>
                    </div>
                  </div>
                  <Progress
                    percent={percent}
                    showInfo={false}
                    strokeColor={
                      role.roleKey === 'ADMINISTRATOR' ? '#ef4444' :
                      role.roleKey === 'MANAGER' ? '#f59e0b' :
                      role.roleKey === 'DISPATCHER' ? '#3b82f6' : '#10b981'
                    }
                    size={['100%', 6]}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">{role.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Operations & Health Indicators */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Server size={18} className="text-indigo-500" /> Tình trạng & Lưu lượng Hệ thống
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Giám sát sức khỏe hạ tầng, kết nối dữ liệu và bảo mật</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Hoạt động bình thường
            </span>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Zap size={18} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Cơ sở Dữ liệu</span>
              </div>
              <div className="text-lg font-bold text-slate-800">Supabase PG</div>
              <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 size={13} /> Kết nối sẵn sàng
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <ShieldCheck size={18} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Chuẩn Bảo mật</span>
              </div>
              <div className="text-lg font-bold text-slate-800">Bcrypt + JWT</div>
              <div className="text-xs text-blue-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 size={13} /> HttpOnly Cookies
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Clock size={18} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Truy vết Audit</span>
              </div>
              <div className="text-lg font-bold text-slate-800">Append-Only</div>
              <div className="text-xs text-purple-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 size={13} /> Bất biến & Tự động
              </div>
            </div>
          </div>

          {/* Fast Navigation Shortcuts */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Truy cập Nhanh Danh mục Quản trị</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/admin/users"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">Quản lý Tài khoản</div>
                    <div className="text-[11px] text-slate-400">Thêm, sửa, khóa tài khoản</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
              </Link>

              <Link
                href="/admin/roles"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Ma trận Phân quyền</div>
                    <div className="text-[11px] text-slate-400">Xem ma trận quyền 4 vai trò</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </Link>

              <Link
                href="/admin/settings"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Settings size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-slate-900">Cấu hình Hệ thống</div>
                    <div className="text-[11px] text-slate-400">Thiết lập tham số vận hành</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Recent Activity Logs */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock size={18} className="text-purple-600" /> Nhật ký Thao tác Gần đây (Recent Activity Logs)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Toàn bộ các tác vụ của người dùng được tự động ghi nhận vết (Audit Trail) để đảm bảo tính minh bạch và an toàn.
            </p>
          </div>
          <Link href="/admin/logs">
            <Button
              type="default"
              icon={<FileText size={14} />}
              className="text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:border-blue-500 hover:text-blue-600"
            >
              Xem toàn bộ nhật ký <ArrowRight size={13} />
            </Button>
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-6 space-y-3">
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Chưa có nhật ký hoạt động nào được ghi nhận gần đây.
            </div>
          ) : (
            recentLogs.map((log) => {
              const isCreate = log.action?.includes('CREATE');
              const isLock = log.action?.includes('LOCK');
              const isUnlock = log.action?.includes('UNLOCK');
              const isUpdate = log.action?.includes('UPDATE');
              const isSystem = log.action?.includes('SYSTEM');

              const tagColor = isCreate ? 'green' : isLock ? 'red' : isUnlock ? 'cyan' : isUpdate ? 'blue' : isSystem ? 'purple' : 'default';

              return (
                <div key={log.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag color={tagColor} className="font-semibold text-xs m-0">
                        {log.action}
                      </Tag>
                      <span className="text-xs font-bold text-slate-800">
                        {log.actor?.full_name || log.actor?.username || log.actor_type || 'Hệ thống'}
                      </span>
                      {log.actor?.roles?.name && (
                        <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {log.actor.roles.name}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">
                        #{log.target_type}:{log.target_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {log.reason || 'Thao tác hợp lệ được ghi nhận từ hệ thống'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right self-end md:self-auto">
                    {log.ip_address && (
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        IP: {log.ip_address}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      {formatTime(log.created_time)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
