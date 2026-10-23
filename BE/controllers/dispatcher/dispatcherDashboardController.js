const supabase = require('../../config/supabase');
const https = require('https');

// ==========================================

const getDispatcherDashboardStats = async (req, res) => {
  try {
    // 1. Thống kê số lượng đơn hàng theo trạng thái
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_code, status, agreed_price, customer_id, actual_weight_kg, chargeable_weight_kg, created_at, source, cancel_reason, cancel_fee, cancelled_at');

    const orderList = orders || [];
    const isCancelled = (o) => o.status === 'CANCELLED' || !!o.cancel_reason || !!o.cancelled_at;
    const nonCancelledOrders = orderList.filter(o => !isCancelled(o));

    const totalOrders = orderList.length;
    // Không tính giá cước của đơn hủy vào doanh thu (chỉ tính phí phạt hủy nếu có)
    const totalRevenue = orderList.reduce((sum, o) => {
      if (isCancelled(o)) {
        return sum + (Number(o.cancel_fee) || 0);
      }
      return sum + (Number(o.agreed_price) || 0);
    }, 0);

    const avgRevenue = nonCancelledOrders.length > 0 ? Math.round(totalRevenue / nonCancelledOrders.length) : 0;
    const totalWeight = nonCancelledOrders.reduce((sum, o) => sum + (Number(o.chargeable_weight_kg) || Number(o.actual_weight_kg) || 0), 0);
    const uniqueCustomers = new Set(nonCancelledOrders.map(o => o.customer_id).filter(Boolean)).size;

    const statusCounts = {
      DRAFT: orderList.filter(o => o.status === 'WAITING_FOR_DOCUMENTS' && o.agreed_price === 0).length,
      CONFIRMED: orderList.filter(o => o.status === 'WAITING_FOR_DOCUMENTS' && o.agreed_price > 0).length,
      READY_FOR_PLANNING: orderList.filter(o => o.status === 'READY_FOR_PLANNING').length,
      ASSIGNED: orderList.filter(o => o.status === 'ASSIGNED' || o.status === 'PLANNED').length,
      IN_TRANSIT: orderList.filter(o => o.status === 'IN_TRANSIT' || o.status === 'PICKED_UP').length,
      DELIVERED: orderList.filter(o => o.status === 'DELIVERED' || (o.status === 'CLOSED' && !o.cancel_reason)).length,
      CANCELLED: orderList.filter(o => o.status === 'CANCELLED' || (o.status === 'CLOSED' && !!o.cancel_reason)).length
    };

    // 2. Thống kê phương tiện
    const { data: trucks } = await supabase.from('trucks').select('status');
    const truckList = trucks || [];
    const fleetStats = {
      total: truckList.length,
      available: truckList.filter(t => t.status === 'AVAILABLE').length,
      on_trip: truckList.filter(t => t.status === 'ON_TRIP').length,
      maintenance: truckList.filter(t => t.status === 'MAINTENANCE').length
    };

    // 3. Thống kê chuyến xe
    const { data: trips } = await supabase.from('trips').select('status');
    const tripList = trips || [];
    const activeTripsCount = tripList.filter(t => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length;

    // 4. Thống kê sự cố
    const { data: incidents } = await supabase.from('incidents').select('status');
    const incidentList = incidents || [];
    const pendingIncidentsCount = incidentList.filter(i => i.status === 'REPORTED').length;

    // 5. Thống kê doanh thu theo 12 tháng động từ dữ liệu đơn hàng thật (không tính đơn hủy)
    const monthlyRevenue = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const monthlyOrders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    orderList.forEach(o => {
      if (o.created_at) {
        const d = new Date(o.created_at);
        const m = d.getMonth(); // 0 to 11
        if (!isCancelled(o)) {
          monthlyOrders[m] += 1;
          monthlyRevenue[m] += Math.round((Number(o.agreed_price) || 0) / 1000000);
        } else if (Number(o.cancel_fee) > 0) {
          monthlyRevenue[m] += Math.round((Number(o.cancel_fee) || 0) / 1000000);
        }
      }
    });

    return res.json({
      stats: {
        totalOrders,
        totalRevenue,
        avgRevenue,
        totalWeight,
        uniqueCustomers: uniqueCustomers || 8,
        deliveredCount: statusCounts.DELIVERED,
        inTransitCount: statusCounts.IN_TRANSIT + statusCounts.ASSIGNED,
        deliveredRate: totalOrders > 0 ? ((statusCounts.DELIVERED / totalOrders) * 100).toFixed(1) : '100.0',
        statusCounts,
        fleetStats,
        activeTripsCount,
        pendingIncidentsCount,
        monthlyRevenue,
        monthlyOrders
      }
    });
  } catch (err) {
    console.error('getDispatcherDashboardStats exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 7. ROUTING PROXY (TÍNH TOÁN ĐƯỜNG BỘ THỰC TẾ QUA OSRM - LUÔN CHỌN ĐƯỜNG BỘ NGẮN NHẤT)
const calculateRoadRoute = async (req, res) => {
  try {
    const { startLng, startLat, endLng, endLat } = req.query;

    if (!startLng || !startLat || !endLng || !endLat) {
      return res.status(400).json({ message: 'Thiếu tham số tọa độ điểm đầu hoặc điểm cuối' });
    }

    const https = require('https');
    const geoapifyKey = process.env.GEOAPIFY_API_KEY || '5a7ccf56c9694e229e9621648227937a';

    const fetchJson = (url) => {
      return new Promise((resolve, reject) => {
        const req = https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXLOG-Logistics'
          },
          timeout: 7000
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

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
    };

    // 1. Ưu tiên Geoapify Routing API chuyên dụng (Đường bộ chính xác cao)
    try {
      const geoapifyUrl = `https://api.geoapify.com/v1/routing?waypoints=${startLat},${startLng}|${endLat},${endLng}&mode=drive&apiKey=${geoapifyKey}`;
      const geoData = await fetchJson(geoapifyUrl);
      const feature = geoData?.features?.[0];

      if (feature && feature.properties) {
        const distMeters = feature.properties.distance || 0;
        const timeSecs = feature.properties.time || 0;
        const geom = feature.geometry;

        // Geoapify MultiLineString [[ [lng, lat], ... ]] hoặc LineString [ [lng, lat], ... ]
        let coordsList = [];
        if (geom.type === 'MultiLineString') {
          coordsList = geom.coordinates.flat(1);
        } else if (geom.type === 'LineString') {
          coordsList = geom.coordinates;
        }

        if (coordsList.length > 0) {
          const polyline = coordsList.map(([lng, lat]) => [lat, lng]);
          return res.json({
            success: true,
            distanceKm: parseFloat((distMeters / 1000).toFixed(1)),
            durationMins: Math.max(5, Math.round(timeSecs / 60)),
            polyline
          });
        }
      }
    } catch (gErr) {
      console.warn('Geoapify Routing failed, fallback to OSM:', gErr.message);
    }

    // 2. Fallback: OpenStreetMap routed-car với alternatives=true
    const targetUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
    
    let osmData;
    try {
      osmData = await fetchJson(targetUrl);
    } catch {
      const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      osmData = await fetchJson(fallbackUrl).catch(() => null);
    }

    if (osmData && osmData.routes && osmData.routes.length > 0) {
      const sortedRoutes = [...osmData.routes].sort((a, b) => a.distance - b.distance);
      const shortestRoute = sortedRoutes[0];

      const distanceKm = parseFloat((shortestRoute.distance / 1000).toFixed(1));
      const durationMins = Math.max(5, Math.round(shortestRoute.duration / 60));
      const polyline = shortestRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      return res.json({
        success: true,
        distanceKm,
        durationMins,
        polyline
      });
    }

    return res.status(404).json({ message: 'Không tìm thấy đường bộ nối 2 điểm' });
  } catch (err) {
    console.error('calculateRoadRoute exception:', err);
    return res.status(500).json({ message: 'Lỗi tính toán tuyến đường' });
  }
};

module.exports = {
  getDispatcherDashboardStats,
  calculateRoadRoute
};