const { serializePrisma } = require('../../utils/prismaHelper');

const INCIDENT_SAFE_SELECT = {
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
  escalated_by: true,
  escalated_time: true,
  escalation_reason: true,
  resolution_note: true,
  resolved_by: true,
  resolved_time: true,
  created_at: true,
  updated_at: true
};

const COMPENSATION_ELIGIBLE_DB_TYPES = [
  'DAMAGED_LOST_CARGO',
  'DAMAGED_CARGO',
  'CARGO_DAMAGED',
  'CARGO_LOST',
  'Cargo Damaged',
  'Cargo Lost',
  'TRAFFIC_ACCIDENT',
  'ACCIDENT',
  'Accident',
  'CARGO_HELD',
  'SEIZED_BY_AUTHORITY',
  'HELD_BY_AUTHORITIES'
];

const INCIDENT_TYPE_MAP = {
  'DAMAGED_LOST_CARGO': 'Hàng hư hỏng / mất',
  'DAMAGED_CARGO': 'Hàng hư hỏng / mất',
  'CARGO_DAMAGED': 'Hàng hư hỏng / mất',
  'Cargo Damaged': 'Hàng hư hỏng / mất',
  'Cargo Lost': 'Thất lạc hàng hóa',
  'TRAFFIC_ACCIDENT': 'Tai nạn giao thông',
  'ACCIDENT': 'Tai nạn giao thông',
  'Accident': 'Tai nạn giao thông',
  'CARGO_HELD': 'Hàng bị giữ',
  'SEIZED_BY_AUTHORITY': 'Cơ quan chức năng giữ xe',
  'HELD_BY_AUTHORITIES': 'Kiểm tra hải quan / CSGT',
  'ENGINE_BREAKDOWN': 'Hỏng xe',
  'BREAKDOWN': 'Hỏng xe',
  'Breakdown': 'Hỏng xe',
  'Vehicle Issue': 'Hỏng xe',
  'ROAD_BAN': 'Cấm đường / Ùn tắc',
  'Road Ban': 'Cấm đường / Ùn tắc',
  'Traffic': 'Cấm đường / Ùn tắc',
  'OTHER': 'Khác',
  'Other': 'Khác'
};

const CLAIM_TYPE_DISPLAY_MAP = {
  'Vehicle Issue': 'Hỏng xe',
  'BREAKDOWN': 'Hỏng xe',
  'Traffic': 'Cấm đường / Ùn tắc',
  'ROAD_BAN': 'Cấm đường / Ùn tắc',
  'TRAFFIC_ACCIDENT': 'Tai nạn giao thông',
  'ACCIDENT': 'Tai nạn giao thông',
  'DAMAGED_CARGO': 'Hàng hư hỏng/mất',
  'CARGO_DAMAGED': 'Hàng hư hỏng/mất',
  'CARGO_LOST': 'Thất lạc hàng hóa',
  'SEIZED_BY_AUTHORITY': 'Cơ quan chức năng giữ xe',
  'HELD_BY_AUTHORITIES': 'Kiểm tra hải quan / CSGT',
  'FAILED_DELIVERY': 'Giao hàng không thành công',
  'OTHER': 'Sự cố khác'
};

const mapOrderSummaryAliases = (orderRow) => {
  if (!orderRow) return null;
  const s = serializePrisma(orderRow);
  return {
    ...s,
    customer: s.customers || s.customer || null,
    pickup_location: s.locations_orders_pickup_location_idTolocations || s.pickup_location || null,
    delivery_location: s.locations_orders_delivery_location_idTolocations || s.delivery_location || null
  };
};

const mapIncidentRelations = (row) => {
  if (!row) return null;
  const s = serializePrisma(row);
  if (s.trips) {
    s.trip = {
      ...s.trips,
      trip_trucks: (s.trips.trip_trucks || []).map((tt) => ({
        ...tt,
        truck: tt.trucks || tt.truck || null
      })),
      trip_drivers: (s.trips.trip_drivers || []).map((td) => ({
        ...td,
        driver: td.driver_profiles
          ? {
              ...td.driver_profiles,
              user: td.driver_profiles.users || td.driver_profiles.user || null
            }
          : td.driver || null
      }))
    };
  }
  if (s.driver_profiles) {
    s.driver = {
      ...s.driver_profiles,
      user: s.driver_profiles.users || s.driver_profiles.user || null
    };
  }
  return s;
};

module.exports = {
  INCIDENT_SAFE_SELECT,
  COMPENSATION_ELIGIBLE_DB_TYPES,
  INCIDENT_TYPE_MAP,
  CLAIM_TYPE_DISPLAY_MAP,
  mapOrderSummaryAliases,
  mapIncidentRelations
};
