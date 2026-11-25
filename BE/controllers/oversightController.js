const prisma = require('../config/prisma');
const { parseOrderMeta } = require('../services/orderHelperService');
const oversightService = require('../services/oversightService');
const { serializePrisma, toBigInt, toNum } = require('../utils/prismaHelper');

/**
 * Oversight Controller — Nhóm chức năng Giám sát Vận hành, Khối lượng Đơn & Báo cáo Hiệu suất
 */

const parsePeriodRange = oversightService.parsePeriodRange;

// ==========================================
// A. DISPATCHER DASHBOARD STATS
// ==========================================

const DISPATCHER_STATS_CACHE_TTL_MS = 10000;
let dispatcherStatsCache = { data: null, expiresAt: 0 };
let dispatcherStatsInflight = null;

const getDispatcherDashboardStats = async (req, res) => {
  try {
    const forceRefresh = req.query?.refresh === '1' || req.query?.refresh === 'true';
    const now = Date.now();
    if (!forceRefresh && dispatcherStatsCache.data && dispatcherStatsCache.expiresAt > now) {
      return res.json(dispatcherStatsCache.data);
    }
    if (!forceRefresh && dispatcherStatsInflight) {
      const payload = await dispatcherStatsInflight;
      return res.json(payload);
    }

    const computePromise = (async () => {
    const [ordersRaw, trucks, trips, incidents] = await Promise.all([
      prisma.orders.findMany({
        select: {
          id: true,
          order_code: true,
          status: true,
          agreed_price: true,
          customer_id: true,
          created_at: true,
          order_cargos: {
            select: {
              actual_weight_kg: true,
              chargeable_weight_kg: true
            }
          },
          order_notes: {
            where: {
              content: { startsWith: '[META_' }
            },
            select: { content: true }
          }
        }
      }),
      prisma.trucks.findMany({
        where: { deleted_at: null },
        select: { status: true }
      }),
      prisma.trips.findMany({ select: { status: true } }),
      prisma.incidents.findMany({ select: { id: true, type: true, status: true } })
    ]);

    const orders = serializePrisma(ordersRaw || []);
    const orderList = orders.map((o) => {
      const meta = parseOrderMeta(o);
      const cargos = Array.isArray(o.order_cargos) ? o.order_cargos : o.order_cargos ? [o.order_cargos] : [];
      const weight = cargos.reduce(
        (s, c) =>
          s +
          Math.max(
            Number(c.chargeable_weight) || Number(c.chargeable_weight_kg) || 0,
            Number(c.weight_kg) || Number(c.actual_weight_kg) || 0
          ),
        0
      );
      return {
        ...o,
        cargos,
        cancel_reason: meta.cancel_reason || null,
        cancel_fee: Number(meta.cancel_fee || 0),
        cancelled_at: meta.cancelled_at || null,
        weight
      };
    });

    const isCancelled = (o) => o.status === 'CANCELLED' || !!o.cancel_reason || !!o.cancelled_at;
    const nonCancelledOrders = orderList.filter((o) => !isCancelled(o));

    const totalOrders = nonCancelledOrders.length;
    const deliveredOrders = nonCancelledOrders.filter((o) => o.status === 'DELIVERED' || o.status === 'CLOSED').length;
    const readyOrders = nonCancelledOrders.filter((o) => o.status === 'READY_FOR_PLANNING').length;
    const assignedOrders = nonCancelledOrders.filter((o) => o.status === 'ASSIGNED').length;
    const inTransitOrders = nonCancelledOrders.filter((o) => o.status === 'IN_TRANSIT').length;
    const confirmedOrders = nonCancelledOrders.filter((o) => o.status === 'CONFIRMED').length;
    const cancelledOrders = orderList.filter((o) => isCancelled(o)).length;

    const availableTrucks = (trucks || []).filter((t) =>
      ['AVAILABLE', 'ACTIVE'].includes(String(t.status || '').trim().toUpperCase())
    ).length;
    const activeTripsCount = (trips || []).filter((t) =>
      ['IN_PROGRESS', 'ASSIGNED', 'IN_TRANSIT', 'ACCEPTED', 'LOADING_STARTED', 'LOADING_DONE'].includes(
        String(t.status || '').trim().toUpperCase().replace(/\s+/g, '_')
      )
    ).length;
    const openIncidents = (incidents || []).filter((i) => !['RESOLVED', 'DONE', 'CLOSED'].includes(String(i.status || '').toUpperCase())).length;

    const totalRevenue = orderList.reduce((sum, o) => {
      if (isCancelled(o)) {
        return sum + (Number(o.cancel_fee) || 0);
      }
      if (String(o.status || '').toUpperCase() === 'DRAFT') {
        return sum;
      }
      return sum + (Number(o.agreed_price) || 0);
    }, 0);

    const totalWeight = nonCancelledOrders.reduce((s, o) => s + o.weight, 0);

    const payload = {
      kpi: {
        total_orders: totalOrders,
        ready_for_planning: readyOrders,
        assigned_orders: assignedOrders,
        confirmed_orders: confirmedOrders,
        in_transit_orders: inTransitOrders,
        delivered_orders: deliveredOrders,
        cancelled_orders: cancelledOrders,
        available_trucks: availableTrucks,
        total_trucks: (trucks || []).length,
        active_trips: activeTripsCount,
        open_incidents: openIncidents,
        total_revenue: totalRevenue,
        total_weight_kg: Math.round(totalWeight)
      },
      incidentsSummary: (incidents || []).map((inc) => ({
        id: inc.id !== undefined && inc.id !== null ? Number(inc.id) : null,
        type: inc.type || 'OTHER',
        status: inc.status || 'Open'
      }))
    };

    dispatcherStatsCache = {
      data: payload,
      expiresAt: Date.now() + DISPATCHER_STATS_CACHE_TTL_MS
    };
    return payload;
    })().finally(() => {
      dispatcherStatsInflight = null;
    });

    dispatcherStatsInflight = computePromise;
    const payload = await computePromise;
    return res.json(payload);
  } catch (err) {
    console.error('getDispatcherDashboardStats error:', err);
    return res.status(500).json({ message: 'Lỗi tải thống kê tổng quan' });
  }
};

// ==========================================
// B. MANAGER PERFORMANCE OVERSIGHT (SCREEN 16 & 41)
// ==========================================

const getCurrentPeriodGMT7 = () =>
  new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);

const getPerformanceOverview = async (req, res) => {
  const periodStr = req.query.period || getCurrentPeriodGMT7();
  try {
    const refresh = req.query?.refresh === '1' || req.query?.refresh === 'true';
    const result = await oversightService.getPerformanceOverview(periodStr, { refresh });
    return res.json(result);
  } catch (error) {
    if (error?.statusCode >= 400 && error.statusCode < 500) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('[oversightController] getPerformanceOverview Error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tải báo cáo tổng quan.' });
  }
};

const getDriverPerformance = async (req, res) => {
  const periodStr = req.query.period || 'ALL';
  try {
    const refresh = req.query?.refresh === '1' || req.query?.refresh === 'true';
    const result = await oversightService.getDriverPerformance(periodStr, { refresh });
    return res.json(result);
  } catch (error) {
    if (error?.statusCode >= 400 && error.statusCode < 500) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('[oversightController] getDriverPerformance Error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tải báo cáo hiệu suất tài xế.' });
  }
};

// ==========================================
// C. ORDER WORKLOAD & REASSIGN
// ==========================================

const getOrderWorkload = async (req, res) => {
  try {
    const [dispatchersRaw, ordersRaw] = await Promise.all([
      prisma.users.findMany({
        where: {
          OR: [
            { role_id: 3n },
            { username: { contains: 'disp', mode: 'insensitive' } }
          ]
        },
        select: { id: true, username: true, full_name: true, email: true, phone: true, role_id: true, status: true },
        orderBy: { id: 'asc' }
      }),
      prisma.orders.findMany({
        select: {
          id: true,
          order_code: true,
          order_type: true,
          status: true,
          document_status: true,
          responsible_dispatcher_id: true,
          agreed_price: true,
          receiver_name: true,
          receiver_phone: true,
          tracking_token: true,
          vendor_id: true,
          waiting_too_long: true,
          late_risk: true,
          created_at: true,
          ready_for_planning_at: true,
          updated_at: true,
          users_orders_responsible_dispatcher_idTousers: {
            select: { id: true, username: true, full_name: true }
          }
        },
        orderBy: { id: 'desc' }
      })
    ]);

    const dispatchersData = serializePrisma(dispatchersRaw || []);
    const ordersData = serializePrisma(ordersRaw || []).map((o) => ({
      ...o,
      dispatcher: o.users_orders_responsible_dispatcher_idTousers || null
    }));

    const now = new Date();
    const activeNormalized = [
      'READY_FOR_PLANNING',
      'PLANNED',
      'ASSIGNED',
      'IN_TRANSIT',
      'CONFIRMED',
      'ACCEPTED',
      'PICKED_UP',
      'DRAFT'
    ];

    const processedOrders = ordersData.map((o) => {
      const statusUpper = (o.status || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const createdAt = o.created_at ? new Date(o.created_at) : now;
      const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));

      let waitingTooLong = Boolean(o.waiting_too_long);
      let lateRisk = Boolean(o.late_risk);
      let overdueDocs = false;
      let flagReason = '';

      if (statusUpper === 'DRAFT') {
        if (ageHours > 4) {
          waitingTooLong = true;
          flagReason = 'Bản nháp quá 4h chưa xử lý';
        }
      } else if (statusUpper === 'CONFIRMED') {
        if (ageHours > 2) {
          waitingTooLong = true;
          flagReason = 'Đã xác nhận nhưng chờ duyệt chứng từ lâu';
        }
        if (o.document_status !== 'APPROVED' && ageHours > 12) {
          overdueDocs = true;
          flagReason = flagReason ? `${flagReason} & Quá hạn chứng từ` : 'Quá hạn chứng từ';
        }
      } else if (statusUpper === 'READY_FOR_PLANNING') {
        waitingTooLong = false;
        overdueDocs = false;
        lateRisk = false;
        flagReason = 'Sẵn sàng xếp xe';
        if (o.waiting_too_long) {
          prisma.orders
            .update({
              where: { id: BigInt(o.id) },
              data: { waiting_too_long: false }
            })
            .catch(() => {});
        }
      } else if (statusUpper === 'IN_TRANSIT') {
        if (ageHours > 24 || o.late_risk) {
          lateRisk = true;
          flagReason = 'Nguy cơ trễ chuyến';
        }
      }

      const isFlagged = statusUpper === 'READY_FOR_PLANNING' ? false : (waitingTooLong || overdueDocs || lateRisk);
      const hoursRounded = Math.round(ageHours);
      const timeInStatus = `${o.status || 'Đang xử lý'} ${hoursRounded > 0 ? `${hoursRounded}h` : `${Math.max(1, Math.round(ageHours * 60))}m`}`;

      return {
        id: toNum(o.id),
        order_code: o.order_code,
        code: o.order_code,
        order_type: o.order_type || 'Export',
        status: o.status,
        document_status: o.document_status || 'PENDING',
        responsible_dispatcher_id: toNum(o.responsible_dispatcher_id),
        agreed_price: o.agreed_price,
        created_at: o.created_at,
        age_hours: Math.round(ageHours),
        time_in_status: timeInStatus,
        waiting_too_long: waitingTooLong,
        late_risk: lateRisk,
        overdue_docs: overdueDocs,
        is_flagged: isFlagged,
        flag_reason: flagReason,
        dispatcher_name: o.dispatcher?.full_name || o.dispatcher?.username || 'Chưa phân công',
        tracking_token: o.tracking_token,
        is_active: activeNormalized.includes(statusUpper)
      };
    });

    const totalOrdersCount = processedOrders.length;
    const flaggedOrdersCount = processedOrders.filter((o) => o.is_flagged).length;
    const completedOrdersCount = processedOrders.filter((o) => {
      const su = (o.status || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      return ['DELIVERED', 'COMPLETED', 'DELIVERED_EXCEPTION', 'CLOSED'].includes(su);
    }).length;

    const dispatcherWorkload = dispatchersData.map((d) => {
      const assigned = processedOrders.filter((o) => Number(o.responsible_dispatcher_id) === Number(d.id));
      const activeOrders = assigned.filter((o) => o.is_active);
      const flaggedOrders = assigned.filter((o) => o.is_flagged);

      const loadPercent = Math.min(100, Math.round((activeOrders.length / 8) * 100));
      let workloadBadge = 'Cân bằng';
      let badgeColor = 'success';
      if (loadPercent >= 80 || activeOrders.length >= 6) {
        workloadBadge = 'Quá tải';
        badgeColor = 'danger';
      } else if (loadPercent >= 50 || activeOrders.length >= 4) {
        workloadBadge = 'Bình thường';
        badgeColor = 'warning';
      }

      return {
        id: toNum(d.id),
        username: d.username,
        full_name: d.full_name || d.username,
        name: d.full_name || d.username,
        email: d.email,
        phone: d.phone,
        status: d.status || 'ACTIVE',
        total_orders: assigned.length,
        active_orders: activeOrders.length,
        flagged_orders: flaggedOrders.length,
        completed_orders: assigned.filter((o) => !o.is_active).length,
        load_percent: loadPercent,
        workload_badge: workloadBadge,
        badge_color: badgeColor
      };
    });

    const flaggedList = processedOrders.filter((o) => o.is_flagged);

    return res.json({
      dispatchers: dispatcherWorkload,
      orders: processedOrders,
      flagged_orders: flaggedList,
      summary: {
        total_orders: totalOrdersCount,
        flagged_count: flaggedOrdersCount,
        completed_count: completedOrdersCount,
        total_dispatchers: dispatcherWorkload.length
      },
      is_read_only: true
    });
  } catch (error) {
    console.error('getOrderWorkload Error:', error);
    return res.status(500).json({ message: 'Lỗi tải khối lượng công việc đơn hàng' });
  }
};

const reassignOrder = async (req, res) => {
  try {
    const bigOrderId = toBigInt(req.params.id);
    const { newDispatcherId, reason } = req.body;
    const managerId = req.user?.id ? toBigInt(req.user.id) : null;

    const targetDispatcherId = Number(newDispatcherId);
    if (!newDispatcherId || !Number.isInteger(targetDispatcherId) || targetDispatcherId <= 0) {
      return res.status(400).json({ message: 'Vui lòng chọn điều phối viên mới hợp lệ.' });
    }

    const curOrder = await prisma.orders.findUnique({
      where: { id: bigOrderId },
      select: { id: true, order_code: true, responsible_dispatcher_id: true }
    });

    if (!curOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần điều chuyển.' });
    }

    if (Number(curOrder.responsible_dispatcher_id) === targetDispatcherId) {
      return res.status(400).json({ message: 'Đơn hàng hiện đã thuộc phụ trách của điều phối viên này.' });
    }

    const targetDisp = await prisma.users.findUnique({
      where: { id: BigInt(targetDispatcherId) },
      select: { id: true, full_name: true, username: true }
    });

    const dispName = targetDisp?.full_name || targetDisp?.username || `ID #${targetDispatcherId}`;

    const updatedOrder = await prisma.orders.update({
      where: { id: bigOrderId },
      data: {
        responsible_dispatcher_id: BigInt(targetDispatcherId),
        updated_at: new Date()
      }
    });

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerId,
          actor_type: 'MANAGER',
          action: 'REASSIGN_ORDER',
          target_type: 'ORDER',
          target_id: bigOrderId,
          changes: {
            old_dispatcher_id: toNum(curOrder.responsible_dispatcher_id),
            new_dispatcher_id: targetDispatcherId
          },
          reason: reason || 'Manager điều chuyển đơn giảm tải',
          created_time: new Date()
        }
      });
    } catch (logErr) {
      console.warn('activity_logs insert warning:', logErr.message);
    }

    const successMessage = `Đơn ${curOrder.order_code || curOrder.id} đã chuyển cho ${dispName} phụ trách.`;

    return res.json({
      message: successMessage,
      order: serializePrisma(updatedOrder)
    });
  } catch (error) {
    console.error('reassignOrder Error:', error);
    return res.status(500).json({ message: 'Lỗi khi điều chuyển đơn hàng' });
  }
};

const getOrderDetailReadOnly = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    if (bigId === null) {
      return res.status(404).json({ message: 'Không tìm thấy chi tiết đơn hàng.' });
    }

    const orderRaw = await prisma.orders.findUnique({
      where: { id: bigId },
      include: {
        customers: { select: { id: true, company_name: true, tax_code: true, email: true, phone: true, registered_address: true } },
        locations_orders_pickup_location_idTolocations: { select: { id: true, name: true, address: true } },
        locations_orders_delivery_location_idTolocations: { select: { id: true, name: true, address: true } },
        users_orders_responsible_dispatcher_idTousers: { select: { id: true, username: true, full_name: true, phone: true, email: true } },
        order_notes: { select: { content: true } }
      }
    });

    if (!orderRaw) {
      return res.status(404).json({ message: 'Không tìm thấy chi tiết đơn hàng.' });
    }

    const serialized = serializePrisma(orderRaw);
    const {
      customers: customer,
      locations_orders_pickup_location_idTolocations: pickup_location,
      locations_orders_delivery_location_idTolocations: delivery_location,
      users_orders_responsible_dispatcher_idTousers: dispatcher,
      ...restOrder
    } = serialized;

    const order = {
      ...restOrder,
      customer: customer || null,
      pickup_location: pickup_location || null,
      delivery_location: delivery_location || null,
      dispatcher: dispatcher || null
    };

    const meta = parseOrderMeta(order);

    return res.json({
      order: {
        ...order,
        customer_name: order.customer?.company_name || order.receiver_name || 'N/A',
        pickup_address: meta.pickup_address || order.pickup_location?.address || order.pickup_location?.name || 'N/A',
        delivery_address: meta.delivery_address || order.delivery_location?.address || order.delivery_location?.name || 'N/A',
        is_read_only: true
      }
    });
  } catch (error) {
    console.error('getOrderDetailReadOnly Error:', error);
    return res.status(500).json({ message: 'Lỗi tải chi tiết đơn hàng' });
  }
};

module.exports = {
  parsePeriodRange,
  getDispatcherDashboardStats,
  getPerformanceOverview,
  getDashboardStats: getPerformanceOverview,
  getDriverPerformance,
  getOrderWorkload,
  reassignOrder,
  getOrderDetailReadOnly
};
