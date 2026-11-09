const supabase = require('../config/supabase');
const incidentService = require('../services/incidentService');

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
    const userId = req.user?.id || 3;
    const newInc = await incidentService.createIncident(req.body, userId);
    return res.status(201).json({ message: 'Đã báo cáo sự cố thành công', incident: newInc });
  } catch (err) {
    console.error('createIncident error:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

const updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await incidentService.updateIncidentStatus(id, req.body, req.user?.id || 3);
    return res.json({ message: 'Đã cập nhật sự cố thành công', incident: updated });
  } catch (err) {
    console.error('updateIncidentStatus error:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// ==========================================
// B. MANAGER MAJOR INCIDENTS & COMPENSATION CLAIMS
// ==========================================

const getIncidents = async (req, res) => {
  try {
    const { status, type } = req.query;

    let query = supabase
      .from('incidents')
      .select(`
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
        created_at,
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
        compensation_claims(id, amount, status, reason, source)
      `)
      .order('id', { ascending: false });

    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      if (s === 'ESCALATED') {
        query = query.in('status', ['ESCALATED', 'Escalated']);
      } else if (s === 'RESOLVED') {
        query = query.in('status', ['RESOLVED', 'Resolved']);
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

    const { data: incidents, error } = await query;
    if (error) throw error;

    const tripIds = (incidents || []).map((i) => i.trip_id).filter(Boolean);
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

      const rawStatus = (i.status || '').toUpperCase();
      let normStatus = 'REPORTED';
      let statusDisplay = 'Đã báo';
      if (rawStatus === 'ESCALATED') {
        normStatus = 'ESCALATED';
        statusDisplay = 'Chờ Quản lý xử lý';
      } else if (rawStatus === 'RESOLVED' || rawStatus === 'CLOSED') {
        normStatus = 'RESOLVED';
        statusDisplay = 'Đã xử lý';
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
        claim_id: claim?.id || null,
        claim_amount: Number(claim?.amount || 0),
        claim_status: claim?.status || null,
        claim_source: claim?.source || 'INCIDENT'
      };
    });

    const pendingCount = formatted.filter((x) => x.status === 'ESCALATED' || x.status === 'REPORTED').length;
    const resolvedCount = formatted.filter((x) => x.status === 'RESOLVED').length;

    return res.json({
      incidents: formatted,
      summary: {
        total: formatted.length,
        escalated: formatted.filter((x) => x.status === 'ESCALATED').length,
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

    // Lấy thông tin đơn hàng nếu có
    let orderInfo = null;
    if (incident.trip_id) {
      const { data: stops } = await supabase
        .from('trip_stops')
        .select('order:orders(id, order_code, order_type, agreed_price, customer:customers(id, company_name))')
        .eq('trip_id', incident.trip_id)
        .limit(1);
      if (stops && stops.length > 0 && stops[0].order) {
        orderInfo = stops[0].order;
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

    const truckPlate = incident.trip?.trip_trucks?.[0]?.truck?.plate_number || '29C-246.80';
    const driverName = incident.trip?.trip_drivers?.[0]?.driver?.user?.full_name || incident.driver?.user?.full_name || 'Tài xế hiện trường';
    const driverPhone = incident.trip?.trip_drivers?.[0]?.driver?.user?.phone || incident.driver?.user?.phone || '0901234567';

    const enriched = {
      ...incident,
      code: `INC-${String(incident.id).padStart(3, '0')}`,
      type_display: typeMap[incident.type] || incident.type || 'Khác',
      truck_plate: truckPlate,
      driver_name: driverName,
      driver_phone: driverPhone,
      order: orderInfo
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

module.exports = {
  getAllIncidents,
  createIncident,
  updateIncidentStatus,
  getIncidents,
  getIncidentById,
  resolveIncident,
  getClaims,
  decideClaim,
  getApprovals: getClaims,
  decideApproval: decideClaim
};

