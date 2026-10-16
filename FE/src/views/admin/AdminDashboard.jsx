"use client";
import React, { useState, useEffect } from 'react';
import { Tag, Button, Skeleton, message } from 'antd';
import { Users, Activity, CheckCircle2, Lock, Shield, ArrowRight, UserPlus, RotateCcw, Clock } from 'lucide-react';
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
        adminApi.getActivityLogs({ page: 1, limit: 5 })
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
          adminApi.getActivityLogs({ page: 1, limit: 5 })
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
      month: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tổng quan Hệ thống (System Dashboard)</h1>
          <p className="text-slate-500 text-sm mt-1">Xin chào Quản trị viên! Dưới đây là tình hình tài khoản và nhật ký hoạt động thời gian thực.</p>
        </div>
        <div className="flex gap-2.5">
          <Button
            icon={<RotateCcw size={15} />}
            onClick={fetchDashboardData}
            loading={loading}
            className="flex items-center gap-1.5 font-medium rounded-xl h-10 px-4 bg-slate-50 hover:bg-slate-100 border-slate-200"
          >
            Làm mới
          </Button>
          <Link href="/admin/users">
            <Button
              type="primary"
              icon={<UserPlus size={16} />}
              className="flex items-center gap-1.5 font-medium rounded-xl h-10 px-4 bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20"
            >
              Thêm tài khoản
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Toàn hệ thống
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">Tổng số tài khoản</h3>
          <div className="text-3xl font-extrabold text-slate-800 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : (stats?.totalUsers || 0)}
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Sẵn sàng
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">Tài khoản Hoạt động</h3>
          <div className="text-3xl font-extrabold text-emerald-600 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : (stats?.activeUsers || 0)}
          </div>
        </div>

        {/* Locked Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-red-50 text-red-500 p-3 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              Bảo mật
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">Tài khoản Bị khóa</h3>
          <div className="text-3xl font-extrabold text-red-500 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : (stats?.lockedUsers || 0)}
          </div>
        </div>

        {/* Activity Logs in 24h */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-purple-50 text-purple-600 p-3 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              24 giờ qua
            </span>
          </div>
          <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">Thao tác Ghi nhận</h3>
          <div className="text-3xl font-extrabold text-purple-600 mt-1">
            {loading ? <Skeleton.Input size="small" active /> : (stats?.recentLogs24h || 0)}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Roles Breakdown & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Shield size={18} className="text-blue-500" /> Phân bổ theo Vai trò
            </h2>
            <Link href="/admin/users" className="text-xs text-blue-600 hover:underline font-semibold">
              Quản lý
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <span className="text-sm font-semibold text-slate-700">Administrator</span>
              </div>
              <span className="font-bold text-slate-800 text-sm">
                {stats?.usersByRole?.ADMINISTRATOR || 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                <span className="text-sm font-semibold text-slate-700">Manager</span>
              </div>
              <span className="font-bold text-slate-800 text-sm">
                {stats?.usersByRole?.MANAGER || 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                <span className="text-sm font-semibold text-slate-700">Dispatcher (Điều phối)</span>
              </div>
              <span className="font-bold text-slate-800 text-sm">
                {stats?.usersByRole?.DISPATCHER || 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-semibold text-slate-700">Driver (Tài xế)</span>
              </div>
              <span className="font-bold text-slate-800 text-sm">
                {stats?.usersByRole?.DRIVER || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity Logs */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock size={18} className="text-indigo-500" /> Nhật ký Thao tác Gần đây
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Các thao tác mới nhất được hệ thống tự động ghi nhận vết (Append-only).</p>
            </div>
            <Link href="/admin/logs" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              Xem tất cả <ArrowRight size={13} />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="py-6 space-y-3">
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                Chưa có nhật ký hoạt động nào được ghi nhận.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Tag color={log.action === 'CREATE_USER' ? 'green' : log.action === 'LOCK_USER' ? 'red' : log.action === 'SYSTEM_INIT' ? 'purple' : 'blue'}>
                        {log.action}
                      </Tag>
                      <span className="text-xs font-semibold text-slate-700">
                        {log.actor?.full_name || log.actor?.username || log.actor_type}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        #{log.target_type}:{log.target_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {log.reason || 'Thao tác hợp lệ từ hệ thống'}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {formatTime(log.created_time)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
