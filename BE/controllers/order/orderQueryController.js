const prisma = require("../../config/prisma");
const jwt = require("jsonwebtoken");
const {
  mapDbStatusToFe,
  parseOrderMeta,
  META_NOTE_PREFIX,
  META_CHUNK_PREFIX,
} = require("../../services/orderHelperService");
const {
  orderRelationInclude,
  mapOrderWithRelations,
} = require("./orderQueryFormatter");
const claimService = require("../../services/claimService");
const { getOrderByToken } = require("./orderCustomerViewController");
const {
  getPublicInvoiceCaptcha,
  lookupPublicInvoice,
  downloadPublicInvoiceFile,
} = require("./orderPublicInvoiceController");

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
      if (!token && req.headers?.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      }
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (
            decoded &&
            (Number(decoded.role_id) === 3 || decoded.role === "DISPATCHER")
          ) {
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
        .json({
          message: "Không thể tải danh sách đơn hàng",
          error: error.message,
        });
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
        cargosList.length > 0
          ? cargosList.reduce((sum, c) => sum + (parseInt(c.quantity, 10) || 0), 0)
          : meta.package_count !== undefined && meta.package_count !== null
            ? Number(meta.package_count)
            : null;
      const totalActualWeight =
        cargosList.length > 0
          ? cargosList.reduce(
              (sum, c) => sum + (parseFloat(c.actual_weight_kg) || 0),
              0,
            )
          : meta.weight !== undefined && meta.weight !== null
            ? parseFloat(meta.weight)
            : null;
      const totalChargeableWeight =
        cargosList.length > 0
          ? cargosList.reduce(
              (sum, c) =>
                sum +
                (parseFloat(c.chargeable_weight_kg) ||
                  parseFloat(c.actual_weight_kg) ||
                  0),
              0,
            )
          : meta.chargeable !== undefined && meta.chargeable !== null
            ? parseFloat(meta.chargeable)
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
        String(order.source || "").toUpperCase() === "HOMEPAGE" ||
        String(order.source || "").toUpperCase() === "WEB";

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
          : cargo.cargo_type || "GENERAL";

      // Xác định chính xác địa chỉ lấy & giao từ meta trước, sau đó tới locations (BUG-OL-05: không dùng giá trị giả)
      const resolvedPickupAddr =
        meta.pickup_address ||
        order.pickup_location?.address ||
        order.pickup_location?.name ||
        null;

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
        null;

      const rawPickupLat = parseFloat(
        meta.pickup_coords?.lat ||
          order.pickup_location?.latitude ||
          order.pickup_location?.lat,
      );
      const rawPickupLng = parseFloat(
        meta.pickup_coords?.lng ||
          order.pickup_location?.longitude ||
          order.pickup_location?.lng,
      );
      const resolvedPickupCoords =
        !isNaN(rawPickupLat) && !isNaN(rawPickupLng)
          ? { lat: rawPickupLat, lng: rawPickupLng }
          : null;

      const rawDeliveryLat = parseFloat(
        meta.delivery_coords?.lat ||
          (!isDuplicateAirportDelivery &&
            (order.delivery_location?.latitude ||
              order.delivery_location?.lat)),
      );
      const rawDeliveryLng = parseFloat(
        meta.delivery_coords?.lng ||
          (!isDuplicateAirportDelivery &&
            (order.delivery_location?.longitude ||
              order.delivery_location?.lng)),
      );
      const resolvedDeliveryCoords =
        !isNaN(rawDeliveryLat) && !isNaN(rawDeliveryLng)
          ? { lat: rawDeliveryLat, lng: rawDeliveryLng }
          : null;

      const formatOrderDeparture = () => {
        const pad2 = (n) => String(n).padStart(2, "0");
        const toVnDateStr = (ymd) => {
          const m = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (m) return `${m[3]}/${m[2]}/${m[1]}`;
          return null;
        };

        const dirUpper = String(
          meta.shipping_direction ||
            (order.order_type === "PICKUP" || order.order_type === "Export"
              ? "EXPORT"
              : "IMPORT"),
        ).toUpperCase();

        // 1. Đơn Nhập khẩu: ưu tiên ngày & giờ máy bay hạ cánh
        if (dirUpper === "IMPORT" && meta.flight_arrival_date) {
          const dStr = toVnDateStr(meta.flight_arrival_date);
          const tStr = (meta.flight_arrival_time || "08:00").slice(0, 5);
          if (dStr) {
            return {
              display: `${dStr} ${tStr}`,
              iso: `${String(meta.flight_arrival_date).slice(0, 10)}T${tStr}:00+07:00`,
            };
          }
        }

        // 2. Đơn Xuất khẩu: ưu tiên ngày lấy hàng yêu cầu + khung giờ (hoặc giờ gợi ý cut-off)
        const rawPickupDate =
          meta.required_pickup_date ||
          (order.requested_pickup_date
            ? new Date(order.requested_pickup_date).toISOString().slice(0, 10)
            : null);

        if (rawPickupDate) {
          const dStr = toVnDateStr(rawPickupDate);
          let tStr =
            meta.operating_time_slot === "AFTERNOON" ? "12:00" : "08:00";
          if (dirUpper === "IMPORT" && meta.flight_arrival_time) {
            tStr = String(meta.flight_arrival_time).slice(0, 5);
          } else if (meta.export_pickup_suggestion) {
            const timeMatch = String(meta.export_pickup_suggestion).match(
              /(\d{1,2}:\d{2})/,
            );
            if (timeMatch) {
              const [hh, mm] = timeMatch[1].split(":");
              tStr = `${pad2(hh)}:${mm}`;
            }
          }
          if (dStr) {
            return {
              display: `${dStr} ${tStr}`,
              iso: `${String(rawPickupDate).slice(0, 10)}T${tStr}:00+07:00`,
            };
          }
        }

        // 3. Nếu có flight_datetime (YYYY-MM-DDTHH:mm)
        if (meta.flight_datetime) {
          const dt = new Date(meta.flight_datetime);
          if (!Number.isNaN(dt.getTime())) {
            const pickupDt =
              dirUpper === "EXPORT"
                ? new Date(dt.getTime() - 4 * 3600 * 1000)
                : dt;
            const vn = new Date(pickupDt.getTime() + 7 * 3600 * 1000);
            return {
              display: `${pad2(vn.getUTCDate())}/${pad2(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${pad2(vn.getUTCHours())}:${pad2(vn.getUTCMinutes())}`,
              iso: pickupDt.toISOString(),
            };
          }
        }

        // 4. Fallback theo thời điểm đơn sẵn sàng điều xe hoặc thời điểm tạo đơn thực tế
        const fallbackDt = new Date(
          order.ready_for_planning_at || order.created_at || Date.now(),
        );
        const vn = new Date(fallbackDt.getTime() + 7 * 3600 * 1000);
        return {
          display: `${pad2(vn.getUTCDate())}/${pad2(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${pad2(vn.getUTCHours())}:${pad2(vn.getUTCMinutes())}`,
          iso: fallbackDt.toISOString(),
        };
      };

      const plannedDeparture = formatOrderDeparture();
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
        customer_phone: order.customer?.phone || order.receiver_phone || "",
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
        redirected_to_warehouse: Boolean(
          meta.redirected_to_warehouse || order.warehouse_name,
        ),
        source: isFromWeb ? "HOMEPAGE" : order.source || "HOTLINE",
        package_count:
          totalPackageCount !== null && totalPackageCount !== undefined
            ? totalPackageCount
            : null,
        package_unit:
          cargo.unit ||
          (cargosList.length > 0 ? (isBulk ? "Chuyến" : "Kiện") : null),
        cargo_name:
          combinedCargoName ||
          (cargosList.length > 0
            ? isBulk
              ? "Hàng rời tính theo trọng tải"
              : "Hàng bách hóa / Linh kiện"
            : visibleNotes[0]?.content || null),
        cargo_type: detectedCargoType,
        length_cm:
          cargo.length_cm !== null && cargo.length_cm !== undefined
            ? parseFloat(cargo.length_cm)
            : null,
        width_cm:
          cargo.width_cm !== null && cargo.width_cm !== undefined
            ? parseFloat(cargo.width_cm)
            : null,
        height_cm:
          cargo.height_cm !== null && cargo.height_cm !== undefined
            ? parseFloat(cargo.height_cm)
            : null,
        weight:
          totalActualWeight !== null && totalActualWeight !== undefined
            ? totalActualWeight
            : null,
        chargeable:
          totalChargeableWeight !== null && totalChargeableWeight !== undefined
            ? totalChargeableWeight
            : null,
        estimated_distance_km:
          meta.estimated_distance_km !== undefined &&
          meta.estimated_distance_km !== null
            ? parseFloat(meta.estimated_distance_km)
            : null,
        estimated_duration_mins:
          meta.estimated_duration_mins !== undefined &&
          meta.estimated_duration_mins !== null
            ? parseInt(meta.estimated_duration_mins, 10)
            : null,
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
        extra_fees_surcharge: Array.isArray(order.extra_fees)
          ? order.extra_fees
              .filter(
                (f) =>
                  !["PROPOSED", "REJECTED"].includes(
                    String(f.status || "").toUpperCase(),
                  ),
              )
              .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
          : 0,
        extra_fees_list: Array.isArray(order.extra_fees)
          ? order.extra_fees
          : [],
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
        contract_file_data: null,
        contract_uploaded_at:
          meta.contract_uploaded_at ||
          meta.web_workflow?.signed_contract?.signed_at ||
          null,
        contract_sent_email_at: meta.contract_sent_email_at || null,
        contract_custom_terms: meta.contract_custom_terms || [],
        contract_hardcopy_received: Boolean(meta.contract_hardcopy_received),
        contract_hardcopy_received_at:
          meta.contract_hardcopy_received_at || null,
        documents: (() => {
          const docs =
            meta.documents ||
            meta.web_workflow?.approved_documents ||
            meta.web_workflow?.documents;
          return Array.isArray(docs) && docs.length > 0 ? docs : null;
        })(),
        responsible_dispatcher_id: order.responsible_dispatcher_id
          ? Number(order.responsible_dispatcher_id)
          : order.responsible_dispatcher?.id
            ? Number(order.responsible_dispatcher.id)
            : null,
        dispatcher_name:
          order.responsible_dispatcher?.full_name ||
          order.responsible_dispatcher?.username ||
          meta.dispatcher_name ||
          null,
        dispatcher_phone:
          order.responsible_dispatcher?.phone || meta.dispatcher_phone || null,
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
        requested_pickup_date: plannedDeparture.display,
        planned_start_iso: plannedDeparture.iso,
        required_pickup_date:
          meta.required_pickup_date ||
          (order.requested_pickup_date
            ? new Date(order.requested_pickup_date).toISOString().slice(0, 10)
            : null),
        operating_time_slot: meta.operating_time_slot || "FULL_DAY",
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


const submitGuestClaimByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const claim = await claimService.createGuestClaimByToken(token, req.body);
    return res.status(201).json({
      message: `Đã gửi yêu cầu bồi thường ${claim.claim_code} thành công. Bộ phận Quản lý sẽ thẩm định và phản hồi sớm nhất.`,
      claim,
    });
  } catch (err) {
    console.error("submitGuestClaimByToken Error:", err);
    return res.status(err.statusCode || 400).json({
      message: err.message || "Không thể gửi yêu cầu bồi thường",
      error: err.message,
    });
  }
};

const confirmGuestClaimPayment = async (req, res) => {
  try {
    const { token } = req.params;
    const claim = await claimService.confirmCustomerMoneyReceived(token, req.body);
    return res.json({
      message: `Cảm ơn Quý khách! Hồ sơ bồi thường ${claim.claim_code} đã được xác nhận nhận tiền và đóng thành công.`,
      claim,
    });
  } catch (err) {
    console.error("confirmGuestClaimPayment Error:", err);
    return res.status(err.statusCode || 400).json({
      message: err.message || "Không thể xác nhận đã nhận tiền bồi thường",
      error: err.message,
    });
  }
};

module.exports = {
  getAllOrders,
  getOrderByToken,
  submitGuestClaimByToken,
  confirmGuestClaimPayment,
  getPublicInvoiceCaptcha,
  lookupPublicInvoice,
  downloadPublicInvoiceFile,
};
