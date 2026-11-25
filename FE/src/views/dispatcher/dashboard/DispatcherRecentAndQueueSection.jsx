"use client";
import React, { useMemo } from 'react';
import Link from 'next/link';
import { Tag, Table } from 'antd';

export function buildDispatcherOrderColumns(statusMeta) {
  return [
    {
      title: 'Mã đơn',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 120,
      render: (text) => (
        <span className="font-bold text-primary font-mono text-xs">{text}</span>
      )
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      key: 'customer',
      ellipsis: true,
      render: (text) => (
        <span className="font-medium text-on-surface text-xs truncate block" title={text}>
          {text || 'Khách hàng'}
        </span>
      )
    },
    {
      title: 'Tuyến đường',
      dataIndex: 'route',
      key: 'route',
      ellipsis: true,
      render: (text) => (
        <span className="text-on-surface-variant text-xs truncate block" title={text}>
          {text}
        </span>
      )
    },
    {
      title: 'Giá cước',
      dataIndex: 'agreed_price',
      key: 'agreed_price',
      width: 130,
      align: 'right',
      render: (price) => (
        <span className="font-bold text-emerald-600 text-xs whitespace-nowrap">
          {Number(price) > 0 ? `${Number(price).toLocaleString('vi-VN')} đ` : 'Chờ báo giá'}
        </span>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 135,
      align: 'center',
      render: (status) => {
        const meta = statusMeta[status] || { label: status, color: 'default' };
        return (
          <Tag
            color={meta.color}
            className="m-0 text-[11px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
          >
            {meta.label}
          </Tag>
        );
      }
    }
  ];
}

export function DispatcherOverviewBottomSection({
  orders,
  periodOrders,
  loading,
  statusMeta,
  onOpenCreateModal
}) {
  const columns = useMemo(() => buildDispatcherOrderColumns(statusMeta), [statusMeta]);

  const recentActivities = useMemo(() => {
    if (orders.length === 0) {
      return [
        {
          id: 'empty',
          title: 'Hệ thống sẵn sàng tiếp nhận vận đơn mới',
          time: 'Hiện tại',
          icon: 'check_circle',
          color: 'text-emerald-600'
        }
      ];
    }
    return orders.slice(0, 6).map((o, idx) => {
      const meta = statusMeta[o.status] || { label: o.status, color: 'default' };
      return {
        id: o.id || idx,
        title: `Đơn ${o.order_id} (${o.customer || 'Khách lẻ'}): ${meta.label}`,
        time: o.date || 'Gần đây',
        icon: o.status === 'DELIVERED' || o.status === 'CLOSED' ? 'task_alt' : 'local_shipping',
        color:
          o.status === 'CANCELLED'
            ? 'text-error'
            : o.status === 'DELIVERED' || o.status === 'CLOSED'
              ? 'text-emerald-600'
              : 'text-secondary'
      };
    });
  }, [orders, statusMeta]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/30">
        <div className="mb-4 pb-3 border-b border-surface-container flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-primary">
              Đơn hàng gần đây ({periodOrders.length})
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              Danh sách vận đơn thuộc phạm vi điều phối trong kỳ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dispatcher/orders"
              className="px-3 py-1.5 rounded-lg bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-colors"
            >
              Xem tất cả
            </Link>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>Tạo đơn</span>
            </button>
          </div>
        </div>
        <Table
          columns={columns}
          dataSource={periodOrders}
          rowKey={(record) => record.id || record.order_id}
          loading={loading}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-container">
            <h3 className="text-sm font-extrabold text-primary">
              Hoạt động Vận hành Gần đây
            </h3>
            <Link
              href="/dispatcher/trips"
              className="text-xs text-secondary font-bold hover:underline"
            >
              Lập chuyến &rarr;
            </Link>
          </div>
          <div className="space-y-3.5">
            {recentActivities.map((feed) => (
              <div key={feed.id} className="flex gap-3 items-start">
                <span
                  className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${feed.color}`}
                >
                  {feed.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface leading-snug">
                    {feed.title}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {feed.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between text-[11px] text-on-surface-variant">
          <span>Đồng bộ trực tiếp từ PostgreSQL</span>
          <span className="font-bold text-primary">ALS Dispatch</span>
        </div>
      </div>
    </div>
  );
}

export function DispatcherQueueSection({ queueOrders, computed, loading, statusMeta }) {
  const columns = useMemo(() => buildDispatcherOrderColumns(statusMeta), [statusMeta]);

  return (
    <div className="space-y-5">
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-container pb-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-black text-primary tracking-tight">
                Đơn hàng đang chờ Xử lý &amp; Xếp xe
              </h3>
              <Tag color="cyan" className="font-bold">
                Sẵn sàng xếp xe: {computed.readyCount}
              </Tag>
              <Tag color="green" className="font-bold">
                Xe trống: {computed.availableTrucks}/{computed.totalTrucks}
              </Tag>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Các đơn ở trạng thái Nháp, Đã xác nhận hoặc Sẵn sàng lập chuyến để ghép vào xe tải.
            </p>
          </div>
          <Link
            href="/dispatcher/trips"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">alt_route</span>
            <span>Đi tới Lập chuyến &amp; Gán xe</span>
          </Link>
        </div>

        <Table
          columns={columns}
          dataSource={queueOrders}
          rowKey={(record) => record.id || record.order_id}
          loading={loading}
          pagination={{ pageSize: 8 }}
          size="small"
        />
      </div>
    </div>
  );
}
