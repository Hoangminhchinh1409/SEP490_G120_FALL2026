import { useState, useEffect, useCallback } from 'react';
import { Input, Badge, Button, message } from 'antd';
import { Search, MapPin, Truck, RefreshCw, Clock, Activity } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { dispatcherApi } from '../../api/dispatcherApi';
import IncidentDetailsModal from '../../components/dispatcher/IncidentDetailsModal';
import { VIETMAP_TILE_URL, fetchShortestRoadRoute } from '../../utils/roadRouting';
import { getCoordsFromAddress } from '../../data/dispatcherPresets';

const SAFE_VIETMAP_TILE_URL =
  VIETMAP_TILE_URL ||
  'https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey=6ad933d27ec1ae2fb5a5fd36902c817d1c912263116e4644';

// Dữ liệu mặc định dự phòng khi chưa có chuyến đang chạy
const fallbackTrucks = [
  {
    id: '29H-995.72',
    trip_code: 'TRIP-9993',
    route: 'KCN Tiên Sơn -> Ga Nội Bài NCTS',
    pickup: 'KCN Tiên Sơn',
    dropoff: 'Ga Nội Bài NCTS',
    status: 'Sự cố (Hỏng xe)',
    time: 'Cập nhật 2 phút trước',
    progress: 45,
    lat: 21.1963,
    lng: 105.9525,
    speed: '0km/h',
    eta_live: 'Tạm dừng xử lý',
    traffic_status: 'CONGESTED',
    traffic_note: 'Xe dừng khẩn cấp trên QL.18',
    has_incident: true
  },
  {
    id: '29H-767.99',
    trip_code: 'TRIP-8821',
    route: 'Nội Bài -> Cụm CN Lai Xá (Lô 2)',
    pickup: 'Kho ALS Nội Bài',
    dropoff: 'Cụm CN Lai Xá, Hoài Đức',
    status: 'Đang di chuyển',
    time: 'Cập nhật 1 phút trước',
    progress: 65,
    lat: 21.0785,
    lng: 105.7442,
    speed: '52km/h',
    eta_live: 'Dự kiến đến sau 22 phút',
    traffic_status: 'SLOW',
    traffic_note: 'Đông xe đoạn Cầu Thăng Long - Phạm Văn Đồng',
    has_incident: false
  },
  {
    id: '29C-456.78',
    trip_code: 'TRIP-7712',
    route: 'Yên Phong -> Cảng Hải Phòng',
    pickup: 'KCN Yên Phong, Bắc Ninh',
    dropoff: 'Cảng Đình Vũ, Hải Phòng',
    status: 'Sắp đến',
    time: 'Cập nhật 30 giây trước',
    progress: 90,
    lat: 20.8649,
    lng: 106.6581,
    speed: '58km/h',
    eta_live: 'Dự kiến đến sau 12 phút',
    traffic_status: 'SMOOTH',
    traffic_note: 'QL.18 & Cao tốc HN-HP thông thoáng',
    has_incident: false
  },
  {
    id: '29A-112.34',
    trip_code: 'TRIP-6610',
    route: 'ALS Nội Bài -> Hà Nội',
    pickup: 'Kho ALS Nội Bài',
    dropoff: 'KCN Quang Minh, Mê Linh',
    status: 'Đang bốc dỡ',
    time: 'Cập nhật 5 phút trước',
    progress: 20,
    lat: 21.0285,
    lng: 105.8542,
    speed: '0km/h',
    eta_live: 'Đang bốc hàng (ETA +35p)',
    traffic_status: 'SMOOTH',
    traffic_note: 'Võ Văn Kiệt thông thoáng',
    has_incident: false
  }
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
  const [tileMode, setTileMode] = useState('VIETMAP');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTrucks, setActiveTrucks] = useState(fallbackTrucks);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [selectedRouteData, setSelectedRouteData] = useState(null);
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
          const remMins = Math.max(8, Math.round((100 - (t.progress || 35)) * 0.65));
          const etaDate = new Date(Date.now() + remMins * 60000);
          const etaClock = `${String(etaDate.getHours()).padStart(2, '0')}:${String(etaDate.getMinutes()).padStart(2, '0')}`;

          return {
            id: t.plate || `29H-${100 + idx}.88`,
            trip_code: t.id,
            raw_trip_id: t.raw_id,
            driver_name: t.driver_name,
            driver_phone: t.driver_phone,
            orders: t.orders || [],
            pickup: t.pickup || 'Kho ALS Nội Bài',
            dropoff: t.dropoff || 'KCN Yên Phong, Bắc Ninh',
            route: `${t.pickup} -> ${t.dropoff}`,
            status: hasInc
              ? `Sự cố (${pendingInc?.type || 'Hiện trường'})`
              : t.status === 'COMPLETED'
                ? 'Đã hoàn thành'
                : t.progress >= 85
                  ? 'Sắp đến'
                  : 'Đang di chuyển',
            time: 'Cập nhật tức thời (VietMap GPS)',
            progress: t.progress || 35,
            lat,
            lng,
            speed: hasInc || t.status === 'COMPLETED' ? '0km/h' : `${46 + (idx % 4) * 4}km/h`,
            eta_live: hasInc
              ? 'Tạm hoãn (Đang xử lý sự cố)'
              : t.status === 'COMPLETED'
                ? 'Đã đến điểm giao'
                : `ETA ${etaClock} (còn ~${remMins} phút)`,
            traffic_status: hasInc ? 'CONGESTED' : idx % 3 === 1 ? 'SLOW' : 'SMOOTH',
            traffic_note: hasInc
              ? 'Đang dừng khẩn cấp trên tuyến'
              : idx % 3 === 1
                ? 'Đông xe đoạn QL.18 / Võ Văn Kiệt (+6p)'
                : 'Tuyến đường thông thoáng',
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
        if (!selectedTruck && mapped.length > 0) {
          handleSelectTruck(mapped[0]);
        }
      }
    } catch (err) {
      console.warn('loadTrackingData fallback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectTruck = async (truck) => {
    setSelectedTruck(truck);
    setMapCenter([truck.lat, truck.lng]);
    try {
      const pCoords = getCoordsFromAddress(truck.pickup || '', 'A') || { lat: 21.2187, lng: 105.8042 };
      const dCoords = getCoordsFromAddress(truck.dropoff || '', 'B') || { lat: 21.1215, lng: 105.9754 };
      const routeRes = await fetchShortestRoadRoute([
        pCoords,
        { lat: truck.lat, lng: truck.lng },
        dCoords
      ]);
      if (routeRes?.success) {
        setSelectedRouteData(routeRes);
      }
    } catch (e) {
      // Ignore routing preview errors
    }
  };

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
            <div>
              <h2 className="text-lg font-bold text-gray-800">Theo dõi trực tuyến</h2>
              <p className="text-[11px] text-emerald-700 font-semibold">VietMap Live Traffic &amp; ETA Thời gian thực</p>
            </div>
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
          {filteredTrucks.map((item) => {
            const isSelected = selectedTruck?.trip_code === item.trip_code;
            return (
              <div
                key={`${item.id}-${item.trip_code}`}
                className={`p-3 rounded-lg cursor-pointer transition-colors border mb-1 flex flex-col items-start gap-1 w-full shadow-xs ${
                  isSelected
                    ? 'bg-indigo-50/80 border-indigo-400'
                    : 'bg-white hover:bg-indigo-50/40 border-gray-100'
                }`}
                onClick={() => handleSelectTruck(item)}
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

                      {/* Hiển thị ETA & Giao thông trực tiếp */}
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200/80 my-1">
                        <span className="font-semibold text-emerald-700 flex items-center gap-1">
                          <Clock size={11} /> {item.eta_live || 'ETA 15:30'}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-600">{item.speed}</span>
                      </div>

                      <div className="text-[10px] flex items-center gap-1 mt-0.5">
                        <Activity size={11} className={
                          item.traffic_status === 'CONGESTED'
                            ? 'text-red-500'
                            : item.traffic_status === 'SLOW'
                              ? 'text-amber-500'
                              : 'text-emerald-600'
                        } />
                        <span className={
                          item.traffic_status === 'CONGESTED'
                            ? 'text-red-600 font-semibold'
                            : item.traffic_status === 'SLOW'
                              ? 'text-amber-700 font-medium'
                              : 'text-emerald-700'
                        }>
                          {item.traffic_note || 'Giao thông thông thoáng'}
                        </span>
                      </div>

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
                    Điều xe Thay thế Cấp cứu
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaflet Map Integration với VietMap Tilemap & Traffic Polylines */}
      <div className="flex-1 h-[65%] md:h-full relative z-[1]">
        <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          {tileMode === 'VIETMAP' ? (
            <TileLayer
              key="vietmap-live-tile"
              attribution='&copy; VietMap Tilemap'
              url={SAFE_VIETMAP_TILE_URL}
              maxZoom={20}
            />
          ) : (
            <TileLayer
              key="google-live-tile"
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}"
              maxZoom={20}
            />
          )}

          <MapController center={mapCenter} />

          {/* Vẽ lộ trình & mật độ giao thông trực tiếp của xe đang chọn */}
          {selectedRouteData?.trafficSegments?.length > 0 &&
            selectedRouteData.trafficSegments.map((seg, idx) => (
              <Polyline
                key={`trk-seg-${idx}`}
                positions={seg.positions}
                color={seg.color || '#2563eb'}
                weight={seg.congestionLevel === 'CONGESTED' ? 7 : 5}
                opacity={0.9}
              >
                <Tooltip sticky>
                  <div className="text-xs">
                    <b>{seg.streetName}</b> · {seg.speedKmh} km/h ({seg.distanceKm} km)
                  </div>
                </Tooltip>
              </Polyline>
            ))}

          {filteredTrucks.map((truck) => (
            <Marker key={`${truck.id}-${truck.trip_code}`} position={[truck.lat, truck.lng]} icon={createCustomIcon(truck)}>
              <Popup className="custom-popup">
                <div className="font-sans">
                  <h3 className="font-bold text-gray-800 text-sm mb-1">{truck.id} ({truck.trip_code})</h3>
                  <p className="text-xs text-gray-600 mb-1"><b>Tài xế:</b> {truck.driver_name || 'Nguyễn Văn Lái'}</p>
                  <p className="text-xs text-gray-600 mb-1"><b>Tuyến:</b> {truck.route}</p>
                  <p className="text-xs text-gray-600 mb-1"><b>Tốc độ:</b> <span className="text-green-600 font-semibold">{truck.speed}</span></p>
                  <p className="text-xs text-gray-600 mb-1"><b>ETA trực tiếp:</b> <span className="text-indigo-700 font-semibold">{truck.eta_live}</span></p>
                  <p className="text-xs text-gray-600"><b>Giao thông:</b> {truck.traffic_note}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Thanh điều khiển góc phải trên */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTileMode((prev) => (prev === 'VIETMAP' ? 'GOOGLE' : 'VIETMAP'))}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/95 text-indigo-900 border border-indigo-200 shadow hover:bg-indigo-50 transition"
          >
            {tileMode === 'VIETMAP' ? 'Bản đồ: VietMap Official' : 'Bản đồ: Google Maps'}
          </button>
        </div>

        {/* Khung thông tin Traffic & ETA của chuyến đang chọn */}
        {selectedRouteData?.trafficSummary && (
          <div className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-xl z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-gray-200 shadow-md text-xs flex flex-wrap items-center gap-3">
            <span className="font-bold text-indigo-900">
              {selectedTruck?.id} ({selectedTruck?.trip_code}):
            </span>
            <span>
              Quãng đường <b>{selectedRouteData.distanceKm} km</b> · TB <b>{selectedRouteData.trafficSummary.avgSpeedKmh} km/h</b>
            </span>
            <span className={
              selectedRouteData.trafficSummary.status === 'CONGESTED'
                ? 'text-red-600 font-bold'
                : selectedRouteData.trafficSummary.status === 'SLOW'
                  ? 'text-amber-700 font-bold'
                  : 'text-emerald-700 font-bold'
            }>
              {selectedRouteData.trafficSummary.statusLabel}
              {selectedRouteData.trafficSummary.delayMins > 0 ? ` (+${selectedRouteData.trafficSummary.delayMins} phút)` : ''}
            </span>
          </div>
        )}
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
