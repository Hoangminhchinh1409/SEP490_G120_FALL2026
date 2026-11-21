import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAutoCompensation,
  getEffectiveLiabilityCap,
  validateApprovalDecision,
  validateRejectionDecision,
  validatePaymentRecording,
  validateRequestMoreInfo,
  determineIncidentStatus,
  canPerformAction,
  buildApprovalPayload,
  buildRejectionPayload,
  buildPaymentClosingPayload
} from '../src/utils/incidentCompensationHelper.js';

describe('Unit Test Suite: Màn hình Xử lý Sự cố của Manager (Screen 14)', () => {

  // ==========================================
  // MODULE 1: CompensationCalculationModule
  // ==========================================
  describe('Module 1: CompensationCalculationModule', () => {

    test('UT-CALC-01 [Normal]: Khách hàng giữ hàng hỏng (CUSTOMER_RETAIN) -> Bồi thường theo % hư hỏng thực tế', () => {
      const result = calculateAutoCompensation({
        declaredValue: 120000000,
        damagePercentage: 30,
        handlingMethod: 'CUSTOMER_RETAIN',
        liabilityCap: 200000000
      });
      assert.equal(result, 36000000, 'Số tiền bồi thường phải đúng 36.000.000 đ (120M * 30%)');
    });

    test('UT-CALC-02 [Normal]: Thu hồi hàng về thanh lý (COMPANY_RECOVERY) -> Bồi thường 100% giá trị khai báo', () => {
      const result = calculateAutoCompensation({
        declaredValue: 120000000,
        damagePercentage: 30,
        handlingMethod: 'COMPANY_RECOVERY',
        liabilityCap: 200000000
      });
      assert.equal(result, 120000000, 'Số tiền bồi thường phải là 100% giá trị khai báo (120.000.000 đ)');
    });

    test('UT-CALC-03 [Boundary]: Áp dụng trần Hạn mức Trách nhiệm (Liability Cap) khi số tiền tính ra vượt trần', () => {
      const result = calculateAutoCompensation({
        declaredValue: 500000000,
        damagePercentage: 80, // 400M vượt trần 200M
        handlingMethod: 'CUSTOMER_RETAIN',
        liabilityCap: 200000000
      });
      assert.equal(result, 200000000, 'Số tiền bồi thường phải bị chặn ở mức trần hợp đồng: 200.000.000 đ');
    });

    test('UT-CALC-04 [Boundary]: Xử lý biên dưới - Hàng giá trị 0đ hoặc tỷ lệ hư hỏng 0% -> Bồi thường = 0đ', () => {
      const resZeroVal = calculateAutoCompensation({
        declaredValue: 0,
        damagePercentage: 50,
        liabilityCap: 200000000
      });
      assert.equal(resZeroVal, 0, 'Giá trị khai báo 0đ phải trả về 0đ');

      const resZeroPct = calculateAutoCompensation({
        declaredValue: 100000000,
        damagePercentage: 0,
        liabilityCap: 200000000
      });
      assert.equal(resZeroPct, 0, 'Tỷ lệ hư hỏng 0% phải trả về 0đ');
    });

    test('UT-CALC-05 [Boundary]: Xử lý biên trên - Tỷ lệ hư hỏng 100% toàn bộ lô hàng', () => {
      const result = calculateAutoCompensation({
        declaredValue: 150000000,
        damagePercentage: 100,
        handlingMethod: 'CUSTOMER_RETAIN',
        liabilityCap: 200000000
      });
      assert.equal(result, 150000000, '100% hư hỏng phải nhận trọn vẹn giá trị hàng 150.000.000 đ');
    });

    test('UT-CALC-06 [Normal]: Làm tròn số tiền chuẩn đến hàng trăm nghìn đồng', () => {
      // 85.500.000 * 25% = 21.375.000 đ -> làm tròn thành 21.400.000 đ
      const result = calculateAutoCompensation({
        declaredValue: 85500000,
        damagePercentage: 25,
        handlingMethod: 'CUSTOMER_RETAIN',
        liabilityCap: 200000000
      });
      assert.equal(result, 21400000, 'Số tiền bồi thường phải được làm tròn đến hàng trăm nghìn (21.400.000 đ)');
    });

    test('UT-CAP-01 [Normal]: Đơn hàng có Hợp đồng khung đối tác -> Lấy đúng liability_cap của HĐ', () => {
      const cap = getEffectiveLiabilityCap({
        order: { contract_id: 101 },
        contract: { id: 101, liability_cap: 200000000, contract_number: 'HĐVC-2026/01' }
      });
      assert.equal(cap, 200000000, 'Phải lấy đúng hạn mức 200.000.000 đ từ Hợp đồng khung');
    });

    test('UT-CAP-02 [Normal]: Khách hàng vãng lai không có hợp đồng khung -> Áp dụng trần mặc định 500M', () => {
      const cap = getEffectiveLiabilityCap({
        order: { contract_id: null },
        contract: null
      });
      assert.equal(cap, 500000000, 'Khách vãng lai phải áp dụng hạn mức mặc định 500.000.000 đ');
    });
  });

  // ==========================================
  // MODULE 2: DecisionValidationModule
  // ==========================================
  describe('Module 2: DecisionValidationModule', () => {

    test('UT-VAL-01 [Abnormal]: Phê duyệt thiếu bên chịu trách nhiệm lỗi -> Trả về lỗi bắt buộc', () => {
      const validation = validateApprovalDecision({
        fault: null,
        resolutionNote: 'Đồng ý bồi thường',
        compensationAmount: 36000000
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /xác định bên chịu trách nhiệm lỗi/);
    });

    test('UT-VAL-02 [Abnormal]: Phê duyệt thiếu nhận xét / căn cứ giải quyết -> Trả về lỗi bắt buộc', () => {
      const validation = validateApprovalDecision({
        fault: 'COMPANY',
        resolutionNote: '   ',
        compensationAmount: 36000000
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /nhập nhận xét & căn cứ/);
    });

    test('UT-VAL-03 [Abnormal]: Số tiền bồi thường âm -> Trả về lỗi không thể âm', () => {
      const validation = validateApprovalDecision({
        fault: 'COMPANY',
        resolutionNote: 'Đồng ý bồi thường',
        compensationAmount: -500000
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /không thể âm/);
    });

    test('UT-VAL-04 [Normal]: Phê duyệt đầy đủ dữ liệu hợp lệ -> isValid = true', () => {
      const validation = validateApprovalDecision({
        fault: 'COMPANY',
        resolutionNote: 'Đồng ý bồi thường theo biên bản hiện trường',
        compensationAmount: 36000000
      });
      assert.equal(validation.isValid, true);
      assert.equal(validation.error, undefined);
    });

    test('UT-VAL-05 [Abnormal]: Từ chối bồi thường thiếu lý do -> Trả về lỗi bắt buộc', () => {
      const validation = validateRejectionDecision({
        rejectionReason: '',
        rejectionClause: 'Điều 4.2'
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /nhập lý do từ chối/);
    });

    test('UT-VAL-06 [Abnormal]: Từ chối bồi thường thiếu điều khoản hợp đồng -> Trả về lỗi bắt buộc', () => {
      const validation = validateRejectionDecision({
        rejectionReason: 'Lỗi bao bì chủ hàng',
        rejectionClause: ''
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /viện dẫn điều khoản hợp đồng/);
    });

    test('UT-VAL-07 [Normal]: Từ chối bồi thường có đủ lý do và điều khoản -> isValid = true', () => {
      const validation = validateRejectionDecision({
        rejectionReason: 'Lỗi đóng gói của chủ hàng',
        rejectionClause: 'Điều 4.2 Hợp đồng'
      });
      assert.equal(validation.isValid, true);
    });

    test('UT-VAL-08 [Abnormal]: Chi tiền thiếu mã giao dịch ngân hàng -> Trả về lỗi bắt buộc', () => {
      const validation = validatePaymentRecording({
        transactionCode: '',
        paymentProofUrl: 'https://minio.als.com/receipt.jpg'
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /nhập Mã giao dịch ngân hàng/);
    });

    test('UT-VAL-09 [Abnormal]: Chi tiền thiếu link/ảnh biên lai thanh toán -> Trả về lỗi bắt buộc', () => {
      const validation = validatePaymentRecording({
        transactionCode: 'FT26114123456',
        paymentProofUrl: ''
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /nhập link ảnh hoặc tải biên lai/);
    });

    test('UT-VAL-10 [Normal]: Chi tiền có đủ mã giao dịch và ảnh biên lai -> isValid = true', () => {
      const validation = validatePaymentRecording({
        transactionCode: 'FT26114123456',
        paymentProofUrl: 'https://minio.als.com/receipt.jpg'
      });
      assert.equal(validation.isValid, true);
    });

    test('UT-VAL-11 [Abnormal]: Yêu cầu bổ sung để trống nội dung -> Trả về lỗi bắt buộc', () => {
      const validation = validateRequestMoreInfo({
        requestInfoNote: '   '
      });
      assert.equal(validation.isValid, false);
      assert.match(validation.error, /ghi rõ nội dung hoặc giấy tờ/);
    });

    test('UT-VAL-12 [Normal]: Yêu cầu bổ sung có nội dung tài liệu cụ thể -> isValid = true', () => {
      const validation = validateRequestMoreInfo({
        requestInfoNote: 'Bổ sung ảnh niêm phong chì khi dỡ hàng'
      });
      assert.equal(validation.isValid, true);
    });
  });

  // ==========================================
  // MODULE 3: IncidentLifecycleModule
  // ==========================================
  describe('Module 3: IncidentLifecycleModule', () => {

    test('UT-LIFE-01 [Normal]: Hồ sơ trạng thái PENDING_APPROVAL -> isPending = true, badge cam', () => {
      const status = determineIncidentStatus({
        status: 'PENDING_APPROVAL',
        approved_compensation_amount: 0
      });
      assert.equal(status.isPending, true);
      assert.equal(status.isApproved, false);
      assert.equal(status.isDone, false);
      assert.equal(status.badge.color, 'orange');
    });

    test('UT-LIFE-02 [Normal]: Hồ sơ trạng thái APPROVED -> isApproved = true, badge cyan', () => {
      const status = determineIncidentStatus({
        status: 'APPROVED',
        approved_compensation_amount: 36000000
      });
      assert.equal(status.isApproved, true);
      assert.equal(status.isPending, false);
      assert.equal(status.isDone, false);
      assert.equal(status.badge.color, 'cyan');
    });

    test('UT-LIFE-03 [Normal]: Hồ sơ trạng thái REJECTED -> isRejected = true, isDone = true, badge red', () => {
      const status = determineIncidentStatus({
        status: 'REJECTED',
        rejection_reason: 'Lỗi đóng gói'
      });
      assert.equal(status.isRejected, true);
      assert.equal(status.isDone, true);
      assert.equal(status.badge.color, 'red');
    });

    test('UT-LIFE-04 [Normal]: Hồ sơ trạng thái DONE sau chi trả -> isPaymentClosed = true, isDone = true, badge green', () => {
      const status = determineIncidentStatus({
        status: 'DONE',
        payment_proof_url: 'https://minio.als.com/receipt.jpg'
      });
      assert.equal(status.isPaymentClosed, true);
      assert.equal(status.isDone, true);
      assert.equal(status.badge.color, 'green');
    });

    test('UT-LIFE-05 [Abnormal]: Chế độ chỉ đọc isReadOnly = true -> Khóa mọi thao tác quyết định', () => {
      const canApprove = canPerformAction({
        currentStatus: 'PENDING_APPROVAL',
        action: 'APPROVE',
        isReadOnly: true
      });
      assert.equal(canApprove, false, 'Khi isReadOnly = true phải chặn mọi thao tác');
    });

    test('UT-LIFE-06 [Normal]: Hồ sơ PENDING_APPROVAL -> Cho phép APPROVE, REJECT, REQUEST_MORE_INFO', () => {
      assert.equal(canPerformAction({ currentStatus: 'PENDING_APPROVAL', action: 'APPROVE' }), true);
      assert.equal(canPerformAction({ currentStatus: 'PENDING_APPROVAL', action: 'REJECT' }), true);
      assert.equal(canPerformAction({ currentStatus: 'PENDING_APPROVAL', action: 'REQUEST_MORE_INFO' }), true);
    });

    test('UT-LIFE-07 [Abnormal]: Hồ sơ PENDING_APPROVAL đòi chi tiền (RECORD_PAYMENT) -> Bị từ chối', () => {
      const canPay = canPerformAction({
        currentStatus: 'PENDING_APPROVAL',
        action: 'RECORD_PAYMENT'
      });
      assert.equal(canPay, false, 'Chưa phê duyệt không được phép chi tiền');
    });

    test('UT-LIFE-08 [Normal]: Hồ sơ APPROVED -> Cho phép chi tiền (RECORD_PAYMENT)', () => {
      const canPay = canPerformAction({
        currentStatus: 'APPROVED',
        action: 'RECORD_PAYMENT'
      });
      assert.equal(canPay, true, 'Đã phê duyệt thì được phép chi tiền');
    });

    test('UT-LIFE-09 [Abnormal]: Hồ sơ đã DONE -> Khóa mọi hành vi thay đổi quyết định', () => {
      const canModify = canPerformAction({
        currentStatus: 'DONE',
        action: 'APPROVE'
      });
      assert.equal(canModify, false, 'Hồ sơ đã DONE không được phép sửa đổi');
    });
  });

  // ==========================================
  // MODULE 4: DecisionPayloadBuilderModule
  // ==========================================
  describe('Module 4: DecisionPayloadBuilderModule', () => {

    test('UT-PAYLOAD-01 [Normal]: buildApprovalPayload đóng gói chính xác dữ liệu phê duyệt', () => {
      const payload = buildApprovalPayload({
        fault: 'COMPANY',
        compensationAmount: 36000000,
        damagePercentage: 30,
        goodsHandlingMethod: 'CUSTOMER_RETAIN',
        contractClauseRef: 'Điều 8.2',
        surveyOrgReport: 'BB-2026-118',
        resolutionNote: '   Đồng ý bồi thường   '
      });
      assert.deepEqual(payload, {
        action: 'APPROVE',
        fault: 'COMPANY',
        approved_amount: 36000000,
        damage_percentage: 30,
        goods_handling_method: 'CUSTOMER_RETAIN',
        contract_clause_ref: 'Điều 8.2',
        survey_org_report: 'BB-2026-118',
        resolution_note: 'Đồng ý bồi thường'
      });
    });

    test('UT-PAYLOAD-02 [Normal]: buildRejectionPayload đóng gói chính xác dữ liệu từ chối', () => {
      const payload = buildRejectionPayload({
        rejectionReason: 'Lỗi đóng gói của chủ hàng',
        rejectionClause: 'Điều 4.2',
        contactHotline: '1900 1234'
      });
      assert.equal(payload.action, 'REJECT');
      assert.equal(payload.fault, 'CUSTOMER');
      assert.equal(payload.rejection_reason, 'Lỗi đóng gói của chủ hàng');
      assert.equal(payload.contract_clause_ref, 'Điều 4.2');
      assert.match(payload.resolution_note, /Từ chối bồi thường theo Điều 4.2/);
    });

    test('UT-PAYLOAD-03 [Normal]: buildPaymentClosingPayload đóng gói chính xác dữ liệu chi tiền', () => {
      const payload = buildPaymentClosingPayload({
        paymentDate: '2026-11-16',
        transactionCode: 'FT26114123456',
        paymentProofUrl: 'https://minio.als.com/receipt.jpg'
      });
      assert.equal(payload.payment_proof_url, 'https://minio.als.com/receipt.jpg');
      assert.match(payload.close_note, /FT26114123456/);
      assert.match(payload.close_note, /2026-11-16/);
    });
  });
});
