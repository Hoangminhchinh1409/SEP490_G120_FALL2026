const adminModel = require('../../models/adminModel');
const { getClientIp } = require('../../utils/ipHelper');
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
      updated_at: nowIso,
      waiting_too_long: false
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


// 9. TÁCH ĐƠN HÀNG THÀNH NHIỀU ĐƠN NHỎ ĐỂ ĐI NHIỀU XE (PHÙ HỢP CUNG ĐƯỜNG HẸP / XE NHỎ)
const splitOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { splits, reason } = req.body;

    if (!Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ít nhất 2 phân bổ xe con để tách đơn!' });
    }

    // 1. Tìm đơn hàng gốc
    let orderQuery = supabase
      .from('orders')
      .select('*, order_cargos(*), order_notes(*), customer:customers(*)')
      .limit(1);

    const cleanId = (id || '').toString().trim();
    if (/^\d+$/.test(cleanId)) {
      orderQuery = orderQuery.eq('id', parseInt(cleanId, 10));
    } else {
      orderQuery = orderQuery.eq('order_code', cleanId);
    }

    const { data: foundOrders, error: findErr } = await orderQuery;
    if (findErr || !foundOrders || foundOrders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần tách' });
    }

    const parentOrder = foundOrders[0];
    if (['CANCELLED', 'CLOSED', 'DELIVERED', 'IN_TRANSIT'].includes(parentOrder.status)) {
      return res.status(400).json({
        message: `Không thể tách đơn hàng đang ở trạng thái "${parentOrder.status}". Chỉ được tách khi đơn chưa lăn bánh!`
      });
    }

    const { parseOrderMeta, generateTrackingToken } = require('../../services/orderHelperService');
    const parentMeta = parseOrderMeta(parentOrder);
    const nowIso = new Date().toISOString();
    const dispatcherId = req.user?.id || parentOrder.responsible_dispatcher_id || 3;

    const baseCargo = Array.isArray(parentOrder.order_cargos) && parentOrder.order_cargos.length > 0
      ? parentOrder.order_cargos[0]
      : {};

    const createdChildOrders = [];

    // 2. Tạo từng đơn con tương ứng với mỗi xe nhỏ
    for (let index = 0; index < splits.length; index++) {
      const slice = splits[index];
      const childSuffix = index + 1;
      const childOrderCode = `${parentOrder.order_code}-${childSuffix}`;
      const childTrackingToken = generateTrackingToken();

      const childWeight = parseFloat(slice.weight_kg) || Math.round((baseCargo.actual_weight_kg || parentOrder.weight || 2500) / splits.length);
      const childChargeable = parseFloat(slice.chargeable_weight_kg) || childWeight;
      const childPackages = parseInt(slice.package_count, 10) || Math.max(1, Math.round((baseCargo.quantity || parentOrder.package_count || 1) / splits.length));
      const childVehicle = slice.vehicle_type || 'TRUCK_2.5T';
      const childPrice = parseInt(slice.agreed_price, 10) || Math.round((parentOrder.agreed_price || 0) / splits.length);

      // Meta con kế thừa từ đơn cha
      const childMeta = {
        ...parentMeta,
        parent_order_id: parentOrder.id,
        parent_order_code: parentOrder.order_code,
        split_index: childSuffix,
        split_total: splits.length,
        split_reason: reason || 'Khách hàng yêu cầu tách sang nhiều xe nhỏ theo cung đường kho hẹp',
        split_created_at: nowIso,
        weight: childWeight,
        chargeable: childChargeable,
        package_count: childPackages,
        agreed_vehicle_type: childVehicle,
        proposed_vehicle_type: childVehicle,
        vehicle_type_required: childVehicle,
        agreed_price: childPrice,
        web_workflow: {
          ...(parentMeta.web_workflow || {}),
          stage: parentMeta.web_workflow?.stage || 'CUSTOMER_CONFIRMED',
          agreed_vehicle_type: childVehicle,
          proposed_vehicle_type: childVehicle,
          split_parent: parentOrder.order_code,
          split_info: `Xe ${childSuffix}/${splits.length} (${childVehicle})`
        }
      };

      const childOrderPayload = {
        order_code: childOrderCode,
        hawb_number: childOrderCode,
        order_type: parentOrder.order_type || 'Import',
        customer_id: parentOrder.customer_id,
        tracking_token: childTrackingToken,
        pickup_location_id: parentOrder.pickup_location_id,
        delivery_location_id: parentOrder.delivery_location_id,
        receiver_name: parentOrder.receiver_name,
        receiver_phone: parentOrder.receiver_phone,
        agreed_price: childPrice,
        status: parentOrder.status === 'READY_FOR_PLANNING' ? 'READY_FOR_PLANNING' : 'CONFIRMED',
        source: parentOrder.source || 'Direct',
        responsible_dispatcher_id: dispatcherId,
        created_by: dispatcherId,
        requested_pickup_date: parentOrder.requested_pickup_date || parentOrder.required_pickup_date,
        truck_type_requested: childVehicle,
        loading_request: parentOrder.loading_request || 'NO',
        warehouse_type: parentOrder.warehouse_type || 'ALS warehouse',
        customer_agrees_to_grouping: false,
        document_status: parentOrder.document_status || 'Approved',
        is_closed: false,
        waiting_too_long: false,
        late_risk: false,
        ready_for_planning_at: nowIso,
        updated_at: nowIso
      };

      const { data: insertedChild, error: insertChildErr } = await supabase
        .from('orders')
        .insert([childOrderPayload])
        .select();

      if (insertChildErr || !insertedChild?.[0]) {
        console.error('splitOrder insert child error:', insertChildErr);
        continue;
      }

      const newChild = insertedChild[0];
      await saveOrderMeta(newChild.id, childMeta);

      // Thêm cargo cho đơn con
      await supabase.from('order_cargos').insert([{
        order_id: newChild.id,
        cargo_type: baseCargo.cargo_type || 'General',
        cargo_name: `${baseCargo.cargo_name || 'Hàng hóa'} (Lô ${childSuffix}/${splits.length})`,
        quantity: childPackages,
        unit: baseCargo.unit || 'Kiện',
        actual_weight_kg: childWeight,
        length_cm: baseCargo.length_cm || 0,
        width_cm: baseCargo.width_cm || 0,
        height_cm: baseCargo.height_cm || 0,
        stackable: true,
        chargeable_weight_kg: childChargeable,
        declared_value: baseCargo.declared_value ? Math.round(baseCargo.declared_value / splits.length) : 0,
        special_request_note: `Tách từ đơn gốc ${parentOrder.order_code} - Xe ${childSuffix}/${splits.length}`
      }]);

      // Thêm ghi chú
      await supabase.from('order_notes').insert([{
        order_id: newChild.id,
        content: `Đơn con tách từ ${parentOrder.order_code} cho xe ${childVehicle}. Lý do: ${reason || 'Yêu cầu xe nhỏ'}`,
        created_by: dispatcherId
      }]);

      createdChildOrders.push({
        ...newChild,
        order_id: newChild.order_code,
        cargo_name: `${baseCargo.cargo_name || 'Hàng hóa'} (Xe ${childSuffix})`,
        weight: childWeight,
        vehicle_type_required: childVehicle,
        agreed_price: childPrice
      });
    }

    // 3. Đánh dấu đơn gốc thành CANCELLED (hoặc ghi nhận đã tách sang các đơn con)
    const childCodesStr = createdChildOrders.map(c => c.order_code).join(', ');
    await supabase
      .from('orders')
      .update({
        status: 'CANCELLED',
        cancellation_reason: `Đã tách thành ${createdChildOrders.length} đơn con cho nhiều xe nhỏ: ${childCodesStr}. Lý do: ${reason || 'Cung đường hẹp/yêu cầu xe nhỏ'}`,
        updated_at: nowIso
      })
      .eq('id', parentOrder.id);

    await saveOrderMeta(parentOrder.id, {
      ...parentMeta,
      split_into_orders: createdChildOrders.map(c => ({ id: c.id, order_code: c.order_code })),
      cancelled_at: nowIso,
      cancel_reason: `Đã tách thành ${createdChildOrders.length} đơn xe nhỏ: ${childCodesStr}`
    }, dispatcherId);

    await supabase.from('order_notes').insert([{
      order_id: parentOrder.id,
      content: `[TÁCH ĐƠN THÀNH CÔNG] Đơn này đã được chia thành ${createdChildOrders.length} đơn con: ${childCodesStr} để xếp vào các xe tải nhỏ hơn.`,
      created_by: dispatcherId
    }]);

    return res.status(201).json({
      message: `Đã tách đơn hàng ${parentOrder.order_code} thành ${createdChildOrders.length} đơn con (${childCodesStr}) thành công! Mỗi đơn sẵn sàng xếp lên 1 xe riêng biệt.`,
      parent_order_code: parentOrder.order_code,
      child_orders: createdChildOrders
    });
  } catch (err) {
    console.error('splitOrder Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};


module.exports = {
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder,
  splitOrder
};
