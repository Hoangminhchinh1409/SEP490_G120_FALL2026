import { useState } from 'react';
import { Table, Tag, Button, Input, DatePicker, Select, Row, Col } from 'antd';
import { Search, Plus, Filter, Download, Edit, Trash2 } from 'lucide-react';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';

const { RangePicker } = DatePicker;

// Mock Data
const mockOrders = [
  { key: '1', order_id: 'NEX-827364', customer: 'VinFast LLC', type: 'Vận tải nội địa', pickup: 'Nội Bài', dropoff: 'Hữu Nghị', status: 'CREATED', date: '2026-09-23' },
  { key: '2', order_id: 'NEX-827365', customer: 'Samsung VN', type: 'Container lạnh', pickup: 'Yên Phong', dropoff: 'Nội Bài', status: 'VEHICLE_ASSIGNED', date: '2026-09-23' },
  { key: '3', order_id: 'NEX-827366', customer: 'Foxconn', type: 'Hàng siêu trường', pickup: 'Gia Lâm', dropoff: 'Hải Phòng', status: 'IN_TRANSIT', date: '2026-09-23' },
  { key: '4', order_id: 'NEX-827367', customer: 'LG Electronics', type: 'Vận tải đường bộ', pickup: 'Hải Phòng', dropoff: 'Hà Nội', status: 'DELIVERED', date: '2026-09-22' },
  { key: '5', order_id: 'NEX-827368', customer: 'Hoa Sen Group', type: 'Vận tải biển', pickup: 'Quy Nhơn', dropoff: 'Vũng Tàu', status: 'INCIDENT', date: '2026-09-21' },
];

const statusColors = {
  'CREATED': 'blue', 'CONFIRMED': 'cyan', 'VEHICLE_ASSIGNED': 'orange',
  'CARGO_PICKED_UP': 'magenta', 'IN_TRANSIT': 'purple', 'DELIVERED': 'green', 'INCIDENT': 'red'
};

const OrderManagement = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState(mockOrders);

  const columns = [
    { title: 'Mã Vận Đơn', dataIndex: 'order_id', key: 'order_id', render: (text) => <span className="font-semibold text-[#7367f0]">{text}</span> },
    { title: 'Khách hàng', dataIndex: 'customer', key: 'customer', render: text => <span className="font-medium text-gray-700">{text}</span> },
    { title: 'Loại dịch vụ', dataIndex: 'type', key: 'type' },
    { title: 'Điểm lấy hàng', dataIndex: 'pickup', key: 'pickup' },
    { title: 'Điểm giao hàng', dataIndex: 'dropoff', key: 'dropoff' },
    { title: 'Ngày tạo', dataIndex: 'date', key: 'date' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status) => <Tag color={statusColors[status] || 'default'} className="font-medium rounded-md px-2 py-1">{status}</Tag> },
    { title: 'Hành động', key: 'action', render: () => (
      <div className="flex gap-2">
        <Button size="small" type="text" className="text-gray-500 hover:text-[#7367f0] p-1"><Edit size={16} /></Button>
        <Button size="small" type="text" className="text-gray-500 hover:text-red-500 p-1"><Trash2 size={16} /></Button>
      </div>
    )}
  ];

  return (
    <div className="p-6 md:p-8 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header Action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng</h1>
            <p className="text-gray-500 text-sm">Quản lý chi tiết toàn bộ các đơn hàng vận tải trong hệ thống</p>
          </div>
          <Button type="primary" icon={<Plus size={16} />} className="bg-[#7367f0] hover:bg-[#5e50ee] h-10 px-4" onClick={() => setIsModalOpen(true)}>
            Tạo đơn hàng mới
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <Row gutter={[16, 16]} className="items-end">
            <Col xs={24} md={6}>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Tìm kiếm</p>
              <Input placeholder="Mã đơn, Tên khách hàng..." prefix={<Search size={16} className="text-gray-400" />} />
            </Col>
            <Col xs={24} md={5}>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Trạng thái</p>
              <Select defaultValue="all" className="w-full" options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'CREATED', label: 'Mới tạo' },
                { value: 'IN_TRANSIT', label: 'Đang giao' },
                { value: 'DELIVERED', label: 'Đã giao' },
              ]} />
            </Col>
            <Col xs={24} md={7}>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Khoảng thời gian</p>
              <RangePicker className="w-full" />
            </Col>
            <Col xs={24} md={6} className="flex gap-2">
              <Button icon={<Filter size={16} />} className="flex-1">Lọc</Button>
              <Button icon={<Download size={16} />} className="flex-1">Xuất Excel</Button>
            </Col>
          </Row>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <Table 
            columns={columns} 
            dataSource={data} 
            pagination={{ pageSize: 10 }} 
            className="ant-table-striped custom-table p-4"
          />
        </div>

      </div>
      <OrderFormModal open={isModalOpen} onCancel={() => setIsModalOpen(false)} onSubmit={() => setIsModalOpen(false)} />
    </div>
  );
};

export default OrderManagement;
