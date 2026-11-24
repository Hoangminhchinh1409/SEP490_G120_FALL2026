const prisma = require("../../config/prisma");
const jwt = require("jsonwebtoken");
const { serializePrisma, formatDateOnly } = require("../../utils/prismaHelper");
const {
  mapDbStatusToFe,
  parseOrderMeta,
  META_NOTE_PREFIX,
  META_CHUNK_PREFIX,
} = require("../../services/orderHelperService");

const orderRelationInclude = {
  customers: {
    select: {
      id: true,
      company_name: true,
      tax_code: true,
      email: true,
      registered_address: true,
    },
  },
  locations_orders_pickup_location_idTolocations: {
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      type: true,
      province: true,
    },
  },
  locations_orders_delivery_location_idTolocations: {
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      type: true,
      province: true,
    },
  },
  users_orders_responsible_dispatcher_idTousers: {
    select: {
      id: true,
      username: true,
      full_name: true,
      phone: true,
      zalo_link: true,
    },
  },
  order_cargos: true,
  order_notes: true,
};

const mapOrderWithRelations = (row) => {
  if (!row) return null;
  const serialized = serializePrisma(row);
  if (row.requested_pickup_date) {
    serialized.requested_pickup_date = formatDateOnly(row.requested_pickup_date);
  }
  return {
    ...serialized,
    customer: serialized.customers || null,
    pickup_location:
      serialized.locations_orders_pickup_location_idTolocations || null,
    delivery_location:
      serialized.locations_orders_delivery_location_idTolocations || null,
    responsible_dispatcher:
      serialized.users_orders_responsible_dispatcher_idTousers || null,
  };
};

// 1. LẤY TOÀN BỘ DANH SÁCH ĐƠN HÀNG
const getAllOrders = async (req, res) => {
  try {
    // Kiểm tra thông tin người dùng nếu có token (Cookie / Bearer) hoặc query param
    let dispatcherFilterId = null;
    let isDispatcherRole = false;

    if (req.query?.dispatcher_id) {
      dispatcherFilterId = Number(req.query.dispatcher_id);
    } else {
      let token = req.cookies?.token;
      if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && (Number(decoded.role_id) === 3 || decoded.role === 'DISPATCHER')) {
            dispatcherFilterId = Number(decoded.id);
            isDispatcherRole = true;
          }
        } catch {
          // Token không hợp lệ hoặc đã hết hạn
        }
      }
    }

    const whereClause =
      dispatcherFilterId && (isDispatcherRole || req.query?.dispatcher_id)
        ? { responsible_dispatcher_id: Number(dispatcherFilterId) }
        : {};

    let rawOrders;
    try {
      rawOrders = await prisma.orders.findMany({
        where: whereClause,
        include: orderRelationInclude,
        orderBy: { created_at: "desc" },
      });
    } catch (error) {
      console.error("Error fetching orders via Prisma:", error);
      return res
        .status(500)
        .json({ message: "Không thể tải danh sách đơn hàng", error: error.message });
    }

    const dbOrders = (rawOrders || []).map(mapOrderWithRelations);

    // Map dữ liệu thành định dạng chuẩn cho giao diện Frontend
    const formattedOrders = (dbOrders || []).map((order) => {
      const meta = parseOrderMeta(order);
      if (!order.ai_input_text && Object.keys(meta).length > 0) {
        order.ai_input_text = JSON.stringify(meta);
      }
      const visibleNotes = (order.order_notes || []).filter(
        (n) =>
          typeof n?.content === "string" &&
          !n.content.startsWith(META_NOTE_PREFIX) &&
          !n.content.startsWith(META_CHUNK_PREFIX) &&
          !n.content.startsWith("[Khách hàng phản hồi đàm phán]") &&
          !n.content.startsWith("[Điều phối viên chốt lại giá]"),
      );
      const cargosList = Array.isArray(order.order_cargos)
        ? order.order_cargos
        : order.order_cargos
          ? [order.order_cargos]
          : [];
      const cargo = cargosList[0] || {};
      const totalPackageCount =
        meta.package_count !== undefined && meta.package_count !== null
          ? Number(meta.package_count)
          : cargosList.length > 0
            ? cargosList.reduce((sum, c) => sum + (parseInt(c.quantity, 10) || 1), 0)
            : 1;
      const totalActualWeight =
        meta.weight !== undefined && meta.weight !== null
          ? parseFloat(meta.weight)
          : cargosList.length > 0
            ? cargosList.reduce((sum, c) => sum + (parseFloat(c.actual_weight_kg) || 0), 0)
            : 0;
      const totalChargeableWeight =
        meta.chargeable !== undefined && meta.chargeable !== null
          ? parseFloat(meta.chargeable)
          : cargosList.length > 0
            ? cargosList.reduce(
                (sum, c) =>
                  sum +
                  (parseFloat(c.chargeable_weight_kg) ||
                    parseFloat(c.actual_weight_kg) ||
                    0),
                0,
              )
            : totalActualWeight;
      const combinedCargoName =
        cargosList.length > 1
          ? cargosList
              .map((c) => c.cargo_name)
              .filter(Boolean)
              .join(", ")
          : cargo.cargo_name;
      const feStatus = mapDbStatusToFe(order.status, order, meta);
      const isFromWeb =
        order.source === "HOMEPAGE" ||
        order.source === "Web" ||
        Boolean(meta.customer_email) ||
        order.agreed_price === 0 ||
        visibleNotes.some(
          (n) =>
            n.content?.includes("Website") || n.content?.includes("Homepage"),
        );

      const noteStr = visibleNotes.map((n) => n.content).join(" ") || "";
      const isBulk =
        cargo.cargo_type === "Bulk" ||
        cargo.cargo_type === "BULK" ||
        noteStr.includes("Loại: BULK") ||
        noteStr.includes("Loại hàng: BULK");
      const isPallet =
        cargo.cargo_type === "Pallet" ||
        cargo.cargo_type === "PALLET" ||
        noteStr.includes("Loại: PALLET") ||
        noteStr.includes("Loại hàng: PALLET");
      const detectedCargoType = isBulk
        ? "BULK"
        : isPallet
          ? "PALLET"
          : "GENERAL";

      // Xác định chính xác địa chỉ lấy & giao từ meta trước, sau đó tới locations
      const resolvedPickupAddr =
        meta.pickup_address ||
        order.pickup_location?.address ||
        order.pickup_location?.name ||
        "Kho ALS Cảng HKQT Nội Bài";

      const isDuplicateAirportDelivery =
        order.pickup_location_id === 1 &&
        order.delivery_location_id === 1 &&
        !meta.delivery_address;

      const resolvedDeliveryAddr =
        meta.delivery_address ||
        (isDuplicateAirportDelivery && order.customer?.registered_address
          ? order.customer.registered_address
          : null) ||
        order.delivery_location?.address ||
        order.delivery_location?.name ||
        "KCN Tiên Sơn, Bắc Ninh";

      const resolvedPickupCoords = {
        lat:
          parseFloat(
            meta.pickup_coords?.lat ||
              order.pickup_location?.latitude ||
              order.pickup_location?.lat,
          ) || 21.2187,
        lng:
          parseFloat(
            meta.pickup_coords?.lng ||
              order.pickup_location?.longitude ||
              order.pickup_location?.lng,
          ) || 105.8042,
      };

      const resolvedDeliveryCoords = {
        lat:
          parseFloat(
            meta.delivery_coords?.lat ||
              (!isDuplicateAirportDelivery &&
                (order.delivery_location?.latitude ||
                  order.delivery_location?.lat)),
          ) || 21.1215,
        lng:
          parseFloat(
            meta.delivery_coords?.lng ||
              (!isDuplicateAirportDelivery &&
                (order.delivery_location?.longitude ||
                  order.delivery_location?.lng)),
          ) || 105.9754,
      };

      const customerRequestedVehicle =
        meta.customer_requested_vehicle ||
        meta.vehicle_type_required ||
        order.truck_type_requested ||
        "TRUCK_2.5T";
      const proposedVehicleType =
        meta.web_workflow?.proposed_vehicle_type ||
        meta.proposed_vehicle_type ||
        order.truck_type_requested ||
        customerRequestedVehicle;

      return {
        key: order.id.toString(),
        id: order.id,
        order_id: order.order_code,
        order_code: order.order_code,
        customer: order.customer?.company_name || "Khách hàng",
        customer_phone:
          order.receiver_phone || order.customer?.tax_code || "0988123456",
        customer_email:
          meta.customer_email ||
          order.tracking_email ||
          order.customer?.email ||
          "",
        pickup: resolvedPickupAddr,
        pickup_address: resolvedPickupAddr,
        pickup_coords: resolvedPickupCoords,
        dropoff: resolvedDeliveryAddr,
        delivery_address: resolvedDeliveryAddr,
        dropoff_coords: resolvedDeliveryCoords,
        delivery_coords: resolvedDeliveryCoords,
        receiver_name: order.receiver_name || "",
        receiver_phone: order.receiver_phone || "",
        status: feStatus,
        raw_status: order.status || "",
        is_closed: Boolean(order.is_closed),
        refusal_reason: order.refusal_reason || meta.refusal_reason || null,
        refusal_photo: order.refusal_photo || meta.refusal_photo || null,
        warehouse_name: order.warehouse_name || meta.warehouse_name || null,
        redirected_to_warehouse: Boolean(meta.redirected_to_warehouse || order.warehouse_name),
        source: isFromWeb ? "HOMEPAGE" : order.source || "HOTLINE",
        package_count: totalPackageCount || 1,
        package_unit: cargo.unit || (isBulk ? "Chuyến" : "Kiện"),
        cargo_name:
          combinedCargoName ||
          visibleNotes[0]?.content ||
          (isBulk
            ? "Hàng rời tính theo trọng tải"
            : "Hàng bách hóa / Linh kiện"),
        cargo_type: detectedCargoType,
        length_cm: isBulk ? 0 : parseFloat(cargo.length_cm) || 120,
        width_cm: isBulk ? 0 : parseFloat(cargo.width_cm) || 100,
        height_cm: isBulk ? 0 : parseFloat(cargo.height_cm) || 150,
        weight: totalActualWeight || 1200,
        chargeable:
          totalChargeableWeight ||
          totalActualWeight ||
          1200,
        estimated_distance_km: parseFloat(meta.estimated_distance_km) || 35.5,
        estimated_duration_mins: parseInt(meta.estimated_duration_mins, 10) || 45,
        vehicle_type_required: proposedVehicleType,
        customer_requested_vehicle: customerRequestedVehicle,
        proposed_vehicle_type: proposedVehicleType,
        agreed_vehicle_type:
          meta.web_workflow?.agreed_vehicle_type || proposedVehicleType,
        vehicle_analysis_note:
          meta.web_workflow?.vehicle_analysis_note ||
          meta.vehicle_analysis_note ||
          "",
        agreed_price: parseInt(order.agreed_price, 10) || 0,
        extra_fees_surcharge: 0,
        extra_fees_collection: 0,
        cancel_reason: order.cancellation_reason || "",
        cancellation_reason: order.cancellation_reason || "",
        cancel_fee: order.cancellation_fee || 0,
        cancelled_at: null,
        closed_at: null,
        order_notes:
          visibleNotes.length > 0 &&
          !visibleNotes[0]?.content?.includes("Đơn hàng nhận tư vấn từ Website")
            ? visibleNotes[0].content
            : "",
        date: order.created_at
          ? new Date(order.created_at)
              .toISOString()
              .slice(0, 16)
              .replace("T", " ")
          : "",
        tracking_token: (order.tracking_token || "").trim(),
        customer_tax_code:
          meta.customer_tax_code || order.customer?.tax_code || "",
        items: meta.items || null,
        web_workflow: meta.web_workflow || null,
        contract_uploaded: !!(
          meta.contract_uploaded ||
          meta.contract_file ||
          meta.web_workflow?.signed_contract
        ),
        contract_file:
          meta.contract_file ||
          meta.web_workflow?.signed_contract?.contract_file ||
          null,
        contract_file_data: meta.contract_file_data || null,
        contract_uploaded_at:
          meta.contract_uploaded_at ||
          meta.web_workflow?.signed_contract?.signed_at ||
          null,
        contract_sent_email_at: meta.contract_sent_email_at || null,
        contract_custom_terms: meta.contract_custom_terms || [],
        contract_hardcopy_received: Boolean(meta.contract_hardcopy_received),
        contract_hardcopy_received_at: meta.contract_hardcopy_received_at || null,
        documents: (() => {
          const docs =
            meta.documents ||
            meta.web_workflow?.approved_documents ||
            meta.web_workflow?.documents;
          return Array.isArray(docs) && docs.length > 0 ? docs : null;
        })(),
        responsible_dispatcher_id: order.responsible_dispatcher_id ? Number(order.responsible_dispatcher_id) : (order.responsible_dispatcher?.id ? Number(order.responsible_dispatcher.id) : null),
        dispatcher_name:
          order.responsible_dispatcher?.full_name ||
          order.responsible_dispatcher?.username ||
          meta.dispatcher_name ||
          "Điều phối viên NEXLOG",
        dispatcher_phone:
          order.responsible_dispatcher?.phone ||
          meta.dispatcher_phone ||
          "0988 123 456",
        shipping_direction:
          meta.shipping_direction ||
          (order.order_type === "PICKUP" || order.order_type === "Export"
            ? "EXPORT"
            : "IMPORT"),
        assigned_warehouse: meta.assigned_warehouse || "WH-1",
        customs_location: meta.customs_location || "NOI_BAI",
        customs_channel: meta.customs_channel || "GREEN",
        seal_number: meta.seal_number || "",
        authorized_bank: meta.authorized_bank || "Vietcombank",
        accounting_email:
          meta.accounting_email || order.customer?.email || "",
        invoice_status: meta.invoice_status || "NOT_ISSUED",
        invoice_number: meta.invoice_number || null,
        invoice_issued_at: meta.invoice_issued_at || null,
        invoice_data: meta.invoice || null,
        flight_arrival_date: meta.flight_arrival_date || null,
        flight_arrival_time: meta.flight_arrival_time || null,
        flight_datetime: meta.flight_datetime || null,
        export_pickup_suggestion: meta.export_pickup_suggestion || null,
        request_split_trucks: Boolean(
          meta.request_split_trucks || meta.web_workflow?.request_split_trucks,
        ),
        split_details:
          meta.split_details || meta.web_workflow?.split_details || null,
        parent_order_id: meta.parent_order_id || null,
        parent_order_code: meta.parent_order_code || null,
        split_index: meta.split_index || null,
        split_total: meta.split_total || null,
        split_reason: meta.split_reason || null,
        split_into_orders: meta.split_into_orders || null,
      };
    });

    return res.json({ orders: formattedOrders });
  } catch (err) {
    console.error("getAllOrders Controller Exception:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 4.1. API CHO KHÁCH HÀNG: LẤY CHI TIẾT ĐƠN HÀNG QUA TRACKING TOKEN (PUBLIC)
const INCIDENT_TYPE_LABELS = {
  DAMAGED_LOST_CARGO: "Hàng hư hỏng / mất",
  DAMAGED_CARGO: "Hàng hư hỏng / mất",
  CARGO_DAMAGED: "Hàng hư hỏng / mất",
  CARGO_DAMAGE: "Hàng hóa hư hỏng",
  "Cargo Damaged": "Hàng hư hỏng / mất",
  "Cargo Lost": "Thất lạc hàng hóa",
  CARGO_LOST: "Thất lạc hàng hóa",
  LOSS: "Thất thoát hàng hóa",
  TRAFFIC_ACCIDENT: "Tai nạn giao thông",
  ACCIDENT: "Tai nạn giao thông / Va chạm",
  Accident: "Tai nạn giao thông",
  CARGO_HELD: "Hàng bị giữ",
  SEIZED_BY_AUTHORITY: "Cơ quan chức năng giữ xe",
  HELD_BY_AUTHORITIES: "Kiểm tra hải quan / CSGT",
  ENGINE_BREAKDOWN: "Hỏng xe",
  BREAKDOWN: "Hỏng xe",
  Breakdown: "Hỏng xe",
  "Vehicle Issue": "Hỏng xe",
  ROAD_BAN: "Cấm đường / Ùn tắc",
  "Road Ban": "Cấm đường / Ùn tắc",
  Traffic: "Cấm đường / Ùn tắc",
  DELAY: "Giao hàng chậm trễ",
  OTHER: "Khác",
  Other: "Khác",
};

const formatDisplayDateTime = (value) => {
  if (!value) return null;
  try {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString("vi-VN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

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

      const closeLog = incLogs.find((l) => l.action === "CLOSE_INCIDENT_CASE_DONE");
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

      const rawPaymentProofUrl =
        claimRow?.evidence ||
        incidentRow?.payment_proof_url ||
        closeLog?.changes?.payment_proof_url ||
        null;

      const txSourceText = `${closeLog?.changes?.close_note || ""} ${claimRow?.review_comment || ""} ${incidentRow?.resolution_note || ""}`;
      const txMatch = txSourceText.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
      let transactionCode =
        closeLog?.changes?.transaction_code || (txMatch ? txMatch[1] : null);

      const hasPaymentRecord = Boolean(
        rawPaymentProofUrl ||
          transactionCode ||
          closeLog ||
          claimStatusUpper === "PAID",
      );

      const isDone =
        !isRejected &&
        (["DONE", "RESOLVED", "CLOSED"].includes(rawStatusUpper) || hasPaymentRecord);
      const isApproved =
        !isRejected &&
        !isDone &&
        (rawStatusUpper === "APPROVED" ||
          claimStatusUpper === "APPROVED" ||
          Boolean(approveLog));

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
            incidentRow?.approved_compensation_amount ||
              closeLog?.changes?.approved_amount ||
              approveLog?.changes?.approved_compensation_amount ||
              (claimStatusUpper === "APPROVED" || claimStatusUpper === "PAID" || isDone
                ? claimRow?.amount
                : 0) ||
              (parsedNoteAmount >= 1000 ? parsedNoteAmount : 0) ||
              0,
          );

      const dateMatch = txSourceText.match(
        /ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i,
      );
      let paymentDate =
        closeLog?.changes?.payment_date || (dateMatch ? dateMatch[1] : null);
      const closedAt = isDone
        ? incidentRow?.closed_at ||
          closeLog?.created_time ||
          claimRow?.updated_at ||
          incidentRow?.resolved_time
        : null;
      if (!paymentDate && isDone && compensationAmount > 0 && closedAt) {
        paymentDate = new Date(closedAt).toISOString().split("T")[0];
      }
      if (!transactionCode && isDone && compensationAmount > 0 && incidentId) {
        const compactDate = (
          paymentDate || new Date().toISOString().split("T")[0]
        )
          .replace(/[^0-9]/g, "")
          .slice(2, 8);
        transactionCode = `FT${compactDate}${String(incidentId).padStart(4, "0")}`;
      }

      const publicStatus = isRejected
        ? "REJECTED"
        : isDone
          ? "DONE"
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
    const { incident, seal_image, pod_image, eta } =
      await resolveOrderIncidentAndEvidences(order, extraMeta);
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
      },
    });
  } catch (err) {
    console.error("getOrderByToken Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  getAllOrders,
  getOrderByToken,
};
