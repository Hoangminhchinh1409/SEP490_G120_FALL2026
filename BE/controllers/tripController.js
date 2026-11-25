const prisma = require('../config/prisma');
const tripService = require('../services/tripService');
const vrptwService = require('../services/vrptwService');
const routingController = require('./routingController');
const { serializePrisma } = require('../utils/prismaHelper');

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
    const userId = req.user?.id || 1;
    const result = await tripService.createTrip(req.body, userId);
    return res.status(201).json({
      message: 'Lập chuyến và phân bổ xe thành công!',
      trip: result
    });
  } catch (err) {
    console.error('createTrip error:', err);
    const status = err.statusCode || 500;
    if (status >= 500) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    return res.status(status).json({ message: err.message || 'Lỗi lập chuyến và phân bổ xe' });
  }
};

// 3. Cập nhật trạng thái chuyến xe
const updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id || 1;
    const updated = await tripService.updateTripStatus(id, status, userId);
    return res.json({ message: 'Cập nhật trạng thái chuyến thành công', trip: updated });
  } catch (err) {
    console.error('updateTripStatus error:', err);
    const status = err.statusCode || 500;
    if (status >= 500) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    return res.status(status).json({ message: err.message || 'Lỗi cập nhật trạng thái chuyến' });
  }
};

// 4. Tính toán lộ trình đường bộ thực tế ngắn nhất & thời gian di chuyển (VietMap Routing v4 qua routingService)
const calculateRoadRoute = (req, res) => routingController.calculateRoadRoute(req, res);

// 5. Xem lại chuyến đi GPS & Timeline
const getTripReplay = async (req, res) => {
  try {
    const rawId = req.params.id;
    const numericId = String(rawId).replace(/^TRIP-/i, '');

    const tripRow = await prisma.trips.findFirst({
      where: /^\d+$/.test(numericId) ? { id: BigInt(Number(numericId)) } : { trip_code: rawId },
      select: {
        id: true,
        trip_code: true,
        planned_start: true,
        planned_distance: true,
        planned_duration: true,
        actual_distance: true,
        actual_duration: true,
        status: true,
        created_at: true
      }
    });

    if (!tripRow) {
      return res.status(404).json({ message: 'Không tìm thấy chuyến vận chuyển.' });
    }

    const trip = serializePrisma(tripRow);
    const bigTripId = tripRow.id;

    const [stopsRaw, pointsRaw, eventsRaw] = await Promise.all([
      prisma.trip_stops.findMany({
        where: { trip_id: bigTripId },
        select: {
          id: true,
          sequence: true,
          stop_type: true,
          location_id: true,
          planned_arrival: true,
          actual_arrival: true,
          distance_from_previous_stop: true,
          status: true,
          locations: { select: { id: true, name: true, address: true, latitude: true, longitude: true } }
        },
        orderBy: { sequence: 'asc' }
      }),
      prisma.trip_track_points.findMany({
        where: { trip_id: bigTripId },
        orderBy: { recorded_time: 'asc' }
      }),
      prisma.trip_events.findMany({
        where: { trip_id: bigTripId },
        select: {
          id: true,
          event_type: true,
          phone_time: true,
          received_time: true,
          latitude: true,
          longitude: true,
          payload: true
        },
        orderBy: { id: 'asc' }
      })
    ]);

    const stops = serializePrisma(stopsRaw || []).map((s) => ({
      ...s,
      location: s.locations || null
    }));
    const points = serializePrisma(pointsRaw || []);
    const events = serializePrisma(eventsRaw || []);

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
          recorded_time: new Date(baseTime + idx * 5 * 60000).toISOString(),
          is_simulated: true
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

const getLeaveReassignments = async (req, res) => {
  try {
    const refresh = req.query?.refresh === '1' || req.query?.refresh === 'true';
    const result = await tripService.getLeaveReassignments({ refresh });
    return res.json(result);
  } catch (err) {
    console.error('getLeaveReassignments error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách chuyến xe cần đổi tài xế', error: err.message });
  }
};

const reassignTripDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_driver_id, reason } = req.body || {};
    const dispatcherUserId = req.user?.id || null;
    const result = await tripService.reassignTripDriver(id, {
      newDriverId: new_driver_id,
      dispatcherUserId,
      reason
    });
    return res.json({
      success: true,
      message: `Đã đổi tài xế chuyến ${result.trip_code} sang ${result.new_driver_name} thành công!`,
      reassignment: result
    });
  } catch (err) {
    console.error('reassignTripDriver error:', err);
    return res.status(err.statusCode || 400).json({ message: err.message || 'Lỗi khi điều phối lại tài xế' });
  }
};

// 6. ENGINE VRPTW: Tối ưu hóa thứ tự đa điểm dừng kết hợp giờ cấm tải Hà Nội & Time Windows
const optimizeMultiStopRoute = async (req, res) => {
  try {
    const { stops = [], startTime = '07:30', truckPayloadKg = 2500, avoidTruckBan = true } = req.body;
    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Cần ít nhất 2 điểm dừng (Điểm lấy hàng và Điểm giao hàng) để tối ưu lộ trình VRPTW'
      });
    }

    const optimizationResult = vrptwService.solveVRPTW({
      stops,
      startTime,
      truckPayloadKg: Number(truckPayloadKg) || 2500,
      avoidTruckBan: avoidTruckBan !== false
    });

    return res.json({
      success: true,
      ...optimizationResult,
      data: optimizationResult
    });
  } catch (err) {
    console.error('optimizeMultiStopRoute error:', err);
    return res.status(500).json({ message: 'Lỗi khi giải bài toán tối ưu VRPTW', error: err.message });
  }
};

const getPublicTrip = async (req, res) => {
  try {
    const { code } = req.params;
    const trip = await tripService.getPublicTripByCode(code);
    if (!trip) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin chuyến xe' });
    }
    return res.json({ trip });
  } catch (err) {
    console.error('getPublicTrip error:', err);
    return res.status(500).json({ message: 'Lỗi tải thông tin chuyến xe công khai', error: err.message });
  }
};

module.exports = {
  getAllTrips,
  createTrip,
  updateTripStatus,
  calculateRoadRoute,
  getTripReplay,
  getLeaveReassignments,
  reassignTripDriver,
  optimizeMultiStopRoute,
  getPublicTrip
};
