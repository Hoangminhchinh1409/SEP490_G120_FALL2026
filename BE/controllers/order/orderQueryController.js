const supabase = require("../../config/supabase");
const {
  mapDbStatusToFe,
  parseOrderMeta,
  META_NOTE_PREFIX,
  META_CHUNK_PREFIX,
} = require("../../services/orderHelperService");

// 1. LẤY TOÀN BỘ DANH SÁCH ĐƠN HÀNG
const getAllOrders = async (req, res) => {
  try {
    const { data: dbOrders, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        customer:customers(id, company_name, tax_code, email, registered_address),
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, latitude, longitude, type, province),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, latitude, longitude, type, province),
        order_cargos(*),
        order_notes(*)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders from Supabase:", error);
      return res
        .status(500)
        .json({ message: "Không thể tải danh sách đơn hàng", error });
    }

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
      const cargo =
        (Array.isArray(order.order_cargos)
          ? order.order_cargos[0]
          : order.order_cargos) || {};
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
        hawb_code: order.order_code,
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
        source: isFromWeb ? "HOMEPAGE" : order.source || "HOTLINE",
        package_count: cargo.quantity || 1,
        package_unit: cargo.unit || (isBulk ? "Chuyến" : "Kiện"),
        cargo_name:
          cargo.cargo_name ||
          visibleNotes[0]?.content ||
          (isBulk
            ? "Hàng rời tính theo trọng tải"
            : "Hàng bách hóa / Linh kiện"),
        cargo_type: detectedCargoType,
        length_cm: isBulk ? 0 : parseFloat(cargo.length_cm) || 120,
        width_cm: isBulk ? 0 : parseFloat(cargo.width_cm) || 100,
        height_cm: isBulk ? 0 : parseFloat(cargo.height_cm) || 150,
        weight: parseFloat(cargo.actual_weight_kg) || 1200,
        chargeable:
          parseFloat(cargo.chargeable_weight_kg) ||
          parseFloat(cargo.actual_weight_kg) ||
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
        documents: (() => {
          const docs =
            meta.documents ||
            meta.web_workflow?.approved_documents ||
            meta.web_workflow?.documents;
          return Array.isArray(docs) && docs.length > 0 ? docs : null;
        })(),
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
      };
    });

    return res.json({ orders: formattedOrders });
  } catch (err) {
    console.error("getAllOrders Controller Exception:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 4.1. API CHO KHÁCH HÀNG: LẤY CHI TIẾT ĐƠN HÀNG QUA TRACKING TOKEN (PUBLIC)
const getOrderByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: "Thiếu tracking token" });
    }

    let query = supabase.from("orders").select(`
        *,
        customer:customers(id, company_name, tax_code, email, registered_address),
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, latitude, longitude),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, latitude, longitude),
        responsible_dispatcher:users!orders_responsible_dispatcher_id_fkey(id, username, full_name, phone, zalo_link),
        order_cargos(*),
        order_notes(*)
      `);

    const cleanToken = (token || "").trim();
    if (cleanToken.startsWith("NEX-") || cleanToken.startsWith("ORD-")) {
      query = query.eq("order_code", cleanToken);
    } else {
      query = query.or(
        `tracking_token.eq.${cleanToken},order_code.eq.${cleanToken}`,
      );
    }

    const { data: orders, error } = await query.limit(1);

    if (error || !orders || orders.length === 0) {
      console.warn(`[getOrderByToken] Not found with token: "${token}"`);
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng tương ứng với mã token này",
      });
    }

    const order = orders[0];
    const extraMeta = parseOrderMeta(order);
    const cargoObj =
      (Array.isArray(order.order_cargos)
        ? order.order_cargos[0]
        : order.order_cargos) || {};

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
          cargoObj.cargo_name ||
          order.cargo_description ||
          "Hàng bách hóa / Linh kiện",
        package_count: cargoObj.quantity || order.package_count || 1,
        package_unit: cargoObj.unit || "Kiện",
        length_cm: parseFloat(cargoObj.length_cm) || 0,
        width_cm: parseFloat(cargoObj.width_cm) || 0,
        height_cm: parseFloat(cargoObj.height_cm) || 0,
        actual_weight_kg:
          cargoObj.actual_weight_kg || order.actual_weight_kg || 0,
        chargeable_weight_kg:
          cargoObj.chargeable_weight_kg || order.chargeable_weight_kg || 0,
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
