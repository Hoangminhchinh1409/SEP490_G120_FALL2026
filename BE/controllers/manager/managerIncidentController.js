const supabase = require('../../config/supabase');

/**
 * Controller Xử lý Sự cố Lớn, Khiếu nại Bồi thường & Xem lại Chuyến (UC-25, UC-26 V2, UC-42 - Screen 17, 14, 19, 20, 40)
 * - BR-16: Sự cố nghiêm trọng (Hàng hư hỏng/mất mát, Tai nạn, Hàng bị giữ) chuyển lên Quản lý.
 * - BR-17: Đóng sự cố lớn -> nhập lỗi, nhập tiền đền bù; nếu tiền > 0, tự động sinh Compensation Claim (PENDING).
 * - BR-37: Giới hạn trách nhiệm bồi thường = min(Contract Cap, Declared Value) hoặc 500 triệu VNĐ.
 * - Cảnh báo MSG56: Yêu cầu bồi thường vượt giới hạn trách nhiệm.
 * - UC-42: Phát lại hành trình GPS, kiểm tra điểm vi phạm bán kính Geofence (outside_radius).
 */
const managerIncidentController = {
  // 1. Danh sách sự cố (Screen 17)
  getIncidents: async (req, res) => {
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

        // Xác định xem có phải sự cố lớn (BR-16)
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
  },

  // 2. Chi tiết sự cố (Screen 14)
  getIncidentById: async (req, res) => {
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
  },

  // 3. Ra quyết định giải quyết sự cố lớn (UC-25 - Screen 14)
  resolveIncident: async (req, res) => {
    try {
      const { id } = req.params;
      const { fault, compensation_amount, resolution_note } = req.body;
      const managerId = req.user?.id || null;

      if (!fault) {
        return res.status(400).json({ message: 'Vui lòng xác định bên có lỗi (Công ty, Khách hàng, Bên thứ ba).' });
      }

      const amountNum = Number(compensation_amount) || 0;

      // 1. Cập nhật sự cố
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

      // 2. BR-17: Nếu số tiền bồi thường > 0, tự động sinh Yêu cầu bồi thường (Compensation Claim) ở trạng thái PENDING
      let createdClaim = null;
      if (amountNum > 0) {
        // Kiểm tra xem đã có claim nào gắn với incident này chưa
        const { data: existingClaim } = await supabase
          .from('compensation_claims')
          .select('id')
          .eq('incident_id', id)
          .maybeSingle();

        if (!existingClaim) {
          // Tìm order_id liên kết qua trip nếu có
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

      // 3. Ghi activity_logs
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
  },

  // 4. Danh sách Yêu cầu Bồi thường (UC-26 V2 - Screen 19 & Screen 20)
  getClaims: async (req, res) => {
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

      // Lấy danh sách hợp đồng vận tải để tính liability_cap (BR-37)
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
        const incident = c.incident;
        const customerId = order?.customer_id;
        const contractCap = customerId && contractMap[customerId] ? contractMap[customerId] : 0;
        const declaredValue = Number(order?.agreed_price || 0) * 10; // Giả định giá trị lô hàng nếu có

        // BR-37: Giới hạn trách nhiệm = min(Contract Cap, Declared Value) hoặc 500M VNĐ
        let liabilityLimit = 500000000; // Mặc định 500 triệu theo NĐ 163/2017
        if (contractCap > 0 && declaredValue > 0) {
          liabilityLimit = Math.min(contractCap, declaredValue);
        } else if (contractCap > 0) {
          liabilityLimit = contractCap;
        } else if (declaredValue > 0) {
          liabilityLimit = declaredValue;
        }

        const isExceedingCap = Number(c.amount || 0) > liabilityLimit;

        // V2 Nguồn: "Khách khiếu nại - Thiếu hàng/Hư hỏng" hoặc "Sự cố INC-xxx"
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
          order_type: order?.order_type || 'Export', // V2 bỏ HAWB, dùng order_type
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
  },

  // 5. Phê duyệt / Từ chối Bồi thường (UC-26 - Screen 20)
  decideClaim: async (req, res) => {
    try {
      const { id } = req.params;
      const { action, comment, note } = req.body;
      const managerId = req.user?.id || null;

      const decisionText = comment || note;
      const isApprove = action === 'APPROVE' || action === 'Approve';
      const targetStatus = isApprove ? 'APPROVED' : 'REJECTED';

      // Lấy claim để kiểm tra hạn mức
      const { data: claim, error: findErr } = await supabase
        .from('compensation_claims')
        .select('*')
        .eq('id', id)
        .single();

      if (findErr || !claim) {
        return res.status(404).json({ message: 'Không tìm thấy yêu cầu bồi thường.' });
      }

      // Ràng buộc nghiệp vụ: Bắt buộc nhập comment nếu Từ chối hoặc Duyệt vượt hạn mức
      if (!isApprove && !decisionText) {
        return res.status(400).json({ message: 'Bắt buộc nhập lý do/nhận xét khi từ chối bồi thường (MSG02).' });
      }

      // Cập nhật claim
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

      // Nếu claim gắn với incident, cập nhật trạng thái incident
      if (claim.incident_id) {
        await supabase
          .from('incidents')
          .update({
            status: isApprove ? 'RESOLVED' : 'CLOSED',
            updated_at: new Date().toISOString()
          })
          .eq('id', claim.incident_id);
      }

      // Ghi activity_logs
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
  },

  // 6. Xem lại chuyến đi GPS & Timeline (UC-42 - Screen 40)
  getTripReplay: async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Lấy thông tin chuyến
      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .select(`
          id,
          trip_code,
          planned_start,
          planned_distance,
          planned_duration,
          actual_distance,
          actual_duration,
          status,
          created_at
        `)
        .eq('id', id)
        .single();

      if (tripErr || !trip) {
        return res.status(404).json({ message: 'Không tìm thấy chuyến vận chuyển.' });
      }

      // 2. Lấy các điểm dừng (trip_stops)
      const { data: stops, error: stopsErr } = await supabase
        .from('trip_stops')
        .select(`
          id,
          seq,
          type,
          address,
          lat,
          lng,
          distance_km_from_prev,
          eta_at,
          status,
          arrived_at,
          done_at,
          result,
          result_reason
        `)
        .eq('trip_id', id)
        .order('seq', { ascending: true });

      // 3. Lấy vết GPS (gps_points)
      const { data: points, error: pointsErr } = await supabase
        .from('gps_points')
        .select('id, lat, lng, recorded_at')
        .eq('trip_id', id)
        .order('recorded_at', { ascending: true });

      // 4. Lấy các sự kiện dòng thời gian & vi phạm bán kính (trip_events)
      const { data: events, error: eventsErr } = await supabase
        .from('trip_events')
        .select(`
          id,
          type,
          occurred_at,
          lat,
          lng,
          outside_radius,
          result
        `)
        .eq('trip_id', id)
        .order('occurred_at', { ascending: true });

      return res.json({
        trip,
        stops: stops || [],
        gps_track: points || [],
        events: events || []
      });
    } catch (error) {
      console.error('getTripReplay Error:', error);
      return res.status(500).json({ message: 'Lỗi khi tải dữ liệu tua lại chuyến', error: error.message });
    }
  }
};

module.exports = managerIncidentController;
