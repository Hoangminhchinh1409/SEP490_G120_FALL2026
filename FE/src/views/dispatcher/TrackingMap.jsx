import { useState, useEffect, useCallback } from 'react';
import { Input, Badge, Button, Select, message } from 'antd';
import { Search, MapPin, Truck, RefreshCw, Clock, Activity, Play, Square, Radio } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { dispatcherApi } from '../../api/dispatcherApi';
import IncidentDetailsModal from '../../components/dispatcher/IncidentDetailsModal';
import { VIETMAP_TILE_URL, fetchShortestRoadRoute } from '../../utils/roadRouting';
import { getCoordsFromAddress } from '../../data/dispatcherPresets';
import { useAuth } from '../../providers/AuthProvider';
import AccessDenied from '../../components/common/AccessDenied';

const SAFE_VIETMAP_TILE_URL = VIETMAP_TILE_URL;

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
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    if (center) {
      map.flyTo(center, 12, { duration: 1.5 });
    }
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
}

const TrackingMap = () => {
  const { user, hasPermission } = useAuth();
  const allowed = !user || Number(user.role_id) === 1 || Number(user.role_id) === 3 || (hasPermission && hasPermission('TRIP_MONITOR'));
  const [mapCenter, setMapCenter] = useState([21.1285, 105.8542]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTrucks, setActiveTrucks] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [selectedRouteData, setSelectedRouteData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simSpeed, setSimSpeed] = useState(5);
  const [simStatusMap, setSimStatusMap] = useState({});
  const [simLoading, setSimLoading] = useState(false);

  const handleSelectTruck = useCallback(async (truck) => {
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
        const summary = routeRes.trafficSummary;
        if (summary) {
          setActiveTrucks((prev) =>
            prev.map((item) =>
              item.trip_code === truck.trip_code
                ? {
                    ...item,
                    traffic_status: item.has_incident ? 'CONGESTED' : (summary.status || 'SMOOTH'),
                    traffic_note: item.has_incident
                      ? item.traffic_note
                      : (summary.statusLabel || 'Dữ liệu VietMap v4'),
                    speed: item.has_incident || item.speed === '0km/h'
                      ? item.speed
                      : `${summary.avgSpeedKmh || 40}km/h`,
                    eta_live: item.has_incident
                      ? item.eta_live
                      : (routeRes.etaText ? `ETA ${routeRes.etaText} (~${routeRes.durationMins} phút)` : item.eta_live)
                  }
                : item
            )
          );
        }
      }
    } catch {
      // Ignore routing preview errors
    }
  }, []);

  const loadTrackingData = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
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
          const hasSpeed = t.speed_kmh !== undefined && t.speed_kmh !== null;

          return {
            id: t.plate || `XE-${t.raw_id || idx + 1}`,
            trip_code: t.id,
            raw_trip_id: t.raw_id,
            driver_name: t.driver_name,
            driver_phone: t.driver_phone,
            orders: t.orders || [],
            pickup: t.pickup || 'Kho ALS Nội Bài',
            dropoff: t.dropoff || 'Điểm giao hàng',
            route: `${t.pickup} -> ${t.dropoff}`,
            status: hasInc
              ? `Sự cố (${pendingInc?.type || 'Hiện trường'})`
              : t.status === 'COMPLETED'
                ? 'Đã hoàn thành'
                : t.progress >= 85
                  ? 'Sắp đến'
                  : 'Đang di chuyển',
            time: 'Cập nhật tức thời (VietMap GPS)',
            progress: t.progress || 0,
            lat,
            lng,
            speed: hasInc || t.status === 'COMPLETED'
              ? '0km/h'
              : hasSpeed
                ? `${Math.round(Number(t.speed_kmh))}km/h`
                : '--',
            eta_live: hasInc
              ? 'Tạm hoãn (Đang xử lý sự cố)'
              : t.status === 'COMPLETED'
                ? 'Đã đến điểm giao'
                : t.eta_text || 'Đang tính ETA VietMap v4...',
            traffic_status: hasInc ? 'CONGESTED' : 'SMOOTH',
            traffic_note: hasInc
              ? 'Đang dừng xử lý sự cố trên tuyến'
              : 'Chọn xe để tải mật độ giao thông VietMap v4',
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
        if (mapped.length > 0) {
          await handleSelectTruck(mapped[0]);
        }
      } else {
        setActiveTrucks([]);
      }
    } catch (err) {
      console.warn('loadTrackingData fallback:', err);
    } finally {
      setLoading(false);
    }
  }, [allowed, handleSelectTruck]);

  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      if (!active) return;
      await loadTrackingData();
    };
    initLoad();
    return () => {
      active = false;
    };
  }, [loadTrackingData]);

  // Polling trạng thái mô phỏng GPS thời gian thực (600ms/lần) khi có ít nhất 1 chuyến đang chạy mô phỏng
  const hasRunningSim = Object.values(simStatusMap).some((s) => s?.running);
  useEffect(() => {
    if (!allowed || !hasRunningSim) return undefined;
    const poll = setInterval(async () => {
      const sims = await dispatcherApi.getGpsSimulationStatus();
      const nextMap = {};
      sims.forEach((s) => {
        nextMap[s.trip_code] = s;
      });
      setSimStatusMap(nextMap);

      if (sims.length > 0) {
        setActiveTrucks((prev) =>
          prev.map((item) => {
            const sim = nextMap[item.trip_code];
            if (!sim) return item;
            const nowTime = new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            return {
              ...item,
              lat: sim.lat,
              lng: sim.lng,
              progress: sim.progress,
              speed: `${Math.round(sim.speed_kmh || 0)}km/h`,
              status: sim.progress >= 100
                ? 'Đã hoàn thành'
                : sim.progress >= 85
                  ? 'Sắp đến'
                  : 'Đang di chuyển',
              time: `GPS Live ${nowTime}`
            };
          })
        );
      }
    }, 600);
    return () => clearInterval(poll);
  }, [allowed, hasRunningSim]);

  const handleStartGpsSim = async () => {
    if (!selectedTruck) return;
    try {
      setSimLoading(true);
      const tripKey = selectedTruck.raw_trip_id || selectedTruck.trip_code;
      const res = await dispatcherApi.startGpsSimulation(tripKey, {
        speed_multiplier: simSpeed,
        polyline: selectedRouteData?.polyline || null
      });
      if (res?.simulation) {
        setSimStatusMap((prev) => ({
          ...prev,
          [res.simulation.trip_code]: res.simulation
        }));
        message.success(res.message || 'Đã bật mô phỏng GPS trực tuyến!');
      }
    } catch (err) {
      message.error(err.message || 'Không thể bật mô phỏng GPS');
    } finally {
      setSimLoading(false);
    }
  };

  const handleStopGpsSim = async () => {
    if (!selectedTruck) return;
    try {
      setSimLoading(true);
      const tripKey = selectedTruck.raw_trip_id || selectedTruck.trip_code;
      await dispatcherApi.stopGpsSimulation(tripKey);
      setSimStatusMap((prev) => {
        const copy = { ...prev };
        delete copy[selectedTruck.trip_code];
        return copy;
      });
      message.info(`Đã dừng mô phỏng GPS chuyến ${selectedTruck.trip_code}`);
    } catch (err) {
      message.error(err.message || 'Lỗi khi dừng mô phỏng GPS');
    } finally {
      setSimLoading(false);
    }
  };

  const handleResolveIncident = async (incidentId, payload) => {
    try {
      const res = await dispatcherApi.updateIncidentStatus(incidentId, payload);
      const updatedInc = res?.incident || res;
      const actionStatus = String(payload?.status || '').toUpperCase();
      if (!actionStatus && payload?.type) {
        message.success('Đã cập nhật phân loại sự cố.');
        setSelectedIncident((prev) =>
          prev
            ? {
                ...prev,
                ...(updatedInc && typeof updatedInc === 'object' ? updatedInc : {}),
                raw_type: payload.type
              }
            : prev
        );
      } else {
        message.success('Đã xử lý sự cố và cập nhật lộ trình phương tiện trực tuyến!');
        setSelectedIncident(null);
      }
      await loadTrackingData();
    } catch (err) {
      message.error(err.message || 'Lỗi khi xử lý sự cố');
      if (err && typeof err === 'object') err._handledToast = true;
      throw err;
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

  if (!allowed) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <AccessDenied moduleName="Bản đồ Theo dõi &amp; Giám sát GPS (TRIP_MONITOR)" />
      </div>
    );
  }

  return (
    <div className="p-0 w-full h-full min-h-[640px] flex flex-col md:flex-row overflow-hidden relative">
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
      <div className="flex-1 h-[65%] md:h-full min-h-[640px] relative z-[1]">
        <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', minHeight: '640px', width: '100%' }} zoomControl={false}>
          <TileLayer
            key="vietmap-live-tile"
            attribution='&copy; VietMap Tilemap'
            url={SAFE_VIETMAP_TILE_URL}
            maxZoom={20}
          />

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

        {/* Thanh điều khiển Mô phỏng GPS Demo góc trái trên */}
        {selectedTruck && (
          <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-indigo-200 shadow-md flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <Radio size={14} className={simStatusMap[selectedTruck.trip_code]?.running ? 'text-emerald-600 animate-pulse' : 'text-indigo-500'} />
              GPS Demo ({selectedTruck.trip_code})
            </span>
            <Select
              size="small"
              value={simSpeed}
              onChange={setSimSpeed}
              className="w-16"
              disabled={Boolean(simStatusMap[selectedTruck.trip_code]?.running)}
              options={[
                { value: 1, label: '1x' },
                { value: 5, label: '5x' },
                { value: 10, label: '10x' }
              ]}
            />
            {simStatusMap[selectedTruck.trip_code]?.running ? (
              <Button
                size="small"
                danger
                icon={<Square size={12} />}
                loading={simLoading}
                onClick={handleStopGpsSim}
                className="font-semibold text-xs"
              >
                Dừng
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                icon={<Play size={12} />}
                loading={simLoading}
                onClick={handleStartGpsSim}
                className="bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs"
              >
                Chạy mô phỏng GPS
              </Button>
            )}
          </div>
        )}

        {/* Nhãn VietMap góc phải trên */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/95 text-indigo-900 border border-indigo-200 shadow">
            Bản đồ: VietMap Official
          </span>
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
        onClaimCreated={loadTrackingData}
      />
    </div>
  );
};

export default TrackingMap;
