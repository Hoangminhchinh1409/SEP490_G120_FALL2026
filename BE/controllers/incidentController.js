const supabase = require('../config/supabase');
const incidentService = require('../services/incidentService');

/**
 * Incident Controller — Nhóm chức năng Quản lý Sự cố & Yêu cầu Bồi thường
 * (UC-14, UC-15, UC-16, UC-25, UC-26 — Screen 14, 17, 19, 20)
 */

// ==========================================
// A. DISPATCHER INCIDENT OPERATIONS (UC-14, UC-15, UC-16)
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
    const updated = await incidentService.updateIncidentStatus(id, req.body);
    return res.json({ message: 'Đã cập nhật sự cố thành công', incident: updated });
  } catch (err) {
    console.error('updateIncidentStatus error:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// ==========================================
// B. MANAGER MAJOR INCIDENTS & COMPENSATION CLAIMS (UC-25, UC-26)
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
        trip:trips(id, trip_code, status),
        driver:driver_profiles!incidents_reported_by_fkey(
          id,
          user:users(id, full_name, phone)
        ),
        compensation_claims(id, amount, status, reason, source)
      `)
      .order('id', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }
    if (type && type !== 'ALL') {
      query = query.eq('type', type);
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
      'Vehicle Issue': 'Hỏng xe',
      'Traffic': 'Cấm đường / Ùn tắc',
      'TRAFFIC_ACCIDENT': 'Tai nạn giao thông',
      'ACCIDENT': 'Tai nạn giao thông',
      'DAMAGED_CARGO': 'Hàng hư hỏng/mất',
      'CARGO_DAMAGED': 'Hàng hư hỏng/mất',
      'SEIZED_BY_AUTHORITY': 'Cơ quan chức năng giữ xe'
    };

    const formatted = (incidents || []).map((i) => {
      const claim = Array.isArray(i.compensation_claims)
        ? i.compensation_claims[0]
        : i.compensation_claims;

      const isMajor =
        ['DAMAGED_CARGO', 'TRAFFIC_ACCIDENT', 'SEIZED_BY_AUTHORITY', 'Vehicle Issue', 'Traffic'].includes(i.type) ||
        i.status === 'ESCALATED';

      const orderCode = orderMapByTrip[i.trip_id] || 'Chưa gắn đơn';

      return {
        id: i.id,
        code: `INC-${String(i.id).padStart(3, '0')}`,
        trip_id: i.trip_id,
        trip_code: i.trip?.trip_code || `TRIP-${i.trip_id}`,
        order_code: orderCode,
        type: i.type,
        type_display: typeMap[i.type] || i.type || 'Khác',
        is_major: isMajor,
        description: i.description,
        photos: i.photos || [],
        fault: i.fault,
        status: i.status === 'Reported' ? 'Chờ xử lý' : i.status === 'Resolved' ? 'Đã xử lý' : i.status,
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

    return res.json({
      incidents: formatted,
      summary: {
        total: formatted.length,
        pending: formatted.filter((x) => ['REPORTED', 'ESCALATED', 'Chờ xử lý', 'Reported'].includes(x.status)).length,
        resolved: formatted.filter((x) => ['RESOLVED', 'Đã xử lý', 'Resolved'].includes(x.status)).length
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
        trip:trips(*),
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

    return res.json({ incident });
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

    // BR-17: Nếu số tiền bồi thường > 0, tự động sinh Yêu cầu bồi thường (Compensation Claim) ở trạng thái PENDING
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

        const { data: newClaim, error: claimErr } = await supabase
          .from('compensation_claims')
          .insert({
            incident_id: id,
            order_id: orderId,
            source: 'INCIDENT',
            amount: amountNum,
            reason: `Bồi thường phát sinh từ sự cố INC-${String(id).padStart(3, '0')}: ${resolution_note || updatedInc.description || 'Lỗi vận hành'}`,
            status: 'PENDING',
            created_by: managerId,
            created_at: new Date().toISOString()
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
      message: 'Đã giải quyết sự cố thành công (UC-25).',
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
        incident:incidents(id, type, fault, description),
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

    const formattedClaims = (claims || []).map((c) => {
      const order = c.order;
      const customerId = order?.customer_id;
      const contractCap = customerId && contractMap[customerId] ? contractMap[customerId] : 0;
      const declaredValue = Number(order?.agreed_price || 0) * 10;

      // BR-37: Giới hạn trách nhiệm = min(Contract Cap, Declared Value) hoặc 500M VNĐ
      let liabilityLimit = 500000000;
      if (contractCap > 0 && declaredValue > 0) {
        liabilityLimit = Math.min(contractCap, declaredValue);
      } else if (contractCap > 0) {
        liabilityLimit = contractCap;
      } else if (declaredValue > 0) {
        liabilityLimit = declaredValue;
      }

      const isExceedingCap = Number(c.amount || 0) > liabilityLimit;

      const sourceDisplay =
        c.source === 'CUSTOMER_CLAIM'
          ? 'Khách hàng tự khiếu nại (Tracking Portal)'
          : c.incident_id
          ? `Sự cố INC-${String(c.incident_id).padStart(3, '0')}`
          : 'Sự cố vận chuyển';

      return {
        id: c.id,
        claim_code: `CLM-${String(c.id).padStart(4, '0')}`,
        order_id: c.order_id,
        order_code: order?.order_code || 'N/A',
        order_type: order?.order_type || 'Export',
        incident_id: c.incident_id,
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
    const targetStatus = isApprove ? 'APPROVED' : 'REJECTED';

    const { data: claim, error: findErr } = await supabase
      .from('compensation_claims')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !claim) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu bồi thường.' });
    }

    if (!isApprove && !decisionText) {
      return res.status(400).json({ message: 'Bắt buộc nhập lý do/nhận xét khi từ chối bồi thường (MSG02).' });
    }

    const { data: updatedClaim, error: updateErr } = await supabase
      .from('compensation_claims')
      .update({
        status: targetStatus,
        decided_by: managerId,
        decided_at: new Date().toISOString(),
        decision_comment: decisionText || (isApprove ? 'Phê duyệt bồi thường hợp lệ.' : 'Từ chối bồi thường.'),
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
          status: isApprove ? 'RESOLVED' : 'CLOSED',
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.incident_id);
    }

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: isApprove ? 'APPROVE_CLAIM' : 'REJECT_CLAIM',
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
      ? `Đã phê duyệt yêu cầu bồi thường ${claim.amount?.toLocaleString('vi-VN')} đ (MSG27).`
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

