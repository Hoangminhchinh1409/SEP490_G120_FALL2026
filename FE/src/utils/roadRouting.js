const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9999/api";

// Tile bản đồ VietMap được proxy qua Back-end để bảo mật API key
export const VIETMAP_TILE_URL = `${API_BASE_URL}/routing/tile/{z}/{x}/{y}`;

// Bộ nhớ đệm tuyến đường bộ để phản hồi tức thì khi đổi qua lại
const roadRouteCache = new Map();

/**
 * Gọi VietMap Autocomplete v4 thông qua Back-end Proxy (không lộ key trên trình duyệt)
 */
export async function autocompleteVietmap(
  text,
  { cityId = null, displayType = 5, signal = undefined } = {},
) {
  const cleanText = String(text || "").trim();
  if (cleanText.length < 2) return [];
  const params = new URLSearchParams({
    text: cleanText,
    display_type: String(displayType),
  });
  if (cityId) params.set("cityId", String(cityId));

  const res = await fetch(
    `${API_BASE_URL}/routing/autocomplete?${params.toString()}`,
    { signal },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Gọi VietMap Search v4 thông qua Back-end Proxy
 */
export async function searchVietmap(
  text,
  { cityId = null, displayType = 5, signal = undefined } = {},
) {
  const cleanText = String(text || "").trim();
  if (cleanText.length < 2) return [];
  const params = new URLSearchParams({
    text: cleanText,
    display_type: String(displayType),
  });
  if (cityId) params.set("cityId", String(cityId));

  const res = await fetch(
    `${API_BASE_URL}/routing/search?${params.toString()}`,
    { signal },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Gọi VietMap Place v4 để lấy tọa độ (lat, lng) và địa giới chuẩn từ ref_id
 */
export async function fetchVietmapPlace(refid, { signal = undefined } = {}) {
  if (!refid) return null;
  const params = new URLSearchParams({ refid: String(refid) });
  const res = await fetch(
    `${API_BASE_URL}/routing/place?${params.toString()}`,
    { signal },
  );
  if (!res.ok) return null;
  return res.json();
}

/**
 * Tính toán ETA cho danh sách điểm dừng dựa trên dữ liệu VietMap v4
 */
export function computeStopsLiveEta(
  stops = [],
  routeResult = {},
  plannedStartStr = "",
) {
  if (!Array.isArray(stops) || stops.length === 0) return [];

  const now = new Date();
  let cursorMinutes = now.getHours() * 60 + now.getMinutes();

  const timeMatch = String(plannedStartStr || "").match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    cursorMinutes =
      parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
  }

  const formatHm = (minsTotal) => {
    const normalized = ((Math.round(minsTotal) % 1440) + 1440) % 1440;
    const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
    const mm = String(normalized % 60).padStart(2, "0");
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
        liveEtaTime: formatHm(cursorMinutes),
      };
    }

    const legInfo = legs[index - 1];
    const legDriveMins = legInfo?.durationMins
      ? Number(legInfo.durationMins)
      : Math.max(10, Math.round(totalDuration / legCount));

    cursorMinutes += legDriveMins;
    const arrivalTimeStr = formatHm(cursorMinutes);

    return {
      ...stop,
      legDistanceKm: legInfo?.distanceKm || null,
      legDriveMins,
      eta: `ETA ${arrivalTimeStr}`,
      liveEtaTime: arrivalTimeStr,
    };
  });
}

/**
 * Lấy lộ trình đường bộ thực tế ngắn nhất + Phân tích giao thông trực tiếp từ VietMap Route v4 (qua BE Proxy)
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @param {AbortSignal} [signal]
 */
export async function fetchShortestRoadRoute(points = [], signal = undefined) {
  const validPoints = (points || []).filter(
    (p) =>
      p &&
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      !Number.isNaN(p.lat) &&
      !Number.isNaN(p.lng),
  );

  if (validPoints.length < 2) {
    return {
      success: false,
      provider: "none",
      distanceKm: 0,
      durationMins: 0,
      delayMins: 0,
      polyline: [],
      trafficSegments: [],
      trafficSummary: null,
      legs: [],
    };
  }

  const cacheKey = validPoints
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join("|");

  if (roadRouteCache.has(cacheKey)) {
    return roadRouteCache.get(cacheKey);
  }

  const wpParam = validPoints.map((p) => `${p.lat},${p.lng}`).join("|");

  // 1. Gọi qua Back-end Proxy (/api/routing/road-route) sử dụng VietMap Route v4 + live annotations
  try {
    const beUrl = `${API_BASE_URL}/routing/road-route?waypoints=${encodeURIComponent(wpParam)}`;
    const res = await fetch(beUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      if (
        data?.success &&
        Array.isArray(data.polyline) &&
        data.polyline.length > 1
      ) {
        const result = {
          success: true,
          provider: data.provider || "vietmap_v4",
          distanceKm: data.distanceKm,
          durationMins: data.durationMins,
          baseDurationMins: data.baseDurationMins || data.durationMins,
          delayMins: data.delayMins || 0,
          etaText: data.etaText || null,
          tollCost: data.tollCost || 0,
          polyline: data.polyline,
          trafficSegments: Array.isArray(data.trafficSegments)
            ? data.trafficSegments
            : [],
          trafficSummary: data.trafficSummary || null,
          legs: Array.isArray(data.legs) ? data.legs : [],
        };
        roadRouteCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    if (e?.name === "AbortError") throw e;
  }

  // 2. Dự phòng cuối nếu BE tạm không phản hồi: OSRM công khai (không cần API key)
  const osrmCoords = validPoints.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const osrmRes = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=true&steps=false`,
      { signal },
    );
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      if (osrmData?.routes?.length > 0) {
        const sortedRoutes = [...osrmData.routes].sort(
          (a, b) => a.distance - b.distance,
        );
        const shortest = sortedRoutes[0];
        const polyline = shortest.geometry.coordinates.map(([lng, lat]) => [
          lat,
          lng,
        ]);
        const legs = Array.isArray(shortest.legs)
          ? shortest.legs.map((leg) => ({
              distanceKm: parseFloat(((leg.distance || 0) / 1000).toFixed(1)),
              durationMins: Math.max(2, Math.round((leg.duration || 0) / 60)),
            }))
          : [];

        const distanceKm = parseFloat((shortest.distance / 1000).toFixed(1));
        const durationMins = Math.max(1, Math.round(shortest.duration / 60));
        const result = {
          success: true,
          provider: "osrm_road_short",
          distanceKm,
          durationMins,
          delayMins: 0,
          etaText: null,
          polyline,
          trafficSegments: [
            {
              streetName: "Tuyến dự phòng OSRM",
              distanceKm,
              speedKmh:
                durationMins > 0
                  ? Math.max(15, Math.round(distanceKm / (durationMins / 60)))
                  : 40,
              congestionLevel: "NORMAL",
              color: "#2563eb",
              positions: polyline,
            },
          ],
          trafficSummary: {
            status: "SMOOTH",
            statusLabel: "Dữ liệu tuyến dự phòng (OSRM)",
            avgSpeedKmh:
              durationMins > 0
                ? Math.max(15, Math.round(distanceKm / (durationMins / 60)))
                : 40,
            delayMins: 0,
            congestedRoads: [],
            slowRoads: [],
          },
          legs,
        };
        roadRouteCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Ignore
  }

  return {
    success: false,
    provider: "none",
    distanceKm: 0,
    durationMins: 0,
    delayMins: 0,
    polyline: [],
    trafficSegments: [],
    trafficSummary: null,
    legs: [],
  };
}

/**
 * Sắp xếp thứ tự các điểm trả hàng (dropoffStops) theo QUÃNG ĐƯỜNG BỘ THỰC TẾ NGẮN NHẤT
 */
export async function optimizeDropoffsByRoadDistance(
  anchorStop,
  dropoffStops = [],
) {
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
          roadKm:
            route.success && route.distanceKm > 0 ? route.distanceKm : Infinity,
        };
      }),
    );

    distances.sort((a, b) => a.roadKm - b.roadKm);
    const bestIdx = distances[0].idx;
    const [chosen] = remaining.splice(bestIdx, 1);
    ordered.push(chosen);
    current = chosen;
  }

  return ordered;
}
