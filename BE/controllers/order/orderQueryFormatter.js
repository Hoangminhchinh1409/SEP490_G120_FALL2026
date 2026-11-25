const { serializePrisma, formatDateOnly } = require("../../utils/prismaHelper");

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
  extra_fees: true,
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

module.exports = {
  orderRelationInclude,
  mapOrderWithRelations,
  INCIDENT_TYPE_LABELS,
  formatDisplayDateTime,
};
