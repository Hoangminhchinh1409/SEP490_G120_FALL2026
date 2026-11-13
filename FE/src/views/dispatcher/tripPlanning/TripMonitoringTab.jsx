import React from 'react';
import { Row, Col, Card, Table, Tag, Space, Button, Tooltip, Input, Select, Progress } from 'antd';
import { 
  Route, 
  Search, 
  Eye, 
  Printer, 
  Box, 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  ArrowRight, 
  User, 
  XCircle 
} from 'lucide-react';

const { Option } = Select;

export default function TripMonitoringTab({
  trips,
  incidents,
  pendingIncidentsCount,
  searchText,
  setSearchText,
  filterStatus,
  setFilterStatus,
  setActiveMainTab,
  setActiveIncidentModal,
  setSelectedTripDetails,
  setSelectedTripWaybill,
  setSelectedTrip3D,
  setSelectedTripReplay,
  handleCompleteTrip,
  handleCancelTrip,
  leaveReassignments = [],
  onOpenReassignModal,
  isReadOnly = false
}) {
  const filteredTrips = trips.filter(item => {
    const matchSearch = searchText === '' ||
      item.id?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.plate?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.driver_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.customer?.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = filterStatus === 'ALL' ||
      (filterStatus === 'LATE_RISK' ? item.is_late_risk : filterStatus === 'INCIDENT' ? item.has_incident : item.status === filterStatus);
    return matchSearch && matchStatus;
  });

  const tripColumns = [
    {
      title: 'Mã chuyến & Đội xe',
      key: 'trip_truck',
      width: '26%',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="font-bold text-[#7367f0] text-xs font-mono cursor-pointer hover:underline"
              onClick={() => setSelectedTripDetails(r)}
            >
              {r.id}
            </span>
            {r.needs_driver_reassign && (
              <Tag color="orange" className="text-[10px] m-0 px-1.5 py-0 flex items-center gap-1 font-bold">
                <User size={10} /> Cần đổi tài xế
              </Tag>
            )}
            {r.has_incident && (
              <Tag color="error" className="text-[10px] m-0 px-1.5 py-0 flex items-center gap-1 font-bold animate-pulse">
                <AlertTriangle size={10} /> Sự cố hiện trường
              </Tag>
            )}
            {r.is_late_risk && !r.has_incident && (
              <Tag color="warning" className="text-[10px] m-0 px-1.5 py-0 flex items-center gap-1">
                <AlertTriangle size={10} /> Trễ hẹn
              </Tag>
            )}
            <Tag color={r.status === 'COMPLETED' ? 'green' : r.status === 'CANCELLED' ? 'red' : 'blue'} className="text-[10px] m-0 px-1.5 py-0">
              {r.status === 'COMPLETED' ? 'Hoàn thành' : r.status === 'CANCELLED' ? 'Đã hủy chuyến' : 'Đang chạy'}
            </Tag>
            {r.waybill_version > 1 && (
              <Tag color="purple" className="text-[10px] m-0 px-1 py-0 font-mono">
                V{r.waybill_version}
              </Tag>
            )}
          </div>
          <div className="text-xs font-semibold text-gray-800 mt-1 flex items-center gap-1.5">
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded border text-[11px]">{r.plate}</span>
            <span className="text-gray-500 text-[11px]">({r.truck_model})</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
            <User size={11} className={r.needs_driver_reassign ? "text-orange-500" : "text-gray-400"} />
            <span className={r.needs_driver_reassign ? "text-orange-600 font-bold" : ""}>
              {r.driver_name}{r.driver_phone ? ` - ${r.driver_phone}` : ""}
            </span>
          </div>
        </div>
      )
    },
    {
      title: 'Lộ trình & Khách hàng',
      key: 'route_customer',
      width: '26%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-800">{r.customer}</div>
          <div className="text-gray-600 mt-1 flex items-center gap-1">
            <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="truncate">{r.pickup}</span>
          </div>
          <div className="text-gray-600 mt-0.5 flex items-center gap-1">
            <ArrowRight size={12} className="text-emerald-500 shrink-0 mt-0.5" />
            <span className="truncate">{r.dropoff}</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-mono mt-0.5">
            Đơn trên chuyến: {r.orders?.join(', ')}
          </div>
        </div>
      )
    },
    {
      title: 'Tiến độ & Thời gian',
      key: 'timeline',
      width: '22%',
      render: (_, r) => (
        <div className="text-xs space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500">Kế hoạch: {r.planned_start} - {r.planned_finish}</span>
            <span className="font-bold text-[#7367f0]">{r.progress}%</span>
          </div>
          <Progress percent={r.progress} size="small" status={r.has_incident ? 'exception' : r.is_late_risk ? 'exception' : 'active'} />
          {r.has_incident ? (
            <div className="text-[11px] text-red-600 font-bold flex items-center gap-1">
              <AlertTriangle size={11} /> {r.late_reason || 'Đang phát sinh sự cố hiện trường'}
            </div>
          ) : r.is_late_risk && (
            <div className="text-[11px] text-amber-600 font-medium">
              Cảnh báo: {r.late_reason}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Hồ sơ & Công cụ Điều phối',
      key: 'actions',
      width: '26%',
      render: (_, record) => {
        const tripIncident = incidents.find(i => i.trip_code === record.id && i.status === 'PENDING');
        return (
          <Space size="small" wrap>
            {record.needs_driver_reassign && onOpenReassignModal ? (
              <Tooltip title="Điều phối tài xế thay thế cho chuyến này">
                <Button
                  size="small"
                  type="primary"
                  icon={<User size={13} />}
                  className="bg-orange-500 hover:bg-orange-600 border-orange-500 font-bold text-xs"
                  onClick={() => onOpenReassignModal({
                    trip_id: record.raw_id || record.id,
                    trip_code: record.trip_code || record.id,
                    plate_number: record.plate,
                    route_summary: `${record.pickup} -> ${record.dropoff}`,
                    planned_start: record.planned_start_iso,
                    leaving_driver_name: record.previous_driver_name,
                    leave_reason: record.leave_reason,
                  })}
                >
                  Đổi tài xế
                </Button>
              </Tooltip>
            ) : null}
            {record.has_incident && tripIncident ? (
              <Tooltip title="Mở cửa sổ xử lý sự cố hiện trường ngay lập tức">
                <Button
                  size="small"
                  danger
                  type="primary"
                  icon={<AlertTriangle size={13} />}
                  className="font-bold text-xs"
                  onClick={() => setActiveIncidentModal(tripIncident)}
                >
                  Xử lý Sự cố
                </Button>
              </Tooltip>
            ) : null}
            <Tooltip title="Chi tiết chuyến & Điểm dừng">
              <Button
                size="small"
                icon={<Eye size={13} className="text-[#7367f0]" />}
                onClick={() => setSelectedTripDetails(record)}
              >
                Chi tiết
              </Button>
            </Tooltip>
            <Tooltip title="Lệnh điều xe & Vận đơn">
              <Button
                size="small"
                icon={<Printer size={13} className="text-emerald-600" />}
                onClick={() => setSelectedTripWaybill(record)}
              >
                Vận đơn
              </Button>
            </Tooltip>
            <Tooltip title="Sơ đồ xếp thùng 3D">
              <Button
                size="small"
                icon={<Box size={13} className="text-indigo-600" />}
                onClick={() => setSelectedTrip3D(record)}
              />
            </Tooltip>
            <Tooltip title="Xem lại hành trình GPS">
              <Button
                size="small"
                icon={<PlayCircle size={13} className="text-amber-600" />}
                onClick={() => setSelectedTripReplay(record)}
              />
            </Tooltip>
            {!isReadOnly && record.status === 'IN_TRANSIT' && (
              <Tooltip title="Xác nhận hoàn tất giao hàng & trả xe">
                <Button
                  size="small"
                  type="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold"
                  icon={<CheckCircle2 size={13} />}
                  onClick={() => handleCompleteTrip(record)}
                >
                  Hoàn thành
                </Button>
              </Tooltip>
            )}
            {!isReadOnly && record.status === 'IN_TRANSIT' && record.progress <= 50 && (
              <Tooltip title="Hủy chuyến">
                <Button
                  size="small"
                  danger
                  icon={<XCircle size={13} />}
                  onClick={() => handleCancelTrip(record)}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div className="space-y-5 pt-2">
      {/* Banner & Hàng đợi Chuyến xe cần đổi tài xế do nghỉ đột xuất đã duyệt */}
      {leaveReassignments.length > 0 && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shrink-0 mt-0.5">
                <User size={20} />
              </div>
              <div>
                <h4 className="font-bold text-orange-950 text-sm">
                  Cần đổi tài xế (Re-assign): Có {leaveReassignments.length} chuyến xe có tài xế được Quản lý duyệt nghỉ đột xuất!
                </h4>
                <p className="text-xs text-orange-800 mt-0.5">
                  Vui lòng chọn tài xế thay thế để kịp tiến độ xuất phát và giữ nguyên kế hoạch vận tải.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {leaveReassignments.map((item) => (
              <div
                key={item.trip_id}
                className="bg-white rounded-xl border border-orange-200 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-[#7367f0]">{item.trip_code}</span>
                    <Tag color="orange" className="!m-0 text-[10px]">Chưa có tài mới</Tag>
                    <span className="font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded border">
                      {item.plate_number}
                    </span>
                  </div>
                  <div className="text-gray-700 truncate">{item.route_summary}</div>
                  <div className="text-[11px] text-gray-500">
                    Tài xế nghỉ: <b>{item.leaving_driver_name}</b> • Lý do: {item.leave_reason}
                  </div>
                  {item.planned_start && (
                    <div className="text-[11px] text-orange-700 font-mono">
                      Khởi hành: {new Date(item.planned_start).toLocaleString("vi-VN")}
                    </div>
                  )}
                </div>
                {isReadOnly ? (
                  <Tag color="orange" className="shrink-0 font-medium text-xs">
                    Chỉ xem
                  </Tag>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onOpenReassignModal && onOpenReassignModal(item)}
                    className="bg-orange-500 hover:bg-orange-600 border-orange-500 font-bold shrink-0 rounded-lg"
                  >
                    Đổi tài xế
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banner Cảnh báo sự cố hiện trường khẩn cấp */}
      {pendingIncidentsCount > 0 && incidents[0] && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-red-900 text-sm">
                Cảnh báo: Có {pendingIncidentsCount} sự cố chuyến xe đang cần xử lý khẩn cấp!
              </h4>
              <p className="text-xs text-red-700 mt-0.5">
                Chuyến {incidents[0].trip_code} ({incidents[0].truck} - {incidents[0].driver}): {incidents[0].description}
              </p>
            </div>
          </div>
          {isReadOnly ? (
            <Button
              icon={<Eye size={15} />}
              className="font-bold shrink-0 shadow-sm text-gray-700 bg-white"
              onClick={() => setActiveIncidentModal(incidents[0])}
            >
              Xem chi tiết sự cố
            </Button>
          ) : (
            <Button
              type="primary"
              danger
              icon={<AlertTriangle size={15} />}
              className="font-bold shrink-0 shadow-sm"
              onClick={() => setActiveIncidentModal(incidents[0])}
            >
              Xử lý sự cố ngay
            </Button>
          )}
        </div>
      )}

      {/* KPI Widgets */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-gray-500">Chuyến đang chạy</div>
            <div className="text-2xl font-bold text-[#7367f0] mt-1 font-mono">
              {trips.filter(t => t.status === 'IN_TRANSIT').length}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card 
            className={`rounded-xl border-gray-100 shadow-xs cursor-pointer transition-all ${pendingIncidentsCount > 0 ? 'bg-red-50/40 border-red-200 hover:bg-red-50' : ''}`} 
            styles={{ body: { padding: '16px' } }}
            onClick={() => setActiveMainTab('incidents')}
          >
            <div className="text-xs text-red-600 flex items-center gap-1 font-semibold">
              <AlertTriangle size={13} /> Sự cố cần xử lý
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1 font-mono flex items-center gap-2">
              {pendingIncidentsCount}
              {pendingIncidentsCount > 0 && <span className="text-xs font-normal text-red-500">(Xem chi tiết &rarr;)</span>}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-amber-600 flex items-center gap-1 font-semibold">
              <Clock size={13} /> Nguy cơ trễ hẹn (Late-risk)
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">
              {trips.filter(t => t.is_late_risk).length}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
              <CheckCircle2 size={13} /> Đã hoàn thành hôm nay
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              {trips.filter(t => t.status === 'COMPLETED').length}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Bộ lọc và Tìm kiếm chuyến xe */}
      <Card className="shadow-xs border-gray-100 rounded-xl" styles={{ body: { padding: '16px' } }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={10}>
            <Input
              prefix={<Search size={16} className="text-gray-400 mr-1" />}
              placeholder="Tìm theo Mã chuyến, Biển số xe, Tài xế, Khách hàng..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="rounded-lg"
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              className="w-full"
              placeholder="Lọc theo trạng thái"
            >
              <Option value="ALL">Tất cả trạng thái chuyến</Option>
              <Option value="IN_TRANSIT">Đang chạy trên đường (In-Transit)</Option>
              <Option value="LATE_RISK">Cảnh báo trễ giờ (Late-risk)</Option>
              <Option value="INCIDENT">Đang gặp sự cố (Incident)</Option>
              <Option value="COMPLETED">Đã hoàn thành giao hàng</Option>
              <Option value="CANCELLED">Đã hủy chuyến</Option>
            </Select>
          </Col>
          <Col xs={24} md={6} className="text-right">
            <span className="text-xs text-gray-500">
              Hiển thị: <b>{filteredTrips.length}</b> / {trips.length} chuyến xe
            </span>
          </Col>
        </Row>
      </Card>

      {/* Bảng giám sát chuyến xe */}
      <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table
          columns={tripColumns}
          dataSource={filteredTrips}
          rowKey="id"
          pagination={{ pageSize: 6 }}
          size="middle"
        />
      </Card>
    </div>
  );
}
