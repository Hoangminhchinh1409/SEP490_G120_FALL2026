import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Input, DatePicker, Select, Row, Col, message, Badge, Tooltip, Space } from 'antd';
import { Search, Plus, Download, Eye, PhoneCall, Globe, RefreshCw, ArrowUpRight, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';
import OrderDetailsModal from '../../components/dispatcher/OrderDetailsModal';
import CancelOrderModal from '../../components/dispatcher/CancelOrderModal';
import { orderApi } from '../../api/orderApi';

const { RangePicker } = DatePicker;

const statusColors = {
  'DRAFT': 'default',
  'CONFIRMED': 'blue', 
  'READY_FOR_PLANNING': 'cyan', 
  'ASSIGNED': 'orange',
  'IN_TRANSIT': 'purple', 
  'DELIVERED': 'green', 
  'CANCELLED': 'red',
  'CLOSED': 'gray'
};

const statusLabels = {
  'DRAFT': 'Đơn nháp',
  'CONFIRMED': 'Đã xác nhận',
  'READY_FOR_PLANNING': 'Sẵn sàng xếp xe',
  'ASSIGNED': 'Đã gán xe',
  'IN_TRANSIT': 'Đang vận chuyển',
  'DELIVERED': 'Đã giao hàng',
  'CANCELLED': 'Đã hủy',
  'CLOSED': 'Đã đóng'
};

const OrderManagement = () => {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState(null);

  // Tải danh sách đơn hàng từ Backend Supabase
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await orderApi.getAllOrders();
      setOrders(data);
    } catch (err) {
      console.error('Fetch orders error:', err);
      message.error('Không thể kết nối đến máy chủ BE để lấy danh sách đơn');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      try {
        const data = await orderApi.getAllOrders();
        if (active) {
          setOrders(data);
        }
      } catch (err) {
        if (active) {
          console.error('Fetch orders error:', err);
          message.error('Không thể kết nối đến máy chủ BE để lấy danh sách đơn');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    const handleStorageChange = () => {
      fetchOrders();
    };

    window.addEventListener('nexlog_orders_updated', handleStorageChange);
    return () => {
      active = false;
      window.removeEventListener('nexlog_orders_updated', handleStorageChange);
    };
  }, [fetchOrders]);

  const handleCreateOrder = async (values) => {
    try {
      setLoading(true);
      const newOrder = await orderApi.createDirectOrder(values);
      message.success(`Đã tạo thành công đơn hàng vào Backend: ${newOrder.order_code}!`);
      setIsCreateModalOpen(false);
      await fetchOrders();
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Không thể tạo đơn hàng trên máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = (updatedOrder) => {
    setOrders(prev => prev.map(o => (o.id === updatedOrder.id || o.order_id === updatedOrder.order_id) ? { ...o, ...updatedOrder } : o));
    setSelectedOrderForDetails(updatedOrder);
    fetchOrders();
  };

  const handleConfirmCancel = async (cancelData) => {
    try {
      await orderApi.cancelOrder(cancelData.id || cancelData.order_id, cancelData);
    } catch (err) {
      console.warn('cancelOrder API note:', err);
    }
    setOrders(prev => prev.map(o => (o.id === cancelData.id || o.order_id === cancelData.order_id)
      ? { ...o, status: 'CANCELLED', cancellation_reason: cancelData.cancellation_reason, cancellation_fee: cancelData.cancellation_fee }
      : o
    ));
    setSelectedOrderForCancel(null);
    fetchOrders();
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
      width: '14%',
      render: (_, record) => (
        <Space size="small" wrap>
          {record.status === 'DRAFT' ? (
            <>
              <Tooltip title="Xử lý đơn nháp">
                <Button 
                  size="small" 
                  type="primary"
                  ghost
                  className="text-xs border-indigo-400 text-indigo-700 font-semibold"
                  onClick={() => setSelectedOrderForDetails(record)}
                >
                  Xử lý
                </Button>
              </Tooltip>
              <Tooltip title="Hủy đơn (Miễn phí)">
                <Button 
                  size="small" 
                  danger
                  icon={<XCircle size={13} />}
                  onClick={() => setSelectedOrderForCancel(record)}
                />
              </Tooltip>
            </>
          ) : record.status === 'CONFIRMED' ? (
            <>
              <Tooltip title="Kiểm duyệt & Xác nhận danh mục chứng từ">
                <Button 
                  size="small" 
                  type="primary"
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold"
                  onClick={() => setSelectedOrderForDetails({ ...record, targetTab: '2' })}
                >
                  Xác nhận chứng từ
                </Button>
              </Tooltip>
              <Tooltip title="Hủy đơn (Miễn phí)">
                <Button 
                  size="small" 
                  danger
                  icon={<XCircle size={13} />}
                  onClick={() => setSelectedOrderForCancel(record)}
                />
              </Tooltip>
            </>
          ) : record.status === 'READY_FOR_PLANNING' ? (
            <>
              <Tooltip title="Hồ sơ">
                <Button 
                  size="small" 
                  icon={<Eye size={14} />} 
                  className="text-gray-600 hover:text-[#7367f0]"
                  onClick={() => setSelectedOrderForDetails(record)}
                >
                  Hồ sơ
                </Button>
              </Tooltip>
              <Tooltip title="Xếp chuyến">
                <Button 
                  size="small" 
                  type="primary" 
                  icon={<ArrowUpRight size={14} />}
                  className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold text-xs"
                  onClick={() => router.push('/dispatcher/trips')}
                >
                  Xếp chuyến
                </Button>
              </Tooltip>
              <Tooltip title="Hủy đơn">
                <Button 
                  size="small" 
                  danger
                  icon={<XCircle size={13} />}
                  onClick={() => setSelectedOrderForCancel(record)}
                />
              </Tooltip>
            </>
          ) : record.status === 'CANCELLED' ? (
            <>
              <Button 
                size="small" 
                icon={<Eye size={14} />} 
                className="text-gray-600 hover:text-[#7367f0]"
                onClick={() => setSelectedOrderForDetails(record)}
              >
                Hồ sơ
              </Button>
              <Tooltip title="Đóng đơn">
                <Button 
                  size="small" 
                  type="primary"
                  className="bg-slate-700 hover:bg-slate-800 text-xs font-semibold"
                  onClick={async () => {
                    try {
                      await orderApi.closeOrder(record.id || record.order_id);
                    } catch (e) {
                      console.warn(e);
                    }
                    setOrders(prev => prev.map(o => (o.id === record.id || o.order_id === record.order_id) ? { ...o, status: 'CLOSED' } : o));
                    message.success(`Đã đóng đơn hàng ${record.order_id}!`);
                  }}
                >
                  Đóng đơn
                </Button>
              </Tooltip>
            </>
          ) : record.status === 'DELIVERED' ? (
            <>
              <Tooltip title="Hồ sơ">
                <Button 
                  size="small" 
                  icon={<Eye size={14} />} 
                  className="text-gray-600 hover:text-[#7367f0]"
                  onClick={() => setSelectedOrderForDetails(record)}
                >
                  Hồ sơ
                </Button>
              </Tooltip>
              <Tooltip title="Đóng đơn">
                <Button 
                  size="small" 
                  type="primary"
                  className="bg-slate-700 hover:bg-slate-800 text-xs font-semibold"
                  onClick={async () => {
                    try {
                      await orderApi.closeOrder(record.id || record.order_id);
                    } catch (e) {
                      console.warn(e);
                    }
                    setOrders(prev => prev.map(o => (o.id === record.id || o.order_id === record.order_id) ? { ...o, status: 'CLOSED' } : o));
                    message.success(`Đã đóng đơn hàng ${record.order_id}!`);
                  }}
                >
                  Đóng đơn
                </Button>
              </Tooltip>
            </>
          ) : record.status === 'ASSIGNED' ? (
            <>
              <Tooltip title="Hồ sơ">
                <Button 
                  size="small" 
                  icon={<Eye size={14} />} 
                  className="text-gray-600 hover:text-[#7367f0]"
                  onClick={() => setSelectedOrderForDetails(record)}
                >
                  Hồ sơ
                </Button>
              </Tooltip>
              <Tooltip title="Hủy đơn (Tính phí điều xe)">
                <Button 
                  size="small" 
                  danger
                  icon={<XCircle size={13} />}
                  onClick={() => setSelectedOrderForCancel(record)}
                />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Hồ sơ">
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
        </Space>
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

          <div className="flex flex-wrap gap-2">
            <Button 
              icon={<RefreshCw size={15} className={loading ? "animate-spin text-indigo-600" : "text-gray-600"} />} 
              className="h-10 px-3 border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
              onClick={fetchOrders}
              loading={loading}
            >
              Làm mới
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
            loading={loading}
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

      {/* Modal Hủy Đơn Hàng theo chuẩn BR-18 */}
      <CancelOrderModal
        open={Boolean(selectedOrderForCancel)}
        order={selectedOrderForCancel}
        onCancel={() => setSelectedOrderForCancel(null)}
        onConfirmCancel={handleConfirmCancel}
      />
    </div>
  );
};

export default OrderManagement;