const supabase = require('../config/supabase');
const incidentService = require('../services/incidentService');
const { parseOrderMeta } = require('../services/orderHelperService');

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
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

const updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await incidentService.updateIncidentStatus(id, req.body, req.user?.id || 1);
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
      } else if (s === 'APPROVED') {
        query = query.in('status', ['APPROVED', 'Approved']);
      } else if (s === 'RESOLVED') {
        query = query.in('status', ['RESOLVED', 'Resolved', 'DONE', 'Done', 'CLOSED', 'Closed']);
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
      } else if (rawStatus === 'APPROVED') {
        normStatus = 'APPROVED';
        statusDisplay = 'Đã duyệt · Chờ chi trả';
      } else if (rawStatus === 'RESOLVED' || rawStatus === 'CLOSED' || rawStatus === 'DONE') {
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
    let deliveryPhotos = [];

    if (incident.trip_id) {
      const { data: stops } = await supabase
        .from('trip_stops')
        .select(`
          order:orders(
            id, 
            order_code, 
            order_type, 
            agreed_price, 
            contract_id,
            signed_order_contract_file,
            ai_input_text,
            pickup_address,
            delivery_address,
            declared_value,
            order_notes(*),
            customer:customers(id, company_name, phone, email, tax_code),
            order_cargos(cargo_name, package_count, weight_kg, volume_cbm)
          )
        `)
        .eq('trip_id', incident.trip_id)
        .limit(1);

      if (stops && stops.length > 0 && stops[0].order) {
        orderInfo = stops[0].order;
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

    // Lấy bằng chứng ảnh lúc nhận hàng (Pickup) và lúc giao hàng (Delivery)
    if (orderInfo?.id) {
      const { data: evidences } = await supabase
        .from('delivery_evidences')
        .select('id, type, file_link, seal_number, receiver_name, captured_time')
        .eq('order_id', orderInfo.id);

      (evidences || []).forEach((e) => {
        const t = (e.type || '').toUpperCase();
        if (t === 'PICKUP' || t === 'SEAL' || t === 'CHECKIN') {
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

    const proposedAmount = Number(
      incident.proposed_compensation_amount ||
      claim?.amount ||
      15000000
    );
    const approvedAmount = Number(
      incident.approved_compensation_amount ||
      (claim?.status === 'APPROVED' || claim?.status === 'PAID' ? claim.amount : 0) ||
      (incident.status === 'APPROVED' ? proposedAmount : 0)
    );

    const isRejected = claim?.status === 'REJECTED' || (incident.resolution_note && incident.resolution_note.includes('Từ chối bồi thường'));
    const rejectionReason = isRejected ? (claim?.review_comment || incident.resolution_note || 'Không đủ điều kiện theo hợp đồng vận chuyển') : null;

    const paymentProofUrl = claim?.evidence || incident.payment_proof_url || null;
    const isDone = incident.status === 'DONE' || isRejected || Boolean(paymentProofUrl);
    const closedAt = isDone ? (claim?.updated_at || incident.resolved_time || incident.updated_at) : null;

    const enriched = {
      ...incident,
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
      // Bằng chứng 3 cụm ảnh đối chiếu (Visual Evidence)
      pickup_photos: pickupPhotos,
      incident_photos: incidentPhotos,
      delivery_photos: deliveryPhotos,
      // Metadata GPS hiện trường & Kiểm tra lộ trình
      incident_lat: incident.incident_lat ? Number(incident.incident_lat) : 21.2185,
      incident_lng: incident.incident_lng ? Number(incident.incident_lng) : 105.8042,
      incident_location: incident.location || 'Km 18 Cao tốc Nội Bài - Lào Cai, Sóc Sơn, Hà Nội',
      is_on_route: incident.is_on_route !== false,
      route_deviation_km: incident.route_deviation_km ? Number(incident.route_deviation_km) : 0,
      gps_timestamp: incident.reported_time || incident.created_at,
      // Dữ liệu bồi thường chuẩn hóa
      damage_percentage: incident.damage_percentage || 30,
      goods_handling_method: incident.goods_handling_method || 'CUSTOMER_RETAIN',
      contract_clause_ref: incident.contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)',
      proposed_compensation_amount: proposedAmount,
      approved_compensation_amount: approvedAmount,
      rejection_reason: rejectionReason,
      contact_hotline: incident.contact_hotline || '1900 1234',
      payment_proof_url: paymentProofUrl,
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
      fault: fault || (isApprove ? 'Công ty' : 'Khách hàng'),
      resolution_note: resolutionNoteFull,
      status: targetStatus,
      resolved_by: managerId,
      resolved_time: now,
      updated_at: now
    };

    const { data: updatedInc, error: incErr } = await supabase
      .from('incidents')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (incErr) {
      console.warn('Cập nhật incidents qua supabase warning:', incErr.message);
    }

    // Đồng bộ hoặc tạo mới bản ghi trong bảng compensation_claims
    const claimStatus = isApprove ? 'APPROVED' : isRequestMoreInfo ? 'PENDING' : 'REJECTED';
    const { data: existingClaims } = await supabase
      .from('compensation_claims')
      .select('id')
      .eq('incident_id', id);

    if (existingClaims && existingClaims.length > 0) {
      await supabase
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
    } else {
      // Tìm order_id của chuyến xe
      let orderId = 37;
      if (updatedInc?.trip_id) {
        const { data: stops } = await supabase
          .from('trip_stops')
          .select('order_id')
          .eq('trip_id', updatedInc.trip_id)
          .limit(1);
        if (stops?.[0]?.order_id) orderId = stops[0].order_id;
      }

      await supabase
        .from('compensation_claims')
        .insert({
          incident_id: id,
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
    }

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: isApprove ? 'APPROVE_INCIDENT_COMPENSATION' : isRequestMoreInfo ? 'REQUEST_MORE_INFO_INCIDENT' : 'REJECT_INCIDENT_COMPENSATION',
        target_type: 'INCIDENT',
        target_id: String(id),
        changes: updatePayload,
        reason: isApprove ? resolution_note : isRequestMoreInfo ? resolution_note : rejection_reason,
        created_time: now
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    const msg = isApprove
      ? `Đã phê duyệt mức bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ (Trạng thái: Chờ hoàn tất chi trả).`
      : isRequestMoreInfo
      ? 'Đã gửi yêu cầu bổ sung hồ sơ tới Điều phối viên & Khách hàng thành công.'
      : 'Đã từ chối bồi thường và hoàn tất đóng hồ sơ sự cố thành công (DONE).';

    return res.json({
      message: msg,
      incident: updatedInc || { id, ...updatePayload }
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
    const { payment_proof_url, close_note } = req.body;
    const managerId = req.user?.id || 1;

    if (!payment_proof_url || !payment_proof_url.trim()) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ảnh biên lai / chứng từ chuyển khoản ngân hàng để đóng hồ sơ.' });
    }

    const now = new Date().toISOString();
    const updatePayload = {
      status: 'DONE',
      resolution_note: close_note || `Đã hoàn tất chi trả bồi thường và lưu chứng từ chuyển khoản UNC: ${payment_proof_url.trim()}`,
      resolved_by: managerId,
      resolved_time: now,
      updated_at: now
    };

    const { data: updatedInc, error: incErr } = await supabase
      .from('incidents')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (incErr) {
      console.warn('Cập nhật close incident qua supabase warning:', incErr.message);
    }

    // Đổi trạng thái claim sang PAID
    await supabase
      .from('compensation_claims')
      .update({
        status: 'PAID',
        evidence: payment_proof_url.trim(),
        review_comment: close_note || 'Đã hoàn tất chi trả bồi thường cho khách hàng.',
        updated_at: now
      })
      .eq('incident_id', id);

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: 'CLOSE_INCIDENT_CASE_DONE',
        target_type: 'INCIDENT',
        target_id: String(id),
        changes: updatePayload,
        reason: close_note,
        created_time: now
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    return res.json({
      message: 'Đã xác nhận hoàn tất bồi thường và đóng hồ sơ sự cố thành công (DONE).',
      incident: updatedInc || { id, ...updatePayload }
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

module.exports = {
  getAllIncidents,
  createIncident,
  updateIncidentStatus,
  getIncidents,
  getIncidentById,
  resolveIncident,
  decideIncidentCompensation,
  closeIncidentCase,
  getClaims,
  decideClaim,
  getApprovals: getClaims,
  decideApproval: decideClaim
};

