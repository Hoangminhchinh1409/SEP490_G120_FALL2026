'use client';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VIETMAP_TILE_URL } from '../../utils/roadRouting';

const SAFE_VIETMAP_TILE_URL =
  VIETMAP_TILE_URL ||
  'https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey=6ad933d27ec1ae2fb5a5fd36902c817d1c912263116e4644';

// Component cập nhật bounds khi danh sách stops hoặc tuyến đường bộ thay đổi
function MultiStopBoundsUpdater({ stops, routePolyline }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const validCoords =
      routePolyline && routePolyline.length > 2
        ? routePolyline
        : (stops || [])
            .map((s) => (s.coords ? [s.coords.lat, s.coords.lng] : s.lat && s.lng ? [s.lat, s.lng] : null))
            .filter((c) => c && typeof c[0] === 'number' && typeof c[1] === 'number');

    if (validCoords.length === 0) return;

    const timer = setTimeout(() => {
      try {
        const container = map.getContainer();
        if (!container || !container.offsetParent) return;
        map.invalidateSize();

        if (validCoords.length > 1) {
          const bounds = L.latLngBounds(validCoords);
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              padding: [42, 42],
              maxZoom: 15,
              animate: false
            });
          }
        } else {
          map.setView(validCoords[0], 13, { animate: false });
        }
      } catch (err) {
        // Safe catch for unmounted container
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [stops, routePolyline?.length, map]);

  return null;
}

const createStopMarkerIcon = (stop) => {
  const isStart = stop.type === 'START';
  const isRest = stop.type === 'REST';
  const isPickup = stop.type === 'PICKUP';

  let bgColor = '#10b981'; // Giao hàng (Xanh lá)
  if (isStart) bgColor = '#334155'; // Bãi xe (Xám xanh)
  if (isRest) bgColor = '#f59e0b'; // Trạm nghỉ (Hổ phách)
  if (isPickup) bgColor = '#2563eb'; // Lấy hàng (Xanh dương)

  return L.divIcon({
    className: `stop-marker-${stop.id}`,
    html: `
      <div style="background-color: ${bgColor}; width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 800;">
        ${stop.badge || stop.id}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
};

export default function TripAssignmentMap({
  stops = [],
  routePolyline = [],
  trafficSegments = [],
  trafficSummary = null,
  loadingRoute = false
}) {
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);

  const getStopPosition = (stop) => {
    if (stop?.coords && typeof stop.coords.lat === 'number' && typeof stop.coords.lng === 'number') {
      return [stop.coords.lat, stop.coords.lng];
    }
    if (typeof stop?.lat === 'number' && typeof stop?.lng === 'number') {
      return [stop.lat, stop.lng];
    }
    return null;
  };

  const defaultCenter = useMemo(() => {
    for (const stop of stops) {
      const pos = getStopPosition(stop);
      if (pos) return pos;
    }
    return [21.12, 105.90];
  }, [stops]);

  const polylinePositions = useMemo(() => {
    if (Array.isArray(routePolyline) && routePolyline.length > 1) {
      return routePolyline;
    }
    return [];
  }, [routePolyline]);

  const hasTrafficSegments = showTrafficLayer && Array.isArray(trafficSegments) && trafficSegments.length > 0;

  return (
    <div className="w-full h-full relative" style={{ minHeight: '340px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={11}
        style={{ width: '100%', height: '100%', minHeight: '340px' }}
        scrollWheelZoom={true}
        maxZoom={20}
      >
        <TileLayer
          key="vietmap-tiles"
          attribution='&copy; VietMap Tilemap Live'
          url={SAFE_VIETMAP_TILE_URL}
          maxZoom={20}
        />

        <MultiStopBoundsUpdater stops={stops} routePolyline={polylinePositions} />

        {stops.map((stop) => {
          const pos = getStopPosition(stop);
          if (!pos) return null;
          return (
            <Marker
              key={stop.id}
              position={pos}
              icon={createStopMarkerIcon(stop)}
            >
              <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.95}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontWeight: 800, color: '#2563eb' }}>{stop.badge}: </span>
                  <span>{stop.name?.split(':')[1]?.trim() || stop.name}</span>
                  {stop.liveEtaTime && (
                    <span style={{ marginLeft: 4, color: '#059669', fontWeight: 700 }}>({stop.liveEtaTime})</span>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <b className="text-indigo-600">{stop.name}</b>
                  <div className="text-gray-600 mt-1">{stop.action} · <b className="text-emerald-700">{stop.eta}</b></div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Vẽ từng đoạn đường theo màu mật độ giao thông trực tiếp (VietMap Traffic Segments) */}
        {hasTrafficSegments ? (
          trafficSegments.map((seg, idx) => (
            <Polyline
              key={`seg-${idx}`}
              positions={seg.positions}
              color={seg.color || '#2563eb'}
              weight={seg.congestionLevel === 'CONGESTED' ? 7 : seg.congestionLevel === 'SLOW' ? 6 : 5}
              opacity={0.92}
            >
              <Tooltip sticky>
                <div className="text-[11px] leading-snug">
                  <div className="font-bold text-slate-800">{seg.streetName}</div>
                  <div>
                    Tốc độ thực tế: <b>{seg.speedKmh} km/h</b> · {seg.distanceKm} km
                  </div>
                  <div
                    style={{
                      color:
                        seg.congestionLevel === 'CONGESTED'
                          ? '#dc2626'
                          : seg.congestionLevel === 'SLOW'
                            ? '#d97706'
                            : '#16a34a',
                      fontWeight: 700
                    }}
                  >
                    {seg.congestionLevel === 'CONGESTED'
                      ? 'Ùn tắc / Di chuyển chậm'
                      : seg.congestionLevel === 'SLOW'
                        ? 'Đông phương tiện'
                        : 'Thông thoáng'}
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          ))
        ) : (
          polylinePositions.length > 1 && (
            <Polyline
              positions={polylinePositions}
              color="#2563eb"
              weight={5}
              opacity={0.9}
            />
          )
        )}
      </MapContainer>

      {/* Nút bật/tắt Lớp Giao thông VietMap Live */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowTrafficLayer((prev) => !prev)}
          className={`px-2 py-1 rounded text-[10px] font-bold shadow-sm border transition ${
            showTrafficLayer
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-white/95 text-gray-700 border-gray-300'
          }`}
        >
          {showTrafficLayer ? 'VietMap Traffic Live: BẬT' : 'VietMap Traffic Live: TẮT'}
        </button>
      </div>

      {loadingRoute && (
        <div className="absolute top-2.5 left-2.5 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1 rounded-md shadow-sm border border-blue-200 text-[11px] font-semibold text-blue-700">
          Đang đồng bộ VietMap Traffic &amp; ETA trực tiếp...
        </div>
      )}

      {/* Chú giải mật độ giao thông & Cảnh báo tắc đường thời gian thực */}
      {!loadingRoute && polylinePositions.length > 1 && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <div className="flex items-center gap-2.5 font-semibold text-gray-700">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] inline-block" /> Thông thoáng (&gt;38km/h)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block" /> Đông xe (22-38km/h)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] inline-block" /> Ùn tắc (&lt;22km/h)
            </span>
          </div>
          {trafficSummary && (
            <div className="font-semibold text-right">
              {trafficSummary.status === 'CONGESTED' ? (
                <span className="text-red-600">
                  ⚠ {trafficSummary.statusLabel} (+{trafficSummary.delayMins}p)
                </span>
              ) : trafficSummary.status === 'SLOW' ? (
                <span className="text-amber-600">
                  ⚡ {trafficSummary.statusLabel} (+{trafficSummary.delayMins}p)
                </span>
              ) : (
                <span className="text-emerald-700">
                  ✓ Tuyến đường thông thoáng · TB {trafficSummary.avgSpeedKmh} km/h
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
