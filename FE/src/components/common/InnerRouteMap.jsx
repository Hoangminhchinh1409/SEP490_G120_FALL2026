'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component tự động pan, fitBounds & invalidateSize để bản đồ không bao giờ bị xám (grey tiles)
function MapBoundsUpdater({ pickupCoords, deliveryCoords }) {
  const map = useMap();

  // Khắc phục lỗi Leaflet bị xám khi render trong Ant Design Modal
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    map.invalidateSize();
    if (pickupCoords?.lat && deliveryCoords?.lat) {
      try {
        const bounds = [
          [pickupCoords.lat, pickupCoords.lng],
          [deliveryCoords.lat, deliveryCoords.lng]
        ];
        map.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 16,
          animate: true,
          duration: 0.8
        });
      } catch (err) {
        console.error('Fit bounds error:', err);
      }
    } else if (pickupCoords?.lat) {
      map.flyTo([pickupCoords.lat, pickupCoords.lng], 14, {
        animate: true,
        duration: 0.8
      });
    } else if (deliveryCoords?.lat) {
      map.flyTo([deliveryCoords.lat, deliveryCoords.lng], 14, {
        animate: true,
        duration: 0.8
      });
    }
  }, [pickupCoords, deliveryCoords, map]);

  return null;
}

const InnerRouteMap = ({
  pickupCoords,
  deliveryCoords,
  pickupAddress,
  deliveryAddress,
  routePolyline = []
}) => {
  const pickupIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-pickup-marker',
      html: `
        <div style="background-color: #2563eb; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 800;">
          A
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }, []);

  const deliveryIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-delivery-marker',
      html: `
        <div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 800;">
          B
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }, []);

  const defaultCenter = useMemo(() => {
    if (pickupCoords?.lat && deliveryCoords?.lat) {
      return [
        (pickupCoords.lat + deliveryCoords.lat) / 2,
        (pickupCoords.lng + deliveryCoords.lng) / 2
      ];
    }
    if (pickupCoords?.lat) return [pickupCoords.lat, pickupCoords.lng];
    if (deliveryCoords?.lat) return [deliveryCoords.lat, deliveryCoords.lng];
    return [21.0285, 105.8542]; // Hà Nội
  }, [pickupCoords, deliveryCoords]);

  const hasBothCoords = Boolean(pickupCoords?.lat && deliveryCoords?.lat);

  // Tuyến đường vẽ trên bản đồ
  const polylinePositions = useMemo(() => {
    if (routePolyline && routePolyline.length > 0) {
      return routePolyline;
    }
    if (hasBothCoords) {
      return [
        [pickupCoords.lat, pickupCoords.lng],
        [deliveryCoords.lat, deliveryCoords.lng]
      ];
    }
    return [];
  }, [routePolyline, hasBothCoords, pickupCoords, deliveryCoords]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={hasBothCoords ? 11 : (pickupCoords?.lat || deliveryCoords?.lat ? 13 : 10)}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
      maxZoom={20}
    >
      {/* Sử dụng Google Maps Tiles: Tải cực nhanh, không bao giờ bị chặn hay xám tại Việt Nam, hỗ trợ zoom sâu tới cấp 20 */}
      <TileLayer
        attribution='&copy; Google Maps'
        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        maxZoom={20}
      />

      <MapBoundsUpdater pickupCoords={pickupCoords} deliveryCoords={deliveryCoords} />

      {pickupCoords?.lat && (
        <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
          <Popup>
            <div className="text-xs">
              <b className="text-blue-600">Điểm lấy hàng (A):</b>
              <div className="mt-1">{pickupAddress || `${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}`}</div>
            </div>
          </Popup>
        </Marker>
      )}

      {deliveryCoords?.lat && (
        <Marker position={[deliveryCoords.lat, deliveryCoords.lng]} icon={deliveryIcon}>
          <Popup>
            <div className="text-xs">
              <b className="text-emerald-600">Điểm giao hàng (B):</b>
              <div className="mt-1">{deliveryAddress || `${deliveryCoords.lat.toFixed(4)}, ${deliveryCoords.lng.toFixed(4)}`}</div>
            </div>
          </Popup>
        </Marker>
      )}

      {polylinePositions.length > 0 && (
        <Polyline
          positions={polylinePositions}
          color="#4f46e5"
          weight={5}
          opacity={0.85}
        />
      )}
    </MapContainer>
  );
};

export default InnerRouteMap;
