const https = require('https');
const supabase = require('../config/supabase');
const tripService = require('../services/tripService');

/**
 * Trip Controller — Nhóm chức năng Hoạch định Chuyến đi, Tính Lộ trình & Tua lại Hành trình
 * (UC-06, UC-07, UC-09, UC-10, UC-41, UC-42 — Screen 11, 12, 13, 39, 40, 43)
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

// 2. Tạo chuyến xe mới & Phân bổ xe / tài xế / nhà xe (UC-06, UC-09, UC-10)
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
    const updated = await tripService.updateTripStatus(id, status);
    return res.json({ message: 'Cập nhật trạng thái chuyến thành công', trip: updated });
  } catch (err) {
    console.error('updateTripStatus error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật trạng thái chuyến', error: err.message });
  }
};

// 4. Tính toán lộ trình đường bộ thực tế ngắn nhất & thời gian di chuyển (UC-07)
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

    // 1. Ưu tiên Geoapify Routing API với type=short (Tuyến đường bộ thực tế ngắn nhất, ôm sát đường giao thông)
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

// 5. Xem lại chuyến đi GPS & Timeline (UC-42 - Screen 40)
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
        .from('gps_points')
        .select('*')
        .eq('trip_id', tripId),
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

    return res.json({
      trip,
      stops: stops || [],
      gps_track: points || [],
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
