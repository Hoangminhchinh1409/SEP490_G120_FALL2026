import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Tag, Button, Input, DatePicker, Select, Row, Col, message, Badge, Tooltip, Space } from 'antd';
import { Search, Plus, Download, Eye, PhoneCall, Globe, RefreshCw, ArrowUpRight, XCircle, Sparkles, Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';
import OrderDetailsModal from '../../components/dispatcher/OrderDetailsModal';
import CancelOrderModal from '../../components/dispatcher/CancelOrderModal';
import DocumentAssistantDrawer from '../../components/dispatcher/DocumentAssistantDrawer';
import { orderApi } from '../../api/orderApi';

const { RangePicker } = DatePicker;

const statusColors = {
  'DRAFT': 'default',
  'NEGOTIATING': 'warning',
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
  'NEGOTIATING': 'Đang thương lượng',
  'CONFIRMED': 'Đã xác nhận',
  'READY_FOR_PLANNING': 'Sẵn sàng xếp xe',
  'ASSIGNED': 'Đã gán xe',
  'IN_TRANSIT': 'Đang vận chuyển',
  'DELIVERED': 'Đã giao (Đóng)',
  'CANCELLED': 'Đã hủy (Đóng)',
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
  const [assistantDrawerOpen, setAssistantDrawerOpen] = useState(false);

  // Tải danh sách đơn hàng từ Backend Supabase (silent: true khi cập nhật nền không bật loading)
  const fetchOrders = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const data = await orderApi.getAllOrders();
      setOrders(data);
    } catch (err) {
      console.error('Fetch orders error:', err);
      message.error('Không thể kết nối đến máy chủ BE để lấy danh sách đơn');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    const loadInitialData = async () => {
      try {
        const data = await orderApi.getAllOrders();
        if (isSubscribed) {
          setOrders(data);
          setLoading(false);
        }
      } catch (err) {
        if (isSubscribed) {
          console.error('Fetch orders error:', err);
          message.error('Không thể kết nối đến máy chủ BE để lấy danh sách đơn');
          setLoading(false);
        }
      }
    };

    loadInitialData();

    // Tự động kiểm tra cập nhật mỗi 5 giây để phát hiện ngay khi khách gửi yêu cầu đàm phán
    const pollInterval = setInterval(async () => {
      try {
        const latestOrders = await orderApi.getAllOrders();
        if (isSubscribed && Array.isArray(latestOrders)) {
          setOrders(prev => {
            const prevNegotiating = prev.filter(o => o.web_workflow?.stage === 'CUSTOMER_NEGOTIATING' || o.status === 'NEGOTIATING').map(o => `${o.id}-${o.web_workflow?.negotiation?.submitted_at || ''}`);
            const newNegotiating = latestOrders.filter(o => (o.web_workflow?.stage === 'CUSTOMER_NEGOTIATING' || o.status === 'NEGOTIATING') && !prevNegotiating.includes(`${o.id}-${o.web_workflow?.negotiation?.submitted_at || ''}`));
            if (newNegotiating.length > 0) {
              message.warning({
                content: `⚡ Khách hàng vừa gửi yêu cầu thương lượng giá cho đơn #${newNegotiating[0].order_id || newNegotiating[0].order_code}!`,
                duration: 5
              });
            }
            return latestOrders;
          });
          setSelectedOrderForDetails(prevSelected => {
            if (!prevSelected) return null;
            const found = latestOrders.find(o => o.id === prevSelected.id || o.order_id === prevSelected.order_id);
            return found ? { ...prevSelected, ...found } : prevSelected;
          });
        }
      } catch (e) {
        // bỏ qua lỗi polling
      }
    }, 5000);

    const handleStorageChange = () => {
      fetchOrders(true);
    };

    window.addEventListener('nexlog_orders_updated', handleStorageChange);
    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
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
    fetchOrders(true);
  };

  const handleConfirmCancel = async (cancelData) => {
    try {
      const orderTargetId = cancelData.id || cancelData.order_id;
      await orderApi.cancelOrder(orderTargetId, cancelData);
      
      setOrders(prev => prev.map(o => (o.id === cancelData.id || o.order_id === cancelData.order_id)
        ? { ...o, status: 'CANCELLED', cancel_reason: cancelData.cancellation_reason, cancellation_fee: cancelData.cancellation_fee }
        : o
      ));
      setSelectedOrderForCancel(null);

      if (!cancelData.cancellation_fee || cancelData.cancellation_fee === 0) {
        message.success(`Đã hủy đơn hàng ${cancelData.order_id || cancelData.id} (Miễn phí hủy: 0 VNĐ)!`);
      } else {
        message.warning(`Đã hủy đơn hàng ${cancelData.order_id || cancelData.id}! Phí phạt / tiền công: ${Number(cancelData.cancellation_fee).toLocaleString()} VNĐ`);
      }
      fetchOrders();
    } catch (err) {
      console.error('cancelOrder error:', err);
      message.error(err.message || 'Không thể hủy đơn hàng trên hệ thống');
    }
  };

  // Filter logic
  const filteredData = useMemo(() => {
    const searchLower = filterText.trim().toLowerCase();
    return orders.filter(item => {
      const matchSearch = !searchLower || 
        (item.order_id && item.order_id.toLowerCase().includes(searchLower)) ||
        (item.customer && item.customer.toLowerCase().includes(searchLower)) ||
        (item.hawb_code && item.hawb_code.toLowerCase().includes(searchLower));
      
      let matchStatus = true;
      if (filterStatus !== 'all') {
        if (filterStatus === 'NEGOTIATING') {
          matchStatus = item.status === 'NEGOTIATING' || item.web_workflow?.stage === 'CUSTOMER_NEGOTIATING';
        } else if (filterStatus === 'CLOSED') {
          matchStatus = item.status === 'CLOSED' || item.status === 'DELIVERED' || item.status === 'CANCELLED';
        } else if (filterStatus === 'DELIVERED') {
          matchStatus = (item.status === 'DELIVERED' || item.status === 'CLOSED') && !item.cancel_reason && !item.cancellation_reason;
        } else if (filterStatus === 'CANCELLED') {
          matchStatus = item.status === 'CANCELLED' || (item.status === 'CLOSED' && (item.cancel_reason || item.cancellation_reason));
        } else {
          matchStatus = item.status === filterStatus;
        }
      }
      return matchSearch && matchStatus;
    });
  }, [orders, filterText, filterStatus]);

  const columns = useMemo(() => [
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
            {record.shipping_direction === 'EXPORT' ? (
              <Tag color="purple" className="text-[10px] px-1.5 py-0 rounded font-semibold border-purple-300 bg-purple-50 text-purple-700 inline-flex items-center gap-1">
                🛫 Xuất khẩu
              </Tag>
            ) : (
              <Tag color="cyan" className="text-[10px] px-1.5 py-0 rounded font-semibold border-cyan-300 bg-cyan-50 text-cyan-700 inline-flex items-center gap-1">
                🛬 Nhập khẩu
              </Tag>
            )}
            {record.source === 'HOMEPAGE' ? (
              <Tag color="orange" className="text-[10px] px-1.5 py-0 rounded font-semibold border-amber-300 bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                <Globe size={10} /> Đơn Web
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
          {record.customs_location && record.customs_location !== 'NOI_BAI' && (
            <div className="text-[10px] text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded inline-block">
              ICD thông quan: {record.customs_location === 'MY_DINH' ? 'Mỹ Đình' : record.customs_location === 'BAC_NINH' ? 'Bắc Ninh' : 'Gia Lâm'}
            </div>
          )}
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
      render: (status, record) => {
        if (status === 'CLOSED' || status === 'CANCELLED' || status === 'DELIVERED') {
          if (record.cancel_reason || record.cancellation_reason || status === 'CANCELLED') {
            return (
              <Tag color="red" className="font-semibold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap">
                Đã hủy (Đã đóng)
              </Tag>
            );
          }
          return (
            <Tag color="green" className="font-semibold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap">
              Đã giao (Đã đóng)
            </Tag>
          );
        }
        if (record.web_workflow?.stage === 'CUSTOMER_NEGOTIATING' || status === 'NEGOTIATING') {
          return (
            <Tag color="warning" className="font-bold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap border-amber-400 text-amber-800 bg-amber-50">
              Đang thương lượng
            </Tag>
          );
        }
        if (record.web_workflow?.stage === 'PRICE_AGREED_BY_DISPATCHER') {
          return (
            <Tag color="cyan" className="font-bold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap border-cyan-400 text-cyan-800 bg-cyan-50">
              Đã báo giá (Chờ khách chốt)
            </Tag>
          );
        }
        if (status === 'CONFIRMED') {
          const hasRej = record.web_workflow?.stage === 'DOCS_REJECTED' || (record.documents || []).some(d => d.status === 'REJECTED');
          if (hasRej) {
            return (
              <Tag color="error" className="font-bold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap">
                Chờ nộp lại chứng từ
              </Tag>
            );
          }
          if (record.web_workflow?.stage === 'DOCS_APPROVED') {
            return (
              <Tag color="cyan" className="font-bold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap">
                Đã duyệt CT - Chờ ký HĐ
              </Tag>
            );
          }
          if (record.web_workflow?.stage === 'DOCS_UPLOADED') {
            return (
              <Tag color="processing" className="font-semibold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap">
                Chờ duyệt chứng từ
              </Tag>
            );
          }
        }
        return (
          <Tag color={statusColors[status] || 'default'} className="font-semibold text-[11px] rounded-md px-2 py-0.5 whitespace-nowrap">
            {statusLabels[status] || status}
          </Tag>
        );
      }
    },
    { 
      title: 'Thao tác', 
      key: 'action', 
      width: '14%',
      render: (_, record) => (
        <Space size="small" wrap>
          {(record.status === 'NEGOTIATING' || record.web_workflow?.stage === 'CUSTOMER_NEGOTIATING') ? (
            <>
              <Tooltip title="Xem yêu cầu thương lượng của khách & Chốt lại giá">
                <Button 
                  size="small" 
                  type="primary"
                  className="text-xs bg-amber-600 hover:bg-amber-700 border-amber-600 font-semibold"
                  onClick={() => setSelectedOrderForDetails({ ...record, targetTab: '1' })}
                >
                  Chốt lại giá
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
          ) : record.status === 'DRAFT' ? (
            <>
              {record.web_workflow?.stage === 'PRICE_AGREED_BY_DISPATCHER' ? (
                <Tooltip title="Đã gửi báo giá qua email cho khách. Nhấn để xem chi tiết / điều chỉnh lại">
                  <Button 
                    size="small" 
                    type="primary"
                    className="text-xs bg-cyan-600 hover:bg-cyan-700 border-cyan-600 font-semibold"
                    onClick={() => setSelectedOrderForDetails(record)}
                  >
                    Xem báo giá
                  </Button>
                </Tooltip>
              ) : (
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
              )}
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
              <Tooltip title={record.web_workflow?.stage === 'DOCS_APPROVED' ? 'Xem hợp đồng đã gửi cho khách ký số' : 'Kiểm duyệt & Xác nhận danh mục chứng từ'}>
                <Button 
                  size="small" 
                  type="primary"
                  className={`text-xs font-semibold ${record.web_workflow?.stage === 'DOCS_APPROVED' ? 'bg-cyan-600 hover:bg-cyan-700 border-cyan-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  onClick={() => setSelectedOrderForDetails({ ...record, targetTab: record.web_workflow?.stage === 'DOCS_APPROVED' ? '3' : '2' })}
                >
                  {record.web_workflow?.stage === 'DOCS_APPROVED' ? 'Hợp đồng & Chờ ký' : 'Xác nhận chứng từ'}
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
          ) : (record.status === 'CANCELLED' || record.status === 'DELIVERED' || record.status === 'CLOSED') ? (
            <>
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
  ], [router]);

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
              icon={<Sparkles size={15} className="text-purple-600 animate-pulse" />} 
              className="h-10 px-3.5 border-purple-200 bg-purple-50/70 text-purple-700 hover:bg-purple-100 font-semibold"
              onClick={() => setAssistantDrawerOpen(true)}
            >
              Trợ lý AI Logistics (Gemini)
            </Button>

            <Button 
              icon={<RefreshCw size={15} className={loading ? "animate-spin text-indigo-600" : "text-gray-600"} />} 
              className="h-10 px-3 border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
              onClick={() => fetchOrders()}
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
                  { value: 'NEGOTIATING', label: 'Đang thương lượng' },
                  { value: 'CONFIRMED', label: 'Đã xác nhận' },
                  { value: 'READY_FOR_PLANNING', label: 'Sẵn sàng xếp xe' },
                  { value: 'ASSIGNED', label: 'Đã gán xe' },
                  { value: 'IN_TRANSIT', label: 'Đang vận chuyển' },
                  { value: 'DELIVERED', label: 'Đã giao (Đã đóng)' },
                  { value: 'CANCELLED', label: 'Đã hủy (Đã đóng)' }
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
            rowKey={record => record.id || record.order_id}
            columns={columns} 
            dataSource={filteredData} 
            loading={loading}
            pagination={{ pageSize: 8 }} 
            className="custom-table"
          />
        </div>

      </div>

      {/* Modal Tạo Đơn Hàng Mới */}
      {isCreateModalOpen && (
        <OrderFormModal 
          open={isCreateModalOpen} 
          onCancel={() => setIsCreateModalOpen(false)} 
          onSubmit={handleCreateOrder} 
        />
      )}

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

      {/* Trợ lý AI Logistics (Gemini) mở trực tiếp ngoài màn hình Quản lý đơn hàng */}
      <DocumentAssistantDrawer
        open={assistantDrawerOpen}
        onClose={() => setAssistantDrawerOpen(false)}
        currentCargo="Lô hàng thiết bị điện tử, linh kiện máy tính nhập khẩu từ Hàn Quốc về Sân bay Nội Bài giao KCN Tiên Sơn Bắc Ninh"
        onApplyRecommendations={() => {
          setAssistantDrawerOpen(false);
          setIsCreateModalOpen(true);
        }}
      />
    </div>
  );
};

export default OrderManagement;
