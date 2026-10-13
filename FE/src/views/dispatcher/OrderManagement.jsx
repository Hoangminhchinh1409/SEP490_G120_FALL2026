import { useState, useEffect } from 'react';
import { Table, Tag, Button, Input, DatePicker, Select, Row, Col, message, Badge, Tooltip } from 'antd';
import { Search, Plus, Download, Eye, Sparkles, Truck, PhoneCall, Globe, CheckCircle2 } from 'lucide-react';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';
import OrderDetailsModal from '../../components/dispatcher/OrderDetailsModal';
import DocumentAssistantDrawer from '../../components/dispatcher/DocumentAssistantDrawer';
import TripAssignmentModal from '../../components/dispatcher/TripAssignmentModal';
import { getStoredOrders, saveStoredOrders } from '../../data/orderStore';

const { RangePicker } = DatePicker;

const statusColors = {
  'DRAFT': 'default',
  'CONFIRMED': 'blue', 
  'READY_FOR_PLANNING': 'cyan', 
  'ASSIGNED': 'orange',
  'IN_TRANSIT': 'purple', 
  'DELIVERED': 'green', 
  'CANCELLED': 'red'
};

const statusLabels = {
  'DRAFT': 'Đơn nháp',
  'CONFIRMED': 'Đã xác nhận',
  'READY_FOR_PLANNING': 'Sẵn sàng xếp xe',
  'ASSIGNED': 'Đã gán xe',
  'IN_TRANSIT': 'Đang vận chuyển',
  'DELIVERED': 'Đã giao hàng',
  'CANCELLED': 'Đã hủy'
};

const OrderManagement = () => {
  const [orders, setOrders] = useState(() => getStoredOrders());
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState(null);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);

  // Lắng nghe thay đổi dữ liệu từ các tab khác hoặc từ Homepage
  useEffect(() => {
    const handleStorageChange = () => {
      setOrders(getStoredOrders());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('nexlog_orders_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('nexlog_orders_updated', handleStorageChange);
    };
  }, []);

  const handleCreateOrder = (values) => {
    const newOrder = {
      key: Date.now().toString(),
      order_id: `NEX-${Math.floor(100000 + Math.random() * 900000)}`,
      hawb_code: values.hawb_code || 'HAWB-AUTO',
      customer: values.customer_name,
      customer_phone: values.customer_phone || '',
      customer_email: values.customer_email || '',
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
      source: values.source || 'HOTLINE', // Cách 1: Khách liên hệ trực tiếp
      status: values.status || 'READY_FOR_PLANNING',
      date: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    const updated = [newOrder, ...orders];
    setOrders(updated);
    saveStoredOrders(updated);
    window.dispatchEvent(new Event('nexlog_orders_updated'));
    setIsCreateModalOpen(false);
    message.success(`Đã tạo thành công đơn hàng: ${newOrder.order_id}!`);
  };

  const handleUpdateOrder = (updatedOrder) => {
    const updated = orders.map(o => o.key === updatedOrder.key ? updatedOrder : o);
    setOrders(updated);
    saveStoredOrders(updated);
    window.dispatchEvent(new Event('nexlog_orders_updated'));
    setSelectedOrderForDetails(updatedOrder);
  };

  const handleAssignSuccess = (assignedOrder) => {
    const updated = orders.map(o => o.key === assignedOrder.key ? assignedOrder : o);
    setOrders(updated);
    saveStoredOrders(updated);
    window.dispatchEvent(new Event('nexlog_orders_updated'));
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
      title: 'Đơn hàng & Khách hàng', 
      key: 'order_customer', 
      width: '26%',
      render: (_, record) => (
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span 
              className="font-bold text-[#7367f0] cursor-pointer hover:underline text-xs" 
              onClick={() => setSelectedOrderForDetails(record)}
            >
              {record.order_id}
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              HAWB: {record.hawb_code}
            </span>
            {record.source === 'HOMEPAGE' ? (
              <Tag color="orange" className="text-[10px] px-1.5 py-0 rounded font-semibold border-amber-300 bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                <Globe size={10} /> Web - Chờ tư vấn
              </Tag>
            ) : (
              <Tag color="processing" className="text-[10px] px-1.5 py-0 rounded font-semibold border-blue-200 bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                <PhoneCall size={10} /> Hotline / Trực tiếp
              </Tag>
            )}
          </div>
          <div className="font-semibold text-gray-800 text-xs mt-1 leading-snug">
            {record.customer}
          </div>
        </div>
      )
    },
    { 
      title: 'Tuyến đường', 
      key: 'route', 
      width: '26%',
      render: (_, record) => (
        <div className="text-xs space-y-1">
          <div className="text-gray-700 leading-snug">
            <span className="text-blue-600 font-bold mr-1">Lấy:</span>
            <span>{record.pickup}</span>
          </div>
          <div className="text-gray-700 leading-snug">
            <span className="text-emerald-600 font-bold mr-1">Giao:</span>
            <span>{record.dropoff}</span>
          </div>
        </div>
      )
    },
    { 
      title: 'Hàng hóa & Tải trọng', 
      key: 'specs', 
      width: '16%',
      render: (_, record) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-800">{record.package_count} {record.package_unit}</div>
          <div className="text-gray-400 text-[11px] mt-0.5">
            Thực: {record.weight}kg | <span className="font-bold text-amber-600">Cước: {record.chargeable}kg</span>
          </div>
        </div>
      )
    },
    { 
      title: 'Giá cước', 
      dataIndex: 'agreed_price', 
      key: 'agreed_price', 
      width: '12%',
      render: val => (
        val && val > 0 ? (
          <span className="font-bold text-gray-800 text-xs whitespace-nowrap">
            {val.toLocaleString()} đ
          </span>
        ) : (
          <span className="font-bold text-amber-600 text-xs whitespace-nowrap bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Chờ chốt giá
          </span>
        )
      )
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status', 
      width: '10%',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'} className="font-semibold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap">
          {statusLabels[status] || status}
        </Tag>
      )
    },
    { 
      title: 'Thao tác', 
      key: 'action', 
      width: '10%',
      render: (_, record) => (
        <div className="flex items-center gap-1.5 flex-nowrap">
          {record.status === 'DRAFT' ? (
            <>
              <Tooltip title="Liên hệ khách hàng để chốt giá và kiểm tra hồ sơ">
                <Button 
                  size="small" 
                  type="primary"
                  ghost
                  className="text-xs border-indigo-400 text-indigo-700 font-semibold"
                  onClick={() => setSelectedOrderForDetails(record)}
                >
                  Xử lý & Chốt đơn
                </Button>
              </Tooltip>
              <Tooltip title="Đơn nháp chưa thể gán xe! Vui lòng liên hệ chốt giá và xác nhận đơn trước.">
                <Button 
                  size="small" 
                  disabled
                  icon={<Truck size={14} />}
                  className="opacity-40 cursor-not-allowed"
                >
                  Gán xe
                </Button>
              </Tooltip>
            </>
          ) : record.status === 'READY_FOR_PLANNING' ? (
            <>
              <Tooltip title="Gán xe và lập chuyến vận chuyển">
                <Button 
                  size="small" 
                  type="primary" 
                  icon={<Truck size={14} />}
                  className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold"
                  onClick={() => setSelectedOrderForAssign(record)}
                >
                  Gán xe
                </Button>
              </Tooltip>
              <Tooltip title="Xem chi tiết hồ sơ">
                <Button 
                  size="small" 
                  icon={<Eye size={14} />} 
                  className="text-gray-600 hover:text-[#7367f0]"
                  onClick={() => setSelectedOrderForDetails(record)}
                >
                  Hồ sơ
                </Button>
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Xem chi tiết hồ sơ">
              <Button 
                size="small" 
                icon={<Eye size={14} />} 
                className="text-gray-600 hover:text-[#7367f0]"
                onClick={() => setSelectedOrderForDetails(record)}
              >
                Hồ sơ
              </Button>
            </Tooltip>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header Action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng</h1>
              <Badge count={orders.filter(o => o.status === 'READY_FOR_PLANNING').length} overflowCount={99} title="Đơn sẵn sàng xếp chuyến">
                <Tag color="cyan" className="font-semibold ml-1">Sẵn sàng: {orders.filter(o => o.status === 'READY_FOR_PLANNING').length}</Tag>
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              icon={<Sparkles size={16} className="text-purple-600" />} 
              className="h-10 px-3.5 border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100"
              onClick={() => setIsAIDrawerOpen(true)}
            >
              Trợ lý AI
            </Button>

            <Button 
              type="primary" 
              icon={<Plus size={16} />} 
              className="bg-[#7367f0] hover:bg-[#5e50ee] h-10 px-4 font-semibold" 
              onClick={() => setIsCreateModalOpen(true)}
            >
              Tạo đơn vận chuyển
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <Row gutter={[16, 16]} className="items-end">
            <Col xs={24} md={8}>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase">Tìm kiếm Đơn hàng</p>
              <Input 
                placeholder="Mã đơn, Mã HAWB, Khách hàng..." 
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
                  { value: 'DRAFT', label: 'Đơn nháp' },
                  { value: 'CONFIRMED', label: 'Đã xác nhận' },
                  { value: 'READY_FOR_PLANNING', label: 'Sẵn sàng xếp xe' },
                  { value: 'ASSIGNED', label: 'Đã gán xe' },
                  { value: 'IN_TRANSIT', label: 'Đang vận chuyển' },
                  { value: 'DELIVERED', label: 'Đã giao hàng' },
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