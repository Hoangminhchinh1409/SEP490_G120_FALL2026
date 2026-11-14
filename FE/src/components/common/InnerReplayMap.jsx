'use client';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VIETMAP_TILE_URL } from '../../utils/roadRouting';

const SAFE_VIETMAP_TILE_URL =
  VIETMAP_TILE_URL ||
  'https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey=6ad933d27ec1ae2fb5a5fd36902c817d1c912263116e4644';

// Component cập nhật khung nhìn bản đồ, phóng to vừa vặn toàn tuyến & hỗ trợ pan tới điểm chọn
function MapReplayController({ boundsPositions, centerOverride }) {
  const map = useMap();
  const initialFittedRef = useRef(false);

  // Invalidate size & fit bounds khi mở modal lần đầu
  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => {
      try {
        const container = map.getContainer();
        if (!container || !container.offsetParent) return;
        map.invalidateSize();

        if (!initialFittedRef.current && Array.isArray(boundsPositions) && boundsPositions.length >= 2) {
          const bounds = L.latLngBounds(boundsPositions);
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              padding: [45, 45],
              maxZoom: 15,
              animate: false
            });
            initialFittedRef.current = true;
          }
        }
      } catch {
        // Tránh lỗi khi unmount
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [map, boundsPositions]);

  // Khi người dùng bấm vào 1 trạm dừng hoặc sự kiện để tập trung
  useEffect(() => {
    if (!map || !centerOverride || !centerOverride[0] || !centerOverride[1]) return;
    try {
      map.flyTo([centerOverride[0], centerOverride[1]], 15, { animate: true, duration: 0.8 });
    } catch {
      // Ignored
    }
  }, [map, centerOverride]);

  return null;
}

export default function InnerReplayMap({
  gpsTrack = [],
  stepIndex = 0,
  plateNumber = '29C-888.88',
  stops = [],
  events = [],
  incidentLocation = null,
  centerOverride = null,
  isPlaying = false
}) {
  const currentPoint = gpsTrack[stepIndex] || gpsTrack[0] || { latitude: 21.0285, longitude: 105.8542, speed_kmh: 0 };
  const currentLat = Number(currentPoint.latitude) || 21.0285;
  const currentLng = Number(currentPoint.longitude) || 105.8542;
  const currentSpeed = Number(currentPoint.speed_kmh) || 0;

  // Toàn bộ đường đi thực tế
  const fullPolyline = useMemo(() => {
    if (!Array.isArray(gpsTrack) || gpsTrack.length === 0) return [];
    return gpsTrack
      .filter((p) => p && !isNaN(p.latitude) && !isNaN(p.longitude))
      .map((p) => [Number(p.latitude), Number(p.longitude)]);
  }, [gpsTrack]);

  // Quãng đường đã đi qua tính đến mốc thời gian tua hiện tại
  const traveledPolyline = useMemo(() => {
    if (!Array.isArray(gpsTrack) || gpsTrack.length === 0) return [];
    const sliced = gpsTrack.slice(0, stepIndex + 1);
    return sliced
      .filter((p) => p && !isNaN(p.latitude) && !isNaN(p.longitude))
      .map((p) => [Number(p.latitude), Number(p.longitude)]);
  }, [gpsTrack, stepIndex]);

  // Điểm trung tâm mặc định
  const defaultCenter = useMemo(() => {
    if (fullPolyline.length > 0) return fullPolyline[0];
    return [21.0285, 105.8542];
  }, [fullPolyline]);

  // Icon xe tải di chuyển theo tọa độ thực tế
  const truckIcon = useMemo(() => {
    const isMoving = currentSpeed > 5 || isPlaying;
    const pulseHtml = isMoving
      ? '<span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span></span>'
      : '';

    return L.divIcon({
      className: 'custom-replay-truck-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
          <div style="width: 38px; height: 38px; border-radius: 50%; background-color: #f59e0b; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path>
              <path d="M15 18H9"></path>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z"></path>
              <circle cx="17" cy="18" r="2"></circle>
              <circle cx="7" cy="18" r="2"></circle>
            </svg>
            ${pulseHtml}
          </div>
          <div style="margin-top: 3px; background: rgba(15, 23, 42, 0.95); color: #ffffff; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 800; font-family: monospace; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">
            ${plateNumber} • ${currentSpeed} km/h
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }, [plateNumber, currentSpeed, isPlaying]);

  // Icon điểm lấy hàng (A)
  const pickupIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-stop-pickup',
      html: `
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 12px; transform: translate(-50%, -50%);">
          A
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }, []);

  // Icon điểm giao hàng (B)
  const deliveryIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-stop-delivery',
      html: `
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #10b981; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 12px; transform: translate(-50%, -50%);">
          B
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }, []);

  // Icon điểm dừng trung gian
  const waypointIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-stop-waypoint',
      html: `
        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #6366f1; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 10px; transform: translate(-50%, -50%);">
          W
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }, []);

  // Icon cảnh báo sự cố / ngoài bán kính Geofence
  const incidentIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-incident-marker',
      html: `
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #ef4444; border: 3px solid #ffffff; box-shadow: 0 3px 10px rgba(239, 68, 68, 0.6); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px; transform: translate(-50%, -50%);">
          ⚠️
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }, []);

  return (
    <div className="relative w-full h-full min-h-[350px] overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; VietMap Tilemap'
          url={SAFE_VIETMAP_TILE_URL}
          maxZoom={20}
        />

        <MapReplayController
          boundsPositions={fullPolyline}
          centerOverride={centerOverride}
          currentPoint={currentPoint}
        />

        {/* 1. Lộ trình kế hoạch / toàn bộ hành trình (vạch mờ dự kiến) */}
        {fullPolyline.length > 1 && (
          <Polyline
            positions={fullPolyline}
            color="#94a3b8"
            weight={4}
            opacity={0.7}
            dashArray="4, 6"
          />
        )}

        {/* 2. Quãng đường thực tế đã lăn bánh (vạch màu nổi bật theo tiến độ tua) */}
        {traveledPolyline.length > 1 && (
          <Polyline
            positions={traveledPolyline}
            color="#d97706"
            weight={6}
            opacity={0.95}
          />
        )}

        {/* 3. Các điểm dừng (Stops) */}
        {stops.map((st, idx) => {
          const lat = Number(st.latitude || st.location?.latitude);
          const lng = Number(st.longitude || st.location?.longitude);
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

          const isFirst = idx === 0 || st.stop_type === 'PICKUP';
          const isLast = idx === stops.length - 1 || st.stop_type === 'DROPOFF' || st.stop_type === 'DELIVERY';
          const icon = isFirst ? pickupIcon : isLast ? deliveryIcon : waypointIcon;
          const stopTitle = st.name || st.location?.name || `Điểm dừng ${idx + 1}`;

          return (
            <Marker key={st.id || `stop-${idx}`} position={[lat, lng]} icon={icon}>
              <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                <div className="text-[11px] font-semibold text-slate-800">
                  <span className={isFirst ? 'text-blue-600 font-bold' : isLast ? 'text-emerald-600 font-bold' : 'text-indigo-600 font-bold'}>
                    {isFirst ? 'Điểm lấy (A): ' : isLast ? 'Điểm giao (B): ' : `Trạm ${idx + 1}: `}
                  </span>
                  {stopTitle}
                </div>
              </Tooltip>
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-900">{stopTitle}</div>
                  <div className="text-slate-500 text-[11px]">{st.address || st.location?.address}</div>
                  <div className="text-slate-600 text-[11px] pt-1">
                    <div>Kế hoạch: <b>{st.planned_arrival || st.planned || '--:--'}</b></div>
                    <div>Thực tế: <b className="text-blue-600">{st.actual_arrival || st.actual || '--:--'}</b></div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 4. Marker Sự cố / Vi phạm bán kính Geofence (nếu có) */}
        {events
          .filter((e) => e.outside_radius_flag || e.event_type === 'INCIDENT' || e.event_type === 'CLAIM')
          .map((ev, idx) => {
            const lat = Number(ev.latitude);
            const lng = Number(ev.longitude);
            if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

            return (
              <Marker key={`ev-${ev.id || idx}`} position={[lat, lng]} icon={incidentIcon}>
                <Tooltip permanent direction="bottom" offset={[0, 16]}>
                  <span className="text-[10px] font-bold text-red-600">
                    {ev.outside_radius_flag ? 'Vi phạm bán kính Geofence' : 'Điểm ghi nhận sự cố'}
                  </span>
                </Tooltip>
                <Popup>
                  <div className="text-xs">
                    <b className="text-red-600">Cảnh báo sự cố:</b>
                    <p className="mt-1">{ev.payload?.note || ev.event_type}</p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {ev.phone_time ? new Date(ev.phone_time).toLocaleString('vi-VN') : ''}
                    </span>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* 5. Vị trí Sự cố cụ thể truyền từ màn hình sự cố lớn của Manager */}
        {incidentLocation?.lat && incidentLocation?.lng && (
          <Marker position={[Number(incidentLocation.lat), Number(incidentLocation.lng)]} icon={incidentIcon}>
            <Tooltip permanent direction="top" offset={[0, -18]}>
              <span className="text-[10px] font-bold text-red-600">Hiện trường sự cố</span>
            </Tooltip>
            <Popup>
              <div className="text-xs">
                <b className="text-red-600">Tọa độ hiện trường sự cố:</b>
                <div className="mt-1">{incidentLocation.address || `${incidentLocation.lat}, ${incidentLocation.lng}`}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 6. Marker Xe tải đang chạy / tua lại */}
        <Marker position={[currentLat, currentLng]} icon={truckIcon} zIndexOffset={1000}>
          <Popup>
            <div className="text-xs font-sans space-y-1">
              <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                <span>Xe: {plateNumber}</span>
                <span className="text-emerald-600 font-mono">{currentSpeed} km/h</span>
              </div>
              <div className="text-slate-500 text-[11px]">
                Tọa độ: <span className="font-mono">{currentLat.toFixed(5)}, {currentLng.toFixed(5)}</span>
              </div>
              <div className="text-slate-500 text-[11px]">
                Thời điểm: <span className="font-mono">{currentPoint.recorded_time ? new Date(currentPoint.recorded_time).toLocaleTimeString('vi-VN') : '--:--'}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Nhãn VietMap góc phải trên */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 pointer-events-none">
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white/95 text-indigo-900 border border-indigo-200 shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Bản đồ: VietMap Tilemap Live
        </span>
      </div>

      {/* Nút chỉ báo mốc tua ở góc dưới trái bản đồ */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-lg border border-slate-700/60 shadow text-xs font-mono flex items-center gap-2.5">
          <span className="text-amber-400 font-bold">Mốc GPS #{stepIndex + 1}/{Math.max(1, gpsTrack.length)}</span>
          <span className="text-slate-400">|</span>
          <span className="text-emerald-300 font-bold">{currentSpeed} km/h</span>
        </div>
      </div>
    </div>
  );
}
