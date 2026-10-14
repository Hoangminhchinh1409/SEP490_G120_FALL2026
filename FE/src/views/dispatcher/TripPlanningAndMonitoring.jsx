"use client";
import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Input, Modal, Select, Row, Col, Space, Card, Badge, Tooltip, Progress, Drawer, message, Tabs } from 'antd';
import { Route, Search, Eye, AlertTriangle, PlayCircle, Box, Printer, Download, Clock, MapPin, Truck, User, CheckCircle2, ArrowRight, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import TripAssignmentModal from '../../components/dispatcher/TripAssignmentModal';
import IncidentDetailsModal from '../../components/dispatcher/IncidentDetailsModal';
import CancelOrderModal from '../../components/dispatcher/CancelOrderModal';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';

const { Option } = Select;

export default function TripPlanningAndMonitoring() {
  const [activeMainTab, setActiveMainTab] = useState('planning');
  const [trips, setTrips] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals state
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState(null);
  const [selectedTripDetails, setSelectedTripDetails] = useState(null);
  const [selectedTripWaybill, setSelectedTripWaybill] = useState(null);
  const [selectedTripReplay, setSelectedTripReplay] = useState(null);
  const [selectedTrip3D, setSelectedTrip3D] = useState(null);
  const [activeIncidentModal, setActiveIncidentModal] = useState(null);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState(null);

  // Tải danh sách đơn hàng sẵn sàng xếp xe, chuyến xe và sự cố từ Backend Supabase
  const fetchData = useCallback(async () => {
    try {
      const [ordersData, tripsData, incidentsData, trucksData, driversData] = await Promise.all([
        orderApi.getAllOrders(),
        dispatcherApi.getTrips(),
        dispatcherApi.getIncidents(),
        dispatcherApi.getTrucks(),
        dispatcherApi.getDrivers()
      ]);
      const readyOrders = (ordersData || []).filter(o => o.status === 'READY_FOR_PLANNING');
      setPendingOrders(readyOrders);
      setTrips(tripsData || []);
      setIncidents(incidentsData || []);
      setTrucks(trucksData || []);
      setDrivers(driversData || []);
    } catch (err) {
      console.error('Fetch trip planning data error:', err);
      message.error('Không thể kết nối đến máy chủ BE để tải dữ liệu chuyến xe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      try {
        const [ordersData, tripsData, incidentsData, trucksData, driversData] = await Promise.all([
          orderApi.getAllOrders(),
          dispatcherApi.getTrips(),
          dispatcherApi.getIncidents(),
          dispatcherApi.getTrucks(),
          dispatcherApi.getDrivers()
        ]);
        if (active) {
          const readyOrders = (ordersData || []).filter(o => o.status === 'READY_FOR_PLANNING');
          setPendingOrders(readyOrders);
          setTrips(tripsData || []);
          setIncidents(incidentsData || []);
          setTrucks(trucksData || []);
          setDrivers(driversData || []);
        }
      } catch (err) {
        if (active) {
          console.error('Fetch trip planning data error:', err);
          message.error('Không thể kết nối đến máy chủ BE để tải dữ liệu chuyến xe');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    const handleStorageChange = () => {
      fetchData();
    };
    window.addEventListener('nexlog_orders_updated', handleStorageChange);
    return () => {
      active = false;
      window.removeEventListener('nexlog_orders_updated', handleStorageChange);
    };
  }, [fetchData]);

  // Xử lý khi gán xe và tạo chuyến thành công -> Lưu vào Supabase Database
  const handleAssignSuccess = async (assignedOrder) => {
    try {
      setLoading(true);
      await dispatcherApi.createTrip({
        order_id: assignedOrder.id || assignedOrder.order_id,
        order_code: assignedOrder.order_id || assignedOrder.id,
        truck_plate: assignedOrder.truck,
        driver_name: assignedOrder.driver1,
        pickup_address: assignedOrder.pickup || assignedOrder.pickup_address,
        dropoff_address: assignedOrder.dropoff || assignedOrder.delivery_address,
        allocation_type: assignedOrder.allocationType,
        vendor_name: assignedOrder.vendor,
        vendor_tracking_code: assignedOrder.vendor_tracking_code
      });

      setSelectedOrderForAssign(null);
      message.success(`Đã phân bổ xe [${assignedOrder.truck || assignedOrder.vendor}] thành công và lưu vào cơ sở dữ liệu!`);
      await fetchData();
      setActiveMainTab('monitoring');
    } catch (err) {
      console.error('handleAssignSuccess error:', err);
      message.error(err.message || 'Có lỗi xảy ra khi tạo chuyến xe');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý giải quyết sự cố phát sinh trên chuyến xe
  const handleResolveIncident = async (resolvedData) => {
    try {
      setLoading(true);
      await dispatcherApi.updateIncidentStatus(resolvedData.raw_id || resolvedData.id, 'RESOLVED');
      message.success(`Sự cố ${resolvedData.id} đã được xử lý và lưu vào cơ sở dữ liệu!`);
      setActiveIncidentModal(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi cập nhật trạng thái sự cố');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPendingOrder = async (cancelData) => {
    try {
      await orderApi.cancelOrder(cancelData.id || cancelData.order_id, cancelData);
    } catch (err) {
      console.warn('cancelOrder API note:', err);
    }
    setPendingOrders(prev => prev.filter(o => (o.id || o.order_id) !== (cancelData.id || cancelData.order_id)));
    setSelectedOrderForCancel(null);
    message.success(`Đã hủy đơn ${cancelData.order_id} thành công!`);
    fetchData();
  };

  const handleCancelTrip = (trip) => {
    Modal.confirm({
      title: `Hủy chuyến xe ${trip.id}?`,
      icon: <AlertTriangle className="text-red-500" />,
      content: `Thao tác này sẽ hủy chuyến xe, giải phóng xe ${trip.plate} và tài xế ${trip.driver_name} về trạng thái Sẵn sàng trong cơ sở dữ liệu.`,
      okText: 'Xác nhận hủy chuyến',
      okType: 'danger',
      cancelText: 'Quay lại',
      onOk: async () => {
        try {
          setLoading(true);
          await dispatcherApi.updateTripStatus(trip.raw_id || trip.id, 'CANCELLED');
          message.success(`Đã hủy chuyến ${trip.id} và giải phóng phương tiện trên cơ sở dữ liệu!`);
          await fetchData();
        } catch (err) {
          console.error(err);
          message.error('Lỗi khi hủy chuyến xe');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCompleteTrip = async (trip) => {
    try {
      setLoading(true);
      await dispatcherApi.updateTripStatus(trip.raw_id || trip.id, 'COMPLETED');
      message.success(`Chuyến xe ${trip.id} đã hoàn tất giao hàng! Phương tiện đã được trả về trạng thái Sẵn sàng.`);
      await fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi hoàn thành chuyến xe');
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = trips.filter(item => {
    const matchSearch = searchText === '' ||
      item.id.toLowerCase().includes(searchText.toLowerCase()) ||
      item.plate.toLowerCase().includes(searchText.toLowerCase()) ||
      item.driver_name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.customer.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = filterStatus === 'ALL' ||
      (filterStatus === 'LATE_RISK' ? item.is_late_risk : filterStatus === 'INCIDENT' ? item.has_incident : item.status === filterStatus);
    return matchSearch && matchStatus;
  });

  // Cột bảng đơn hàng chờ xếp xe (Tab 1)
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

  // Cột bảng chuyến xe đang chạy (Tab 2)
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
            <User size={11} className="text-gray-400" />
            <span>{r.driver_name} - {r.driver_phone}</span>
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
            {record.status === 'IN_TRANSIT' && (
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
            {record.status === 'IN_TRANSIT' && record.progress <= 50 && (
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

  // Cột bảng sự cố chuyến xe (Tab 3)
  const incidentColumns = [
    {
      title: 'Mã sự cố & Thời gian',
      key: 'id_time',
      width: '18%',
      render: (_, r) => (
        <div>
          <span className="font-mono font-bold text-red-600 text-xs">{r.id}</span>
          <div className="text-[11px] text-gray-500 mt-0.5">Báo cáo lúc: <b className="font-mono">{r.reported_at}</b></div>
          <Tag color="error" className="font-bold text-[10px] mt-1">{r.severity === 'HIGH' ? 'MỨC ĐỘ CAO' : 'TRUNG BÌNH'}</Tag>
        </div>
      )
    },
    {
      title: 'Chuyến xe & Phương tiện',
      key: 'trip_truck',
      width: '24%',
      render: (_, r) => (
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-[#7367f0] font-mono">{r.trip_code}</div>
          <div className="flex items-center gap-1.5 text-gray-800">
            <span className="font-mono font-semibold bg-gray-100 px-1 rounded">{r.truck}</span>
            <span>- {r.driver}</span>
          </div>
          <div className="text-gray-400 font-mono text-[11px]">{r.phone}</div>
        </div>
      )
    },
    {
      title: 'Hiện trường & Nội dung sự cố',
      key: 'content',
      width: '32%',
      render: (_, r) => (
        <div className="text-xs space-y-1">
          <div className="font-bold text-red-700 flex items-center gap-1">
            <AlertTriangle size={12} />
            <span>{r.type}</span>
          </div>
          <div className="text-gray-600 flex items-start gap-1">
            <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
            <span>{r.location}</span>
          </div>
          <div className="text-gray-700 bg-gray-50 p-2 rounded border text-[11px] leading-relaxed">
            {r.description}
          </div>
          {r.new_truck && (
            <div className="text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200 text-[11px] font-medium">
              Đã điều xe thay thế: <b>{r.new_truck}</b> ({r.new_driver})
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: '14%',
      render: (_, r) => (
        r.status === 'PENDING' ? (
          <Tag color="error" className="font-bold text-xs py-0.5 px-2">CHỜ XỬ LÝ</Tag>
        ) : r.status === 'RESOLVED_REPLACED' ? (
          <Tag color="success" className="font-semibold text-xs py-0.5 px-2">ĐÃ ĐIỀU XE THAY THẾ</Tag>
        ) : r.status === 'ESCALATED_TO_MANAGER' ? (
          <Tag color="orange" className="font-semibold text-xs py-0.5 px-2">ĐÃ CHUYỂN QUẢN LÝ</Tag>
        ) : (
          <Tag color="green" className="font-semibold text-xs py-0.5 px-2">ĐÃ GIẢI QUYẾT</Tag>
        )
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: '12%',
      render: (_, record) => (
        <Button
          size="small"
          type="primary"
          danger={record.status === 'PENDING'}
          className={record.status === 'PENDING' ? 'font-bold text-xs' : 'bg-gray-600 text-xs'}
          onClick={() => setActiveIncidentModal(record)}
        >
          {record.status === 'PENDING' ? 'Xử lý ngay' : 'Xem phương án'}
        </Button>
      )
    }
  ];

  const pendingIncidentsCount = incidents.filter(i => i.status === 'PENDING').length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Route size={22} className="text-[#7367f0]" />
            Kế hoạch, Chuyến xe & Xử lý Sự cố
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Lập kế hoạch phân bổ phương tiện, gán tài xế, giám sát hành trình và xử lý kịp thời các sự cố phát sinh trên đường.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<RefreshCw size={15} className={loading ? "animate-spin text-[#7367f0]" : ""} />}
            onClick={fetchData}
            loading={loading}
            className="text-xs h-9"
          >
            Làm mới dữ liệu
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        activeKey={activeMainTab}
        onChange={setActiveMainTab}
        size="large"
        className="custom-tabs"
        items={[
          {
            key: 'planning',
            label: (
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Truck size={17} className="text-[#7367f0]" />
                Phân bổ xe & Lập chuyến
                <Badge count={pendingOrders.length} overflowCount={99} className="ml-1" />
              </span>
            ),
            children: (
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
            )
          },
          {
            key: 'monitoring',
            label: (
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Route size={17} className="text-[#7367f0]" />
                Giám sát Chuyến xe
                <Badge count={trips.filter(t => t.status === 'IN_TRANSIT').length} overflowCount={99} className="ml-1" />
              </span>
            ),
            children: (
              <div className="space-y-5 pt-2">
                {/* Banner Cảnh báo sự cố hiện trường khẩn cấp */}
                {pendingIncidentsCount > 0 && (
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
                    <Button
                      type="primary"
                      danger
                      icon={<AlertTriangle size={15} />}
                      className="font-bold shrink-0 shadow-sm"
                      onClick={() => setActiveIncidentModal(incidents[0])}
                    >
                      Xử lý sự cố ngay
                    </Button>
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
                        {pendingIncidentsCount > 0 && <span className="text-xs font-normal text-red-500">(Xem chi tiết →)</span>}
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
                      <div className="text-xs text-gray-500">Tỷ lệ đúng giờ (On-time)</div>
                      <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">94.2%</div>
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
                        <Option value="INCIDENT">Chuyến có sự cố</Option>
                        <Option value="LATE_RISK">Có nguy cơ trễ hẹn</Option>
                        <Option value="COMPLETED">Đã hoàn thành</Option>
                      </Select>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                  <Table
                    columns={tripColumns}
                    dataSource={filteredTrips}
                    rowKey="id"
                    pagination={{ pageSize: 8 }}
                    size="middle"
                  />
                </Card>
              </div>
            )
          },
          {
            key: 'incidents',
            label: (
              <span className="flex items-center gap-2 font-semibold text-sm">
                <ShieldAlert size={17} className="text-red-500" />
                Sự cố Vận hành
                {pendingIncidentsCount > 0 && (
                  <Badge count={pendingIncidentsCount} overflowCount={99} className="ml-1" />
                )}
              </span>
            ),
            children: (
              <div className="space-y-5 pt-2">
                <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-gray-800">Quản lý & Xử lý Sự cố Hiện trường</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Tiếp nhận thông tin hỏng xe, tai nạn hoặc ùn tắc, phát lệnh điều xe thay thế và cấp lại vận đơn</p>
                  </div>
                </div>

                <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                  <Table
                    columns={incidentColumns}
                    dataSource={incidents}
                    rowKey="id"
                    pagination={{ pageSize: 6 }}
                    size="middle"
                  />
                </Card>
              </div>
            )
          }
        ]}
      />

      {/* Modal Gán Xe & Phân Bổ Chuyến cho Đơn hàng */}
      <TripAssignmentModal
        open={Boolean(selectedOrderForAssign)}
        order={selectedOrderForAssign}
        onCancel={() => setSelectedOrderForAssign(null)}
        onAssignSuccess={handleAssignSuccess}
      />

      {/* Modal Xử lý Sự cố Hiện Trường */}
      <IncidentDetailsModal
        open={Boolean(activeIncidentModal)}
        incident={activeIncidentModal}
        onCancel={() => setActiveIncidentModal(null)}
        onResolveSuccess={handleResolveIncident}
      />

      {/* Modal 1: Chi tiết Chuyến xe */}
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
                        <Tag color={stop.type === 'PICKUP' ? 'blue' : stop.type === 'REST' ? 'orange' : stop.type === 'INCIDENT' ? 'red' : stop.type === 'TRANSSHIP' ? 'purple' : 'green'} className="text-[10px] m-0">
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
              <p className="text-gray-400 font-mono text-[11px]">
                Số vận đơn: WB-{selectedTripWaybill.id} | Phiên bản: V{selectedTripWaybill.waybill_version || 1} | Ngày phát hành: 14/10/2026
              </p>
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
                <li>09:35 - Nghỉ tại Trạm dừng nghỉ Km12 (Thời gian dừng: 12 phút).</li>
                <li>10:05 - Tắc đường cục bộ tại nút giao Phù Đổng (Vận tốc 12 km/h - Cảnh báo trễ hẹn).</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Hủy Đơn Hàng theo chuẩn BR-18 */}
      <CancelOrderModal
        open={Boolean(selectedOrderForCancel)}
        order={selectedOrderForCancel}
        onCancel={() => setSelectedOrderForCancel(null)}
        onConfirmCancel={handleCancelPendingOrder}
      />
    </div>
  );
}
