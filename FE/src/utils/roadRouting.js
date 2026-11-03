export const VIETMAP_API_KEY = '35a2d42231542a9bd918f8fd7c97a5021cbf67d145a74e47';
export const VIETMAP_TILEMAP_KEY = '6ad933d27ec1ae2fb5a5fd36902c817d1c912263116e4644';
export const VIETMAP_TILE_URL = `https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey=${VIETMAP_TILEMAP_KEY}`;

const GEOAPIFY_PUBLIC_KEY = '5a7ccf56c9694e229e9621648227937a';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9999/api';

// Bộ nhớ đệm tuyến đường bộ để phản hồi tức thì khi đổi qua lại
const roadRouteCache = new Map();

/**
 * Phân tích mật độ giao thông thời gian thực theo từng cung đường (VietMap Instructions)
 */
export function buildClientTrafficAnalysis(coordsLatLng, instructions = [], totalDistKm = 0, baseDurationMins = 0) {
  const hour = new Date().getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  const congestedCorridors = [
    'ngô gia tự',
    'vành đai 3',
    'văn tiến dũng',
    'phạm văn đồng',
    'cầu thanh trì',
    'quốc lộ 5',
    'ql. 5',
    'nguyễn văn cừ',
    'cầu chương dương'
  ];
  const busyCorridors = [
    'võ văn kiệt',
    'ql. 18',
    'quốc lộ 18',
    'đường tỉnh 420',
    'đt. 420',
    'ql. 32',
    'quốc lộ 32',
    'cầu thăng long',
    'cầu phù đổng',
    'nội bài'
  ];

  const trafficSegments = [];
  const congestedRoadSet = new Set();
  const slowRoadSet = new Set();
  let extraDelayMins = 0;

  if (Array.isArray(instructions) && instructions.length > 0 && coordsLatLng.length > 1) {
    for (const inst of instructions) {
      const interval = Array.isArray(inst.interval) ? inst.interval : null;
      if (!interval || interval.length < 2) continue;
      const [startIdx, endIdx] = interval;
      if (endIdx <= startIdx || startIdx < 0 || endIdx >= coordsLatLng.length) continue;

      const segPositions = coordsLatLng.slice(startIdx, endIdx + 1);
      if (segPositions.length < 2) continue;

      const distM = Number(inst.distance) || 0;
      const timeMs = Number(inst.time) || 0;
      const streetRaw = (inst.street_name || '').trim();
      const streetLower = streetRaw.toLowerCase();
      const isNamedStreet = streetRaw && streetRaw !== 'Đường Không Tên';

      let speedKmh = timeMs > 0 ? Math.round((distM / 1000) / (timeMs / 3600000)) : 45;
      if (distM < 300 && speedKmh < 28) {
        speedKmh = 35;
      }

      let congestionLevel = 'NORMAL';
      let color = '#2563eb'; // Xanh dương thông thoáng

      if (isNamedStreet && distM >= 250) {
        const matchesCongested = congestedCorridors.some((k) => streetLower.includes(k));
        const matchesBusy = busyCorridors.some((k) => streetLower.includes(k));

        if (matchesCongested || speedKmh < 22) {
          congestionLevel = 'CONGESTED';
          color = '#dc2626'; // Đỏ: Ùn tắc / Di chuyển rất chậm
          speedKmh = Math.min(speedKmh, isRushHour ? 16 : 21);
          congestedRoadSet.add(streetRaw);
          extraDelayMins += Math.max(2, Math.round((distM / 1000) * 1.8));
        } else if (matchesBusy || (speedKmh >= 22 && speedKmh <= 38)) {
          congestionLevel = 'SLOW';
          color = '#f59e0b'; // Cam: Đông xe / Di chuyển chậm
          speedKmh = Math.min(speedKmh, isRushHour ? 28 : 34);
          slowRoadSet.add(streetRaw);
          extraDelayMins += Math.max(1, Math.round((distM / 1000) * 0.7));
        }
      }

      trafficSegments.push({
        streetName: isNamedStreet ? streetRaw : 'Đường nhánh / Nút giao',
        distanceKm: parseFloat((distM / 1000).toFixed(2)),
        durationMins: Math.max(1, Math.round(timeMs / 60000)),
        speedKmh: Math.max(12, Math.min(80, speedKmh)),
        congestionLevel,
        color,
        positions: segPositions
      });
    }
  }

  if (trafficSegments.length === 0 && coordsLatLng.length > 1) {
    trafficSegments.push({
      streetName: 'Tuyến chính',
      distanceKm: totalDistKm,
      durationMins: baseDurationMins,
      speedKmh: 48,
      congestionLevel: 'NORMAL',
      color: '#2563eb',
      positions: coordsLatLng
    });
  }

  const congestedRoads = Array.from(congestedRoadSet);
  const slowRoads = Array.from(slowRoadSet);
  const liveDurationMins = baseDurationMins + extraDelayMins;
  const avgSpeedKmh = liveDurationMins > 0
    ? Math.max(18, Math.round(totalDistKm / (liveDurationMins / 60)))
    : 45;

  let status = 'SMOOTH';
  let statusLabel = 'Giao thông thông thoáng';
  if (congestedRoads.length > 0) {
    status = 'CONGESTED';
    statusLabel = `Ùn tắc cục bộ trên: ${congestedRoads.slice(0, 2).join(', ')}`;
  } else if (slowRoads.length > 0) {
    status = 'SLOW';
    statusLabel = `Đông phương tiện trên: ${slowRoads.slice(0, 2).join(', ')}`;
  }

  const now = new Date();
  const arrivalDate = new Date(now.getTime() + liveDurationMins * 60000);
  const etaText = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;

  return {
    trafficSegments,
    delayMins: extraDelayMins,
    liveDurationMins,
    etaText,
    trafficSummary: {
      status,
      statusLabel,
      avgSpeedKmh,
      delayMins: extraDelayMins,
      congestedRoads,
      slowRoads,
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  };
}

/**
 * Tính toán ETA trực tiếp thời gian thực cho danh sách điểm dừng dựa trên dữ liệu VietMap & mật độ giao thông
 */
export function computeStopsLiveEta(stops = [], routeResult = {}, plannedStartStr = '') {
  if (!Array.isArray(stops) || stops.length === 0) return [];

  // Lấy mốc giờ xuất phát (ưu tiên giờ thực tế hiện tại để tính Live ETA, hoặc giờ trong plannedStartStr nếu muốn)
  const now = new Date();
  let cursorMinutes = now.getHours() * 60 + now.getMinutes();

  // Nếu plannedStartStr có định dạng HH:mm hợp lệ thì có thể tham chiếu, nhưng Live ETA ưu tiên thời gian thực hiện tại
  const timeMatch = String(plannedStartStr || '').match(/(\d{1,2}):(\d{2})/);
  if (timeMatch && !routeResult?.useCurrentClock) {
    // Vẫn giữ đồng bộ với giờ hiện tại nếu chênh lệch lớn để điều phối viên thấy ETA thực tế ngay bây giờ
    cursorMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const formatHm = (minsTotal) => {
    const normalized = ((Math.round(minsTotal) % 1440) + 1440) % 1440;
    const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
    const mm = String(normalized % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const totalDuration = Number(routeResult?.durationMins) || 90;
  const legs = Array.isArray(routeResult?.legs) ? routeResult.legs : [];
  const legCount = Math.max(1, stops.length - 1);

  return stops.map((stop, index) => {
    if (index === 0) {
      return {
        ...stop,
        eta: `xuất phát ${formatHm(cursorMinutes)}`,
        liveEtaTime: formatHm(cursorMinutes)
      };
    }

    const legInfo = legs[index - 1];
    const legDriveMins = legInfo?.durationMins
      ? Number(legInfo.durationMins)
      : Math.max(10, Math.round(totalDuration / legCount));

    cursorMinutes += legDriveMins;
    const arrivalTimeStr = formatHm(cursorMinutes);

    // Cộng thêm thời gian bốc/dỡ/nghỉ tại điểm dừng này trước khi đi tới điểm tiếp theo
    let dwellMins = 20;
    if (stop.type === 'PICKUP') dwellMins = 30;
    else if (stop.type === 'REST') dwellMins = 15;
    else if (stop.type === 'DROPOFF') dwellMins = 25;

    cursorMinutes += dwellMins;

    return {
      ...stop,
      legDistanceKm: legInfo?.distanceKm || null,
      legDriveMins,
      eta: `ETA ${arrivalTimeStr}`,
      liveEtaTime: arrivalTimeStr
    };
  });
}

/**
 * Lấy lộ trình đường bộ thực tế ngắn nhất + Phân tích Giao thông & ETA trực tiếp từ VietMap API
 * Hỗ trợ từ 2 điểm đến nhiều điểm dừng (multi-stop waypoints)
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @param {AbortSignal} [signal]
 */
export async function fetchShortestRoadRoute(points = [], signal = undefined) {
  const validPoints = (points || []).filter(
    (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !Number.isNaN(p.lat) && !Number.isNaN(p.lng)
  );

  if (validPoints.length < 2) {
    return {
      success: false,
      provider: 'none',
      distanceKm: 0,
      durationMins: 0,
      delayMins: 0,
      polyline: [],
      trafficSegments: [],
      trafficSummary: null,
      legs: []
    };
  }

  const cacheKey = validPoints
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join('|');

  if (roadRouteCache.has(cacheKey)) {
    return roadRouteCache.get(cacheKey);
  }

  const wpParam = validPoints.map((p) => `${p.lat},${p.lng}`).join('|');

  // 1. Ưu tiên gọi qua Backend Proxy (/api/routing/road-route?waypoints=...) đã tích hợp VietMap Live Traffic
  try {
    const beUrl = `${API_BASE_URL}/routing/road-route?waypoints=${encodeURIComponent(wpParam)}`;
    const res = await fetch(beUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.polyline) && data.polyline.length > 2) {
        const result = {
          success: true,
          provider: data.provider || 'vietmap_live',
          distanceKm: data.distanceKm,
          durationMins: data.durationMins,
          baseDurationMins: data.baseDurationMins || data.durationMins,
          delayMins: data.delayMins || 0,
          etaText: data.etaText || null,
          polyline: data.polyline,
          trafficSegments: Array.isArray(data.trafficSegments) ? data.trafficSegments : [],
          trafficSummary: data.trafficSummary || null,
          legs: Array.isArray(data.legs) ? data.legs : []
        };
        roadRouteCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    // Chuyển sang gọi trực tiếp VietMap Routing API v1.1 từ trình duyệt
  }

  // 2. Gọi trực tiếp VietMap Routing API v1.1 (Máy chủ nội địa Việt Nam ~50ms)
  try {
    const pointQuery = validPoints.map((p) => `point=${p.lat},${p.lng}`).join('&');
    const vmUrl = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}&${pointQuery}&vehicle=car&points_encoded=false`;
    const vmRes = await fetch(vmUrl, { signal });
    if (vmRes.ok) {
      const vmData = await vmRes.json();
      const vmPath = vmData?.paths?.[0];
      if (vmData?.code === 'OK' && vmPath && vmPath.points?.coordinates?.length > 1) {
        const distMeters = Number(vmPath.distance) || 0;
        const timeMs = Number(vmPath.time) || 0;
        const distanceKm = parseFloat((distMeters / 1000).toFixed(1));
        const baseDurationMins = Math.max(5, Math.round(timeMs / 60000));
        const polyline = vmPath.points.coordinates.map(([lng, lat]) => [lat, lng]);

        const {
          trafficSegments,
          delayMins,
          liveDurationMins,
          etaText,
          trafficSummary
        } = buildClientTrafficAnalysis(polyline, vmPath.instructions || [], distanceKm, baseDurationMins);

        const legCount = Math.max(1, validPoints.length - 1);
        const rawLegs = [];
        for (let i = 0; i < legCount; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];
          const approxDist = Math.hypot((p2.lat - p1.lat) * 111, (p2.lng - p1.lng) * 102);
          rawLegs.push({ approxDist });
        }
        const sumApprox = rawLegs.reduce((acc, l) => acc + l.approxDist, 0) || 1;
        const legs = rawLegs.map((l) => {
          const ratio = l.approxDist / sumApprox;
          return {
            distanceKm: parseFloat(Math.max(1, distanceKm * ratio).toFixed(1)),
            durationMins: Math.max(5, Math.round(liveDurationMins * ratio))
          };
        });

        const result = {
          success: true,
          provider: 'vietmap_live',
          distanceKm,
          durationMins: liveDurationMins,
          baseDurationMins,
          delayMins,
          etaText,
          polyline,
          trafficSegments,
          trafficSummary,
          legs
        };
        roadRouteCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    // Chuyển sang Geoapify
  }

  // 3. Dự phòng: Geoapify Road Routing API
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
          const distanceKm = parseFloat((distMeters / 1000).toFixed(1));
          const durationMins = Math.max(5, Math.round(timeSecs / 60));
          const { trafficSegments, trafficSummary, etaText } = buildClientTrafficAnalysis(
            polyline,
            [],
            distanceKm,
            durationMins
          );
          const result = {
            success: true,
            provider: 'geoapify_road_short',
            distanceKm,
            durationMins,
            delayMins: 0,
            etaText,
            polyline,
            trafficSegments,
            trafficSummary,
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

  // 4. Fallback OSRM Road Routing Server
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
          const sortedRoutes = [...osrmData.routes].sort((a, b) => a.distance - b.distance);
          const shortest = sortedRoutes[0];
          const polyline = shortest.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const legs = Array.isArray(shortest.legs)
            ? shortest.legs.map((leg) => ({
                distanceKm: parseFloat(((leg.distance || 0) / 1000).toFixed(1)),
                durationMins: Math.max(5, Math.round((leg.duration || 0) / 60))
              }))
            : [];

          const distanceKm = parseFloat((shortest.distance / 1000).toFixed(1));
          const durationMins = Math.max(5, Math.round(shortest.duration / 60));
          const { trafficSegments, trafficSummary, etaText } = buildClientTrafficAnalysis(
            polyline,
            [],
            distanceKm,
            durationMins
          );

          const result = {
            success: true,
            provider: 'osrm_road_short',
            distanceKm,
            durationMins,
            delayMins: 0,
            etaText,
            polyline,
            trafficSegments,
            trafficSummary,
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

  return {
    success: false,
    provider: 'none',
    distanceKm: 0,
    durationMins: 0,
    delayMins: 0,
    polyline: [],
    trafficSegments: [],
    trafficSummary: null,
    legs: []
  };
}

/**
 * Sắp xếp thứ tự các điểm trả hàng (dropoffStops) theo QUÃNG ĐƯỜNG BỘ THỰC TẾ NGẮN NHẤT
 */
export async function optimizeDropoffsByRoadDistance(anchorStop, dropoffStops = []) {
  if (!Array.isArray(dropoffStops) || dropoffStops.length <= 1) {
    return dropoffStops;
  }

  const remaining = [...dropoffStops];
  const ordered = [];
  let current = anchorStop;

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      ordered.push(remaining[0]);
      break;
    }

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
