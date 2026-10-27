const supabase = require("../../config/supabase");
const {
  mapDbStatusToFe,
  parseOrderMeta,
  META_NOTE_PREFIX,
} = require("./orderHelpers");

// 1. LẤY TOÀN BỘ DANH SÁCH ĐƠN HÀNG
const getAllOrders = async (req, res) => {
  try {
    const { data: dbOrders, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        customer:customers(id, company_name, tax_code, email),
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
          !n.content.startsWith(META_NOTE_PREFIX),
      );
      const cargo =
        (Array.isArray(order.order_cargos)
          ? order.order_cargos[0]
          : order.order_cargos) || {};
      const feStatus = mapDbStatusToFe(order.status, order);
      const isFromWeb =
        order.source === "HOMEPAGE" ||
        order.source === "Web" ||
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

      return {
        key: order.id.toString(),
        id: order.id,
        order_id: order.order_code,
        hawb_code: order.order_code,
        customer: order.customer?.company_name || "Khách hàng",
        customer_phone:
          order.customer?.tax_code || order.receiver_phone || "0988123456",
        customer_email: order.tracking_email || order.customer?.email || "",
        pickup:
          order.pickup_location?.address ||
          order.pickup_location?.name ||
          "Kho ALS Cảng HKQT Nội Bài",
        pickup_address:
          order.pickup_location?.address ||
          order.pickup_location?.name ||
          "Kho ALS Cảng HKQT Nội Bài",
        pickup_coords: {
          lat:
            parseFloat(
              order.pickup_location?.latitude || order.pickup_location?.lat,
            ) || 21.2187,
          lng:
            parseFloat(
              order.pickup_location?.longitude || order.pickup_location?.lng,
            ) || 105.8042,
        },
        dropoff:
          order.delivery_location?.address ||
          order.delivery_location?.name ||
          (order.receiver_name
            ? `${order.receiver_name} - ${order.receiver_phone}`
            : "KCN Tiên Sơn, Bắc Ninh"),
        delivery_address:
          order.delivery_location?.address ||
          order.delivery_location?.name ||
          "KCN Tiên Sơn, Bắc Ninh",
        dropoff_coords: {
          lat:
            parseFloat(
              order.delivery_location?.latitude || order.delivery_location?.lat,
            ) || 21.1215,
          lng:
            parseFloat(
              order.delivery_location?.longitude ||
                order.delivery_location?.lng,
            ) || 105.9754,
        },
        delivery_coords: {
          lat:
            parseFloat(
              order.delivery_location?.latitude || order.delivery_location?.lat,
            ) || 21.1215,
          lng:
            parseFloat(
              order.delivery_location?.longitude ||
                order.delivery_location?.lng,
            ) || 105.9754,
        },
        receiver_name: order.receiver_name || "",
        receiver_phone: order.receiver_phone || "",
        status: feStatus,
        source: order.source || (isFromWeb ? "HOMEPAGE" : "HOTLINE"),
        package_count: cargo.quantity || 1,
        package_unit: cargo.unit || (isBulk ? "Chuyến" : "Kiện"),
        cargo_name:
          cargo.cargo_name ||
          order.order_notes?.[0]?.content ||
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
        estimated_distance_km: 35.5,
        estimated_duration_mins: 45,
        agreed_price: parseInt(order.agreed_price) || 0,
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
        customer_tax_code: order.customer?.tax_code || "",
        items: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.items || null;
          } catch (e) {
            return null;
          }
        })(),
        web_workflow: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.web_workflow || null;
          } catch (e) {
            return null;
          }
        })(),
        contract_uploaded: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return !!(
              meta.contract_uploaded ||
              meta.contract_file ||
              meta.web_workflow?.signed_contract
            );
          } catch (e) {
            return false;
          }
        })(),
        contract_file: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return (
              meta.contract_file ||
              meta.web_workflow?.signed_contract?.contract_file ||
              null
            );
          } catch (e) {
            return null;
          }
        })(),
        contract_file_data: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.contract_file_data || null;
          } catch (e) {
            return null;
          }
        })(),
        contract_uploaded_at: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return (
              meta.contract_uploaded_at ||
              meta.web_workflow?.signed_contract?.signed_at ||
              null
            );
          } catch (e) {
            return null;
          }
        })(),
        documents: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            const docs =
              meta.documents ||
              meta.web_workflow?.approved_documents ||
              meta.web_workflow?.documents;
            return Array.isArray(docs) && docs.length > 0 ? docs : null;
          } catch (e) {
            return null;
          }
        })(),
        shipping_direction: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return (
              meta.shipping_direction ||
              (order.order_type === "PICKUP" ? "EXPORT" : "IMPORT")
            );
          } catch (e) {
            return "IMPORT";
          }
        })(),
        assigned_warehouse: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.assigned_warehouse || "WH-1";
          } catch (e) {
            return "WH-1";
          }
        })(),
        customs_location: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.customs_location || "NOI_BAI";
          } catch (e) {
            return "NOI_BAI";
          }
        })(),
        customs_channel: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.customs_channel || "GREEN";
          } catch (e) {
            return "GREEN";
          }
        })(),
        seal_number: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.seal_number || "";
          } catch (e) {
            return "";
          }
        })(),
        authorized_bank: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.authorized_bank || "Vietcombank";
          } catch (e) {
            return "Vietcombank";
          }
        })(),
        accounting_email: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.accounting_email || order.customer?.email || "";
          } catch (e) {
            return "";
          }
        })(),
        invoice_status: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.invoice_status || "NOT_ISSUED";
          } catch (e) {
            return "NOT_ISSUED";
          }
        })(),
        invoice_number: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.invoice_number || null;
          } catch (e) {
            return null;
          }
        })(),
        invoice_issued_at: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.invoice_issued_at || null;
          } catch (e) {
            return null;
          }
        })(),
        invoice_data: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.invoice || null;
          } catch (e) {
            return null;
          }
        })(),
        flight_arrival_date: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.flight_arrival_date || null;
          } catch (e) {
            return null;
          }
        })(),
        flight_arrival_time: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.flight_arrival_time || null;
          } catch (e) {
            return null;
          }
        })(),
        flight_datetime: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.flight_datetime || null;
          } catch (e) {
            return null;
          }
        })(),
        export_pickup_suggestion: (() => {
          try {
            const meta = order.ai_input_text
              ? JSON.parse(order.ai_input_text)
              : {};
            return meta.export_pickup_suggestion || null;
          } catch (e) {
            return null;
          }
        })(),
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
        customer:customers(id, company_name, tax_code, email),
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, latitude, longitude),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, latitude, longitude),
        order_cargos(*),
        order_notes(*)
      `);

    const cleanToken = (token || "").trim();
    // Hỗ trợ tìm kiếm linh hoạt theo tracking_token HOẶC mã đơn order_code
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
      return res
        .status(404)
        .json({
          message: "Không tìm thấy đơn hàng tương ứng với mã token này",
        });
    }

    const order = orders[0];
    const extraMeta = parseOrderMeta(order);
    const cargoObj =
      (Array.isArray(order.order_cargos)
        ? order.order_cargos[0]
        : order.order_cargos) || {};

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
        actual_weight_kg:
          cargoObj.actual_weight_kg || order.actual_weight_kg || 0,
        chargeable_weight_kg:
          cargoObj.chargeable_weight_kg || order.chargeable_weight_kg || 0,
        pickup_address: order.pickup_location?.address || "Hà Nội",
        delivery_address: order.delivery_location?.address || "Bắc Ninh",
        status: order.status,
        source: order.source,
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
