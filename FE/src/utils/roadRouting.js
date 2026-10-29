const GEOAPIFY_PUBLIC_KEY = '5a7ccf56c9694e229e9621648227937a';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9999/api';

// Bộ nhớ đệm tuyến đường bộ để phản hồi tức thì khi đổi qua lại
const roadRouteCache = new Map();

/**
 * Lấy lộ trình đường bộ thực tế ngắn nhất (ôm sát theo mặt đường giao thông, tuyệt đối không vẽ đường chim bay)
 * Hỗ trợ từ 2 điểm đến nhiều điểm dừng (multi-stop waypoints)
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @param {AbortSignal} [signal]
 * @returns {Promise<{success: boolean, distanceKm: number, durationMins: number, polyline: Array<[number, number]>, legs: Array<{distanceKm: number, durationMins: number}>}>}
 */
export async function fetchShortestRoadRoute(points = [], signal = undefined) {
  const validPoints = (points || []).filter(
    (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !Number.isNaN(p.lat) && !Number.isNaN(p.lng)
  );

  if (validPoints.length < 2) {
    return { success: false, distanceKm: 0, durationMins: 0, polyline: [], legs: [] };
  }

  const cacheKey = validPoints
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join('|');

  if (roadRouteCache.has(cacheKey)) {
    return roadRouteCache.get(cacheKey);
  }

  const wpParam = validPoints.map((p) => `${p.lat},${p.lng}`).join('|');

  // 1. Ưu tiên gọi qua Backend Proxy (/api/routing/road-route?waypoints=...)
  try {
    const beUrl = `${API_BASE_URL}/routing/road-route?waypoints=${encodeURIComponent(wpParam)}`;
    const res = await fetch(beUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.polyline) && data.polyline.length > 2) {
        const result = {
          success: true,
          distanceKm: data.distanceKm,
          durationMins: data.durationMins,
          polyline: data.polyline,
          legs: Array.isArray(data.legs) ? data.legs : []
        };
        roadRouteCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    // Chuyển sang gọi trực tiếp Geoapify Road Routing API
  }

  // 2. Gọi trực tiếp Geoapify Road Routing API (type=short: Tuyến đường bộ ngắn nhất, ôm sát đường thực tế)
  try {
    const geoUrl = `https://api.geoapify.com/v1/routing?waypoints=${wpParam}&mode=drive&type=short&apiKey=${GEOAPIFY_PUBLIC_KEY}`;
    const geoRes = await fetch(geoUrl, { signal });
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      const feature = geoData?.features?.[0];
      if (feature && feature.properties && feature.geometry) {
        const distMeters = feature.properties.distance || 0;
        const timeSecs = feature.properties.time || 0;
        const geom = feature.geometry;

        let coordsList = [];
        if (geom.type === 'MultiLineString') {
          coordsList = geom.coordinates.flat(1);
        } else if (geom.type === 'LineString') {
          coordsList = geom.coordinates;
        }

        const legs = Array.isArray(feature.properties.legs)
          ? feature.properties.legs.map((leg) => ({
              distanceKm: parseFloat(((leg.distance || 0) / 1000).toFixed(1)),
              durationMins: Math.max(5, Math.round((leg.time || 0) / 60))
            }))
          : [];

        if (coordsList.length > 1) {
          const polyline = coordsList.map(([lng, lat]) => [lat, lng]);
          const result = {
            success: true,
            distanceKm: parseFloat((distMeters / 1000).toFixed(1)),
            durationMins: Math.max(5, Math.round(timeSecs / 60)),
            polyline,
            legs
          };
          roadRouteCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch (e) {
    // Chuyển sang OSRM
  }

  // 3. Fallback OSRM Road Routing Server (router.project-osrm.org & routing.openstreetmap.de)
  const osrmCoords = validPoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const osrmServers = [
    `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=true`
  ];

  for (const url of osrmServers) {
    try {
      const osrmRes = await fetch(url, { signal });
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        if (osrmData?.routes?.length > 0) {
          // Chọn tuyến đường bộ có distance nhỏ nhất
          const sortedRoutes = [...osrmData.routes].sort((a, b) => a.distance - b.distance);
          const shortest = sortedRoutes[0];
          const polyline = shortest.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const legs = Array.isArray(shortest.legs)
            ? shortest.legs.map((leg) => ({
                distanceKm: parseFloat(((leg.distance || 0) / 1000).toFixed(1)),
                durationMins: Math.max(5, Math.round((leg.duration || 0) / 60))
              }))
            : [];

          const result = {
            success: true,
            distanceKm: parseFloat((shortest.distance / 1000).toFixed(1)),
            durationMins: Math.max(5, Math.round(shortest.duration / 60)),
            polyline,
            legs
          };
          roadRouteCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (e) {
      // Thử server tiếp theo
    }
  }

  return { success: false, distanceKm: 0, durationMins: 0, polyline: [], legs: [] };
}

/**
 * Sắp xếp thứ tự các điểm trả hàng (dropoffStops) theo QUÃNG ĐƯỜNG BỘ THỰC TẾ NGẮN NHẤT
 * (Sử dụng khoảng cách đường bộ thực tế giữa các điểm thay vì đường chim bay Haversine)
 */
export async function optimizeDropoffsByRoadDistance(anchorStop, dropoffStops = []) {
  if (!Array.isArray(dropoffStops) || dropoffStops.length <= 1) {
    return dropoffStops;
  }

  // Nếu số điểm trả <= 4, duyệt toàn bộ hoán vị hoặc Nearest-Neighbor theo quãng đường bộ thực tế
  const remaining = [...dropoffStops];
  const ordered = [];
  let current = anchorStop;

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      ordered.push(remaining[0]);
      break;
    }

    // Tính quãng đường bộ thực tế từ điểm hiện tại tới từng điểm ứng viên
    const distances = await Promise.all(
      remaining.map(async (cand, idx) => {
        const route = await fetchShortestRoadRoute([current, cand]);
        return {
          idx,
          roadKm: route.success && route.distanceKm > 0 ? route.distanceKm : Infinity
        };
      })
    );

    distances.sort((a, b) => a.roadKm - b.roadKm);
    const bestIdx = distances[0].idx;
    const [chosen] = remaining.splice(bestIdx, 1);
    ordered.push(chosen);
    current = chosen;
  }

  return ordered;
}

