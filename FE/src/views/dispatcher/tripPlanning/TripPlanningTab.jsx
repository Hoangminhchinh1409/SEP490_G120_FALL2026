import React from 'react';
import { Row, Col, Card, Table, Tag, Space, Button, Tooltip } from 'antd';
import { Truck, CheckCircle2, User, MapPin, ArrowRight, Clock, XCircle } from 'lucide-react';

export default function TripPlanningTab({
  pendingOrders,
  trucks,
  drivers,
  loading,
  setSelectedOrderForAssign,
  setSelectedOrderForCancel
}) {
  const pendingOrdersColumns = [
    {
      title: 'Mã đơn & Khách hàng',
      key: 'order_customer',
      width: '25%',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#7367f0] font-mono text-xs">{r.order_id || r.id}</span>
            <Tag color="cyan" className="text-[10px] m-0 px-1.5 py-0 font-medium">Sẵn sàng xếp xe</Tag>
          </div>
          <div className="font-semibold text-gray-800 text-xs mt-1">{r.customer || r.customer_name}</div>
          <div className="text-gray-400 text-[11px] font-mono">{r.customer_phone}</div>
        </div>
      )
    },
    {
      title: 'Tuyến đường giao nhận',
      key: 'route',
      width: '28%',
      render: (_, r) => (
        <div className="text-xs space-y-1">
          <div className="text-gray-700 flex items-start gap-1">
            <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="truncate">{r.pickup || r.pickup_address}</span>
          </div>
          <div className="text-gray-700 flex items-start gap-1">
            <ArrowRight size={12} className="text-emerald-500 shrink-0 mt-0.5" />
            <span className="truncate">{r.dropoff || r.delivery_address}</span>
          </div>
        </div>
      )
    },
    {
      title: 'Hàng hóa & Tải trọng',
      key: 'cargo',
      width: '18%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-medium text-gray-800">{r.package_count || 1} {r.package_unit || 'Kiện'}</div>
          <div className="text-gray-500 text-[11px] mt-0.5">
            Tải trọng: <b className="font-mono text-indigo-600">{r.chargeable || r.weight || 0} kg</b>
          </div>
        </div>
      )
    },
    {
      title: 'Cước thỏa thuận & Khung giờ hẹn',
      key: 'price_window',
      width: '17%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-bold text-blue-700 font-mono">
            {(r.agreed_price || 0) > 0 ? `${(r.agreed_price).toLocaleString()} đ` : 'Chưa nhập'}
          </div>
          <div className="text-gray-500 text-[11px] mt-0.5 flex items-center gap-1">
            <Clock size={11} className="text-amber-500" />
            <span>{r.appointment_window || 'Trong ngày'}</span>
          </div>
        </div>
      )
    },
    {
      title: 'Thao tác điều phối',
      key: 'actions',
      width: '16%',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<Truck size={14} />}
            className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold text-xs shadow-sm"
            onClick={() => setSelectedOrderForAssign(record)}
          >
            Phân bổ xe
          </Button>
          <Tooltip title="Hủy đơn">
            <Button
              size="small"
              danger
              icon={<XCircle size={14} />}
              className="text-xs"
              onClick={() => setSelectedOrderForCancel(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div className="space-y-5 pt-2">
      {/* KPI Widgets */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-gray-500 font-medium">Đơn hàng chờ xếp xe</div>
            <div className="text-2xl font-bold text-[#7367f0] mt-1 font-mono">
              {pendingOrders.length} đơn
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={13} /> Xe tải sẵn sàng
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              {trucks.filter(t => t.status === 'AVAILABLE').length} xe
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <User size={13} /> Tài xế sẵn sàng
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">
              {drivers.filter(d => d.status === 'AVAILABLE' || d.status === 'ACTIVE').length} tài xế
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-gray-500 font-medium">Tổng tải trọng chờ gán</div>
            <div className="text-2xl font-bold text-gray-800 mt-1 font-mono">
              {pendingOrders.reduce((sum, o) => sum + (o.chargeable || o.weight || 0), 0).toLocaleString()} kg
            </div>
          </Card>
        </Col>
      </Row>

      {/* Bảng đơn hàng chờ xếp chuyến */}
      <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-sm text-gray-800">Danh sách Đơn hàng sẵn sàng xếp xe</h3>
            <p className="text-xs text-gray-400 mt-0.5">Chọn đơn hàng để gán xe nội bộ, chỉ định tài xế hoặc bàn giao cho nhà xe đối tác 3PL</p>
          </div>
        </div>
        <Table
          columns={pendingOrdersColumns}
          dataSource={pendingOrders}
          rowKey={r => r.id || r.order_id}
          loading={loading}
          pagination={{ pageSize: 6 }}
          size="middle"
          locale={{
            emptyText: (
              <div className="py-8 text-center text-gray-400">
                <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-medium text-xs text-gray-600">Hiện không có đơn hàng nào chờ xếp chuyến</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Các đơn hàng sau khi được xác nhận tại mục Quản lý đơn hàng sẽ tự động xuất hiện ở đây.</p>
              </div>
            )
          }}
        />
      </Card>
    </div>
  );
}
