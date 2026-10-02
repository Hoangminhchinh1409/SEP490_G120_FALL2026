"use client";
import { Users, Activity, TrendingUp, DollarSign, Clock } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tổng quan hệ thống</h1>
          <p className="text-slate-500 text-sm mt-1">Xin chào! Dưới đây là tình hình hoạt động hôm nay.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors shadow-sm text-sm">
            Tải báo cáo
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm shadow-blue-600/20 text-sm">
            Thêm người dùng
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-green-600 text-sm font-semibold bg-green-50 px-2 py-1 rounded-lg">
              <TrendingUp className="w-3 h-3" /> +12%
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Tổng người dùng</h3>
          <p className="text-3xl font-bold text-slate-800 mt-1">12,405</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-green-600 text-sm font-semibold bg-green-50 px-2 py-1 rounded-lg">
              <TrendingUp className="w-3 h-3" /> +5.4%
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Lượt truy cập (24h)</h3>
          <p className="text-3xl font-bold text-slate-800 mt-1">45,821</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-red-500 text-sm font-semibold bg-red-50 px-2 py-1 rounded-lg">
              <TrendingUp className="w-3 h-3 rotate-180" /> -2.1%
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Doanh thu hôm nay</h3>
          <p className="text-3xl font-bold text-slate-800 mt-1">$8,240</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-slate-500 text-sm font-semibold bg-slate-50 px-2 py-1 rounded-lg">
              0.0%
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Thời gian phản hồi</h3>
          <p className="text-3xl font-bold text-slate-800 mt-1">1.2s</p>
        </div>
      </div>
    </div>
  );
}
