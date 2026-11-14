const supabase = require('../config/supabase');
const { parseOrderMeta } = require('../services/orderHelperService');
const oversightService = require('../services/oversightService');

/**
 * Oversight Controller — Nhóm chức năng Giám sát Vận hành, Khối lượng Đơn & Báo cáo Hiệu suất
 *
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
    const [
      { data: orders },
      { data: trucks },
      { data: trips },
      { data: incidents }
    ] = await Promise.all([
      supabase
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
        `),
      supabase.from('trucks').select('status'),
      supabase.from('trips').select('status'),
      supabase.from('incidents').select('status')
    ]);

    const orderList = (orders || []).map((o) => {
      const meta = parseOrderMeta(o);
      const cargos = Array.isArray(o.cargos) ? o.cargos: [];
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

    const avgRevenue = nonCancelledOrders.length > 0 ? Math.round(totalRevenue / nonCancelledOrders.length): 0;
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

    const truckList = trucks || [];
    const fleetStats = {
      total: truckList.length,
      available: truckList.filter((t) => t.status === 'AVAILABLE').length,
      on_trip: truckList.filter((t) => t.status === 'ON_TRIP').length,
      maintenance: truckList.filter((t) => t.status === 'MAINTENANCE').length
    };

    const tripList = trips || [];
    const activeTripsCount = tripList.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length;

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
        deliveredRate: totalOrders > 0 ? ((statusCounts.DELIVERED / totalOrders) * 100).toFixed(1): '100.0',
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
// B. MANAGER PERFORMANCE DASHBOARD & DRIVER PERFORMANCE
// ==========================================

const getDashboardStats = async (req, res) => {
  try {
    const period = req.query.period || 'Tháng 10/2026';
    const result = await oversightService.getPerformanceOverview(period);
    return res.json(result);
  } catch (error) {
    console.error('getDashboardStats Error:', error);
    return res.status(500).json({ message: 'Lỗi tải số liệu Dashboard', error: error.message });
  }
};

const getDriverPerformance = async (req, res) => {
  try {
    const period = req.query.period;
    const result = await oversightService.getDriverPerformance(period);
    return res.json(result);
  } catch (error) {
    console.error('getDriverPerformance Error:', error);
    return res.status(500).json({ message: 'Lỗi tải báo cáo hiệu suất tài xế', error: error.message });
  }
};

// ==========================================
// C. ORDER WORKLOAD & REASSIGN
// ==========================================

const getOrderWorkload = async (req, res) => {
  try {
    const [
      { data: dispatchersData, error: dispErr },
      { data: ordersData, error: ordersErr }
    ] = await Promise.all([
      supabase
        .from('users')
        .select('id, username, full_name, email, phone, role_id, status')
        .or('role_id.eq.3,username.ilike.%disp%')
        .order('id', { ascending: true }),
      supabase
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
          ready_for_planning_at,
          updated_at,
          dispatcher:users!orders_responsible_dispatcher_id_fkey(id, username, full_name)
        `)
        .order('id', { ascending: false })
    ]);

    if (dispErr) throw dispErr;
    if (ordersErr) throw ordersErr;

    const now = new Date();
    const activeNormalized = ['READY_FOR_PLANNING', 'PLANNED', 'ASSIGNED', 'IN_TRANSIT', 'CONFIRMED', 'DRAFT'];

    const formattedOrders = (ordersData || []).map((o) => {
      const createdAt = new Date(o.created_at);
      const readyAt = o.ready_for_planning_at ? new Date(o.ready_for_planning_at) : null;
      const statusUpper = (o.status || '').toUpperCase();

      // Thời gian tính cho trạng thái hiện tại:
      // - Với đơn READY_FOR_PLANNING: tính từ ready_for_planning_at (hoặc updated_at nếu có)
      // - Với đơn DRAFT / CONFIRMED: tính từ created_at
      let effectiveStartTime = createdAt;
      if (statusUpper === 'READY_FOR_PLANNING') {
        effectiveStartTime = readyAt || (o.updated_at ? new Date(o.updated_at) : createdAt);
      } else if (['ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'DELIVERED'].includes(statusUpper)) {
        effectiveStartTime = o.updated_at ? new Date(o.updated_at) : createdAt;
      }

      const ageHours = Math.max(0, (now - effectiveStartTime) / (1000 * 60 * 60));
      const overallAgeHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));

      let waitingTooLong = false;
      let overdueDocs = false;
      let lateRisk = Boolean(o.late_risk);
      let flagReason = null;

      if (statusUpper === 'DRAFT') {
        if (ageHours > 4 || o.waiting_too_long) {
          waitingTooLong = true;
          flagReason = 'Chờ quá lâu (Bản nháp > 4h)';
        }
      } else if (statusUpper === 'CONFIRMED') {
        if (ageHours > 8 || o.waiting_too_long) {
          waitingTooLong = true;
          flagReason = 'Chờ quá lâu (Chưa gán chuyến > 8h)';
        }
        if ((o.document_status || '').toUpperCase() !== 'APPROVED' && overallAgeHours > 12) {
          overdueDocs = true;
          flagReason = flagReason ? `${flagReason} & Quá hạn chứng từ` : 'Quá hạn chứng từ';
        }
      } else if (statusUpper === 'READY_FOR_PLANNING') {
        // Đơn đã được Điều phối viên tiếp nhận và chuyển sang Sẵn sàng vận chuyển / Sẵn sàng xếp xe
        // Đã hoàn tất tiếp nhận & chứng từ hợp lệ nên tuyệt đối không thuộc nhóm Đơn bị gắn cờ
        waitingTooLong = false;
        overdueDocs = false;
        lateRisk = false;
        flagReason = 'Sẵn sàng xếp xe';
        if (o.waiting_too_long) {
          supabase
            .from('orders')
            .update({ waiting_too_long: false })
            .eq('id', o.id)
            .then(() => {})
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
        dispatcher_name: o.dispatcher?.full_name || o.dispatcher?.username || (o.responsible_dispatcher_id ? `ĐPV #${o.responsible_dispatcher_id}`: 'Chưa gán'),
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
      const loadPercent = total > 0 ? Math.min(Math.round((active / 10) * 100), 100): 0;

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
      return res.status(400).json({ message: 'Vui lòng chọn điều phối viên mới.' });
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
        reason: reason || 'Manager điều chuyển đơn giảm tải',
        created_time: new Date().toISOString()
      });
    } catch (logErr) {
      console.warn('activity_logs insert warning:', logErr.message);
    }

    const successMessage = `Đơn ${curOrder.order_code || curOrder.id} đã chuyển cho ${dispName} phụ trách.`;

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
