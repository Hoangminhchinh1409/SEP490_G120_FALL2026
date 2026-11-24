const https = require('https');

const FETCH_TIMEOUT_MS = 8500;
const VIETMAP_BASE_URL = 'https://maps.vietmap.vn/api';

const fetchBuffer = (url) => {
  return new Promise((resolve, reject) => {
    const reqHttp = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXLOG-Logistics'
        },
        timeout: FETCH_TIMEOUT_MS
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 500,
            headers: response.headers || {},
            body: Buffer.concat(chunks)
          });
        });
      }
    );

    reqHttp.on('error', reject);
    reqHttp.on('timeout', () => {
      reqHttp.destroy();
      reject(new Error('Request timeout'));
    });
  });
};

const fetchJson = async (url) => {
  const { statusCode, body } = await fetchBuffer(url);
  const rawText = body.toString('utf8');
  if (statusCode < 200 || statusCode >= 300) {
    const err = new Error(`Upstream HTTP ${statusCode}: ${rawText.slice(0, 200)}`);
    err.statusCode = statusCode;
    throw err;
  }
  return JSON.parse(rawText);
};

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const computePolylineDistanceMeters = (positions = []) => {
  let sum = 0;
  for (let i = 1; i < positions.length; i += 1) {
    sum += haversineMeters(positions[i - 1][0], positions[i - 1][1], positions[i][0], positions[i][1]);
  }
  return sum;
};

const resolveStreetNameForRange = (firstIdx, lastIdx, instructions = []) => {
  if (!Array.isArray(instructions) || instructions.length === 0) return 'Tuyến đường chính';
  for (const inst of instructions) {
    const interval = Array.isArray(inst.interval) ? inst.interval : null;
    if (!interval || interval.length < 2) continue;
    const [s, e] = interval;
    if (lastIdx >= s && firstIdx <= e) {
      const name = String(inst.street_name || '').trim();
      if (name && name !== 'Đường Không Tên') return name;
    }
  }
  return 'Tuyến đường';
};

const mapCongestionValue = (rawVal) => {
  const normalized = String(rawVal || 'low').toLowerCase();
  if (normalized === 'severe' || normalized === 'heavy') {
    return { congestionLevel: 'CONGESTED', color: '#dc2626' };
  }
  if (normalized === 'moderate') {
    return { congestionLevel: 'SLOW', color: '#f59e0b' };
  }
  return { congestionLevel: 'NORMAL', color: '#2563eb' };
};

/**
 * Xây dựng phân tích mật độ giao thông trực tiếp từ VietMap Route v4 annotations (không hardcode tuyến đường)
 */
const buildVietmapV4TrafficAnalysis = (coordsLatLng, vmPath = {}, distanceKm = 0, durationMins = 0) => {
  const instructions = Array.isArray(vmPath.instructions) ? vmPath.instructions : [];
  const rawCongestions = Array.isArray(vmPath.annotations?.congestion) ? vmPath.annotations.congestion : [];
  const rawCongestionDist = Array.isArray(vmPath.annotations?.congestion_distance)
    ? vmPath.annotations.congestion_distance
    : [];

  const trafficSegments = [];
  const congestedRoadSet = new Set();
  const slowRoadSet = new Set();
  let congestedMeters = 0;
  let slowMeters = 0;

  // Gom các đoạn liên tiếp cùng mức độ ùn tắc để giảm số lượng Polyline trên bản đồ
  const mergedBands = [];
  for (let i = 0; i < rawCongestions.length; i += 1) {
    const entry = rawCongestions[i];
    if (!entry || typeof entry.first !== 'number' || typeof entry.last !== 'number') continue;
    const { congestionLevel, color } = mapCongestionValue(entry.value);
    const segMetersRaw = Number(rawCongestionDist[i]?.value);

    const lastBand = mergedBands[mergedBands.length - 1];
    if (
      lastBand &&
      lastBand.congestionLevel === congestionLevel &&
      entry.first <= lastBand.last + 1 &&
      congestionLevel === 'NORMAL'
    ) {
      lastBand.last = Math.max(lastBand.last, entry.last);
      if (!Number.isNaN(segMetersRaw)) lastBand.meters += segMetersRaw;
    } else {
      mergedBands.push({
        first: Math.max(0, entry.first),
        last: Math.min(coordsLatLng.length - 1, entry.last),
        congestionLevel,
        color,
        meters: !Number.isNaN(segMetersRaw) ? segMetersRaw : 0
      });
    }
  }

  for (const band of mergedBands) {
    if (band.last <= band.first) continue;
    const positions = coordsLatLng.slice(band.first, band.last + 1);
    if (positions.length < 2) continue;

    const meters = band.meters > 0 ? band.meters : computePolylineDistanceMeters(positions);
    const streetName = resolveStreetNameForRange(band.first, band.last, instructions);

    if (band.congestionLevel === 'CONGESTED') {
      congestedMeters += meters;
      if (streetName && streetName !== 'Tuyến đường') congestedRoadSet.add(streetName);
    } else if (band.congestionLevel === 'SLOW') {
      slowMeters += meters;
      if (streetName && streetName !== 'Tuyến đường') slowRoadSet.add(streetName);
    }

    const avgRouteSpeed = durationMins > 0 ? Math.round(distanceKm / (durationMins / 60)) : 40;
    const segSpeedKmh =
      band.congestionLevel === 'CONGESTED'
        ? Math.max(10, Math.min(20, Math.round(avgRouteSpeed * 0.45)))
        : band.congestionLevel === 'SLOW'
          ? Math.max(20, Math.min(35, Math.round(avgRouteSpeed * 0.72)))
          : Math.max(25, avgRouteSpeed);

    trafficSegments.push({
      streetName,
      distanceKm: parseFloat((meters / 1000).toFixed(2)),
      speedKmh: segSpeedKmh,
      congestionLevel: band.congestionLevel,
      color: band.color,
      positions
    });
  }

  // Fallback nếu API không trả annotations chi tiết: dùng toàn tuyến ở mức NORMAL
  if (trafficSegments.length === 0 && coordsLatLng.length > 1) {
    const avgRouteSpeed = durationMins > 0 ? Math.max(15, Math.round(distanceKm / (durationMins / 60))) : 40;
    trafficSegments.push({
      streetName: 'Tuyến chính VietMap v4',
      distanceKm,
      speedKmh: avgRouteSpeed,
      congestionLevel: 'NORMAL',
      color: '#2563eb',
      positions: coordsLatLng
    });
  }

  const congestedRoads = Array.from(congestedRoadSet);
  const slowRoads = Array.from(slowRoadSet);
  const avgSpeedKmh = durationMins > 0 ? Math.max(12, Math.round(distanceKm / (durationMins / 60))) : 40;

  let status = 'SMOOTH';
  let statusLabel = 'Giao thông thông thoáng (VietMap v4)';
  if (congestedMeters >= 200 || congestedRoads.length > 0) {
    status = 'CONGESTED';
    statusLabel =
      congestedRoads.length > 0
        ? `Ùn tắc cục bộ trên: ${congestedRoads.slice(0, 2).join(', ')}`
        : `Phát hiện ${parseFloat((congestedMeters / 1000).toFixed(1))} km ùn tắc theo VietMap v4`;
  } else if (slowMeters >= 400 || slowRoads.length > 0) {
    status = 'SLOW';
    statusLabel =
      slowRoads.length > 0
        ? `Di chuyển chậm trên: ${slowRoads.slice(0, 2).join(', ')}`
        : `Di chuyển chậm ${parseFloat((slowMeters / 1000).toFixed(1))} km theo VietMap v4`;
  }

  const arrivalDate = new Date(Date.now() + durationMins * 60000);
  const etaText = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;

  return {
    trafficSegments,
    etaText,
    trafficSummary: {
      status,
      statusLabel,
      avgSpeedKmh,
      delayMins: 0,
      congestedDistanceKm: parseFloat((congestedMeters / 1000).toFixed(2)),
      slowDistanceKm: parseFloat((slowMeters / 1000).toFixed(2)),
      congestedRoads,
      slowRoads,
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  };
};

const computeLegsFromPoints = (pointList, distanceKm, durationMins) => {
  const legCount = Math.max(1, pointList.length - 1);
  const legs = [];
  for (let i = 0; i < legCount; i += 1) {
    const p1 = pointList[i];
    const p2 = pointList[i + 1];
    const approxDist = haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);
    legs.push({ approxDist });
  }
  const sumApprox = legs.reduce((acc, l) => acc + l.approxDist, 0) || 1;
  return legs.map((l) => {
    const ratio = l.approxDist / sumApprox;
    return {
      distanceKm: parseFloat(Math.max(0.5, distanceKm * ratio).toFixed(1)),
      durationMins: Math.max(2, Math.round(durationMins * ratio))
    };
  });
};

const calculateRoadRoute = async (pointList = [], { vehicle = 'truck' } = {}) => {
  if (!Array.isArray(pointList) || pointList.length < 2) {
    const err = new Error('Thiếu tham số tọa độ điểm đầu hoặc điểm cuối');
    err.statusCode = 400;
    throw err;
  }

  const vietmapKey = process.env.VIETMAP_API_KEY;
  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  const safeVehicle = ['car', 'motorcycle', 'truck', 'container'].includes(vehicle) ? vehicle : 'truck';

  // 1. VietMap Routing API v4 (dữ liệu giao thông & cầu đường thực tế tại Việt Nam)
  if (vietmapKey) {
    try {
      const pointQuery = pointList.map((p) => `point=${p.lat},${p.lng}`).join('&');
      const vietmapUrl =
        `${VIETMAP_BASE_URL}/route/v4?apikey=${encodeURIComponent(vietmapKey)}&${pointQuery}` +
        `&vehicle=${safeVehicle}&points_encoded=false&annotations=toll,congestion,congestion_distance`;
      const vmData = await fetchJson(vietmapUrl);
      const vmPath = vmData?.paths?.[0];

      if (vmData?.code === 'OK' && vmPath && vmPath.points?.coordinates?.length > 1) {
        const distMeters = Number(vmPath.distance) || 0;
        const timeMs = Number(vmPath.time) || 0;
        const distanceKm = parseFloat((distMeters / 1000).toFixed(1));
        const durationMins = Math.max(1, Math.round(timeMs / 60000));
        const polyline = vmPath.points.coordinates.map(([lng, lat]) => [lat, lng]);

        const { trafficSegments, etaText, trafficSummary } = buildVietmapV4TrafficAnalysis(
          polyline,
          vmPath,
          distanceKm,
          durationMins
        );

        return {
          success: true,
          provider: 'vietmap_v4',
          distanceKm,
          durationMins,
          baseDurationMins: durationMins,
          delayMins: 0,
          etaText,
          tollCost: Number(vmPath.toll_cost) || 0,
          tolls: Array.isArray(vmPath.tolls) ? vmPath.tolls : [],
          legs: computeLegsFromPoints(pointList, distanceKm, durationMins),
          trafficSegments,
          trafficSummary,
          polyline
        };
      }
    } catch (vmErr) {
      console.warn('VietMap Route v4 failed, trying fallback:', vmErr.message);
    }
  }

  // 2. Dự phòng: Geoapify Routing API (chìa khóa đặt tại BE)
  if (geoapifyKey) {
    try {
      const wpParam = pointList.map((p) => `${p.lat},${p.lng}`).join('|');
      const geoapifyUrl = `https://api.geoapify.com/v1/routing?waypoints=${wpParam}&mode=drive&type=short&apiKey=${encodeURIComponent(geoapifyKey)}`;
      const geoData = await fetchJson(geoapifyUrl);
      const feature = geoData?.features?.[0];

      if (feature && feature.properties) {
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
              durationMins: Math.max(2, Math.round((leg.time || 0) / 60))
            }))
          : [];

        if (coordsList.length > 0) {
          const polyline = coordsList.map(([lng, lat]) => [lat, lng]);
          const distanceKm = parseFloat((distMeters / 1000).toFixed(1));
          const durationMins = Math.max(1, Math.round(timeSecs / 60));
          return {
            success: true,
            provider: 'geoapify_road_short',
            distanceKm,
            durationMins,
            delayMins: 0,
            legs,
            trafficSegments: [
              {
                streetName: 'Tuyến dự phòng Geoapify',
                distanceKm,
                speedKmh: durationMins > 0 ? Math.max(15, Math.round(distanceKm / (durationMins / 60))) : 40,
                congestionLevel: 'NORMAL',
                color: '#2563eb',
                positions: polyline
              }
            ],
            trafficSummary: {
              status: 'SMOOTH',
              statusLabel: 'Dữ liệu tuyến dự phòng (Geoapify)',
              avgSpeedKmh: durationMins > 0 ? Math.max(15, Math.round(distanceKm / (durationMins / 60))) : 40,
              delayMins: 0,
              congestedRoads: [],
              slowRoads: []
            },
            polyline
          };
        }
      }
    } catch (gErr) {
      console.warn('Geoapify Routing failed, fallback to OSRM:', gErr.message);
    }
  }

  // 3. Dự phòng cuối: OSRM
  const osrmCoords = pointList.map((p) => `${p.lng},${p.lat}`).join(';');
  const osrmUrls = [
    `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=true&steps=false`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=true&steps=false`
  ];

  for (const url of osrmUrls) {
    try {
      const osmData = await fetchJson(url);
      if (osmData?.routes?.length > 0) {
        const sortedRoutes = [...osmData.routes].sort((a, b) => a.distance - b.distance);
        const shortestRoute = sortedRoutes[0];
        const distanceKm = parseFloat((shortestRoute.distance / 1000).toFixed(1));
        const durationMins = Math.max(1, Math.round(shortestRoute.duration / 60));
        const polyline = shortestRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const legs = Array.isArray(shortestRoute.legs)
          ? shortestRoute.legs.map((leg) => ({
              distanceKm: parseFloat(((leg.distance || 0) / 1000).toFixed(1)),
              durationMins: Math.max(2, Math.round((leg.duration || 0) / 60))
            }))
          : computeLegsFromPoints(pointList, distanceKm, durationMins);

        return {
          success: true,
          provider: 'osrm_road_short',
          distanceKm,
          durationMins,
          delayMins: 0,
          legs,
          trafficSegments: [
            {
              streetName: 'Tuyến dự phòng OSRM',
              distanceKm,
              speedKmh: durationMins > 0 ? Math.max(15, Math.round(distanceKm / (durationMins / 60))) : 40,
              congestionLevel: 'NORMAL',
              color: '#2563eb',
              positions: polyline
            }
          ],
          trafficSummary: {
            status: 'SMOOTH',
            statusLabel: 'Dữ liệu tuyến dự phòng (OSRM)',
            avgSpeedKmh: durationMins > 0 ? Math.max(15, Math.round(distanceKm / (durationMins / 60))) : 40,
            delayMins: 0,
            congestedRoads: [],
            slowRoads: []
          },
          polyline
        };
      }
    } catch {
      // Thử server tiếp theo
    }
  }

  const err = new Error('Không tìm thấy đường bộ nối các điểm dừng');
  err.statusCode = 404;
  throw err;
};

const requireVietmapKey = () => {
  const key = process.env.VIETMAP_API_KEY;
  if (!key) {
    const err = new Error('Chưa cấu hình VIETMAP_API_KEY trên máy chủ');
    err.statusCode = 500;
    throw err;
  }
  return key;
};

// Cache in-memory (TTL 15 phút) + khử trùng lặp request đang chạy để tránh vượt rate-limit VietMap (HTTP 429)
const VIETMAP_CACHE_TTL_MS = 15 * 60 * 1000;
const VIETMAP_CACHE_MAX_SIZE = 500;
const vietmapCache = new Map();
const vietmapInFlight = new Map();

const cachedVietmapFetch = async (cacheKey, fetcher) => {
  const now = Date.now();
  const cached = vietmapCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }
  if (vietmapInFlight.has(cacheKey)) {
    return vietmapInFlight.get(cacheKey);
  }
  const promise = (async () => {
    try {
      const data = await fetcher();
      if (vietmapCache.size >= VIETMAP_CACHE_MAX_SIZE) {
        const firstKey = vietmapCache.keys().next().value;
        if (firstKey !== undefined) vietmapCache.delete(firstKey);
      }
      vietmapCache.set(cacheKey, { data, expiresAt: Date.now() + VIETMAP_CACHE_TTL_MS });
      return data;
    } finally {
      vietmapInFlight.delete(cacheKey);
    }
  })();
  vietmapInFlight.set(cacheKey, promise);
  return promise;
};

const autocompletePlaces = async ({ text, cityId = null, displayType = 5 }) => {
  const key = requireVietmapKey();
  const cleanText = String(text || '').trim();
  if (!cleanText) return [];
  const cityParam = cityId ? `&cityId=${encodeURIComponent(cityId)}` : '';
  const cacheKey = `ac:${cleanText.toLowerCase()}|${cityId || ''}|${displayType}`;
  return cachedVietmapFetch(cacheKey, () => {
    const url = `${VIETMAP_BASE_URL}/autocomplete/v4?apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(cleanText)}&display_type=${encodeURIComponent(displayType)}${cityParam}`;
    return fetchJson(url);
  });
};

const searchPlaces = async ({ text, cityId = null, displayType = 5 }) => {
  const key = requireVietmapKey();
  const cleanText = String(text || '').trim();
  if (!cleanText) return [];
  const cityParam = cityId ? `&cityId=${encodeURIComponent(cityId)}` : '';
  const cacheKey = `search:${cleanText.toLowerCase()}|${cityId || ''}|${displayType}`;
  return cachedVietmapFetch(cacheKey, () => {
    const url = `${VIETMAP_BASE_URL}/search/v4?apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(cleanText)}&display_type=${encodeURIComponent(displayType)}${cityParam}`;
    return fetchJson(url);
  });
};

const getPlaceDetails = async ({ refid }) => {
  const key = requireVietmapKey();
  const cleanRef = String(refid || '').trim();
  if (!cleanRef) {
    const err = new Error('Thiếu mã refid địa điểm VietMap');
    err.statusCode = 400;
    throw err;
  }
  const cacheKey = `place:${cleanRef}`;
  return cachedVietmapFetch(cacheKey, () => {
    const url = `${VIETMAP_BASE_URL}/place/v4?apikey=${encodeURIComponent(key)}&refid=${encodeURIComponent(cleanRef)}`;
    return fetchJson(url);
  });
};

const fetchVietmapTile = async ({ z, x, y }) => {
  const tileKey = process.env.VIETMAP_TILEMAP_KEY || process.env.VIETMAP_API_KEY;
  if (!tileKey) {
    const err = new Error('Chưa cấu hình VIETMAP_TILEMAP_KEY trên máy chủ');
    err.statusCode = 500;
    throw err;
  }
  const url = `${VIETMAP_BASE_URL}/tm/${z}/${x}/${y}@2x.png?apikey=${encodeURIComponent(tileKey)}`;
  return fetchBuffer(url);
};

module.exports = {
  calculateRoadRoute,
  autocompletePlaces,
  searchPlaces,
  getPlaceDetails,
  fetchVietmapTile,
  buildVietmapV4TrafficAnalysis
};
