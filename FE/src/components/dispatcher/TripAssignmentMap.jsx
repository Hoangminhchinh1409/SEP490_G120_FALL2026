'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export default function TripAssignmentMap({ stops = [], routePolyline = [], loadingRoute = false }) {
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

  // Tuyệt đối chỉ vẽ polyline khi đã có tọa độ hình học ôm sát đường bộ (không vẽ đường thẳng chim bay nối các điểm)
  const polylinePositions = useMemo(() => {
    if (Array.isArray(routePolyline) && routePolyline.length > 1) {
      return routePolyline;
    }
    return [];
  }, [routePolyline]);

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
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          maxZoom={20}
        />

        <MultiStopBoundsUpdater stops={stops} routePolyline={polylinePositions} />

        {stops.map(stop => {
          const pos = getStopPosition(stop);
          if (!pos) return null;
          return (
            <Marker
              key={stop.id}
              position={pos}
              icon={createStopMarkerIcon(stop)}
            >
              <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.95}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontWeight: 800, color: '#2563eb' }}>{stop.badge}: </span>
                  <span>{stop.name?.split(':')[1]?.trim() || stop.name}</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <b className="text-indigo-600">{stop.name}</b>
                  <div className="text-gray-500 mt-1">{stop.action} · {stop.eta}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            color="#2563eb"
            weight={5}
            opacity={0.9}
          />
        )}
      </MapContainer>

      {loadingRoute && (
        <div className="absolute top-2.5 left-2.5 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1 rounded-md shadow-sm border border-blue-200 text-[11px] font-semibold text-blue-700">
          Đang tính lộ trình đường bộ ngắn nhất...
        </div>
      )}
    </div>
  );
}
