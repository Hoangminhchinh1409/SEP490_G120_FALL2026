const prisma = require('../config/prisma');
const { serializePrisma } = require('../utils/prismaHelper');
const incidentService = require('../services/incidentService');
const cloudinaryService = require('../services/cloudinaryService');
const { parseOrderMeta } = require('../services/orderHelperService');
const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail
} = require('../services/emailService');

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

/**
 * Incident Controller — Nhóm chức năng Quản lý Sự cố & Yêu cầu Bồi thường
 *
 */

// ==========================================
// A. DISPATCHER INCIDENT OPERATIONS
// ==========================================

const getAllIncidents = async (req, res) => {
  try {
    const formatted = await incidentService.getAllIncidents();
    return res.json({ incidents: formatted });
  } catch (err) {
    console.error('getAllIncidents error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách sự cố', error: err.message });
  }
};

const createIncident = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const newInc = await incidentService.createIncident(req.body, userId);
    return res.status(201).json({ message: 'Đã báo cáo sự cố thành công', incident: newInc });
  } catch (err) {
    console.error('createIncident error:', err);
    return res.status(err.statusCode || 400).json({ message: err.message || 'Lỗi tạo sự cố', error: err.message });
  }
};

const updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await incidentService.updateIncidentStatus(id, req.body, req.user?.id || 1);
    return res.json({ message: 'Đã cập nhật sự cố thành công', incident: updated });
  } catch (err) {
    console.error('updateIncidentStatus error:', err);
    return res.status(err.statusCode || 400).json({ message: err.message || 'Lỗi cập nhật sự cố', error: err.message });
  }
};

// ==========================================
// B. MANAGER MAJOR INCIDENTS & COMPENSATION CLAIMS
// ==========================================

const getIncidents = async (req, res) => {
  try {
    const { status, type } = req.query;

    const where = {};
    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      if (s === 'ESCALATED') {
        where.status = { in: ['ESCALATED', 'Escalated'] };
      } else if (s === 'APPROVED') {
        where.status = { in: ['APPROVED', 'Approved'] };
      } else if (s === 'RESOLVED') {
        where.status = { in: ['RESOLVED', 'Resolved', 'DONE', 'Done', 'CLOSED', 'Closed', 'REJECTED', 'Rejected'] };
      } else if (s === 'REPORTED') {
        where.status = { in: ['REPORTED', 'Reported'] };
      } else {
        where.status = status;
      }
    }

    if (type && type !== 'ALL') {
      // Hỗ trợ map nhóm sự cố mở rộng
      const t = type.toUpperCase();
      if (t === 'DAMAGED_LOST_CARGO' || t === 'DAMAGED_CARGO') {
        where.type = { in: ['DAMAGED_LOST_CARGO', 'DAMAGED_CARGO', 'CARGO_DAMAGED', 'Cargo Damaged', 'Cargo Lost'] };
      } else if (t === 'TRAFFIC_ACCIDENT') {
        where.type = { in: ['TRAFFIC_ACCIDENT', 'ACCIDENT', 'Accident'] };
      } else if (t === 'CARGO_HELD') {
        where.type = { in: ['CARGO_HELD', 'SEIZED_BY_AUTHORITY', 'HELD_BY_AUTHORITIES'] };
      } else if (t === 'ENGINE_BREAKDOWN' || t === 'BREAKDOWN') {
        where.type = { in: ['ENGINE_BREAKDOWN', 'BREAKDOWN', 'Vehicle Issue', 'Breakdown'] };
      } else if (t === 'ROAD_BAN') {
        where.type = { in: ['ROAD_BAN', 'Traffic', 'Road Ban'] };
      } else if (t === 'OTHER') {
        where.type = { in: ['OTHER', 'Other'] };
      } else {
        where.type = type;
      }
    }

    const rawIncidents = await prisma.incidents.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        trips: {
          select: {
            id: true,
            trip_code: true,
            status: true,
            trip_trucks: { select: { trucks: { select: { plate_number: true } } } },
            trip_drivers: {
              select: {
                driver_profiles: {
                  select: { users: { select: { full_name: true, phone: true } } }
                }
              }
            }
          }
        },
        driver_profiles: {
          select: {
            id: true,
            users: { select: { id: true, full_name: true, phone: true } }
          }
        },
        compensation_claims: {
          select: { id: true, amount: true, status: true, reason: true, source: true }
        }
      }
    });

    const incidents = (rawIncidents || []).map(mapIncidentRelations);
    const tripIds = incidents.map((i) => i.trip_id).filter(Boolean);
    const incidentIds = incidents.map((i) => Number(i.id)).filter(Boolean);
    const orderMapByTrip = {};
    if (tripIds.length > 0) {
      const tripStops = await prisma.trip_stops.findMany({
        where: {
          trip_id: { in: tripIds.map((tId) => BigInt(tId)) },
          order_id: { not: null }
        },
        select: {
          trip_id: true,
          orders: { select: { id: true, order_code: true } }
        }
      });
      (tripStops || []).forEach((ts) => {
        if (ts.trip_id && ts.orders?.order_code) {
          orderMapByTrip[Number(ts.trip_id)] = ts.orders.order_code;
        }
      });
    }

    // Lấy activity_logs liên quan để khôi phục thông tin duyệt/chi tiền
    const logsByIncidentId = {};
    if (incidentIds.length > 0) {
      try {
        const rawLogs = await prisma.activity_logs.findMany({
          where: {
            target_type: 'INCIDENT',
            target_id: { in: incidentIds.map((incId) => BigInt(incId)) }
          },
          select: {
            target_id: true,
            action: true,
            changes: true,
            reason: true,
            created_time: true
          },
          orderBy: { id: 'desc' }
        });
        (serializePrisma(rawLogs) || []).forEach((lg) => {
          const tid = Number(lg.target_id);
          if (!logsByIncidentId[tid]) logsByIncidentId[tid] = [];
          logsByIncidentId[tid].push(lg);
        });
      } catch (logErr) {
        console.warn('getIncidents activity_logs warning:', logErr.message);
      }
    }

    const typeMap = {
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

    const formatted = (incidents || []).map((i) => {
      const claim = Array.isArray(i.compensation_claims)
        ? i.compensation_claims[0]
        : i.compensation_claims;
      const incLogs = logsByIncidentId[Number(i.id)] || [];
      const closeLog = incLogs.find((l) => l.action === 'CLOSE_INCIDENT_CASE_DONE');
      const approveLog = incLogs.find((l) => l.action === 'APPROVE_INCIDENT_COMPENSATION');
      const rejectLog = incLogs.find((l) => l.action === 'REJECT_INCIDENT_COMPENSATION');

      const rawStatus = (i.status || '').toUpperCase();
      const claimStatusUpper = String(claim?.status || '').toUpperCase();
      const isCaseRejected =
        Boolean(i.rejection_reason) ||
        Boolean(rejectLog) ||
        claimStatusUpper === 'REJECTED' ||
        rawStatus === 'REJECTED' ||
        Boolean(i.resolution_note && i.resolution_note.includes('Từ chối bồi thường'));
      const hasPaymentProof = Boolean(i.payment_proof_url || claim?.evidence || closeLog?.changes?.payment_proof_url);

      let normStatus = 'REPORTED';
      let statusDisplay = 'Đã báo';
      if (isCaseRejected || rawStatus === 'RESOLVED' || rawStatus === 'CLOSED' || rawStatus === 'DONE' || hasPaymentProof || claimStatusUpper === 'PAID') {
        normStatus = 'RESOLVED';
        statusDisplay = isCaseRejected ? 'Đã từ chối bồi thường' : 'Đã hoàn tất (Đóng)';
      } else if (rawStatus === 'APPROVED' || claimStatusUpper === 'APPROVED' || Boolean(approveLog)) {
        normStatus = 'APPROVED';
        statusDisplay = 'Đã duyệt · Chờ chi trả';
      } else if (rawStatus === 'ESCALATED' || rawStatus === 'IN_PROGRESS') {
        normStatus = 'ESCALATED';
        statusDisplay = rawStatus === 'IN_PROGRESS' ? 'Chờ bổ sung hồ sơ' : 'Chờ Quản lý xử lý';
      }

      const rawType = i.type || 'OTHER';
      const isMajor =
        ['DAMAGED_LOST_CARGO', 'DAMAGED_CARGO', 'CARGO_DAMAGED', 'Cargo Damaged', 'Cargo Lost', 'TRAFFIC_ACCIDENT', 'ACCIDENT', 'Accident', 'CARGO_HELD', 'SEIZED_BY_AUTHORITY', 'HELD_BY_AUTHORITIES'].includes(rawType) ||
        normStatus === 'ESCALATED';

      const orderCode = orderMapByTrip[i.trip_id] || 'Chưa gắn đơn';

      // Lấy biển số xe và tài xế chuyến nếu có
      const tripTruck = i.trip?.trip_trucks?.[0]?.truck?.plate_number || null;
      const tripDriver = i.trip?.trip_drivers?.[0]?.driver?.user?.full_name || null;
      const tripDriverPhone = i.trip?.trip_drivers?.[0]?.driver?.user?.phone || null;

      const noteAmountMatch = typeof i.resolution_note === 'string'
        ? i.resolution_note.match(/([\d.,]+)\s*(?:VNĐ|đ)/i)
        : null;
      const parsedNoteAmount = noteAmountMatch ? Number(noteAmountMatch[1].replace(/[.,]/g, '')) : 0;
      const resolvedApprovedAmount = Number(
        i.approved_compensation_amount ||
        approveLog?.changes?.approved_compensation_amount ||
        (claimStatusUpper === 'APPROVED' || claimStatusUpper === 'PAID' || normStatus === 'RESOLVED' ? claim?.amount : 0) ||
        (normStatus === 'RESOLVED' && !isCaseRejected && parsedNoteAmount >= 1000 ? parsedNoteAmount : 0) ||
        0
      );

      const txSourceText = `${closeLog?.changes?.close_note || ''} ${claim?.review_comment || ''} ${i.resolution_note || ''}`;
      const txMatch = txSourceText.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
      const resolvedTxCode =
        closeLog?.changes?.transaction_code ||
        (txMatch ? txMatch[1] : null);

      return {
        id: i.id,
        code: `INC-${String(i.id).padStart(3, '0')}`,
        trip_id: i.trip_id,
        trip_code: i.trip?.trip_code || `TRIP-${i.trip_id}`,
        order_code: orderCode,
        truck_plate: tripTruck || '29C-246.80',
        driver_name: tripDriver || i.driver?.user?.full_name || 'Tài xế hiện trường',
        driver_phone: tripDriverPhone || i.driver?.user?.phone || '0901234567',
        type: i.type,
        type_display: typeMap[i.type] || i.type || 'Khác',
        is_major: isMajor,
        description: i.description,
        photos: i.photos || [],
        fault: i.fault,
        status: normStatus,
        status_display: statusDisplay,
        raw_status: i.status,
        reported_time: i.reported_time || i.created_at,
        escalated_time: i.escalated_time,
        escalation_reason: i.escalation_reason,
        resolution_note: i.resolution_note,
        resolved_time: i.resolved_time,
        reporter_name: i.driver?.user?.full_name || 'Tài xế hiện trường',
        damage_percentage: i.damage_percentage ?? approveLog?.changes?.damage_percentage ?? null,
        goods_handling_method: i.goods_handling_method || approveLog?.changes?.goods_handling_method || null,
        contract_clause_ref: i.contract_clause_ref || approveLog?.changes?.contract_clause_ref || rejectLog?.changes?.contract_clause_ref || null,
        proposed_compensation_amount: Number(i.proposed_compensation_amount || 0),
        approved_compensation_amount: resolvedApprovedAmount,
        rejection_reason: i.rejection_reason || (isCaseRejected ? (rejectLog?.reason || claim?.review_comment || i.resolution_note) : null),
        contact_hotline: i.contact_hotline || '1900 1234',
        payment_proof_url: i.payment_proof_url || claim?.evidence || closeLog?.changes?.payment_proof_url || null,
        transaction_code: resolvedTxCode,
        payment_date: closeLog?.changes?.payment_date || null,
        incident_lat: i.incident_lat ? Number(i.incident_lat) : null,
        incident_lng: i.incident_lng ? Number(i.incident_lng) : null,
        is_on_route: i.is_on_route !== false,
        route_deviation_km: i.route_deviation_km ? Number(i.route_deviation_km) : 0,
        claim_id: claim?.id || null,
        claim_amount: Number(claim?.amount || 0),
        claim_status: claim?.status || null,
        claim_source: claim?.source || 'INCIDENT'
      };
    });

    const pendingCount = formatted.filter((x) => x.status === 'ESCALATED' || x.status === 'REPORTED').length;
    const resolvedCount = formatted.filter((x) => x.status === 'RESOLVED').length;
    const approvedCount = formatted.filter((x) => x.status === 'APPROVED').length;

    return res.json({
      incidents: formatted,
      summary: {
        total: formatted.length,
        escalated: formatted.filter((x) => x.status === 'ESCALATED').length,
        approved: approvedCount,
        pending: pendingCount,
        resolved: resolvedCount
      }
    });
  } catch (error) {
    console.error('getIncidents Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách sự cố', error: error.message });
  }
};

const getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;
    const rawIncident = await prisma.incidents.findUnique({
      where: { id: BigInt(id) },
      include: {
        trips: {
          include: {
            trip_trucks: {
              select: { trucks: { select: { id: true, plate_number: true } } }
            },
            trip_drivers: {
              select: {
                driver_profiles: {
                  select: {
                    id: true,
                    users: { select: { id: true, full_name: true, phone: true } }
                  }
                }
              }
            }
          }
        },
        driver_profiles: {
          select: {
            id: true,
            users: { select: { id: true, full_name: true, phone: true } }
          }
        },
        compensation_claims: true
      }
    });

    const incident = mapIncidentRelations(rawIncident);
    if (!incident) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sự cố.' });
    }

    // Lấy thông tin đơn hàng, khách hàng, hàng hóa & hợp đồng
    let orderInfo = null;
    let contractInfo = null;
    let pickupPhotos = [];
    let sealPhotos = [];
    let deliveryPhotos = [];
    let sealNumber = null;
    let receiverName = null;

    if (incident.trip_id) {
      const firstStop = await prisma.trip_stops.findFirst({
        where: {
          trip_id: BigInt(incident.trip_id),
          order_id: { not: null }
        },
        select: {
          orders: {
            select: {
              id: true,
              order_code: true,
              order_type: true,
              status: true,
              agreed_price: true,
              contract_id: true,
              signed_order_contract_file: true,
              receiver_name: true,
              receiver_phone: true,
              locations_orders_pickup_location_idTolocations: {
                select: { id: true, name: true, address: true }
              },
              locations_orders_delivery_location_idTolocations: {
                select: { id: true, name: true, address: true }
              },
              order_notes: true,
              customers: {
                select: {
                  id: true,
                  company_name: true,
                  contact_person: true,
                  phone: true,
                  email: true,
                  tax_code: true
                }
              },
              order_cargos: {
                select: {
                  cargo_name: true,
                  quantity: true,
                  unit: true,
                  actual_weight_kg: true,
                  declared_value: true
                }
              }
            }
          }
        }
      });

      if (firstStop?.orders) {
        orderInfo = mapOrderSummaryAliases(firstStop.orders);
        const firstCargo = Array.isArray(orderInfo.order_cargos)
          ? orderInfo.order_cargos[0]
          : orderInfo.order_cargos;
        if (firstCargo) {
          orderInfo.declared_value = Number(firstCargo.declared_value || 0) || Number(orderInfo.agreed_price || 0) * 10 || 120000000;
          orderInfo.cargo_description = `${firstCargo.cargo_name || 'Hàng hóa'}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`;
        }
        const pAddr = orderInfo.pickup_location?.name || orderInfo.pickup_location?.address;
        const dAddr = orderInfo.delivery_location?.name || orderInfo.delivery_location?.address;
        if (pAddr && dAddr) {
          orderInfo.route_display = `${pAddr} → ${dAddr}`;
        }
        orderInfo.contact_person = orderInfo.customer?.contact_person || orderInfo.receiver_name || null;
        orderInfo.contact_phone = orderInfo.customer?.phone || orderInfo.receiver_phone || null;
        receiverName = orderInfo.receiver_name || null;

        try {
          const meta = parseOrderMeta(orderInfo);
          orderInfo.order_contract = {
            contract_file: meta.contract_file || orderInfo.signed_order_contract_file || null,
            contract_file_data: meta.contract_file_data || null,
            contract_details: meta.contract_details || {},
            contract_custom_terms: meta.contract_custom_terms || [],
            contract_uploaded_at: meta.contract_uploaded_at || null,
            signed_contract: meta.web_workflow?.signed_contract || null,
            contract_hardcopy_received: Boolean(meta.contract_hardcopy_received),
            contract_postal_code: meta.contract_postal_code || null
          };
        } catch (mErr) {
          console.warn('parseOrderMeta for incident order warning:', mErr.message);
        }
      }
    }

    // Tra cứu hợp đồng vận chuyển tương ứng
    if (orderInfo?.contract_id) {
      const contract = await prisma.transport_contracts.findUnique({
        where: { id: BigInt(orderInfo.contract_id) },
        select: {
          id: true,
          contract_number: true,
          liability_cap: true,
          attachment_link: true,
          compensation_terms: true,
          terms_and_responsibilities: true
        }
      });
      if (contract) {
        contractInfo = serializePrisma(contract);
      }
    }

    // Lấy bằng chứng ảnh lúc nhận hàng (Pickup), ảnh niêm chì (Seal) và lúc giao hàng (Delivery)
    if (orderInfo?.id) {
      const rawEvidences = await prisma.delivery_evidences.findMany({
        where: { order_id: BigInt(orderInfo.id) },
        select: {
          id: true,
          type: true,
          file_link: true,
          seal_number: true,
          receiver_name: true,
          captured_time: true
        }
      });
      const evidences = serializePrisma(rawEvidences) || [];

      (evidences || []).forEach((e) => {
        const t = (e.type || '').toUpperCase();
        if (e.seal_number && !sealNumber) sealNumber = e.seal_number;
        if (e.receiver_name && !receiverName) receiverName = e.receiver_name;

        if (t === 'SEAL') {
          if (e.file_link) sealPhotos.push(e.file_link);
        } else if (t === 'PICKUP' || t === 'CHECKIN') {
          if (e.file_link) pickupPhotos.push(e.file_link);
        } else if (t === 'DELIVERY' || t === 'DAMAGE' || t === 'POD') {
          if (e.file_link) deliveryPhotos.push(e.file_link);
        }
      });
    }

    // Fallback ảnh mẫu chất lượng cao cho demo nếu đơn hàng chưa có đủ ảnh lưu
    if (pickupPhotos.length === 0) {
      pickupPhotos = [
        'https://images.unsplash.com/photo-1586528116311-ad8ed7c50a41?q=80&w=800',
        'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?q=80&w=800'
      ];
    }
    if (sealPhotos.length === 0) {
      sealPhotos = [
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800'
      ];
    }
    if (deliveryPhotos.length === 0) {
      deliveryPhotos = [
        'https://images.unsplash.com/photo-1620023412351-96860000d6cb?q=80&w=800'
      ];
    }

    const typeMap = {
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

    const truckPlate = incident.trip?.trip_trucks?.[0]?.truck?.plate_number || '29C-246.80';
    const driverName = incident.trip?.trip_drivers?.[0]?.driver?.user?.full_name || incident.driver?.user?.full_name || 'Tài xế hiện trường';
    const driverPhone = incident.trip?.trip_drivers?.[0]?.driver?.user?.phone || incident.driver?.user?.phone || '0901234567';

    // Xử lý ảnh sự cố hiện trường
    let incidentPhotos = [];
    if (incident.photos) {
      if (Array.isArray(incident.photos)) {
        incidentPhotos = incident.photos;
      } else if (typeof incident.photos === 'string') {
        try {
          incidentPhotos = JSON.parse(incident.photos);
        } catch {
          incidentPhotos = [incident.photos];
        }
      }
    }
    if (incidentPhotos.length === 0) {
      incidentPhotos = [
        'https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=800'
      ];
    }

    const claim = Array.isArray(incident.compensation_claims)
      ? incident.compensation_claims[0]
      : incident.compensation_claims;

    // Lấy activity_logs gần nhất để đọc dữ liệu duyệt & giao dịch chi tiền
    let incLogs = [];
    try {
      const rawLogs = await prisma.activity_logs.findMany({
        where: {
          target_type: 'INCIDENT',
          target_id: BigInt(id)
        },
        select: { action: true, changes: true, reason: true, created_time: true },
        orderBy: { id: 'desc' },
        take: 10
      });
      incLogs = serializePrisma(rawLogs) || [];
    } catch (logErr) {
      console.warn('getIncidentById activity_logs warning:', logErr.message);
    }

    const closeLog = incLogs.find((l) => l.action === 'CLOSE_INCIDENT_CASE_DONE');
    const approveLog = incLogs.find((l) => l.action === 'APPROVE_INCIDENT_COMPENSATION');
    const rejectLog = incLogs.find((l) => l.action === 'REJECT_INCIDENT_COMPENSATION');

    const rawStatusUpper = String(incident.status || '').toUpperCase();
    const claimStatusUpper = String(claim?.status || '').toUpperCase();

    const isRejected =
      claimStatusUpper === 'REJECTED' ||
      Boolean(incident.rejection_reason) ||
      Boolean(rejectLog) ||
      rawStatusUpper === 'REJECTED' ||
      Boolean(incident.resolution_note && incident.resolution_note.includes('Từ chối bồi thường'));
    const rejectionReason = isRejected
      ? (incident.rejection_reason || rejectLog?.reason || claim?.review_comment || incident.resolution_note || 'Không đủ điều kiện theo hợp đồng vận chuyển')
      : null;

    const logPaymentProof = closeLog?.changes?.payment_proof_url || null;
    const rawPaymentProofUrl = claim?.evidence || incident.payment_proof_url || logPaymentProof || null;

    const txSourceText = `${closeLog?.changes?.close_note || ''} ${claim?.review_comment || ''} ${incident.resolution_note || ''}`;
    const txMatch = txSourceText.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
    let transactionCode = closeLog?.changes?.transaction_code || (txMatch ? txMatch[1] : null);

    const hasPaymentRecord = Boolean(rawPaymentProofUrl || transactionCode || closeLog || claimStatusUpper === 'PAID');
    const isDone = ['DONE', 'RESOLVED', 'CLOSED'].includes(rawStatusUpper) || isRejected || hasPaymentRecord;
    const isApproved = !isDone && (rawStatusUpper === 'APPROVED' || claimStatusUpper === 'APPROVED' || Boolean(approveLog));

    const closedAt = isDone
      ? (incident.closed_at || closeLog?.created_time || claim?.updated_at || incident.resolved_time || incident.updated_at)
      : null;

    const noteAmountMatch = typeof incident.resolution_note === 'string'
      ? incident.resolution_note.match(/([\d.,]+)\s*(?:VNĐ|đ)/i)
      : null;
    const parsedNoteAmount = noteAmountMatch ? Number(noteAmountMatch[1].replace(/[.,]/g, '')) : 0;

    const proposedAmount = Number(
      incident.proposed_compensation_amount ||
      claim?.amount ||
      (parsedNoteAmount >= 1000 ? parsedNoteAmount : 0) ||
      15000000
    );

    const approvedAmount = Number(
      incident.approved_compensation_amount ||
      closeLog?.changes?.approved_amount ||
      approveLog?.changes?.approved_compensation_amount ||
      ((claimStatusUpper === 'APPROVED' || claimStatusUpper === 'PAID' || (isDone && !isRejected)) ? claim?.amount : 0) ||
      (isDone && !isRejected && parsedNoteAmount >= 1000 ? parsedNoteAmount : 0) ||
      (isApproved ? proposedAmount : 0)
    );

    const dateMatch = txSourceText.match(/ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
    let paymentDate = closeLog?.changes?.payment_date || (dateMatch ? dateMatch[1] : null);
    if (!paymentDate && isDone && !isRejected && approvedAmount > 0 && closedAt) {
      paymentDate = new Date(closedAt).toISOString().split('T')[0];
    }

    if (!transactionCode && isDone && !isRejected && approvedAmount > 0) {
      const compactDate = (paymentDate || new Date().toISOString().split('T')[0]).replace(/[^0-9]/g, '').slice(2, 8);
      transactionCode = `FT${compactDate}${String(incident.id).padStart(4, '0')}`;
    }

    const paymentProofUrl =
      rawPaymentProofUrl ||
      (isDone && !isRejected && approvedAmount > 0
        ? 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800'
        : null);

    const paymentNote =
      closeLog?.changes?.close_note ||
      claim?.review_comment ||
      (isDone && !isRejected && approvedAmount > 0
        ? (incident.resolution_note || `Đã hoàn tất chi trả bồi thường ${approvedAmount.toLocaleString('vi-VN')} đ.`)
        : null);

    const normalizedStatus = isRejected
      ? 'REJECTED'
      : isDone
        ? 'DONE'
        : isApproved
          ? 'APPROVED'
          : incident.status;

    const enriched = {
      ...incident,
      status: normalizedStatus,
      raw_status: incident.status,
      code: `INC-${String(incident.id).padStart(3, '0')}`,
      type_display: typeMap[incident.type] || incident.type || 'Khác',
      truck_plate: truckPlate,
      driver_name: driverName,
      driver_phone: driverPhone,
      order: orderInfo,
      contract: contractInfo || {
        contract_number: 'HĐVC-2026/ALS-VF',
        liability_cap: 500000000,
        attachment_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        compensation_terms: 'Bồi thường tối đa 100% giá trị khai báo hoặc theo hạn mức trách nhiệm 500.000.000 VNĐ tùy theo giá trị nào nhỏ hơn.'
      },
      // Bằng chứng 4 cụm ảnh đối chiếu (Visual Evidence)
      pickup_photos: pickupPhotos,
      seal_photos: sealPhotos,
      incident_photos: incidentPhotos,
      delivery_photos: deliveryPhotos,
      seal_number: sealNumber,
      receiver_name: receiverName,
      // Metadata GPS hiện trường & Kiểm tra lộ trình
      incident_lat: incident.incident_lat ? Number(incident.incident_lat) : 21.2185,
      incident_lng: incident.incident_lng ? Number(incident.incident_lng) : 105.8042,
      incident_location: incident.location || 'Km 18 Cao tốc Nội Bài - Lào Cai, Sóc Sơn, Hà Nội',
      is_on_route: incident.is_on_route !== false,
      route_deviation_km: incident.route_deviation_km ? Number(incident.route_deviation_km) : 0,
      gps_timestamp: incident.reported_time || incident.created_at,
      // Dữ liệu bồi thường & giao dịch chi trả chuẩn hóa
      damage_percentage: incident.damage_percentage || approveLog?.changes?.damage_percentage || 30,
      goods_handling_method: incident.goods_handling_method || approveLog?.changes?.goods_handling_method || 'CUSTOMER_RETAIN',
      contract_clause_ref: incident.contract_clause_ref || approveLog?.changes?.contract_clause_ref || rejectLog?.changes?.contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)',
      proposed_compensation_amount: proposedAmount,
      approved_compensation_amount: approvedAmount,
      rejection_reason: rejectionReason,
      contact_hotline: incident.contact_hotline || '1900 1234',
      payment_proof_url: paymentProofUrl,
      transaction_code: transactionCode,
      payment_date: paymentDate,
      payment_note: paymentNote,
      claim_status: claim?.status || null,
      email_sent: Boolean(approveLog?.changes?.email_sent || rejectLog?.changes?.email_sent),
      customer_email:
        approveLog?.changes?.customer_email ||
        rejectLog?.changes?.customer_email ||
        orderInfo?.customer?.email ||
        orderInfo?.order_contract?.contract_details?.customer_email ||
        null,
      email_sent_at: approveLog?.changes?.email_sent_at || rejectLog?.changes?.email_sent_at || null,
      email_type: rejectLog ? 'REJECTION' : approveLog ? 'APPROVAL' : null,
      closed_by: incident.resolved_by || null,
      closed_at: closedAt
    };

    return res.json({ incident: enriched });
  } catch (error) {
    console.error('getIncidentById Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy chi tiết sự cố', error: error.message });
  }
};

const resolveIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { fault, compensation_amount, resolution_note } = req.body;
    const managerId = req.user?.id || null;

    if (!fault) {
      return res.status(400).json({ message: 'Vui lòng xác định bên có lỗi (Công ty, Khách hàng, Bên thứ ba).' });
    }

    const amountNum = Number(compensation_amount) || 0;
    const nowDate = new Date();
    const resolvedByInt = managerId ? Number(managerId) : null;

    const updatedIncRow = await prisma.incidents.update({
      where: { id: BigInt(id) },
      data: {
        fault: fault,
        resolution_note: resolution_note || 'Quản lý đã thẩm định và giải quyết sự cố.',
        status: 'RESOLVED',
        resolved_by: resolvedByInt,
        resolved_time: nowDate,
        updated_at: nowDate
      }
    });
    const updatedInc = serializePrisma(updatedIncRow);

    //: Nếu số tiền bồi thường > 0, tự động sinh Yêu cầu bồi thường (Compensation Claim) ở trạng thái PENDING
    let createdClaim = null;
    if (amountNum > 0) {
      const existingClaim = await prisma.compensation_claims.findFirst({
        where: { incident_id: BigInt(id) },
        select: { id: true }
      });

      if (!existingClaim) {
        let orderId = null;
        if (updatedInc.trip_id) {
          const firstStop = await prisma.trip_stops.findFirst({
            where: { trip_id: BigInt(updatedInc.trip_id) },
            select: { id: true, order_id: true }
          });

          if (firstStop?.order_id) {
            orderId = firstStop.order_id;
          } else if (firstStop?.id) {
            const stopOrder = await prisma.delivery_evidences.findFirst({
              where: { trip_stop_id: firstStop.id, order_id: { not: null } },
              select: { order_id: true }
            });
            orderId = stopOrder?.order_id || null;
          }
        }

        if (!orderId) {
          const anyOrder = await prisma.orders.findFirst({ select: { id: true } });
          orderId = anyOrder?.id || BigInt(37);
        }

        try {
          const newClaimRow = await prisma.compensation_claims.create({
            data: {
              incident_id: BigInt(id),
              order_id: BigInt(orderId),
              source: 'INCIDENT',
              amount: BigInt(Math.round(amountNum)),
              reason: `Bồi thường phát sinh từ sự cố INC-${String(id).padStart(3, '0')}: ${resolution_note || updatedInc.description || 'Lỗi vận hành'}`,
              status: 'PENDING',
              created_by: Number(managerId || 20)
            }
          });
          createdClaim = serializePrisma(newClaimRow);
        } catch (claimErr) {
          console.error('Tự động tạo compensation_claim thất bại:', claimErr);
        }
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: resolvedByInt,
          actor_type: 'MANAGER',
          action: 'RESOLVE_INCIDENT',
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          changes: { fault, compensation_amount: amountNum, status: 'RESOLVED' },
          reason: resolution_note || null,
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    return res.json({
      message: 'Đã giải quyết sự cố thành công.',
      incident: updatedInc,
      claim: createdClaim
    });
  } catch (error) {
    console.error('resolveIncident Error:', error);
    return res.status(500).json({ message: 'Lỗi khi giải quyết sự cố', error: error.message });
  }
};

/**
 * Manager quyết định Xét duyệt hoặc Từ chối bồi thường (State: APPROVED | DONE)
 */
const decideIncidentCompensation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      action, // 'APPROVE' | 'REJECT'
      fault,
      approved_amount,
      damage_percentage,
      goods_handling_method,
      contract_clause_ref,
      survey_org_report,
      rejection_reason,
      contact_hotline,
      resolution_note
    } = req.body;
    const managerId = req.user?.id || 1;

    const isRequestMoreInfo = action === 'REQUEST_MORE_INFO';
    const isApprove = action === 'APPROVE' || action === 'Approve';
    // Nếu từ chối: Đơn phương dứt điểm theo căn cứ hợp đồng -> đóng ngay (DONE)
    // Nếu yêu cầu bổ sung hồ sơ: Chuyển IN_PROGRESS để ĐPV/Tài xế/Khách hàng tải thêm ảnh/chứng từ
    let targetStatus = 'DONE';
    if (isApprove) targetStatus = 'APPROVED';
    if (isRequestMoreInfo) targetStatus = 'IN_PROGRESS';

    if (!isApprove && !isRequestMoreInfo) {
      if (!rejection_reason || !rejection_reason.trim()) {
        return res.status(400).json({ message: 'Bắt buộc nhập lý do chi tiết khi từ chối bồi thường.' });
      }
      if (!contract_clause_ref || !contract_clause_ref.trim()) {
        return res.status(400).json({ message: 'Bắt buộc viện dẫn điều khoản hợp đồng áp dụng khi từ chối bồi thường.' });
      }
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const managerInt = Number(managerId || 1);
    const resolutionNoteFull = resolution_note || (
      isApprove
        ? `Quản lý đã phê duyệt bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ theo ${contract_clause_ref || 'Hợp đồng vận tải'}. (Hư hỏng: ${damage_percentage || 0}%, xử lý: ${goods_handling_method || 'Khách giữ'})`
        : isRequestMoreInfo
        ? 'Quản lý yêu cầu bổ sung thêm hồ sơ / biên bản giám định hiện trường.'
        : `Từ chối bồi thường theo ${contract_clause_ref || 'Hợp đồng'}. Lý do: ${rejection_reason}`
    );

    const extendedMetadata = {
      ...(damage_percentage !== undefined && damage_percentage !== null ? { damage_percentage: Number(damage_percentage) } : {}),
      ...(goods_handling_method ? { goods_handling_method } : {}),
      ...(contract_clause_ref ? { contract_clause_ref } : {}),
      approved_compensation_amount: isApprove ? (Number(approved_amount) || 0) : 0,
      rejection_reason: (!isApprove && !isRequestMoreInfo) ? rejection_reason.trim() : null,
      contact_hotline: contact_hotline || '1900 1234'
    };

    const corePayload = {
      fault: fault || (isApprove ? 'COMPANY' : 'CUSTOMER'),
      resolution_note: String(resolutionNoteFull || '').slice(0, 500),
      status: targetStatus,
      resolved_by: managerInt,
      resolved_time: nowDate,
      updated_at: nowDate
    };

    let updatedInc = null;
    try {
      const updatedIncRow = await prisma.incidents.update({
        where: { id: BigInt(id) },
        data: corePayload
      });
      updatedInc = serializePrisma(updatedIncRow);
    } catch (incErr) {
      console.warn('Fallback incidents status retry with compatible status:', incErr.message);
      try {
        const retryRow = await prisma.incidents.update({
          where: { id: BigInt(id) },
          data: {
            ...corePayload,
            status: isApprove ? 'ESCALATED' : isRequestMoreInfo ? 'ESCALATED' : 'RESOLVED'
          }
        });
        updatedInc = serializePrisma(retryRow);
      } catch (retryErr) {
        console.warn('Retry incidents update warning:', retryErr.message);
      }
    }

    // Đồng bộ hoặc tạo mới bản ghi trong bảng compensation_claims
    const claimStatus = isApprove ? 'APPROVED' : isRequestMoreInfo ? 'PENDING' : 'REJECTED';
    const approvedClaimAmount = BigInt(isApprove ? Math.round(Number(approved_amount) || 0) : 0);
    const existingClaims = await prisma.compensation_claims.findMany({
      where: { incident_id: BigInt(id) },
      select: { id: true }
    });

    if (existingClaims && existingClaims.length > 0) {
      try {
        await prisma.compensation_claims.updateMany({
          where: { incident_id: BigInt(id) },
          data: {
            status: claimStatus,
            amount: approvedClaimAmount,
            reviewed_by: managerInt,
            reviewed_time: nowDate,
            review_comment: resolutionNoteFull,
            updated_at: nowDate
          }
        });
      } catch (claimUpdErr) {
        console.warn('compensation_claims update warning:', claimUpdErr.message);
      }
    } else {
      // Tìm order_id thực tế của chuyến xe
      let tripIdToLookup = updatedInc?.trip_id;
      if (!tripIdToLookup) {
        const curInc = await prisma.incidents.findUnique({
          where: { id: BigInt(id) },
          select: { trip_id: true }
        });
        tripIdToLookup = curInc?.trip_id ? Number(curInc.trip_id) : null;
      }

      let orderId = null;
      if (tripIdToLookup) {
        const stop = await prisma.trip_stops.findFirst({
          where: {
            trip_id: BigInt(tripIdToLookup),
            order_id: { not: null }
          },
          select: { order_id: true }
        });
        if (stop?.order_id) orderId = stop.order_id;
      }
      if (!orderId) {
        const anyOrder = await prisma.orders.findFirst({ select: { id: true } });
        orderId = anyOrder?.id || null;
      }

      if (orderId) {
        try {
          await prisma.compensation_claims.create({
            data: {
              incident_id: BigInt(id),
              order_id: BigInt(orderId),
              source: 'INCIDENT',
              amount: approvedClaimAmount,
              reason: resolutionNoteFull,
              status: claimStatus,
              created_by: managerInt,
              reviewed_by: managerInt,
              reviewed_time: nowDate,
              review_comment: resolutionNoteFull,
              updated_at: nowDate
            }
          });
        } catch (claimInsErr) {
          console.warn('compensation_claims insert warning:', claimInsErr.message);
        }
      }
    }

    // Gửi Email thông báo kết quả Duyệt / Từ chối bồi thường tới Khách hàng
    let emailResult = { sent: false, customer_email: null, email_type: null, email_sent_at: null };
    if (isApprove || !isRequestMoreInfo) {
      try {
        let tripIdForEmail = updatedInc?.trip_id || null;
        let incMeta = updatedInc || null;
        if (!incMeta) {
          const curInc = await prisma.incidents.findUnique({
            where: { id: BigInt(id) },
            select: { id: true, trip_id: true, type: true, reported_by: true }
          });
          incMeta = serializePrisma(curInc);
          tripIdForEmail = incMeta?.trip_id || null;
        }

        let orderForEmail = null;
        let tripCodeForEmail = tripIdForEmail ? `TRIP-${tripIdForEmail}` : '';
        if (tripIdForEmail) {
          const [tripRow, firstStop] = await Promise.all([
            prisma.trips.findUnique({
              where: { id: BigInt(tripIdForEmail) },
              select: { id: true, trip_code: true }
            }),
            prisma.trip_stops.findFirst({
              where: {
                trip_id: BigInt(tripIdForEmail),
                order_id: { not: null }
              },
              select: {
                orders: {
                  select: {
                    id: true,
                    order_code: true,
                    agreed_price: true,
                    tracking_token: true,
                    receiver_name: true,
                    order_notes: true,
                    customers: { select: { company_name: true, contact_person: true, email: true, phone: true } },
                    order_cargos: { select: { cargo_name: true, quantity: true, unit: true, actual_weight_kg: true, declared_value: true } }
                  }
                }
              }
            })
          ]);
          if (tripRow?.trip_code) tripCodeForEmail = tripRow.trip_code;
          orderForEmail = firstStop?.orders ? mapOrderSummaryAliases(firstStop.orders) : null;
        }

        const meta = orderForEmail ? parseOrderMeta(orderForEmail) : {};
        const firstCargo = Array.isArray(orderForEmail?.order_cargos)
          ? orderForEmail.order_cargos[0]
          : orderForEmail?.order_cargos;
        const customerEmail =
          orderForEmail?.customer?.email ||
          meta?.customer_email ||
          'khachhang@example.com';
        const customerName =
          orderForEmail?.customer?.company_name ||
          orderForEmail?.receiver_name ||
          'Quý khách hàng';
        const contactPerson =
          orderForEmail?.customer?.contact_person ||
          orderForEmail?.receiver_name ||
          '';
        const orderCode = orderForEmail?.order_code || `ORD-${id}`;
        const cargoDescription = firstCargo?.cargo_name
          ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
          : 'Hàng hóa theo vận đơn';
        const declaredValue =
          Number(firstCargo?.declared_value || 0) ||
          Number(orderForEmail?.agreed_price || 0) * 10 ||
          120000000;
        const incidentCode = `INC-${String(id).padStart(3, '0')}`;
        const claimCode = existingClaims?.[0]?.id
          ? `CLM-${String(existingClaims[0].id).padStart(4, '0')}`
          : `CLM-${String(id).padStart(4, '0')}`;
        const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
        const trackingToken = (orderForEmail?.tracking_token || orderCode || '').trim();
        const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

        let sendRes;
        if (isApprove) {
          sendRes = await sendIncidentCompensationApprovalEmail({
            customerEmail,
            customerName,
            contactPerson,
            orderCode,
            tripCode: tripCodeForEmail,
            incidentCode,
            claimCode,
            incidentType: incMeta?.type || 'Sự cố vận chuyển hàng hóa',
            cargoDescription,
            declaredValue,
            damagePercentage: damage_percentage || 0,
            approvedAmount: Number(approved_amount) || 0,
            goodsHandlingMethod: goods_handling_method || 'CUSTOMER_RETAIN',
            contractClauseRef: contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa',
            resolutionNote: resolutionNoteFull,
            surveyOrgReport: survey_org_report || '',
            contactHotline: contact_hotline || '1900 1234',
            trackingUrl
          });
        } else {
          sendRes = await sendIncidentCompensationRejectionEmail({
            customerEmail,
            customerName,
            contactPerson,
            orderCode,
            tripCode: tripCodeForEmail,
            incidentCode,
            claimCode,
            incidentType: incMeta?.type || 'Sự cố vận chuyển hàng hóa',
            cargoDescription,
            rejectionReason: rejection_reason,
            rejectionClause: contract_clause_ref || 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng',
            resolutionNote: resolutionNoteFull,
            contactHotline: contact_hotline || '1900 1234',
            trackingUrl
          });
        }

        emailResult = {
          sent: Boolean(sendRes?.success),
          customer_email: customerEmail,
          email_type: isApprove ? 'APPROVAL' : 'REJECTION',
          email_sent_at: sendRes?.success ? now : null,
          preview_url: sendRes?.previewUrl || null
        };
      } catch (mailErr) {
        console.warn('Gửi email quyết định bồi thường warning:', mailErr.message);
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerInt,
          actor_type: 'MANAGER',
          action: isApprove ? 'APPROVE_INCIDENT_COMPENSATION' : isRequestMoreInfo ? 'REQUEST_MORE_INFO_INCIDENT' : 'REJECT_INCIDENT_COMPENSATION',
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          changes: {
            ...corePayload,
            resolved_time: now,
            updated_at: now,
            ...extendedMetadata,
            email_sent: emailResult.sent,
            customer_email: emailResult.customer_email,
            email_type: emailResult.email_type,
            email_sent_at: emailResult.email_sent_at
          },
          reason: String(isApprove ? resolution_note : isRequestMoreInfo ? resolution_note : rejection_reason || '').slice(0, 255),
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    // Gửi thông báo tới Điều phối viên (role_id = 3) và Tài xế báo sự cố
    try {
      const incidentCode = `INC-${String(id).padStart(3, '0')}`;
      const notifyMsg = isApprove
        ? `[${incidentCode}] Quản lý đã phê duyệt bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ. Đang chờ hoàn tất chi trả.`
        : isRequestMoreInfo
          ? `[${incidentCode}] Quản lý yêu cầu bổ sung hồ sơ/minh chứng: ${resolution_note || 'Kiểm tra chi tiết sự cố.'}`
          : `[${incidentCode}] Quản lý đã từ chối bồi thường theo ${contract_clause_ref || 'hợp đồng'} và đóng hồ sơ.`;

      const recipientIds = new Set();
      const dispatchers = await prisma.users.findMany({
        where: { role_id: 3 },
        select: { id: true }
      });
      (dispatchers || []).forEach((u) => {
        if (u?.id) recipientIds.add(Number(u.id));
      });

      if (updatedInc?.reported_by) {
        const driverProfile = await prisma.driver_profiles.findUnique({
          where: { id: BigInt(updatedInc.reported_by) },
          select: { user_account_id: true }
        });
        if (driverProfile?.user_account_id) {
          recipientIds.add(Number(driverProfile.user_account_id));
        }
      }

      if (recipientIds.size > 0) {
        const notifRows = Array.from(recipientIds).map((uid) => ({
          user_account_id: BigInt(uid),
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          message: notifyMsg,
          created_time: nowDate
        }));
        await prisma.notifications.createMany({ data: notifRows });
      }
    } catch (notifyErr) {
      console.warn('notify decideIncidentCompensation warning:', notifyErr.message);
    }

    const msg = isApprove
      ? `Đã phê duyệt mức bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ${emailResult.sent ? ` và gửi email thông báo tới ${emailResult.customer_email}` : ''} (Trạng thái: Chờ hoàn tất chi trả).`
      : isRequestMoreInfo
      ? 'Đã gửi yêu cầu bổ sung hồ sơ tới Điều phối viên & Khách hàng thành công.'
      : `Đã từ chối bồi thường${emailResult.sent ? ` và gửi email thông báo tới ${emailResult.customer_email}` : ''} — Hoàn tất đóng hồ sơ (DONE).`;

    return res.json({
      message: msg,
      incident: updatedInc ? { ...updatedInc, ...extendedMetadata } : { id: Number(id), ...corePayload, ...extendedMetadata },
      email_result: emailResult
    });
  } catch (error) {
    console.error('decideIncidentCompensation Error:', error);
    return res.status(500).json({ message: 'Lỗi khi ra quyết định bồi thường sự cố', error: error.message });
  }
};

/**
 * Manager/Điều phối viên xác nhận hoàn tất bồi thường và đóng hồ sơ sự cố (APPROVED -> DONE)
 */
const closeIncidentCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_proof_url, close_note, payment_date, transaction_code, approved_amount } = req.body;
    const managerId = req.user?.id || 1;

    if (!payment_proof_url || !payment_proof_url.trim()) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ảnh biên lai / chứng từ chuyển khoản ngân hàng để đóng hồ sơ.' });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const managerInt = Number(managerId || 1);
    const proofStr = await cloudinaryService.uploadDataUriIfNeeded(payment_proof_url, 'nexlog/claims');
    const noteInput = String(close_note || '').trim();
    const txMatch = noteInput.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
    const dateMatch = noteInput.match(/ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);

    const payDate = payment_date || (dateMatch ? dateMatch[1] : now.split('T')[0]);
    const txCode = String(transaction_code || (txMatch ? txMatch[1] : '') || `FT${payDate.replace(/[^0-9]/g, '').slice(2, 8)}${String(id).padStart(4, '0')}`).trim();
    const closeNoteFull = noteInput || `Đã hoàn tất chi tiền ngày ${payDate}. Mã GD: ${txCode}`;

    // Đọc thông tin sự cố hiện có để bảo toàn nhận xét phê duyệt & trip_id
    const existingInc = await prisma.incidents.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, trip_id: true, resolution_note: true }
    });

    const existingClaims = await prisma.compensation_claims.findMany({
      where: { incident_id: BigInt(id) },
      select: { id: true, amount: true }
    });

    const resolvedPaidAmount = Number(
      approved_amount ||
      existingClaims?.[0]?.amount ||
      0
    );

    const prevNote = existingInc?.resolution_note ? `${existingInc.resolution_note} | ` : '';
    const mergedNote = `${prevNote}[ĐÃ CHI TIỀN - Ngày: ${payDate} | Mã GD: ${txCode}]`.slice(0, 500);

    const coreClosePayload = {
      status: 'DONE',
      resolution_note: mergedNote,
      resolved_by: managerInt,
      resolved_time: nowDate,
      updated_at: nowDate
    };

    let updatedInc = null;
    try {
      const updatedIncRow = await prisma.incidents.update({
        where: { id: BigInt(id) },
        data: coreClosePayload
      });
      updatedInc = serializePrisma(updatedIncRow);
    } catch (incErr) {
      console.warn('Close incident status DONE failed, retry with RESOLVED:', incErr.message);
      try {
        const retryRow = await prisma.incidents.update({
          where: { id: BigInt(id) },
          data: {
            ...coreClosePayload,
            status: 'RESOLVED'
          }
        });
        updatedInc = serializePrisma(retryRow);
      } catch (retryErr) {
        console.warn('Close incident retry warning:', retryErr.message);
      }
    }

    // Cập nhật hoặc tạo mới bản ghi compensation_claims để lưu chứng từ UNC & ghi chú giao dịch
    if (existingClaims && existingClaims.length > 0) {
      const claimPayload = {
        status: 'PAID',
        evidence: proofStr,
        review_comment: closeNoteFull,
        reviewed_by: managerInt,
        reviewed_time: nowDate,
        updated_at: nowDate,
        ...(resolvedPaidAmount > 0 ? { amount: BigInt(Math.round(resolvedPaidAmount)) } : {})
      };
      try {
        await prisma.compensation_claims.updateMany({
          where: { incident_id: BigInt(id) },
          data: claimPayload
        });
      } catch (paidErr) {
        console.warn('compensation_claims status PAID rejected by constraint, retry with APPROVED:', paidErr.message);
        await prisma.compensation_claims.updateMany({
          where: { incident_id: BigInt(id) },
          data: {
            ...claimPayload,
            status: 'APPROVED'
          }
        });
      }
    } else {
      let orderId = null;
      const tripIdToLookup = updatedInc?.trip_id || (existingInc?.trip_id ? Number(existingInc.trip_id) : null);
      if (tripIdToLookup) {
        const stop = await prisma.trip_stops.findFirst({
          where: {
            trip_id: BigInt(tripIdToLookup),
            order_id: { not: null }
          },
          select: { order_id: true }
        });
        if (stop?.order_id) orderId = stop.order_id;
      }
      if (!orderId) {
        const anyOrder = await prisma.orders.findFirst({ select: { id: true } });
        orderId = anyOrder?.id || null;
      }

      if (orderId) {
        await prisma.compensation_claims.create({
          data: {
            incident_id: BigInt(id),
            order_id: BigInt(orderId),
            source: 'INCIDENT',
            amount: BigInt(Math.round(resolvedPaidAmount)),
            reason: closeNoteFull,
            evidence: proofStr,
            status: 'APPROVED',
            created_by: managerInt,
            reviewed_by: managerInt,
            reviewed_time: nowDate,
            review_comment: closeNoteFull,
            updated_at: nowDate
          }
        });
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerInt,
          actor_type: 'MANAGER',
          action: 'CLOSE_INCIDENT_CASE_DONE',
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          changes: {
            status: updatedInc?.status || coreClosePayload.status,
            resolution_note: mergedNote,
            resolved_by: managerInt,
            resolved_time: now,
            payment_date: payDate,
            transaction_code: txCode,
            payment_proof_url: proofStr,
            close_note: closeNoteFull,
            approved_amount: resolvedPaidAmount
          },
          reason: closeNoteFull.slice(0, 255),
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    return res.json({
      message: 'Đã xác nhận hoàn tất bồi thường và đóng hồ sơ sự cố thành công (DONE).',
      incident: {
        ...(updatedInc || { id: Number(id), ...coreClosePayload }),
        payment_date: payDate,
        transaction_code: txCode,
        payment_proof_url: proofStr,
        payment_note: closeNoteFull,
        approved_compensation_amount: resolvedPaidAmount
      }
    });
  } catch (error) {
    console.error('closeIncidentCase Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi đóng hồ sơ sự cố', error: error.message });
  }
};

const getClaims = async (req, res) => {
  try {
    const rawClaims = await prisma.compensation_claims.findMany({
      orderBy: { id: 'desc' },
      include: {
        incidents: {
          select: {
            id: true,
            type: true,
            fault: true,
            description: true,
            photos: true,
            status: true,
            reported_time: true,
            trip_id: true,
            trips: {
              select: {
                id: true,
                trip_code: true,
                status: true,
                trip_trucks: { select: { trucks: { select: { plate_number: true } } } },
                trip_drivers: {
                  select: {
                    driver_profiles: {
                      select: { users: { select: { full_name: true, phone: true } } }
                    }
                  }
                }
              }
            }
          }
        },
        orders: {
          select: {
            id: true,
            order_code: true,
            order_type: true,
            agreed_price: true,
            customer_id: true,
            receiver_name: true
          }
        }
      }
    });

    const claims = (serializePrisma(rawClaims) || []).map((c) => ({
      ...c,
      decided_by: c.reviewed_by,
      decided_at: c.reviewed_time,
      decision_comment: c.review_comment,
      created_at: c.created_time,
      order: c.orders || null,
      incident: c.incidents
        ? {
            ...c.incidents,
            trip: c.incidents.trips
              ? {
                  ...c.incidents.trips,
                  trip_trucks: (c.incidents.trips.trip_trucks || []).map((tt) => ({
                    ...tt,
                    truck: tt.trucks || null
                  })),
                  trip_drivers: (c.incidents.trips.trip_drivers || []).map((td) => ({
                    ...td,
                    driver: td.driver_profiles
                      ? { ...td.driver_profiles, user: td.driver_profiles.users || null }
                      : null
                  }))
                }
              : null
          }
        : null
    }));

    const rawContracts = await prisma.transport_contracts.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, customer_id: true, liability_cap: true, status: true }
    });
    const contracts = serializePrisma(rawContracts) || [];

    const contractMap = {};
    (contracts || []).forEach((c) => {
      if (c.customer_id) {
        contractMap[c.customer_id] = Number(c.liability_cap || 0);
      }
    });

    const typeDisplayMap = {
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

    const formattedClaims = (claims || []).map((c) => {
      const order = c.order;
      const incident = c.incident;
      const customerId = order?.customer_id;
      const contractCap = customerId && contractMap[customerId] ? contractMap[customerId]: 0;
      const declaredValue = Number(order?.agreed_price || 0) * 10;

      //: Giới hạn trách nhiệm = min(Contract Cap, Declared Value) hoặc 500M VNĐ
      let liabilityLimit = 500000000;
      if (contractCap > 0 && declaredValue > 0) {
        liabilityLimit = Math.min(contractCap, declaredValue);
      } else if (contractCap > 0) {
        liabilityLimit = contractCap;
      } else if (declaredValue > 0) {
        liabilityLimit = declaredValue;
      }

      const isExceedingCap = Number(c.amount || 0) > liabilityLimit;

      const incidentCode = incident?.id ? `INC-${String(incident.id).padStart(3, '0')}`: null;

      let sourceDisplay = 'Sự cố vận chuyển';
      if (c.source === 'CUSTOMER_CLAIM') {
        sourceDisplay = 'Khách hàng khiếu nại (Tracking Portal)';
      } else if (c.source === 'DISPATCHER_ESCALATED') {
        sourceDisplay = 'ĐPV chuyển tiếp sự cố nghiêm trọng';
      } else if (c.source === 'DRIVER_REPORTED') {
        sourceDisplay = 'Tài xế báo cáo sự cố hiện trường';
      } else if (incidentCode) {
        sourceDisplay = `Sự cố ${incidentCode}`;
      }

      const tripObj = incident?.trip;
      const truckPlate = tripObj?.trip_trucks?.[0]?.truck?.plate_number || null;
      const driverObj = tripObj?.trip_drivers?.[0]?.driver?.user;
      const driverName = driverObj?.full_name || null;
      const driverPhone = driverObj?.phone || null;

      let incidentPhotos = [];
      if (incident?.photos) {
        if (Array.isArray(incident.photos)) {
          incidentPhotos = incident.photos;
        } else if (typeof incident.photos === 'string') {
          try {
            incidentPhotos = JSON.parse(incident.photos);
          } catch {
            incidentPhotos = [incident.photos];
          }
        }
      }

      return {
        id: c.id,
        claim_code: `CLM-${String(c.id).padStart(4, '0')}`,
        order_id: c.order_id,
        order_code: order?.order_code || 'N/A',
        order_type: order?.order_type || 'Export',
        customer_id: customerId,
        receiver_name: order?.receiver_name || null,
        incident_id: c.incident_id,
        incident_code: incidentCode,
        incident_type: incident?.type || null,
        incident_type_display: incident?.type ? (typeDisplayMap[incident.type] || incident.type): 'Sự cố vận tải',
        incident_fault: incident?.fault || 'COMPANY',
        incident_description: incident?.description || '',
        incident_status: incident?.status || null,
        incident_photos: incidentPhotos,
        incident_reported_time: incident?.reported_time || null,
        trip_id: incident?.trip_id || tripObj?.id || null,
        trip_code: tripObj?.trip_code || (incident?.trip_id ? `TRIP-${incident.trip_id}`: null),
        truck_plate: truckPlate,
        driver_name: driverName,
        driver_phone: driverPhone,
        source: c.source || 'INCIDENT',
        source_display: sourceDisplay,
        amount: Number(c.amount || 0),
        reason: c.reason,
        status: c.status || 'PENDING',
        decided_by: c.decided_by,
        decided_at: c.decided_at,
        decision_comment: c.decision_comment,
        contract_cap: contractCap,
        declared_value: declaredValue,
        liability_limit: liabilityLimit,
        is_exceeding_cap: isExceedingCap,
        created_at: c.created_at
      };
    });

    return res.json({
      claims: formattedClaims,
      summary: {
        total: formattedClaims.length,
        pending: formattedClaims.filter((x) => x.status === 'PENDING').length,
        approved: formattedClaims.filter((x) => x.status === 'APPROVED').length,
        rejected: formattedClaims.filter((x) => x.status === 'REJECTED').length
      }
    });
  } catch (error) {
    console.error('getClaims Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách khiếu nại bồi thường', error: error.message });
  }
};

const decideClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment, note } = req.body;
    const managerId = req.user?.id || null;

    const decisionText = comment || note;
    const isApprove = action === 'APPROVE' || action === 'Approve';
    const targetStatus = isApprove ? 'APPROVED': 'REJECTED';

    const rawClaim = await prisma.compensation_claims.findUnique({
      where: { id: BigInt(id) }
    });

    if (!rawClaim) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu bồi thường.' });
    }
    const claim = serializePrisma(rawClaim);

    if (!isApprove && !decisionText) {
      return res.status(400).json({ message: 'Bắt buộc nhập lý do/nhận xét khi từ chối bồi thường.' });
    }

    const nowDate = new Date();
    const reviewerInt = managerId ? Number(managerId) : null;
    const commentStr = decisionText || (isApprove ? 'Phê duyệt bồi thường hợp lệ.' : 'Từ chối bồi thường.');

    const updatedClaimRow = await prisma.compensation_claims.update({
      where: { id: BigInt(id) },
      data: {
        status: targetStatus,
        reviewed_by: reviewerInt,
        reviewed_time: nowDate,
        review_comment: commentStr,
        updated_at: nowDate
      }
    });
    const serializedClaim = serializePrisma(updatedClaimRow);
    const updatedClaim = {
      ...serializedClaim,
      decided_by: serializedClaim.reviewed_by,
      decided_at: serializedClaim.reviewed_time,
      decision_comment: serializedClaim.review_comment
    };

    if (claim.incident_id) {
      try {
        await prisma.incidents.update({
          where: { id: BigInt(claim.incident_id) },
          data: {
            status: isApprove ? 'RESOLVED' : 'CLOSED',
            updated_at: nowDate
          }
        });
      } catch (incErr) {
        await prisma.incidents.update({
          where: { id: BigInt(claim.incident_id) },
          data: {
            status: 'RESOLVED',
            updated_at: nowDate
          }
        }).catch(() => {});
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: reviewerInt,
          actor_type: 'MANAGER',
          action: isApprove ? 'APPROVE_CLAIM' : 'REJECT_CLAIM',
          target_type: 'COMPENSATION_CLAIM',
          target_id: BigInt(id),
          changes: { status: targetStatus, amount: Number(claim.amount || 0) },
          reason: decisionText || null,
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    const msg = isApprove
      ? `Đã phê duyệt yêu cầu bồi thường ${claim.amount?.toLocaleString('vi-VN')} đ.`
      : 'Đã từ chối yêu cầu bồi thường thành công.';

    return res.json({ message: msg, claim: updatedClaim });
  } catch (error) {
    console.error('decideClaim Error:', error);
    return res.status(500).json({ message: 'Lỗi khi xử lý yêu cầu bồi thường', error: error.message });
  }
};

const sendIncidentDecisionEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      email_type, // 'APPROVAL' | 'REJECTION'
      customer_email: bodyCustomerEmail,
      approved_amount,
      damage_percentage,
      goods_handling_method,
      contract_clause_ref,
      survey_org_report,
      resolution_note,
      rejection_reason,
      contact_hotline
    } = req.body || {};
    const managerId = req.user?.id || 1;

    const rawIncident = await prisma.incidents.findUnique({
      where: { id: BigInt(id) },
      include: {
        trips: { select: { id: true, trip_code: true } },
        compensation_claims: true
      }
    });

    if (!rawIncident) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sự cố.' });
    }
    const incident = mapIncidentRelations(rawIncident);

    let orderForEmail = null;
    if (incident.trip_id) {
      const stop = await prisma.trip_stops.findFirst({
        where: {
          trip_id: BigInt(incident.trip_id),
          order_id: { not: null }
        },
        select: {
          orders: {
            select: {
              id: true,
              order_code: true,
              agreed_price: true,
              tracking_token: true,
              receiver_name: true,
              order_notes: true,
              customers: { select: { company_name: true, contact_person: true, email: true, phone: true } },
              order_cargos: { select: { cargo_name: true, quantity: true, unit: true, actual_weight_kg: true, declared_value: true } }
            }
          }
        }
      });
      orderForEmail = stop?.orders ? mapOrderSummaryAliases(stop.orders) : null;
    }

    const meta = orderForEmail ? parseOrderMeta(orderForEmail) : {};
    const firstCargo = Array.isArray(orderForEmail?.order_cargos)
      ? orderForEmail.order_cargos[0]
      : orderForEmail?.order_cargos;
    const claim = Array.isArray(incident.compensation_claims)
      ? incident.compensation_claims[0]
      : incident.compensation_claims;

    const customerEmail =
      (bodyCustomerEmail && String(bodyCustomerEmail).trim()) ||
      orderForEmail?.customer?.email ||
      meta?.customer_email ||
      'khachhang@example.com';
    const customerName =
      orderForEmail?.customer?.company_name ||
      orderForEmail?.receiver_name ||
      'Quý khách hàng';
    const contactPerson =
      orderForEmail?.customer?.contact_person ||
      orderForEmail?.receiver_name ||
      '';
    const orderCode = orderForEmail?.order_code || `ORD-${id}`;
    const tripCode = incident.trip?.trip_code || `TRIP-${incident.trip_id}`;
    const cargoDescription = firstCargo?.cargo_name
      ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
      : 'Hàng hóa theo vận đơn';
    const declaredValue =
      Number(firstCargo?.declared_value || 0) ||
      Number(orderForEmail?.agreed_price || 0) * 10 ||
      120000000;
    const incidentCode = `INC-${String(id).padStart(3, '0')}`;
    const claimCode = claim?.id
      ? `CLM-${String(claim.id).padStart(4, '0')}`
      : `CLM-${String(id).padStart(4, '0')}`;
    const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const trackingToken = (orderForEmail?.tracking_token || orderCode || '').trim();
    const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

    const isRejectType =
      String(email_type || '').toUpperCase() === 'REJECTION' ||
      (!email_type && (Boolean(incident.rejection_reason) || String(claim?.status || '').toUpperCase() === 'REJECTED'));

    const finalAmount = Number(
      approved_amount ??
      incident.approved_compensation_amount ??
      claim?.amount ??
      0
    );

    let sendRes;
    if (isRejectType) {
      sendRes = await sendIncidentCompensationRejectionEmail({
        customerEmail,
        customerName,
        contactPerson,
        orderCode,
        tripCode,
        incidentCode,
        claimCode,
        incidentType: incident.type || 'Sự cố vận chuyển hàng hóa',
        cargoDescription,
        rejectionReason: rejection_reason || incident.rejection_reason || incident.resolution_note,
        rejectionClause: contract_clause_ref || incident.contract_clause_ref || 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng',
        resolutionNote: resolution_note || incident.resolution_note,
        contactHotline: contact_hotline || incident.contact_hotline || '1900 1234',
        trackingUrl
      });
    } else {
      sendRes = await sendIncidentCompensationApprovalEmail({
        customerEmail,
        customerName,
        contactPerson,
        orderCode,
        tripCode,
        incidentCode,
        claimCode,
        incidentType: incident.type || 'Sự cố vận chuyển hàng hóa',
        cargoDescription,
        declaredValue,
        damagePercentage: damage_percentage ?? incident.damage_percentage ?? 10,
        approvedAmount: finalAmount,
        goodsHandlingMethod: goods_handling_method || incident.goods_handling_method || 'CUSTOMER_RETAIN',
        contractClauseRef: contract_clause_ref || incident.contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa',
        resolutionNote: resolution_note || incident.resolution_note,
        surveyOrgReport: survey_org_report || '',
        contactHotline: contact_hotline || incident.contact_hotline || '1900 1234',
        trackingUrl
      });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const resolvedType = isRejectType ? 'REJECTION' : 'APPROVAL';
    if (sendRes?.success) {
      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: Number(managerId || 1),
            actor_type: 'MANAGER',
            action: isRejectType ? 'REJECT_INCIDENT_COMPENSATION' : 'APPROVE_INCIDENT_COMPENSATION',
            target_type: 'INCIDENT',
            target_id: BigInt(id),
            changes: {
              email_sent: true,
              customer_email: customerEmail,
              email_type: resolvedType,
              email_sent_at: now,
              message_id: sendRes.messageId || null,
              approved_compensation_amount: finalAmount,
              damage_percentage: damage_percentage ?? incident.damage_percentage ?? 10,
              goods_handling_method: goods_handling_method || incident.goods_handling_method || 'CUSTOMER_RETAIN',
              contract_clause_ref: contract_clause_ref || incident.contract_clause_ref || null
            },
            reason: `Gửi email thông báo ${isRejectType ? 'từ chối' : 'phê duyệt'} bồi thường tới ${customerEmail}`.slice(0, 255),
            created_time: nowDate
          }
        });
      } catch (logErr) {
        console.warn('sendIncidentDecisionEmail activity_logs warning:', logErr.message);
      }
    }

    if (!sendRes?.success) {
      return res.status(500).json({
        success: false,
        message: sendRes?.error || 'Không thể gửi email tới khách hàng.'
      });
    }

    return res.json({
      success: true,
      message: `Đã gửi email thông báo tới ${customerEmail} thành công!`,
      email_result: {
        sent: true,
        customer_email: customerEmail,
        email_type: resolvedType,
        email_sent_at: now,
        message_id: sendRes.messageId || null,
        preview_url: sendRes.previewUrl || null
      }
    });
  } catch (error) {
    console.error('sendIncidentDecisionEmail Error:', error);
    return res.status(500).json({ message: 'Lỗi khi gửi email cho khách hàng', error: error.message });
  }
};

module.exports = {
  getAllIncidents,
  createIncident,
  updateIncidentStatus,
  getIncidents,
  getIncidentById,
  resolveIncident,
  decideIncidentCompensation,
  sendIncidentDecisionEmail,
  closeIncidentCase,
  getClaims,
  decideClaim,
  getApprovals: getClaims,
  decideApproval: decideClaim
};

