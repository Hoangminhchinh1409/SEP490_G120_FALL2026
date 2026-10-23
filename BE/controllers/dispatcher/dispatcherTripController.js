const supabase = require('../../config/supabase');
const crypto = require('crypto');
const { getTruckModelName } = require('./dispatcherFleetController');

// Lấy danh sách các chuyến xe
const getAllTrips = async (req, res) => {
  try {
    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_trucks(
          truck:trucks(id, plate_number, allowed_payload, status)
        ),
        trip_drivers(
          driver:driver_profiles(
            id,
            user:users(id, full_name, phone)
          )
        ),
        stops:trip_stops(
          id,
          sequence,
          stop_type,
          location_id,
          planned_arrival,
          actual_arrival,
          status,
          location:locations(id, name, address, latitude, longitude)
        ),
        incidents:incidents(
          id,
          type,
          status,
          description,
          reported_time
        )
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('getAllTrips error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách chuyến xe', error });
    }

    const formattedTrips = (trips || []).map(trip => {
      const truckObj = trip.trip_trucks?.[0]?.truck || trip.truck || {};
      const driverObj = trip.trip_drivers?.[0]?.driver?.user || trip.driver?.user || {};
      const sortedStops = (trip.stops || []).sort((a, b) => (a.sequence || a.seq || 0) - (b.sequence || b.seq || 0));

      const pickupStop = sortedStops.find(s => (s.stop_type || s.type) === 'PICKUP' || (s.stop_type || s.type) === 'Pickup') || sortedStops[0] || {};
      const dropoffStop = sortedStops.find(s => (s.stop_type || s.type) === 'DROPOFF' || (s.stop_type || s.type) === 'Delivery' || (s.stop_type || s.type) === 'Dropoff') || sortedStops[sortedStops.length - 1] || {};

      const hasIncident = trip.incidents && trip.incidents.length > 0;
      const latestIncident = hasIncident ? trip.incidents[0] : null;

      let progress = 10;
      const upperStatus = (trip.status || '').toUpperCase();
      if (upperStatus === 'COMPLETED') progress = 100;
      else if (upperStatus === 'IN_PROGRESS' || upperStatus === 'IN_TRANSIT') progress = 60;
      else if (upperStatus === 'ASSIGNED') progress = 20;

      return {
        id: trip.trip_code,
        raw_id: trip.id,
        plate: truckObj.plate_number || '29H-123.45',
        truck_model: getTruckModelName(truckObj.allowed_payload || truckObj.payload_kg),
        driver_name: driverObj.full_name || 'Nguyễn Văn Tài',
        driver_phone: driverObj.phone || '0901234567',
        orders: [trip.waybill_no || `ORD-${trip.id}`],
        customer: 'Khách hàng vận tải',
        pickup: pickupStop.address || pickupStop.location?.address || pickupStop.location?.name || 'Kho ALS Cảng HKQT Nội Bài',
        dropoff: dropoffStop.address || dropoffStop.location?.address || dropoffStop.location?.name || 'KCN Tiên Sơn, Bắc Ninh',
        planned_start: trip.planned_start ? new Date(trip.planned_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:30',
        planned_finish: '14:30',
        actual_start: trip.planned_start ? new Date(trip.planned_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:42',
        status: (upperStatus === 'IN_PROGRESS' || upperStatus === 'IN_TRANSIT') ? 'IN_TRANSIT' : (upperStatus === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED'),
        is_late_risk: hasIncident,
        late_reason: latestIncident ? latestIncident.description : null,
        has_incident: hasIncident,
        incident_id: latestIncident ? `INC-${latestIncident.id}` : null,
        progress,
        seal_number: `SEAL-VN-${trip.id * 1111}`,
        seal_photo_url: '/assets/hero.png',
        waybill_version: trip.waybill_version || 1,
        stops: sortedStops.length > 0 ? sortedStops.map(s => ({
          id: s.id,
          name: s.location?.name || s.address || 'Điểm dừng',
          type: s.stop_type || s.type,
          planned: (s.planned_arrival || s.eta_at) ? new Date(s.planned_arrival || s.eta_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00',
          actual: (s.actual_arrival || s.arrived_at) ? new Date(s.actual_arrival || s.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Đang di chuyển',
          event: (s.status || '').toUpperCase() === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang di chuyển',
          note: (s.stop_type || s.type) === 'PICKUP' ? 'Đã kẹp chì niêm phong' : 'Chờ giao hàng và ký POD'
        })) : [
          { id: 1, name: 'Kho ALS Cảng HKQT Nội Bài', type: 'PICKUP', planned: '08:30', actual: '08:40', event: 'Đã xuất phát', note: 'Niêm phong chì nguyên vẹn' },
          { id: 2, name: 'Điểm giao nhận', type: 'DROPOFF', planned: '14:30', actual: 'Dự kiến 14:15', event: 'Đang vận chuyển', note: 'Chờ nhận hàng và đối soát POD' }
        ]
      };
    });

    return res.json({ trips: formattedTrips });
  } catch (err) {
    console.error('getAllTrips exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Gán xe và lập chuyến (Tạo Trip trong DB)
const createTrip = async (req, res) => {
  try {
    const {
      order_id,
      order_code,
      truck_plate,
      driver_name,
      pickup_address,
      dropoff_address,
      allocation_type,
      vendor_name,
      vendor_tracking_code
    } = req.body;

    // 1. Tìm truck_id theo plate
    let truckId = null;
    if (truck_plate) {
      const { data: trk } = await supabase.from('trucks').select('id').eq('plate_number', truck_plate).limit(1);
      if (trk && trk.length > 0) truckId = trk[0].id;
    }
    if (!truckId) {
      const { data: trkFirst } = await supabase.from('trucks').select('id').limit(1);
      if (trkFirst && trkFirst.length > 0) truckId = trkFirst[0].id;
    }

    // 2. Tìm driver_id
    let driverId = 1;
    const { data: drv } = await supabase.from('driver_profiles').select('id').limit(1);
    if (drv && drv.length > 0) driverId = drv[0].id;

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const tripCode = `TRIP-${randomNum}`;
    // Mã vận đơn thống nhất của hệ thống: NEX - XXXXXX cho xe nội bộ, hoặc mã vận đơn đối tác cho vendor ngoài
    const waybillNo = allocation_type === 'VENDOR'
      ? (vendor_tracking_code?.trim() || '')
      : `NEX-${Math.floor(100000 + Math.random() * 900000)}`;

    // 3. Insert vào bảng trips
    const { data: newTrip, error: tripErr } = await supabase
      .from('trips')
      .insert([{
        trip_code: tripCode,
        status: 'IN_PROGRESS',
        planned_start_at: new Date().toISOString(),
        total_weight_kg: 1500,
        total_volume_m3: 10.5,
        truck_id: truckId,
        driver_id: driverId,
        waybill_no: waybillNo || `NEX-${Math.floor(100000 + Math.random() * 900000)}`,
        waybill_version: 1,
        created_by: 3
      }])
      .select();

    if (tripErr) {
      console.error('createTrip insert error:', tripErr);
      return res.status(500).json({ message: 'Không thể lập chuyến trên cơ sở dữ liệu', error: tripErr });
    }

    const tripId = newTrip[0].id;

    // 4. Tạo 2 điểm dừng (trip_stops: PICKUP & DROPOFF)
    const { data: stop1 } = await supabase.from('trip_stops').insert([{
      trip_id: tripId,
      seq: 1,
      type: 'PICKUP',
      location_id: 1,
      address: pickup_address || 'Kho ALS Cảng HKQT Nội Bài',
      status: 'COMPLETED',
      arrived_at: new Date().toISOString()
    }]).select();

    const { data: stop2 } = await supabase.from('trip_stops').insert([{
      trip_id: tripId,
      seq: 2,
      type: 'DROPOFF',
      location_id: 1,
      address: dropoff_address || 'KCN Tiên Sơn, Bắc Ninh',
      status: 'PENDING'
    }]).select();

    // 5. Cập nhật trạng thái đơn hàng sang ASSIGNED (hoặc HANDED_OVER_VENDOR) và gắn mã vận đơn
    const cleanOrderId = parseInt(order_id) || null;
    const orderUpdatePayload = {
      status: allocation_type === 'VENDOR' ? 'HANDED_OVER_VENDOR' : 'ASSIGNED'
    };
    if (waybillNo) {
      orderUpdatePayload.order_code = waybillNo;
    }

    if (cleanOrderId) {
      await supabase
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', cleanOrderId);

      // Liên kết stop với order
      if (stop1 && stop1[0]) {
        await supabase.from('trip_stop_orders').insert([{
          trip_stop_id: stop1[0].id,
          order_id: cleanOrderId
        }]).select();
      }

      // Ghi chú lịch sử
      await supabase.from('order_status_history').insert([{
        order_id: cleanOrderId,
        from_status: 'READY_FOR_PLANNING',
        to_status: allocation_type === 'VENDOR' ? 'HANDED_OVER_VENDOR' : 'ASSIGNED',
        notes: allocation_type === 'VENDOR'
          ? `Đã phân bổ cho nhà xe đối tác [${vendor_name || 'Đối tác vận tải'}]. Mã vận đơn đối tác: ${waybillNo || 'Chưa nhập'}`
          : `Đã phân bổ chuyến xe ${tripCode} (Xe nội bộ: ${truck_plate || 'Nội bộ'}, Lái xe: ${driver_name || 'Nội bộ'}). Khởi tạo mã vận đơn hệ thống: ${waybillNo}`,
        changed_by: 3
      }]);
    } else if (order_code) {
      await supabase
        .from('orders')
        .update(orderUpdatePayload)
        .eq('order_code', order_code);
    }

    // 6. Cập nhật trạng thái xe sang ON_TRIP
    if (truckId) {
      await supabase
        .from('trucks')
        .update({ status: 'ON_TRIP' })
        .eq('id', truckId);
    }

    return res.status(201).json({
      message: 'Lập chuyến và phân bổ xe thành công!',
      trip: {
        id: tripCode,
        raw_id: tripId,
        plate: truck_plate || '29H-123.45',
        driver_name: driver_name || 'Nguyễn Văn Tài',
        status: 'IN_TRANSIT',
        waybill_no: waybillNo
      }
    });
  } catch (err) {
    console.error('createTrip exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cập nhật trạng thái chuyến xe (Hoàn thành chuyến / Đang đi)
const updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const realTripId = parseInt(id.replace('TRIP-', '')) || parseInt(id);

    let dbStatus = 'IN_PROGRESS';
    if (status === 'COMPLETED' || status === 'DELIVERED') dbStatus = 'COMPLETED';
    else if (status === 'CANCELLED') dbStatus = 'CANCELLED';

    // 1. Cập nhật chuyến
    const { data: updatedTrip, error } = await supabase
      .from('trips')
      .update({
        status: dbStatus,
        completed_at: dbStatus === 'COMPLETED' ? new Date().toISOString() : null
      })
      .or(`id.eq.${realTripId},trip_code.eq.${id}`)
      .select();

    if (error) {
      console.error('updateTripStatus error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật trạng thái chuyến', error });
    }

    // 2. Nếu chuyến hoàn thành: Trả xe về trạng thái AVAILABLE và cập nhật đơn hàng thành DELIVERED
    if (dbStatus === 'COMPLETED' && updatedTrip && updatedTrip.length > 0) {
      const trip = updatedTrip[0];
      if (trip.truck_id) {
        await supabase.from('trucks').update({ status: 'AVAILABLE' }).eq('id', trip.truck_id);
      }

      // Cập nhật trip_stops thành COMPLETED
      await supabase.from('trip_stops').update({ status: 'COMPLETED' }).eq('trip_id', trip.id);

      // Tìm các đơn hàng thuộc chuyến này qua trip_stop_orders
      const { data: stopOrders } = await supabase
        .from('trip_stop_orders')
        .select('order_id')
        .in('trip_stop_id', (await supabase.from('trip_stops').select('id').eq('trip_id', trip.id)).data?.map(s => s.id) || []);

      if (stopOrders && stopOrders.length > 0) {
        const orderIds = stopOrders.map(so => so.order_id);
        await supabase.from('orders').update({ 
          status: 'CLOSED', // Vận chuyển xong là đóng đơn luôn tự động
          delivered_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).in('id', orderIds);
      }
    }

    return res.json({ message: 'Cập nhật trạng thái chuyến thành công', trip: updatedTrip?.[0] });
  } catch (err) {
    console.error('updateTripStatus exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Lấy danh sách sự cố
const getAllIncidents = async (req, res) => {
  try {
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select(`
        *,
        trip:trips(
          id,
          trip_code,
          trip_trucks(truck:trucks(plate_number)),
          trip_drivers(driver:driver_profiles(user:users(full_name, phone)))
        )
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('getAllIncidents error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách sự cố', error });
    }

    const typeDisplayMap = {
      'BREAKDOWN': 'HỎNG XE GIỮA ĐƯỜNG',
      'ACCIDENT': 'VA CHẠM GIAO THÔNG',
      'CARGO_DAMAGED': 'HƯ HỎNG HÀNG HÓA',
      'CARGO_LOST': 'THẤT LẠC NIÊM PHONG',
      'HELD_BY_AUTHORITIES': 'KIỂM TRA HẢI QUAN / CSGT',
      'ROAD_BAN': 'CẤM ĐƯỜNG / KẸT XE',
      'FAILED_DELIVERY': 'GIAO HÀNG KHÔNG THÀNH CÔNG',
      'OTHER': 'SỰ CỐ KHÁC'
    };

    const formatted = (incidents || []).map(inc => {
      const truckObj = inc.trip?.trip_trucks?.[0]?.truck || inc.trip?.truck || {};
      const driverObj = inc.trip?.trip_drivers?.[0]?.driver?.user || inc.trip?.driver?.user || {};
      const reportedAt = inc.reported_time || inc.reported_at || inc.created_at;

      return {
        id: `INC-${inc.id}`,
        raw_id: inc.id,
        trip_code: inc.trip?.trip_code || `TRIP-${inc.trip_id}`,
        truck: truckObj.plate_number || '29H-123.45',
        driver: driverObj.full_name || 'Tài xế',
        phone: driverObj.phone || '0901234567',
        type: typeDisplayMap[inc.type] || inc.type,
        raw_type: inc.type,
        severity: inc.type === 'ACCIDENT' || inc.type === 'BREAKDOWN' ? 'HIGH' : 'MEDIUM',
        status: (inc.status || '').toUpperCase() === 'REPORTED' ? 'PENDING' : inc.status,
        reported_at: reportedAt ? new Date(reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:15',
        location: 'Km 18 cao tốc Nội Bài - Bắc Ninh',
        description: inc.description || 'Sự cố phát sinh trên đường vận chuyển'
      };
    });

    return res.json({ incidents: formatted });
  } catch (err) {
    console.error('getAllIncidents exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Báo cáo sự cố mới
const createIncident = async (req, res) => {
  try {
    const { trip_id, type, description, location } = req.body;

    let realTripId = parseInt(trip_id) || 1;
    if (typeof trip_id === 'string' && trip_id.includes('TRIP-')) {
      const { data: tr } = await supabase.from('trips').select('id').eq('trip_code', trip_id).limit(1);
      if (tr && tr.length > 0) realTripId = tr[0].id;
    }

    const { data: newInc, error } = await supabase
      .from('incidents')
      .insert([{
        trip_id: realTripId,
        reported_by: 3,
        type: type || 'BREAKDOWN',
        status: 'REPORTED',
        description: description || 'Sự cố phát sinh cần điều phối xử lý',
        reported_at: new Date().toISOString(),
        client_action_id: crypto.randomUUID()
      }])
      .select();

    if (error) {
      console.error('createIncident error:', error);
      return res.status(500).json({ message: 'Lỗi ghi nhận sự cố', error });
    }

    return res.status(201).json({ message: 'Đã báo cáo sự cố thành công', incident: newInc[0] });
  } catch (err) {
    console.error('createIncident exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cập nhật trạng thái sự cố (Giải quyết / Đóng)
const updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const realId = parseInt(id.replace('INC-', '')) || parseInt(id);
    const { status, notes } = req.body;

    const { data: updated, error } = await supabase
      .from('incidents')
      .update({ status: status || 'RESOLVED' })
      .eq('id', realId)
      .select();

    if (error) {
      console.error('updateIncidentStatus error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật sự cố', error });
    }

    return res.json({ message: 'Đã cập nhật sự cố thành công', incident: updated[0] });
  } catch (err) {
    console.error('updateIncidentStatus exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// ==========================================
// 5. DASHBOARD STATS (THỐNG KÊ TỔNG QUAN REALTIME)

module.exports = {
  getAllTrips,
  createTrip,
  updateTripStatus,
  getAllIncidents,
  createIncident,
  updateIncidentStatus
};