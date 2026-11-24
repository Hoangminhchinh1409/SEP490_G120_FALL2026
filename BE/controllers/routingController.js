const routingService = require('../services/routingService');

/**
 * Routing & Map Proxy Controller (giấu toàn bộ VietMap / Geoapify API keys tại Back-end)
 */

const parsePointList = (query = {}) => {
  const { startLng, startLat, endLng, endLat, waypoints } = query;
  if (waypoints && typeof waypoints === 'string') {
    return waypoints
      .split('|')
      .map((pair) => {
        const [latStr, lngStr] = pair.split(',');
        return { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
      })
      .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
  }
  if (startLng && startLat && endLng && endLat) {
    return [
      { lat: parseFloat(startLat), lng: parseFloat(startLng) },
      { lat: parseFloat(endLat), lng: parseFloat(endLng) }
    ].filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
  }
  return [];
};

const calculateRoadRoute = async (req, res) => {
  try {
    const pointList = parsePointList(req.query);
    if (pointList.length < 2) {
      return res.status(400).json({ message: 'Thiếu tham số tọa độ điểm đầu hoặc điểm cuối' });
    }
    const vehicle = req.query.vehicle || 'truck';
    const result = await routingService.calculateRoadRoute(pointList, { vehicle });
    return res.json(result);
  } catch (err) {
    console.error('calculateRoadRoute exception:', err.message);
    return res.status(err.statusCode || 500).json({ message: err.message || 'Lỗi tính toán tuyến đường' });
  }
};

const autocompletePlaces = async (req, res) => {
  try {
    const { text, cityId, display_type } = req.query;
    if (!text || String(text).trim().length < 2) {
      return res.json([]);
    }
    const data = await routingService.autocompletePlaces({
      text,
      cityId: cityId || null,
      displayType: display_type || 5
    });
    return res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('autocompletePlaces error:', err.message);
    return res.status(err.statusCode || 502).json({ message: 'Không thể tra cứu gợi ý địa chỉ VietMap' });
  }
};

const searchPlaces = async (req, res) => {
  try {
    const { text, cityId, display_type } = req.query;
    if (!text || String(text).trim().length < 2) {
      return res.json([]);
    }
    const data = await routingService.searchPlaces({
      text,
      cityId: cityId || null,
      displayType: display_type || 5
    });
    const list = Array.isArray(data) ? data : (data?.ref_id ? [data] : []);
    return res.json(list);
  } catch (err) {
    console.error('searchPlaces error:', err.message);
    return res.status(err.statusCode || 502).json({ message: 'Không thể tìm kiếm địa chỉ VietMap' });
  }
};

const getPlaceDetails = async (req, res) => {
  try {
    const { refid } = req.query;
    if (!refid) {
      return res.status(400).json({ message: 'Thiếu tham số refid' });
    }
    const data = await routingService.getPlaceDetails({ refid });
    return res.json(data);
  } catch (err) {
    console.error('getPlaceDetails error:', err.message);
    return res.status(err.statusCode || 502).json({ message: 'Không thể lấy chi tiết địa điểm VietMap' });
  }
};

const proxyVietmapTile = async (req, res) => {
  try {
    const z = parseInt(req.params.z, 10);
    const x = parseInt(req.params.x, 10);
    const y = parseInt(req.params.y, 10);
    const maxCoord = z >= 0 && z <= 22 ? Math.pow(2, z) - 1 : -1;
    if (
      [z, x, y].some((n) => Number.isNaN(n) || n < 0) ||
      z > 22 ||
      x > maxCoord ||
      y > maxCoord
    ) {
      return res.status(400).end();
    }

    const { statusCode, headers, body } = await routingService.fetchVietmapTile({ z, x, y });
    if (statusCode >= 400) {
      return res.status(statusCode).end();
    }
    res.setHeader('Content-Type', headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(body);
  } catch (err) {
    return res.status(502).end();
  }
};

module.exports = {
  calculateRoadRoute,
  autocompletePlaces,
  searchPlaces,
  getPlaceDetails,
  proxyVietmapTile
};
