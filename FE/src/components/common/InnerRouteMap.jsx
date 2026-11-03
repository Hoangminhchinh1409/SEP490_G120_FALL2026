'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component tự động pan, fitBounds & invalidateSize an toàn
function MapBoundsUpdater({ pickupCoords, deliveryCoords, routePolyline }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    
    const timer = setTimeout(() => {
      try {
        const container = map.getContainer();
        if (!container || !container.offsetParent) return;
        map.invalidateSize();

        if (routePolyline && routePolyline.length > 2) {
          const bounds = L.latLngBounds(routePolyline);
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              padding: [40, 40],
              maxZoom: 16,
              animate: false
            });
            return;
          }
        }

        if (pickupCoords?.lat && deliveryCoords?.lat) {
          const bounds = L.latLngBounds([
            [pickupCoords.lat, pickupCoords.lng],
            [deliveryCoords.lat, deliveryCoords.lng]
          ]);
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              padding: [45, 45],
              maxZoom: 16,
              animate: false
            });
          }
        } else if (pickupCoords?.lat) {
          map.setView([pickupCoords.lat, pickupCoords.lng], 14, { animate: false });
        } else if (deliveryCoords?.lat) {
          map.setView([deliveryCoords.lat, deliveryCoords.lng], 14, { animate: false });
        }
      } catch (err) {
        // Tránh unhandled exception khi DOM unmount
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [pickupCoords?.lat, pickupCoords?.lng, deliveryCoords?.lat, deliveryCoords?.lng, routePolyline?.length, map]);

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

  // Chỉ vẽ tuyến đường khi đã có dữ liệu hình học ôm theo đường bộ thực tế (tuyệt đối không vẽ đường thẳng chim bay)
  const polylinePositions = useMemo(() => {
    if (Array.isArray(routePolyline) && routePolyline.length > 1) {
      return routePolyline;
    }
    return [];
  }, [routePolyline]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={hasBothCoords ? 11 : (pickupCoords?.lat || deliveryCoords?.lat ? 13 : 10)}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
      maxZoom={20}
    >
      {/* Sử dụng Google Maps Tiles */}
      <TileLayer
        attribution='&copy; Google Maps'
        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        maxZoom={20}
      />

      <MapBoundsUpdater
        pickupCoords={pickupCoords}
        deliveryCoords={deliveryCoords}
        routePolyline={polylinePositions}
      />

      {pickupCoords?.lat && (
        <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
          <Tooltip permanent direction="top" offset={[0, -14]} opacity={0.95}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pickupAddress}>
              <span style={{ color: '#2563eb', fontWeight: 800 }}>A: </span>
              <span>{(pickupAddress || 'Điểm lấy').split(',')[0]}</span>
            </div>
          </Tooltip>
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
          <Tooltip permanent direction="top" offset={[0, -14]} opacity={0.95}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={deliveryAddress}>
              <span style={{ color: '#059669', fontWeight: 800 }}>B: </span>
              <span>{(deliveryAddress || 'Điểm giao').split(',')[0]}</span>
            </div>
          </Tooltip>
          <Popup>
            <div className="text-xs">
              <b className="text-emerald-600">Điểm giao hàng (B):</b>
              <div className="mt-1">{deliveryAddress || `${deliveryCoords.lat.toFixed(4)}, ${deliveryCoords.lng.toFixed(4)}`}</div>
            </div>
          </Popup>
        </Marker>
      )}

      {polylinePositions.length > 1 && (
        <Polyline
          positions={polylinePositions}
          color="#4f46e5"
          weight={5}
          opacity={0.9}
        />
      )}
    </MapContainer>
  );
};

export default InnerRouteMap;
