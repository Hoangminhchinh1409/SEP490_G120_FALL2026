"use client";
import { useState } from 'react';
import { Table, Tag, Button, Input, Modal, Select, Row, Col, Space, Card, Badge, Tooltip, Progress, Drawer, message, Tabs } from 'antd';
import { Route, Search, Eye, AlertTriangle, PlayCircle, Box, Printer, Download, Clock, MapPin, Truck, User, CheckCircle2, ShieldAlert, ArrowRight, FileText } from 'lucide-react';

const { Option } = Select;

// Dữ liệu mẫu các chuyến xe thực tế khớp với luồng vận hành của Report 3
const initialTrips = [
  {
    id: 'TRIP-8821',
    plate: '29H-995.72',
    truck_model: 'Thaco Frontier 1.25T',
    driver_name: 'Hồ Chí Học',
    driver_phone: '008093002529',
    orders: ['ORD-2026-091', 'ORD-2026-092'],
    customer: 'Công ty TNHH ADTEK Việt Nam',
    pickup: 'Kho ALS Cảng HKQT Nội Bài',
    dropoff: 'Nhà máy ADTEK - KCN Tiên Sơn, Bắc Ninh',
    planned_start: '08:30',
    planned_finish: '11:45',
    actual_start: '08:42',
    status: 'IN_TRANSIT',
    is_late_risk: true,
    late_reason: 'Ùn tắc tại nút giao cầu Phù Đổng',
    progress: 65,
    seal_number: 'SEAL-VN-98721',
    seal_photo_url: '/assets/hero.png',
    stops: [
      { id: 1, name: 'Kho ALS Nội Bài', type: 'PICKUP', planned: '08:30', actual: '08:42', event: 'Đã xuất phát (Left)', note: 'Đã niêm phong chì số SEAL-VN-98721' },
      { id: 2, name: 'Trạm dừng nghỉ Km12', type: 'REST', planned: '09:30', actual: '09:35', event: 'Nghỉ giải lao 15p', note: 'Kiểm tra nhiệt độ thùng xe' },
      { id: 3, name: 'Nhà máy ADTEK Tiên Sơn', type: 'DROPOFF', planned: '11:45', actual: 'Dự kiến 12:10 (Trễ 25p)', event: 'Đang di chuyển tới', note: 'Hẹn trước với bảo vệ cổng số 2' }
    ]
  },
  {
    id: 'TRIP-8822',
    plate: '29H-767.99',
    truck_model: 'Thaco Ollin 2.5T',
    driver_name: 'Tạ Đức Hải',
    driver_phone: '0977887918',
    orders: ['ORD-2026-088'],
    customer: 'Công ty SLVN Thiết bị Âm thanh',
    pickup: 'Kho ALS Nội Bài',
    dropoff: 'Cụm CN Lai Xá (Lô 2), Hoài Đức',
    planned_start: '09:00',
    planned_finish: '11:30',
    actual_start: '09:00',
    status: 'IN_TRANSIT',
    is_late_risk: false,
    late_reason: null,
    progress: 80,
    seal_number: 'SEAL-VN-11029',
    seal_photo_url: '/assets/hero.png',
    stops: [
      { id: 1, name: 'Kho ALS Nội Bài', type: 'PICKUP', planned: '09:00', actual: '09:00', event: 'Đã xuất phát', note: 'Lấy 8 kiện thiết bị âm thanh' },
      { id: 2, name: 'Cụm CN Lai Xá Lô 2', type: 'DROPOFF', planned: '11:30', actual: '11:20 (Sắp đến)', event: 'Cách điểm giao 3km', note: 'Chờ giao hàng và ký POD' }
    ]
  },
  {
    id: 'TRIP-8820',
    plate: '29C-882.11',
    truck_model: 'Thaco Auman 4.0T',
    driver_name: 'Nguyễn Văn Đạt',
    driver_phone: '0912345678',
    orders: ['ORD-2026-079'],
    customer: 'ALS Logistics Hub',
    pickup: 'Kho Ngoại quan Yên Phong',
    dropoff: 'Cảng Tân Vũ - Hải Phòng',
    planned_start: '06:00',
    planned_finish: '10:00',
    actual_start: '06:05',
    status: 'COMPLETED',
    is_late_risk: false,
    late_reason: null,
    progress: 100,
    seal_number: 'SEAL-VN-55441',
    pod_photo_url: '/assets/hero.png',
    stops: [
      { id: 1, name: 'Kho Yên Phong', type: 'PICKUP', planned: '06:00', actual: '06:05', event: 'Đã hoàn thành', note: 'Bốc hàng nguyên container' },
      { id: 2, name: 'Cảng Tân Vũ Hải Phòng', type: 'DROPOFF', planned: '10:00', actual: '09:50', event: 'Đã giao hàng (Delivered)', note: 'Đã ký nhận POD và kiểm tra chì nguyên vẹn' }
    ]
  }
];

export default function TripPlanningAndMonitoring() {
  const [trips] = useState(initialTrips);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals state
  const [selectedTripDetails, setSelectedTripDetails] = useState(null);
  const [selectedTripWaybill, setSelectedTripWaybill] = useState(null);
  const [selectedTripReplay, setSelectedTripReplay] = useState(null);
  const [selectedTrip3D, setSelectedTrip3D] = useState(null);

  const filteredTrips = trips.filter(item => {
    const matchSearch = searchText === '' ||
      item.id.toLowerCase().includes(searchText.toLowerCase()) ||
      item.plate.toLowerCase().includes(searchText.toLowerCase()) ||
      item.driver_name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.customer.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = filterStatus === 'ALL' ||
      (filterStatus === 'LATE_RISK' ? item.is_late_risk : item.status === filterStatus);
    return matchSearch && matchStatus;
  });

  const columns = [
    {
      title: 'Mã chuyến & Đội xe',
      key: 'trip_truck',
      width: '26%',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-bold text-[#7367f0] text-xs font-mono cursor-pointer hover:underline"
              onClick={() => setSelectedTripDetails(r)}
            >
              {r.id}
            </span>
            {r.is_late_risk && (
              <Tag color="error" className="text-[10px] m-0 px-1.5 py-0 flex items-center gap-1">
                <AlertTriangle size={10} /> Trễ hẹn
              </Tag>
            )}
            <Tag color={r.status === 'COMPLETED' ? 'green' : 'blue'} className="text-[10px] m-0 px-1.5 py-0">
              {r.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang chạy'}
            </Tag>
          </div>
          <div className="text-xs font-semibold text-gray-800 mt-1 flex items-center gap-1.5">
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded border text-[11px]">{r.plate}</span>
            <span className="text-gray-500 text-[11px]">({r.truck_model})</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
            <User size={11} className="text-gray-400" />
            <span>{r.driver_name} - {r.driver_phone}</span>
          </div>
        </div>
      )
    },
    {
      title: 'Lộ trình & Khách hàng',
      key: 'route_customer',
      width: '28%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-800">{r.customer}</div>
          <div className="text-gray-600 mt-1 flex items-center gap-1">
            <MapPin size={12} className="text-blue-500 shrink-0" />
            <span className="truncate">{r.pickup}</span>
          </div>
          <div className="text-gray-600 mt-0.5 flex items-center gap-1">
            <ArrowRight size={12} className="text-emerald-500 shrink-0" />
            <span className="truncate">{r.dropoff}</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-mono mt-0.5">
            Đơn trên chuyến: {r.orders.join(', ')}
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
          <Progress percent={r.progress} size="small" status={r.is_late_risk ? 'exception' : 'active'} />
          {r.is_late_risk && (
            <div className="text-[11px] text-red-600 font-medium">
              Cảnh báo: {r.late_reason}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Hồ sơ & Công cụ Điều phối',
      key: 'actions',
      width: '24%',
      render: (_, record) => (
        <Space size="small" wrap>
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
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Route size={22} className="text-[#7367f0]" />
            Kế hoạch & Giám sát Chuyến xe
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Giám sát lộ trình thời gian thực, tiến độ các điểm dừng, sơ đồ xếp hàng và xuất vận đơn vận chuyển.
          </p>
        </div>
      </div>

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
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-red-600 flex items-center gap-1 font-semibold">
              <AlertTriangle size={13} /> Nguy cơ trễ hẹn (Late-risk)
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1 font-mono">
              {trips.filter(t => t.is_late_risk).length}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-gray-500">Hoàn thành hôm nay</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              {trips.filter(t => t.status === 'COMPLETED').length}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
            <div className="text-xs text-gray-500">Tỷ lệ đúng giờ (On-time)</div>
            <div className="text-2xl font-bold text-gray-800 mt-1 font-mono">94.2%</div>
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card className="shadow-xs border-gray-100 rounded-xl" styles={{ body: { padding: '16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={12}>
            <Input
              placeholder="Tìm theo mã chuyến, biển số xe, tài xế, khách hàng..."
              prefix={<Search size={15} className="text-gray-400" />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="rounded-lg text-xs"
            />
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Select
              className="w-full text-xs"
              value={filterStatus}
              onChange={setFilterStatus}
            >
              <Option value="ALL">Tất cả trạng thái chuyến</Option>
              <Option value="IN_TRANSIT">Đang vận chuyển</Option>
              <Option value="LATE_RISK">Có nguy cơ trễ hẹn</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={filteredTrips}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Modal 1: Chi tiết Chuyến xe (Screen 13 - Trip Details) */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <Route size={20} className="text-[#7367f0]" />
            <div>
              <span className="font-bold text-gray-800 text-base">Hồ sơ Chi tiết chuyến xe: {selectedTripDetails?.id}</span>
              <p className="text-xs text-gray-400 font-normal">Biển số: {selectedTripDetails?.plate} | Tài xế: {selectedTripDetails?.driver_name}</p>
            </div>
          </div>
        }
        open={!!selectedTripDetails}
        onClose={() => setSelectedTripDetails(null)}
        size={680}
      >
        {selectedTripDetails && (
          <div className="space-y-5 text-xs">
            {/* Thẻ trạng thái */}
            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700 text-sm">Trạng thái:</span>
                <Tag color={selectedTripDetails.status === 'COMPLETED' ? 'green' : 'blue'} className="font-bold text-xs px-2.5 py-0.5 rounded-full">
                  {selectedTripDetails.status === 'COMPLETED' ? 'ĐÃ HOÀN THÀNH' : 'ĐANG VẬN CHUYỂN'}
                </Tag>
              </div>
              <div className="grid grid-cols-2 gap-2 text-gray-600 pt-2 border-t border-indigo-100">
                <div>Khách hàng: <b>{selectedTripDetails.customer}</b></div>
                <div>Đơn hàng: <b className="font-mono text-indigo-700">{selectedTripDetails.orders.join(', ')}</b></div>
                <div>Số niêm phong chì (Seal): <b className="font-mono text-emerald-700">{selectedTripDetails.seal_number}</b></div>
                <div>Xe phụ trách: <b>{selectedTripDetails.truck_model}</b></div>
              </div>
            </div>

            {/* Các điểm dừng & Sự kiện (Stops & Events) */}
            <div>
              <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
                <Clock size={16} className="text-[#7367f0]" />
                Lịch trình các điểm dừng & Sự kiện chặng
              </h3>
              <div className="space-y-3">
                {selectedTripDetails.stops.map((stop, index) => (
                  <div key={stop.id} className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-[#7367f0] font-bold flex items-center justify-center shrink-0 text-xs">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 text-xs">{stop.name}</span>
                        <Tag color={stop.type === 'PICKUP' ? 'blue' : stop.type === 'REST' ? 'orange' : 'green'} className="text-[10px] m-0">
                          {stop.type}
                        </Tag>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 text-gray-600 text-[11px]">
                        <div>Kế hoạch: <b className="font-mono">{stop.planned}</b></div>
                        <div>Thực tế: <b className="font-mono text-indigo-600">{stop.actual}</b></div>
                      </div>
                      <div className="mt-1 text-gray-500 text-[11px] bg-gray-50 p-1.5 rounded">
                        Sự kiện: <b>{stop.event}</b> — {stop.note}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chứng cứ giao nhận */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-800 mb-2">Ảnh chứng chỉ niêm phong & Biên bản giao nhận:</h4>
              <div className="flex items-center gap-4">
                <div className="text-center p-3 bg-white rounded-lg border border-dashed text-gray-500">
                  <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1" />
                  <span>Ảnh chì nguyên seal</span>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-dashed text-gray-500">
                  <CheckCircle2 size={24} className="text-blue-500 mx-auto mb-1" />
                  <span>Biên bản POD có chữ ký</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal 2: Hồ sơ Chuyến xe & Vận đơn */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Printer size={20} className="text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-gray-800">Lệnh điều xe & Vận đơn vận chuyển</h3>
              <p className="text-xs text-gray-500 font-normal">Xuất bản Vận đơn giao cho tài xế và phòng kế toán</p>
            </div>
          </div>
        }
        open={!!selectedTripWaybill}
        onCancel={() => setSelectedTripWaybill(null)}
        width={750}
        footer={[
          <Button key="close" onClick={() => setSelectedTripWaybill(null)}>Đóng</Button>,
          <Button
            key="print"
            type="primary"
            icon={<Download size={15} />}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              message.success(`Đã xuất Vận đơn [WB-${selectedTripWaybill?.id}] thành file PDF!`);
              setSelectedTripWaybill(null);
            }}
          >
            Tải về Vận đơn PDF
          </Button>
        ]}
      >
        {selectedTripWaybill && (
          <div className="p-6 bg-white border border-gray-200 rounded-xl font-sans text-xs space-y-4 my-2 shadow-xs">
            <div className="text-center border-b pb-3">
              <h2 className="text-base font-black text-gray-800 uppercase tracking-wide">CÔNG TY CỔ PHẦN LOGISTICS THÔNG MINH NEXLOG</h2>
              <h3 className="text-sm font-bold text-[#7367f0] mt-1">LỆNH ĐIỀU XE & VẬN ĐƠN VẬN TẢI</h3>
              <p className="text-gray-400 font-mono text-[11px]">Số vận đơn: WB-{selectedTripWaybill.id} | Ngày phát hành: 13/10/2026</p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
              <div>
                <p>Xe vận tải: <b className="font-mono">{selectedTripWaybill.plate}</b></p>
                <p>Dòng xe: <b>{selectedTripWaybill.truck_model}</b></p>
                <p>Khách hàng: <b>{selectedTripWaybill.customer}</b></p>
              </div>
              <div>
                <p>Tài xế chính: <b>{selectedTripWaybill.driver_name}</b></p>
                <p>Số điện thoại: <b className="font-mono">{selectedTripWaybill.driver_phone}</b></p>
                <p>Số niêm phong chì: <b className="font-mono text-emerald-700">{selectedTripWaybill.seal_number}</b></p>
              </div>
            </div>

            <table className="w-full border-collapse border border-gray-200 text-left">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="p-2 border border-gray-200">Điểm lấy hàng</th>
                  <th className="p-2 border border-gray-200">Điểm trả hàng</th>
                  <th className="p-2 border border-gray-200">Đơn hàng liên kết</th>
                  <th className="p-2 border border-gray-200">Giờ xuất phát</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-gray-200">{selectedTripWaybill.pickup}</td>
                  <td className="p-2 border border-gray-200">{selectedTripWaybill.dropoff}</td>
                  <td className="p-2 border border-gray-200 font-mono">{selectedTripWaybill.orders.join(', ')}</td>
                  <td className="p-2 border border-gray-200 font-mono">{selectedTripWaybill.planned_start}</td>
                </tr>
              </tbody>
            </table>

            <div className="pt-6 grid grid-cols-3 text-center text-gray-600">
              <div>
                <p className="font-bold">ĐIỀU PHỐI VIÊN</p>
                <p className="text-[11px] text-gray-400 mt-1">(Ký & ghi rõ họ tên)</p>
                <p className="mt-8 font-semibold text-gray-800">Hoàng Minh Chính</p>
              </div>
              <div>
                <p className="font-bold">TÀI XẾ NHẬN LỆNH</p>
                <p className="text-[11px] text-gray-400 mt-1">(Ký & ghi rõ họ tên)</p>
                <p className="mt-8 font-semibold text-gray-800">{selectedTripWaybill.driver_name}</p>
              </div>
              <div>
                <p className="font-bold">NGƯỜI NHẬN HÀNG</p>
                <p className="text-[11px] text-gray-400 mt-1">(Ký khi giao hàng)</p>
                <p className="mt-8 font-semibold text-gray-400">Chờ ký tại kho</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 3: Sơ đồ Xếp thùng 3D */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Box size={20} className="text-[#7367f0]" />
            <div>
              <h3 className="text-base font-bold text-gray-800">Mô phỏng Sơ đồ Xếp thùng 3D</h3>
              <p className="text-xs text-gray-500 font-normal">Xếp dỡ theo nguyên tắc LIFO (kiện giao chặng cuối xếp sâu nhất)</p>
            </div>
          </div>
        }
        open={!!selectedTrip3D}
        onCancel={() => setSelectedTrip3D(null)}
        width={750}
        footer={[<Button key="close" onClick={() => setSelectedTrip3D(null)}>Đóng</Button>]}
      >
        {selectedTrip3D && (
          <div className="py-2 space-y-4 text-xs">
            <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl shadow-inner relative overflow-hidden h-64 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-cyan-300">Xe: {selectedTrip3D.plate} ({selectedTrip3D.truck_model})</span>
                <span className="bg-indigo-600/80 px-2.5 py-1 rounded text-[11px]">Dung tích tải: 82%</span>
              </div>

              {/* Mô phỏng không gian thùng xe 3D */}
              <div className="flex-1 flex items-center justify-center gap-3 px-6 py-4">
                <div className="w-28 h-32 bg-indigo-500/30 border-2 border-indigo-400 rounded-lg flex flex-col items-center justify-center p-2 text-center text-indigo-200">
                  <span className="text-[10px] font-bold uppercase">Khoang sâu nhất (Cabin)</span>
                  <span className="text-xs font-bold text-white mt-1">Đơn hàng #2</span>
                  <span className="text-[10px] text-gray-300">Điểm giao cuối</span>
                </div>
                <div className="w-28 h-32 bg-cyan-500/30 border-2 border-cyan-400 rounded-lg flex flex-col items-center justify-center p-2 text-center text-cyan-200">
                  <span className="text-[10px] font-bold uppercase">Khoang giữa</span>
                  <span className="text-xs font-bold text-white mt-1">Đơn hàng #1</span>
                  <span className="text-[10px] text-gray-300">Kiện phụ trợ</span>
                </div>
                <div className="w-28 h-32 bg-emerald-500/30 border-2 border-emerald-400 rounded-lg flex flex-col items-center justify-center p-2 text-center text-emerald-200">
                  <span className="text-[10px] font-bold uppercase">Cửa sau (Door)</span>
                  <span className="text-xs font-bold text-white mt-1">Dỡ đầu tiên</span>
                  <span className="text-[10px] text-gray-300">LIFO Priority</span>
                </div>
              </div>

              <div className="text-[11px] text-gray-400 text-center">
                ← Đầu xe (Cabin) ────────────────────────────────── Cửa sau thùng xe (Tailgate) →
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-gray-800">Quy tắc tải trọng:</span>
                <p className="text-gray-500 text-[11px] mt-0.5">Hàng giao ở chặng đầu tiên được xếp gần cửa xe để thuận tiện bốc dỡ không cần di dời kiện khác.</p>
              </div>
              <Tag color="success" className="font-semibold px-2 py-1">Đạt chuẩn an toàn</Tag>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 4: Xem lại hành trình */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <PlayCircle size={20} className="text-amber-600" />
            <div>
              <h3 className="text-base font-bold text-gray-800">Xem lại Hành trình GPS Chuyến xe</h3>
              <p className="text-xs text-gray-500 font-normal">Đối chiếu vết chạy GPS thực tế với kế hoạch lộ trình</p>
            </div>
          </div>
        }
        open={!!selectedTripReplay}
        onCancel={() => setSelectedTripReplay(null)}
        width={750}
        footer={[<Button key="close" onClick={() => setSelectedTripReplay(null)}>Đóng</Button>]}
      >
        {selectedTripReplay && (
          <div className="py-2 space-y-4 text-xs">
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-amber-900">Chuyến xe: {selectedTripReplay.id} ({selectedTripReplay.plate})</span>
                <p className="text-amber-700 text-[11px] mt-0.5">Tài xế: {selectedTripReplay.driver_name} | Tuyến: {selectedTripReplay.pickup} → {selectedTripReplay.dropoff}</p>
              </div>
              <Button type="primary" icon={<PlayCircle size={15} />} className="bg-amber-600 hover:bg-amber-700">
                Phát lại (Play GPS)
              </Button>
            </div>

            {/* Thanh tiến trình Replay */}
            <div className="space-y-1">
              <div className="flex justify-between text-gray-500 font-mono text-[11px]">
                <span>Xuất bến: {selectedTripReplay.actual_start || selectedTripReplay.planned_start}</span>
                <span>Hiện tại: 65% quãng đường</span>
                <span>Về đích dự kiến: {selectedTripReplay.planned_finish}</span>
              </div>
              <Progress percent={65} strokeColor="#d97706" />
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="font-bold text-gray-700 block mb-1">Mốc ghi nhận GPS trên hành trình:</span>
              <ul className="space-y-1 text-gray-600 list-disc pl-4 text-[11px]">
                <li>08:42 - Xe rời kho ALS Cảng HKQT Nội Bài (Tốc độ 45 km/h).</li>
                <li>09:15 - Di chuyển qua cầu Đông Trù hướng QL5 kéo dài (Tốc độ 58 km/h).</li>
                <li>09:35 - Nghỉ tại Trạm dừng nghỉ Km12 (Thời gian dừng: 12 phút).</li>
                <li>10:05 - Tắc đường cục bộ tại nút giao Phù Đổng (Vận tốc 12 km/h - Cảnh báo trễ hẹn).</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
