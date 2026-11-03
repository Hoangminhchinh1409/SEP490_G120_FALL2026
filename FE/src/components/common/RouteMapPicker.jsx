'use client';
import { useState, useEffect, useMemo } from 'react';
import { Route, Clock } from 'lucide-react';
import dynamic from 'next/dynamic';
import { calculateRouteEstimate, getCoordsFromAddress } from '../../data/dispatcherPresets';
import { fetchShortestRoadRoute } from '../../utils/roadRouting';

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
  const [loadingRoute, setLoadingRoute] = useState(false);

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

  // Tự động tính toán lộ trình đường bộ ngắn nhất ôm sát mặt đường giao thông
  useEffect(() => {
    if (!effectivePickupCoords?.lat || !effectivePickupCoords?.lng || !effectiveDeliveryCoords?.lat || !effectiveDeliveryCoords?.lng) {
      setRoutePolyline([]);
      setRouteInfo({ distanceKm: 0, durationMins: 0 });
      if (onRouteChange) onRouteChange({ distanceKm: 0, durationMins: 0 });
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadRoadRoute = async () => {
      setLoadingRoute(true);
      try {
        const result = await fetchShortestRoadRoute(
          [effectivePickupCoords, effectiveDeliveryCoords],
          controller.signal
        );

        if (!isCancelled && result.success && result.polyline.length > 1) {
          setRoutePolyline(result.polyline);
          setRouteInfo({ distanceKm: result.distanceKm, durationMins: result.durationMins });
          if (onRouteChange) {
            onRouteChange({ distanceKm: result.distanceKm, durationMins: result.durationMins });
          }
          setLoadingRoute(false);
          return;
        }
      } catch (err) {
        // ignore abort
      }

      if (!isCancelled) {
        setLoadingRoute(false);
        const fallback = calculateRouteEstimate(
          effectivePickupCoords.lat,
          effectivePickupCoords.lng,
          effectiveDeliveryCoords.lat,
          effectiveDeliveryCoords.lng
        );
        // Không vẽ đường thẳng chim bay, chỉ cập nhật ước tính km nếu mạng mất kết nối hoàn toàn
        setRoutePolyline([]);
        setRouteInfo(fallback);
        if (onRouteChange) onRouteChange(fallback);
      }
    };

    loadRoadRoute();

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
              <span>{routeInfo.distanceKm} km (Đường bộ ngắn nhất)</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1 text-gray-700">
              <Clock size={13} className="text-gray-500" />
              <span>~{routeInfo.durationMins} phút</span>
            </div>
          </div>
        ) : (
          <div className="absolute top-2.5 right-2.5 z-[1000] bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-gray-500 border border-gray-100 shadow-xs">
            {loadingRoute
              ? 'Đang dò lộ trình đường bộ ngắn nhất...'
              : effectivePickupCoords?.lat
                ? 'Chọn tiếp điểm giao hàng'
                : 'Nhập địa chỉ để định vị'}
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
