'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component cập nhật bounds khi danh sách stops thay đổi
function MultiStopBoundsUpdater({ stops }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !stops || stops.length === 0) return;

    const validCoords = stops
      .filter(s => s.lat && s.lng)
      .map(s => [s.lat, s.lng]);

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
              padding: [45, 45],
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
  }, [stops, map]);

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

export default function TripAssignmentMap({ stops = [], routePolyline = [] }) {
  const defaultCenter = useMemo(() => {
    const valid = stops.filter(s => s.lat && s.lng);
    if (valid.length > 0) {
      return [valid[0].lat, valid[0].lng];
    }
    return [21.12, 105.90]; // Giữa Hà Nội & Bắc Ninh
  }, [stops]);

  // Nối các tọa độ nếu chưa có polyline từ OSRM API
  const polylinePositions = useMemo(() => {
    if (routePolyline && routePolyline.length > 0) return routePolyline;
    return stops.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng]);
  }, [routePolyline, stops]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: '340px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={11}
        style={{ width: '100%', height: '100%', minHeight: '340px' }}
        scrollWheelZoom={true}
        maxZoom={20}
      >
        {/* Google Maps Layer mượt mà không bị xám */}
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          maxZoom={20}
        />

        <MultiStopBoundsUpdater stops={stops} />

        {stops.map(stop => {
          if (!stop.lat || !stop.lng) return null;
          return (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={createStopMarkerIcon(stop)}
            >
              <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.95}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
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
            opacity={0.85}
          />
        )}
      </MapContainer>
    </div>
  );
}
