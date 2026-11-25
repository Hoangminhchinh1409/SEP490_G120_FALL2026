const prisma = require("../../config/prisma");
const { serializePrisma } = require("../../utils/prismaHelper");
const {
  generateNexOrderCode,
  ensureNexOrderCode,
  generateTrackingToken,
  saveOrderMeta,
} = require("../../services/orderHelperService");
const { validateVietnamAddressText } = require("../../utils/addressValidator");
const {
  toDateObj,
  getVehicleMaxPayload,
  getNextDispatcherForWebOrder,
  resolveOrderPickupAndDeliveryLocations,
  calculateConsultationCargoMetrics,
  validateDirectOrderInput,
  buildDirectOrderCargoRows,
} = require("./orderCreationHelper");

// 2. KHÁCH HÀNG GỬI YÊU CẦU TƯ VẤN TỪ HOMEPAGE
const createConsultationOrder = async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_tax_code,
      pickup_address,
      pickup_coords,
      delivery_address,
      delivery_coords,
      cargo_name,
      cargo_type,
      package_count,
      package_unit,
      length_cm,
      width_cm,
      height_cm,
      weight,
      items,
      notes,
      receiver_name,
      receiver_phone,
      required_pickup_date,
      vehicle_type_required,
      loading_unloading_required,
      declared_value_usd,
      authorized_bank,
      accounting_email,
      flight_arrival_date,
      flight_arrival_time,
      flight_datetime,
      export_pickup_suggestion,
    } = req.body;

    // Validate chống nhập địa chỉ gõ bừa/vô nghĩa cho các điểm giao nhận không phải kho ALS
    if (
      !req.body.pickup_location_id &&
      pickup_address &&
      String(pickup_address).trim()
    ) {
      const pCheck = validateVietnamAddressText(pickup_address);
      if (!pCheck.valid) {
        return res
          .status(400)
          .json({ message: `Điểm lấy hàng không hợp lệ: ${pCheck.reason}` });
      }
    }
    if (
      !req.body.delivery_location_id &&
      delivery_address &&
      String(delivery_address).trim()
    ) {
      const dCheck = validateVietnamAddressText(delivery_address);
      if (!dCheck.valid) {
        return res
          .status(400)
          .json({ message: `Điểm giao hàng không hợp lệ: ${dCheck.reason}` });
      }
    }

    // 1. Tìm hoặc tạo Customer (kèm Mã số thuế)
    let customerId = 16;
    const cleanPhone = (customer_phone || "").replace(/[^0-9]/g, "");
    const taxCode = customer_tax_code || cleanPhone.slice(-10) || "0988123456";

    const existingCust = await prisma.customers.findFirst({
      where: {
        OR: [
          { email: customer_email || "none@none.com" },
          { tax_code: taxCode },
        ],
      },
      select: { id: true },
    });

    let isNewCustomer = false;
    if (existingCust) {
      customerId = Number(existingCust.id);
    } else {
      isNewCustomer = true;
      try {
        const newCust = await prisma.customers.create({
          data: {
            company_name: customer_name || "Khách hàng trực tuyến",
            contact_person: customer_name || "Khách hàng",
            phone: cleanPhone || "0988123456",
            tax_code: taxCode,
            registered_address: pickup_address || delivery_address || "Hà Nội",
            email: customer_email || "client@nexlog.vn",
            created_by: 1n,
          },
          select: { id: true },
        });
        if (newCust) {
          customerId = Number(newCust.id);
        }
      } catch (custErr) {
        console.error("Error creating customer:", custErr);
      }
    }

    const finalPickupAddress =
      (pickup_address || "").trim() ||
      "Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội";
    const finalDeliveryAddress =
      (delivery_address || "").trim() || "KCN Tiên Sơn, Bắc Ninh";

    // 2. Lấy hoặc tạo Location cho điểm lấy và điểm giao
    const { pickupLocationId, deliveryLocationId } =
      await resolveOrderPickupAndDeliveryLocations({
        pickupLocationIdInput: req.body.pickup_location_id,
        deliveryLocationIdInput: req.body.delivery_location_id,
        finalPickupAddress,
        finalDeliveryAddress,
        pickupCustomerId: pickup_address ? customerId : null,
        deliveryCustomerId: delivery_address ? customerId : null,
        pickupCoords: pickup_coords,
        deliveryCoords: delivery_coords,
        contactName: customer_name,
        contactPhone: cleanPhone,
        isNewCustomer,
      });

    // 3. Tính toán trọng lượng (hỗ trợ nhiều loại hàng hóa)
    const {
      actualWeight,
      chargeableWeight,
      finalCargoDesc,
      totalPackages,
      l,
      w,
      h,
    } = calculateConsultationCargoMetrics({
      weight,
      cargo_name,
      cargo_type,
      package_count,
      length_cm,
      width_cm,
      height_cm,
      items,
    });

    // Validate quá tải trọng Backend cho đơn tư vấn
    const effectiveWeightConsultation = Math.max(
      actualWeight,
      chargeableWeight,
    );
    const maxPayloadConsultation = getVehicleMaxPayload(vehicle_type_required);
    if (effectiveWeightConsultation > maxPayloadConsultation) {
      return res.status(400).json({
        message: `Lô hàng nặng ${effectiveWeightConsultation.toLocaleString("vi-VN")} kg vượt quá tải trọng tối đa của loại xe ${vehicle_type_required || "đã chọn"} (${maxPayloadConsultation.toLocaleString("vi-VN")} kg). Vui lòng chọn xe có tải trọng lớn hơn!`,
      });
    }

    const randomCode = ensureNexOrderCode(generateNexOrderCode());
    const token = generateTrackingToken();

    const metadata = {
      shipping_direction: req.body.shipping_direction || "IMPORT",
      pickup_address: finalPickupAddress,
      delivery_address: finalDeliveryAddress,
      pickup_coords: pickup_coords || { lat: 21.2187, lng: 105.8042 },
      delivery_coords: delivery_coords || null,
      estimated_distance_km: parseFloat(req.body.estimated_distance_km) || 0,
      estimated_duration_mins:
        parseInt(req.body.estimated_duration_mins, 10) || 0,
      vehicle_type_required: vehicle_type_required || "TRUCK_2.5T",
      customer_requested_vehicle: vehicle_type_required || "TRUCK_2.5T",
      flight_arrival_date: flight_arrival_date || null,
      flight_arrival_time: flight_arrival_time || null,
      flight_datetime: flight_datetime || null,
      export_pickup_suggestion: export_pickup_suggestion || null,
      required_pickup_date: required_pickup_date || flight_arrival_date || null,
      operating_time_slot: req.body.operating_time_slot || "FULL_DAY",
      customer_email: customer_email || null,
      customer_tax_code: taxCode,
      accounting_email: accounting_email || customer_email || null,
      authorized_bank: authorized_bank || "Vietcombank",
      items: items || null,
      user_note: notes || null,
      request_split_trucks: Boolean(req.body.request_split_trucks),
      split_details: req.body.split_details || null,
      web_workflow: {
        stage: "CREATED",
        request_split_trucks: Boolean(req.body.request_split_trucks),
        split_details: req.body.split_details || null,
      },
    };

    // 4. Tìm điều phối viên nhận đơn Web xoay vòng (Least Loaded Round-Robin)
    const assignedDispatcherId = await getNextDispatcherForWebOrder();

    // 5. Insert vào bảng orders
    const createdOrderRaw = await prisma.orders.create({
      data: {
        order_code: randomCode,
        order_type:
          req.body.shipping_direction === "EXPORT" ? "Export" : "Import",
        customer_id: BigInt(customerId),
        tracking_token: token,
        pickup_location_id: BigInt(Number(pickupLocationId)),
        delivery_location_id: BigInt(Number(deliveryLocationId)),
        receiver_name:
          (receiver_name && (receiver_name + "").trim()) ||
          customer_name ||
          "Khách hàng trực tuyến",
        receiver_phone:
          (receiver_phone && (receiver_phone + "").replace(/[^0-9]/g, "")) ||
          cleanPhone ||
          "0988123456",
        agreed_price: 0n,
        status: "DRAFT",
        source: "Web",
        responsible_dispatcher_id: BigInt(Number(assignedDispatcherId)),
        created_by: BigInt(Number(assignedDispatcherId)),
        requested_pickup_date: toDateObj(
          required_pickup_date || req.body.flight_arrival_date,
        ),
        truck_type_requested: vehicle_type_required || "TRUCK_2.5T",
        loading_request:
          loading_unloading_required === true ||
          loading_unloading_required === "true"
            ? "YES"
            : "NO",
        warehouse_type: "ALS warehouse",
        customer_agrees_to_grouping: false,
        document_status: "Pending Documents",
        is_closed: false,
        waiting_too_long: false,
        late_risk: false,
      },
    });

    const createdOrder = serializePrisma(createdOrderRaw);
    await saveOrderMeta(createdOrder.id, metadata);

    // 5. Insert vào bảng order_cargos
    try {
      await prisma.order_cargos.create({
        data: {
          order_id: createdOrderRaw.id,
          cargo_type:
            cargo_type === "BULK"
              ? "Bulk"
              : cargo_type === "PALLET"
                ? "Pallet"
                : "General",
          cargo_name: finalCargoDesc,
          quantity: totalPackages,
          unit: package_unit || "Kiện",
          actual_weight_kg: actualWeight,
          length_cm: l,
          width_cm: w,
          height_cm: h,
          stackable: true,
          chargeable_weight_kg: parseFloat(chargeableWeight.toFixed(2)),
          declared_value: declared_value_usd
            ? BigInt(Math.round(parseFloat(declared_value_usd) * 25000))
            : 0n,
          special_request_note: notes || null,
        },
      });
    } catch (cargoErr) {
      console.error("createConsultationOrder Cargo Insert Error:", cargoErr);
    }

    // 6. Thêm ghi chú vào bảng order_notes nếu có hoặc nếu khách yêu cầu chia xe
    let initialNoteContent = notes ? notes.trim() : "";
    if (req.body.request_split_trucks && req.body.split_details) {
      const splitInfo = `[KHÁCH YÊU CẦU TÁCH ${req.body.split_details.split_count || 2} XE NHỎ KHI TẠO ĐƠN]: Loại xe mong muốn: ${req.body.split_details.vehicle_target_label || req.body.split_details.vehicle_target}. Lý do: ${req.body.split_details.reason || "Đường kho hẹp"}.`;
      initialNoteContent = initialNoteContent
        ? `${splitInfo} Ghi chú khách: ${initialNoteContent}`
        : splitInfo;
    }

    if (initialNoteContent.length > 0) {
      await prisma.order_notes.create({
        data: {
          order_id: createdOrderRaw.id,
          content: initialNoteContent.slice(0, 480),
          created_by: 1n,
        },
      });
    }

    return res.status(201).json({
      message: "Đăng ký tư vấn thành công!",
      order: {
        id: createdOrder.id,
        order_id: createdOrder.order_code,
        customer_phone,
        status: "DRAFT",
        source: "Web",
        tracking_token: token,
      },
    });
  } catch (err) {
    console.error("createConsultationOrder Exception:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 3. ĐIỀU PHỐI VIÊN TẠO ĐƠN TRỰC TIẾP (HOTLINE / TRỰC TIẾP)
const createDirectOrder = async (req, res) => {
  try {
    // 0. Bắt buộc xác thực người dùng (BUG-DO-02)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const directDispatcherId = req.user.id;

    const {
      customer_name,
      customer_address,
      is_new_customer,
      pickup_address,
      delivery_address,
      order_notes,
      cargo_type,
      package_count,
      package_unit,
      pickup_coords,
      delivery_coords,
      receiver_name,
      required_pickup_date,
      vehicle_type_required,
      loading_unloading_required,
      authorized_bank,
      accounting_email,
    } = req.body;

    // 1 & 2. Validate bắt buộc, định dạng & địa chỉ (BUG-DO-04, BUG-DO-05)
    const validation = validateDirectOrderInput(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }
    const {
      parsedWeight,
      parsedPrice,
      cleanCustomerPhone,
      cleanReceiverPhone,
      cleanCustomerEmail,
      cleanTaxCode,
    } = validation;

    // 3. Chuẩn bị địa chỉ và tọa độ điểm lấy / điểm giao
    const finalPickupAddress =
      (pickup_address || "").trim() ||
      "Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội";
    const finalDeliveryAddress =
      (delivery_address || customer_address || "").trim() ||
      "KCN Tiên Sơn, Bắc Ninh";

    const { pickupLocationId, deliveryLocationId } =
      await resolveOrderPickupAndDeliveryLocations({
        pickupLocationIdInput: req.body.pickup_location_id,
        deliveryLocationIdInput: req.body.delivery_location_id,
        finalPickupAddress,
        finalDeliveryAddress,
        pickupCustomerId: null,
        deliveryCustomerId: null,
        pickupCoords: pickup_coords,
        deliveryCoords: delivery_coords,
        contactName: customer_name,
        contactPhone: cleanCustomerPhone,
        isNewCustomer: Boolean(is_new_customer),
      });

    const hasUploadedDocs =
      Array.isArray(req.body.documents) &&
      req.body.documents.some((d) => d.file && d.file !== "Chờ tải lên");

    // 4. Thực thi toàn bộ quá trình tạo Khách hàng, Đơn hàng, Hàng hóa, Phụ phí và Chứng từ trong Transaction (BUG-DO-09)
    const createdOrderRaw = await prisma.$transaction(async (tx) => {
      let customerId = null;

      if (!is_new_customer) {
        const lookupConditions = [];
        if (cleanTaxCode) lookupConditions.push({ tax_code: cleanTaxCode });
        if (cleanCustomerEmail)
          lookupConditions.push({ email: cleanCustomerEmail });

        if (lookupConditions.length > 0) {
          const existingCust = await tx.customers.findFirst({
            where: { OR: lookupConditions },
            select: { id: true, tax_code: true, company_name: true },
          });
          if (existingCust) {
            customerId = Number(existingCust.id);
          }
        }
      } else if (cleanTaxCode) {
        const duplicateCust = await tx.customers.findFirst({
          where: { tax_code: cleanTaxCode },
          select: { id: true, company_name: true },
        });
        if (duplicateCust) {
          const err = new Error(
            `Mã số thuế ${cleanTaxCode} đã tồn tại trong hệ thống (Công ty: ${duplicateCust.company_name}). Vui lòng bỏ chọn 'Khách hàng mới' để tiếp tục!`,
          );
          err.statusCode = 400;
          throw err;
        }
      }

      if (!customerId) {
        const newCust = await tx.customers.create({
          data: {
            company_name: String(customer_name).trim(),
            contact_person: String(customer_name).trim(),
            phone: cleanCustomerPhone,
            tax_code: cleanTaxCode || null,
            registered_address:
              customer_address || delivery_address || "Hà Nội",
            email: cleanCustomerEmail,
            created_by: BigInt(directDispatcherId),
          },
          select: { id: true },
        });
        customerId = Number(newCust.id);
      }

      if (!customerId) {
        throw new Error(
          "Không thể khởi tạo hoặc xác thực thông tin khách hàng",
        );
      }

      const orderCode = ensureNexOrderCode(generateNexOrderCode());
      const token = generateTrackingToken();

      // 4.2 Tạo đơn hàng (Status luôn bắt đầu từ CONFIRMED)
      const orderRecord = await tx.orders.create({
        data: {
          order_code: orderCode,
          order_type:
            req.body.shipping_direction === "EXPORT" ? "Export" : "Import",
          customer_id: BigInt(customerId),
          tracking_token: token,
          pickup_location_id: BigInt(Number(pickupLocationId)),
          delivery_location_id: BigInt(Number(deliveryLocationId)),
          receiver_name: String(receiver_name).trim(),
          receiver_phone: cleanReceiverPhone,
          agreed_price: BigInt(parsedPrice),
          status: "CONFIRMED",
          source: req.body.source || "Direct",
          responsible_dispatcher_id: BigInt(directDispatcherId),
          created_by: BigInt(directDispatcherId),
          requested_pickup_date: toDateObj(
            required_pickup_date || req.body.flight_arrival_date,
          ),
          truck_type_requested: vehicle_type_required || "TRUCK_2.5T",
          loading_request:
            loading_unloading_required === true ||
            loading_unloading_required === "true"
              ? "YES"
              : "NO",
          warehouse_type: "ALS warehouse",
          customer_agrees_to_grouping: false,
          document_status: hasUploadedDocs
            ? "Pending Review"
            : "Pending Documents",
          is_closed: false,
          waiting_too_long: false,
          late_risk: false,
          ready_for_planning_at: null,
        },
      });

      // 4.3 Tạo các dòng hàng hóa order_cargos (BUG-DO-07)
      const cargoRows = buildDirectOrderCargoRows(
        orderRecord.id,
        req.body,
        parsedWeight,
      );
      for (const cRow of cargoRows) {
        await tx.order_cargos.create({ data: cRow });
      }

      // 4.4 Lưu phụ phí dịch vụ hải quan nếu được tick chọn (BUG-DO-06)
      if (
        req.body.customs_service_required === true ||
        req.body.customs_service_required === "true" ||
        Number(req.body.customs_fee) > 0
      ) {
        const customsAmount =
          Number(req.body.customs_fee) > 0
            ? Number(req.body.customs_fee)
            : 500000;
        await tx.extra_fees.create({
          data: {
            order_id: orderRecord.id,
            fee_type: "Hải quan",
            amount: BigInt(customsAmount),
            reason: "Phí dịch vụ làm thủ tục hải quan",
            suggested_by_system: false,
            recorded_by: BigInt(directDispatcherId),
            status: "CONFIRMED",
            source: "Dispatcher",
          },
        });
      }

      // 4.5 Lưu phụ phí vận chuyển bổ sung nếu có (BUG-DO-06)
      const extraFeeSurcharge = parseFloat(req.body.extra_fees_surcharge);
      if (!isNaN(extraFeeSurcharge) && extraFeeSurcharge > 0) {
        await tx.extra_fees.create({
          data: {
            order_id: orderRecord.id,
            fee_type: "Phụ phí",
            amount: BigInt(Math.round(extraFeeSurcharge)),
            reason:
              req.body.extra_fees_reason || "Phụ phí vận chuyển thỏa thuận",
            suggested_by_system: false,
            recorded_by: BigInt(directDispatcherId),
            status: "CONFIRMED",
            source: "Dispatcher",
          },
        });
      }

      const extraFeeCollection = parseFloat(req.body.extra_fees_collection);
      if (!isNaN(extraFeeCollection) && extraFeeCollection > 0) {
        await tx.extra_fees.create({
          data: {
            order_id: orderRecord.id,
            fee_type: "Phát sinh",
            amount: BigInt(Math.round(extraFeeCollection)),
            reason: "Phí phát sinh khác",
            suggested_by_system: false,
            recorded_by: BigInt(directDispatcherId),
            status: "CONFIRMED",
            source: "Dispatcher",
          },
        });
      }

      // 4.6 Tạo bản ghi riêng chờ duyệt cho từng chứng từ (BUG-DO-06)
      if (Array.isArray(req.body.documents) && req.body.documents.length > 0) {
        for (const doc of req.body.documents) {
          const hasFile = doc.file && doc.file !== "Chờ tải lên";
          await tx.customer_documents.create({
            data: {
              order_id: orderRecord.id,
              document_type: String(doc.name || doc.title || "Chứng từ").slice(
                0,
                50,
              ),
              is_required: true,
              file_link: hasFile ? String(doc.file).slice(0, 255) : null,
              file_type: doc.file_type
                ? String(doc.file_type).slice(0, 10)
                : hasFile
                  ? "pdf"
                  : null,
              file_size: doc.file_size ? parseInt(doc.file_size, 10) : null,
              uploaded_by: hasFile ? BigInt(directDispatcherId) : null,
              uploaded_time: hasFile ? new Date() : null,
              status: hasFile ? "Pending Review" : "Required",
            },
          });
        }
      }

      // 4.7 Lưu ghi chú điều phối (BUG-DO-08: created_by = directDispatcherId)
      const noteParts = [
        order_notes,
        req.body.request_split_trucks && req.body.split_details
          ? `[ĐIỀU PHỐI YÊU CẦU TÁCH ${req.body.split_details.split_count || 2} XE NHỎ]: Xe ${req.body.split_details.vehicle_target_label || req.body.split_details.vehicle_target}. Lý do: ${req.body.split_details.reason || "Kho hẹp"}`
          : "",
        pickup_address ? `Điểm lấy hàng: ${pickup_address}` : "",
        customer_address ? `Địa chỉ KH: ${customer_address}` : "",
        cargo_type ? `Loại hàng: ${cargo_type}` : "",
        package_unit ? `Quy cách: ${package_count || 1} ${package_unit}` : "",
      ].filter(Boolean);

      if (noteParts.length > 0) {
        await tx.order_notes.create({
          data: {
            order_id: orderRecord.id,
            content: noteParts.join(" | ").slice(0, 500),
            created_by: BigInt(directDispatcherId),
          },
        });
      }

      return orderRecord;
    });

    const directMeta = {
      shipping_direction: req.body.shipping_direction || "IMPORT",
      pickup_address: finalPickupAddress,
      delivery_address: finalDeliveryAddress,
      pickup_coords: pickup_coords || { lat: 21.2187, lng: 105.8042 },
      delivery_coords: delivery_coords || null,
      vehicle_type_required: vehicle_type_required || "TRUCK_2.5T",
      customer_requested_vehicle: vehicle_type_required || "TRUCK_2.5T",
      flight_arrival_date: req.body.flight_arrival_date || null,
      flight_arrival_time: req.body.flight_arrival_time || null,
      flight_datetime: req.body.flight_datetime || null,
      export_pickup_suggestion: req.body.export_pickup_suggestion || null,
      required_pickup_date:
        required_pickup_date || req.body.flight_arrival_date || null,
      operating_time_slot: req.body.operating_time_slot || "FULL_DAY",
      customer_email: cleanCustomerEmail,
      accounting_email: accounting_email || cleanCustomerEmail,
      authorized_bank: authorized_bank || "Vietcombank",
      items: req.body.items || null,
      documents: req.body.documents || null,
      request_split_trucks: Boolean(req.body.request_split_trucks),
      split_details: req.body.split_details || null,
      web_workflow: {
        stage: hasUploadedDocs ? "DOCS_UPLOADED" : "CUSTOMER_CONFIRMED",
        request_split_trucks: Boolean(req.body.request_split_trucks),
        split_details: req.body.split_details || null,
      },
    };

    const createdOrder = serializePrisma(createdOrderRaw);
    await saveOrderMeta(createdOrder.id, directMeta, directDispatcherId);

    return res.status(201).json({
      message: "Tạo đơn vận chuyển thành công!",
      order: createdOrder,
    });
  } catch (err) {
    console.error("createDirectOrder Exception:", err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    return res
      .status(500)
      .json({ message: err.message || "Internal Server Error" });
  }
};

module.exports = {
  createConsultationOrder,
  createDirectOrder,
};
