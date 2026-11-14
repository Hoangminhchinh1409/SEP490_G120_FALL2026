/**
 * Business Rules & Helpers for Incident Compensation (Role: Manager)
 * Module: Quản lý Sự cố & Xét duyệt Bồi thường
 */

/**
 * 1. Tính toán số tiền bồi thường gợi ý dựa trên Business Rule & Hợp đồng
 * @param {Object} params
 * @param {number} params.declaredValue - Giá trị khai báo của lô hàng
 * @param {number} params.damagePercentage - Tỷ lệ hư hỏng (0 - 100)
 * @param {'CUSTOMER_RETAIN'|'COMPANY_RECOVERY'} params.handlingMethod - Phương án xử lý hàng hỏng
 * @param {number} params.liabilityCap - Hạn mức trách nhiệm tối đa theo Hợp đồng
 * @returns {number} Số tiền bồi thường (VNĐ)
 */
function calculateCompensationAmount({ declaredValue = 0, damagePercentage = 0, handlingMethod = 'CUSTOMER_RETAIN', liabilityCap = 500000000 }) {
  const decVal = Number(declaredValue) || 0;
  const pct = Math.max(0, Math.min(100, Number(damagePercentage) || 0));
  const cap = Number(liabilityCap) || 500000000;

  if (decVal <= 0) return 0;

  let calculatedAmount = 0;
  if (handlingMethod === 'COMPANY_RECOVERY') {
    // Thu hồi hàng về thanh lý -> Đền bù 100% giá trị khai báo
    calculatedAmount = decVal;
  } else {
    // Khách giữ hàng hỏng -> Đền bù theo tỷ lệ hư hỏng thực tế
    calculatedAmount = Math.round((decVal * (pct / 100)) / 100000) * 100000;
  }

  // Luôn áp dụng trần hạn mức trách nhiệm (Liability Cap) của Hợp đồng vận tải
  return Math.min(calculatedAmount, cap);
}

/**
 * 2. Validate dữ liệu khi Manager đưa ra quyết định
 * @param {Object} payload
 */
function validateCompensationDecision(payload) {
  const action = (payload.action || '').toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(action)) {
    throw new Error('Hành động không hợp lệ (Chỉ chấp nhận APPROVE hoặc REJECT).');
  }

  if (action === 'REJECT') {
    if (!payload.rejection_reason || !payload.rejection_reason.trim()) {
      throw new Error('Bắt buộc nhập lý do chi tiết khi từ chối bồi thường.');
    }
    if (!payload.contract_clause_ref || !payload.contract_clause_ref.trim()) {
      throw new Error('Bắt buộc viện dẫn điều khoản hợp đồng áp dụng khi từ chối bồi thường.');
    }
  }

  if (action === 'APPROVE') {
    if (payload.approved_amount !== undefined && Number(payload.approved_amount) < 0) {
      throw new Error('Số tiền bồi thường phê duyệt không thể âm.');
    }
  }

  return true;
}

/**
 * 3. Kiểm tra tọa độ GPS hiện trường so với lộ trình được giao (Haversine Formula)
 * @param {{ lat: number, lng: number }} incidentCoord
 * @param {Array<{ lat: number, lng: number }>} plannedWaypoints
 * @param {number} thresholdKm - Ngưỡng sai số cho phép (mặc định 1.0 km)
 */
function checkIncidentRouteCompliance(incidentCoord, plannedWaypoints = [], thresholdKm = 1.0) {
  if (!incidentCoord || typeof incidentCoord.lat !== 'number' || typeof incidentCoord.lng !== 'number') {
    return {
      isOnRoute: true,
      deviationKm: 0,
      statusText: 'KHÔNG CÓ TỌA ĐỘ GPS'
    };
  }

  if (!plannedWaypoints || plannedWaypoints.length === 0) {
    return {
      isOnRoute: true,
      deviationKm: 0,
      statusText: 'KHỚP LỘ TRÌNH (MẶC ĐỊNH)'
    };
  }

  const toRad = (x) => (x * Math.PI) / 180;
  let minDistance = Infinity;

  for (const pt of plannedWaypoints) {
    const R = 6371; // Bán kính trái đất (km)
    const dLat = toRad(pt.lat - incidentCoord.lat);
    const dLon = toRad(pt.lng - incidentCoord.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(incidentCoord.lat)) * Math.cos(toRad(pt.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  const deviationKm = Number(minDistance.toFixed(2));
  const isOnRoute = deviationKm <= thresholdKm;

  return {
    isOnRoute,
    deviationKm,
    statusText: isOnRoute ? 'KHỚP LỘ TRÌNH QUY ĐỊNH' : `LỆCH LỘ TRÌNH (${deviationKm} km)`
  };
}

/**
 * 4. State Machine Transition Validator
 * @param {string} currentStatus
 * @param {'APPROVE'|'REJECT'|'MARK_DONE'} action
 * @param {Object} options
 */
function getNextIncidentStatus(currentStatus, action, options = {}) {
  const normCurrent = (currentStatus || '').toUpperCase();
  const act = (action || '').toUpperCase();

  if (act === 'APPROVE') {
    if (!['REPORTED', 'PENDING_APPROVAL', 'ESCALATED', 'ESCALATED_TO_MANAGER'].includes(normCurrent)) {
      throw new Error(`Không thể phê duyệt sự cố đang ở trạng thái ${normCurrent}.`);
    }
    return 'APPROVED';
  }

  if (act === 'REJECT') {
    if (!['REPORTED', 'PENDING_APPROVAL', 'ESCALATED', 'ESCALATED_TO_MANAGER'].includes(normCurrent)) {
      throw new Error(`Không thể từ chối sự cố đang ở trạng thái ${normCurrent}.`);
    }
    // Từ chối đơn phương có căn cứ hợp đồng -> chuyển dứt điểm sang DONE
    return 'DONE';
  }

  if (act === 'MARK_DONE') {
    if (normCurrent !== 'APPROVED') {
      throw new Error('Chỉ có thể đóng sự cố (Mark as Done) sau khi đã ở trạng thái APPROVED.');
    }
    if (!options.payment_proof_url || !options.payment_proof_url.trim()) {
      throw new Error('Bắt buộc cung cấp ảnh biên lai / chứng từ chuyển khoản để đóng hồ sơ.');
    }
    return 'DONE';
  }

  throw new Error(`Hành động ${act} không được hỗ trợ trong State Machine.`);
}

module.exports = {
  calculateCompensationAmount,
  validateCompensationDecision,
  checkIncidentRouteCompliance,
  getNextIncidentStatus
};

