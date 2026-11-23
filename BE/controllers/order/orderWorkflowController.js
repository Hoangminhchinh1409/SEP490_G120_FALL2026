const adminModel = require('../../models/adminModel');
const { getClientIp } = require('../../utils/ipHelper');
const prisma = require('../../config/prisma');
const { serializePrisma, formatDateOnly } = require('../../utils/prismaHelper');
const { saveOrderMeta } = require('../../services/orderHelperService');

const buildOrderWhere = (idParam) => {
  const clean = String(idParam || '').trim();
  return /^\d+$/.test(clean) ? { id: BigInt(clean) } : { order_code: clean };
};

const serializeOrderRow = (row) => {
  if (!row) return null;
  const serialized = serializePrisma(row);
  if (row.requested_pickup_date) {
    serialized.requested_pickup_date = formatDateOnly(row.requested_pickup_date);
  }
  return serialized;
};

// 5. XÁC NHẬN ĐƠN HÀNG (CHUYỂN SANG READY_FOR_PLANNING)
const confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { agreed_price } = req.body || {};

    // 1. Kiểm tra đơn hàng hiện tại
    const currentOrder = await prisma.orders.findFirst({
      where: buildOrderWhere(id)
    });
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const upperSt = (currentOrder.status || '').toUpperCase();
    if (upperSt === 'CANCELLED' || upperSt === 'CLOSED') {
      return res.status(400).json({ message: 'Không thể xác nhận đơn hàng đã bị hủy hoặc đã đóng' });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const updates = {
      status: 'READY_FOR_PLANNING',
      document_status: 'APPROVED',
      ready_for_planning_at: nowDate,
      updated_at: nowDate,
      waiting_too_long: false
    };

    if (agreed_price && parseInt(agreed_price, 10) > 0) {
      updates.agreed_price = parseInt(agreed_price, 10);
    }

    const resUpdate = await prisma.orders.updateMany({
      where: {
        id: currentOrder.id,
        status: { notIn: ['CANCELLED', 'CLOSED'] }
      },
      data: updates
    });

    if (resUpdate.count === 0) {
      return res.status(400).json({ message: 'Không thể xác nhận đơn hàng đã bị hủy hoặc đã đóng' });
    }

    const updatedRow = await prisma.orders.findUnique({ where: { id: currentOrder.id } });
    const updatedOrder = serializeOrderRow(updatedRow);
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
    const found = await prisma.orders.findFirst({
      where: { ...buildOrderWhere(id), status: 'READY_FOR_PLANNING' },
      select: { id: true }
    });

    let updatedOrder;
    if (found) {
      const updatedRow = await prisma.orders.update({
        where: { id: found.id },
        data: {
          status: 'ASSIGNED',
          updated_at: new Date()
        }
      });
      updatedOrder = serializeOrderRow(updatedRow);
    }

    return res.json({ message: 'Đã gán xe thành công!', order: updatedOrder });
  } catch (err) {
    console.error('assignTrip Exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// 7. HỦY ĐƠN HÀNG (CHUYỂN SANG CANCELLED, BR-17, BR-43, IT-ORD-008, IT-ORD-009)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason, cancellation_fee } = req.body || {};

    if (!cancellation_reason || !String(cancellation_reason).trim()) {
      return res.status(400).json({ message: 'Lý do hủy đơn hàng là bắt buộc' });
    }

    if (cancellation_fee !== undefined && cancellation_fee !== null) {
      const fee = parseInt(cancellation_fee, 10);
      if (isNaN(fee) || fee < 0) {
        return res.status(400).json({ message: 'Phí hủy không hợp lệ (phải >= 0)' });
      }
    }

    // 1. Tìm đơn hàng hiện tại để kiểm tra trạng thái hủy
    const currentOrder = await prisma.orders.findFirst({
      where: buildOrderWhere(id)
    });
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần hủy' });
    }

    const upperSt = (currentOrder.status || '').toUpperCase();

    // BR-17 / Figure 20: Chỉ được hủy đơn trước khi hàng được bốc lên xe (DRAFT, CONFIRMED, READY_FOR_PLANNING, ASSIGNED, ACCEPTED).
    const blockedStatuses = ['PICKED_UP', 'IN_TRANSIT', 'IN_PROGRESS', 'HANDED_OVER_VENDOR', 'HANDED_OVER_TO_VENDOR', 'DELIVERED', 'DELIVERED_EXCEPTION', 'CANCELLED', 'CLOSED'];
    if (blockedStatuses.includes(upperSt)) {
      return res.status(400).json({
        message: 'Không thể hủy đơn hàng sau khi hàng đã được bốc xếp hoặc đã chốt hoàn tất (BR-17)!'
      });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const feeVal = cancellation_fee !== undefined && cancellation_fee !== null ? parseInt(cancellation_fee, 10) : 0;
    const actorId = Number(req.user?.id || 3);
    const updates = {
      status: 'CANCELLED',
      cancellation_reason: cancellation_reason.trim(),
      cancellation_fee: feeVal,
      updated_at: nowDate
    };

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updRes = await tx.orders.updateMany({
        where: {
          id: currentOrder.id,
          status: { notIn: blockedStatuses }
        },
        data: updates
      });
      const freshOrder = updRes.count > 0
        ? await tx.orders.findUnique({ where: { id: currentOrder.id } })
        : currentOrder;

      // Ghi order_notes
      await tx.order_notes.create({
        data: {
          order_id: currentOrder.id,
          content: `[ĐƠN HÀNG ĐÃ HỦY] Lý do: ${cancellation_reason.trim()}. Phí hủy: ${feeVal.toLocaleString('vi-VN')} VNĐ.`,
          created_by: actorId
        }
      });

      // BR-43 / IT-ORD-008: Nếu đơn đã được gán chuyến (ASSIGNED) -> Hủy chuyến liên quan và giải phóng xe về AVAILABLE
      const relatedStops = await tx.trip_stops.findMany({
        where: { order_id: currentOrder.id },
        select: { trip_id: true }
      });

      const tripIds = [...new Set((relatedStops || []).map(s => s.trip_id).filter(Boolean))];
      for (const tId of tripIds) {
        await tx.trips.updateMany({
          where: { id: tId },
          data: { status: 'CANCELLED', updated_at: nowDate }
        });

        const tripTrucks = await tx.trip_trucks.findMany({
          where: { trip_id: tId },
          select: { truck_id: true }
        });

        const truckIds = (tripTrucks || []).map(tt => tt.truck_id).filter(Boolean);
        if (truckIds.length > 0) {
          await tx.trucks.updateMany({
            where: { id: { in: truckIds }, deleted_at: null },
            data: { status: 'AVAILABLE', updated_at: nowDate }
          });
        }
      }

      return serializeOrderRow(freshOrder);
    });

    // Lưu metadata
    await saveOrderMeta(Number(currentOrder.id), {
      cancel_reason: cancellation_reason.trim(),
      cancel_fee: feeVal,
      cancelled_at: nowIso
    }, actorId);

    return res.json({
      message: 'Đã hủy đơn hàng thành công!',
      order: {
        ...updatedOrder,
        status: 'CANCELLED',
        cancellation_reason: cancellation_reason.trim(),
        cancellation_fee: feeVal
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

    // 1. Kiểm tra đơn hàng hiện tại
    const currentOrder = await prisma.orders.findFirst({
      where: buildOrderWhere(id)
    });
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần đóng' });
    }

    const upperSt = (currentOrder.status || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (!['DELIVERED', 'DELIVERED_EXCEPTION', 'CANCELLED'].includes(upperSt)) {
      return res.status(400).json({
        message: 'Chỉ có thể đóng đơn hàng từ trạng thái DELIVERED, DELIVERED_EXCEPTION hoặc CANCELLED'
      });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const updRes = await prisma.orders.updateMany({
      where: { id: currentOrder.id, status: currentOrder.status },
      data: {
        status: 'CLOSED',
        is_closed: true,
        updated_at: nowDate
      }
    });

    const updatedRow = updRes.count > 0
      ? await prisma.orders.findUnique({ where: { id: currentOrder.id } })
      : null;
    const updatedOrder = serializeOrderRow(updatedRow);

    if (updatedOrder?.id) {
      await saveOrderMeta(updatedOrder.id, {
        closed_at: nowIso
      }, req.user?.id || 3);
    }

    return res.json({
      message: 'Đã đóng đơn hàng thành công!',
      order: updatedOrder || { id, status: 'CLOSED' }
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
    const cleanId = (id || '').toString().trim();
    const parentRow = await prisma.orders.findFirst({
      where: buildOrderWhere(cleanId),
      include: {
        order_cargos: true,
        order_notes: true,
        customers: true
      }
    });

    if (!parentRow) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần tách' });
    }

    const parentOrder = {
      ...serializeOrderRow(parentRow),
      customer: serializePrisma(parentRow.customers) || null
    };

    if (['CANCELLED', 'CLOSED', 'DELIVERED', 'DELIVERED_EXCEPTION', 'IN_TRANSIT', 'PICKED_UP', 'ACCEPTED', 'HANDED_OVER_VENDOR', 'HANDED_OVER_TO_VENDOR'].includes(String(parentOrder.status || '').toUpperCase())) {
      return res.status(400).json({
        message: `Không thể tách đơn hàng đang ở trạng thái "${parentOrder.status}". Chỉ được tách khi đơn chưa lăn bánh!`
      });
    }

    const { parseOrderMeta, generateTrackingToken } = require('../../services/orderHelperService');
    const parentMeta = parseOrderMeta(parentOrder);
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const dispatcherId = Number(req.user?.id || parentOrder.responsible_dispatcher_id || 3);

    const baseCargo = Array.isArray(parentOrder.order_cargos)
      ? (parentOrder.order_cargos[0] || {})
      : (parentOrder.order_cargos || {});

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
        order_type: parentRow.order_type || 'Import',
        customer_id: parentRow.customer_id,
        tracking_token: childTrackingToken,
        pickup_location_id: parentRow.pickup_location_id,
        delivery_location_id: parentRow.delivery_location_id,
        receiver_name: parentRow.receiver_name,
        receiver_phone: parentRow.receiver_phone,
        agreed_price: childPrice,
        status: parentRow.status === 'READY_FOR_PLANNING' ? 'READY_FOR_PLANNING' : 'CONFIRMED',
        source: parentRow.source || 'Direct',
        responsible_dispatcher_id: dispatcherId,
        created_by: dispatcherId,
        requested_pickup_date: parentRow.requested_pickup_date || null,
        truck_type_requested: childVehicle,
        loading_request: parentRow.loading_request || 'NO',
        warehouse_type: parentRow.warehouse_type || 'ALS warehouse',
        customer_agrees_to_grouping: false,
        document_status: parentRow.document_status || 'Approved',
        is_closed: false,
        waiting_too_long: false,
        late_risk: false,
        ready_for_planning_at: nowDate,
        updated_at: nowDate
      };

      let newChildRow;
      try {
        newChildRow = await prisma.orders.create({ data: childOrderPayload });
      } catch (insertChildErr) {
        console.error('splitOrder insert child error:', insertChildErr);
        continue;
      }

      const newChild = serializeOrderRow(newChildRow);
      await saveOrderMeta(newChild.id, childMeta);

      // Thêm cargo cho đơn con
      await prisma.order_cargos.create({
        data: {
          order_id: newChildRow.id,
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
        }
      });

      // Thêm ghi chú
      await prisma.order_notes.create({
        data: {
          order_id: newChildRow.id,
          content: `Đơn con tách từ ${parentOrder.order_code} cho xe ${childVehicle}. Lý do: ${reason || 'Yêu cầu xe nhỏ'}`,
          created_by: dispatcherId
        }
      });

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
    await prisma.orders.update({
      where: { id: parentRow.id },
      data: {
        status: 'CANCELLED',
        cancellation_reason: `Đã tách thành ${createdChildOrders.length} đơn con cho nhiều xe nhỏ: ${childCodesStr}. Lý do: ${reason || 'Cung đường hẹp/yêu cầu xe nhỏ'}`,
        updated_at: nowDate
      }
    });

    await saveOrderMeta(parentOrder.id, {
      ...parentMeta,
      split_into_orders: createdChildOrders.map(c => ({ id: c.id, order_code: c.order_code })),
      cancelled_at: nowIso,
      cancel_reason: `Đã tách thành ${createdChildOrders.length} đơn xe nhỏ: ${childCodesStr}`
    }, dispatcherId);

    await prisma.order_notes.create({
      data: {
        order_id: parentRow.id,
        content: `[TÁCH ĐƠN THÀNH CÔNG] Đơn này đã được chia thành ${createdChildOrders.length} đơn con: ${childCodesStr} để xếp vào các xe tải nhỏ hơn.`,
        created_by: dispatcherId
      }
    });

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
