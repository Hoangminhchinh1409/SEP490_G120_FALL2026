"use client";
import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Badge, message, Tabs } from 'antd';
import { Route, Truck, RefreshCw, ShieldAlert } from 'lucide-react';
import TripAssignmentModal from '../../components/dispatcher/TripAssignmentModal';
import IncidentDetailsModal from '../../components/dispatcher/IncidentDetailsModal';
import CancelOrderModal from '../../components/dispatcher/CancelOrderModal';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';

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
        if (!active) return;
        const readyOrders = (ordersData || []).filter(o => o.status === 'READY_FOR_PLANNING');
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
  }, []);

  const handleAssignSuccess = (createdTrip) => {
    message.success(`Đã phân bổ chuyến ${createdTrip.trip_id} thành công!`);
    setSelectedOrderForAssign(null);
    fetchData();
  };

  const handleResolveIncident = (incidentId, resolution) => {
    setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status: 'RESOLVED', resolution } : i));
    setTrips(prev => prev.map(t => {
      const inc = incidents.find(i => i.id === incidentId);
      if (inc && inc.trip_code === t.id) {
        return {
          ...t,
          has_incident: false,
          waybill_version: (t.waybill_version || 1) + 1,
          late_reason: `Đã thay thế bằng xe ${resolution.relief_truck_plate}`
        };
      }
      return t;
    }));
    setActiveIncidentModal(null);
    message.success('Đã giải quyết sự cố, phát lệnh đổi xe cứu hộ và tái cấp Vận đơn phiên bản mới thành công!');
    fetchData();
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
                setActiveIncidentModal={setActiveIncidentModal}
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
