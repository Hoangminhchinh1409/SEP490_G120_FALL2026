import { useState, useEffect, useCallback } from 'react';
import { Input, Badge, Button, message } from 'antd';
import { Search, MapPin, Truck, RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { dispatcherApi } from '../../api/dispatcherApi';
import IncidentDetailsModal from '../../components/dispatcher/IncidentDetailsModal';

// Dữ liệu mặc định dự phòng khi chưa có chuyến đang chạy
const fallbackTrucks = [
  { id: '29H-995.72', trip_code: 'TRIP-9993', route: 'KCN Tiên Sơn -> Ga Nội Bài NCTS', status: 'Sự cố (Hỏng xe)', time: 'Cập nhật 2 phút trước', progress: 45, lat: 21.1963, lng: 105.9525, speed: '0km/h', has_incident: true },
  { id: '29H-767.99', trip_code: 'TRIP-8821', route: 'Nội Bài -> Cụm CN Lai Xá (Lô 2)', status: 'Đang di chuyển', time: 'Cập nhật 1 phút trước', progress: 65, lat: 21.0785, lng: 105.7442, speed: '52km/h', has_incident: false },
  { id: '29C-456.78', trip_code: 'TRIP-7712', route: 'Yên Phong -> Cảng Hải Phòng', status: 'Sắp đến', time: 'Cập nhật 30 giây trước', progress: 90, lat: 20.8649, lng: 106.6581, speed: '58km/h', has_incident: false },
  { id: '29A-112.34', trip_code: 'TRIP-6610', route: 'ALS Nội Bài -> Hà Nội', status: 'Đang bốc dỡ', time: 'Cập nhật 5 phút trước', progress: 20, lat: 21.0285, lng: 105.8542, speed: '0km/h', has_incident: false }
];

// Custom Truck Marker Icon using DivIcon
const createCustomIcon = (truck) => {
  const isMoving = truck.status === 'Đang di chuyển';
  const colorClass = truck.status.includes('Sự cố')
    ? 'bg-red-600'
    : isMoving
      ? 'bg-green-500'
      : truck.status === 'Sắp đến'
        ? 'bg-blue-500'
        : 'bg-orange-500';

  return L.divIcon({
    className: 'custom-truck-marker',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="w-4 h-4 ${colorClass} rounded-full border-2 border-white shadow-md z-10 ${isMoving ? 'animate-pulse' : ''}"></div>
        <div class="absolute top-5 bg-white px-2 py-0.5 rounded shadow-lg border border-gray-100 whitespace-nowrap text-[10px] font-bold text-gray-700 pointer-events-none">
          ${truck.id}
        </div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

// Map Controller to change view dynamically when clicking a truck
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 12, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

const TrackingMap = () => {
  const [mapCenter, setMapCenter] = useState([21.1285, 105.8542]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTrucks, setActiveTrucks] = useState(fallbackTrucks);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTrackingData = useCallback(async () => {
    setLoading(true);
    try {
      const [tripsData, incidentsData] = await Promise.all([
        dispatcherApi.getTrips().catch(() => []),
        dispatcherApi.getIncidents().catch(() => [])
      ]);

      setIncidents(incidentsData || []);

      if (Array.isArray(tripsData) && tripsData.length > 0) {
        const mapped = tripsData.slice(0, 12).map((t, idx) => {
          const pendingInc = (incidentsData || []).find(
            i => i.trip_code === t.id && i.status !== 'RESOLVED'
          );
          const hasInc = Boolean(t.has_incident || pendingInc);
          const lat = t.current_coords?.lat || (21.18 - idx * 0.035);
          const lng = t.current_coords?.lng || (105.82 + idx * 0.045);

          return {
            id: t.plate || `29H-${100 + idx}.88`,
            trip_code: t.id,
            raw_trip_id: t.raw_id,
            driver_name: t.driver_name,
            driver_phone: t.driver_phone,
            orders: t.orders || [],
            route: `${t.pickup} -> ${t.dropoff}`,
            status: hasInc
              ? `Sự cố (${pendingInc?.type || 'Hiện trường'})`
              : t.status === 'COMPLETED'
                ? 'Đã hoàn thành'
                : t.progress >= 85
                  ? 'Sắp đến'
                  : 'Đang di chuyển',
            time: 'Cập nhật tức thời (GPS)',
            progress: t.progress || 35,
            lat,
            lng,
            speed: hasInc || t.status === 'COMPLETED' ? '0km/h' : '54km/h',
            has_incident: hasInc,
            incident: pendingInc || (hasInc ? {
              id: t.incident_id || `INC-${t.raw_id || 9}`,
              raw_id: Number(String(t.incident_id || '9').replace(/\D/g, '')) || 9,
              trip_code: t.id,
              truck: t.plate,
              driver: t.driver_name,
              phone: t.driver_phone,
              type: 'HỎNG XE GIỮA ĐƯỜNG',
              description: t.late_reason || 'Xe gặp sự cố trên hành trình vận chuyển'
            } : null)
          };
        });
        setActiveTrucks(mapped);
      }
    } catch (err) {
      console.warn('loadTrackingData fallback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrackingData();
  }, [loadTrackingData]);

  const handleResolveIncident = async (incidentId, payload) => {
    try {
      await dispatcherApi.updateIncidentStatus(incidentId, payload);
      message.success('Đã xử lý sự cố và cập nhật lộ trình phương tiện trực tuyến!');
      setSelectedIncident(null);
      await loadTrackingData();
    } catch (err) {
      message.error(err.message || 'Lỗi khi xử lý sự cố');
    }
  };

  const filteredTrucks = activeTrucks.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.id?.toLowerCase().includes(q) ||
      item.trip_code?.toLowerCase().includes(q) ||
      item.route?.toLowerCase().includes(q) ||
      (item.orders || []).some(o => o.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-0 h-full flex flex-col md:flex-row overflow-hidden relative">
      {/* Sidebar - Danh sách Xe */}
      <div className="w-full md:w-85 bg-white border-r border-gray-200 h-[35%] md:h-full flex flex-col flex-shrink-0 z-[1000] shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">Theo dõi trực tuyến</h2>
            <Button
              size="small"
              icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
              onClick={loadTrackingData}
            />
          </div>
          <Input
            placeholder="Tìm biển số xe, mã chuyến, mã đơn..."
            prefix={<Search size={16} className="text-gray-400" />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-2">
          {filteredTrucks.map((item) => (
            <div
              key={`${item.id}-${item.trip_code}`}
              className="p-3 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors border border-gray-100 mb-1 flex flex-col items-start gap-1 w-full bg-white shadow-xs"
              onClick={() => setMapCenter([item.lat, item.lng])}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="w-10 h-10 rounded-full bg-[#e0f9fc] text-[#00cfe8] flex items-center justify-center flex-shrink-0">
                  <Truck size={20} />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between items-center w-full gap-1">
                    <span className="font-bold text-gray-800 font-mono text-xs">
                      {item.id} <span className="text-[#7367f0]">({item.trip_code})</span>
                    </span>
                    <Badge
                      status={item.status === 'Đang di chuyển' ? 'success' : item.status.includes('Sự cố') ? 'error' : 'processing'}
                      text={item.status}
                      className="text-xs"
                    />
                  </div>
                  <div className="mt-1">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1 truncate">
                      <MapPin size={12} className="shrink-0" /> {item.route}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full ${item.status.includes('Sự cố') ? 'bg-red-500' : 'bg-[#7367f0]'}`}
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-gray-400">{item.time}</span>
                      <span className="text-[10px] font-semibold text-[#7367f0]">{item.progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
              {item.status.includes('Sự cố') && (
                <Button
                  size="small"
                  danger
                  className="mt-2 w-full text-xs font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIncident(
                      item.incident ||
                      incidents[0] || {
                        id: 'INC-9',
                        raw_id: 9,
                        trip_code: item.trip_code || 'TRIP-9993',
                        truck: item.id,
                        driver: item.driver_name || 'Nguyễn Văn Lái',
                        phone: item.driver_phone || '0901234567',
                        type: 'HỎNG XE GIỮA ĐƯỜNG',
                        description: `Xe ${item.id} gặp sự cố kỹ thuật trên tuyến ${item.route}`
                      }
                    );
                  }}
                >
                  Điều xe Thay thế Cấp cứu (UC-15)
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leaflet Map Integration */}
      <div className="flex-1 h-[65%] md:h-full relative z-[1]">
        <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; Google Maps'
            url="https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}"
          />

          <MapController center={mapCenter} />

          {filteredTrucks.map((truck) => (
            <Marker key={`${truck.id}-${truck.trip_code}`} position={[truck.lat, truck.lng]} icon={createCustomIcon(truck)}>
              <Popup className="custom-popup">
                <div className="font-sans">
                  <h3 className="font-bold text-gray-800 text-sm mb-1">{truck.id} ({truck.trip_code})</h3>
                  <p className="text-xs text-gray-600 mb-1"><b>Tài xế:</b> {truck.driver_name || 'Nguyễn Văn Lái'}</p>
                  <p className="text-xs text-gray-600 mb-1"><b>Tuyến:</b> {truck.route}</p>
                  <p className="text-xs text-gray-600 mb-1"><b>Tốc độ:</b> <span className="text-green-600 font-semibold">{truck.speed}</span></p>
                  <p className="text-xs text-gray-600"><b>Trạng thái:</b> {truck.status}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <IncidentDetailsModal
        open={Boolean(selectedIncident)}
        incident={selectedIncident}
        onCancel={() => setSelectedIncident(null)}
        onResolveSuccess={handleResolveIncident}
      />
    </div>
  );
};

export default TrackingMap;
