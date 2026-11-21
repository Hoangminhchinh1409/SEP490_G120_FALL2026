/**
 * VRPTW Engine (Vehicle Routing Problem with Time Windows)
 * Dành riêng cho hệ thống ALS Logistics với các ràng buộc:
 * 1. Khung giờ cấm xe tải theo Quyết định 06/2013 & 24/2020 của UBND TP. Hà Nội
 * 2. Khung giờ giao nhận (Time Windows) tại các kho bãi / nhà máy
 * 3. Tải trọng xe tải & Khối lượng hàng hóa
 * 4. Giới hạn lái xe liên tục của tài xế (Tối đa 4 giờ liên tục theo Luật GTĐB & BR-03)
 */

// Định nghĩa khung giờ cấm tải nội đô Hà Nội (Khu vực phía trong Vành Đai 3)
// Vùng Vành đai 3 tương đối: Vĩ độ 20.95 - 21.08, Kinh độ 105.75 - 105.88
const isInsideHanoiRingRoad3 = (lat, lng) => {
  if (!lat || !lng) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  return numLat >= 20.95 && numLat <= 21.08 && numLng >= 105.75 && numLng <= 105.88;
};

/**
 * Kiểm tra xem thời điểm cụ thể có bị vi phạm giờ cấm xe tải tại Hà Nội hay không
 * @param {Date|number} time - Giờ đang xét (Date object hoặc số phút trong ngày 0-1439)
 * @param {number} truckPayloadKg - Tải trọng xe tải (kg)
 * @param {number} lat - Vĩ độ
 * @param {number} lng - Kinh độ
 */
const checkHanoiTruckBan = (time, truckPayloadKg = 1250, lat, lng) => {
  if (!isInsideHanoiRingRoad3(lat, lng)) {
    return { isBanned: false, reason: null };
  }

  let minuteOfDay = 0;
  if (time instanceof Date) {
    minuteOfDay = time.getHours() * 60 + time.getMinutes();
  } else if (typeof time === 'number') {
    minuteOfDay = ((Math.round(time) % 1440) + 1440) % 1440;
  }

  const m6h00 = 6 * 60;
  const m9h00 = 9 * 60;
  const m16h30 = 16 * 60 + 30;
  const m19h30 = 19 * 60 + 30;
  const m21h00 = 21 * 60;

  // Xe tải nhẹ dưới 1.25T (Cấm giờ cao điểm: 06:00 - 09:00 và 16:30 - 19:30)
  if (truckPayloadKg <= 1250) {
    if ((minuteOfDay >= m6h00 && minuteOfDay <= m9h00) || (minuteOfDay >= m16h30 && minuteOfDay <= m19h30)) {
      return {
        isBanned: true,
        reason: 'Xe tải dưới 1.25T cấm vào nội đô Hà Nội (Vành Đai 3) trong giờ cao điểm (06h00 - 09h00 & 16h30 - 19h30)'
      };
    }
    return { isBanned: false, reason: null };
  }

  // Xe tải trung từ 1.25T đến dưới 2.5T (Chỉ được hoạt động từ 21h00 đến 06h00 sáng hôm sau)
  if (truckPayloadKg < 2500) {
    if (minuteOfDay >= m6h00 && minuteOfDay < m21h00) {
      return {
        isBanned: true,
        reason: 'Xe tải từ 1.25T đến 2.5T chỉ được phép vào nội đô Vành Đai 3 từ 21h00 đến 06h00 sáng hôm sau'
      };
    }
    return { isBanned: false, reason: null };
  }

  // Xe tải nặng >= 2.5T hoặc Container (Cấm toàn bộ nội đô từ 06h00 đến 21h00)
  if (minuteOfDay >= m6h00 && minuteOfDay < m21h00) {
    return {
      isBanned: true,
      reason: `Xe tải ${truckPayloadKg >= 10000 ? 'nặng / Container' : `${(truckPayloadKg / 1000).toFixed(1)}T`} bị cấm hoàn toàn trong Vành Đai 3 ban ngày (06h00 - 21h00)`
    };
  }

  return { isBanned: false, reason: null };
};

/**
 * Tính khoảng cách xấp xỉ giữa 2 tọa độ theo công thức Haversine (km)
 */
const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 5;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c * 1.35).toFixed(2)); // Hệ số uốn lượn đường thực tế trung bình 1.35
};

/**
 * Ước tính thời gian xe tải di chuyển (phút) dựa trên cự ly và mật độ giao thông đô thị
 */
const estimateDrivingMinutes = (distKm, isRushHour = false) => {
  const avgSpeedKmh = isRushHour ? 22 : 36;
  return Math.max(10, Math.round((distKm / avgSpeedKmh) * 60));
};

/**
 * Hàm giải bài toán VRPTW với Time Windows, Giờ cấm tải và Nghỉ giữa giờ
 * @param {Object} options
 * @param {Array} options.stops - Danh sách điểm dừng cần tối ưu thứ tự
 * @param {string|Date} options.startTime - Giờ xuất phát (e.g. "07:30" hoặc Date)
 * @param {number} options.truckPayloadKg - Tải trọng xe tải (kg)
 * @param {boolean} options.avoidTruckBan - Có né giờ cấm tải Hà Nội không
 */
const solveVRPTW = ({
  stops = [],
  startTime = '07:30',
  truckPayloadKg = 2500,
  avoidTruckBan = true
}) => {
  if (!Array.isArray(stops) || stops.length <= 1) {
    return {
      optimizedStops: stops,
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      warnings: [],
      restStopsAdded: 0
    };
  }

  // Phân tích mốc giờ bắt đầu
  let currentMinutes = 7 * 60 + 30;
  if (startTime instanceof Date) {
    currentMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  } else if (typeof startTime === 'string' && startTime.includes(':')) {
    const [h, m] = startTime.split(':').map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      currentMinutes = h * 60 + m;
    }
  }

  // Tách điểm xuất phát đầu tiên (thường là Kho ALS Nội Bài hoặc Điểm lấy hàng bắt buộc)
  const pickupStop = stops[0];
  const pendingStops = stops.slice(1).map((s, idx) => {
    let earlyMins = 0;
    let lateMins = 24 * 60;

    // Parse Time Windows nếu có (e.g. receiving_hours: "08:00 - 11:30" hoặc time_window: { early, late })
    if (s.time_window?.early && s.time_window?.late) {
      earlyMins = s.time_window.early;
      lateMins = s.time_window.late;
    } else if (s.receiving_hours && typeof s.receiving_hours === 'string' && s.receiving_hours.includes('-')) {
      const parts = s.receiving_hours.split('-').map(p => p.trim());
      const pEarly = parts[0].match(/(\d{1,2}):(\d{2})/);
      const pLate = parts[1].match(/(\d{1,2}):(\d{2})/);
      if (pEarly) earlyMins = parseInt(pEarly[1], 10) * 60 + parseInt(pEarly[2], 10);
      if (pLate) lateMins = parseInt(pLate[1], 10) * 60 + parseInt(pLate[2], 10);
    }

    return {
      ...s,
      originalIndex: idx + 1,
      earlyMins,
      lateMins,
      lat: Number(s.coords?.lat || s.lat || s.latitude || 21.0285),
      lng: Number(s.coords?.lng || s.lng || s.longitude || 105.8542)
    };
  });

  const orderedStops = [];
  const warnings = [];
  let currentLat = Number(pickupStop.coords?.lat || pickupStop.lat || pickupStop.latitude || 21.2187);
  let currentLng = Number(pickupStop.coords?.lng || pickupStop.lng || pickupStop.longitude || 105.8042);
  let totalDistKm = 0;
  let continuousDrivingMinutes = 0;
  let restStopsCount = 0;

  // Điểm đầu tiên
  orderedStops.push({
    ...pickupStop,
    sequence: 1,
    arrivalMinutes: currentMinutes,
    arrivalTimeStr: formatMinutesToTime(currentMinutes),
    waitingMinutes: 0,
    distanceFromPrevKm: 0,
    banStatus: checkHanoiTruckBan(currentMinutes, truckPayloadKg, currentLat, currentLng)
  });

  // Thuật toán Heuristic chèn theo ràng buộc Time Windows & Giờ cấm tải
  const remaining = [...pendingStops];

  while (remaining.length > 0) {
    let bestScore = Infinity;
    let bestIdx = -1;
    let bestDriveMins = 0;
    let bestDistKm = 0;
    let bestWaitMins = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const dist = haversineDistanceKm(currentLat, currentLng, candidate.lat, candidate.lng);
      
      const isRush = (currentMinutes >= 6 * 60 && currentMinutes <= 9 * 60) || 
                     (currentMinutes >= 16 * 60 + 30 && currentMinutes <= 19 * 60 + 30);
      const driveMins = estimateDrivingMinutes(dist, isRush);
      const arrivalMins = currentMinutes + driveMins;

      // 1. Phạt vi phạm Time Windows
      let waitMins = 0;
      let latePenalty = 0;
      if (arrivalMins < candidate.earlyMins) {
        waitMins = candidate.earlyMins - arrivalMins; // Phải chờ kho mở cửa
      } else if (arrivalMins > candidate.lateMins) {
        latePenalty = (arrivalMins - candidate.lateMins) * 5; // Phạt nặng nếu đến trễ hẹn
      }

      // 2. Phạt vi phạm giờ cấm tải Hà Nội
      let banPenalty = 0;
      if (avoidTruckBan) {
        const banCheck = checkHanoiTruckBan(arrivalMins, truckPayloadKg, candidate.lat, candidate.lng);
        if (banCheck.isBanned) {
          banPenalty = 300; // Phạt rất nặng để ưu tiên đi điểm khác trước hoặc đến sau giờ cấm
        }
      }

      // Hàm mục tiêu: Minimized (Cự ly + Chờ đợi + Phạt trễ + Phạt giờ cấm)
      const score = dist * 1.5 + waitMins * 0.8 + latePenalty + banPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
        bestDriveMins = driveMins;
        bestDistKm = dist;
        bestWaitMins = waitMins;
      }
    }

    if (bestIdx >= 0) {
      const chosen = remaining.splice(bestIdx, 1)[0];

      // BR-03: Kiểm tra nếu lái xe liên tục gần 4 giờ (>= 220 phút), tự động chèn điểm nghỉ ngơi 15 phút
      continuousDrivingMinutes += bestDriveMins;
      if (continuousDrivingMinutes >= 220) {
        currentMinutes += 15;
        continuousDrivingMinutes = 0;
        restStopsCount += 1;
        orderedStops.push({
          type: 'REST',
          name: 'Trạm dừng nghỉ lái xe an toàn (Luật GTĐB - 4h liên tục)',
          address: 'Khu vực dịch vụ / Bãi đỗ xe an toàn dọc lộ trình',
          sequence: orderedStops.length + 1,
          arrivalMinutes: currentMinutes - 15,
          arrivalTimeStr: formatMinutesToTime(currentMinutes - 15),
          departureTimeStr: formatMinutesToTime(currentMinutes),
          durationMinutes: 15,
          coords: { lat: (currentLat + chosen.lat) / 2, lng: (currentLng + chosen.lng) / 2 }
        });
      }

      const arrivalMins = currentMinutes + bestDriveMins;
      currentMinutes = arrivalMins + bestWaitMins + 15; // + 15 phút thời gian dỡ hàng
      totalDistKm += bestDistKm;

      const banCheck = checkHanoiTruckBan(arrivalMins, truckPayloadKg, chosen.lat, chosen.lng);
      if (banCheck.isBanned) {
        warnings.push(`Điểm "${chosen.name || chosen.address}" đến lúc ${formatMinutesToTime(arrivalMins)}: ${banCheck.reason}`);
      }

      if (arrivalMins > chosen.lateMins && chosen.lateMins < 24 * 60) {
        warnings.push(`Điểm "${chosen.name || chosen.address}" dự kiến đến lúc ${formatMinutesToTime(arrivalMins)}, muộn hơn khung giờ nhận hàng quy định (${formatMinutesToTime(chosen.lateMins)})`);
      }

      orderedStops.push({
        ...chosen,
        sequence: orderedStops.length + 1,
        distanceFromPrevKm: bestDistKm,
        drivingDurationMinutes: bestDriveMins,
        arrivalMinutes: arrivalMins,
        arrivalTimeStr: formatMinutesToTime(arrivalMins),
        waitingMinutes: bestWaitMins,
        departureMinutes: currentMinutes,
        departureTimeStr: formatMinutesToTime(currentMinutes),
        banStatus: banCheck
      });

      currentLat = chosen.lat;
      currentLng = chosen.lng;
    }
  }

  return {
    optimizedStops: orderedStops,
    totalDistanceKm: Number(totalDistKm.toFixed(1)),
    totalDurationMinutes: Math.round(currentMinutes - (startTime instanceof Date ? startTime.getHours() * 60 + startTime.getMinutes() : 7 * 60 + 30)),
    warnings,
    restStopsAdded: restStopsCount
  };
};

const formatMinutesToTime = (totalMinutes) => {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(norm / 60)).padStart(2, '0');
  const mm = String(norm % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

module.exports = {
  checkHanoiTruckBan,
  solveVRPTW,
  formatMinutesToTime
};
