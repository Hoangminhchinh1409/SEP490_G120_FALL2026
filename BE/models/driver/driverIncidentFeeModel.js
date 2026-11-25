const prisma = require("../../config/prisma");
const { serializePrisma, toBigInt } = require("../../utils/prismaHelper");

// ==========================================
// 6. INCIDENTS (BF-04 & UC-32)
// ==========================================

const createIncident = async ({
  tripId,
  tripStopId = null,
  reportedBy,
  type = "Other",
  description,
  photos = null,
  incidentLat = null,
  incidentLng = null,
}) => {
  const now = new Date();
  const normalizedPhotos = Array.isArray(photos)
    ? photos.filter(Boolean)
    : typeof photos === "string" && photos.trim()
      ? [photos.trim()]
      : [];

  const created = await prisma.incidents.create({
    data: {
      trip_id: toBigInt(tripId),
      trip_stop_id: toBigInt(tripStopId),
      reported_by: toBigInt(reportedBy),
      type,
      status: "Reported",
      description: String(description || "").slice(0, 500),
      photos: normalizedPhotos,
      reported_time: now,
      created_at: now,
      updated_at: now,
    },
    select: {
      id: true,
      trip_id: true,
      trip_stop_id: true,
      type: true,
      description: true,
      photos: true,
      fault: true,
      status: true,
      reported_by: true,
      reported_time: true,
      created_at: true,
      updated_at: true,
    },
  });
  return {
    ...serializePrisma(created),
    incident_lat: incidentLat !== null && incidentLat !== undefined ? Number(incidentLat) : null,
    incident_lng: incidentLng !== null && incidentLng !== undefined ? Number(incidentLng) : null,
  };
};

// ==========================================
// 9. CUSTOMER REFUSAL (BR-57)
// ==========================================

const updateOrderRefusal = async (orderId, { reason, photoUrl, changedBy = null }) => {
  const bigOrderId = toBigInt(orderId);
  const updated = await prisma.orders.update({
    where: { id: bigOrderId },
    data: {
      status: "DELIVERED_EXCEPTION",
      is_closed: false,
      refusal_reason: reason,
      refusal_photo: photoUrl,
      updated_at: new Date(),
    },
    select: {
      id: true,
      order_code: true,
      status: true,
      is_closed: true,
      refusal_reason: true,
      refusal_photo: true,
    },
  });

  try {
    await prisma.order_status_history.create({
      data: {
        order_id: bigOrderId,
        status: "DELIVERED_EXCEPTION",
        changed_by: toBigInt(changedBy),
      },
    });
  } catch (hErr) {
    console.warn("order_status_history insert warning:", hErr.message);
  }

  return serializePrisma(updated);
};

const closeRefusedOrderAtWarehouse = async (
  orderId,
  { warehouseName = "Kho ALS", changedBy = null } = {}
) => {
  const bigOrderId = toBigInt(orderId);
  const now = new Date();
  const updated = await prisma.orders.update({
    where: { id: bigOrderId },
    data: {
      status: "DELIVERED_EXCEPTION",
      is_closed: true,
      warehouse_name: warehouseName,
      updated_at: now,
    },
    select: {
      id: true,
      order_code: true,
      status: true,
      is_closed: true,
      warehouse_name: true,
      refusal_reason: true,
      refusal_photo: true,
    },
  });

  try {
    await prisma.order_notes.create({
      data: {
        order_id: bigOrderId,
        content: `[ĐÃ HẠ HÀNG HOÀN VỀ KHO ALS & ĐÓNG ĐƠN] Hàng bị từ chối đã được dỡ xuống lưu giữ tại ${warehouseName}. Đơn hàng đã đóng.`,
        created_by: toBigInt(changedBy) || 1n,
      },
    });
  } catch (noteErr) {
    console.warn("closeRefusedOrderAtWarehouse order_notes warning:", noteErr.message);
  }

  return serializePrisma(updated);
};

// ==========================================
// 10. EXTRA FEES (BR-30, MSG85)
// ==========================================

const createProposedExtraFee = async ({
  tripId,
  orderId = null,
  feeType,
  amount,
  reason,
  photoUrl,
  recordedBy,
}) => {
  const created = await prisma.extra_fees.create({
    data: {
      trip_id: toBigInt(tripId),
      order_id: toBigInt(orderId),
      fee_type: feeType,
      amount: BigInt(parseInt(amount, 10)),
      reason,
      photo_url: photoUrl,
      status: "Proposed",
      source: "Driver",
      suggested_by_system: false,
      recorded_by: toBigInt(recordedBy),
      created_at: new Date(),
    },
  });
  return serializePrisma(created);
};

module.exports = {
  createIncident,
  updateOrderRefusal,
  closeRefusedOrderAtWarehouse,
  createProposedExtraFee,
};
