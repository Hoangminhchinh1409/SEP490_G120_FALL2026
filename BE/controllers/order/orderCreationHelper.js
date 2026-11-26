const {
  resolveAlsLocationIdIfValid,
  getOrCreateLocation,
  getNextDispatcherForWebOrder,
} = require("../../services/orderHelperService");
const { validateVietnamAddressText } = require("../../utils/addressValidator");

const toDateObj = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).split("T")[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
};

// Bảng thông số tải trọng xe chuẩn ALS
const VEHICLE_MAX_PAYLOAD = {
  "TRUCK_1.25T": 1250,
  "TRUCK_2.5T": 2500,
  "TRUCK_3.5T": 3500,
  TRUCK_5T: 5000,
  CONTAINER_20: 12000,
  CONTAINER_40: 25000,
};

const getVehicleMaxPayload = (vKey) => {
  if (!vKey) return 2500;
  const normalized = String(vKey).toUpperCase().trim();
  if (VEHICLE_MAX_PAYLOAD[normalized]) return VEHICLE_MAX_PAYLOAD[normalized];
  if (VEHICLE_MAX_PAYLOAD[`TRUCK_${normalized}`])
    return VEHICLE_MAX_PAYLOAD[`TRUCK_${normalized}`];
  if (normalized.includes("1.25")) return 1250;
  if (normalized.includes("2.5")) return 2500;
  if (normalized.includes("3.5")) return 3500;
  if (normalized.includes("5")) return 5000;
  if (normalized.includes("20")) return 12000;
  if (normalized.includes("40")) return 25000;
  return 2500;
};

const resolveOrderPickupAndDeliveryLocations = async ({
  pickupLocationIdInput,
  deliveryLocationIdInput,
  finalPickupAddress,
  finalDeliveryAddress,
  pickupCustomerId = null,
  deliveryCustomerId = null,
  pickupCoords,
  deliveryCoords,
  contactName,
  contactPhone,
  isNewCustomer,
}) => {
  const validatedPickupAlsId = await resolveAlsLocationIdIfValid(
    pickupLocationIdInput,
  );
  const pickupLocationId =
    validatedPickupAlsId ||
    (await getOrCreateLocation({
      name: finalPickupAddress,
      address: finalPickupAddress,
      customerId: pickupCustomerId,
      type: "CUSTOMER_SITE",
      lat: pickupCoords?.lat,
      lng: pickupCoords?.lng,
      contactName,
      contactPhone,
      isNewCustomer,
    }));

  const validatedDeliveryAlsId = await resolveAlsLocationIdIfValid(
    deliveryLocationIdInput,
  );
  const deliveryLocationId =
    validatedDeliveryAlsId ||
    (await getOrCreateLocation({
      name: finalDeliveryAddress,
      address: finalDeliveryAddress,
      customerId: deliveryCustomerId,
      type: "CUSTOMER_SITE",
      lat: deliveryCoords?.lat,
      lng: deliveryCoords?.lng,
      contactName,
      contactPhone,
      isNewCustomer,
    }));

  return { pickupLocationId, deliveryLocationId };
};

const calculateConsultationCargoMetrics = ({
  weight,
  cargo_name,
  cargo_type,
  package_count,
  length_cm,
  width_cm,
  height_cm,
  items,
}) => {
  let actualWeight = parseFloat(weight) || 0;
  let chargeableWeight = 0;
  let finalCargoDesc = cargo_name || "Hàng bách hóa / Linh kiện";
  let totalPackages = parseInt(package_count, 10) || 1;
  let l = parseFloat(length_cm) || 0;
  let w = parseFloat(width_cm) || 0;
  let h = parseFloat(height_cm) || 0;

  if (items && Array.isArray(items) && items.length > 0) {
    totalPackages = items.reduce(
      (sum, it) => sum + (parseInt(it.package_count, 10) || 1),
      0,
    );
    actualWeight = items.reduce((sum, it) => {
      const unitW = parseFloat(it.weight) || 0;
      const cnt = parseInt(it.package_count, 10) || 1;
      return sum + unitW * cnt;
    }, 0);
    chargeableWeight = items.reduce((sum, it) => {
      const unitW = parseFloat(it.weight) || 0;
      const cnt = parseInt(it.package_count, 10) || 1;
      const totalItemW = unitW * cnt;
      if (it.cargo_type === "BULK") return sum + totalItemW;
      const unitVol =
        ((parseFloat(it.length_cm) || 0) *
          (parseFloat(it.width_cm) || 0) *
          (parseFloat(it.height_cm) || 0)) /
        5000;
      const totalItemVol = unitVol * cnt;
      return sum + Math.max(totalItemW, totalItemVol);
    }, 0);
    finalCargoDesc = items
      .map(
        (it) =>
          `${it.cargo_name || "Hàng"} (${it.package_count || 1} ${it.package_unit || "kiện"})`,
      )
      .join(", ");
    l = Math.max(1, parseFloat(items[0]?.length_cm) || 100);
    w = Math.max(1, parseFloat(items[0]?.width_cm) || 80);
    h = Math.max(1, parseFloat(items[0]?.height_cm) || 100);
  } else {
    const isBulk = cargo_type === "BULK";
    l = isBulk ? 1 : Math.max(1, parseFloat(length_cm) || 120);
    w = isBulk ? 1 : Math.max(1, parseFloat(width_cm) || 100);
    h = isBulk ? 1 : Math.max(1, parseFloat(height_cm) || 150);
    actualWeight = actualWeight || 0;
    const volWeight = isBulk ? 0 : (l * w * h) / 5000;
    chargeableWeight = isBulk
      ? actualWeight
      : Math.max(actualWeight, volWeight);
  }

  return {
    actualWeight,
    chargeableWeight,
    finalCargoDesc,
    totalPackages,
    l,
    w,
    h,
  };
};

const validateDirectOrderInput = (body) => {
  const {
    customer_name,
    customer_phone,
    customer_email,
    customer_address,
    pickup_address,
    delivery_address,
    weight_kg,
    agreed_price,
    cargo_name,
    receiver_name,
    receiver_phone,
  } = body;

  if (!customer_name || !String(customer_name).trim()) {
    return { error: "Vui lòng nhập tên khách hàng / tên công ty" };
  }
  if (!customer_phone || !String(customer_phone).trim()) {
    return { error: "Vui lòng nhập số điện thoại khách hàng" };
  }
  if (!customer_email || !String(customer_email).trim()) {
    return { error: "Vui lòng nhập email khách hàng" };
  }
  if (
    !body.pickup_location_id &&
    (!pickup_address || !String(pickup_address).trim())
  ) {
    return { error: "Vui lòng chọn hoặc nhập điểm lấy hàng" };
  }
  if (
    !body.delivery_location_id &&
    ((!delivery_address && !customer_address) ||
      !String(delivery_address || customer_address).trim())
  ) {
    return { error: "Vui lòng chọn hoặc nhập điểm giao hàng" };
  }
  if (!receiver_name || !String(receiver_name).trim()) {
    return { error: "Vui lòng nhập tên người nhận hàng / liên hệ" };
  }
  if (!receiver_phone || !String(receiver_phone).trim()) {
    return {
      error: "Vui lòng nhập số điện thoại người nhận hàng / liên hệ",
    };
  }

  const hasItemsArr = Array.isArray(body.items) && body.items.length > 0;
  const primaryCargoName = hasItemsArr ? body.items[0]?.cargo_name : cargo_name;
  if (!primaryCargoName || !String(primaryCargoName).trim()) {
    return { error: "Vui lòng nhập tên mặt hàng vận chuyển" };
  }

  const parsedWeight = parseFloat(
    weight_kg ||
      (hasItemsArr
        ? body.items.reduce(
            (sum, it) =>
              sum +
              (parseFloat(it.weight_kg || it.actual_weight || it.weight) || 0),
            0,
          )
        : null),
  );
  if (isNaN(parsedWeight) || parsedWeight <= 0) {
    return {
      error: "Trọng lượng hàng hóa không hợp lệ (phải lớn hơn 0 kg)",
    };
  }
  if (parsedWeight > 4000) {
    return {
      error: `Tổng trọng lượng đơn hàng (${parsedWeight.toLocaleString("vi-VN")} kg) vượt quá giới hạn tối đa 4.000 kg cho mỗi đơn hàng`,
    };
  }

  const parsedPrice = parseInt(agreed_price, 10);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return {
      error: "Giá cước thỏa thuận không hợp lệ (phải lớn hơn 0 VNĐ)",
    };
  }

  if (String(customer_name).trim().length > 255) {
    return { error: "Tên khách hàng quá dài (tối đa 255 ký tự)" };
  }
  if (String(receiver_name).trim().length > 255) {
    return { error: "Tên người nhận quá dài (tối đa 255 ký tự)" };
  }

  const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
  const cleanCustomerPhone = String(customer_phone)
    .trim()
    .replace(/[\s.-]/g, "");
  if (!phoneRegex.test(cleanCustomerPhone)) {
    return {
      error:
        "Số điện thoại khách hàng không đúng định dạng (yêu cầu 10 chữ số hợp lệ, bắt đầu bằng 03, 05, 07, 08 hoặc 09)",
    };
  }

  const cleanReceiverPhone = String(receiver_phone)
    .trim()
    .replace(/[\s.-]/g, "");
  if (!phoneRegex.test(cleanReceiverPhone)) {
    return {
      error:
        "Số điện thoại người nhận không đúng định dạng (yêu cầu 10 chữ số hợp lệ)",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleanCustomerEmail = String(customer_email).trim().toLowerCase();
  if (!emailRegex.test(cleanCustomerEmail)) {
    return { error: "Email khách hàng không đúng định dạng" };
  }

  let cleanTaxCode = null;
  if (body.customer_tax_code && String(body.customer_tax_code).trim()) {
    cleanTaxCode = String(body.customer_tax_code).trim();
    const taxCodeRegex = /^[0-9]{10}(-[0-9]{3})?$|^[0-9]{13}$/;
    if (!taxCodeRegex.test(cleanTaxCode)) {
      return {
        error:
          "Mã số thuế không đúng định dạng (yêu cầu 10 chữ số hoặc 13 chữ số, ví dụ 0101234567 hoặc 0101234567-001)",
      };
    }
  }

  if (customer_address && String(customer_address).trim()) {
    const cCheck = validateVietnamAddressText(customer_address);
    if (!cCheck.valid) {
      return {
        error: `Địa chỉ trụ sở / kho khách hàng không hợp lệ: ${cCheck.reason}`,
      };
    }
  }
  if (
    !body.pickup_location_id &&
    pickup_address &&
    String(pickup_address).trim()
  ) {
    const pCheck = validateVietnamAddressText(pickup_address);
    if (!pCheck.valid) {
      return { error: `Điểm lấy hàng không hợp lệ: ${pCheck.reason}` };
    }
  }
  if (
    !body.delivery_location_id &&
    delivery_address &&
    String(delivery_address).trim()
  ) {
    const dCheck = validateVietnamAddressText(delivery_address);
    if (!dCheck.valid) {
      return { error: `Điểm giao hàng không hợp lệ: ${dCheck.reason}` };
    }
  }

  return {
    parsedWeight,
    parsedPrice,
    cleanCustomerPhone,
    cleanReceiverPhone,
    cleanCustomerEmail,
    cleanTaxCode,
  };
};

const buildDirectOrderCargoRows = (orderId, body, parsedWeight) => {
  const {
    items,
    cargo_type,
    cargo_name,
    package_count,
    package_unit,
    length_cm,
    width_cm,
    height_cm,
    declared_value_usd,
    order_notes,
  } = body;

  const cargoRows = [];
  if (Array.isArray(items) && items.length > 0) {
    for (const it of items) {
      const itBulk = it.cargo_type === "BULK" || it.cargo_type === "Bulk";
      const itActualWeight =
        parseFloat(it.weight_kg || it.actual_weight || it.weight) || 0;
      let itLength = null;
      let itWidth = null;
      let itHeight = null;
      let itStackable = true;
      let itChargeable = itActualWeight;

      if (itBulk) {
        itStackable = false;
      } else {
        const hasDimensions =
          (it.length_cm && parseFloat(it.length_cm) > 0) ||
          (it.width_cm && parseFloat(it.width_cm) > 0) ||
          (it.height_cm && parseFloat(it.height_cm) > 0);
        if (hasDimensions) {
          itLength = parseFloat(it.length_cm) || 0;
          itWidth = parseFloat(it.width_cm) || 0;
          itHeight = parseFloat(it.height_cm) || 0;
          const volWeight = (itLength * itWidth * itHeight) / 5000;
          itChargeable = Math.max(itActualWeight, volWeight);
          itStackable = it.stackable !== false;
        } else {
          itStackable = it.stackable !== false;
        }
      }

      cargoRows.push({
        order_id: orderId,
        cargo_type: itBulk
          ? "Bulk"
          : it.cargo_type === "PALLET" || it.cargo_type === "Pallet"
            ? "Pallet"
            : "General",
        cargo_name: it.cargo_name || "Hàng hóa",
        quantity: parseInt(it.package_count || it.quantity, 10) || 1,
        unit: it.package_unit || (itBulk ? "Chuyến" : "Kiện"),
        actual_weight_kg: itActualWeight,
        length_cm: itLength,
        width_cm: itWidth,
        height_cm: itHeight,
        stackable: itStackable,
        chargeable_weight_kg: parseFloat(itChargeable.toFixed(2)),
        declared_value: it.declared_value_usd
          ? BigInt(Math.round(parseFloat(it.declared_value_usd) * 25000))
          : 0n,
        special_request_note: it.note || order_notes || null,
      });
    }
  } else {
    const isBulk = cargo_type === "BULK" || cargo_type === "Bulk";
    let l = null;
    let w = null;
    let h = null;
    let stackable = true;
    let chargeable = parsedWeight;

    if (isBulk) {
      stackable = false;
    } else {
      const hasDims =
        (length_cm && parseFloat(length_cm) > 0) ||
        (width_cm && parseFloat(width_cm) > 0) ||
        (height_cm && parseFloat(height_cm) > 0);
      if (hasDims) {
        l = parseFloat(length_cm) || 0;
        w = parseFloat(width_cm) || 0;
        h = parseFloat(height_cm) || 0;
        const volWeight = (l * w * h) / 5000;
        chargeable = Math.max(parsedWeight, volWeight);
      }
    }

    cargoRows.push({
      order_id: orderId,
      cargo_type: isBulk
        ? "Bulk"
        : cargo_type === "PALLET" || cargo_type === "Pallet"
          ? "Pallet"
          : "General",
      cargo_name:
        cargo_name ||
        (isBulk ? "Hàng rời tính theo trọng tải" : "Hàng bách hóa / Linh kiện"),
      quantity: parseInt(package_count, 10) || 1,
      unit: package_unit || (isBulk ? "Chuyến" : "Kiện"),
      actual_weight_kg: parsedWeight,
      length_cm: l,
      width_cm: w,
      height_cm: h,
      stackable,
      chargeable_weight_kg: parseFloat(chargeable.toFixed(2)),
      declared_value: declared_value_usd
        ? BigInt(Math.round(parseFloat(declared_value_usd) * 25000))
        : 0n,
      special_request_note: order_notes || null,
    });
  }

  return cargoRows;
};

module.exports = {
  toDateObj,
  VEHICLE_MAX_PAYLOAD,
  getVehicleMaxPayload,
  resolveAlsLocationIdIfValid,
  getOrCreateLocation,
  getNextDispatcherForWebOrder,
  resolveOrderPickupAndDeliveryLocations,
  calculateConsultationCargoMetrics,
  validateDirectOrderInput,
  buildDirectOrderCargoRows,
};
