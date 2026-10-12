import { useState } from 'react';
import { Table, Tag, Button, Input, DatePicker, Select, Row, Col, message, Badge, Tooltip } from 'antd';
import { Search, Plus, Download, Eye, Sparkles, Truck } from 'lucide-react';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';
import OrderDetailsModal from '../../components/dispatcher/OrderDetailsModal';
import DocumentAssistantDrawer from '../../components/dispatcher/DocumentAssistantDrawer';
import TripAssignmentModal from '../../components/dispatcher/TripAssignmentModal';

const { RangePicker } = DatePicker;

// Dữ liệu đơn hàng mẫu khởi tạo bao gồm đơn ADTEK và Lô 2
const initialOrders = [
  { 
    key: '1', 
    order_id: 'NEX-827364', 
    hawb_code: 'HNAE25090222',
    customer: 'ADTEK (VIET NAM) COMPANY LIMITED', 
    pickup: 'KCN Tiên Sơn, Bắc Ninh', 
    dropoff: 'Kho Apex - Sân bay Nội Bài', 
    status: 'READY_FOR_PLANNING', 
    package_count: 18,
    package_unit: 'Pallet',
    weight: 2850,
    chargeable: 2850,
    agreed_price: 6500000,
    extra_fees_surcharge: 450000,
    extra_fees_collection: 1200000,
    order_notes: 'LƯU Ý: OP tại sân bay kiểm tra seal chì thùng xe trước khi dỡ hàng. Chụp ảnh SOP đầy đủ.',
    date: '2026-10-12 08:30' 
  },
  { 
    key: '2', 
    order_id: 'NEX-827365', 
    hawb_code: 'SLVN-2026-HQ7N',
    customer: 'CÔNG TY TNHH ÂM THANH ÁNH SÁNG SLVN', 
    pickup: 'Kho ALS Cảng HKQT Nội Bài', 
    dropoff: 'CCN Lai Xá, Hoài Đức, Hà Nội', 
    status: 'CONFIRMED', 
    package_count: 42,
    package_unit: 'Kiện thùng gỗ',
    weight: 1850,
    chargeable: 2160,
    agreed_price: 5200000,
    extra_fees_surcharge: 300000,
    extra_fees_collection: 2450000,
    order_notes: 'Hàng thiết bị âm thanh ánh sáng nhập khẩu (Lô 2). Cần đối chiếu Tờ khai HQ 108187779340.',
    date: '2026-10-12 09:15' 
  },
  { 
    key: '3', 
    order_id: 'NEX-827366', 
    hawb_code: 'SAM-VN-9921',
    customer: 'Samsung Electronics VN', 
    pickup: 'Yên Phong, Bắc Ninh', 
    dropoff: 'Kho ALS Cảng Nội Bài', 
    status: 'ASSIGNED', 
    package_count: 12,
    package_unit: 'Pallet',
    weight: 1200,
    chargeable: 1200,
    agreed_price: 4200000,
    date: '2026-10-12 10:00' 
  },
  { 
    key: '4', 
    order_id: 'NEX-827367', 
    hawb_code: 'FOX-GL-4412',
    customer: 'Foxconn Bắc Giang', 
    pickup: 'KCN Quang Châu, Bắc Giang', 
    dropoff: 'Cảng Hải Phòng', 
    status: 'IN_TRANSIT', 
    package_count: 30,
    package_unit: 'Pallet',
    weight: 4500,
    chargeable: 4500,
    agreed_price: 8900000,
    date: '2026-10-11 14:00' 
  },
  { 
    key: '5', 
    order_id: 'NEX-827368', 
    hawb_code: 'VIN-HP-1122',
    customer: 'VinFast Hải Phòng', 
    pickup: 'Cát Hải, Hải Phòng', 
    dropoff: 'Khu CNC Hòa Lạc, Hà Nội', 
    status: 'DRAFT', 
    package_count: 8,
    package_unit: 'Kiện',
    weight: 850,
    chargeable: 920,
    agreed_price: 3500000,
    date: '2026-10-12 11:20' 
  }
];

const statusColors = {
  'DRAFT': 'default',
  'CONFIRMED': 'blue', 
  'READY_FOR_PLANNING': 'cyan', 
  'ASSIGNED': 'orange',
  'IN_TRANSIT': 'purple', 
  'DELIVERED': 'green', 
  'CANCELLED': 'red'
};

const OrderManagement = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState(null);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);

  const handleCreateOrder = (values) => {
    const newOrder = {
      key: Date.now().toString(),
      order_id: `NEX-${Math.floor(100000 + Math.random() * 900000)}`,
      hawb_code: values.hawb_code || 'HAWB-AUTO',
      customer: values.customer_name,
      pickup: values.pickup_address,
      dropoff: values.delivery_address,
      package_count: values.package_count || 1,
      package_unit: values.package_unit || 'Pallet',
      weight: values.weight_kg,
      chargeable: values.chargeable_weight,
      agreed_price: values.agreed_price,
      extra_fees_surcharge: values.extra_fees_surcharge || 0,
      extra_fees_collection: values.extra_fees_collection || 0,
      order_notes: values.order_notes,
      status: 'DRAFT',
      date: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    setOrders([newOrder, ...orders]);
    setIsCreateModalOpen(false);
    message.success(`Đã tạo thành công đơn hàng nháp: ${newOrder.order_id}!`);
  };

  const handleUpdateOrder = (updatedOrder) => {
    setOrders(prev => prev.map(o => o.key === updatedOrder.key ? updatedOrder : o));
    setSelectedOrderForDetails(updatedOrder);
  };

  const handleAssignSuccess = (assignedOrder) => {
    setOrders(prev => prev.map(o => o.key === assignedOrder.key ? assignedOrder : o));
  };

  // Filter logic
  const filteredData = orders.filter(item => {
    const matchSearch = filterText === '' || 
      item.order_id.toLowerCase().includes(filterText.toLowerCase()) ||
      item.customer.toLowerCase().includes(filterText.toLowerCase()) ||
      (item.hawb_code && item.hawb_code.toLowerCase().includes(filterText.toLowerCase()));
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const columns = [
    { 
      title: 'Mã Đơn / HAWB', 
      key: 'order_id', 
      render: (_, record) => (
        <div>
          <span className="font-bold text-[#7367f0] block cursor-pointer hover:underline" onClick={() => setSelectedOrderForDetails(record)}>
            {record.order_id}
          </span>
          <span className="text-[11px] font-mono text-gray-400 block">HAWB: {record.hawb_code}</span>
        </div>
      )
    },
    { 
      title: 'Khách hàng', 
      dataIndex: 'customer', 
      key: 'customer', 
      render: text => <span className="font-medium text-gray-800 text-xs">{text}</span> 
    },
    { 
      title: 'Quy cách & Tải trọng', 
      key: 'specs',
      render: (_, record) => (
        <div className="text-xs">
          <div>{record.package_count} {record.package_unit}</div>
          <div className="text-gray-400 text-[11px]">
            Thực: {record.weight}kg | <span className="font-semibold text-amber-600">Cước: {record.chargeable}kg</span>
          </div>
        </div>
      )
    },
    { 
      title: 'Hành lang Vận chuyển', 
      key: 'route', 
      render: (_, record) => (
        <div className="text-xs max-w-[200px] truncate">
          <div className="truncate"><span className="text-blue-600 font-semibold">Từ:</span> {record.pickup}</div>
          <div className="truncate"><span className="text-emerald-600 font-semibold">Đến:</span> {record.dropoff}</div>
        </div>
      )
    },
    { 
      title: 'Giá chốt (Agreed Price)', 
      dataIndex: 'agreed_price', 
      key: 'agreed_price',
      render: val => <span className="font-bold text-gray-800 text-xs">{val ? val.toLocaleString() + ' đ' : 'Chưa chốt'}</span>
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status', 
      render: (status) => (
        <Tag color={statusColors[status] || 'default'} className="font-semibold text-[11px] rounded-md px-2 py-0.5">
          {status}
        </Tag>
      )
    },
    { 
      title: 'Thao tác Nghiệp vụ', 
      key: 'action', 
      render: (_, record) => (
        <div className="flex items-center gap-1.5">
          <Tooltip title="Xem chi tiết & kiểm duyệt chứng từ">
            <Button 
              size="small" 
              icon={<Eye size={14} />} 
              className="text-gray-600 hover:text-[#7367f0]"
              onClick={() => setSelectedOrderForDetails(record)}
            >
              Hồ sơ
            </Button>
          </Tooltip>

          {record.status === 'READY_FOR_PLANNING' && (
            <Tooltip title="Lập kế hoạch & Gán xe">
              <Button 
                size="small" 
                type="primary" 
                icon={<Truck size={14} />}
                className="bg-[#7367f0] hover:bg-[#5e50ee]"
                onClick={() => setSelectedOrderForAssign(record)}
              >
                Gán xe
              </Button>
            </Tooltip>
          )}

          {record.status === 'DRAFT' && (
            <Tooltip title="Mở chi tiết để tải Hợp đồng & Xác nhận">
              <Button 
                size="small" 
                type="primary" 
                ghost
                onClick={() => setSelectedOrderForDetails(record)}
              >
                Xác nhận
              </Button>
            </Tooltip>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 md:p-8 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header Action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng & Hồ sơ Vận tải</h1>
              <Badge count={orders.filter(o => o.status === 'READY_FOR_PLANNING').length} overflowCount={99} title="Đơn sẵn sàng xếp chuyến">
                <Tag color="cyan" className="font-semibold ml-1">Ready: {orders.filter(o => o.status === 'READY_FOR_PLANNING').length}</Tag>
              </Badge>
            </div>
            <p className="text-gray-500 text-sm">
              Tiếp nhận đơn, chốt giá thỏa thuận, kiểm duyệt chứng từ hải quan và gán xe nội bộ/vendor
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              icon={<Sparkles size={16} className="text-purple-600" />} 
              className="h-10 px-3.5 border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100"
              onClick={() => setIsAIDrawerOpen(true)}
            >
              Trợ lý AI Gemini
            </Button>

            <Button 
              type="primary" 
              icon={<Plus size={16} />} 
              className="bg-[#7367f0] hover:bg-[#5e50ee] h-10 px-4 font-semibold" 
              onClick={() => setIsCreateModalOpen(true)}
            >
              Tạo Đơn Hàng Mới (Order Intake)
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <Row gutter={[16, 16]} className="items-end">
            <Col xs={24} md={8}>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase">Tìm kiếm Đơn hàng</p>
              <Input 
                placeholder="Mã đơn (NEX-...), Mã HAWB (HNAE...), Khách hàng..." 
                prefix={<Search size={16} className="text-gray-400" />} 
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} md={6}>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase">Trạng thái Vận hành</p>
              <Select 
                value={filterStatus} 
                onChange={setFilterStatus} 
                className="w-full" 
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'DRAFT', label: 'Đơn nháp (Draft)' },
                  { value: 'CONFIRMED', label: 'Đã xác nhận (Confirmed)' },
                  { value: 'READY_FOR_PLANNING', label: 'Sẵn sàng xếp xe (Ready for Planning)' },
                  { value: 'ASSIGNED', label: 'Đã gán xe/tài xế (Assigned)' },
                  { value: 'IN_TRANSIT', label: 'Đang vận chuyển (In Transit)' },
                  { value: 'DELIVERED', label: 'Đã giao hàng (Delivered)' },
                ]} 
              />
            </Col>
            <Col xs={24} md={6}>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase">Khoảng thời gian tạo</p>
              <RangePicker className="w-full" />
            </Col>
            <Col xs={24} md={4} className="flex gap-2">
              <Button icon={<Download size={16} />} className="w-full" onClick={() => message.info('Đang xuất bảng kê đơn hàng ra Excel...')}>
                Xuất Excel
              </Button>
            </Col>
          </Row>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <Table 
            columns={columns} 
            dataSource={filteredData} 
            pagination={{ pageSize: 8 }} 
            className="custom-table"
          />
        </div>

      </div>

      {/* Modal Tạo Đơn Hàng Mới */}
      <OrderFormModal 
        open={isCreateModalOpen} 
        onCancel={() => setIsCreateModalOpen(false)} 
        onSubmit={handleCreateOrder} 
      />

      {/* Modal Chi Tiết Hồ Sơ Đơn Hàng & Duyệt Chứng Từ */}
      <OrderDetailsModal
        open={Boolean(selectedOrderForDetails)}
        order={selectedOrderForDetails}
        onCancel={() => setSelectedOrderForDetails(null)}
        onUpdateOrder={handleUpdateOrder}
      />

      {/* Modal Gán Xe & Tài Xế Nội Bộ / Vendor */}
      <TripAssignmentModal
        open={Boolean(selectedOrderForAssign)}
        order={selectedOrderForAssign}
        onCancel={() => setSelectedOrderForAssign(null)}
        onAssignSuccess={handleAssignSuccess}
      />

      {/* Drawer Trợ Lý AI Gemini Gợi Ý Chứng Từ */}
      <DocumentAssistantDrawer
        open={isAIDrawerOpen}
        onClose={() => setIsAIDrawerOpen(false)}
        onApplyRecommendations={() => {
          message.success('Danh mục chứng từ chuẩn đã được kích hoạt cho các đơn mới!');
        }}
      />
    </div>
  );
};

export default OrderManagement;
