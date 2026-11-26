const prisma = require('../../config/prisma');
const { serializePrisma } = require('../../utils/prismaHelper');
const incidentService = require('../../services/incidentService');
const { parseOrderMeta } = require('../../services/orderHelperService');
const {
  INCIDENT_SAFE_SELECT,
  parseIncidentIdParam,
  COMPENSATION_ELIGIBLE_DB_TYPES,
  INCIDENT_TYPE_MAP,
  mapOrderSummaryAliases,
  mapIncidentRelations
} = require('./incidentHelper');

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
// B. MANAGER MAJOR INCIDENTS QUERIES
// ==========================================

const getIncidents = async (req, res) => {
  try {
    const { status, type } = req.query;

    const baseWhere = {
      AND: [
        { type: { in: COMPENSATION_ELIGIBLE_DB_TYPES } },
        {
          OR: [
            {
              status: {
                in: [
                  'ESCALATED', 'Escalated',
                  'APPROVED', 'Approved',
                  'PAID', 'Paid',
                  'RESOLVED', 'Resolved',
                  'DONE', 'Done',
                  'CLOSED', 'Closed',
                  'REJECTED', 'Rejected',
                  'IN_PROGRESS'
                ]
              }
            },
            { escalated_time: { not: null } },
            { resolved_by: { not: null } },
            { compensation_claims: { some: {} } }
          ]
        }
      ]
    };

    const rawIncidents = await prisma.incidents.findMany({
      where: baseWhere,
      orderBy: { id: 'desc' },
      select: {
        ...INCIDENT_SAFE_SELECT,
        trips: {
          select: {
            id: true,
            trip_code: true,
            status: true,
            trip_trucks: { select: { released_time: true, trucks: { select: { plate_number: true } } } },
            trip_drivers: {
              select: {
                released_time: true,
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
          select: {
            id: true,
            amount: true,
            approved_amount: true,
            status: true,
            reason: true,
            evidence: true,
            review_comment: true,
            payment_proof_url: true,
            transaction_code: true,
            payment_date: true,
            called_at: true,
            paid_at: true,
            source: true
          },
          orderBy: { id: 'desc' }
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

    const allFormatted = (incidents || []).map((i) => {
      const claim = Array.isArray(i.compensation_claims)
        ? i.compensation_claims[0]
        : i.compensation_claims;
      const incLogs = logsByIncidentId[Number(i.id)] || [];
      const closeLog = incLogs.find(
        (l) => l.action === 'CLOSE_INCIDENT_CASE_DONE' || l.action === 'RECORD_INCIDENT_PAYMENT'
      );
      const approveLog = incLogs.find((l) => l.action === 'APPROVE_INCIDENT_COMPENSATION');
      const rejectLog = incLogs.find((l) => l.action === 'REJECT_INCIDENT_COMPENSATION');

      const rawStatus = (i.status || '').toUpperCase();
      const claimStatusUpper = String(claim?.status || '').toUpperCase();
      const isCaseRejected =
        Boolean(i.rejection_reason) ||
        Boolean(rejectLog) ||
        claimStatusUpper === 'REJECTED' ||
        claimStatusUpper === 'CLOSED_REJECTED' ||
        rawStatus === 'REJECTED' ||
        Boolean(i.resolution_note && i.resolution_note.includes('Từ chối bồi thường'));
      const isPaid = !isCaseRejected && (claimStatusUpper === 'PAID' || rawStatus === 'PAID');
      const isClosedCase =
        claimStatusUpper === 'CLOSED_COMPENSATED' ||
        claimStatusUpper === 'CLOSED_REJECTED' ||
        (['DONE', 'RESOLVED', 'CLOSED'].includes(rawStatus) &&
          claimStatusUpper !== 'APPROVED' &&
          claimStatusUpper !== 'PAID' &&
          claimStatusUpper !== 'PENDING') ||
        (isCaseRejected && !claim);
      const isApproved =
        !isCaseRejected &&
        !isPaid &&
        !isClosedCase &&
        (rawStatus === 'APPROVED' || claimStatusUpper === 'APPROVED' || Boolean(approveLog));

      let normStatus = 'REPORTED';
      let statusDisplay = 'Đã báo';
      if (isClosedCase) {
        normStatus = 'RESOLVED';
        statusDisplay = isCaseRejected ? 'Đã từ chối (Đóng)' : 'Đã hoàn tất (Đóng)';
      } else if (isPaid) {
        normStatus = 'PAID';
        statusDisplay = 'Đã chi trả (Chờ khách xác nhận)';
      } else if (isCaseRejected) {
        normStatus = 'REJECTED';
        statusDisplay = 'Đã từ chối (Chờ ĐPV gọi khách)';
      } else if (isApproved) {
        normStatus = 'APPROVED';
        statusDisplay = 'Đã duyệt (Chờ thanh toán)';
      } else if (rawStatus === 'ESCALATED' || rawStatus === 'IN_PROGRESS' || claimStatusUpper === 'PENDING') {
        normStatus = 'ESCALATED';
        statusDisplay = rawStatus === 'IN_PROGRESS' ? 'Chờ bổ sung hồ sơ' : 'Chờ Quản lý xử lý';
      }

      const rawType = i.type || 'OTHER';
      const isMajor =
        ['DAMAGED_LOST_CARGO', 'DAMAGED_CARGO', 'CARGO_DAMAGED', 'CARGO_LOST', 'Cargo Damaged', 'Cargo Lost', 'TRAFFIC_ACCIDENT', 'ACCIDENT', 'Accident', 'CARGO_HELD', 'SEIZED_BY_AUTHORITY', 'HELD_BY_AUTHORITIES'].includes(rawType) ||
        normStatus === 'ESCALATED';

      const orderCode = orderMapByTrip[i.trip_id] || null;
      const activeTruckAssign =
        (i.trip?.trip_trucks || []).find((tt) => !tt.released_time && tt.truck) ||
        i.trip?.trip_trucks?.[0];
      const activeDriverAssign =
        (i.trip?.trip_drivers || []).find((td) => !td.released_time && td.driver?.user) ||
        i.trip?.trip_drivers?.[0];
      const tripTruck = activeTruckAssign?.truck?.plate_number || null;
      const tripDriver = activeDriverAssign?.driver?.user?.full_name || null;
      const tripDriverPhone = activeDriverAssign?.driver?.user?.phone || null;

      const noteAmountMatch = typeof i.resolution_note === 'string'
        ? i.resolution_note.match(/([\d.,]+)\s*(?:VNĐ|đ)/i)
        : null;
      const parsedNoteAmount = noteAmountMatch ? Number(noteAmountMatch[1].replace(/[.,]/g, '')) : 0;
      const resolvedApprovedAmount = Number(
        claim?.approved_amount ||
        i.approved_compensation_amount ||
        approveLog?.changes?.approved_compensation_amount ||
        ((claimStatusUpper === 'APPROVED' || claimStatusUpper === 'PAID' || claimStatusUpper === 'CLOSED_COMPENSATED') ? claim?.amount : 0) ||
        (normStatus === 'RESOLVED' && !isCaseRejected && parsedNoteAmount >= 1000 ? parsedNoteAmount : 0) ||
        0
      );

      const txSourceText = `${closeLog?.changes?.close_note || ''} ${claim?.review_comment || ''} ${i.resolution_note || ''}`;
      const txMatch = txSourceText.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
      const resolvedTxCode =
        claim?.transaction_code ||
        closeLog?.changes?.transaction_code ||
        (txMatch ? txMatch[1] : null);
      const resolvedPaymentDate = claim?.payment_date
        ? new Date(claim.payment_date).toISOString().split('T')[0]
        : (closeLog?.changes?.payment_date || null);

      return {
        id: i.id,
        code: `INC-${String(i.id).padStart(3, '0')}`,
        trip_id: i.trip_id,
        trip_code: i.trip?.trip_code || (i.trip_id ? `TRIP-${i.trip_id}` : null),
        order_code: orderCode,
        truck_plate: tripTruck || null,
        driver_name: tripDriver || i.driver?.user?.full_name || null,
        driver_phone: tripDriverPhone || i.driver?.user?.phone || null,
        type: i.type,
        type_display: INCIDENT_TYPE_MAP[i.type] || i.type || 'Khác',
        is_major: isMajor,
        description: i.description,
        photos: i.photos || [],
        fault: i.fault,
        cargo_affected: i.cargo_affected !== undefined ? i.cargo_affected : null,
        status: normStatus,
        status_display: statusDisplay,
        raw_status: i.status,
        reported_time: i.reported_time || i.created_at,
        escalated_time: i.escalated_time,
        escalation_reason: i.escalation_reason,
        resolution_note: i.resolution_note,
        resolved_time: i.resolved_time,
        reporter_name: i.driver?.user?.full_name || null,
        damage_percentage: i.damage_percentage ?? approveLog?.changes?.damage_percentage ?? null,
        goods_handling_method: i.goods_handling_method || approveLog?.changes?.goods_handling_method || null,
        contract_clause_ref: i.contract_clause_ref || approveLog?.changes?.contract_clause_ref || rejectLog?.changes?.contract_clause_ref || null,
        proposed_compensation_amount: Number(i.proposed_compensation_amount || 0),
        approved_compensation_amount: resolvedApprovedAmount,
        rejection_reason: i.rejection_reason || (isCaseRejected ? (rejectLog?.reason || claim?.review_comment || i.resolution_note) : null),
        contact_hotline: i.contact_hotline || '1900 1234',
        payment_proof_url:
          (isPaid || isClosedCase) && !isCaseRejected
            ? (claim?.payment_proof_url || i.payment_proof_url || closeLog?.changes?.payment_proof_url || null)
            : null,
        transaction_code: resolvedTxCode,
        payment_date: resolvedPaymentDate,
        called_at: claim?.called_at || null,
        paid_at: claim?.paid_at || null,
        incident_lat: i.incident_lat != null ? Number(i.incident_lat) : null,
        incident_lng: i.incident_lng != null ? Number(i.incident_lng) : null,
        is_on_route: i.is_on_route !== false,
        route_deviation_km: i.route_deviation_km ? Number(i.route_deviation_km) : 0,
        claim_id: claim?.id || null,
        claim_code: claim?.id ? `CLM-${String(claim.id).padStart(4, '0')}` : null,
        claim_amount: claim ? Number(claim.amount || 0) : 0,
        claim_status: claim?.status || null,
        claim_source: claim?.source || null
      };
    });

    // Bộ đếm KPI tính trên toàn bộ danh sách chưa lọc (BUG-UI-10 / UI-48)
    const summary = {
      total: allFormatted.length,
      escalated: allFormatted.filter((x) => x.status === 'ESCALATED').length,
      approved: allFormatted.filter((x) => x.status === 'APPROVED').length,
      paid: allFormatted.filter((x) => x.status === 'PAID').length,
      rejected: allFormatted.filter((x) => x.status === 'REJECTED').length,
      pending: allFormatted.filter((x) => x.status === 'ESCALATED' || x.status === 'REPORTED').length,
      resolved: allFormatted.filter((x) => x.status === 'RESOLVED').length
    };

    let filtered = allFormatted;
    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      if (s === 'ESCALATED') {
        filtered = filtered.filter((x) => x.status === 'ESCALATED');
      } else if (s === 'APPROVED') {
        filtered = filtered.filter((x) => x.status === 'APPROVED');
      } else if (s === 'PAID') {
        filtered = filtered.filter((x) => x.status === 'PAID');
      } else if (s === 'REJECTED') {
        filtered = filtered.filter((x) => x.status === 'REJECTED');
      } else if (s === 'RESOLVED') {
        filtered = filtered.filter((x) => x.status === 'RESOLVED');
      } else if (s === 'REPORTED') {
        filtered = filtered.filter((x) => x.status === 'REPORTED');
      } else {
        filtered = filtered.filter((x) => String(x.raw_status || '').toUpperCase() === s || x.status === s);
      }
    }

    if (type && type !== 'ALL') {
      const t = type.toUpperCase();
      if (t === 'DAMAGED_LOST_CARGO' || t === 'DAMAGED_CARGO') {
        const group = ['DAMAGED_LOST_CARGO', 'DAMAGED_CARGO', 'CARGO_DAMAGED', 'CARGO_LOST', 'Cargo Damaged', 'Cargo Lost'];
        filtered = filtered.filter((x) => group.includes(x.type));
      } else if (t === 'TRAFFIC_ACCIDENT') {
        const group = ['TRAFFIC_ACCIDENT', 'ACCIDENT', 'Accident'];
        filtered = filtered.filter((x) => group.includes(x.type));
      } else if (t === 'CARGO_HELD') {
        const group = ['CARGO_HELD', 'SEIZED_BY_AUTHORITY', 'HELD_BY_AUTHORITIES'];
        filtered = filtered.filter((x) => group.includes(x.type));
      } else {
        filtered = [];
      }
    }

    return res.json({
      incidents: filtered,
      summary
    });
  } catch (error) {
    console.error('getIncidents Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách sự cố', error: error.message });
  }
};

const getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseIncidentIdParam(id);
    if (!numId) {
      return res.status(400).json({ message: 'Mã sự cố không hợp lệ.' });
    }
    const rawIncident = await prisma.incidents.findUnique({
      where: { id: BigInt(numId) },
      select: {
        ...INCIDENT_SAFE_SELECT,
        trip_stops: {
          select: {
            id: true,
            locations: { select: { name: true, address: true } }
          }
        },
        trips: {
          select: {
            id: true,
            trip_code: true,
            status: true,
            trip_trucks: {
              select: { released_time: true, trucks: { select: { id: true, plate_number: true } } }
            },
            trip_drivers: {
              select: {
                released_time: true,
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
        compensation_claims: { orderBy: { id: 'desc' } }
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
              customer_id: true,
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
          orderInfo.declared_value = firstCargo.declared_value !== null && firstCargo.declared_value !== undefined
            ? Number(firstCargo.declared_value)
            : null;
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

    // Tra cứu hợp đồng vận chuyển tương ứng (chỉ dùng hợp đồng thật từ DB, không bịa)
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
    } else if (orderInfo?.customer_id) {
      const activeContract = await prisma.transport_contracts.findFirst({
        where: {
          customer_id: BigInt(orderInfo.customer_id),
          status: { in: ['ACTIVE', 'Active'] }
        },
        orderBy: { id: 'desc' },
        select: {
          id: true,
          contract_number: true,
          liability_cap: true,
          attachment_link: true,
          compensation_terms: true,
          terms_and_responsibilities: true
        }
      });
      if (activeContract) {
        contractInfo = serializePrisma(activeContract);
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

    const activeTruckAssign =
      (incident.trip?.trip_trucks || []).find((tt) => !tt.released_time && tt.truck) ||
      incident.trip?.trip_trucks?.[0];
    const activeDriverAssign =
      (incident.trip?.trip_drivers || []).find((td) => !td.released_time && td.driver?.user) ||
      incident.trip?.trip_drivers?.[0];
    const truckPlate = activeTruckAssign?.truck?.plate_number || null;
    const driverName = activeDriverAssign?.driver?.user?.full_name || incident.driver?.user?.full_name || null;
    const driverPhone = activeDriverAssign?.driver?.user?.phone || incident.driver?.user?.phone || null;
    const stopLocation = incident.trip_stops?.locations || null;
    const derivedLocation =
      stopLocation?.name ||
      stopLocation?.address ||
      (incident.incident_lat != null && incident.incident_lng != null
        ? `${Number(incident.incident_lat).toFixed(5)}, ${Number(incident.incident_lng).toFixed(5)}`
        : null);

    // Xử lý ảnh sự cố hiện trường (chỉ trả ảnh thật, không fallback ảnh mẫu)
    let incidentPhotos = [];
    if (incident.photos) {
      if (Array.isArray(incident.photos)) {
        incidentPhotos = incident.photos.filter(Boolean);
      } else if (typeof incident.photos === 'string') {
        try {
          const parsed = JSON.parse(incident.photos);
          incidentPhotos = Array.isArray(parsed) ? parsed.filter(Boolean) : [incident.photos];
        } catch {
          incidentPhotos = [incident.photos];
        }
      }
    }

    // Truy vấn chuỗi sự kiện chuyến thực tế quanh thời điểm sự cố
    let tripEventsTimeline = null;
    if (incident.trip_id) {
      try {
        const events = await prisma.trip_events.findMany({
          where: { trip_id: BigInt(incident.trip_id) },
          orderBy: { phone_time: 'asc' },
          take: 20,
          select: { event_type: true, phone_time: true, received_time: true }
        });
        if (events && events.length > 0) {
          tripEventsTimeline = events
            .map((ev) => {
              const t = ev.phone_time || ev.received_time;
              const timeStr = t ? new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
              return timeStr ? `${timeStr} ${ev.event_type}` : ev.event_type;
            })
            .join(' · ');
        }
      } catch (evErr) {
        console.warn('getIncidentById trip_events warning:', evErr.message);
      }
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
          target_id: BigInt(numId)
        },
        select: { action: true, changes: true, reason: true, created_time: true },
        orderBy: { id: 'desc' },
        take: 15
      });
      incLogs = serializePrisma(rawLogs) || [];
    } catch (logErr) {
      console.warn('getIncidentById activity_logs warning:', logErr.message);
    }

    const closeLog = incLogs.find(
      (l) => l.action === 'CLOSE_INCIDENT_CASE_DONE' || l.action === 'RECORD_INCIDENT_PAYMENT'
    );
    const approveLog = incLogs.find((l) => l.action === 'APPROVE_INCIDENT_COMPENSATION');
    const rejectLog = incLogs.find((l) => l.action === 'REJECT_INCIDENT_COMPENSATION');
    const sendEmailLog = incLogs.find((l) => l.action === 'SEND_INCIDENT_DECISION_EMAIL');

    const rawStatusUpper = String(incident.status || '').toUpperCase();
    const claimStatusUpper = String(claim?.status || '').toUpperCase();

    const isRejected =
      claimStatusUpper === 'REJECTED' ||
      claimStatusUpper === 'CLOSED_REJECTED' ||
      Boolean(incident.rejection_reason) ||
      Boolean(rejectLog) ||
      rawStatusUpper === 'REJECTED' ||
      Boolean(incident.resolution_note && incident.resolution_note.includes('Từ chối bồi thường'));
    const rejectionReason = isRejected
      ? (incident.rejection_reason || rejectLog?.reason || claim?.review_comment || incident.resolution_note || null)
      : null;

    const logPaymentProof = closeLog?.changes?.payment_proof_url || null;

    const txSourceText = `${closeLog?.changes?.close_note || ''} ${claim?.review_comment || ''} ${incident.resolution_note || ''}`;
    const txMatch = txSourceText.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
    const transactionCode = claim?.transaction_code || closeLog?.changes?.transaction_code || (txMatch ? txMatch[1] : null);

    const isPaid = !isRejected && (claimStatusUpper === 'PAID' || rawStatusUpper === 'PAID');
    const isDone =
      claimStatusUpper === 'CLOSED_COMPENSATED' ||
      claimStatusUpper === 'CLOSED_REJECTED' ||
      (['DONE', 'RESOLVED', 'CLOSED'].includes(rawStatusUpper) &&
        claimStatusUpper !== 'APPROVED' &&
        claimStatusUpper !== 'PAID' &&
        claimStatusUpper !== 'PENDING') ||
      (isRejected && !claim);
    const isApproved =
      !isDone &&
      !isPaid &&
      !isRejected &&
      (rawStatusUpper === 'APPROVED' || claimStatusUpper === 'APPROVED' || Boolean(approveLog));

    const rawPaymentProofUrl = (isPaid || isDone) && !isRejected
      ? (claim?.payment_proof_url || incident.payment_proof_url || logPaymentProof || null)
      : null;

    const closedAt = isDone
      ? (claim?.closed_at || incident.closed_at || closeLog?.created_time || claim?.updated_at || incident.resolved_time || incident.updated_at)
      : null;

    const noteAmountMatch = typeof incident.resolution_note === 'string'
      ? incident.resolution_note.match(/([\d.,]+)\s*(?:VNĐ|đ)/i)
      : null;
    const parsedNoteAmount = noteAmountMatch ? Number(noteAmountMatch[1].replace(/[.,]/g, '')) : 0;

    const proposedAmount = Number(
      incident.proposed_compensation_amount ||
      claim?.amount ||
      0
    );

    const approvedAmount = Number(
      claim?.approved_amount ||
      incident.approved_compensation_amount ||
      closeLog?.changes?.approved_amount ||
      approveLog?.changes?.approved_compensation_amount ||
      ((claimStatusUpper === 'APPROVED' || claimStatusUpper === 'PAID' || claimStatusUpper === 'CLOSED_COMPENSATED' || (isDone && !isRejected)) ? claim?.amount : 0) ||
      (isDone && !isRejected && parsedNoteAmount >= 1000 ? parsedNoteAmount : 0) ||
      0
    );

    const dateMatch = txSourceText.match(/ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
    const paymentDate = claim?.payment_date
      ? new Date(claim.payment_date).toISOString().split('T')[0]
      : (closeLog?.changes?.payment_date || (dateMatch ? dateMatch[1] : null));

    const paymentProofUrl = rawPaymentProofUrl || null;

    const paymentNote =
      claim?.payment_note ||
      closeLog?.changes?.close_note ||
      claim?.review_comment ||
      null;

    const normalizedStatus = isRejected
      ? ((claimStatusUpper === 'CLOSED_REJECTED' || ['DONE', 'CLOSED'].includes(rawStatusUpper)) ? 'CLOSED_REJECTED' : 'REJECTED')
      : isDone
        ? 'DONE'
        : isPaid
          ? 'PAID'
          : isApproved
            ? 'APPROVED'
            : claimStatusUpper === 'PENDING'
              ? 'ESCALATED'
              : incident.status;

    const emailLogRef = sendEmailLog || (rejectLog?.changes?.email_sent ? rejectLog : null) || (approveLog?.changes?.email_sent ? approveLog : null);

    const enriched = {
      ...incident,
      status: normalizedStatus,
      raw_status: incident.status,
      code: `INC-${String(incident.id).padStart(3, '0')}`,
      type_display: INCIDENT_TYPE_MAP[incident.type] || incident.type || 'Khác',
      truck_plate: truckPlate,
      driver_name: driverName,
      driver_phone: driverPhone,
      cargo_affected: incident.cargo_affected !== undefined ? incident.cargo_affected : null,
      order: orderInfo,
      contract: contractInfo || null,
      // Bằng chứng 4 cụm ảnh đối chiếu (chỉ dữ liệu thật, rỗng nếu chưa có)
      pickup_photos: pickupPhotos,
      seal_photos: sealPhotos,
      incident_photos: incidentPhotos,
      delivery_photos: deliveryPhotos,
      seal_number: sealNumber,
      receiver_name: receiverName,
      // Metadata GPS hiện trường & Kiểm tra lộ trình
      incident_lat: incident.incident_lat != null ? Number(incident.incident_lat) : null,
      incident_lng: incident.incident_lng != null ? Number(incident.incident_lng) : null,
      incident_location: derivedLocation,
      is_on_route: incident.is_on_route !== false,
      route_deviation_km: incident.route_deviation_km ? Number(incident.route_deviation_km) : 0,
      gps_timestamp: incident.reported_time || incident.created_at,
      trip_events_timeline: tripEventsTimeline,
      // Dữ liệu bồi thường & giao dịch chi trả chuẩn hóa
      damage_percentage: incident.damage_percentage ?? approveLog?.changes?.damage_percentage ?? claim?.damage_percentage ?? null,
      goods_handling_method: incident.goods_handling_method || approveLog?.changes?.goods_handling_method || claim?.outcome || null,
      contract_clause_ref: incident.contract_clause_ref || approveLog?.changes?.contract_clause_ref || rejectLog?.changes?.contract_clause_ref || claim?.contract_clause_ref || null,
      survey_org_report: claim?.assessment_result || null,
      proposed_compensation_amount: proposedAmount,
      approved_compensation_amount: approvedAmount,
      rejection_reason: rejectionReason,
      contact_hotline: incident.contact_hotline || claim?.contact_hotline || '1900 1234',
      payment_proof_url: paymentProofUrl,
      transaction_code: transactionCode,
      payment_date: paymentDate,
      payment_note: paymentNote,
      claim_id: claim?.id || null,
      claim_code: claim?.id ? `CLM-${String(claim.id).padStart(4, '0')}` : null,
      claim_amount: claim ? Number(claim.amount || 0) : 0,
      claim_status: claim?.status || null,
      called_at: claim?.called_at || null,
      paid_at: claim?.paid_at || null,
      email_sent: Boolean(emailLogRef?.changes?.email_sent),
      customer_email:
        emailLogRef?.changes?.customer_email ||
        orderInfo?.customer?.email ||
        orderInfo?.order_contract?.contract_details?.customer_email ||
        null,
      email_sent_at: emailLogRef?.changes?.email_sent_at || null,
      email_type: emailLogRef?.changes?.email_type || (rejectLog ? 'REJECTION' : approveLog ? 'APPROVAL' : null),
      closed_by: incident.closed_by || incident.resolved_by || null,
      closed_at: closedAt
    };

    return res.json({ incident: enriched });
  } catch (error) {
    console.error('getIncidentById Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy chi tiết sự cố', error: error.message });
  }
};

module.exports = {
  getAllIncidents,
  createIncident,
  updateIncidentStatus,
  getIncidents,
  getIncidentById
};
