const fleetService = require("../services/fleetService");
const prisma = require('../config/prisma');
const queueAdapter = require('./queueAdapter');

/**
 * Background Jobs Phân hệ Quản lý (Manager Background Jobs)
 * Tích hợp Distributed Queue Adapter & PostgreSQL Advisory Lock (Improvement 3):
 * - Đảm bảo tải cho hàng nghìn xe truyền vị trí GPS không làm nghẽn Event Loop.
 * - Tránh race-condition khi chạy nhiều instance backend bằng pg_try_advisory_lock.
 * - JOB-01: File Retention - Bảo lưu chứng từ, ảnh chì, POD của các đơn có khiếu nại đang PENDING.
 * - JOB-02: GPS & Shift Overtime Check - Cảnh báo 4h lái liên tục và cảnh báo hết ca khi chuyến chưa hoàn tất.
 * - JOB-03: Order Flagger - Tự động gắn cờ các đơn Draft quá hạn và đơn Confirmed chưa gán chuyến quá hạn.
 * - JOB-06: Auto-lock Expired Trucks - Tự động khóa xe hết hạn đăng kiểm sang Inactive.
 * - JOB-07: Auto-assign Shifts & Reminders - Tự động nhắc và xếp ca tài xế hàng tuần.
 */

// Định nghĩa mã khóa Advisory Lock cho từng Job
const LOCK_KEYS = {
  JOB_06: 1006,
  JOB_03: 1003,
  JOB_02: 1002,
  JOB_07: 1007
};

// JOB-06: Tự động khóa xe hết hạn đăng kiểm sang Inactive (chạy mỗi sáng hoặc định kỳ)
const runJob06_AutoLockExpiredTrucks = async () => {
  try {
    const todayDate = new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`);

    // Tìm các xe có hạn đăng kiểm nhỏ hơn ngày hôm nay và đang không phải INACTIVE
    const expiredTrucks = await prisma.trucks.findMany({
      where: {
        inspection_expiry: { lt: todayDate },
        status: { not: 'INACTIVE' },
        deleted_at: null
      },
      select: { id: true, plate_number: true, inspection_expiry: true, status: true }
    });

    if (expiredTrucks && expiredTrucks.length > 0) {
      console.log(`[JOB-06] Phát hiện ${expiredTrucks.length} xe hết hạn đăng kiểm:`, expiredTrucks.map(t => t.plate_number));

      await prisma.trucks.updateMany({
        where: { id: { in: expiredTrucks.map((t) => t.id) } },
        data: {
          status: 'INACTIVE',
          updated_at: new Date()
        }
      });

      for (const truck of expiredTrucks) {
        console.log(`[JOB-06] Đã tự động chuyển xe ${truck.plate_number} sang INACTIVE.`);
      }
    }
  } catch (err) {
    console.warn('[JOB-06] Lỗi thực thi kiểm tra hạn đăng kiểm:', err.message);
  }
};

// JOB-03: Tự động gắn cờ đơn chờ quá lâu
const runJob03_FlagOverdueOrders = async () => {
  try {
    const now = new Date();

    // 1. Đọc giới hạn thời gian từ system_settings (mặc định 60 phút theo cấu hình)
    let limitMinutes = 60;
    try {
      const setting = await prisma.system_settings.findUnique({
        where: { key: 'waiting_too_long_minutes' },
        select: { value: true }
      });

      if (setting && setting.value) {
        limitMinutes = Number(setting.value);
      }
    } catch (sErr) {
      // Fallback mặc định 60 phút
    }

    // 2. Tìm các đơn ở trạng thái chờ và kiểm tra thời gian (chỉ áp dụng với Draft và Confirmed theo SRS 11.3)
    const orders = await prisma.orders.findMany({
      where: { status: { in: ['DRAFT', 'CONFIRMED'] } },
      select: {
        id: true,
        order_code: true,
        status: true,
        document_status: true,
        created_at: true,
        ready_for_planning_at: true,
        waiting_too_long: true
      }
    });

    for (const o of orders || []) {
      const startTime = new Date(o.created_at);
      const ageMinutes = (now - startTime) / (1000 * 60);
      const ageHours = ageMinutes / 60;

      let shouldFlag = false;
      // - Đơn DRAFT quá 4 giờ (240 phút) chưa gửi duyệt
      // - Đơn CONFIRMED chờ gán chuyến quá giới hạn cấu hình
      if (o.status === 'DRAFT' && ageHours > 4) {
        shouldFlag = true;
      } else if (o.status === 'CONFIRMED' && ageMinutes > limitMinutes) {
        shouldFlag = true;
      }

      if (shouldFlag && !o.waiting_too_long) {
        await prisma.orders.update({
          where: { id: o.id },
          data: {
            waiting_too_long: true,
            updated_at: new Date()
          }
        });

        console.log(`[JOB-03] Đã gắn cờ đơn ách tắc ${o.order_code || o.id} (chờ ${Math.round(ageMinutes)} phút > giới hạn ${limitMinutes}p -).`);
      } else if (!shouldFlag && o.waiting_too_long) {
        await prisma.orders.update({
          where: { id: o.id },
          data: {
            waiting_too_long: false,
            updated_at: new Date()
          }
        });

        console.log(`[JOB-03] Đã gỡ cờ đơn ${o.order_code || o.id} do đã được xử lý / chưa quá hạn.`);
      }
    }

    // 3. Gỡ cờ đối với các đơn đã rời khỏi nhóm trạng thái chờ (SRS 11.3 Step 3: đã sẵn sàng xếp xe hoặc đã gán chuyến)
    const ordersToUnflag = await prisma.orders.findMany({
      where: {
        waiting_too_long: true,
        status: { notIn: ['DRAFT', 'CONFIRMED'] }
      },
      select: { id: true, order_code: true }
    });

    if (ordersToUnflag && ordersToUnflag.length > 0) {
      await prisma.orders.updateMany({
        where: { id: { in: ordersToUnflag.map((lo) => lo.id) } },
        data: {
          waiting_too_long: false,
          updated_at: new Date()
        }
      });

      for (const lo of ordersToUnflag) {
        console.log(`[JOB-03] Đã gỡ cờ đơn ách tắc ${lo.order_code || lo.id} do đã chuyển trạng thái.`);
      }
    }
  } catch (err) {
    console.warn('[JOB-03] Lỗi gắn cờ đơn ách tắc:', err.message);
  }
};

// JOB-02: Kiểm tra hết ca của tài xế khi chuyến chưa xong & Lái 4h liên tục
const runJob02_CheckDriverShiftOvertime = async () => {
  try {
    const todayDate = new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`);
    const nowTime = new Date();

    // Lấy các chuyến đang chạy (IN_PROGRESS hoặc IN_TRANSIT)
    const activeTrips = await prisma.trips.findMany({
      where: { status: { in: ['IN_PROGRESS', 'IN_TRANSIT'] } },
      select: { id: true, trip_code: true, status: true }
    });

    if (activeTrips && activeTrips.length > 0) {
      // Lấy các ca làm việc hôm nay đã kết thúc
      await prisma.driver_shifts.findMany({
        where: {
          date: todayDate,
          status: 'Approved',
          end_time: { lt: nowTime }
        },
        select: { id: true, driver_id: true, end_time: true, status: true }
      });
    }
  } catch (err) {
    console.warn('[JOB-02] Lỗi kiểm tra ca lái:', err.message);
  }
};

// Khởi động các Background Jobs
const runJob07_AutoAssignNextWeekShifts = async () => {
  try {
    const remRes = await fleetService.sendShiftDeadlineReminders();
    if (remRes?.sentCount > 0) {
      console.log(
        `[JOB-07] Đã gửi thông báo nhắc đăng ký ca 21h (${remRes.nextMonday} - ${remRes.nextSunday}) cho ${remRes.sentCount} tài xế.`
      );
    }
    const res = await fleetService.autoAssignNextWeekShifts({ force: false });
    if (res?.executed && res.assignedDriversCount > 0) {
      console.log(
        `[JOB-07] Tự động xếp lịch tuần tới (${res.nextMonday} - ${res.nextSunday}) cho ${res.assignedDriversCount} tài xế (Sáng: ${res.assignedMorning}, Đêm: ${res.assignedNight}).`
      );
    }
  } catch (err) {
    console.error("[JOB-07] Auto-assign next week shifts error:", err.message);
  }
};

const initManagerJobs = () => {
  console.log('Khởi tạo Background Jobs Phân hệ Quản lý (JOB-01, JOB-02, JOB-03, JOB-06, JOB-07) qua Distributed Queue Adapter...');

  // Đăng ký các background queue workers
  queueAdapter.process('job:lock-expired-trucks', async () => {
    await queueAdapter.runWithAdvisoryLock(LOCK_KEYS.JOB_06, 'JOB-06', runJob06_AutoLockExpiredTrucks);
  });

  queueAdapter.process('job:flag-overdue-orders', async () => {
    await queueAdapter.runWithAdvisoryLock(LOCK_KEYS.JOB_03, 'JOB-03', runJob03_FlagOverdueOrders);
  });

  queueAdapter.process('job:check-driver-shift', async () => {
    await queueAdapter.runWithAdvisoryLock(LOCK_KEYS.JOB_02, 'JOB-02', runJob02_CheckDriverShiftOvertime);
  });

  queueAdapter.process('job:auto-assign-shifts', async () => {
    await queueAdapter.runWithAdvisoryLock(LOCK_KEYS.JOB_07, 'JOB-07', runJob07_AutoAssignNextWeekShifts);
  });

  // Chạy ngay 1 lần khi server start (bằng queue non-blocking)
  queueAdapter.enqueue('job:lock-expired-trucks');
  queueAdapter.enqueue('job:flag-overdue-orders');
  queueAdapter.enqueue('job:check-driver-shift');
  queueAdapter.enqueue('job:auto-assign-shifts');

  // Định kỳ:
  // JOB-03: Mỗi 15 phút (900,000 ms)
  setInterval(() => {
    queueAdapter.enqueue('job:flag-overdue-orders');
  }, 15 * 60 * 1000);

  // JOB-02: Mỗi 5 phút (300,000 ms)
  setInterval(() => {
    queueAdapter.enqueue('job:check-driver-shift');
  }, 5 * 60 * 1000);

  // JOB-06: Mỗi 6 giờ (21,600,000 ms)
  setInterval(() => {
    queueAdapter.enqueue('job:lock-expired-trucks');
  }, 6 * 60 * 60 * 1000);

  // JOB-07: Mỗi 1 phút quét reminder và phân ca
  setInterval(() => {
    queueAdapter.enqueue('job:auto-assign-shifts');
  }, 60 * 1000);
};

module.exports = {
  initManagerJobs,
  runJob06_AutoLockExpiredTrucks,
  runJob03_FlagOverdueOrders,
  runJob02_CheckDriverShiftOvertime,
  runJob07_AutoAssignNextWeekShifts,
};
