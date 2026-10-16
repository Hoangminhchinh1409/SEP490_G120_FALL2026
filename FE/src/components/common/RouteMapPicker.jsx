'use client';
import { useState, useEffect, useMemo } from 'react';
import { Route, Clock } from 'lucide-react';
import dynamic from 'next/dynamic';
import { calculateRouteEstimate, getCoordsFromAddress } from '../../data/dispatcherPresets';

// Dynamic import component Leaflet bản đồ để tránh lỗi SSR trong Next.js
const InnerRouteMap = dynamic(
  () => import('./InnerRouteMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-gray-50">
        Đang khởi tạo bản đồ số...
      </div>
    )
  }
);

const RouteMapPicker = ({
  pickupAddress,
  deliveryAddress,
  pickupCoords,
  deliveryCoords,
  onRouteChange,
  height = 240
}) => {
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeInfo, setRouteInfo] = useState({ distanceKm: 0, durationMins: 0 });

  // Tự động suy luận tọa độ hiệu lực nếu chưa có tọa độ nhưng đã có địa chỉ
  const effectivePickupCoords = useMemo(() => {
    if (pickupCoords?.lat && pickupCoords?.lng) return pickupCoords;
    if (pickupAddress && pickupAddress.trim().length >= 3) {
      return getCoordsFromAddress(pickupAddress, 'A');
    }
    return null;
  }, [pickupCoords, pickupAddress]);

  const effectiveDeliveryCoords = useMemo(() => {
    if (deliveryCoords?.lat && deliveryCoords?.lng) return deliveryCoords;
    if (deliveryAddress && deliveryAddress.trim().length >= 3) {
      return getCoordsFromAddress(deliveryAddress, 'B');
    }
    return null;
  }, [deliveryCoords, deliveryAddress]);

  // Tự động tính toán lộ trình thực tế qua OSRM Driving API khi có đủ tọa độ 2 điểm
  useEffect(() => {
    if (!effectivePickupCoords?.lat || !effectivePickupCoords?.lng || !effectiveDeliveryCoords?.lat || !effectiveDeliveryCoords?.lng) {
      const clearTimer = setTimeout(() => {
        setRoutePolyline([]);
        setRouteInfo({ distanceKm: 0, durationMins: 0 });
        if (onRouteChange) onRouteChange({ distanceKm: 0, durationMins: 0 });
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchRoute = async () => {
      try {
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        // 1. Ưu tiên gọi qua Backend Proxy chuyên dụng (Không bị lỗi SSL/CORS trình duyệt, luôn lấy tuyến đường bộ ngắn nhất)
        const beUrl = `http://localhost:9999/api/routing/road-route?startLng=${effectivePickupCoords.lng}&startLat=${effectivePickupCoords.lat}&endLng=${effectiveDeliveryCoords.lng}&endLat=${effectiveDeliveryCoords.lat}`;
        
        const res = await fetch(beUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data?.success && Array.isArray(data.polyline) && data.polyline.length > 0) {
            setRoutePolyline(data.polyline);
            setRouteInfo({ distanceKm: data.distanceKm, durationMins: data.durationMins });
            if (onRouteChange) {
              onRouteChange({ distanceKm: data.distanceKm, durationMins: data.durationMins });
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Backend Routing Proxy warning:', err.message);
      }

      // 2. Thử gọi trực tiếp OpenStreetMap Routing Server nếu backend bận
      try {
        const directUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${effectivePickupCoords.lng},${effectivePickupCoords.lat};${effectiveDeliveryCoords.lng},${effectiveDeliveryCoords.lat}?overview=full&geometries=geojson&alternatives=true`;
        const directRes = await fetch(directUrl);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (!isCancelled && directData?.routes?.length > 0) {
            const sortedRoutes = [...directData.routes].sort((a, b) => a.distance - b.distance);
            const shortestRoute = sortedRoutes[0];
            const distKm = parseFloat((shortestRoute.distance / 1000).toFixed(1));
            const durMins = Math.max(5, Math.round(shortestRoute.duration / 60));
            const poly = shortestRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

            setRoutePolyline(poly);
            setRouteInfo({ distanceKm: distKm, durationMins: durMins });
            if (onRouteChange) {
              onRouteChange({ distanceKm: distKm, durationMins: durMins });
            }
            return;
          }
        }
      } catch (directErr) {
        console.warn('Direct routing warning:', directErr.message);
      }

      if (!isCancelled) {
        const fallback = calculateRouteEstimate(
          effectivePickupCoords.lat,
          effectivePickupCoords.lng,
          effectiveDeliveryCoords.lat,
          effectiveDeliveryCoords.lng
        );
        setRoutePolyline([
          [effectivePickupCoords.lat, effectivePickupCoords.lng],
          [effectiveDeliveryCoords.lat, effectiveDeliveryCoords.lng]
        ]);
        setRouteInfo(fallback);
        if (onRouteChange) onRouteChange(fallback);
      }
    };

    fetchRoute();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [
    effectivePickupCoords?.lat, 
    effectivePickupCoords?.lng, 
    effectiveDeliveryCoords?.lat, 
    effectiveDeliveryCoords?.lng, 
    onRouteChange
  ]);

  const hasBoth = Boolean(effectivePickupCoords?.lat && effectiveDeliveryCoords?.lat);

  return (
    <div className="w-full space-y-2">
      {/* Khung Bản Đồ Leaflet */}
      <div 
        className="w-full rounded-xl overflow-hidden border border-gray-200 relative bg-gray-100 shadow-sm"
        style={{ height: `${height}px` }}
      >
        <InnerRouteMap
          key={`route-map-${effectivePickupCoords?.lat || 0}-${effectiveDeliveryCoords?.lat || 0}`}
          pickupCoords={effectivePickupCoords}
          deliveryCoords={effectiveDeliveryCoords}
          pickupAddress={pickupAddress}
          deliveryAddress={deliveryAddress}
          routePolyline={routePolyline}
        />

        {/* Badge Lộ trình nổi trên bản đồ */}
        {hasBoth && routeInfo.distanceKm > 0 ? (
          <div className="absolute top-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-gray-100 flex items-center gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-1 font-bold text-indigo-700">
              <Route size={14} className="text-indigo-600" />
              <span>{routeInfo.distanceKm} km</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1 text-gray-700">
              <Clock size={13} className="text-gray-500" />
              <span>~{routeInfo.durationMins} phút</span>
            </div>
          </div>
        ) : (
          <div className="absolute top-2.5 right-2.5 z-[1000] bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-gray-500 border border-gray-100 shadow-xs">
            {effectivePickupCoords?.lat ? 'Chọn tiếp điểm giao hàng' : 'Nhập địa chỉ để định vị'}
          </div>
        )}

        {/* Thanh địa chỉ cố định trực quan ngay trên bản đồ */}
        {(pickupAddress || deliveryAddress) && (
          <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-gray-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">A</span>
              <span className="text-gray-500 text-[11px] shrink-0 font-medium">Lấy:</span>
              <span className="font-semibold text-gray-800 text-[11px] truncate" title={pickupAddress}>
                {pickupAddress || 'Chưa nhập điểm lấy'}
              </span>
            </div>
            <span className="hidden sm:inline text-gray-300 font-bold shrink-0">➔</span>
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">B</span>
              <span className="text-gray-500 text-[11px] shrink-0 font-medium">Giao:</span>
              <span className="font-semibold text-gray-800 text-[11px] truncate" title={deliveryAddress}>
                {deliveryAddress || 'Chưa nhập điểm giao'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteMapPicker;