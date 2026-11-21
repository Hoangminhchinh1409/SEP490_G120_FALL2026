const supabase = require('../config/supabase');
const incidentService = require('../services/incidentService');
const { parseOrderMeta } = require('../services/orderHelperService');
const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail
} = require('../services/emailService');

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

    const CORE_COLUMNS = `
        id,
        trip_id,
        trip_stop_id,
        type,
        description,
        photos,
        fault,
        status,
        reported_by,
        reported_time,
        escalated_by,
        escalated_time,
        escalation_reason,
        resolution_note,
        resolved_by,
        resolved_time,
        created_at`;
    const EXTENDED_COLUMNS = `,
        damage_percentage,
        goods_handling_method,
        contract_clause_ref,
        proposed_compensation_amount,
        approved_compensation_amount,
        rejection_reason,
        contact_hotline,
        payment_proof_url,
        incident_lat,
        incident_lng,
        is_on_route,
        route_deviation_km`;
    const RELATIONS = `,
        trip:trips(
          id, 
          trip_code, 
          status,
          trip_trucks(truck:trucks(plate_number)),
          trip_drivers(driver:driver_profiles(user:users(full_name, phone)))
        ),
        driver:driver_profiles!incidents_reported_by_fkey(
          id,
          user:users(id, full_name, phone)
        ),
        compensation_claims(id, amount, status, reason, source)`;

    const buildQuery = (withExtended) => {
      let query = supabase
        .from('incidents')
        .select(CORE_COLUMNS + (withExtended ? EXTENDED_COLUMNS : '') + RELATIONS)
        .order('id', { ascending: false });
      return applyFilters(query);
    };

    const applyFilters = (query) => {
    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      if (s === 'ESCALATED') {
        query = query.in('status', ['ESCALATED', 'Escalated']);
      } else if (s === 'APPROVED') {
        query = query.in('status', ['APPROVED', 'Approved']);
      } else if (s === 'RESOLVED') {
        query = query.in('status', ['RESOLVED', 'Resolved', 'DONE', 'Done', 'CLOSED', 'Closed', 'REJECTED', 'Rejected']);
      } else if (s === 'REPORTED') {
        query = query.in('status', ['REPORTED', 'Reported']);
      } else {
        query = query.eq('status', status);
      }
    }

    if (type && type !== 'ALL') {
      // Hỗ trợ map nhóm sự cố mở rộng
      const t = type.toUpperCase();
      if (t === 'DAMAGED_LOST_CARGO' || t === 'DAMAGED_CARGO') {
        query = query.in('type', ['DAMAGED_LOST_CARGO', 'DAMAGED_CARGO', 'CARGO_DAMAGED', 'Cargo Damaged', 'Cargo Lost']);
      } else if (t === 'TRAFFIC_ACCIDENT') {
        query = query.in('type', ['TRAFFIC_ACCIDENT', 'ACCIDENT', 'Accident']);
      } else if (t === 'CARGO_HELD') {
        query = query.in('type', ['CARGO_HELD', 'SEIZED_BY_AUTHORITY', 'HELD_BY_AUTHORITIES']);
      } else if (t === 'ENGINE_BREAKDOWN' || t === 'BREAKDOWN') {
        query = query.in('type', ['ENGINE_BREAKDOWN', 'BREAKDOWN', 'Vehicle Issue', 'Breakdown']);
      } else if (t === 'ROAD_BAN') {
        query = query.in('type', ['ROAD_BAN', 'Traffic', 'Road Ban']);
      } else if (t === 'OTHER') {
        query = query.in('type', ['OTHER', 'Other']);
      } else {
        query = query.eq('type', type);
      }
    }
    return query;
    };

    // Thử truy vấn đầy đủ cột mở rộng; nếu DB chưa có cột (chưa migrate) thì fallback về cột cơ bản
    let { data: incidents, error } = await buildQuery(true);
    if (error) {
      console.warn('getIncidents extended select failed, fallback to core columns:', error.message);
      ({ data: incidents, error } = await buildQuery(false));
    }
    if (error) throw error;

    const tripIds = (incidents || []).map((i) => i.trip_id).filter(Boolean);
    const incidentIds = (incidents || []).map((i) => Number(i.id)).filter(Boolean);
    let orderMapByTrip = {};
    if (tripIds.length > 0) {
      const { data: tripStops } = await supabase
        .from('trip_stops')
        .select('trip_id, order:orders(id, order_code)')
        .in('trip_id', tripIds);
      (tripStops || []).forEach((ts) => {
        if (ts.trip_id && ts.order?.order_code) {
          orderMapByTrip[ts.trip_id] = ts.order.order_code;
        }
      });
    }

    // Lấy activity_logs liên quan để khôi phục thông tin duyệt/chi tiền nếu DB thiếu cột mở rộng
    const logsByIncidentId = {};
    if (incidentIds.length > 0) {
      try {
        const { data: logs } = await supabase
          .from('activity_logs')
          .select('target_id, action, changes, reason, created_time')
          .eq('target_type', 'INCIDENT')
          .in('target_id', incidentIds)
          .order('id', { ascending: false });
        (logs || []).forEach((lg) => {
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
    const { data: incident, error } = await supabase
      .from('incidents')
      .select(`
        *,
        trip:trips(
          *,
          trip_trucks(truck:trucks(id, plate_number)),
          trip_drivers(driver:driver_profiles(id, user:users(id, full_name, phone)))
        ),
        driver:driver_profiles!incidents_reported_by_fkey(
          id,
          user:users(id, full_name, phone)
        ),
        compensation_claims(*)
      `)
      .eq('id', id)
      .single();

    if (error || !incident) {
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
      const { data: stops } = await supabase
        .from('trip_stops')
        .select(`
          order:orders(
            id, 
            order_code, 
            order_type, 
            status,
            agreed_price, 
            contract_id,
            signed_order_contract_file,
            receiver_name,
            receiver_phone,
            pickup_location:locations!orders_pickup_location_id_fkey(id, name, address),
            delivery_location:locations!orders_delivery_location_id_fkey(id, name, address),
            order_notes(*),
            customer:customers(id, company_name, contact_person, phone, email, tax_code),
            order_cargos(cargo_name, quantity, unit, actual_weight_kg, declared_value)
          )
        `)
        .eq('trip_id', incident.trip_id)
        .limit(1);

      if (stops && stops.length > 0 && stops[0].order) {
        orderInfo = stops[0].order;
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
      const { data: contract } = await supabase
        .from('transport_contracts')
        .select('id, contract_number, liability_cap, attachment_link, compensation_terms, terms_and_responsibilities')
        .eq('id', orderInfo.contract_id)
        .maybeSingle();
      if (contract) {
        contractInfo = contract;
      }
    }

    // Lấy bằng chứng ảnh lúc nhận hàng (Pickup), ảnh niêm chì (Seal) và lúc giao hàng (Delivery)
    if (orderInfo?.id) {
      const { data: evidences } = await supabase
        .from('delivery_evidences')
        .select('id, type, file_link, seal_number, receiver_name, captured_time')
        .eq('order_id', orderInfo.id);

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
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('action, changes, reason, created_time')
        .eq('target_type', 'INCIDENT')
        .eq('target_id', Number(id))
        .order('id', { ascending: false })
        .limit(10);
      incLogs = logs || [];
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

    const { data: updatedInc, error: incErr } = await supabase
      .from('incidents')
      .update({
        fault: fault,
        resolution_note: resolution_note || 'Quản lý đã thẩm định và giải quyết sự cố.',
        status: 'RESOLVED',
        resolved_by: managerId,
        resolved_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (incErr) throw incErr;

    //: Nếu số tiền bồi thường > 0, tự động sinh Yêu cầu bồi thường (Compensation Claim) ở trạng thái PENDING
    let createdClaim = null;
    if (amountNum > 0) {
      const { data: existingClaim } = await supabase
        .from('compensation_claims')
        .select('id')
        .eq('incident_id', id)
        .maybeSingle();

      if (!existingClaim) {
        let orderId = null;
        if (updatedInc.trip_id) {
          const { data: tripStops } = await supabase
            .from('trip_stops')
            .select('id')
            .eq('trip_id', updatedInc.trip_id)
            .limit(1);

          if (tripStops && tripStops.length > 0) {
            const { data: stopOrder } = await supabase
              .from('delivery_evidences')
              .select('order_id')
              .eq('trip_stop_id', tripStops[0].id)
              .maybeSingle();
            orderId = stopOrder?.order_id || null;
          }
        }

        if (!orderId) {
          const { data: anyOrder } = await supabase.from('orders').select('id').limit(1).maybeSingle();
          orderId = anyOrder?.id || 37;
        }

        const { data: newClaim, error: claimErr } = await supabase
          .from('compensation_claims')
          .insert({
            incident_id: id,
            order_id: orderId,
            source: 'INCIDENT',
            amount: amountNum,
            reason: `Bồi thường phát sinh từ sự cố INC-${String(id).padStart(3, '0')}: ${resolution_note || updatedInc.description || 'Lỗi vận hành'}`,
            status: 'PENDING',
            created_by: managerId || 20
          })
          .select()
          .single();

        if (claimErr) {
          console.error('Tự động tạo compensation_claim thất bại:', claimErr);
        } else {
          createdClaim = newClaim;
        }
      }
    }

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: 'RESOLVE_INCIDENT',
        target_type: 'INCIDENT',
        target_id: String(id),
        changes: { fault, compensation_amount: amountNum, status: 'RESOLVED' },
        reason: resolution_note,
        created_time: new Date().toISOString()
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

    const now = new Date().toISOString();
    const resolutionNoteFull = resolution_note || (
      isApprove
        ? `Quản lý đã phê duyệt bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ theo ${contract_clause_ref || 'Hợp đồng vận tải'}. (Hư hỏng: ${damage_percentage || 0}%, xử lý: ${goods_handling_method || 'Khách giữ'})`
        : isRequestMoreInfo
        ? 'Quản lý yêu cầu bổ sung thêm hồ sơ / biên bản giám định hiện trường.'
        : `Từ chối bồi thường theo ${contract_clause_ref || 'Hợp đồng'}. Lý do: ${rejection_reason}`
    );

    const updatePayload = {
      fault: fault || (isApprove ? 'COMPANY' : 'CUSTOMER'),
      resolution_note: resolutionNoteFull,
      status: targetStatus,
      resolved_by: managerId,
      resolved_time: now,
      updated_at: now,
      ...(damage_percentage !== undefined && damage_percentage !== null ? { damage_percentage: Number(damage_percentage) } : {}),
      ...(goods_handling_method ? { goods_handling_method } : {}),
      ...(contract_clause_ref ? { contract_clause_ref } : {}),
      approved_compensation_amount: isApprove ? (Number(approved_amount) || 0) : 0,
      rejection_reason: (!isApprove && !isRequestMoreInfo) ? rejection_reason.trim() : null,
      contact_hotline: contact_hotline || '1900 1234'
    };

    let { data: updatedInc, error: incErr } = await supabase
      .from('incidents')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (incErr) {
      console.warn('Cập nhật incidents (extended) warning:', incErr.message);
      // Fallback nếu DB chưa có một số cột mở rộng hoặc có check constraint trên status
      const corePayload = {
        fault: updatePayload.fault,
        resolution_note: String(updatePayload.resolution_note || '').slice(0, 500),
        status: updatePayload.status,
        resolved_by: updatePayload.resolved_by,
        resolved_time: updatePayload.resolved_time,
        updated_at: updatePayload.updated_at
      };
      let retry = await supabase
        .from('incidents')
        .update(corePayload)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (retry.error) {
        console.warn('Fallback corePayload status retry with compatible status:', retry.error.message);
        retry = await supabase
          .from('incidents')
          .update({
            ...corePayload,
            status: isApprove ? 'ESCALATED' : isRequestMoreInfo ? 'ESCALATED' : 'RESOLVED'
          })
          .eq('id', id)
          .select()
          .maybeSingle();
      }
      updatedInc = retry.data;
    }

    // Đồng bộ hoặc tạo mới bản ghi trong bảng compensation_claims
    const claimStatus = isApprove ? 'APPROVED' : isRequestMoreInfo ? 'PENDING' : 'REJECTED';
    const { data: existingClaims } = await supabase
      .from('compensation_claims')
      .select('id')
      .eq('incident_id', id);

    if (existingClaims && existingClaims.length > 0) {
      const { error: claimUpdErr } = await supabase
        .from('compensation_claims')
        .update({
          status: claimStatus,
          amount: isApprove ? (Number(approved_amount) || 0) : 0,
          reviewed_by: managerId,
          reviewed_time: now,
          review_comment: resolutionNoteFull,
          updated_at: now
        })
        .eq('incident_id', id);
      if (claimUpdErr) console.warn('compensation_claims update warning:', claimUpdErr.message);
    } else {
      // Tìm order_id thực tế của chuyến xe
      let tripIdToLookup = updatedInc?.trip_id;
      if (!tripIdToLookup) {
        const { data: curInc } = await supabase
          .from('incidents')
          .select('trip_id')
          .eq('id', id)
          .maybeSingle();
        tripIdToLookup = curInc?.trip_id || null;
      }

      let orderId = null;
      if (tripIdToLookup) {
        const { data: stops } = await supabase
          .from('trip_stops')
          .select('order_id')
          .eq('trip_id', tripIdToLookup)
          .not('order_id', 'is', null)
          .limit(1);
        if (stops?.[0]?.order_id) orderId = stops[0].order_id;
      }
      if (!orderId) {
        const { data: anyOrder } = await supabase.from('orders').select('id').limit(1).maybeSingle();
        orderId = anyOrder?.id || null;
      }

      if (orderId) {
        const { error: claimInsErr } = await supabase
          .from('compensation_claims')
          .insert({
            incident_id: Number(id),
            order_id: orderId,
            source: 'INCIDENT',
            amount: isApprove ? (Number(approved_amount) || 0) : 0,
            reason: resolutionNoteFull,
            status: claimStatus,
            created_by: managerId,
            reviewed_by: managerId,
            reviewed_time: now,
            review_comment: resolutionNoteFull
          });
        if (claimInsErr) console.warn('compensation_claims insert warning:', claimInsErr.message);
      }
    }

    // Gửi Email thông báo kết quả Duyệt / Từ chối bồi thường tới Khách hàng
    let emailResult = { sent: false, customer_email: null, email_type: null, email_sent_at: null };
    if (isApprove || !isRequestMoreInfo) {
      try {
        let tripIdForEmail = updatedInc?.trip_id || null;
        let incMeta = updatedInc || null;
        if (!incMeta) {
          const { data: curInc } = await supabase
            .from('incidents')
            .select('id, trip_id, type, reported_by')
            .eq('id', id)
            .maybeSingle();
          incMeta = curInc;
          tripIdForEmail = curInc?.trip_id || null;
        }

        let orderForEmail = null;
        let tripCodeForEmail = tripIdForEmail ? `TRIP-${tripIdForEmail}` : '';
        if (tripIdForEmail) {
          const [{ data: tripRow }, { data: stops }] = await Promise.all([
            supabase.from('trips').select('id, trip_code').eq('id', tripIdForEmail).maybeSingle(),
            supabase
              .from('trip_stops')
              .select(`
                order:orders(
                  id,
                  order_code,
                  agreed_price,
                  tracking_token,
                  receiver_name,
                  order_notes(*),
                  customer:customers(company_name, contact_person, email, phone),
                  order_cargos(cargo_name, quantity, unit, actual_weight_kg, declared_value)
                )
              `)
              .eq('trip_id', tripIdForEmail)
              .not('order_id', 'is', null)
              .limit(1)
          ]);
          if (tripRow?.trip_code) tripCodeForEmail = tripRow.trip_code;
          orderForEmail = stops?.[0]?.order || null;
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
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: isApprove ? 'APPROVE_INCIDENT_COMPENSATION' : isRequestMoreInfo ? 'REQUEST_MORE_INFO_INCIDENT' : 'REJECT_INCIDENT_COMPENSATION',
        target_type: 'INCIDENT',
        target_id: Number(id),
        changes: {
          ...updatePayload,
          email_sent: emailResult.sent,
          customer_email: emailResult.customer_email,
          email_type: emailResult.email_type,
          email_sent_at: emailResult.email_sent_at
        },
        reason: String(isApprove ? resolution_note : isRequestMoreInfo ? resolution_note : rejection_reason || '').slice(0, 255),
        created_time: now
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
      const { data: dispatchers } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', 3);
      (dispatchers || []).forEach((u) => {
        if (u?.id) recipientIds.add(Number(u.id));
      });

      if (updatedInc?.reported_by) {
        const { data: driverProfile } = await supabase
          .from('driver_profiles')
          .select('user_account_id')
          .eq('id', updatedInc.reported_by)
          .maybeSingle();
        if (driverProfile?.user_account_id) {
          recipientIds.add(Number(driverProfile.user_account_id));
        }
      }

      if (recipientIds.size > 0) {
        const notifRows = Array.from(recipientIds).map((uid) => ({
          user_account_id: uid,
          target_type: 'INCIDENT',
          target_id: Number(id),
          message: notifyMsg,
          created_time: now
        }));
        await supabase.from('notifications').insert(notifRows);
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
      incident: updatedInc || { id, ...updatePayload },
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

    const now = new Date().toISOString();
    const proofStr = payment_proof_url.trim();
    const noteInput = String(close_note || '').trim();
    const txMatch = noteInput.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
    const dateMatch = noteInput.match(/ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);

    const payDate = payment_date || (dateMatch ? dateMatch[1] : now.split('T')[0]);
    const txCode = String(transaction_code || (txMatch ? txMatch[1] : '') || `FT${payDate.replace(/[^0-9]/g, '').slice(2, 8)}${String(id).padStart(4, '0')}`).trim();
    const closeNoteFull = noteInput || `Đã hoàn tất chi tiền ngày ${payDate}. Mã GD: ${txCode}`;

    // Đọc thông tin sự cố hiện có để bảo toàn nhận xét phê duyệt & trip_id
    const { data: existingInc } = await supabase
      .from('incidents')
      .select('id, trip_id, resolution_note')
      .eq('id', id)
      .maybeSingle();

    const { data: existingClaims } = await supabase
      .from('compensation_claims')
      .select('id, amount')
      .eq('incident_id', id);

    const resolvedPaidAmount = Number(
      approved_amount ||
      existingClaims?.[0]?.amount ||
      0
    );

    const prevNote = existingInc?.resolution_note ? `${existingInc.resolution_note} | ` : '';
    const mergedNote = `${prevNote}[ĐÃ CHI TIỀN - Ngày: ${payDate} | Mã GD: ${txCode}]`.slice(0, 500);

    const updatePayload = {
      status: 'DONE',
      resolution_note: mergedNote,
      resolved_by: managerId,
      resolved_time: now,
      updated_at: now,
      ...(proofStr.length <= 500 ? { payment_proof_url: proofStr } : {})
    };

    let { data: updatedInc, error: incErr } = await supabase
      .from('incidents')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (incErr) {
      console.warn('Cập nhật close incident qua supabase warning:', incErr.message);
      const { payment_proof_url: _omit, ...coreClosePayload } = updatePayload;
      let retry = await supabase
        .from('incidents')
        .update(coreClosePayload)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (retry.error) {
        console.warn('Close incident status DONE failed, retry with RESOLVED:', retry.error.message);
        retry = await supabase
          .from('incidents')
          .update({
            ...coreClosePayload,
            status: 'RESOLVED'
          })
          .eq('id', id)
          .select()
          .maybeSingle();
      }
      updatedInc = retry.data;
    }

    // Cập nhật hoặc tạo mới bản ghi compensation_claims để lưu chứng từ UNC & ghi chú giao dịch
    if (existingClaims && existingClaims.length > 0) {
      const claimPayload = {
        status: 'PAID',
        evidence: proofStr,
        review_comment: closeNoteFull,
        reviewed_by: managerId,
        reviewed_time: now,
        updated_at: now,
        ...(resolvedPaidAmount > 0 ? { amount: resolvedPaidAmount } : {})
      };
      const { error: paidErr } = await supabase
        .from('compensation_claims')
        .update(claimPayload)
        .eq('incident_id', id);

      if (paidErr) {
        console.warn('compensation_claims status PAID rejected by constraint, retry with APPROVED:', paidErr.message);
        await supabase
          .from('compensation_claims')
          .update({
            ...claimPayload,
            status: 'APPROVED'
          })
          .eq('incident_id', id);
      }
    } else {
      let orderId = null;
      const tripIdToLookup = updatedInc?.trip_id || existingInc?.trip_id;
      if (tripIdToLookup) {
        const { data: stops } = await supabase
          .from('trip_stops')
          .select('order_id')
          .eq('trip_id', tripIdToLookup)
          .not('order_id', 'is', null)
          .limit(1);
        if (stops?.[0]?.order_id) orderId = stops[0].order_id;
      }
      if (!orderId) {
        const { data: anyOrder } = await supabase.from('orders').select('id').limit(1).maybeSingle();
        orderId = anyOrder?.id || null;
      }

      if (orderId) {
        await supabase
          .from('compensation_claims')
          .insert({
            incident_id: Number(id),
            order_id: orderId,
            source: 'INCIDENT',
            amount: resolvedPaidAmount,
            reason: closeNoteFull,
            evidence: proofStr,
            status: 'APPROVED',
            created_by: managerId,
            reviewed_by: managerId,
            reviewed_time: now,
            review_comment: closeNoteFull
          });
      }
    }

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: 'CLOSE_INCIDENT_CASE_DONE',
        target_type: 'INCIDENT',
        target_id: Number(id),
        changes: {
          ...updatePayload,
          payment_date: payDate,
          transaction_code: txCode,
          payment_proof_url: proofStr,
          close_note: closeNoteFull,
          approved_amount: resolvedPaidAmount
        },
        reason: closeNoteFull.slice(0, 255),
        created_time: now
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    return res.json({
      message: 'Đã xác nhận hoàn tất bồi thường và đóng hồ sơ sự cố thành công (DONE).',
      incident: {
        ...(updatedInc || { id: Number(id), ...updatePayload }),
        payment_date: payDate,
        transaction_code: txCode,
        payment_proof_url: proofStr,
        payment_note: closeNoteFull,
        approved_compensation_amount: resolvedPaidAmount
      }
    });
  } catch (error) {
    console.error('closeIncidentCase Error:', error);
    return res.status(500).json({ message: 'Lỗi khi đóng hồ sơ sự cố', error: error.message });
  }
};

const getClaims = async (req, res) => {
  try {
    const { data: claims, error } = await supabase
      .from('compensation_claims')
      .select(`
        *,
        incident:incidents(
          id, 
          type, 
          fault, 
          description,
          photos,
          status,
          reported_time,
          trip_id,
          trip:trips(
            id,
            trip_code,
            status,
            trip_trucks(truck:trucks(plate_number)),
            trip_drivers(driver:driver_profiles(user:users(full_name, phone)))
          )
        ),
        order:orders(id, order_code, order_type, agreed_price, customer_id, receiver_name)
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    const { data: contracts } = await supabase
      .from('transport_contracts')
      .select('id, customer_id, liability_cap, status')
      .eq('status', 'ACTIVE');

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

    const { data: claim, error: findErr } = await supabase
      .from('compensation_claims')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !claim) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu bồi thường.' });
    }

    if (!isApprove && !decisionText) {
      return res.status(400).json({ message: 'Bắt buộc nhập lý do/nhận xét khi từ chối bồi thường.' });
    }

    const { data: updatedClaim, error: updateErr } = await supabase
      .from('compensation_claims')
      .update({
        status: targetStatus,
        decided_by: managerId,
        decided_at: new Date().toISOString(),
        decision_comment: decisionText || (isApprove ? 'Phê duyệt bồi thường hợp lệ.': 'Từ chối bồi thường.'),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (claim.incident_id) {
      await supabase
        .from('incidents')
        .update({
          status: isApprove ? 'RESOLVED': 'CLOSED',
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.incident_id);
    }

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: isApprove ? 'APPROVE_CLAIM': 'REJECT_CLAIM',
        target_type: 'COMPENSATION_CLAIM',
        target_id: String(id),
        changes: { status: targetStatus, amount: claim.amount },
        reason: decisionText,
        created_time: new Date().toISOString()
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

    const { data: incident, error: incErr } = await supabase
      .from('incidents')
      .select(`
        *,
        trip:trips(id, trip_code),
        compensation_claims(*)
      `)
      .eq('id', id)
      .single();

    if (incErr || !incident) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sự cố.' });
    }

    let orderForEmail = null;
    if (incident.trip_id) {
      const { data: stops } = await supabase
        .from('trip_stops')
        .select(`
          order:orders(
            id,
            order_code,
            agreed_price,
            tracking_token,
            receiver_name,
            order_notes(*),
            customer:customers(company_name, contact_person, email, phone),
            order_cargos(cargo_name, quantity, unit, actual_weight_kg, declared_value)
          )
        `)
        .eq('trip_id', incident.trip_id)
        .not('order_id', 'is', null)
        .limit(1);
      orderForEmail = stops?.[0]?.order || null;
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

    const now = new Date().toISOString();
    const resolvedType = isRejectType ? 'REJECTION' : 'APPROVAL';
    if (sendRes?.success) {
      try {
        await supabase.from('activity_logs').insert({
          actor_id: managerId,
          actor_type: 'MANAGER',
          action: isRejectType ? 'REJECT_INCIDENT_COMPENSATION' : 'APPROVE_INCIDENT_COMPENSATION',
          target_type: 'INCIDENT',
          target_id: Number(id),
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
          created_time: now
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

