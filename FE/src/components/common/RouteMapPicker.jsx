'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Select, Input, Tag } from 'antd';
import { MapPin, Navigation, Route, Clock, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { POPULAR_LOCATIONS, calculateRouteEstimate } from '../../data/dispatcherPresets';

// Danh mục mở rộng các địa điểm giao nhận phổ biến miền Bắc có sẵn tọa độ GPS
const EXTENDED_LOCATIONS = [
  ...POPULAR_LOCATIONS,
  {
    id: 'LOC-QUANG-CHAU',
    name: 'Foxconn - KCN Quang Châu Bắc Giang',
    address: 'KCN Quang Châu, Huyện Việt Yên, Tỉnh Bắc Giang',
    lat: 21.2345,
    lng: 106.1234,
    type: 'NHA_MAY'
  },
  {
    id: 'LOC-BACH-MAI',
    name: 'Bệnh viện Bạch Mai - Giải Phóng Hà Nội',
    address: '78 Đường Giải Phóng, Phường Phương Mai, Quận Đống Đa, Hà Nội',
    lat: 20.9995,
    lng: 105.8415,
    type: 'BENH_VIEN'
  },
  {
    id: 'LOC-THANG-LONG',
    name: 'KCN Thăng Long I - Đông Anh Hà Nội',
    address: 'KCN Thăng Long, Xã Kim Chung, Huyện Đông Anh, Hà Nội',
    lat: 21.1278,
    lng: 105.7865,
    type: 'KCN'
  },
  {
    id: 'LOC-PHO-NOI',
    name: 'KCN Phố Nối A - Văn Lâm Hưng Yên',
    address: 'KCN Phố Nối A, Xã Lạc Đạo, Huyện Văn Lâm, Hưng Yên',
    lat: 20.9542,
    lng: 106.0125,
    type: 'KCN'
  },
  {
    id: 'LOC-MY-DINH',
    name: 'Cảng cạn ICD Mỹ Đình - Nam Từ Liêm',
    address: 'Số 17 Phạm Hùng, Phường Mỹ Đình 2, Quận Nam Từ Liêm, Hà Nội',
    lat: 21.0265,
    lng: 105.7789,
    type: 'KHO_LOGISTICS'
  }
];

// Dynamic import Leaflet components để tránh lỗi SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import('react-leaflet').then(mod => mod.Polyline),
  { ssr: false }
);
const useMap = dynamic(
  () => import('react-leaflet').then(mod => mod.useMap),
  { ssr: false }
);

// Map Auto Fit Bounds controller
function MapBoundsUpdater({ pickup, delivery }) {
  const [mapObj, setMapObj] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('react-leaflet').then(({ useMap }) => {
      // Map controller can be simplified
    });
  }, []);

  return null;
}

const RouteMapPicker = ({
  pickupAddress,
  deliveryAddress,
  pickupCoords,
  deliveryCoords,
  onRouteChange,
  height = 260
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [L, setL] = useState(null);

  useEffect(() => {
    setIsMounted(true);
    import('leaflet').then(leaflet => {
      import('leaflet/dist/leaflet.css');
      setL(leaflet.default || leaflet);
    });
  }, []);

  // Tính toán lộ trình
  const routeEstimate = useMemo(() => {
    return calculateRouteEstimate(
      pickupCoords?.lat || 21.1235,
      pickupCoords?.lng || 105.9876,
      deliveryCoords?.lat || 21.2215,
      deliveryCoords?.lng || 105.8078
    );
  }, [pickupCoords, deliveryCoords]);

  // Thông báo lộ trình lên component cha
  useEffect(() => {
    if (onRouteChange) {
      onRouteChange({
        distanceKm: routeEstimate.distanceKm,
        durationMins: routeEstimate.durationMins
      });
    }
  }, [routeEstimate, onRouteChange]);

  // Tạo Custom Marker Icons
  const pickupIcon = useMemo(() => {
    if (!L) return null;
    return L.divIcon({
      className: 'custom-pickup-marker',
      html: `
        <div style="background-color: #2563eb; width: 26px; height: 26px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">
          A
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }, [L]);

  const deliveryIcon = useMemo(() => {
    if (!L) return null;
    return L.divIcon({
      className: 'custom-delivery-marker',
      html: `
        <div style="background-color: #10b981; width: 26px; height: 26px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">
          B
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }, [L]);

  const center = useMemo(() => {
    const lat = ((pickupCoords?.lat || 21.1235) + (deliveryCoords?.lat || 21.2215)) / 2;
    const lng = ((pickupCoords?.lng || 105.9876) + (deliveryCoords?.lng || 105.8078)) / 2;
    return [lat, lng];
  }, [pickupCoords, deliveryCoords]);

  const polylinePositions = useMemo(() => {
    return [
      [pickupCoords?.lat || 21.1235, pickupCoords?.lng || 105.9876],
      [deliveryCoords?.lat || 21.2215, deliveryCoords?.lng || 105.8078]
    ];
  }, [pickupCoords, deliveryCoords]);

  return (
    <div className="w-full space-y-2">
      {/* Khung Bản Đồ Leaflet */}
      <div 
        className="w-full rounded-xl overflow-hidden border border-gray-200 relative bg-gray-100 shadow-sm"
        style={{ height: `${height}px` }}
      >
        {isMounted && L ? (
          <MapContainer
            center={center}
            zoom={10}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pickupIcon && (
              <Marker position={[pickupCoords?.lat || 21.1235, pickupCoords?.lng || 105.9876]} icon={pickupIcon}>
                <Popup>
                  <b>Điểm lấy hàng (A):</b><br />
                  {pickupAddress || 'Điểm lấy hàng'}
                </Popup>
              </Marker>
            )}
            {deliveryIcon && (
              <Marker position={[deliveryCoords?.lat || 21.2215, deliveryCoords?.lng || 105.8078]} icon={deliveryIcon}>
                <Popup>
                  <b>Điểm giao hàng (B):</b><br />
                  {deliveryAddress || 'Điểm giao hàng'}
                </Popup>
              </Marker>
            )}
            <Polyline 
              positions={polylinePositions} 
              color="#4f46e5" 
              weight={4} 
              dashArray="6, 8" 
              opacity={0.85} 
            />
          </MapContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
            Đang tải bản đồ định vị...
          </div>
        )}

        {/* Badge Lộ trình nổi trên bản đồ */}
        <div className="absolute top-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-gray-100 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 font-bold text-indigo-700">
            <Route size={14} className="text-indigo-600" />
            <span>{routeEstimate.distanceKm} km</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1 text-gray-700">
            <Clock size={13} className="text-gray-500" />
            <span>~{routeEstimate.durationMins} phút</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export { EXTENDED_LOCATIONS };
export default RouteMapPicker;