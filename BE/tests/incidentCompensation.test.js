const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateCompensationAmount,
  validateCompensationDecision,
  checkIncidentRouteCompliance,
  getNextIncidentStatus
} = require('../utils/incidentCompensationRules');

describe('Module Quản lý Sự cố & Xét duyệt Bồi thường (Role: Manager) - Unit Test Suite', () => {

  describe('1. Business Rule: Tính toán Tiền Bồi thường theo % Thiệt hại & Hợp đồng', () => {
    test('UT-01: Khách hàng giữ lại hàng hỏng -> Bồi thường theo tỷ lệ hư hỏng thực tế', () => {
      const result = calculateCompensationAmount({
        declaredValue: 50000000, // 50M VNĐ
        damagePercentage: 30,    // 30% hư hỏng
        handlingMethod: 'CUSTOMER_RETAIN',
        liabilityCap: 500000000  // Hạn mức HĐ 500M
      });
      // 50M * 30% = 15M VNĐ
      assert.equal(result, 15000000, 'Số tiền bồi thường phải đúng 15.000.000 đ');
    });

    test('UT-02: Công ty thu hồi hàng hỏng về thanh lý -> Bồi thường 100% giá trị khai báo', () => {
      const result = calculateCompensationAmount({
        declaredValue: 80000000, // 80M VNĐ
        damagePercentage: 40,
        handlingMethod: 'COMPANY_RECOVERY', // Thu hồi thanh lý
        liabilityCap: 500000000
      });
      // Thu hồi thanh lý đền 100% = 80M VNĐ
      assert.equal(result, 80000000, 'Số tiền bồi thường phải là 100% giá trị khai báo (80.000.000 đ)');
    });

    test('UT-03: Áp dụng trần Hạn mức Trách nhiệm (Liability Cap) của Hợp đồng khi giá trị vượt hạn mức', () => {
      const result = calculateCompensationAmount({
        declaredValue: 1000000000, // 1 Tỷ VNĐ
        damagePercentage: 100,
        handlingMethod: 'COMPANY_RECOVERY',
        liabilityCap: 500000000   // Hạn mức tối đa theo Điều 8 Hợp đồng = 500M
      });
      // Dù thiệt hại 1 tỷ, số tiền tối đa không được vượt trần 500M
      assert.equal(result, 500000000, 'Số tiền bồi thường phải bị chặn ở trần hạn mức trách nhiệm 500.000.000 đ');
    });

    test('UT-04: Lô hàng giá trị bằng 0 hoặc tỷ lệ hỏng 0% -> Bồi thường = 0', () => {
      const resultZero = calculateCompensationAmount({
        declaredValue: 0,
        damagePercentage: 50,
        liabilityCap: 500000000
      });
      assert.equal(resultZero, 0);

      const resultZeroPct = calculateCompensationAmount({
        declaredValue: 100000000,
        damagePercentage: 0,
        liabilityCap: 500000000
      });
      assert.equal(resultZeroPct, 0);
    });
  });

  describe('2. Validation: Kiểm tra Dữ liệu Đầu vào khi Manager Ra Quyết định', () => {
    test('UT-05: Từ chối bồi thường thiếu lý do -> Ném lỗi bắt buộc', () => {
      assert.throws(
        () => {
          validateCompensationDecision({
            action: 'REJECT',
            rejection_reason: '',
            contract_clause_ref: 'Điều 4.2'
          });
        },
        /Bắt buộc nhập lý do chi tiết/
      );
    });

    test('UT-06: Từ chối bồi thường thiếu viện dẫn điều khoản hợp đồng -> Ném lỗi bắt buộc', () => {
      assert.throws(
        () => {
          validateCompensationDecision({
            action: 'REJECT',
            rejection_reason: 'Hàng đã hỏng từ trước',
            contract_clause_ref: ''
          });
        },
        /Bắt buộc viện dẫn điều khoản hợp đồng/
      );
    });

    test('UT-07: Phê duyệt bồi thường hợp lệ -> Trả về true', () => {
      const isValid = validateCompensationDecision({
        action: 'APPROVE',
        approved_amount: 15000000,
        damage_percentage: 30
      });
      assert.equal(isValid, true);
    });
  });

  describe('3. GPS Route Compliance: Xác thực Hiện trường & Trách nhiệm Lỗi', () => {
    const plannedWaypoints = [
      { lat: 21.2180, lng: 105.8040 },
      { lat: 21.2200, lng: 105.8100 },
      { lat: 21.2300, lng: 105.8200 }
    ];

    test('UT-08: Tọa độ sự cố nằm sát lộ trình (dưới 1km) -> Xác nhận HỢP LỆ TRÊN LỘ TRÌNH', () => {
      const incidentCoord = { lat: 21.2185, lng: 105.8042 }; // Cách điểm 1 khoảng ~0.06km
      const check = checkIncidentRouteCompliance(incidentCoord, plannedWaypoints, 1.0);
      assert.equal(check.isOnRoute, true);
      assert.ok(check.deviationKm < 1.0, 'Độ lệch phải nhỏ hơn 1km');
    });

    test('UT-09: Tọa độ sự cố nằm lệch xa lộ trình (> 1km) -> Cảnh báo LỆCH LỘ TRÌNH (Tài xế vi phạm)', () => {
      const incidentCoord = { lat: 21.3500, lng: 105.9500 }; // Lệch xa hơn 15km
      const check = checkIncidentRouteCompliance(incidentCoord, plannedWaypoints, 1.0);
      assert.equal(check.isOnRoute, false);
      assert.ok(check.deviationKm > 5.0, 'Độ lệch phải lớn hơn 5km');
    });
  });

  describe('4. State Machine: Vòng đời Xử lý Sự cố & Đóng luồng (Close Case)', () => {
    test('UT-10: REPORTED hoặc PENDING_APPROVAL + APPROVE -> Chuyển sang APPROVED', () => {
      const nextStatus = getNextIncidentStatus('PENDING_APPROVAL', 'APPROVE');
      assert.equal(nextStatus, 'APPROVED');
    });

    test('UT-11: REPORTED hoặc PENDING_APPROVAL + REJECT -> Chuyển thẳng sang DONE (Đóng dứt điểm)', () => {
      const nextStatus = getNextIncidentStatus('PENDING_APPROVAL', 'REJECT');
      assert.equal(nextStatus, 'DONE', 'Khi từ chối có căn cứ, hồ sơ tự động đóng DONE');
    });

    test('UT-12: APPROVED + MARK_DONE có kèm ảnh biên lai -> Chuyển sang DONE', () => {
      const nextStatus = getNextIncidentStatus('APPROVED', 'MARK_DONE', {
        payment_proof_url: 'https://example.com/receipt.jpg'
      });
      assert.equal(nextStatus, 'DONE');
    });

    test('UT-13: APPROVED + MARK_DONE thiếu ảnh biên lai chuyển khoản -> Ném lỗi bắt buộc', () => {
      assert.throws(
        () => {
          getNextIncidentStatus('APPROVED', 'MARK_DONE', { payment_proof_url: '' });
        },
        /Bắt buộc cung cấp ảnh biên lai/
      );
    });

    test('UT-14: Sự cố đang ở REPORTED mà đòi MARK_DONE trực tiếp -> Bị từ chối hợp lệ', () => {
      assert.throws(
        () => {
          getNextIncidentStatus('REPORTED', 'MARK_DONE', { payment_proof_url: 'url' });
        },
        /Chỉ có thể đóng sự cố/
      );
    });
  });
});

