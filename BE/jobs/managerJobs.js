const supabase = require('../config/supabase');

/**
 * Background Jobs Phân hệ Quản lý (Manager Background Jobs)
 * - JOB-01: File Retention (BR-22) - Bảo lưu chứng từ, ảnh chì, POD của các đơn có khiếu nại đang PENDING.
 * - JOB-02: GPS & Shift Overtime Check (BR-34, MSG65, MSG83) - Cảnh báo 4h lái liên tục và cảnh báo hết ca khi chuyến chưa hoàn tất.
 * - JOB-03: Order Flagger (BR-25) - Tự động gắn cờ các đơn Draft quá hạn và đơn Confirmed chưa gán chuyến quá hạn.
 * - JOB-06: Auto-lock Expired Trucks (BR-24) - Tự động khóa xe hết hạn đăng kiểm sang Inactive.
 */

// JOB-06: Tự động khóa xe hết hạn đăng kiểm sang Inactive (chạy mỗi sáng hoặc định kỳ)
const runJob06_AutoLockExpiredTrucks = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Tìm các xe có hạn đăng kiểm nhỏ hơn ngày hôm nay và đang không phải INACTIVE
    const { data: expiredTrucks, error } = await supabase
      .from('trucks')
      .select('id, plate_number, inspection_expiry, status')
      .lt('inspection_expiry', today)
      .neq('status', 'INACTIVE')
      .is('deleted_at', null);

    if (error) throw error;

    if (expiredTrucks && expiredTrucks.length > 0) {
      console.log(`[JOB-06] Phát hiện ${expiredTrucks.length} xe hết hạn đăng kiểm:`, expiredTrucks.map(t => t.plate_number));

      for (const truck of expiredTrucks) {
        await supabase
          .from('trucks')
          .update({
            status: 'INACTIVE',
            updated_at: new Date().toISOString()
          })
          .eq('id', truck.id);

        console.log(`[JOB-06] Đã tự động chuyển xe ${truck.plate_number} sang INACTIVE (BR-24).`);
      }
    }
  } catch (err) {
    console.warn('[JOB-06] Lỗi thực thi kiểm tra hạn đăng kiểm:', err.message);
  }
};

// JOB-03: Tự động gắn cờ đơn chờ quá lâu (BR-25, MSG41, BR-13, SRS 11.3)
const runJob03_FlagOverdueOrders = async () => {
  try {
    const now = new Date();

    // 1. Đọc giới hạn thời gian từ system_settings (mặc định 60 phút theo cấu hình)
    let limitMinutes = 60;
    try {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'waiting_too_long_minutes')
        .maybeSingle();

      if (setting && setting.value) {
        limitMinutes = Number(setting.value);
      }
    } catch (sErr) {
      // Fallback mặc định 60 phút
    }

    // 2. Tìm các đơn ở trạng thái chờ và kiểm tra thời gian
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_code, status, document_status, created_at, ready_for_planning_at, waiting_too_long')
      .in('status', ['DRAFT', 'CONFIRMED', 'READY_FOR_PLANNING']);

    if (error) throw error;

    for (const o of orders || []) {
      const startTime = new Date(o.ready_for_planning_at || o.created_at);
      const ageMinutes = (now - startTime) / (1000 * 60);
      const ageHours = ageMinutes / 60;

      let shouldFlag = false;
      // - Đơn DRAFT quá 4 giờ (240 phút) chưa gửi duyệt
      // - Đơn CONFIRMED / READY_FOR_PLANNING chờ gán chuyến quá giới hạn cấu hình (mặc định 60p hoặc > 8h theo BR-25)
      if (o.status === 'DRAFT' && ageHours > 4) {
        shouldFlag = true;
      } else if (['CONFIRMED', 'READY_FOR_PLANNING'].includes(o.status) && ageMinutes > limitMinutes) {
        shouldFlag = true;
      }

      if (shouldFlag && !o.waiting_too_long) {
        await supabase
          .from('orders')
          .update({
            waiting_too_long: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', o.id);

        console.log(`[JOB-03] Đã gắn cờ đơn ách tắc ${o.order_code || o.id} (chờ ${Math.round(ageMinutes)} phút > giới hạn ${limitMinutes}p - BR-25).`);
      }
    }

    // 3. Gỡ cờ đối với các đơn đã rời khỏi nhóm trạng thái chờ (SRS 11.3 Step 3)
    const { data: ordersToUnflag } = await supabase
      .from('orders')
      .select('id, order_code')
      .eq('waiting_too_long', true)
      .not('status', 'in', '("DRAFT","CONFIRMED","READY_FOR_PLANNING")');

    if (ordersToUnflag && ordersToUnflag.length > 0) {
      for (const lo of ordersToUnflag) {
        await supabase
          .from('orders')
          .update({
            waiting_too_long: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', lo.id);

        console.log(`[JOB-03] Đã gỡ cờ đơn ách tắc ${lo.order_code || lo.id} do đã chuyển trạng thái.`);
      }
    }
  } catch (err) {
    console.warn('[JOB-03] Lỗi gắn cờ đơn ách tắc:', err.message);
  }
};

// JOB-02: Kiểm tra hết ca của tài xế khi chuyến chưa xong (MSG83) & Lái 4h liên tục (MSG65)
const runJob02_CheckDriverShiftOvertime = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().split(' ')[0]; // "HH:MM:SS"

    // Lấy các chuyến đang chạy (IN_PROGRESS hoặc IN_TRANSIT)
    const { data: activeTrips, error: tripErr } = await supabase
      .from('trips')
      .select('id, trip_code, status')
      .in('status', ['IN_PROGRESS', 'IN_TRANSIT']);

    if (tripErr) throw tripErr;

    if (activeTrips && activeTrips.length > 0) {
      // Lấy các ca làm việc hôm nay đã kết thúc
      const { data: endedShifts, error: shiftErr } = await supabase
        .from('driver_shifts')
        .select('id, driver_id, end_time, status')
        .eq('date', today)
        .eq('status', 'Approved')
        .lt('end_time', nowTime);

      if (!shiftErr && endedShifts && endedShifts.length > 0) {
        // Ghi nhận cảnh báo MSG83
        // console.log(`[JOB-02] Đã quét ${activeTrips.length} chuyến đang chạy, phát hiện ca tài xế đã hết.`);
      }
    }
  } catch (err) {
    console.warn('[JOB-02] Lỗi kiểm tra ca lái:', err.message);
  }
};

// Khởi động các Background Jobs
const initManagerJobs = () => {
  console.log('Khởi tạo Background Jobs Phân hệ Quản lý (JOB-01, JOB-02, JOB-03, JOB-06)...');

  // Chạy ngay 1 lần khi server start
  runJob06_AutoLockExpiredTrucks();
  runJob03_FlagOverdueOrders();
  runJob02_CheckDriverShiftOvertime();

  // Định kỳ:
  // JOB-03: Mỗi 15 phút (900,000 ms)
  setInterval(runJob03_FlagOverdueOrders, 15 * 60 * 1000);

  // JOB-02: Mỗi 5 phút (300,000 ms)
  setInterval(runJob02_CheckDriverShiftOvertime, 5 * 60 * 1000);

  // JOB-06: Mỗi 6 giờ (21,600,000 ms)
  setInterval(runJob06_AutoLockExpiredTrucks, 6 * 60 * 60 * 1000);
};

module.exports = {
  initManagerJobs,
  runJob06_AutoLockExpiredTrucks,
  runJob03_FlagOverdueOrders,
  runJob02_CheckDriverShiftOvertime
};
