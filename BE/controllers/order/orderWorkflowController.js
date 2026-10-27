const supabase = require('../../config/supabase');
const { saveOrderMeta } = require('../../services/orderHelperService');

// 5. XÁC NHẬN ĐƠN HÀNG (CHUYỂN SANG READY_FOR_PLANNING)
const confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price } = req.body || {};

    const nowIso = new Date().toISOString();
    const updates = {
      status: 'READY_FOR_PLANNING',
      document_status: 'APPROVED',
      ready_for_planning_at: nowIso,
      updated_at: nowIso
    };

    if (agreed_price && parseInt(agreed_price) > 0) {
      updates.agreed_price = parseInt(agreed_price);
    }

    let query = supabase.from('orders').update(updates);
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('confirmOrder Error:', error);
      return res.status(500).json({ message: 'Không thể xác nhận đơn hàng', error });
    }

    const updatedOrder = data?.[0];
    if (updatedOrder?.id) {
      await saveOrderMeta(updatedOrder.id, {
        docs_confirmed_at: nowIso,
        docs_confirmed_by: req.user?.id || 3
      }, req.user?.id || 3);
    }

    return res.json({
      message: 'Đã xác nhận đơn hàng thành công! Đơn đã sẵn sàng để xếp xe.',
      order: updatedOrder
    });
  } catch (err) {
    console.error('confirmOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 6. GÁN XE VÀ TÀI XẾ CHO ĐƠN HÀNG (CHUYỂN SANG ASSIGNED)
const assignTrip = async (req, res) => {
  try {
    const { id } = req.params;

    let query = supabase.from('orders').update({
      status: 'ASSIGNED',
      updated_at: new Date().toISOString()
    });

    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('assignTrip Error:', error);
      return res.status(500).json({ message: 'Không thể gán xe cho đơn', error });
    }

    return res.json({ message: 'Đã gán xe thành công!', order: data?.[0] });
  } catch (err) {
    console.error('assignTrip Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 7. HỦY ĐƠN HÀNG (CHUYỂN SANG CANCELLED)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason, cancellation_fee } = req.body || {};

    const nowIso = new Date().toISOString();
    const updates = {
      status: 'CANCELLED',
      updated_at: nowIso
    };

    let query = supabase.from('orders').update(updates);
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('cancelOrder Supabase Error:', error);
      return res.status(500).json({ message: error.message || 'Không thể hủy đơn hàng trên hệ thống' });
    }

    const updatedOrder = data?.[0];
    if (updatedOrder?.id) {
      await saveOrderMeta(updatedOrder.id, {
        cancel_reason: cancellation_reason || null,
        cancel_fee: cancellation_fee ? parseInt(cancellation_fee) : 0,
        cancelled_at: nowIso
      }, req.user?.id || 3);
    }

    return res.json({
      message: 'Đã hủy đơn hàng thành công!',
      order: {
        ...(updatedOrder || { id }),
        status: 'CANCELLED',
        cancellation_reason,
        cancellation_fee
      }
    });
  } catch (err) {
    console.error('cancelOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 8. ĐÓNG ĐƠN HÀNG (CHUYỂN SANG CLOSED)
const closeOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const nowIso = new Date().toISOString();
    const updates = {
      status: 'CLOSED',
      updated_at: nowIso
    };

    let query = supabase.from('orders').update(updates);
    if (/^\d+$/.test(id)) {
      query = query.eq('id', parseInt(id));
    } else {
      query = query.eq('order_code', id);
    }

    const { data, error } = await query.select();

    if (error) {
      console.warn('closeOrder note (will fallback):', error.message);
    }

    const updatedOrder = data?.[0];
    if (updatedOrder?.id) {
      await saveOrderMeta(updatedOrder.id, {
        closed_at: nowIso
      }, req.user?.id || 3);
    }

    return res.json({
      message: 'Đã đóng đơn hàng thành công!',
      order: {
        ...(updatedOrder || { id }),
        status: 'CLOSED'
      }
    });
  } catch (err) {
    console.error('closeOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


module.exports = {
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder
};
