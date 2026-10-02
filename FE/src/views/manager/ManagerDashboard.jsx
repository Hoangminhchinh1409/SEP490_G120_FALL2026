"use client";
import React from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { Truck, DollarSign, AlertTriangle, CheckCircle, BarChart3, TrendingUp, Users } from 'lucide-react';

export default function ManagerDashboard() {
  const incidentData = [
    { key: '1', type: 'Hỏng xe', count: 12, trend: 'up' },
    { key: '2', type: 'Tai nạn', count: 2, trend: 'down' },
    { key: '3', type: 'Hàng hóa hư hỏng', count: 5, trend: 'up' },
    { key: '4', type: 'Chậm tiến độ', count: 18, trend: 'down' },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Bảng Điều khiển Hiệu suất</h1>
          <p className="text-slate-500 mt-1">Báo cáo phân tích trực quan về doanh thu, tỷ lệ sử dụng xe, và thống kê sự cố.</p>
        </div>
        <button className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] active:scale-95 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <span>Xuất Báo cáo Tháng</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:border-emerald-200 transition-colors">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">
                <ArrowUpOutlined className="text-xs" /> 12%
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-semibold mb-1">Doanh thu (Tháng này)</h3>
            <p className="text-3xl font-black text-slate-800">1.25B <span className="text-lg font-medium text-slate-400">VNĐ</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl">
                <Truck className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">
                <ArrowUpOutlined className="text-xs" /> 3.2%
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-semibold mb-1">Tỷ lệ sử dụng xe (Truck Util.)</h3>
            <p className="text-3xl font-black text-slate-800">85.4<span className="text-lg font-medium text-slate-400">%</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:border-orange-200 transition-colors">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-orange-100 text-orange-600 p-3 rounded-2xl">
                <CheckCircle className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-red-500 text-sm font-bold bg-red-50 px-2.5 py-1 rounded-lg">
                <ArrowDownOutlined className="text-xs" /> 1.5%
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-semibold mb-1">SLA Xử lý Đơn hàng</h3>
            <p className="text-3xl font-black text-slate-800">92.5<span className="text-lg font-medium text-slate-400">%</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:border-rose-200 transition-colors">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-rose-100 text-rose-600 p-3 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-rose-500 text-sm font-bold bg-rose-50 px-2.5 py-1 rounded-lg">
                <ArrowUpOutlined className="text-xs" /> 5 vụ
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-semibold mb-1">Tổng số Sự cố (Tuần)</h3>
            <p className="text-3xl font-black text-slate-800">37</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Thống kê Sự cố theo Phân loại
          </h3>
          <div className="manager-table-override">
            <Table 
              columns={[
                { title: 'Nguyên nhân', dataIndex: 'type', key: 'type', className: 'font-semibold text-slate-700' },
                { title: 'Số lượng', dataIndex: 'count', key: 'count', className: 'font-bold' },
                { 
                  title: 'Xu hướng', 
                  dataIndex: 'trend', 
                  key: 'trend',
                  render: (val) => val === 'up' ? <Tag color="error" className="rounded-md border-0 bg-red-100 text-red-600 font-bold"><ArrowUpOutlined /></Tag> : <Tag color="success" className="rounded-md border-0 bg-emerald-100 text-emerald-600 font-bold"><ArrowDownOutlined /></Tag>
                }
              ]} 
              dataSource={incidentData} 
              pagination={false} 
              size="middle"
              className="border border-slate-100 rounded-2xl overflow-hidden"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Khối lượng đơn của Điều phối viên (Top 3)
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Dispatcher 01 (Nguyễn Văn A)', count: 145, active: 12, percent: 85 },
              { name: 'Dispatcher 02 (Trần Thị B)', count: 132, active: 8, percent: 70 },
              { name: 'Dispatcher 03 (Lê Văn C)', count: 98, active: 15, percent: 55 },
            ].map((d, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/50">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-slate-700">{d.name}</span>
                  <div className="flex gap-4">
                    <span className="text-slate-500 text-sm font-medium bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">Tổng: {d.count}</span>
                    <span className="text-blue-600 font-bold text-sm bg-blue-100 px-2 py-1 rounded-md border border-blue-200 shadow-sm">Đang xử lý: {d.active}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${d.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .manager-table-override .ant-table-thead > tr > th {
          background-color: #f8fafc !important;
          color: #64748b !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .manager-table-override .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important;
        }
        .manager-table-override .ant-table-tbody > tr:hover > td {
          background-color: #f8fafc !important;
        }
      `}} />
    </>
  );
}
