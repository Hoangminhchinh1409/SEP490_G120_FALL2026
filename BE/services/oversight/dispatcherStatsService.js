const prisma = require('../../config/prisma');
const { serializePrisma } = require('../../utils/prismaHelper');
const { parsePeriodRange } = require('./managerKpiService');

/**
 * 2. Lấy dữ liệu Hiệu suất Tài xế (Screen 41: Driver Performance)
 */
async function getDriverPerformance(periodStr) {
  const dateRange = parsePeriodRange(periodStr);

  const [driversRaw, incidentsRaw, eventsRaw, tripDriversRaw, claimsRaw] = await Promise.all([
    prisma.driver_profiles.findMany({
      select: {
        id: true,
        license_number: true,
        license_class: true,
        status: true,
        users: { select: { id: true, username: true, full_name: true, phone: true } }
      }
    }),
    prisma.incidents.findMany({
      where: dateRange
        ? { created_at: { gte: new Date(dateRange.start), lt: new Date(dateRange.end) } }
        : {},
      select: { id: true, trip_id: true, reported_by: true, fault: true, type: true, created_at: true }
    }),
    prisma.trip_events.findMany({
      where: dateRange
        ? { phone_time: { gte: new Date(dateRange.start), lt: new Date(dateRange.end) } }
        : {},
      select: { id: true, trip_id: true, trip_stop_id: true, driver_id: true, event_type: true, outside_radius_flag: true, phone_time: true }
    }),
    prisma.trip_drivers.findMany({
      select: {
        driver_id: true,
        trips: {
          select: {
            id: true,
            trip_code: true,
            status: true,
            actual_distance: true,
            actual_duration: true,
            planned_distance: true,
            planned_duration: true,
            planned_start: true,
            created_at: true,
            updated_at: true,
            trip_stops: {
              select: {
                id: true,
                order_id: true,
                sequence: true,
                stop_type: true,
                planned_arrival: true,
                actual_arrival: true,
                locations: { select: { name: true } }
              },
              orderBy: { sequence: 'asc' }
            }
          }
        }
      }
    }),
    prisma.compensation_claims.findMany({
      where: dateRange
        ? { created_time: { gte: new Date(dateRange.start), lt: new Date(dateRange.end) } }
        : {},
      select: { id: true, order_id: true, incident_id: true }
    })
  ]);

  const drivers = serializePrisma(driversRaw || []).map((d) => ({
    ...d,
    user: d.users || null
  }));
  const incidents = serializePrisma(incidentsRaw || []);
  const events = serializePrisma(eventsRaw || []);
  const claims = serializePrisma(claimsRaw || []);
  const tripDrivers = serializePrisma(tripDriversRaw || []).map((td) => ({
    ...td,
    trip: td.trips || null
  }));

  const ON_TIME_TOLERANCE_MS = 30 * 60 * 1000;

  const performanceList = (drivers || []).map((d) => {
    const driverName = d.user?.full_name || d.user?.username || `Tài xế #${d.id}`;
    const driverPhone = d.user?.phone || 'Chưa cập nhật';

    const driverTrips = (tripDrivers || []).filter((td) => {
      if (Number(td.driver_id) !== Number(d.id) || !td.trip) return false;
      if (dateRange && td.trip.created_at) {
        const tripIso = new Date(td.trip.created_at).toISOString();
        if (tripIso < dateRange.start || tripIso >= dateRange.end) return false;
      }
      return true;
    });

    const completedTripsList = driverTrips.filter(
      (td) => String(td.trip?.status || '').trim().toUpperCase() === 'COMPLETED'
    );
    const completedTrips = completedTripsList.length;

    // Tính tỷ lệ đúng giờ trên các điểm giao (đến trước planned_arrival + 30 phút)
    let totalDeliveryStops = 0;
    let onTimeDeliveryStops = 0;
    const driverTripIds = new Set();
    const driverOrderIds = new Set();

    driverTrips.forEach((td) => {
      if (td.trip?.id) driverTripIds.add(Number(td.trip.id));
      const stops = td.trip?.trip_stops || [];
      stops.forEach((st) => {
        if (st.order_id) driverOrderIds.add(Number(st.order_id));
        const stType = String(st.stop_type || '').trim().toUpperCase();
        if (['DELIVERY', 'DROP-OFF', 'DROPOFF'].includes(stType) && st.planned_arrival && st.actual_arrival) {
          totalDeliveryStops += 1;
          const actualMs = new Date(st.actual_arrival).getTime();
          const deadlineMs = new Date(st.planned_arrival).getTime() + ON_TIME_TOLERANCE_MS;
          if (actualMs <= deadlineMs) {
            onTimeDeliveryStops += 1;
          }
        }
      });
    });

    const onTimeRate = totalDeliveryStops > 0
      ? Number(((onTimeDeliveryStops / totalDeliveryStops) * 100).toFixed(1))
      : null;

    const totalDurationMins = completedTripsList.reduce((acc, cur) => {
      return acc + Number(cur.trip?.actual_duration || cur.trip?.planned_duration || 0);
    }, 0);
    const gpsDrivingHours = totalDurationMins > 0 ? `${Math.round(totalDurationMins / 60)}h` : '0h';

    const driverEvents = (events || []).filter((e) => Number(e.driver_id) === Number(d.id));
    const limitDrivingCount = driverEvents.filter((e) => e.event_type === '4H_LIMIT').length;
    const speedingCount = driverEvents.filter((e) => e.event_type === 'SPEEDING').length;
    const outsideRadiusCount = driverEvents.filter((e) => Boolean(e.outside_radius_flag)).length;

    // Tính thời gian ở điểm trung bình (ARRIVED -> DEPARTED)
    const stopTimes = new Map();
    driverEvents.forEach((ev) => {
      if (!ev.trip_stop_id) return;
      const key = Number(ev.trip_stop_id);
      if (!stopTimes.has(key)) stopTimes.set(key, {});
      const entry = stopTimes.get(key);
      if (ev.event_type === 'ARRIVED' && !entry.arrived) entry.arrived = new Date(ev.phone_time).getTime();
      if (ev.event_type === 'DEPARTED') entry.departed = new Date(ev.phone_time).getTime();
    });
    const dwellDurations = [];
    stopTimes.forEach((v) => {
      if (v.arrived && v.departed && v.departed >= v.arrived) {
        dwellDurations.push((v.departed - v.arrived) / 60000);
      }
    });
    const avgDwellTime = dwellDurations.length > 0
      ? `${Math.round(dwellDurations.reduce((a, b) => a + b, 0) / dwellDurations.length)}'`
      : "0'";

    const driverIncidents = (incidents || []).filter(
      (i) => Number(i.reported_by) === Number(d.id) || (i.trip_id && driverTripIds.has(Number(i.trip_id)))
    );
    const driverIncidentIds = new Set(driverIncidents.map((i) => Number(i.id)));
    const complaintsCount = (claims || []).filter(
      (c) => (c.incident_id && driverIncidentIds.has(Number(c.incident_id))) || (c.order_id && driverOrderIds.has(Number(c.order_id)))
    ).length;
    const incidentClaimText = `${driverIncidents.length} · ${complaintsCount}`;

    const trips = driverTrips.map((td) => {
      const stops = td.trip?.trip_stops || [];
      const firstLoc = stops[0]?.locations?.name;
      const lastLoc = stops[stops.length - 1]?.locations?.name;
      const route = firstLoc && lastLoc && firstLoc !== lastLoc
        ? `${firstLoc} → ${lastLoc}`
        : (firstLoc || lastLoc || 'Chưa cập nhật');
      return {
        code: td.trip?.trip_code || `TRP-${td.trip?.id}`,
        route,
        time: td.trip?.planned_start ? new Date(td.trip.planned_start).toLocaleString('vi-VN') : 'Đang xử lý',
        status: td.trip?.status || 'Assigned',
        distance: td.trip?.actual_distance
          ? `${td.trip.actual_distance} km`
          : (td.trip?.planned_distance ? `${td.trip.planned_distance} km (dự kiến)` : 'Chưa cập nhật')
      };
    });

    return {
      id: d.id,
      user_id: d.user?.id,
      name: driverName,
      phone: driverPhone,
      license_number: d.license_number || 'N/A',
      license_class: d.license_class || 'C',
      completed_trips: completedTrips,
      on_time_rate: onTimeRate,
      gps_driving_hours: gpsDrivingHours,
      limit_driving_count: limitDrivingCount,
      speeding_count: speedingCount,
      outside_radius_count: outsideRadiusCount,
      avg_dwell_time: avgDwellTime,
      incident_claim_text: incidentClaimText,
      trips,
      status: d.status || 'Active'
    };
  });

  performanceList.sort((a, b) => {
    if (b.completed_trips !== a.completed_trips) {
      return b.completed_trips - a.completed_trips;
    }
    return (b.on_time_rate ?? -1) - (a.on_time_rate ?? -1);
  });

  return {
    drivers: performanceList,
    summary: {
      total_drivers: performanceList.length,
      total_completed_trips: performanceList.reduce((acc, cur) => acc + cur.completed_trips, 0)
    }
  };
}

module.exports = {
  getDriverPerformance
};
