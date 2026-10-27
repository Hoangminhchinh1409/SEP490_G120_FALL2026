const supabase = require('../config/supabase');
const { parseOrderMeta } = require('../services/orderHelperService');

/**
 * Oversight Controller — Nhóm chức năng Giám sát Vận hành, Khối lượng Đơn & Báo cáo Hiệu suất
 * (UC-21, UC-22, UC-27, UC-43 — Screen 16, 18, 41 & Dispatcher Dashboard)
 */

function parsePeriodRange(periodStr) {
  if (!periodStr || periodStr === 'ALL') return null;

  if (/^\d{4}-\d{2}$/.test(periodStr)) {
    const [y, m] = periodStr.split('-').map(Number);
    return {
      start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString(),
      end: new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString()
    };
  }

  const monthMatch = periodStr.match(/(\d{1,2})[\/\-](\d{4})/);
  if (monthMatch) {
    const m = Number(monthMatch[1]);
    const y = Number(monthMatch[2]);
    if (m >= 1 && m <= 12 && y >= 2000) {
      return {
        start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString(),
        end: new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString()
      };
    }
  }

  const qMatch = periodStr.match(/Quý\s*(\d)[\/\-](\d{4})/i);
  if (qMatch) {
    const q = Number(qMatch[1]);
    const y = Number(qMatch[2]);
    const startMonth = (q - 1) * 3;
    return {
      start: new Date(Date.UTC(y, startMonth, 1, 0, 0, 0)).toISOString(),
      end: new Date(Date.UTC(y, startMonth + 3, 1, 0, 0, 0)).toISOString()
    };
  }

  const yMatch = periodStr.match(/(?:Năm\s*)?(\d{4})/i);
  if (yMatch) {
    const y = Number(yMatch[1]);
    return {
      start: new Date(Date.UTC(y, 0, 1, 0, 0, 0)).toISOString(),
      end: new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0)).toISOString()
    };
  }

  return null;
}

// ==========================================
// A. DISPATCHER DASHBOARD STATS
// ==========================================

const getDispatcherDashboardStats = async (req, res) => {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        order_code,
        status,
        agreed_price,
        customer_id,
        created_at,
        cargos:order_cargos(*),
        order_notes(content)
      `);

    const orderList = (orders || []).map((o) => {
      const meta = parseOrderMeta(o);
      const cargos = Array.isArray(o.cargos) ? o.cargos : [];
      const weight = cargos.reduce((s, c) => s + (Number(c.chargeable_weight) || Number(c.weight_kg) || Number(c.actual_weight_kg) || 0), 0);
      return {
        ...o,
        cancel_reason: meta.cancel_reason || null,
        cancel_fee: Number(meta.cancel_fee || 0),
        cancelled_at: meta.cancelled_at || null,
        weight
      };
    });

    const isCancelled = (o) => o.status === 'CANCELLED' || !!o.cancel_reason || !!o.cancelled_at;
    const nonCancelledOrders = orderList.filter((o) => !isCancelled(o));

    const totalOrders = orderList.length;
    const totalRevenue = orderList.reduce((sum, o) => {
      if (isCancelled(o)) {
        return sum + (Number(o.cancel_fee) || 0);
      }
      return sum + (Number(o.agreed_price) || 0);
    }, 0);

    const avgRevenue = nonCancelledOrders.length > 0 ? Math.round(totalRevenue / nonCancelledOrders.length) : 0;
    const totalWeight = nonCancelledOrders.reduce((sum, o) => sum + (Number(o.weight) || 0), 0);
    const uniqueCustomers = new Set(nonCancelledOrders.map((o) => o.customer_id).filter(Boolean)).size;

    const statusCounts = {
      DRAFT: orderList.filter((o) => (o.status === 'DRAFT' || o.status === 'WAITING_FOR_DOCUMENTS') && Number(o.agreed_price || 0) === 0).length,
      CONFIRMED: orderList.filter((o) => (o.status === 'CONFIRMED' || o.status === 'WAITING_FOR_DOCUMENTS') && Number(o.agreed_price || 0) > 0).length,
      READY_FOR_PLANNING: orderList.filter((o) => o.status === 'READY_FOR_PLANNING').length,
      ASSIGNED: orderList.filter((o) => o.status === 'ASSIGNED' || o.status === 'PLANNED').length,
      IN_TRANSIT: orderList.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'PICKED_UP').length,
      DELIVERED: orderList.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED' || (o.status === 'CLOSED' && !o.cancel_reason)).length,
      CANCELLED: orderList.filter((o) => isCancelled(o)).length
    };

    const { data: trucks } = await supabase.from('trucks').select('status');
    const truckList = trucks || [];
    const fleetStats = {
      total: truckList.length,
      available: truckList.filter((t) => t.status === 'AVAILABLE').length,
      on_trip: truckList.filter((t) => t.status === 'ON_TRIP').length,
      maintenance: truckList.filter((t) => t.status === 'MAINTENANCE').length
    };

    const { data: trips } = await supabase.from('trips').select('status');
    const tripList = trips || [];
    const activeTripsCount = tripList.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length;

    const { data: incidents } = await supabase.from('incidents').select('status');
    const incidentList = incidents || [];
    const pendingIncidentsCount = incidentList.filter((i) => i.status === 'REPORTED' || i.status === 'Reported').length;

    const monthlyRevenue = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const monthlyOrders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    orderList.forEach((o) => {
      if (o.created_at) {
        const d = new Date(o.created_at);
        const m = d.getMonth();
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

// ==========================================
// B. MANAGER PERFORMANCE DASHBOARD & DRIVER PERFORMANCE (UC-27, UC-43)
// ==========================================

const getDashboardStats = async (req, res) => {
  try {
    const period = req.query.period || 'Tháng 10/2026';
    const dateRange = parsePeriodRange(period);

    let ordersQuery = supabase
      .from('orders')
      .select('id, order_code, agreed_price, late_risk, waiting_too_long, status, document_status, created_at, updated_at, ready_for_planning_at');

    if (dateRange) {
      ordersQuery = ordersQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end);
    }

    const { data: orders, error: ordersErr } = await ordersQuery;
    if (ordersErr) throw ordersErr;

    const totalOrders = orders?.length || 0;
    const totalRevenue = (orders || []).reduce((acc, cur) => acc + Number(cur.agreed_price || 0), 0);

    let revenueFormatted = `${totalRevenue.toLocaleString('vi-VN')} đ`;
    if (totalRevenue >= 1000000000) {
      revenueFormatted = `${(totalRevenue / 1000000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}B`;
    } else if (totalRevenue >= 1000000) {
      revenueFormatted = `${(totalRevenue / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
    }

    const completedOrdersList = (orders || []).filter((o) =>
      ['COMPLETED', 'Completed', 'Delivered', 'DELIVERED'].includes(o.status)
    );
    const completedOrders = completedOrdersList.length;

    let orderCycleTime = 'Chưa có đơn hoàn thành';
    if (completedOrdersList.length > 0) {
      const totalDurationMs = completedOrdersList.reduce((acc, cur) => {
        const end = new Date(cur.updated_at).getTime();
        const start = new Date(cur.created_at).getTime();
        return acc + Math.max(0, end - start);
      }, 0);
      const avgHours = totalDurationMs / completedOrdersList.length / (1000 * 60 * 60);
      if (avgHours >= 24) {
        orderCycleTime = `${(avgHours / 24).toFixed(1).replace('.', ',')} ngày`;
      } else {
        orderCycleTime = `${avgHours.toFixed(1).replace('.', ',')} giờ`;
      }
    }

    let perfectOrdersRate = '0';
    if (totalOrders > 0) {
      const perfectCount = (orders || []).filter((o) =>
        ['COMPLETED', 'Completed', 'Delivered', 'DELIVERED'].includes(o.status) &&
        ['APPROVED', 'Approved'].includes(o.document_status) &&
        !o.late_risk
      ).length;
      perfectOrdersRate = ((perfectCount / totalOrders) * 100).toFixed(0);
    }

    const { data: trucks, error: trucksErr } = await supabase
      .from('trucks')
      .select('id, status, allowed_payload');

    if (trucksErr) throw trucksErr;
    const totalTrucks = trucks?.length || 0;

    let tripsQuery = supabase
      .from('trips')
      .select('id, trip_code, status, actual_distance, actual_duration, planned_distance, planned_duration, created_at, updated_at');

    if (dateRange) {
      tripsQuery = tripsQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end);
    }

    const { data: trips } = await tripsQuery;
    const tripList = trips || [];
    const tripIds = tripList.map((t) => t.id);

    let truckUtilization = '0';
    if (totalTrucks > 0 && tripList.length > 0) {
      const activeTripTrucks = tripList.filter((t) =>
        ['IN_PROGRESS', 'RUNNING', 'In Progress', 'COMPLETED', 'Completed'].includes(t.status)
      ).length;
      truckUtilization = String(Math.min(100, Math.round((activeTripTrucks / totalTrucks) * 100)));
    }

    let tripDrivers = [];
    let tripStops = [];
    if (tripIds.length > 0) {
      const { data: tdData } = await supabase
        .from('trip_drivers')
        .select('trip_id, driver_id, assigned_time')
        .in('trip_id', tripIds);
      tripDrivers = tdData || [];

      const { data: tsData } = await supabase
        .from('trip_stops')
        .select('id, trip_id, order_id, stop_type, location_id, planned_arrival, actual_arrival, loaded_weight, delivered_weight, status')
        .in('trip_id', tripIds);
      tripStops = tsData || [];
    }

    let avgSlaDispatch = '0 phút';
    if (tripDrivers.length > 0 && totalOrders > 0) {
      const assignedDiffs = [];
      tripDrivers.forEach((td) => {
        if (td.assigned_time) {
          const relStop = tripStops.find((ts) => ts.trip_id === td.trip_id);
          const matchOrder = relStop ? (orders || []).find((o) => o.id === relStop.order_id) : orders[0];
          if (matchOrder && matchOrder.created_at) {
            const diffMin = Math.max(0, Math.round((new Date(td.assigned_time) - new Date(matchOrder.created_at)) / 60000));
            assignedDiffs.push(diffMin);
          }
        }
      });
      if (assignedDiffs.length > 0) {
        const avgMin = Math.round(assignedDiffs.reduce((a, b) => a + b, 0) / assignedDiffs.length);
        avgSlaDispatch = `${avgMin} phút`;
      }
    }

    let vehicleFillRate = '0';
    if (tripStops.length > 0 && trucks && trucks.length > 0) {
      const validLoads = tripStops.filter((ts) => Number(ts.loaded_weight) > 0);
      const avgPayload = trucks.reduce((acc, t) => acc + Number(t.allowed_payload || 5000), 0) / trucks.length;
      if (validLoads.length > 0 && avgPayload > 0) {
        const avgLoaded = validLoads.reduce((acc, ts) => acc + Number(ts.loaded_weight), 0) / validLoads.length;
        vehicleFillRate = String(Math.min(100, Math.round((avgLoaded / avgPayload) * 100)));
      }
    }

    const totalDistance = tripList.reduce((acc, cur) => acc + Number(cur.actual_distance || cur.planned_distance || 0), 0);
    const emptyRunningRate = '0';
    let revenuePerKm = '0 đ';
    if (totalDistance > 0 && totalRevenue > 0) {
      revenuePerKm = `${Math.round(totalRevenue / totalDistance).toLocaleString('vi-VN')} đ`;
    }

    let incidentsQuery = supabase
      .from('incidents')
      .select('id, type, fault, status, description, created_at');

    if (dateRange) {
      incidentsQuery = incidentsQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end);
    }

    const { data: incidents, error: incidentsErr } = await incidentsQuery;
    if (incidentsErr) throw incidentsErr;

    const incidentTypeCountMap = {};
    (incidents || []).forEach((inc) => {
      const t = inc.type || 'Sự cố khác';
      incidentTypeCountMap[t] = (incidentTypeCountMap[t] || 0) + 1;
    });

    const incidentData = Object.entries(incidentTypeCountMap).map(([type, count]) => {
      const isError = type.toLowerCase().includes('vehicle') || type.toLowerCase().includes('hỏng');
      const isAmber = type.toLowerCase().includes('cargo') || type.toLowerCase().includes('hàng');
      const isOrange = type.toLowerCase().includes('traffic') || type.toLowerCase().includes('tai nạn');
      const label = type === 'Vehicle Issue' ? 'Hỏng xe' : type === 'Traffic' ? 'Cấm đường / Ùn tắc' : type;
      return {
        type: label,
        rawType: type,
        count,
        icon: isError ? 'build' : isAmber ? 'inventory_2' : isOrange ? 'car_crash' : 'report_problem',
        color: isError ? 'error' : isAmber ? 'amber' : isOrange ? 'orange' : 'neutral'
      };
    });

    const incidentSummaryText = incidentData.length > 0
      ? incidentData.map((item) => `${item.type}: ${item.count}`).join(' · ')
      : 'Chưa ghi nhận sự cố';

    const { data: locations } = await supabase
      .from('locations')
      .select('id, name, type, address');

    const dwellLocations = (totalOrders > 0 && locations && locations.length > 0)
      ? (locations || []).slice(0, 4).map((loc) => ({
          name: loc.name,
          time: "0'",
          isHigh: false
        }))
      : [];

    const dwellSummaryText = dwellLocations.length > 0
      ? dwellLocations.map((loc) => `${loc.name} ${loc.time}`).join(' · ')
      : 'Chưa có dữ liệu điểm dừng';

    const delayReasons = [];
    const delayedOrders = (orders || []).filter((o) => o.late_risk || o.waiting_too_long);
    if (delayedOrders.length > 0) {
      delayReasons.push({
        reason: 'Chờ điều phối lâu',
        count: delayedOrders.length,
        icon: 'schedule',
        color: 'orange'
      });
    }
    if (incidents && incidents.length > 0) {
      delayReasons.push({
        reason: 'Phát sinh sự cố vận tải',
        count: incidents.length,
        icon: 'report_problem',
        color: 'error'
      });
    }
    if (delayReasons.length === 0) {
      delayReasons.push({
        reason: 'Đúng kế hoạch',
        count: 0,
        icon: 'check_circle',
        color: 'neutral'
      });
    }

    const delaySummaryText = delayReasons.length > 0
      ? delayReasons.map((d) => `${d.reason}: ${d.count}`).join(' · ')
      : 'Chưa có chuyến trễ';

    return res.json({
      stats: {
        period,
        revenue: totalRevenue,
        revenueFormatted,
        truckUtilization,
        avgSlaDispatch,
        completedOrders,
        totalOrders,
        incidentData,
        incidentSummaryText,
        vehicleFillRate,
        emptyRunningRate,
        revenuePerKm,
        orderCycleTime,
        perfectOrdersRate,
        dwellLocations,
        dwellSummaryText,
        delayReasons,
        delaySummaryText
      }
    });
  } catch (error) {
    console.error('getDashboardStats Error:', error);
    return res.status(500).json({ message: 'Lỗi tải số liệu Dashboard', error: error.message });
  }
};

const getDriverPerformance = async (req, res) => {
  try {
    const period = req.query.period;
    const dateRange = parsePeriodRange(period);

    const { data: drivers, error: driversErr } = await supabase
      .from('driver_profiles')
      .select(`
        id,
        license_number,
        license_class,
        status,
        user:users!driver_profiles_user_account_id_fkey(id, username, full_name, phone)
      `);

    if (driversErr) throw driversErr;

    let incidentsQuery = supabase.from('incidents').select('id, reported_by, fault, type, created_at');
    if (dateRange) {
      incidentsQuery = incidentsQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end);
    }
    const { data: incidents } = await incidentsQuery;

    let eventsQuery = supabase.from('trip_events').select('id, driver_id, outside_radius_flag, event_type, occurred_at');
    if (dateRange) {
      eventsQuery = eventsQuery.gte('occurred_at', dateRange.start).lt('occurred_at', dateRange.end);
    }
    const { data: events } = await eventsQuery;

    const { data: tripDrivers } = await supabase
      .from('trip_drivers')
      .select(`
        driver_id,
        trip:trips(id, trip_code, status, actual_distance, actual_duration, planned_distance, planned_duration, planned_start, created_at, updated_at)
      `);

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

      const completedTrips = driverTrips.length;

      const totalDurationMins = driverTrips.reduce((acc, cur) => {
        return acc + Number(cur.trip?.actual_duration || cur.trip?.planned_duration || 0);
      }, 0);
      const gpsDrivingHours = totalDurationMins > 0 ? `${Math.round(totalDurationMins / 60)}h` : '0h';

      const driverEvents = (events || []).filter((e) => Number(e.driver_id) === Number(d.id));
      const limitDrivingCount = driverEvents.filter((e) => e.event_type === '4H_LIMIT').length;
      const speedingCount = driverEvents.filter((e) => e.event_type === 'SPEEDING').length;
      const outsideRadiusCount = driverEvents.filter((e) => e.outside_radius_flag === true).length;

      const driverIncidents = (incidents || []).filter((i) => Number(i.reported_by) === Number(d.id)).length;
      const complaintsCount = 0;
      const incidentClaimText = `${driverIncidents} · ${complaintsCount}`;

      const trips = driverTrips.map((td) => ({
        code: td.trip?.trip_code || `TRP-${td.trip?.id}`,
        route: 'Vận chuyển hàng hóa ALS',
        time: td.trip?.planned_start ? new Date(td.trip.planned_start).toLocaleString('vi-VN') : 'Đang xử lý',
        status: td.trip?.status || 'Assigned',
        distance: td.trip?.actual_distance ? `${td.trip.actual_distance} km` : 'Chưa cập nhật'
      }));

      return {
        id: d.id,
        user_id: d.user?.id,
        name: driverName,
        phone: driverPhone,
        license_number: d.license_number || 'N/A',
        license_class: d.license_class || 'C',
        completed_trips: completedTrips,
        gps_driving_hours: gpsDrivingHours,
        limit_driving_count: limitDrivingCount,
        speeding_count: speedingCount,
        outside_radius_count: outsideRadiusCount,
        avg_dwell_time: "0'",
        incident_claim_text: incidentClaimText,
        trips,
        status: d.status || 'Active'
      };
    });

    return res.json({
      drivers: performanceList,
      summary: {
        total_drivers: performanceList.length,
        total_completed_trips: performanceList.reduce((acc, cur) => acc + cur.completed_trips, 0)
      }
    });
  } catch (error) {
    console.error('getDriverPerformance Error:', error);
    return res.status(500).json({ message: 'Lỗi tải báo cáo hiệu suất tài xế', error: error.message });
  }
};

// ==========================================
// C. ORDER WORKLOAD & REASSIGN (UC-21, UC-22)
// ==========================================

const getOrderWorkload = async (req, res) => {
  try {
    const { data: dispatchersData, error: dispErr } = await supabase
      .from('users')
      .select('id, username, full_name, email, phone, role_id, status')
      .or('role_id.eq.3,username.ilike.%disp%')
      .order('id', { ascending: true });

    if (dispErr) throw dispErr;

    const { data: ordersData, error: ordersErr } = await supabase
      .from('orders')
      .select(`
        id, 
        order_code, 
        order_type,
        status, 
        document_status,
        responsible_dispatcher_id, 
        agreed_price, 
        receiver_name,
        receiver_phone,
        tracking_token,
        vendor_id,
        waiting_too_long,
        late_risk,
        created_at, 
        updated_at,
        dispatcher:users!orders_responsible_dispatcher_id_fkey(id, username, full_name)
      `)
      .order('id', { ascending: false });

    if (ordersErr) throw ordersErr;

    const now = new Date();
    const activeNormalized = ['READY_FOR_PLANNING', 'PLANNED', 'ASSIGNED', 'IN_TRANSIT', 'CONFIRMED', 'DRAFT'];

    const formattedOrders = (ordersData || []).map((o) => {
      const createdAt = new Date(o.created_at);
      const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
      const statusUpper = (o.status || '').toUpperCase();

      let waitingTooLong = Boolean(o.waiting_too_long);
      let overdueDocs = false;
      let lateRisk = Boolean(o.late_risk);
      let flagReason = null;

      if (statusUpper === 'DRAFT' && ageHours > 4) {
        waitingTooLong = true;
        flagReason = 'Chờ quá lâu (Bản nháp > 4h)';
      } else if (['CONFIRMED', 'READY_FOR_PLANNING'].includes(statusUpper) && ageHours > 8) {
        waitingTooLong = true;
        flagReason = 'Chờ quá lâu (Chưa gán chuyến > 8h)';
      } else if (o.waiting_too_long) {
        waitingTooLong = true;
        flagReason = 'Chờ quá lâu';
      }

      if (statusUpper === 'CONFIRMED' && (o.document_status || '').toUpperCase() !== 'APPROVED' && ageHours > 12) {
        overdueDocs = true;
        flagReason = flagReason ? `${flagReason} & Quá hạn chứng từ` : 'Quá hạn chứng từ';
      }

      if (statusUpper === 'IN_TRANSIT' && ageHours > 24) {
        lateRisk = true;
        flagReason = flagReason ? `${flagReason} & Nguy cơ trễ` : 'Nguy cơ trễ';
      } else if (o.late_risk) {
        lateRisk = true;
        flagReason = flagReason ? `${flagReason} & Nguy cơ trễ` : 'Nguy cơ trễ';
      }

      const isFlagged = waitingTooLong || overdueDocs || lateRisk;
      const timeInStatus = `${o.status || 'Đang xử lý'} ${Math.round(ageHours)}h`;

      return {
        id: o.id,
        order_code: o.order_code,
        code: o.order_code,
        order_type: o.order_type || 'Export',
        status: o.status,
        document_status: o.document_status || 'PENDING',
        responsible_dispatcher_id: o.responsible_dispatcher_id,
        agreed_price: o.agreed_price,
        created_at: o.created_at,
        age_hours: Math.round(ageHours),
        time_in_status: timeInStatus,
        waiting_too_long: waitingTooLong,
        overdue_docs: overdueDocs,
        late_risk: lateRisk,
        is_flagged: isFlagged,
        flag_reason: flagReason || 'Bình thường',
        dispatcher_id: o.dispatcher?.id || o.responsible_dispatcher_id || null,
        dispatcher_username: o.dispatcher?.username || null,
        dispatcher_name: o.dispatcher?.full_name || o.dispatcher?.username || (o.responsible_dispatcher_id ? `ĐPV #${o.responsible_dispatcher_id}` : 'Chưa gán'),
        tracking_token: o.tracking_token
      };
    });

    const allDispMap = new Map();
    (dispatchersData || []).forEach((d) => {
      allDispMap.set(d.id, {
        id: d.id,
        username: d.username,
        full_name: d.full_name || d.username,
        status: d.status
      });
    });

    formattedOrders.forEach((o) => {
      if (o.dispatcher_id && !allDispMap.has(o.dispatcher_id)) {
        allDispMap.set(o.dispatcher_id, {
          id: o.dispatcher_id,
          username: o.dispatcher_username || `user_${o.dispatcher_id}`,
          full_name: o.dispatcher_name,
          status: 'ACTIVE'
        });
      }
    });

    const dispatcherWorkload = Array.from(allDispMap.values()).map((d) => {
      const userOrders = formattedOrders.filter((o) => o.responsible_dispatcher_id === d.id || o.dispatcher_id === d.id);
      const total = userOrders.length;
      const active = userOrders.filter((o) => activeNormalized.includes((o.status || '').toUpperCase())).length;
      const flagged = userOrders.filter((o) => o.is_flagged).length;
      const completed = userOrders.filter((o) => ['COMPLETED', 'DELIVERED'].includes((o.status || '').toUpperCase())).length;
      const loadPercent = total > 0 ? Math.min(Math.round((active / 10) * 100), 100) : 0;

      return {
        id: d.id,
        username: d.username,
        full_name: d.full_name || d.username,
        total_orders: total,
        active_orders: active,
        flagged_orders: flagged,
        completed_orders: completed,
        load_percent: loadPercent,
        status: d.status
      };
    });

    const flaggedOrders = formattedOrders.filter((o) => o.is_flagged);

    return res.json({
      orders: formattedOrders,
      flagged_orders: flaggedOrders,
      dispatchers: dispatcherWorkload,
      summary: {
        total_orders: formattedOrders.length,
        flagged_count: flaggedOrders.length,
        active_dispatchers: dispatchersData.length
      }
    });
  } catch (error) {
    console.error('getOrderWorkload Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy thông tin khối lượng đơn', error: error.message });
  }
};

const reassignOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDispatcherId, reason } = req.body;
    const managerId = req.user?.id || null;

    if (!newDispatcherId) {
      return res.status(400).json({ message: 'Vui lòng chọn điều phối viên mới (MSG02).' });
    }

    const { data: curOrder, error: curErr } = await supabase
      .from('orders')
      .select('id, order_code, responsible_dispatcher_id')
      .eq('id', id)
      .single();

    if (curErr || !curOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần điều chuyển.' });
    }

    const { data: targetDisp } = await supabase
      .from('users')
      .select('id, full_name, username')
      .eq('id', newDispatcherId)
      .single();

    const dispName = targetDisp?.full_name || targetDisp?.username || `ID #${newDispatcherId}`;

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update({
        responsible_dispatcher_id: newDispatcherId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: 'REASSIGN_ORDER',
        target_type: 'ORDER',
        target_id: String(id),
        changes: {
          old_dispatcher_id: curOrder.responsible_dispatcher_id,
          new_dispatcher_id: newDispatcherId
        },
        reason: reason || 'Manager điều chuyển đơn giảm tải (UC-22)',
        created_time: new Date().toISOString()
      });
    } catch (logErr) {
      console.warn('activity_logs insert warning:', logErr.message);
    }

    const successMessage = `Đơn ${curOrder.order_code || curOrder.id} đã chuyển cho ${dispName} phụ trách (MSG29).`;

    return res.json({
      message: successMessage,
      order: updatedOrder
    });
  } catch (error) {
    console.error('reassignOrder Error:', error);
    return res.status(500).json({ message: 'Lỗi khi điều chuyển đơn hàng', error: error.message });
  }
};

const getOrderDetailReadOnly = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        dispatcher:users!orders_responsible_dispatcher_id_fkey(id, username, full_name, phone, email)
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ message: 'Không tìm thấy chi tiết đơn hàng.' });
    }

    return res.json({
      order: {
        ...order,
        is_read_only: true
      }
    });
  } catch (error) {
    console.error('getOrderDetailReadOnly Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy chi tiết đơn hàng', error: error.message });
  }
};

module.exports = {
  getDispatcherDashboardStats,
  getDashboardStats,
  getDriverPerformance,
  getOrders: getOrderWorkload,
  getOrderWorkload,
  getOrderDetailReadOnly,
  reassignOrder
};
