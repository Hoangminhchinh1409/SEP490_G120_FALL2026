const prisma = require("../../config/prisma");
const { serializePrisma } = require("../../utils/prismaHelper");
const { parseOrderMeta } = require("../../services/orderHelperService");
const claimService = require("../../services/claimService");
const {
  orderRelationInclude,
  mapOrderWithRelations,
  INCIDENT_TYPE_LABELS,
  formatDisplayDateTime,
} = require("./orderQueryFormatter");

const resolveOrderIdFromIncidentToken = async (cleanToken) => {
  const incMatch = /^INC-(\d+)$/i.exec(cleanToken);
  if (!incMatch) return null;
  const incidentId = Number(incMatch[1]);
  if (!Number.isFinite(incidentId) || incidentId <= 0) return null;

  const claim = await prisma.compensation_claims.findFirst({
    where: {
      incident_id: BigInt(incidentId),
      order_id: { not: null },
    },
    orderBy: { id: "desc" },
    select: { order_id: true },
  });

  if (claim?.order_id) return Number(claim.order_id);

  const inc = await prisma.incidents.findUnique({
    where: { id: BigInt(incidentId) },
    select: { trip_id: true },
  });

  if (!inc?.trip_id) return null;

  const stop = await prisma.trip_stops.findFirst({
    where: {
      trip_id: inc.trip_id,
      order_id: { not: null },
    },
    select: { order_id: true },
  });

  return stop?.order_id ? Number(stop.order_id) : null;
};

const resolveOrderIncidentAndEvidences = async (order, extraMeta) => {
  let incidentInfo = null;
  let sealImage = null;
  let podImage = null;
  let eta = extraMeta?.eta || null;

  try {
    const orderIdBigInt = BigInt(order.id);
    const [stopsRaw, claimsRaw, evidencesRaw] = await Promise.all([
      prisma.trip_stops.findMany({
        where: { order_id: orderIdBigInt },
        select: {
          id: true,
          trip_id: true,
          stop_type: true,
          planned_arrival: true,
          actual_arrival: true,
        },
      }),
      prisma.compensation_claims.findMany({
        where: { order_id: orderIdBigInt },
        orderBy: { id: "desc" },
        take: 1,
      }),
      prisma.delivery_evidences.findMany({
        where: { order_id: orderIdBigInt },
        orderBy: { id: "desc" },
        select: {
          id: true,
          type: true,
          file_link: true,
          seal_number: true,
          receiver_name: true,
          captured_time: true,
        },
      }),
    ]);

    const stops = serializePrisma(stopsRaw) || [];
    const claimRow = serializePrisma(claimsRaw?.[0]) || null;
    const evidences = serializePrisma(evidencesRaw) || [];

    evidences.forEach((ev) => {
      const evType = String(ev.type || "").toUpperCase();
      if (evType === "SEAL" && !sealImage && ev.file_link) {
        sealImage = ev.file_link;
      }
      if ((evType === "POD" || evType === "DELIVERY") && !podImage && ev.file_link) {
        podImage = ev.file_link;
      }
    });

    if (!eta && stops.length > 0) {
      const deliveryStop =
        stops.find((s) => String(s.stop_type || "").toUpperCase() === "DELIVERY") ||
        stops[stops.length - 1];
      eta = formatDisplayDateTime(
        deliveryStop?.actual_arrival || deliveryStop?.planned_arrival,
      );
    }

    let incidentRow = null;
    if (claimRow?.incident_id) {
      const incByClaim = await prisma.incidents.findUnique({
        where: { id: BigInt(claimRow.incident_id) },
      });
      incidentRow = serializePrisma(incByClaim) || null;
    }

    if (!incidentRow) {
      const tripIds = [...new Set(stops.map((s) => s.trip_id).filter(Boolean))];
      if (tripIds.length > 0) {
        const incByTrip = await prisma.incidents.findMany({
          where: { trip_id: { in: tripIds.map((tId) => BigInt(tId)) } },
          orderBy: { id: "desc" },
          take: 1,
        });
        incidentRow = serializePrisma(incByTrip?.[0]) || null;
      }
    }

    const incidentId = incidentRow?.id || claimRow?.incident_id || null;
    if (incidentRow || claimRow) {
      let incLogs = [];
      if (incidentId) {
        const logsRaw = await prisma.activity_logs.findMany({
          where: {
            target_type: "INCIDENT",
            target_id: BigInt(incidentId),
          },
          select: {
            action: true,
            changes: true,
            reason: true,
            created_time: true,
          },
          orderBy: { id: "desc" },
          take: 10,
        });
        incLogs = serializePrisma(logsRaw) || [];
      }

      const closeLog = incLogs.find(
        (l) =>
          l.action === "CLOSE_INCIDENT_CASE_DONE" ||
          l.action === "RECORD_INCIDENT_PAYMENT",
      );
      const approveLog = incLogs.find((l) => l.action === "APPROVE_INCIDENT_COMPENSATION");
      const rejectLog = incLogs.find((l) => l.action === "REJECT_INCIDENT_COMPENSATION");

      const rawStatusUpper = String(incidentRow?.status || "").toUpperCase();
      const claimStatusUpper = String(claimRow?.status || "").toUpperCase();

      const isRejected =
        claimStatusUpper === "REJECTED" ||
        Boolean(incidentRow?.rejection_reason) ||
        Boolean(rejectLog) ||
        rawStatusUpper === "REJECTED" ||
        Boolean(
          incidentRow?.resolution_note &&
            incidentRow.resolution_note.includes("Từ chối bồi thường"),
        );

      const isPaid =
        !isRejected &&
        (claimStatusUpper === "PAID" || rawStatusUpper === "PAID");

      const isDone =
        !isRejected &&
        !isPaid &&
        (claimStatusUpper === "CLOSED_COMPENSATED" ||
          (["DONE", "RESOLVED", "CLOSED"].includes(rawStatusUpper) &&
            claimStatusUpper !== "APPROVED" &&
            claimStatusUpper !== "PAID" &&
            claimStatusUpper !== "PENDING"));
      const isApproved =
        !isRejected &&
        !isDone &&
        !isPaid &&
        (rawStatusUpper === "APPROVED" ||
          claimStatusUpper === "APPROVED" ||
          Boolean(approveLog));

      const rawPaymentProofUrl =
        isPaid || isDone
          ? claimRow?.payment_proof_url ||
            incidentRow?.payment_proof_url ||
            closeLog?.changes?.payment_proof_url ||
            null
          : null;

      const txSourceText = `${closeLog?.changes?.close_note || ""} ${claimRow?.review_comment || ""} ${incidentRow?.resolution_note || ""}`;
      const txMatch = txSourceText.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
      const transactionCode =
        claimRow?.transaction_code ||
        closeLog?.changes?.transaction_code ||
        (txMatch ? txMatch[1] : null);

      const noteAmountMatch =
        typeof incidentRow?.resolution_note === "string"
          ? incidentRow.resolution_note.match(/([\d.,]+)\s*(?:VNĐ|đ)/i)
          : null;
      const parsedNoteAmount = noteAmountMatch
        ? Number(noteAmountMatch[1].replace(/[.,]/g, ""))
        : 0;

      const compensationAmount = isRejected
        ? 0
        : Number(
            claimRow?.approved_amount ||
              incidentRow?.approved_compensation_amount ||
              closeLog?.changes?.approved_amount ||
              approveLog?.changes?.approved_compensation_amount ||
              (claimStatusUpper === "APPROVED" || claimStatusUpper === "PAID" || claimStatusUpper === "CLOSED_COMPENSATED" || isDone
                ? claimRow?.amount
                : 0) ||
              (parsedNoteAmount >= 1000 ? parsedNoteAmount : 0) ||
              0,
          );

      const dateMatch = txSourceText.match(
        /ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i,
      );
      const paymentDate = claimRow?.payment_date
        ? new Date(claimRow.payment_date).toISOString().split("T")[0]
        : closeLog?.changes?.payment_date || (dateMatch ? dateMatch[1] : null);

      const publicStatus = isRejected
        ? "REJECTED"
        : isDone
          ? "DONE"
          : isPaid
            ? "PAID"
            : isApproved
              ? "APPROVED"
              : "PENDING_APPROVAL";

      incidentInfo = {
        has_incident: true,
        id: incidentId,
        code: incidentId
          ? `INC-${String(incidentId).padStart(3, "0")}`
          : `CLM-${String(claimRow.id).padStart(4, "0")}`,
        type: incidentRow?.type || "OTHER",
        type_display:
          INCIDENT_TYPE_LABELS[incidentRow?.type] ||
          incidentRow?.type ||
          "Sự cố vận chuyển hàng hóa",
        description: incidentRow?.description || claimRow?.reason || null,
        status: publicStatus,
        compensation_amount: compensationAmount,
        clause_ref:
          incidentRow?.contract_clause_ref ||
          approveLog?.changes?.contract_clause_ref ||
          rejectLog?.changes?.contract_clause_ref ||
          (isRejected
            ? "Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng"
            : "Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC)"),
        resolution_note:
          incidentRow?.resolution_note || claimRow?.review_comment || null,
        rejection_reason: isRejected
          ? incidentRow?.rejection_reason ||
            rejectLog?.reason ||
            claimRow?.review_comment ||
            incidentRow?.resolution_note ||
            "Không đủ điều kiện bồi thường theo hợp đồng vận chuyển."
          : null,
        transaction_code: transactionCode || null,
        payment_date: paymentDate || null,
        payment_proof_url: rawPaymentProofUrl || null,
        hotline: incidentRow?.contact_hotline || "1900 1234",
      };
    }
  } catch (extraErr) {
    console.warn("resolveOrderIncidentAndEvidences warning:", extraErr.message);
  }

  return {
    incident: incidentInfo,
    seal_image: sealImage,
    pod_image: podImage,
    eta: eta || formatDisplayDateTime(order.created_at),
  };
};

// 4.1. API CHO KHÁCH HÀNG: LẤY CHI TIẾT ĐƠN HÀNG QUA TRACKING TOKEN (PUBLIC)
const getOrderByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: "Thiếu tracking token" });
    }

    const cleanToken = (token || "").trim();
    const incOrderId = await resolveOrderIdFromIncidentToken(cleanToken);
    let whereFilter;
    if (incOrderId) {
      whereFilter = { id: BigInt(incOrderId) };
    } else if (cleanToken.startsWith("NEX-") || cleanToken.startsWith("ORD-")) {
      whereFilter = { order_code: cleanToken };
    } else {
      whereFilter = {
        OR: [{ tracking_token: cleanToken }, { order_code: cleanToken }],
      };
    }

    const rawOrder = await prisma.orders.findFirst({
      where: whereFilter,
      include: orderRelationInclude,
    });

    if (!rawOrder) {
      console.warn(`[getOrderByToken] Not found with token: "${token}"`);
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng tương ứng với mã token này",
      });
    }

    const order = mapOrderWithRelations(rawOrder);
    const extraMeta = parseOrderMeta(order);
    const [{ incident, seal_image, pod_image, eta }, claimTracking] = await Promise.all([
      resolveOrderIncidentAndEvidences(order, extraMeta),
      claimService.getOrderClaimsForTracking(order),
    ]);
    const cargosList = Array.isArray(order.order_cargos)
      ? order.order_cargos
      : order.order_cargos
        ? [order.order_cargos]
        : [];
    const cargoObj = cargosList[0] || {};
    const totalPackageCount =
      extraMeta.package_count !== undefined && extraMeta.package_count !== null
        ? Number(extraMeta.package_count)
        : cargosList.length > 0
          ? cargosList.reduce((sum, c) => sum + (parseInt(c.quantity, 10) || 1), 0)
          : order.package_count || 1;
    const totalActualWeight =
      extraMeta.weight !== undefined && extraMeta.weight !== null
        ? parseFloat(extraMeta.weight)
        : cargosList.length > 0
          ? cargosList.reduce((sum, c) => sum + (parseFloat(c.actual_weight_kg) || 0), 0)
          : order.actual_weight_kg || 0;
    const totalChargeableWeight =
      extraMeta.chargeable !== undefined && extraMeta.chargeable !== null
        ? parseFloat(extraMeta.chargeable)
        : cargosList.length > 0
          ? cargosList.reduce(
              (sum, c) =>
                sum +
                (parseFloat(c.chargeable_weight_kg) ||
                  parseFloat(c.actual_weight_kg) ||
                  0),
              0,
            )
          : order.chargeable_weight_kg || totalActualWeight;
    const combinedCargoDesc =
      cargosList.length > 1
        ? cargosList
            .map((c) => c.cargo_name)
            .filter(Boolean)
            .join(", ")
        : cargoObj.cargo_name;

    const isDuplicateAirportDelivery =
      order.pickup_location_id === 1 &&
      order.delivery_location_id === 1 &&
      !extraMeta.delivery_address;

    const resolvedPickupAddr =
      extraMeta.pickup_address ||
      order.pickup_location?.address ||
      "Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội";

    const resolvedDeliveryAddr =
      extraMeta.delivery_address ||
      (isDuplicateAirportDelivery && order.customer?.registered_address
        ? order.customer.registered_address
        : null) ||
      order.delivery_location?.address ||
      "Bắc Ninh";

    const customerRequestedVehicle =
      extraMeta.customer_requested_vehicle ||
      extraMeta.vehicle_type_required ||
      order.truck_type_requested ||
      "TRUCK_2.5T";
    const proposedVehicleType =
      extraMeta.web_workflow?.proposed_vehicle_type ||
      extraMeta.proposed_vehicle_type ||
      order.truck_type_requested ||
      customerRequestedVehicle;

    return res.json({
      order: {
        id: order.id,
        order_code: order.order_code,
        customer_name: order.customer?.company_name || order.receiver_name,
        customer_email: extraMeta.customer_email || order.customer?.email,
        customer_phone: order.receiver_phone,
        customer_tax_code:
          extraMeta.customer_tax_code || order.customer?.tax_code,
        agreed_price: order.agreed_price || 0,
        cargo_description:
          combinedCargoDesc ||
          order.cargo_description ||
          "Hàng bách hóa / Linh kiện",
        package_count: totalPackageCount || 1,
        package_unit: cargoObj.unit || "Kiện",
        length_cm: parseFloat(cargoObj.length_cm) || 0,
        width_cm: parseFloat(cargoObj.width_cm) || 0,
        height_cm: parseFloat(cargoObj.height_cm) || 0,
        actual_weight_kg: totalActualWeight || 0,
        chargeable_weight_kg: totalChargeableWeight || 0,
        pickup_address: resolvedPickupAddr,
        delivery_address: resolvedDeliveryAddr,
        vehicle_type_required: proposedVehicleType,
        customer_requested_vehicle: customerRequestedVehicle,
        proposed_vehicle_type: proposedVehicleType,
        agreed_vehicle_type:
          extraMeta.web_workflow?.agreed_vehicle_type || proposedVehicleType,
        vehicle_analysis_note:
          extraMeta.web_workflow?.vehicle_analysis_note ||
          extraMeta.vehicle_analysis_note ||
          "",
        status: order.status,
        raw_status: order.status,
        is_closed: Boolean(order.is_closed),
        order_type: order.order_type || "Import",
        refusal_reason: order.refusal_reason || extraMeta.refusal_reason || null,
        refusal_photo: order.refusal_photo || extraMeta.refusal_photo || null,
        warehouse_name: order.warehouse_name || extraMeta.warehouse_name || null,
        redirected_to_warehouse: Boolean(extraMeta.redirected_to_warehouse || order.warehouse_name),
        source: order.source,
        dispatcher_phone:
          extraMeta.dispatcher_phone ||
          order.responsible_dispatcher?.phone ||
          "0988 123 456",
        dispatcher_zalo:
          extraMeta.dispatcher_zalo ||
          order.responsible_dispatcher?.zalo_link ||
          (order.responsible_dispatcher?.phone
            ? `https://zalo.me/${order.responsible_dispatcher.phone.replace(/[^0-9]/g, "")}`
            : "https://zalo.me/0988123456"),
        dispatcher_name:
          extraMeta.dispatcher_name ||
          order.responsible_dispatcher?.full_name ||
          order.responsible_dispatcher?.username ||
          "Điều phối viên NEXLOG",
        tracking_token: (order.tracking_token || "").trim(),
        web_workflow: extraMeta.web_workflow || {
          stage: "WAITING_PRICE_CONFIRMATION",
        },
        items: extraMeta.items || null,
        user_note: extraMeta.user_note || null,
        request_split_trucks: Boolean(
          extraMeta.request_split_trucks ||
            extraMeta.web_workflow?.request_split_trucks,
        ),
        split_details:
          extraMeta.split_details ||
          extraMeta.web_workflow?.split_details ||
          null,
        parent_order_id: extraMeta.parent_order_id || null,
        parent_order_code: extraMeta.parent_order_code || null,
        split_index: extraMeta.split_index || null,
        split_total: extraMeta.split_total || null,
        split_into_orders: extraMeta.split_into_orders || null,
        contract_uploaded: !!(
          extraMeta.contract_uploaded ||
          extraMeta.contract_file ||
          extraMeta.web_workflow?.signed_contract
        ),
        contract_file:
          extraMeta.contract_file ||
          extraMeta.web_workflow?.signed_contract?.contract_file ||
          null,
        contract_file_data: extraMeta.contract_file_data || null,
        contract_uploaded_at:
          extraMeta.contract_uploaded_at ||
          extraMeta.web_workflow?.signed_contract?.signed_at ||
          null,
        contract_sent_email_at: extraMeta.contract_sent_email_at || null,
        contract_custom_terms: extraMeta.contract_custom_terms || [],
        contract_details: extraMeta.contract_details || extraMeta.web_workflow?.contract_details || null,
        contract_hardcopy_received: Boolean(extraMeta.contract_hardcopy_received),
        contract_hardcopy_received_at: extraMeta.contract_hardcopy_received_at || null,
        eta,
        seal_image,
        pod_image,
        incident,
        claims: claimTracking.claims,
        can_submit_claim: claimTracking.can_submit_claim,
        claim_window_days: claimTracking.claim_window_days,
        claim_window_deadline: claimTracking.claim_window_deadline,
        claim_window_expired: claimTracking.claim_window_expired,
      },
    });
  } catch (err) {
    console.error("getOrderByToken Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  getOrderByToken,
};
