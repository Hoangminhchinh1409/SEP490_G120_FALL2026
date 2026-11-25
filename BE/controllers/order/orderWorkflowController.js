const adminModel = require("../../models/adminModel");
const { getClientIp } = require("../../utils/ipHelper");
const prisma = require("../../config/prisma");
const { serializePrisma, formatDateOnly } = require("../../utils/prismaHelper");
const { saveOrderMeta } = require("../../services/orderHelperService");

const buildOrderWhere = (idParam) => {
  const clean = String(idParam || "").trim();
  return /^\d+$/.test(clean) ? { id: BigInt(clean) } : { order_code: clean };
};

const serializeOrderRow = (row) => {
  if (!row) return null;
  const serialized = serializePrisma(row);
  if (row.requested_pickup_date) {
    serialized.requested_pickup_date = formatDateOnly(
      row.requested_pickup_date,
    );
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
      where: buildOrderWhere(id),
    });
    if (!currentOrder) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const upperSt = (currentOrder.status || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const forbiddenConfirmStatuses = [
      'CANCELLED',
      'CLOSED',
      'ASSIGNED',
      'ACCEPTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERED',
      'DELIVERED_EXCEPTION',
      'HANDED_OVER_VENDOR',
      'HANDED_OVER_TO_VENDOR'
    ];
    if (forbiddenConfirmStatuses.includes(upperSt)) {
      return res.status(400).json({
        message: `Không thể xác nhận đơn hàng đang ở trạng thái ${currentOrder.status}`
      });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const updates = {
      status: "READY_FOR_PLANNING",
      document_status: "APPROVED",
      ready_for_planning_at: nowDate,
      updated_at: nowDate,
      waiting_too_long: false,
    };

    if (agreed_price && parseInt(agreed_price, 10) > 0) {
      updates.agreed_price = parseInt(agreed_price, 10);
    }

    const resUpdate = await prisma.orders.updateMany({
      where: {
        id: currentOrder.id,
        status: { notIn: ["CANCELLED", "CLOSED"] },
      },
      data: updates,
    });

    if (resUpdate.count === 0) {
      return res.status(400).json({
        message: "Không thể xác nhận đơn hàng đã bị hủy hoặc đã đóng",
      });
    }

    const updatedRow = await prisma.orders.findUnique({
      where: { id: currentOrder.id },
    });
    const updatedOrder = serializeOrderRow(updatedRow);
    if (updatedOrder?.id) {
      await saveOrderMeta(
        updatedOrder.id,
        {
          docs_confirmed_at: nowIso,
          docs_confirmed_by: req.user?.id || 3,
        },
        req.user?.id || 3,
      );
    }

    return res.json({
      message: "Đã xác nhận đơn hàng thành công! Đơn đã sẵn sàng để xếp xe.",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("confirmOrder Exception:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 6. GÁN XE VÀ TÀI XẾ CHO ĐƠN HÀNG (CHUYỂN SANG ASSIGNED)
const assignTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await prisma.orders.findFirst({
      where: { ...buildOrderWhere(id), status: "READY_FOR_PLANNING" },
      select: { id: true },
    });

    let updatedOrder;
    if (found) {
      const updatedRow = await prisma.orders.update({
        where: { id: found.id },
        data: {
          status: "ASSIGNED",
          updated_at: new Date(),
        },
      });
      updatedOrder = serializeOrderRow(updatedRow);
    }

    return res.json({ message: "Đã gán xe thành công!", order: updatedOrder });
  } catch (err) {
    console.error("assignTrip Exception:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 7. HỦY ĐƠN HÀNG (CHUYỂN SANG CANCELLED, BR-17, BR-43, IT-ORD-008, IT-ORD-009)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason, cancellation_fee, cancel_fee } =
      req.body || {};
    const rawCancelFee =
      cancellation_fee !== undefined && cancellation_fee !== null
        ? cancellation_fee
        : cancel_fee;

    if (!cancellation_reason || !String(cancellation_reason).trim()) {
      return res
        .status(400)
        .json({ message: "Lý do hủy đơn hàng là bắt buộc" });
    }

    if (rawCancelFee !== undefined && rawCancelFee !== null) {
      const fee = parseInt(rawCancelFee, 10);
      if (isNaN(fee) || fee < 0) {
        return res
          .status(400)
          .json({ message: "Phí hủy không hợp lệ (phải >= 0)" });
      }
    }

    // 1. Tìm đơn hàng hiện tại để kiểm tra trạng thái hủy
    const currentOrder = await prisma.orders.findFirst({
      where: buildOrderWhere(id),
    });
    if (!currentOrder) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy đơn hàng cần hủy" });
    }

    const upperSt = String(currentOrder.status || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    // BR-17 / Figure 20: Chỉ được hủy đơn trước khi hàng được bốc lên xe (DRAFT, CONFIRMED, READY_FOR_PLANNING, ASSIGNED, ACCEPTED).
    const blockedStatuses = [
      "PICKED_UP",
      "IN_TRANSIT",
      "IN_PROGRESS",
      "HANDED_OVER_VENDOR",
      "HANDED_OVER_TO_VENDOR",
      "DELIVERED",
      "DELIVERED_EXCEPTION",
      "CANCELLED",
      "CLOSED",
    ];
    if (blockedStatuses.includes(upperSt)) {
      return res.status(400).json({
        message:
          "Không thể hủy đơn hàng sau khi hàng đã được bốc xếp hoặc đã chốt hoàn tất!",
      });
    }

    // Kiểm tra thêm ở bảng trip_stops: nếu tài xế đã ghi nhận bốc/lấy hàng (Loading Started / Loading Done / Completed) hoặc chuyến đã In Progress -> cấm hủy
    const orderStops = await prisma.trip_stops.findMany({
      where: { order_id: currentOrder.id },
      include: { trips: { select: { id: true, status: true } } },
    });
    const hasLoadedStop = (orderStops || []).some((s) => {
      const sSt = String(s.status || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
      const tSt = String(s.trips?.status || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
      const isPickupLoaded =
        s.stop_type === "Pickup" &&
        ["LOADING_STARTED", "LOADING_DONE", "LEFT", "COMPLETED"].includes(sSt);
      const isTripInTransit = ["IN_PROGRESS", "IN_TRANSIT"].includes(tSt);
      return isPickupLoaded || isTripInTransit;
    });
    if (hasLoadedStop) {
      return res.status(400).json({
        message:
          "Không thể hủy đơn hàng sau khi tài xế đã bắt đầu bốc xếp hoặc hàng đã lên xe!",
      });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const feeVal =
      rawCancelFee !== undefined && rawCancelFee !== null
        ? parseInt(rawCancelFee, 10)
        : 0;
    const actorId = Number(req.user?.id || 3);
    const updates = {
      status: "CANCELLED",
      cancellation_reason: cancellation_reason.trim(),
      cancellation_fee: feeVal,
      updated_at: nowDate,
    };

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updRes = await tx.orders.updateMany({
        where: {
          id: currentOrder.id,
          status: currentOrder.status,
        },
        data: updates,
      });
      const freshOrder =
        updRes.count > 0
          ? await tx.orders.findUnique({ where: { id: currentOrder.id } })
          : currentOrder;

      // Ghi order_notes
      await tx.order_notes.create({
        data: {
          order_id: currentOrder.id,
          content: `[ĐƠN HÀNG ĐÃ HỦY] Lý do: ${cancellation_reason.trim()}. Phí hủy: ${feeVal.toLocaleString("vi-VN")} VNĐ.`,
          created_by: actorId,
        },
      });

      // BR-43 / IT-ORD-008: Nếu đơn đã được gán chuyến (ASSIGNED) -> Hủy chuyến liên quan và giải phóng xe về AVAILABLE
      const relatedStops = await tx.trip_stops.findMany({
        where: { order_id: currentOrder.id },
        select: { trip_id: true },
      });

      const tripIds = [
        ...new Set((relatedStops || []).map((s) => s.trip_id).filter(Boolean)),
      ];
      for (const tId of tripIds) {
        await tx.trips.updateMany({
          where: { id: tId },
          data: { status: "Cancelled", updated_at: nowDate },
        });

        await tx.trip_status_history.create({
          data: {
            trip_id: tId,
            status: "Cancelled",
            changed_by: BigInt(actorId),
          },
        });

        const tripTrucks = await tx.trip_trucks.findMany({
          where: { trip_id: tId },
          select: { truck_id: true },
        });

        const truckIds = (tripTrucks || [])
          .map((tt) => tt.truck_id)
          .filter(Boolean);
        if (truckIds.length > 0) {
          await tx.trucks.updateMany({
            where: { id: { in: truckIds }, deleted_at: null },
            data: { status: "AVAILABLE", updated_at: nowDate },
          });
        }
      }

      return serializeOrderRow(freshOrder);
    });

    // Lưu metadata
    await saveOrderMeta(
      Number(currentOrder.id),
      {
        cancel_reason: cancellation_reason.trim(),
        cancel_fee: feeVal,
        cancelled_at: nowIso,
      },
      actorId,
    );

    return res.json({
      message: "Đã hủy đơn hàng thành công!",
      order: {
        ...updatedOrder,
        status: "CANCELLED",
        cancellation_reason: cancellation_reason.trim(),
        cancellation_fee: feeVal,
      },
    });
  } catch (err) {
    console.error("cancelOrder Exception:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 8. ĐÓNG ĐƠN HÀNG (CHUYỂN SANG CLOSED)
const closeOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra đơn hàng hiện tại
    const currentOrder = await prisma.orders.findFirst({
      where: buildOrderWhere(id),
    });
    if (!currentOrder) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy đơn hàng cần đóng" });
    }

    const upperSt = (currentOrder.status || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");
    if (!["DELIVERED", "DELIVERED_EXCEPTION", "CANCELLED"].includes(upperSt)) {
      return res.status(400).json({
        message:
          "Chỉ có thể đóng đơn hàng từ trạng thái DELIVERED, DELIVERED_EXCEPTION hoặc CANCELLED",
      });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const { warehouse_name } = req.body || {};

    const updData = {
      status:
        upperSt === "DELIVERED_EXCEPTION" ? "DELIVERED_EXCEPTION" : "CLOSED",
      is_closed: true,
      updated_at: nowDate,
    };
    if (warehouse_name && String(warehouse_name).trim()) {
      updData.warehouse_name = String(warehouse_name).trim();
    } else if (
      upperSt === "DELIVERED_EXCEPTION" &&
      !currentOrder.warehouse_name
    ) {
      updData.warehouse_name = "Nhà Ga Hàng Hóa ALS Nội Bài (ALSC)";
    }

    const updRes = await prisma.orders.updateMany({
      where: { id: currentOrder.id },
      data: updData,
    });
    if (!updRes || updRes.count === 0) {
      return res.status(500).json({ message: 'Không thể cập nhật trạng thái đóng đơn hàng' });
    }

    // Giải phóng chuyến xe, xe tải và tài xế nếu tất cả các điểm dừng của đơn này cần hoàn tất
    try {
      const relatedStops = await prisma.trip_stops.findMany({
        where: { order_id: currentOrder.id },
        select: { id: true, trip_id: true },
      });
      const tripIds = [
        ...new Set(relatedStops.map((s) => s.trip_id).filter(Boolean)),
      ];
      for (const tId of tripIds) {
        await prisma.trip_stops.updateMany({
          where: { trip_id: tId, order_id: currentOrder.id },
          data: { status: "Done" },
        });
        const remainingStops = await prisma.trip_stops.count({
          where: { trip_id: tId, status: { not: "Done" } },
        });
        if (remainingStops === 0) {
          await prisma.trips.update({
            where: { id: tId },
            data: { status: "Completed", updated_at: nowDate },
          });
          const tTrucks = await prisma.trip_trucks.findMany({
            where: { trip_id: tId, released_time: null },
            select: { truck_id: true },
          });
          const truckIds = tTrucks.map((t) => t.truck_id).filter(Boolean);
          if (truckIds.length > 0) {
            await prisma.trucks.updateMany({
              where: { id: { in: truckIds } },
              data: { status: "Available", updated_at: nowDate },
            });
          }
          const tDrivers = await prisma.trip_drivers.findMany({
            where: { trip_id: tId, released_time: null },
            select: { driver_id: true },
          });
          const driverIds = tDrivers.map((d) => d.driver_id).filter(Boolean);
          if (driverIds.length > 0) {
            await prisma.driver_profiles.updateMany({
              where: { id: { in: driverIds } },
              data: {
                status: "Active",
                last_trip_ended_at: nowDate,
                updated_at: nowDate,
              },
            });
          }
        }
      }
    } catch (tripCloseErr) {
      console.warn("closeOrder trip completion warning:", tripCloseErr.message);
    }

    const updatedRow =
      updRes.count > 0
        ? await prisma.orders.findUnique({ where: { id: currentOrder.id } })
        : null;
    const updatedOrder = serializeOrderRow(updatedRow);

    if (updatedOrder?.id) {
      await saveOrderMeta(
        updatedOrder.id,
        {
          closed_at: nowIso,
          ...(updData.warehouse_name
            ? { warehouse_name: updData.warehouse_name }
            : {}),
        },
        req.user?.id || 3,
      );
    }

    return res.json({
      message: "Đã đóng đơn hàng và giải phóng chuyến xe thành công!",
      order: updatedOrder || { id, status: "CLOSED", is_closed: true },
    });
  } catch (err) {
    console.error("closeOrder Exception:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 9. TÁCH ĐƠN HÀNG THÀNH NHIỀU ĐƠN NHỎ ĐỂ ĐI NHIỀU XE (PHÙ HỢP CUNG ĐƯỜNG HẸP / XE NHỎ)
const splitOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { splits, reason } = req.body;

    if (!Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({
        message: "Vui lòng cung cấp ít nhất 2 phân bổ xe con để tách đơn!",
      });
    }

    // 1. Tìm đơn hàng gốc
    const cleanId = (id || "").toString().trim();
    const parentRow = await prisma.orders.findFirst({
      where: buildOrderWhere(cleanId),
      include: {
        order_cargos: true,
        order_notes: true,
        customers: true,
      },
    });

    if (!parentRow) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy đơn hàng cần tách" });
    }

    const parentOrder = {
      ...serializeOrderRow(parentRow),
      customer: serializePrisma(parentRow.customers) || null,
    };

    if (
      [
        "CANCELLED",
        "CLOSED",
        "DELIVERED",
        "DELIVERED_EXCEPTION",
        "IN_TRANSIT",
        "PICKED_UP",
        "ACCEPTED",
        "HANDED_OVER_VENDOR",
        "HANDED_OVER_TO_VENDOR",
      ].includes(String(parentOrder.status || "").toUpperCase())
    ) {
      return res.status(400).json({
        message: `Không thể tách đơn hàng đang ở trạng thái "${parentOrder.status}". Chỉ được tách khi đơn chưa lăn bánh!`,
      });
    }

    const {
      parseOrderMeta,
      generateTrackingToken,
    } = require("../../services/orderHelperService");
    const parentMeta = parseOrderMeta(parentOrder);
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const dispatcherId = Number(
      req.user?.id || parentOrder.responsible_dispatcher_id || 3,
    );

    const baseCargo = Array.isArray(parentOrder.order_cargos)
      ? parentOrder.order_cargos[0] || {}
      : parentOrder.order_cargos || {};

    const createdChildOrders = [];

    // 2. Tạo từng đơn con tương ứng với mỗi xe nhỏ
    for (let index = 0; index < splits.length; index++) {
      const slice = splits[index];
      const childSuffix = index + 1;
      const childOrderCode = `${parentOrder.order_code}-${childSuffix}`;
      const childTrackingToken = generateTrackingToken();

      const childWeight =
        parseFloat(slice.weight_kg) ||
        Math.round(
          (baseCargo.actual_weight_kg || parentOrder.weight || 2500) /
            splits.length,
        );
      const childChargeable =
        parseFloat(slice.chargeable_weight_kg) || childWeight;
      const childPackages =
        parseInt(slice.package_count, 10) ||
        Math.max(
          1,
          Math.round(
            (baseCargo.quantity || parentOrder.package_count || 1) /
              splits.length,
          ),
        );
      const childVehicle = slice.vehicle_type || "TRUCK_2.5T";
      const childPrice =
        parseInt(slice.agreed_price, 10) ||
        Math.round((parentOrder.agreed_price || 0) / splits.length);

      // Meta con kế thừa từ đơn cha
      const childMeta = {
        ...parentMeta,
        parent_order_id: parentOrder.id,
        parent_order_code: parentOrder.order_code,
        split_index: childSuffix,
        split_total: splits.length,
        split_reason:
          reason ||
          "Khách hàng yêu cầu tách sang nhiều xe nhỏ theo cung đường kho hẹp",
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
          stage: parentMeta.web_workflow?.stage || "CUSTOMER_CONFIRMED",
          agreed_vehicle_type: childVehicle,
          proposed_vehicle_type: childVehicle,
          split_parent: parentOrder.order_code,
          split_info: `Xe ${childSuffix}/${splits.length} (${childVehicle})`,
        },
      };

      const childOrderPayload = {
        order_code: childOrderCode,
        order_type: parentRow.order_type || "Import",
        customer_id: parentRow.customer_id,
        tracking_token: childTrackingToken,
        pickup_location_id: parentRow.pickup_location_id,
        delivery_location_id: parentRow.delivery_location_id,
        receiver_name: parentRow.receiver_name,
        receiver_phone: parentRow.receiver_phone,
        agreed_price: childPrice,
        status:
          parentRow.status === "READY_FOR_PLANNING"
            ? "READY_FOR_PLANNING"
            : "CONFIRMED",
        source: parentRow.source || "Direct",
        responsible_dispatcher_id: dispatcherId,
        created_by: dispatcherId,
        requested_pickup_date: parentRow.requested_pickup_date || null,
        truck_type_requested: childVehicle,
        loading_request: parentRow.loading_request || "NO",
        warehouse_type: parentRow.warehouse_type || "ALS warehouse",
        customer_agrees_to_grouping: false,
        document_status: parentRow.document_status || "Approved",
        is_closed: false,
        waiting_too_long: false,
        late_risk: false,
        ready_for_planning_at: nowDate,
        updated_at: nowDate,
      };

      let newChildRow;
      try {
        newChildRow = await prisma.orders.create({ data: childOrderPayload });
      } catch (insertChildErr) {
        console.error("splitOrder insert child error:", insertChildErr);
        continue;
      }

      const newChild = serializeOrderRow(newChildRow);
      await saveOrderMeta(newChild.id, childMeta);

      // Thêm cargo cho đơn con
      await prisma.order_cargos.create({
        data: {
          order_id: newChildRow.id,
          cargo_type: baseCargo.cargo_type || "General",
          cargo_name: `${baseCargo.cargo_name || "Hàng hóa"} (Lô ${childSuffix}/${splits.length})`,
          quantity: childPackages,
          unit: baseCargo.unit || "Kiện",
          actual_weight_kg: childWeight,
          length_cm: baseCargo.length_cm || 0,
          width_cm: baseCargo.width_cm || 0,
          height_cm: baseCargo.height_cm || 0,
          stackable: true,
          chargeable_weight_kg: childChargeable,
          declared_value: baseCargo.declared_value
            ? Math.round(baseCargo.declared_value / splits.length)
            : 0,
          special_request_note: `Tách từ đơn gốc ${parentOrder.order_code} - Xe ${childSuffix}/${splits.length}`,
        },
      });

      // Thêm ghi chú
      await prisma.order_notes.create({
        data: {
          order_id: newChildRow.id,
          content: `Đơn con tách từ ${parentOrder.order_code} cho xe ${childVehicle}. Lý do: ${reason || "Yêu cầu xe nhỏ"}`,
          created_by: dispatcherId,
        },
      });

      createdChildOrders.push({
        ...newChild,
        order_id: newChild.order_code,
        cargo_name: `${baseCargo.cargo_name || "Hàng hóa"} (Xe ${childSuffix})`,
        weight: childWeight,
        vehicle_type_required: childVehicle,
        agreed_price: childPrice,
      });
    }

    // 3. Đánh dấu đơn gốc thành CANCELLED (hoặc ghi nhận đã tách sang các đơn con)
    const childCodesStr = createdChildOrders
      .map((c) => c.order_code)
      .join(", ");
    await prisma.orders.update({
      where: { id: parentRow.id },
      data: {
        status: "CANCELLED",
        cancellation_reason: `Đã tách thành ${createdChildOrders.length} đơn con cho nhiều xe nhỏ: ${childCodesStr}. Lý do: ${reason || "Cung đường hẹp/yêu cầu xe nhỏ"}`,
        updated_at: nowDate,
      },
    });

    await saveOrderMeta(
      parentOrder.id,
      {
        ...parentMeta,
        split_into_orders: createdChildOrders.map((c) => ({
          id: c.id,
          order_code: c.order_code,
        })),
        cancelled_at: nowIso,
        cancel_reason: `Đã tách thành ${createdChildOrders.length} đơn xe nhỏ: ${childCodesStr}`,
      },
      dispatcherId,
    );

    await prisma.order_notes.create({
      data: {
        order_id: parentRow.id,
        content: `[TÁCH ĐƠN THÀNH CÔNG] Đơn này đã được chia thành ${createdChildOrders.length} đơn con: ${childCodesStr} để xếp vào các xe tải nhỏ hơn.`,
        created_by: dispatcherId,
      },
    });

    return res.status(201).json({
      message: `Đã tách đơn hàng ${parentOrder.order_code} thành ${createdChildOrders.length} đơn con (${childCodesStr}) thành công! Mỗi đơn sẵn sàng xếp lên 1 xe riêng biệt.`,
      parent_order_code: parentOrder.order_code,
      child_orders: createdChildOrders,
    });
  } catch (err) {
    console.error("splitOrder Exception:", err);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
};

// 10. ĐIỀU TÀI XẾ CHỞ HÀNG BỊ TỪ CHỐI VỀ KHO ALS
const redirectOrderToAlsWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      location_id,
      warehouse_name,
      close_immediately = false,
      note = "",
    } = req.body || {};

    const currentOrder = await prisma.orders.findFirst({
      where: buildOrderWhere(id),
    });
    if (!currentOrder) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // 1. Tìm kho ALS đích trong bảng locations
    let targetLoc = null;
    if (location_id && !isNaN(Number(location_id))) {
      targetLoc = await prisma.locations.findUnique({
        where: { id: BigInt(Number(location_id)) },
      });
    }
    if (!targetLoc && warehouse_name && String(warehouse_name).trim()) {
      targetLoc = await prisma.locations.findFirst({
        where: {
          OR: [
            {
              name: {
                contains: String(warehouse_name).trim(),
                mode: "insensitive",
              },
            },
            {
              address: {
                contains: String(warehouse_name).trim(),
                mode: "insensitive",
              },
            },
          ],
        },
      });
    }
    if (!targetLoc) {
      targetLoc = await prisma.locations.findFirst({
        where: { customer_id: null },
        orderBy: { id: "asc" },
      });
    }

    const resolvedLocId = targetLoc ? targetLoc.id : 1n;
    const resolvedWarehouseName =
      (warehouse_name && String(warehouse_name).trim()) ||
      targetLoc?.name ||
      targetLoc?.address ||
      "Nhà Ga Hàng Hóa ALS Nội Bài (ALSC)";
    const resolvedWarehouseAddress =
      targetLoc?.address || resolvedWarehouseName;

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const actorId = Number(req.user?.id || 3);

    // 2. Tìm chuyến xe đang gắn với đơn hàng này
    const orderStops = await prisma.trip_stops.findMany({
      where: { order_id: currentOrder.id },
      orderBy: { sequence: "desc" },
    });
    const activeTripId = orderStops[0]?.trip_id || null;

    let createdReturnStop = null;
    let tripCompleted = false;

    if (close_immediately) {
      // Trường hợp xác nhận hàng đã hạ tại kho ALS (hoặc đơn Xuất khẩu đã ở sẵn tại kho ALS) -> Đóng đơn & giải phóng chuyến ngay
      await prisma.orders.update({
        where: { id: currentOrder.id },
        data: {
          status: "DELIVERED_EXCEPTION",
          is_closed: true,
          warehouse_name: resolvedWarehouseName,
          updated_at: nowDate,
        },
      });

      if (activeTripId) {
        await prisma.trip_stops.updateMany({
          where: { trip_id: activeTripId, order_id: currentOrder.id },
          data: { status: "Done" },
        });
        const remainingStops = await prisma.trip_stops.count({
          where: { trip_id: activeTripId, status: { not: "Done" } },
        });
        if (remainingStops === 0) {
          tripCompleted = true;
          await prisma.trips.update({
            where: { id: activeTripId },
            data: { status: "Completed", updated_at: nowDate },
          });
          const tTrucks = await prisma.trip_trucks.findMany({
            where: { trip_id: activeTripId, released_time: null },
            select: { truck_id: true },
          });
          const truckIds = tTrucks.map((t) => t.truck_id).filter(Boolean);
          if (truckIds.length > 0) {
            await prisma.trucks.updateMany({
              where: { id: { in: truckIds } },
              data: { status: "Available", updated_at: nowDate },
            });
          }
          const tDrivers = await prisma.trip_drivers.findMany({
            where: { trip_id: activeTripId, released_time: null },
            select: { driver_id: true },
          });
          const driverIds = tDrivers.map((d) => d.driver_id).filter(Boolean);
          if (driverIds.length > 0) {
            await prisma.driver_profiles.updateMany({
              where: { id: { in: driverIds } },
              data: {
                status: "Active",
                last_trip_ended_at: nowDate,
                updated_at: nowDate,
              },
            });
          }
        }
      }
    } else {
      // Thêm 1 điểm dừng mới (Return to ALS Warehouse) vào cuối chuyến xe để tài xế chở hàng về kho ALS
      await prisma.orders.update({
        where: { id: currentOrder.id },
        data: {
          status: "DELIVERED_EXCEPTION",
          is_closed: false,
          warehouse_name: resolvedWarehouseName,
          updated_at: nowDate,
        },
      });

      if (activeTripId) {
        const allTripStops = await prisma.trip_stops.findMany({
          where: { trip_id: activeTripId },
          orderBy: { sequence: "asc" },
        });

        // Đánh dấu các điểm giao hàng cũ của đơn này đã Done để tài xế chuyển sang điểm dừng Kho ALS mới
        await prisma.trip_stops.updateMany({
          where: {
            trip_id: activeTripId,
            order_id: currentOrder.id,
            stop_type: { not: "Return" },
          },
          data: { status: "Done" },
        });

        const existingReturnStop = allTripStops.find(
          (s) =>
            s.order_id === currentOrder.id &&
            String(s.stop_type || "").toUpperCase() === "RETURN",
        );

        if (existingReturnStop) {
          const updStop = await prisma.trip_stops.update({
            where: { id: existingReturnStop.id },
            data: {
              location_id: resolvedLocId,
              status:
                existingReturnStop.status === "Done"
                  ? "Pending"
                  : existingReturnStop.status,
            },
          });
          createdReturnStop = serializePrisma(updStop);
        } else {
          const maxSeq = allTripStops.reduce(
            (max, s) => Math.max(max, Number(s.sequence) || 0),
            0,
          );
          const newStop = await prisma.trip_stops.create({
            data: {
              trip_id: activeTripId,
              order_id: currentOrder.id,
              sequence: maxSeq + 1,
              stop_type: "Return",
              location_id: resolvedLocId,
              planned_arrival: new Date(Date.now() + 30 * 60000),
              status: "Pending",
            },
          });
          createdReturnStop = serializePrisma(newStop);
        }

        // Đảm bảo chuyến xe đang ở trạng thái In Progress
        await prisma.trips.update({
          where: { id: activeTripId },
          data: { status: "In Progress", updated_at: nowDate },
        });

        // Gửi thông báo cho tài xế trên chuyến xe
        try {
          const driverModel = require("../../models/driverModel");
          const tripDrivers = await prisma.trip_drivers.findMany({
            where: { trip_id: activeTripId, released_time: null },
            include: { driver_profiles: true },
          });
          for (const td of tripDrivers) {
            const driverUserId = td.driver_profiles?.user_account_id;
            if (driverUserId) {
              await driverModel.createSystemNotification({
                userAccountId: Number(driverUserId),
                targetType: "TRIP",
                targetId: Number(activeTripId),
                message: `Điều phối viên đã điều chuyến chở hàng hoàn đơn ${currentOrder.order_code} về ${resolvedWarehouseName}. Hãy di chuyển tới kho ALS để hạ hàng!`,
              });
            }
          }
        } catch (notifErr) {
          console.warn(
            "redirectOrderToAlsWarehouse notify driver warning:",
            notifErr.message,
          );
        }
      }
    }

    // Lưu ghi chú & metadata
    try {
      await prisma.order_notes.create({
        data: {
          order_id: currentOrder.id,
          content: close_immediately
            ? `[XÁC NHẬN LƯU KHO ALS & ĐÓNG ĐƠN] Hàng ngoại lệ đã được lưu giữ tại ${resolvedWarehouseName}. ${note ? `Ghi chú: ${note}` : ""}`
            : `[ĐIỀU VỀ KHO ALS] Đã thêm điểm dừng điều tài xế chở hàng bị từ chối về ${resolvedWarehouseName} (${resolvedWarehouseAddress}). ${note ? `Ghi chú: ${note}` : ""}`,
          created_by: BigInt(actorId),
        },
      });
    } catch (nErr) {
      console.warn(
        "redirectOrderToAlsWarehouse order_notes warning:",
        nErr.message,
      );
    }

    await saveOrderMeta(
      Number(currentOrder.id),
      {
        warehouse_name: resolvedWarehouseName,
        redirected_to_warehouse: true,
        redirected_at: nowIso,
        ...(close_immediately ? { closed_at: nowIso } : {}),
      },
      actorId,
    );

    const freshRow = await prisma.orders.findUnique({
      where: { id: currentOrder.id },
    });
    const updatedOrder = serializeOrderRow(freshRow);

    return res.json({
      success: true,
      message: close_immediately
        ? `Đã xác nhận hạ hàng lưu giữ tại ${resolvedWarehouseName} và đóng đơn ${currentOrder.order_code} thành công!`
        : `Đã điều tài xế chở hàng đơn ${currentOrder.order_code} về ${resolvedWarehouseName}. Điểm dừng mới đã được thêm vào lộ trình tài xế!`,
      order: {
        ...updatedOrder,
        status: close_immediately ? "CLOSED" : "DELIVERED_EXCEPTION",
        raw_status: "DELIVERED_EXCEPTION",
        is_closed: Boolean(close_immediately),
        warehouse_name: resolvedWarehouseName,
        redirected_to_warehouse: true,
      },
      return_stop: createdReturnStop,
      trip_completed: tripCompleted,
    });
  } catch (err) {
    console.error("redirectOrderToAlsWarehouse Exception:", err);
    return res.status(500).json({
      message: "Lỗi khi điều hướng đơn hàng về kho ALS",
      error: err.message,
    });
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
            customers: { select: { company_name: true } },
          },
        },
        trips: {
          select: {
            id: true,
            trip_code: true,
          },
        },
        users_extra_fees_recorded_byTousers: {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
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
      reason: f.reason || "",
      photo_url: f.photo_url || null,
      status: f.status || "Proposed",
      source: f.source || "Driver",
      recorded_by: f.recorded_by ? Number(f.recorded_by) : null,
      driver_name:
        f.users_extra_fees_recorded_byTousers?.full_name ||
        f.users_extra_fees_recorded_byTousers?.username ||
        null,
      created_at: f.created_at ? new Date(f.created_at).toISOString() : null,
    }));

    return res.json({ extra_fees: formatted });
  } catch (err) {
    console.error("getExtraFeesForDispatcher Exception:", err);
    return res
      .status(500)
      .json({ message: "Lỗi khi tải danh sách phụ phí", error: err.message });
  }
};

// 11. DISPATCHER XÁC NHẬN HOẶC TỪ CHỐI PHỤ PHÍ ĐỀ XUẤT (BUG-ITD-07)
const reviewExtraFee = async (req, res) => {
  try {
    const { id } = req.params;
    const feeIdStr = String(id || "").trim();
    if (!/^\d+$/.test(feeIdStr)) {
      return res.status(400).json({ message: "Mã phụ phí không hợp lệ" });
    }
    const feeId = BigInt(feeIdStr);

    const { action, status: requestedStatus, note } = req.body || {};
    const decisionRaw = String(action || requestedStatus || "")
      .trim()
      .toUpperCase();
    let targetStatus = null;
    if (["CONFIRM", "CONFIRMED", "APPROVE", "APPROVED"].includes(decisionRaw)) {
      targetStatus = "CONFIRMED";
    } else if (["REJECT", "REJECTED", "DENY"].includes(decisionRaw)) {
      targetStatus = "REJECTED";
    } else {
      return res.status(400).json({
        message: "Hành động duyệt phụ phí không hợp lệ (CONFIRM hoặc REJECT)",
      });
    }

    const existing = await prisma.extra_fees.findUnique({
      where: { id: feeId },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy khoản phụ phí cần duyệt" });
    }

    const actorId = BigInt(Number(req.user?.id || 22));
    const updated = await prisma.extra_fees.update({
      where: { id: feeId },
      data: {
        status: targetStatus,
        confirmed_by: actorId,
        confirmed_time: new Date(),
        ...(targetStatus === "REJECTED" && note && String(note).trim()
          ? { reject_reason: String(note).trim() }
          : {}),
        ...(note && String(note).trim()
          ? {
              reason:
                `${existing.reason || ""} [Điều phối ghi chú: ${String(note).trim()}]`.trim(),
            }
          : {}),
      },
    });

    return res.json({
      message:
        targetStatus === "CONFIRMED"
          ? "Đã xác nhận khoản phụ phí và cộng vào tổng phụ phí đơn hàng!"
          : "Đã từ chối khoản phụ phí đề xuất.",
      extra_fee: {
        id: Number(updated.id),
        order_id: updated.order_id ? Number(updated.order_id) : null,
        trip_id: updated.trip_id ? Number(updated.trip_id) : null,
        fee_type: updated.fee_type,
        amount: Number(updated.amount || 0),
        reason: updated.reason,
        photo_url: updated.photo_url,
        status: updated.status,
      },
    });
  } catch (err) {
    console.error("reviewExtraFee Exception:", err);
    return res
      .status(500)
      .json({ message: "Lỗi khi xử lý duyệt phụ phí", error: err.message });
  }
};

module.exports = {
  confirmOrder,
  assignTrip,
  cancelOrder,
  closeOrder,
  splitOrder,
  redirectOrderToAlsWarehouse,
  getExtraFeesForDispatcher,
  reviewExtraFee,
};
