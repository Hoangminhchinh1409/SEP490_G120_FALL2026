const supabase = require('../../config/supabase');

/**
 * Controller Giám sát Khối lượng Đơn & Điều chuyển dành cho Manager (UC-21, UC-22 V2 - Screen 18 & Screen 09)
 * - Thống kê tải của từng Điều phối viên (Workload per Dispatcher)
 * - Tự động phát hiện và gắn cờ các đơn hàng bị ách tắc (Screen 18):
 *    + Chờ quá lâu (BR-25): Đơn Draft quá hạn HOẶC đơn Confirmed chưa có chuyến quá hạn (V2 update).
 *    + Quá hạn chứng từ (MSG41): Đơn Confirmed nhưng thiếu chứng từ.
 *    + Nguy cơ trễ (BR-13): Đang vận chuyển ETA trễ > 30 phút.
 * - Điều chuyển đơn (Reassign): Ghi nhật ký activity_logs và trả thông báo MSG29.
 * - Xem chi tiết đơn hàng chế độ chỉ đọc (Screen 09 Read-only).
 */
const managerOrderController = {
  // 1. Lấy danh sách tải điều phối và danh sách đơn hàng (hỗ trợ Screen 18)
  getOrderWorkload: async (req, res) => {
    try {
      // 1. Lấy danh sách Dispatchers (role_id = 3 hoặc có đơn phân công)
      const { data: dispatchersData, error: dispErr } = await supabase
        .from('users')
        .select('id, username, full_name, email, phone, role_id, status')
        .or('role_id.eq.3,username.ilike.%disp%')
        .order('id', { ascending: true });

      if (dispErr) throw dispErr;

      // 2. Lấy danh sách đơn hàng thực tế
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

      // Tính toán gắn cờ cho từng đơn (Screen 18 / Figure 39)
      const formattedOrders = (ordersData || []).map((o) => {
        const createdAt = new Date(o.created_at);
        const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
        const statusUpper = (o.status || '').toUpperCase();

        let waitingTooLong = Boolean(o.waiting_too_long);
        let overdueDocs = false;
        let lateRisk = Boolean(o.late_risk);
        let flagReason = null;

        // V2 & DB flags:
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

        // Quá hạn chứng từ (MSG41)
        if (statusUpper === 'CONFIRMED' && (o.document_status || '').toUpperCase() !== 'APPROVED' && ageHours > 12) {
          overdueDocs = true;
          flagReason = flagReason ? `${flagReason} & Quá hạn chứng từ` : 'Quá hạn chứng từ';
        }

        // Nguy cơ trễ (BR-13)
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

      // Thống kê tải của từng Điều phối viên (Table 1 trong Figure 39)
      // Nếu dispatchersData không có ai nhưng có đơn được gán, gom theo responsible_dispatcher_id
      const allDispMap = new Map();
      (dispatchersData || []).forEach(d => {
        allDispMap.set(d.id, {
          id: d.id,
          username: d.username,
          full_name: d.full_name || d.username,
          status: d.status
        });
      });

      // Thêm các điều phối viên từ orders nếu chưa có
      formattedOrders.forEach(o => {
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

      // Danh sách đơn bị gắn cờ cảnh báo (Table 2)
      const flaggedOrders = formattedOrders.filter(o => o.is_flagged);

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
  },

  // 2. Điều chuyển đơn hàng sang Dispatcher khác (UC-22 - Screen 18)
  reassignOrder: async (req, res) => {
    try {
      const { id } = req.params;
      const { newDispatcherId, reason } = req.body;
      const managerId = req.user?.id || null;

      if (!newDispatcherId) {
        return res.status(400).json({ message: 'Vui lòng chọn điều phối viên mới (MSG02).' });
      }

      // Lấy thông tin đơn hiện tại
      const { data: curOrder, error: curErr } = await supabase
        .from('orders')
        .select('id, order_code, responsible_dispatcher_id')
        .eq('id', id)
        .single();

      if (curErr || !curOrder) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần điều chuyển.' });
      }

      // Lấy tên Dispatcher mới để đưa vào thông báo MSG29
      const { data: targetDisp } = await supabase
        .from('users')
        .select('id, full_name, username')
        .eq('id', newDispatcherId)
        .single();

      const dispName = targetDisp?.full_name || targetDisp?.username || `ID #${newDispatcherId}`;

      // Cập nhật đơn hàng
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

      // Ghi nhật ký hệ thống (activity_logs)
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

      // Thông báo chuẩn MSG29
      const successMessage = `Đơn ${curOrder.order_code || curOrder.id} đã chuyển cho ${dispName} phụ trách (MSG29).`;

      return res.json({
        message: successMessage,
        order: updatedOrder
      });
    } catch (error) {
      console.error('reassignOrder Error:', error);
      return res.status(500).json({ message: 'Lỗi khi điều chuyển đơn hàng', error: error.message });
    }
  },

  // 3. Xem chi tiết đơn hàng ở chế độ Read-only (Screen 09)
  getOrderDetailReadOnly: async (req, res) => {
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
  }
};

module.exports = managerOrderController;
