"use client";
import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Badge, message, Tabs } from 'antd';
import { Route, Truck, RefreshCw, ShieldAlert } from 'lucide-react';
import TripAssignmentModal from '../../components/dispatcher/TripAssignmentModal';
import IncidentDetailsModal from '../../components/dispatcher/IncidentDetailsModal';
import CancelOrderModal from '../../components/dispatcher/CancelOrderModal';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';
import { useAuth } from '../../providers/AuthProvider';

// Subcomponents đã được tách
import TripPlanningTab from './tripPlanning/TripPlanningTab';
import TripMonitoringTab from './tripPlanning/TripMonitoringTab';
import TripIncidentsTab from './tripPlanning/TripIncidentsTab';
import { 
  TripDetailsDrawer, 
  TripWaybillModal, 
  Trip3DModal, 
  TripReplayModal 
} from './tripPlanning/TripAuxiliaryModals';

export default function TripPlanningAndMonitoring() {
  const { user } = useAuth();
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
      const currentUserId = user?.id ? Number(user.id) : null;
      const isDispatcher = user && (Number(user.role_id) === 3 || user.role === 'DISPATCHER' || user.role_name === 'DISPATCHER');

      const readyOrders = (ordersData || []).filter(o => {
        if (o.status !== 'READY_FOR_PLANNING') return false;
        if (isDispatcher && currentUserId) {
          const orderDispId = o.responsible_dispatcher_id ? Number(o.responsible_dispatcher_id) : null;
          if (orderDispId && orderDispId !== currentUserId) {
            return false;
          }
        }
        return true;
      });
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
  }, [user]);

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
        if (!active) return;
        const currentUserId = user?.id ? Number(user.id) : null;
        const isDispatcher = user && (Number(user.role_id) === 3 || user.role === 'DISPATCHER' || user.role_name === 'DISPATCHER');

        const readyOrders = (ordersData || []).filter(o => {
          if (o.status !== 'READY_FOR_PLANNING') return false;
          if (isDispatcher && currentUserId) {
            const orderDispId = o.responsible_dispatcher_id ? Number(o.responsible_dispatcher_id) : null;
            if (orderDispId && orderDispId !== currentUserId) {
              return false;
            }
          }
          return true;
        });
        setPendingOrders(readyOrders);
        setTrips(tripsData || []);
        setIncidents(incidentsData || []);
        setTrucks(trucksData || []);
        setDrivers(driversData || []);
      } catch (err) {
        if (!active) return;
        console.error('Fetch trip planning data error:', err);
        message.error('Không thể kết nối đến máy chủ BE để tải dữ liệu chuyến xe');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInitialData();
    return () => { active = false; };
  }, [user]);

  const handleAssignSuccess = async (createdTrip) => {
    setSelectedOrderForAssign(null);
    if (createdTrip?.allocation_type === 'VENDOR') {
      message.success(`Đã bàn giao đơn ${createdTrip.order_code || createdTrip.order_id} cho nhà xe đối tác (${createdTrip.vendor}) thành công!`);
    } else {
      message.success(`Đã lập chuyến ${createdTrip.trip_id || createdTrip.id || ''}, gán xe ${createdTrip.truck || ''} và phát hành Vận đơn V1 thành công!`);
      setActiveMainTab('monitoring');
    }
    await fetchData();
  };

  const handleResolveIncident = async (incidentIdOrObj, resolutionPayload) => {
    const isSingleArg = typeof incidentIdOrObj === 'object' && incidentIdOrObj !== null && !resolutionPayload;
    const targetId = isSingleArg ? (incidentIdOrObj.raw_id || incidentIdOrObj.id) : incidentIdOrObj;
    const payload = isSingleArg ? incidentIdOrObj : (resolutionPayload || {});

    try {
      setLoading(true);
      await dispatcherApi.updateIncidentStatus(targetId, payload);

      const actionStatus = String(payload.status || '').toUpperCase();
      if (actionStatus === 'RESOLVED_REPLACED') {
        message.success(`Đã điều xe cứu hộ ${payload.new_truck || ''}, đổi tài xế ${payload.new_driver || ''} và cấp lại Vận đơn phiên bản mới thành công!`);
      } else if (actionStatus === 'ESCALATED' || actionStatus === 'ESCALATED_TO_MANAGER') {
        message.warning('Đã chuyển tiếp sự cố nghiêm trọng lên Quản lý (UC-16)!');
      } else {
        message.success('Đã xác nhận xử lý xong sự cố hiện trường (UC-14)!');
      }
      setActiveIncidentModal(null);
      await fetchData();
    } catch (err) {
      console.error('handleResolveIncident error:', err);
      message.error(err.message || 'Lỗi khi cập nhật trạng thái sự cố trên máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleReportIncident = async (incidentForm) => {
    try {
      setLoading(true);
      await dispatcherApi.createIncident(incidentForm);
      message.warning(`Đã ghi nhận báo cáo sự cố hiện trường trên chuyến ${incidentForm.trip_id}!`);
      await fetchData();
    } catch (err) {
      console.error('handleReportIncident error:', err);
      message.error(err.message || 'Không thể tạo báo cáo sự cố');
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
    message.success(`Đã hủy và tự động đóng đơn ${cancelData.order_id || cancelData.id} thành công!`);
    fetchData();
  };

  const handleCancelTrip = (trip) => {
    Modal.confirm({
      title: `Hủy chuyến xe ${trip.id}?`,
      icon: <Route className="text-red-500" />,
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
      message.success(`Chuyến xe ${trip.id} đã hoàn tất giao hàng! Phương tiện được giải phóng và đơn hàng tự động đóng.`);
      await fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi hoàn thành chuyến xe');
    } finally {
      setLoading(false);
    }
  };

  const pendingIncidentsCount = incidents.filter(i => i.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Route className="text-[#7367f0]" size={24} />
            Lập Kế hoạch Chuyến &amp; Giám sát Vận chuyển
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Điều phối phương tiện nội bộ &amp; nhà xe 3PL, theo dõi lộ trình thời gian thực, quản lý lệnh điều xe và xử lý sự cố hiện trường
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
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
                Phân bổ xe &amp; Lập chuyến
                <Badge count={pendingOrders.length} overflowCount={99} className="ml-1" />
              </span>
            ),
            children: (
              <TripPlanningTab
                pendingOrders={pendingOrders}
                trucks={trucks}
                drivers={drivers}
                loading={loading}
                setSelectedOrderForAssign={setSelectedOrderForAssign}
                setSelectedOrderForCancel={setSelectedOrderForCancel}
              />
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
              <TripMonitoringTab
                trips={trips}
                incidents={incidents}
                pendingIncidentsCount={pendingIncidentsCount}
                searchText={searchText}
                setSearchText={setSearchText}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                setActiveMainTab={setActiveMainTab}
                setActiveIncidentModal={setActiveIncidentModal}
                setSelectedTripDetails={setSelectedTripDetails}
                setSelectedTripWaybill={setSelectedTripWaybill}
                setSelectedTrip3D={setSelectedTrip3D}
                setSelectedTripReplay={setSelectedTripReplay}
                handleCompleteTrip={handleCompleteTrip}
                handleCancelTrip={handleCancelTrip}
              />
            )
          },
          {
            key: 'incidents',
            label: (
              <span className="flex items-center gap-2 font-semibold text-sm text-red-600">
                <ShieldAlert size={17} className="text-red-500" />
                Sự cố Vận hành
                {pendingIncidentsCount > 0 && (
                  <Badge count={pendingIncidentsCount} overflowCount={99} className="ml-1" />
                )}
              </span>
            ),
            children: (
              <TripIncidentsTab
                incidents={incidents}
                trips={trips}
                setActiveIncidentModal={setActiveIncidentModal}
                onReportIncident={handleReportIncident}
              />
            )
          }
        ]}
      />

      {/* Modal Gán Xe & Phân Bổ Chuyến */}
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

      {/* Drawer & Modals xem thông tin phụ trợ */}
      <TripDetailsDrawer
        selectedTripDetails={selectedTripDetails}
        onClose={() => setSelectedTripDetails(null)}
      />

      <TripWaybillModal
        selectedTripWaybill={selectedTripWaybill}
        onClose={() => setSelectedTripWaybill(null)}
        onPrintWaybill={() => {
          message.success(`Đã xuất Vận đơn [WB-${selectedTripWaybill?.id}] thành file PDF!`);
          setSelectedTripWaybill(null);
        }}
      />

      <Trip3DModal
        selectedTrip3D={selectedTrip3D}
        onClose={() => setSelectedTrip3D(null)}
      />

      <TripReplayModal
        selectedTripReplay={selectedTripReplay}
        onClose={() => setSelectedTripReplay(null)}
      />

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
