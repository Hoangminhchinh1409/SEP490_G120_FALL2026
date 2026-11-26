const prisma = require("../../config/prisma");
const routingService = require("../routingService");

// Lưu các phiên mô phỏng GPS đang chạy theo tripId (số)
const activeSimulations = new Map();

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

const calcBearing = (lat1, lng1, lat2, lng2) => {
  const dLon = toRad(lng2 - lng1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
};

const interpolatePolyline = (rawPoints, targetCount = 45) => {
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) return [];
  const normalized = rawPoints
    .map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        return [Number(pt[0]), Number(pt[1])];
      }
      if (pt && typeof pt === "object") {
        return [Number(pt.lat ?? pt.latitude), Number(pt.lng ?? pt.longitude)];
      }
      return null;
    })
    .filter((pt) => pt && !Number.isNaN(pt[0]) && !Number.isNaN(pt[1]));

  if (normalized.length < 2) return [];
  if (normalized.length >= targetCount) {
    // Lấy mẫu đều ~targetCount điểm để mỗi bước đi rõ ràng trên map
    const step = (normalized.length - 1) / (targetCount - 1);
    return Array.from({ length: targetCount }, (_, i) => {
      const idx = Math.min(normalized.length - 1, Math.round(i * step));
      return normalized[idx];
    });
  }

  // Nội suy thêm điểm nếu polyline quá thưa
  const result = [];
  const segCount = normalized.length - 1;
  const perSeg = Math.max(2, Math.ceil(targetCount / segCount));
  for (let i = 0; i < segCount; i++) {
    const [lat1, lng1] = normalized[i];
    const [lat2, lng2] = normalized[i + 1];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      result.push([
        Number((lat1 + (lat2 - lat1) * t).toFixed(6)),
        Number((lng1 + (lng2 - lng1) * t).toFixed(6)),
      ]);
    }
  }
  result.push(normalized[normalized.length - 1]);
  return result;
};

const findTripWithRouteInfo = async (tripIdOrCode) => {
  const clean = String(tripIdOrCode || "").trim();
  const numeric = clean.replace(/^TRIP-/i, "");
  const where = /^\d+$/.test(numeric)
    ? { OR: [{ id: BigInt(Number(numeric)) }, { trip_code: clean }] }
    : { trip_code: clean };

  return prisma.trips.findFirst({
    where,
    include: {
      trip_trucks: {
        where: { released_time: null },
        include: { trucks: { select: { id: true, plate_number: true } } },
        take: 1,
      },
      trip_stops: {
        orderBy: { sequence: "asc" },
        include: {
          locations: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
        },
      },
    },
  });
};

const stopSimulation = (tripIdOrCode) => {
  const clean = String(tripIdOrCode || "").trim();
  for (const [key, sim] of activeSimulations.entries()) {
    if (String(key) === clean || sim.trip_code === clean) {
      if (sim.timer) clearInterval(sim.timer);
      activeSimulations.delete(key);
      return { stopped: true, trip_code: sim.trip_code, trip_id: key };
    }
  }
  return { stopped: false };
};

const startSimulation = async (
  tripIdOrCode,
  { speedMultiplier = 1, polyline = null } = {},
) => {
  const trip = await findTripWithRouteInfo(tripIdOrCode);
  if (!trip) {
    const err = new Error("Không tìm thấy chuyến xe để mô phỏng GPS.");
    err.statusCode = 404;
    throw err;
  }

  const tripId = Number(trip.id);
  const tripCode = trip.trip_code;
  const truckId = trip.trip_trucks?.[0]?.truck_id
    ? Number(trip.trip_trucks[0].truck_id)
    : null;
  const truckPlate = trip.trip_trucks?.[0]?.trucks?.plate_number || "";

  // Dừng phiên cũ của chuyến này nếu đang chạy
  stopSimulation(tripId);

  // 1. Lấy polyline đường bộ thực tế
  let rawPoints = Array.isArray(polyline) && polyline.length >= 2 ? polyline : null;

  if (!rawPoints) {
    const stopCoords = (trip.trip_stops || [])
      .map((s) => ({
        lat: Number(s.locations?.latitude),
        lng: Number(s.locations?.longitude),
      }))
      .filter((c) => !Number.isNaN(c.lat) && !Number.isNaN(c.lng) && c.lat !== 0);

    const startCoord = stopCoords[0] || { lat: 21.2187, lng: 105.8042 };
    const endCoord =
      stopCoords[stopCoords.length - 1] || { lat: 21.1215, lng: 105.9754 };

    try {
      const routeRes = await routingService.calculateRoadRoute([
        startCoord,
        endCoord,
      ]);
      if (Array.isArray(routeRes?.polyline) && routeRes.polyline.length >= 2) {
        rawPoints = routeRes.polyline;
      }
    } catch {
      // Fallback tuyến thẳng nội suy nếu routing API tạm gián đoạn
    }
    if (!rawPoints) {
      rawPoints = [
        [startCoord.lat, startCoord.lng],
        [endCoord.lat, endCoord.lng],
      ];
    }
  }

  const points = interpolatePolyline(rawPoints, 45);
  if (points.length < 2) {
    const err = new Error("Không đủ tọa độ tuyến đường để mô phỏng GPS.");
    err.statusCode = 400;
    throw err;
  }

  const mult = Math.max(1, Math.min(20, Number(speedMultiplier) || 1));
  const stepAdvance = mult >= 10 ? 5 : mult >= 5 ? 3 : 1;

  const simState = {
    trip_id: tripId,
    trip_code: tripCode,
    truck_id: truckId,
    truck_plate: truckPlate,
    points,
    currentIndex: 0,
    lat: points[0][0],
    lng: points[0][1],
    heading: calcBearing(points[0][0], points[0][1], points[1][0], points[1][1]),
    speed_kmh: 45,
    progress: 0,
    speed_multiplier: mult,
    running: true,
    updated_at: new Date().toISOString(),
    timer: null,
  };

  const persistTick = async () => {
    const idx = simState.currentIndex;
    const [lat, lng] = simState.points[idx];
    const nextPt = simState.points[Math.min(idx + 1, simState.points.length - 1)];
    const isFinished = idx >= simState.points.length - 1;

    simState.lat = lat;
    simState.lng = lng;
    if (!isFinished) {
      simState.heading = calcBearing(lat, lng, nextPt[0], nextPt[1]);
    }
    simState.progress = Math.round((idx / (simState.points.length - 1)) * 100);
    simState.speed_kmh = isFinished ? 0 : 42 + ((idx * 7) % 16);
    simState.updated_at = new Date().toISOString();

    const now = new Date();
    try {
      const dbOps = [
        prisma.trip_track_points.create({
          data: {
            trip_id: BigInt(tripId),
            latitude: lat,
            longitude: lng,
            recorded_time: now,
          },
        }),
      ];
      if (truckId) {
        dbOps.push(
          prisma.trucks.update({
            where: { id: BigInt(truckId) },
            data: {
              last_lat: lat,
              last_lng: lng,
              last_located_at: now,
              updated_at: now,
            },
          }),
        );
      }
      await Promise.all(dbOps);
    } catch (err) {
      console.warn("[GPS Simulator] DB persist warning:", err.message);
    }

    if (isFinished) {
      simState.running = false;
      if (simState.timer) {
        clearInterval(simState.timer);
        simState.timer = null;
      }
      return;
    }

    simState.currentIndex = Math.min(
      simState.points.length - 1,
      idx + stepAdvance,
    );
  };

  activeSimulations.set(tripId, simState);
  await persistTick();

  simState.timer = setInterval(() => {
    persistTick();
  }, 600);

  return {
    trip_id: tripId,
    trip_code: tripCode,
    truck_plate: truckPlate,
    total_points: points.length,
    speed_multiplier: mult,
    lat: simState.lat,
    lng: simState.lng,
    progress: simState.progress,
    speed_kmh: simState.speed_kmh,
    running: simState.running,
  };
};

const getSimulationStatus = () => {
  const list = [];
  for (const sim of activeSimulations.values()) {
    list.push({
      trip_id: sim.trip_id,
      trip_code: sim.trip_code,
      truck_plate: sim.truck_plate,
      lat: sim.lat,
      lng: sim.lng,
      heading: sim.heading,
      speed_kmh: sim.speed_kmh,
      progress: sim.progress,
      speed_multiplier: sim.speed_multiplier,
      running: sim.running,
      updated_at: sim.updated_at,
    });
  }
  return list;
};

module.exports = {
  startSimulation,
  stopSimulation,
  getSimulationStatus,
};
