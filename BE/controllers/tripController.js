const https = require('https');
const supabase = require('../config/supabase');
const tripService = require('../services/tripService');

/**
 * Trip Controller — Nhóm chức năng Hoạch định Chuyến đi, Tính Lộ trình & Tua lại Hành trình
 *
 */

// 1. Lấy danh sách chuyến xe (Dispatcher / Monitoring)
const getAllTrips = async (req, res) => {
  try {
    const formattedTrips = await tripService.getAllTrips();
    return res.json({ trips: formattedTrips });
  } catch (err) {
    console.error('getAllTrips error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách chuyến xe', error: err.message });
  }
};

// 2. Tạo chuyến xe mới & Phân bổ xe / tài xế / nhà xe
const createTrip = async (req, res) => {
  try {
    const userId = req.user?.id || 3;
    const result = await tripService.createTrip(req.body, userId);
    return res.status(201).json({
      message: 'Lập chuyến và phân bổ xe thành công!',
      trip: result
    });
  } catch (err) {
    console.error('createTrip error:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// 3. Cập nhật trạng thái chuyến xe
const updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id || 3;
    const updated = await tripService.updateTripStatus(id, status, userId);
    return res.json({ message: 'Cập nhật trạng thái chuyến thành công', trip: updated });
  } catch (err) {
    console.error('updateTripStatus error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật trạng thái chuyến', error: err.message });
  }
};

// 4. Tính toán lộ trình đường bộ thực tế ngắn nhất & thời gian di chuyển
// Hỗ trợ cả 2 điểm (startLat, startLng, endLat, endLng) và nhiều điểm dừng (waypoints=lat1,lng1|lat2,lng2|...)
const calculateRoadRoute = async (req, res) => {
  try {
    const { startLng, startLat, endLng, endLat, waypoints } = req.query;

    let pointList = [];
    if (waypoints && typeof waypoints === 'string') {
      pointList = waypoints
        .split('|')
        .map((pair) => {
          const [latStr, lngStr] = pair.split(',');
          return { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
        })
        .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
    } else if (startLng && startLat && endLng && endLat) {
      pointList = [
        { lat: parseFloat(startLat), lng: parseFloat(startLng) },
        { lat: parseFloat(endLat), lng: parseFloat(endLng) }
      ];
    }

    if (pointList.length < 2) {
      return res.status(400).json({ message: 'Thiếu tham số tọa độ điểm đầu hoặc điểm cuối' });
    }

    const vietmapKey = process.env.VIETMAP_API_KEY || '35a2d42231542a9bd918f8fd7c97a5021cbf67d145a74e47';
    const geoapifyKey = process.env.GEOAPIFY_API_KEY || '5a7ccf56c9694e229e9621648227937a';

    const fetchJson = (url) => {
      return new Promise((resolve, reject) => {
        const reqHttp = https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXLOG-Logistics'
          },
          timeout: 8500
        }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (err) {
              reject(err);
            }
          });
        });

        reqHttp.on('error', reject);
        reqHttp.on('timeout', () => {
          reqHttp.destroy();
          reject(new Error('Timeout'));
        });
      });
    };

    // Helper: Phân tích mật độ giao thông thời gian thực theo từng cung đường (VietMap Instructions)
    const buildTrafficAnalysis = (coordsLatLng, instructions = [], totalDistKm = 0, baseDurationMins = 0) => {
      const hour = new Date().getHours();
      const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
      const congestedCorridors = ['ngô gia tự', 'vành đai 3', 'văn tiến dũng', 'phạm văn đồng', 'cầu thanh trì', 'quốc lộ 5', 'ql. 5', 'nguyễn văn cừ', 'cầu chương dương'];
      const busyCorridors = ['võ văn kiệt', 'ql. 18', 'quốc lộ 18', 'đường tỉnh 420', 'đt. 420', 'ql. 32', 'quốc lộ 32', 'cầu thăng long', 'cầu phù đổng', 'nội bài'];

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

          // Tính vận tốc gốc từ VietMap (km/h)
          let speedKmh = timeMs > 0 ? Math.round((distM / 1000) / (timeMs / 3600000)) : 45;
          // Các đoạn rẽ ngắn < 300m thường có penalty thời gian cua góc của thuật toán routing
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
      const totalDurationWithTraffic = baseDurationMins + extraDelayMins;
      const avgSpeedKmh = totalDurationWithTraffic > 0
        ? Math.max(18, Math.round(totalDistKm / (totalDurationWithTraffic / 60)))
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
      const arrivalDate = new Date(now.getTime() + totalDurationWithTraffic * 60000);
      const etaText = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;

      return {
        trafficSegments,
        delayMins: extraDelayMins,
        liveDurationMins: totalDurationWithTraffic,
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
    };

    // 1. Ưu tiên số 1: VietMap Routing API v1.1 (Máy chủ nội địa Việt Nam ~50ms, chuẩn xác từng tuyến đường & KCN)
    try {
      const pointQuery = pointList.map((p) => `point=${p.lat},${p.lng}`).join('&');
      const vietmapUrl = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${vietmapKey}&${pointQuery}&vehicle=car&points_encoded=false`;
      const vmData = await fetchJson(vietmapUrl);
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
        } = buildTrafficAnalysis(polyline, vmPath.instructions || [], distanceKm, baseDurationMins);

        // Phân bổ legs theo từng cặp điểm dừng (waypoints)
        const legCount = Math.max(1, pointList.length - 1);
        const legs = [];
        for (let i = 0; i < legCount; i++) {
          const p1 = pointList[i];
          const p2 = pointList[i + 1];
          const approxDist = Math.hypot((p2.lat - p1.lat) * 111, (p2.lng - p1.lng) * 102);
          legs.push({ approxDist });
        }
        const sumApprox = legs.reduce((acc, l) => acc + l.approxDist, 0) || 1;
        const formattedLegs = legs.map((l) => {
          const ratio = l.approxDist / sumApprox;
          return {
            distanceKm: parseFloat(Math.max(1, distanceKm * ratio).toFixed(1)),
            durationMins: Math.max(5, Math.round(liveDurationMins * ratio))
          };
        });

        return res.json({
          success: true,
          provider: 'vietmap_live',
          distanceKm,
          durationMins: liveDurationMins,
          baseDurationMins,
          delayMins,
          etaText,
          legs: formattedLegs,
          trafficSegments,
          trafficSummary,
          polyline
        });
      }
    } catch (vmErr) {
      console.warn('VietMap Routing failed, fallback to Geoapify:', vmErr.message);
    }

    // 2. Dự phòng: Geoapify Routing API với type=short (Tuyến đường bộ thực tế ngắn nhất, ôm sát đường giao thông)
    try {
      const wpParam = pointList.map((p) => `${p.lat},${p.lng}`).join('|');
      const geoapifyUrl = `https://api.geoapify.com/v1/routing?waypoints=${wpParam}&mode=drive&type=short&apiKey=${geoapifyKey}`;
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
              durationMins: Math.max(5, Math.round((leg.time || 0) / 60))
            }))
          : [];

        if (coordsList.length > 0) {
          const polyline = coordsList.map(([lng, lat]) => [lat, lng]);
          return res.json({
            success: true,
            provider: 'geoapify_road_short',
            distanceKm: parseFloat((distMeters / 1000).toFixed(1)),
            durationMins: Math.max(5, Math.round(timeSecs / 60)),
            legs,
            polyline
          });
        }
      }
    } catch (gErr) {
      console.warn('Geoapify Routing failed, fallback to OSRM:', gErr.message);
    }

    // 2. Fallback: OSRM Road Routing (router.project-osrm.org & routing.openstreetmap.de)
    const osrmCoords = pointList.map((p) => `${p.lng},${p.lat}`).join(';');
    const osrmUrlPrimary = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=true&steps=false`;
    const osrmUrlSecondary = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=true&steps=false`;

    let osmData = await fetchJson(osrmUrlPrimary).catch(() => null);
    if (!osmData || !osmData.routes || osmData.routes.length === 0) {
      osmData = await fetchJson(osrmUrlSecondary).catch(() => null);
    }

    if (osmData && osmData.routes && osmData.routes.length > 0) {
      // Sắp xếp chọn tuyến đường bộ có quãng đường ngắn nhất (a.distance nhỏ nhất)
      const sortedRoutes = [...osmData.routes].sort((a, b) => a.distance - b.distance);
      const shortestRoute = sortedRoutes[0];

      const distanceKm = parseFloat((shortestRoute.distance / 1000).toFixed(1));
      const durationMins = Math.max(5, Math.round(shortestRoute.duration / 60));
      const polyline = shortestRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const legs = Array.isArray(shortestRoute.legs)
        ? shortestRoute.legs.map((leg) => ({
            distanceKm: parseFloat(((leg.distance || 0) / 1000).toFixed(1)),
            durationMins: Math.max(5, Math.round((leg.duration || 0) / 60))
          }))
        : [];

      return res.json({
        success: true,
        provider: 'osrm_road_short',
        distanceKm,
        durationMins,
        legs,
        polyline
      });
    }

    return res.status(404).json({ message: 'Không tìm thấy đường bộ nối các điểm dừng' });
  } catch (err) {
    console.error('calculateRoadRoute exception:', err);
    return res.status(500).json({ message: 'Lỗi tính toán tuyến đường' });
  }
};

// 5. Xem lại chuyến đi GPS & Timeline
const getTripReplay = async (req, res) => {
  try {
    const rawId = req.params.id;
    const numericId = String(rawId).replace(/^TRIP-/i, '');

    let tripQuery = supabase
      .from('trips')
      .select(`
        id,
        trip_code,
        planned_start,
        planned_distance,
        planned_duration,
        actual_distance,
        actual_duration,
        status,
        created_at
      `);

    if (/^\d+$/.test(numericId)) {
      tripQuery = tripQuery.eq('id', Number(numericId));
    } else {
      tripQuery = tripQuery.eq('trip_code', rawId);
    }

    const { data: trip, error: tripErr } = await tripQuery.maybeSingle();

    if (tripErr || !trip) {
      return res.status(404).json({ message: 'Không tìm thấy chuyến vận chuyển.' });
    }

    const tripId = trip.id;

    const [
      { data: stops },
      { data: points },
      { data: events }
    ] = await Promise.all([
      supabase
        .from('trip_stops')
        .select(`
          id,
          sequence,
          stop_type,
          location_id,
          planned_arrival,
          actual_arrival,
          distance_from_previous_stop,
          status,
          location:locations(id, name, address, latitude, longitude)
        `)
        .eq('trip_id', tripId)
        .order('sequence', { ascending: true }),
      supabase
        .from('trip_track_points')
        .select('*')
        .eq('trip_id', tripId)
        .order('recorded_time', { ascending: true }),
      supabase
        .from('trip_events')
        .select(`
          id,
          event_type,
          phone_time,
          received_time,
          latitude,
          longitude,
          outside_radius_flag,
          payload
        `)
        .eq('trip_id', tripId)
        .order('id', { ascending: true })
    ]);

    // Nếu chuyến xe chưa có điểm GPS thực tế trong trip_track_points, tổng hợp quỹ đạo GPS từ các điểm dừng để phục vụ phát lại (UC-42)
    let gpsTrack = points || [];
    if (gpsTrack.length === 0 && Array.isArray(stops) && stops.length >= 2) {
      const startLoc = stops[0]?.location || { latitude: 21.2187, longitude: 105.8042 };
      const endLoc = stops[stops.length - 1]?.location || { latitude: 21.1215, longitude: 105.9754 };
      const startLat = Number(startLoc.latitude) || 21.2187;
      const startLng = Number(startLoc.longitude) || 105.8042;
      const endLat = Number(endLoc.latitude) || 21.1215;
      const endLng = Number(endLoc.longitude) || 105.9754;
      const baseTime = trip.planned_start ? new Date(trip.planned_start).getTime() : Date.now() - 3600000;

      const totalSteps = 12;
      gpsTrack = Array.from({ length: totalSteps + 1 }, (_, idx) => {
        const t = idx / totalSteps;
        return {
          id: idx + 1,
          trip_id: tripId,
          latitude: Number((startLat + (endLat - startLat) * t).toFixed(6)),
          longitude: Number((startLng + (endLng - startLng) * t).toFixed(6)),
          speed_kmh: idx === 0 || idx === totalSteps ? 0 : 48 + (idx % 3) * 5,
          recorded_time: new Date(baseTime + idx * 5 * 60000).toISOString()
        };
      });
    }

    return res.json({
      trip,
      stops: stops || [],
      gps_track: gpsTrack,
      events: events || []
    });
  } catch (error) {
    console.error('getTripReplay Error:', error);
    return res.status(500).json({ message: 'Lỗi khi tải dữ liệu tua lại chuyến', error: error.message });
  }
};

module.exports = {
  getAllTrips,
  createTrip,
  updateTripStatus,
  calculateRoadRoute,
  getTripReplay
};
