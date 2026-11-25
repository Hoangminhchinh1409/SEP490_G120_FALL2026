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

// 10. ĐIỀU TÀI XẾ CHỞ HÀNG BỊ TỪ CHỐI VỀ KHO ALS
const redirectOrderToAlsWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      location_id,
      warehouse_name,
      close_immediately = false,
      note = ''
    } = req.body || {};

    const currentOrder = await prisma.orders.findFirst({
      where: buildOrderWhere(id)
    });
    if (!currentOrder) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // 1. Tìm kho ALS đích trong bảng locations
    let targetLoc = null;
    if (location_id && !isNaN(Number(location_id))) {
      targetLoc = await prisma.locations.findUnique({
        where: { id: BigInt(Number(location_id)) }
      });
    }
    if (!targetLoc && warehouse_name && String(warehouse_name).trim()) {
      targetLoc = await prisma.locations.findFirst({
        where: {
          OR: [
            { name: { contains: String(warehouse_name).trim(), mode: 'insensitive' } },
            { address: { contains: String(warehouse_name).trim(), mode: 'insensitive' } }
          ]
        }
      });
    }
    if (!targetLoc) {
      targetLoc = await prisma.locations.findFirst({
        where: { customer_id: null },
        orderBy: { id: 'asc' }
      });
    }

    const resolvedLocId = targetLoc ? targetLoc.id : 1n;
    const resolvedWarehouseName =
      (warehouse_name && String(warehouse_name).trim()) ||
      targetLoc?.name ||
      targetLoc?.address ||
      'Nhà Ga Hàng Hóa ALS Nội Bài (ALSC)';
    const resolvedWarehouseAddress =
      targetLoc?.address || resolvedWarehouseName;

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const actorId = Number(req.user?.id || 3);

    // 2. Tìm chuyến xe đang gắn với đơn hàng này
    const orderStops = await prisma.trip_stops.findMany({
      where: { order_id: currentOrder.id },
      orderBy: { sequence: 'desc' }
    });
    const activeTripId = orderStops[0]?.trip_id || null;

    let createdReturnStop = null;
    let tripCompleted = false;

    if (close_immediately) {
      // Trường hợp xác nhận hàng đã hạ tại kho ALS (hoặc đơn Xuất khẩu đã ở sẵn tại kho ALS) -> Đóng đơn & giải phóng chuyến ngay
      await prisma.orders.update({
        where: { id: currentOrder.id },
        data: {
          status: 'DELIVERED_EXCEPTION',
          is_closed: true,
          warehouse_name: resolvedWarehouseName,
          updated_at: nowDate
        }
      });

      if (activeTripId) {
        await prisma.trip_stops.updateMany({
          where: { trip_id: activeTripId, order_id: currentOrder.id },
          data: { status: 'Done' }
        });
        const remainingStops = await prisma.trip_stops.count({
          where: { trip_id: activeTripId, status: { not: 'Done' } }
        });
        if (remainingStops === 0) {
          tripCompleted = true;
          await prisma.trips.update({
            where: { id: activeTripId },
            data: { status: 'Completed', updated_at: nowDate }
          });
          const tTrucks = await prisma.trip_trucks.findMany({
            where: { trip_id: activeTripId, released_time: null },
            select: { truck_id: true }
          });
          const truckIds = tTrucks.map((t) => t.truck_id).filter(Boolean);
          if (truckIds.length > 0) {
            await prisma.trucks.updateMany({
              where: { id: { in: truckIds } },
              data: { status: 'Available', updated_at: nowDate }
            });
          }
          const tDrivers = await prisma.trip_drivers.findMany({
            where: { trip_id: activeTripId, released_time: null },
            select: { driver_id: true }
          });
          const driverIds = tDrivers.map((d) => d.driver_id).filter(Boolean);
          if (driverIds.length > 0) {
            await prisma.driver_profiles.updateMany({
              where: { id: { in: driverIds } },
              data: { status: 'Active', last_trip_ended_at: nowDate, updated_at: nowDate }
            });
          }
        }
      }
    } else {
      // Thêm 1 điểm dừng mới (Return to ALS Warehouse) vào cuối chuyến xe để tài xế chở hàng về kho ALS
      await prisma.orders.update({
        where: { id: currentOrder.id },
        data: {
          status: 'DELIVERED_EXCEPTION',
          is_closed: false,
          warehouse_name: resolvedWarehouseName,
          updated_at: nowDate
        }
      });

      if (activeTripId) {
        const allTripStops = await prisma.trip_stops.findMany({
          where: { trip_id: activeTripId },
          orderBy: { sequence: 'asc' }
        });

        // Đánh dấu các điểm giao hàng cũ của đơn này đã Done để tài xế chuyển sang điểm dừng Kho ALS mới
        await prisma.trip_stops.updateMany({
          where: {
            trip_id: activeTripId,
            order_id: currentOrder.id,
            stop_type: { not: 'Return' }
          },
          data: { status: 'Done' }
        });

        const existingReturnStop = allTripStops.find(
          (s) =>
            s.order_id === currentOrder.id &&
            String(s.stop_type || '').toUpperCase() === 'RETURN'
        );

        if (existingReturnStop) {
          const updStop = await prisma.trip_stops.update({
            where: { id: existingReturnStop.id },
            data: {
              location_id: resolvedLocId,
              status: existingReturnStop.status === 'Done' ? 'Pending' : existingReturnStop.status
            }
          });
          createdReturnStop = serializePrisma(updStop);
        } else {
          const maxSeq = allTripStops.reduce(
            (max, s) => Math.max(max, Number(s.sequence) || 0),
            0
          );
          const newStop = await prisma.trip_stops.create({
            data: {
              trip_id: activeTripId,
              order_id: currentOrder.id,
              sequence: maxSeq + 1,
              stop_type: 'Return',
              location_id: resolvedLocId,
              planned_arrival: new Date(Date.now() + 30 * 60000),
              status: 'Pending'
            }
          });
          createdReturnStop = serializePrisma(newStop);
        }

        // Đảm bảo chuyến xe đang ở trạng thái In Progress
        await prisma.trips.update({
          where: { id: activeTripId },
          data: { status: 'In Progress', updated_at: nowDate }
        });

        // Gửi thông báo cho tài xế trên chuyến xe
        try {
          const driverModel = require('../../models/driverModel');
          const tripDrivers = await prisma.trip_drivers.findMany({
            where: { trip_id: activeTripId, released_time: null },
            include: { driver_profiles: true }
          });
          for (const td of tripDrivers) {
            const driverUserId = td.driver_profiles?.user_account_id;
            if (driverUserId) {
              await driverModel.createSystemNotification({
                userAccountId: Number(driverUserId),
                targetType: 'TRIP',
                targetId: Number(activeTripId),
                message: `Điều phối viên đã điều chuyến chở hàng hoàn đơn ${currentOrder.order_code} về ${resolvedWarehouseName}. Hãy di chuyển tới kho ALS để hạ hàng!`
              });
            }
          }
        } catch (notifErr) {
          console.warn('redirectOrderToAlsWarehouse notify driver warning:', notifErr.message);
        }
      }
    }

    // Lưu ghi chú & metadata
    try {
      await prisma.order_notes.create({
        data: {
          order_id: currentOrder.id,
          content: close_immediately
            ? `[XÁC NHẬN LƯU KHO ALS & ĐÓNG ĐƠN] Hàng ngoại lệ đã được lưu giữ tại ${resolvedWarehouseName}. ${note ? `Ghi chú: ${note}` : ''}`
            : `[ĐIỀU VỀ KHO ALS] Đã thêm điểm dừng điều tài xế chở hàng bị từ chối về ${resolvedWarehouseName} (${resolvedWarehouseAddress}). ${note ? `Ghi chú: ${note}` : ''}`,
          created_by: BigInt(actorId)
        }
      });
    } catch (nErr) {
      console.warn('redirectOrderToAlsWarehouse order_notes warning:', nErr.message);
    }

    await saveOrderMeta(Number(currentOrder.id), {
      warehouse_name: resolvedWarehouseName,
      redirected_to_warehouse: true,
      redirected_at: nowIso,
      ...(close_immediately ? { closed_at: nowIso } : {})
    }, actorId);

    const freshRow = await prisma.orders.findUnique({ where: { id: currentOrder.id } });
    const updatedOrder = serializeOrderRow(freshRow);

    return res.json({
      success: true,
      message: close_immediately
        ? `Đã xác nhận hạ hàng lưu giữ tại ${resolvedWarehouseName} và đóng đơn ${currentOrder.order_code} thành công!`
        : `Đã điều tài xế chở hàng đơn ${currentOrder.order_code} về ${resolvedWarehouseName}. Điểm dừng mới đã được thêm vào lộ trình tài xế!`,
      order: {
        ...updatedOrder,
        status: close_immediately ? 'CLOSED' : 'DELIVERED_EXCEPTION',
        raw_status: 'DELIVERED_EXCEPTION',
        is_closed: Boolean(close_immediately),
        warehouse_name: resolvedWarehouseName,
        redirected_to_warehouse: true
      },
      return_stop: createdReturnStop,
      trip_completed: tripCompleted
    });
  } catch (err) {
    console.error('redirectOrderToAlsWarehouse Exception:', err);
    return res.status(500).json({ message: 'Lỗi khi điều hướng đơn hàng về kho ALS', error: err.message });
  }
};


// 10. LẤY DANH SÁCH PHỤ PHÍ TÀI XẾ ĐỀ XUẤT CHO DISPATCHER (BUG-ITD-07)
const getExtraFeesForDispatcher = async (req, res) => {
  try {
    const { status } = req.query || {};
    const whereClause = {};
    if (status) {
      whereClause.status = String(status);
    }

    const fees = await prisma.extra_fees.findMany({
      where: whereClause,
      include: {
        orders: {
          select: {
            id: true,
            order_code: true,
            customers: { select: { company_name: true } }
          }
        },
        trips: {
          select: {
            id: true,
            trip_code: true
          }
        },
        users_extra_fees_recorded_byTousers: {
          select: {
            id: true,
            full_name: true,
            username: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const formatted = (fees || []).map((f) => ({
      id: Number(f.id),
      order_id: f.order_id ? Number(f.order_id) : null,
      order_code: f.orders?.order_code || null,
      customer_name: f.orders?.customers?.company_name || null,
      trip_id: f.trip_id ? Number(f.trip_id) : null,
      trip_code: f.trips?.trip_code || null,
      fee_type: f.fee_type,
      amount: Number(f.amount || 0),
      reason: f.reason || '',
      photo_url: f.photo_url || null,
      status: f.status || 'Proposed',
      source: f.source || 'Driver',
      recorded_by: f.recorded_by ? Number(f.recorded_by) : null,
      driver_name: f.users_extra_fees_recorded_byTousers?.full_name || f.users_extra_fees_recorded_byTousers?.username || null,
      created_at: f.created_at ? new Date(f.created_at).toISOString() : null
    }));

    return res.json({ extra_fees: formatted });
  } catch (err) {
    console.error('getExtraFeesForDispatcher Exception:', err);
    return res.status(500).json({ message: 'Lỗi khi tải danh sách phụ phí', error: err.message });
  }
};

// 11. DISPATCHER XÁC NHẬN HOẶC TỪ CHỐI PHỤ PHÍ ĐỀ XUẤT (BUG-ITD-07)
const reviewExtraFee = async (req, res) => {
  try {
    const { id } = req.params;
    const feeIdStr = String(id || '').trim();
    if (!/^\d+$/.test(feeIdStr)) {
      return res.status(400).json({ message: 'Mã phụ phí không hợp lệ' });
    }
    const feeId = BigInt(feeIdStr);

    const { action, status: requestedStatus, note } = req.body || {};
    const decisionRaw = String(action || requestedStatus || '').trim().toUpperCase();
    let targetStatus = null;
    if (['CONFIRM', 'CONFIRMED', 'APPROVE', 'APPROVED'].includes(decisionRaw)) {
      targetStatus = 'CONFIRMED';
    } else if (['REJECT', 'REJECTED', 'DENY'].includes(decisionRaw)) {
      targetStatus = 'REJECTED';
    } else {
      return res.status(400).json({ message: 'Hành động duyệt phụ phí không hợp lệ (CONFIRM hoặc REJECT)' });
    }

    const existing = await prisma.extra_fees.findUnique({ where: { id: feeId } });
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy khoản phụ phí cần duyệt' });
    }

    const actorId = BigInt(Number(req.user?.id || 22));
    const updated = await prisma.extra_fees.update({
      where: { id: feeId },
      data: {
        status: targetStatus,
        confirmed_by: actorId,
        confirmed_time: new Date(),
        ...(targetStatus === 'REJECTED' && note && String(note).trim()
          ? { reject_reason: String(note).trim() }
          : {}),
        ...(note && String(note).trim()
          ? { reason: `${existing.reason || ''} [Điều phối ghi chú: ${String(note).trim()}]`.trim() }
          : {})
      }
    });

    return res.json({
      message: targetStatus === 'CONFIRMED'
        ? 'Đã xác nhận khoản phụ phí và cộng vào tổng phụ phí đơn hàng!'
        : 'Đã từ chối khoản phụ phí đề xuất.',
      extra_fee: {
        id: Number(updated.id),
        order_id: updated.order_id ? Number(updated.order_id) : null,
        trip_id: updated.trip_id ? Number(updated.trip_id) : null,
        fee_type: updated.fee_type,
        amount: Number(updated.amount || 0),
        reason: updated.reason,
        photo_url: updated.photo_url,
        status: updated.status
      }
    });
  } catch (err) {
    console.error('reviewExtraFee Exception:', err);
    return res.status(500).json({ message: 'Lỗi khi xử lý duyệt phụ phí', error: err.message });
  }
};

module.exports = {
  redirectOrderToAlsWarehouse,
  getExtraFeesForDispatcher,
  reviewExtraFee
};
