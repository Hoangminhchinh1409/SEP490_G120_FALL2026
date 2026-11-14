"use client";
import React, { useState, useEffect } from 'react';
import { Table, Tag, Input, Select, message, Spin, Tooltip } from 'antd';
import { managerApi } from '../../api/managerApi';
import { useAuth } from '../../providers/AuthProvider';
import MajorIncidentDetailModal from './incident/MajorIncidentDetailModal';

const { Option } = Select;

export default function MajorIncidentListPage({ readOnly = false }) {
  const { user } = useAuth();
  const isReadOnly = readOnly || (Number(user?.role_id) !== 1 && Number(user?.role_id) !== 2);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, escalated: 0, resolved: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState('ESCALATED'); // 'ESCALATED' (mặc định), 'RESOLVED', 'ALL'
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Chi tiết sự cố (Screen 14)
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (typeFilter !== 'ALL') params.type = typeFilter;

      const data = await managerApi.getIncidents(params);
      setIncidents(data.incidents || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Lỗi tải danh sách sự cố lớn:', error);
      message.error('Không thể tải danh sách sự cố từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, typeFilter]);

  const handleOpenDetail = (record) => {
    setSelectedIncident(record);
    setIsDetailModalOpen(true);
  };

  // Lọc tìm kiếm client-side theo mã sự cố, đơn, chuyến, tài xế
  const filteredIncidents = (incidents || []).filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.code?.toLowerCase().includes(q) ||
      item.order_code?.toLowerCase().includes(q) ||
      item.trip_code?.toLowerCase().includes(q) ||
      item.driver_name?.toLowerCase().includes(q) ||
      item.truck_plate?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.type_display?.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      title: 'Mã sự cố',
      key: 'code',
      width: 130,
      render: (_, r) => (
        <div>
          <span className="font-mono font-bold text-error text-xs block">{r.code || `INC-${r.id}`}</span>
          <span className="text-[10px] text-outline font-mono">
            {r.reported_time ? new Date(r.reported_time).toLocaleDateString('vi-VN') : ''}
          </span>
        </div>
      )
    },
    {
      title: 'Phân loại sự cố',
      key: 'type',
      width: 170,
      render: (_, r) => (
        <div>
          <span className="font-bold text-xs text-primary block">{r.type_display || r.type}</span>
          {r.is_major && (
            <Tag color="red" className="font-bold text-[10px] px-1.5 py-0 rounded mt-0.5">
              Sự cố lớn (BR-16)
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Đơn hàng',
      key: 'order',
      width: 150,
      render: (_, r) => (
        <span className="font-mono font-bold text-xs text-primary">
          {r.order_code || 'Chưa gắn đơn'}
        </span>
      )
    },
    {
      title: 'Chuyến xe & Phương tiện',
      key: 'trip',
      width: 190,
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-mono font-bold text-secondary">{r.trip_code || `TRIP-${r.trip_id}`}</div>
          <div className="text-on-surface-variant text-[11px] mt-0.5">
            Xe: <span className="font-mono font-semibold text-primary">{r.truck_plate || '29C-246.80'}</span>
          </div>
          <div className="text-outline text-[10px]">Tài xế: {r.driver_name || 'Tài xế'}</div>
        </div>
      )
    },
    {
      title: 'Thời điểm chuyển lên',
      key: 'escalated_time',
      width: 150,
      render: (_, r) => (
        <div className="text-xs">
          <span className="font-mono text-primary font-medium">
            {r.escalated_time ? new Date(r.escalated_time).toLocaleString('vi-VN') : (
              r.reported_time ? new Date(r.reported_time).toLocaleString('vi-VN') : 'N/A'
            )}
          </span>
        </div>
      )
    },
    {
      title: 'Tiền bồi thường',
      key: 'compensation',
      width: 150,
      align: 'right',
      render: (_, r) => {
        const amt = Number(r.approved_compensation_amount || r.claim_amount || r.proposed_compensation_amount || 0);
        return amt > 0 ? (
          <span className="font-mono font-bold text-error text-xs block text-right">
            {amt.toLocaleString('vi-VN')} đ
          </span>
        ) : (
          <span className="text-outline text-xs italic block text-right">Không phát sinh</span>
        );
      }
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      align: 'center',
      render: (_, r) => {
        const s = (r.status || '').toUpperCase();
        if (s === 'DONE' || s === 'RESOLVED') {
          return (
            <Tag color="green" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase border-0 shadow-2xs">
              Đã hoàn tất (Đóng)
            </Tag>
          );
        }
        if (s === 'APPROVED') {
          return (
            <Tag color="cyan" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase border-0 shadow-2xs">
              Đã duyệt · Chờ chi trả
            </Tag>
          );
        }
        return (
          <Tag color="orange" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase border-0 shadow-2xs">
            Chờ xét duyệt
          </Tag>
        );
      }
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetail(r);
          }}
          className="px-3.5 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-secondary text-xs font-bold inline-flex items-center gap-1 cursor-pointer border border-surface-container transition-all shadow-2xs hover:scale-102"
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          <span>{isReadOnly || r.status === 'DONE' || r.status === 'RESOLVED' ? 'Xem lại' : 'Xét duyệt'}</span>
        </button>
      )
    }
  ];

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
              Sự cố &amp; Bồi thường (Incidents &amp; Compensation)
            </h1>
            {summary.escalated > 0 ? (
              <Tag color="error" className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                {summary.escalated} Chờ Quản lý xử lý
              </Tag>
            ) : (
              <Tag color="green" className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                Tất cả đã giải quyết
              </Tag>
            )}
          </div>
          <p className="text-xs text-on-surface-variant mt-1.5 max-w-3xl">
            Thẩm định hồ sơ bằng chứng đối chiếu 3 góc nhìn (Pickup - Sự cố - Delivery), căn cứ Hợp đồng vận chuyển và phê duyệt bồi thường thiệt hại hàng hóa (BR-16, UC-25).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchIncidents}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer border border-surface-container"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">warning</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Tổng sự cố</div>
            <div className="text-xl font-black text-primary font-mono">{summary.total}</div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">pending_actions</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Chờ xử lý (Escalated)</div>
            <div className="text-xl font-black text-amber-600 font-mono">{summary.escalated || summary.pending || 0}</div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">check_circle</span>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">Đã giải quyết (Resolved)</div>
            <div className="text-xl font-black text-emerald-600 font-mono">{summary.resolved || 0}</div>
          </div>
        </div>
      </div>

      {/* Main Content Card with Table & Filter */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
        {/* Controls: Filter by status, type & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none cursor-pointer"
              >
                <option value="ESCALATED">Chờ xét duyệt (Escalated)</option>
                <option value="APPROVED">Đã duyệt (Chờ chi trả)</option>
                <option value="RESOLVED">Đã hoàn tất (Đóng)</option>
                <option value="ALL">Tất cả ({summary.total})</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Loại sự cố:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs font-bold text-primary focus:outline-none cursor-pointer max-w-[220px]"
              >
                <option value="ALL">Tất cả loại sự cố</option>
                <option value="DAMAGED_LOST_CARGO">Hàng hư hỏng / mất (Damaged/Lost)</option>
                <option value="TRAFFIC_ACCIDENT">Tai nạn giao thông (Traffic Accident)</option>
                <option value="CARGO_HELD">Hàng bị giữ (Cargo Held)</option>
                <option value="ENGINE_BREAKDOWN">Hỏng xe (Breakdown)</option>
                <option value="ROAD_BAN">Cấm đường / Ùn tắc (Road Ban)</option>
                <option value="OTHER">Khác (Other)</option>
              </select>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <Input
              placeholder="Tìm theo mã sự cố, đơn, chuyến, xe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              prefix={<span className="material-symbols-outlined text-outline text-[18px]">search</span>}
              className="rounded-xl text-xs h-9 bg-surface-container-low border-surface-container"
            />
          </div>
        </div>

        {/* Table List (10 items / page, row click opens modal) */}
        <Table
          rowKey="id"
          dataSource={filteredIncidents}
          columns={columns}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total, range) => (
              <span className="text-xs text-on-surface-variant">
                Hiển thị {range[0]}-{range[1]} / {total} sự cố · Bấm vào dòng để mở Chi tiết sự cố &amp; Xét duyệt bồi thường
              </span>
            )
          }}
          onRow={(record) => ({
            onClick: () => handleOpenDetail(record),
            className: 'cursor-pointer hover:bg-surface-container-low/50 transition-colors'
          })}
          className="custom-manager-table text-xs"
        />
      </div>

      {/* Modal Screen 14 Chi tiết sự cố */}
      <MajorIncidentDetailModal
        open={isDetailModalOpen}
        incident={selectedIncident}
        isReadOnly={isReadOnly}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedIncident(null);
        }}
        onSuccess={() => {
          fetchIncidents();
        }}
      />
    </div>
  );
}

