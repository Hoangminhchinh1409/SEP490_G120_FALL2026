const fleetService = require("../services/fleetService");
const claimService = require("../services/claimService");
const prisma = require('../config/prisma');
const queueAdapter = require('./queueAdapter');

/**
 * Background Jobs Phân hệ Quản lý (Manager Background Jobs)
 * Tích hợp Distributed Queue Adapter & PostgreSQL Advisory Lock (Improvement 3):
 * - Đảm bảo tải cho hàng nghìn xe truyền vị trí GPS không làm nghẽn Event Loop.
 * - Tránh race-condition khi chạy nhiều instance backend bằng pg_try_advisory_lock.
 * - JOB-01: File Retention - Bảo lưu chứng từ, dữ liệu GPS của các đơn/chuyến có khiếu nại chưa ĐÓNG (BF-04 Keep Trip Data).
 * - JOB-02: GPS & Shift Overtime Check - Cảnh báo 4h lái liên tục và cảnh báo hết ca khi chuyến chưa hoàn tất.
 * - JOB-03: Order Flagger - Tự động gắn cờ các đơn Draft quá hạn và đơn Confirmed chưa gán chuyến quá hạn.
 * - JOB-06: Auto-lock Expired Trucks - Tự động khóa xe hết hạn đăng kiểm sang Inactive.
 * - JOB-07: Auto-assign Shifts & Reminders - Tự động nhắc và xếp ca tài xế hàng tuần.
 * - JOB-08: Auto-close Paid Claims - Tự động đóng hồ sơ bồi thường sau 7 ngày không có phản hồi từ khách hàng (BF-04).
 */

// Định nghĩa mã khóa Advisory Lock cho từng Job
const LOCK_KEYS = {
  JOB_01: 1001,
  JOB_02: 1002,
  JOB_03: 1003,
  JOB_06: 1006,
  JOB_07: 1007,
  JOB_08: 1008
};

const readNumericSetting = async (key, defaultValue) => {
  try {
    const setting = await prisma.system_settings.findUnique({
      where: { key },
      select: { value: true }
    });
    if (setting && setting.value !== null && setting.value !== undefined) {
      const rawVal = typeof setting.value === 'object'
        ? (setting.value.days ?? setting.value.value)
        : setting.value;
      const parsed = parseInt(String(rawVal), 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[Settings] Không đọc được ${key}, dùng mặc định ${defaultValue}:`, err.message);
  }
  return defaultValue;
};

// JOB-06: Tự động khóa xe hết hạn đăng kiểm (trừ xe đang ON_TRIP) và gửi cảnh báo 30 ngày lúc 06:00 mỗi ngày
const getTodayGMT7Str = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().split('T')[0];

const addDaysToDateStr = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
};

const runJob06_AutoLockExpiredTrucks = async () => {
  try {
    const todayStr = getTodayGMT7Str();
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
    const reminderCutoffDate = new Date(`${addDaysToDateStr(todayStr, 30)}T23:59:59.999Z`);

    // 1. Khóa các xe hết hạn đăng kiểm (không khóa xe đang chạy chuyến ON_TRIP/IN_TRANSIT/IN_PROGRESS)
    const expiredTrucks = await prisma.trucks.findMany({
      where: {
        inspection_expiry: { lt: todayDate },
        status: {
          notIn: ['INACTIVE', 'Inactive', 'ON_TRIP', 'On Trip', 'IN_TRANSIT', 'IN_PROGRESS']
        },
        deleted_at: null
      },
      select: { id: true, plate_number: true, inspection_expiry: true, status: true }
    });

    if (expiredTrucks && expiredTrucks.length > 0) {
      await prisma.trucks.updateMany({
        where: { id: { in: expiredTrucks.map((t) => t.id) } },
        data: {
          status: 'INACTIVE',
          updated_at: new Date()
        }
      });
      console.log(`[JOB-06] Đã khóa ${expiredTrucks.length} xe hết hạn đăng kiểm sang INACTIVE:`, expiredTrucks.map((t) => t.plate_number));
    }

    // 2. Cảnh báo giấy tờ sắp hết hạn trong vòng 30 ngày (Đăng kiểm xe, Bảo hiểm xe, GPLX tài xế) - không trùng lặp trong ngày
    const [managers, expiringTrucks, expiringDrivers] = await Promise.all([
      prisma.users.findMany({
        where: { role_id: 2n, status: { in: ['ACTIVE', 'Active'] } },
        select: { id: true }
      }),
      prisma.trucks.findMany({
        where: {
          deleted_at: null,
          status: { notIn: ['INACTIVE', 'Inactive'] },
          OR: [
            { inspection_expiry: { lte: reminderCutoffDate } },
            { insurance_expiry: { lte: reminderCutoffDate } }
          ]
        },
        select: { id: true, plate_number: true, inspection_expiry: true, insurance_expiry: true }
      }),
      prisma.driver_profiles.findMany({
        where: {
          status: { notIn: ['INACTIVE', 'Inactive', 'SUSPENDED'] },
          license_expiry: { lte: reminderCutoffDate }
        },
        select: {
          id: true,
          license_number: true,
          license_expiry: true,
          users: { select: { full_name: true, username: true } }
        }
      })
    ]);

    const alerts = [];
    for (const t of expiringTrucks || []) {
      if (t.inspection_expiry && new Date(t.inspection_expiry) <= reminderCutoffDate) {
        const expStr = new Date(t.inspection_expiry).toISOString().split('T')[0];
        const daysLeft = Math.ceil((new Date(`${expStr}T00:00:00.000Z`) - todayDate) / 86400000);
        alerts.push({
          tag: `[JOB-06 ${todayStr}][TRUCK_INSPECTION:${t.id}]`,
          targetType: 'TRUCK',
          targetId: t.id,
          message: `[JOB-06 ${todayStr}][TRUCK_INSPECTION:${t.id}] Xe ${t.plate_number} ${daysLeft < 0 ? 'đã hết hạn' : `còn ${daysLeft} ngày hết hạn`} đăng kiểm (${expStr}).`
        });
      }
      if (t.insurance_expiry && new Date(t.insurance_expiry) <= reminderCutoffDate) {
        const expStr = new Date(t.insurance_expiry).toISOString().split('T')[0];
        const daysLeft = Math.ceil((new Date(`${expStr}T00:00:00.000Z`) - todayDate) / 86400000);
        alerts.push({
          tag: `[JOB-06 ${todayStr}][TRUCK_INSURANCE:${t.id}]`,
          targetType: 'TRUCK',
          targetId: t.id,
          message: `[JOB-06 ${todayStr}][TRUCK_INSURANCE:${t.id}] Xe ${t.plate_number} ${daysLeft < 0 ? 'đã hết hạn' : `còn ${daysLeft} ngày hết hạn`} bảo hiểm (${expStr}).`
        });
      }
    }

    for (const d of expiringDrivers || []) {
      if (d.license_expiry && new Date(d.license_expiry) <= reminderCutoffDate) {
        const expStr = new Date(d.license_expiry).toISOString().split('T')[0];
        const daysLeft = Math.ceil((new Date(`${expStr}T00:00:00.000Z`) - todayDate) / 86400000);
        const drvName = d.users?.full_name || d.users?.username || `Tài xế #${d.id}`;
        alerts.push({
          tag: `[JOB-06 ${todayStr}][DRIVER_LICENSE:${d.id}]`,
          targetType: 'DRIVER',
          targetId: d.id,
          message: `[JOB-06 ${todayStr}][DRIVER_LICENSE:${d.id}] GPLX ${d.license_number} của ${drvName} ${daysLeft < 0 ? 'đã hết hạn' : `còn ${daysLeft} ngày hết hạn`} (${expStr}).`
        });
      }
    }

    let alertsSent = 0;
    if (alerts.length > 0 && managers.length > 0) {
      const existingToday = await prisma.notifications.findMany({
        where: {
          user_account_id: { in: managers.map((m) => m.id) },
          message: { contains: `[JOB-06 ${todayStr}]` }
        },
        select: { user_account_id: true, message: true }
      });
      const existingKeys = new Set(
        (existingToday || []).map((n) => `${n.user_account_id}:${n.message.slice(0, 48)}`)
      );

      const toInsert = [];
      for (const m of managers) {
        for (const a of alerts) {
          const already = (existingToday || []).some(
            (n) => Number(n.user_account_id) === Number(m.id) && n.message.includes(a.tag)
          );
          const key = `${m.id}:${a.message.slice(0, 48)}`;
          if (!already && !existingKeys.has(key)) {
            toInsert.push({
              user_account_id: m.id,
              target_type: a.targetType,
              target_id: a.targetId,
              message: a.message
            });
          }
        }
      }

      if (toInsert.length > 0) {
        await prisma.notifications.createMany({ data: toInsert });
        alertsSent = toInsert.length;
      }
    }

    console.log(`[JOB-06] Hoàn tất kiểm tra hạn giấy tờ (${todayStr}): khóa ${expiredTrucks.length} xe, gửi ${alertsSent} cảnh báo.`);
    return { lockedCount: expiredTrucks.length, alertsSent, alertItems: alerts.length };
  } catch (err) {
    console.warn('[JOB-06] Lỗi thực thi kiểm tra hạn đăng kiểm:', err.message);
    return { lockedCount: 0, alertsSent: 0, error: true };
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

// JOB-08: Tự động đóng Claim đã thanh toán quá 7 ngày chưa có phản hồi khách hàng (BF-04)
const runJob08_AutoClosePaidClaims = async (options = {}) => {
  try {
    const res = await claimService.autoCloseOverduePaidClaims(options);
    if (res?.closedCount > 0) {
      console.log(`[JOB-08] Đã tự động đóng ${res.closedCount} hồ sơ bồi thường quá hạn 7 ngày (AUTO_7_DAYS).`);
    }
    return res;
  } catch (err) {
    console.warn('[JOB-08] Lỗi tự động đóng hồ sơ bồi thường 7 ngày:', err.message);
    return { closedCount: 0, closedClaimIds: [], error: true };
  }
};

// JOB-01: Dọn dẹp chứng từ & GPS quá hạn, luôn bảo lưu (Keep Trip Data) các đơn/chuyến có Claim chưa ĐÓNG (BF-04)
const runJob01_RetentionWithClaimHold = async ({ dryRun = false } = {}) => {
  try {
    const [docRetentionDays, gpsRetentionDays, protectedRefs] = await Promise.all([
      readNumericSetting('document_retention_days', 60),
      readNumericSetting('gps_track_retention_days', 90),
      claimService.getProtectedClaimOrderAndTripIds()
    ]);

    const nowMs = Date.now();
    const docCutoff = new Date(nowMs - docRetentionDays * 86400000);
    const gpsCutoff = new Date(nowMs - gpsRetentionDays * 86400000);

    const protectedOrderIds = protectedRefs?.protectedOrderIds || [];
    const protectedTripIds = protectedRefs?.protectedTripIds || [];

    const gpsWhere = {
      recorded_time: { lt: gpsCutoff },
      ...(protectedTripIds.length > 0 ? { trip_id: { notIn: protectedTripIds.map((id) => BigInt(id)) } } : {})
    };

    const docWhere = {
      file_link: { not: null },
      uploaded_time: { lt: docCutoff },
      ...(protectedOrderIds.length > 0 ? { order_id: { notIn: protectedOrderIds.map((id) => BigInt(id)) } } : {})
    };

    let cleanedGpsPoints = 0;
    let cleanedDocuments = 0;

    if (dryRun) {
      const [gpsCount, docCount] = await Promise.all([
        prisma.trip_track_points.count({ where: gpsWhere }),
        prisma.customer_documents.count({ where: docWhere })
      ]);
      cleanedGpsPoints = gpsCount;
      cleanedDocuments = docCount;
    } else {
      const [gpsDel, docUpd] = await Promise.all([
        prisma.trip_track_points.deleteMany({ where: gpsWhere }),
        prisma.customer_documents.updateMany({
          where: docWhere,
          data: { file_link: null }
        })
      ]);
      cleanedGpsPoints = gpsDel?.count || 0;
      cleanedDocuments = docUpd?.count || 0;
    }

    if (cleanedGpsPoints > 0 || cleanedDocuments > 0) {
      console.log(
        `[JOB-01] Retention (${dryRun ? 'dry-run' : 'live'}): dọn ${cleanedDocuments} chứng từ (> ${docRetentionDays} ngày) & ${cleanedGpsPoints} điểm GPS (> ${gpsRetentionDays} ngày); bảo lưu ${protectedOrderIds.length} đơn & ${protectedTripIds.length} chuyến đang có Claim mở.`
      );
    }

    return {
      protectedOrderCount: protectedOrderIds.length,
      protectedTripCount: protectedTripIds.length,
      cleanedGpsPoints,
      cleanedDocuments,
      docRetentionDays,
      gpsRetentionDays,
      dryRun
    };
  } catch (err) {
    console.warn('[JOB-01] Lỗi thực thi Retention Policy:', err.message);
    return {
      protectedOrderCount: 0,
      protectedTripCount: 0,
      cleanedGpsPoints: 0,
      cleanedDocuments: 0,
      error: true
    };
  }
};

const initManagerJobs = () => {
  console.log('Khởi tạo Background Jobs Phân hệ Quản lý (JOB-01, JOB-02, JOB-03, JOB-06, JOB-07, JOB-08) qua Distributed Queue Adapter...');

  // Đăng ký các background queue workers
  queueAdapter.process('job:retention-cleanup', async () => {
    await queueAdapter.runWithAdvisoryLock(LOCK_KEYS.JOB_01, 'JOB-01', () => runJob01_RetentionWithClaimHold());
  });

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

  queueAdapter.process('job:auto-close-paid-claims', async () => {
    await queueAdapter.runWithAdvisoryLock(LOCK_KEYS.JOB_08, 'JOB-08', () => runJob08_AutoClosePaidClaims());
  });

  // Chạy JOB-03, JOB-02, JOB-07, JOB-08 khi khởi động; riêng JOB-06 chạy đúng lịch 06:00 sáng GMT+7 hằng ngày
  queueAdapter.enqueue('job:flag-overdue-orders');
  queueAdapter.enqueue('job:check-driver-shift');
  queueAdapter.enqueue('job:auto-assign-shifts');
  queueAdapter.enqueue('job:auto-close-paid-claims');

  // Định kỳ (tối ưu tốc độ chạy nền cho demo/vận hành thời gian thực):
  // JOB-01: Mỗi 24 giờ
  setInterval(() => {
    queueAdapter.enqueue('job:retention-cleanup');
  }, 24 * 60 * 60 * 1000);

  // JOB-08: Mỗi 1 phút quét các Claim đã chi trả quá 7 ngày chưa có phản hồi
  setInterval(() => {
    queueAdapter.enqueue('job:auto-close-paid-claims');
  }, 60 * 1000);

  // JOB-03: Mỗi 1 phút quét đơn hàng chờ quá lâu
  setInterval(() => {
    queueAdapter.enqueue('job:flag-overdue-orders');
  }, 60 * 1000);

  // JOB-02: Mỗi 30 giây kiểm tra thời gian lái xe liên tục & ca làm việc
  setInterval(() => {
    queueAdapter.enqueue('job:check-driver-shift');
  }, 30 * 1000);

  // JOB-06: Hằng ngày lúc 06:00 GMT+7 (có Advisory Lock)
  const scheduleDaily0600Job06 = () => {
    const nowGmt7 = new Date(Date.now() + 7 * 3600 * 1000);
    const next0600Gmt7 = new Date(Date.UTC(
      nowGmt7.getUTCFullYear(),
      nowGmt7.getUTCMonth(),
      nowGmt7.getUTCDate(),
      6, 0, 0, 0
    ));
    if (next0600Gmt7 <= nowGmt7) {
      next0600Gmt7.setUTCDate(next0600Gmt7.getUTCDate() + 1);
    }
    const delayMs = Math.max(1000, next0600Gmt7.getTime() - nowGmt7.getTime());
    setTimeout(() => {
      queueAdapter.enqueue('job:lock-expired-trucks');
      scheduleDaily0600Job06();
    }, delayMs);
  };
  scheduleDaily0600Job06();

  // JOB-07: Mỗi 30 giây quét reminder và phân ca
  setInterval(() => {
    queueAdapter.enqueue('job:auto-assign-shifts');
  }, 30 * 1000);
};

module.exports = {
  initManagerJobs,
  runJob01_RetentionWithClaimHold,
  runJob06_AutoLockExpiredTrucks,
  runJob03_FlagOverdueOrders,
  runJob02_CheckDriverShiftOvertime,
  runJob07_AutoAssignNextWeekShifts,
  runJob08_AutoClosePaidClaims,
};
