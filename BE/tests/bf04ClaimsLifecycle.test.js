const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../config/prisma');
const claimService = require('../services/claimService');
const incidentService = require('../services/incidentService');
const incidentModel = require('../models/incidentModel');
const incidentController = require('../controllers/incidentController');
const driverModel = require('../models/driverModel');
const {
  runJob01_RetentionWithClaimHold,
  runJob08_AutoClosePaidClaims
} = require('../jobs/managerJobs');
const queueAdapter = require('../jobs/queueAdapter');

describe('BF-04 Incident & Compensation Claims Lifecycle', () => {
  const createdClaimIds = [];
  const createdIncidentIds = [];
  let managerId = null;
  let dispatcherId = null;
  let sampleOrder = null;
  let deliveredOrder = null;
  let nonDeliveredOrder = null;
  let sampleTrip = null;

  before(async () => {
    const [manager, dispatcher, anyOrder, delivOrder, draftOrTransit, anyTrip] = await Promise.all([
      prisma.users.findFirst({ where: { role_id: 2n }, select: { id: true } }),
      prisma.users.findFirst({ where: { role_id: 3n }, select: { id: true } }),
      prisma.orders.findFirst({ orderBy: { id: 'desc' }, select: { id: true, order_code: true, tracking_token: true } }),
      prisma.orders.findFirst({
        where: { status: { in: ['Delivered', 'DELIVERED', 'Completed', 'COMPLETED'] } },
        orderBy: { id: 'desc' },
        select: { id: true, order_code: true, tracking_token: true, status: true, is_closed: true, updated_at: true, created_at: true }
      }),
      prisma.orders.findFirst({
        where: { status: { in: ['Draft', 'DRAFT', 'In Transit', 'IN_TRANSIT'] } },
        select: { id: true, order_code: true, tracking_token: true }
      }),
      prisma.trips.findFirst({ orderBy: { id: 'desc' }, select: { id: true, trip_code: true } })
    ]);

    assert.ok(manager, 'Seed Manager user must exist');
    assert.ok(dispatcher, 'Seed Dispatcher user must exist');
    assert.ok(anyOrder, 'Seed Order must exist');

    managerId = Number(manager.id);
    dispatcherId = Number(dispatcher.id);
    sampleOrder = anyOrder;
    deliveredOrder = delivOrder;
    nonDeliveredOrder = draftOrTransit;
    sampleTrip = anyTrip;
  });

  after(async () => {
    try {
      if (createdClaimIds.length > 0) {
        const bigIds = createdClaimIds.map((id) => BigInt(id));
        await prisma.notifications.deleteMany({
          where: { target_type: 'COMPENSATION_CLAIM', target_id: { in: bigIds } }
        });
        await prisma.activity_logs.deleteMany({
          where: { target_type: 'COMPENSATION_CLAIM', target_id: { in: bigIds } }
        });
        await prisma.compensation_claims.deleteMany({
          where: { id: { in: bigIds } }
        });
      }
      if (createdIncidentIds.length > 0) {
        const bigIncIds = createdIncidentIds.map((id) => BigInt(id));
        await prisma.notifications.deleteMany({
          where: { target_type: 'INCIDENT', target_id: { in: bigIncIds } }
        });
        await prisma.activity_logs.deleteMany({
          where: { target_type: 'INCIDENT', target_id: { in: bigIncIds } }
        });
        await prisma.incidents.deleteMany({
          where: { id: { in: bigIncIds } }
        });
      }
    } finally {
      if (queueAdapter?.gpsFlushTimer) {
        clearInterval(queueAdapter.gpsFlushTimer);
      }
      await prisma.$disconnect();
    }
  });

  it('1. Reject path: PENDING -> REJECTED -> Dispatcher call -> CLOSED_REJECTED', async () => {
    const created = await claimService.createDispatcherClaim({
      order_id: Number(sampleOrder.id),
      claim_type: 'Damage',
      amount: 1000000,
      reason: '[UNIT_TEST] Reject flow'
    }, dispatcherId);
    createdClaimIds.push(created.id);
    assert.equal(created.status, 'PENDING');

    const decided = await claimService.decideClaim(created.id, {
      action: 'REJECT',
      rejection_reason: 'Bao bì không đạt chuẩn theo hợp đồng',
      contract_clause_ref: 'Điều 4.2',
      assessment_result: 'Lỗi đóng gói'
    }, managerId);
    assert.equal(decided.claim.status, 'REJECTED');
    assert.equal(decided.claim.closed_at, null);

    const afterCall = await claimService.recordDispatcherCall(created.id, {
      call_contact_phone: '0901112222',
      call_note: 'Đã gọi giải thích lý do từ chối'
    }, dispatcherId);
    assert.equal(afterCall.status, 'CLOSED_REJECTED');
    assert.equal(afterCall.close_method, 'REJECTED_AFTER_CALL');
    assert.ok(afterCall.called_at);
    assert.ok(afterCall.closed_at);
  });

  it('2. Approve + Payment + Guest Confirm path: blocks payment before call & duplicate actions', async () => {
    const created = await claimService.createDispatcherClaim({
      order_id: Number(sampleOrder.id),
      claim_type: 'Shortage',
      amount: 2500000,
      reason: '[UNIT_TEST] Approve & Guest Confirm flow'
    }, dispatcherId);
    createdClaimIds.push(created.id);

    const decided = await claimService.decideClaim(created.id, {
      action: 'APPROVE',
      approved_amount: 2000000,
      outcome: 'CUSTOMER_RETAIN',
      damage_percentage: 20,
      assessment_result: 'Thiếu 2 kiện hàng'
    }, managerId);
    assert.equal(decided.claim.status, 'APPROVED');
    assert.equal(decided.claim.approved_amount, 2000000);
    assert.equal(decided.claim.called_at, null);

    await assert.rejects(
      () => claimService.recordManagerPayment(created.id, {
        payment_date: '2026-11-25',
        transaction_code: 'FT-BLOCK-CHECK',
        payment_proof_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
      }, managerId),
      (err) => err.statusCode === 400
    );

    const afterCall = await claimService.recordDispatcherCall(created.id, {
      call_contact_phone: '0903334444',
      call_note: 'Đã gọi thống nhất STK'
    }, dispatcherId);
    assert.equal(afterCall.status, 'APPROVED');
    assert.ok(afterCall.called_at);

    await assert.rejects(
      () => claimService.recordDispatcherCall(created.id, { call_note: 'Duplicate' }, dispatcherId),
      (err) => err.statusCode === 400
    );

    const paidRes = await claimService.recordManagerPayment(created.id, {
      payment_date: '2026-11-25',
      transaction_code: 'FT-UNIT-001',
      payment_proof_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      payment_note: 'Chuyển khoản đủ'
    }, managerId);
    assert.equal(paidRes.claim.status, 'PAID');
    assert.ok(paidRes.claim.paid_at);
    assert.ok(paidRes.claim.auto_close_deadline);

    const confirmed = await claimService.confirmCustomerMoneyReceived(sampleOrder.tracking_token.trim(), {
      claim_id: created.id
    });
    assert.equal(confirmed.status, 'CLOSED_COMPENSATED');
    assert.equal(confirmed.close_method, 'CUSTOMER_CONFIRMED');
    assert.ok(confirmed.customer_confirmed_at);
    assert.ok(confirmed.closed_at);

    await assert.rejects(
      () => claimService.confirmCustomerMoneyReceived(sampleOrder.tracking_token.trim(), { claim_id: created.id }),
      (err) => err.statusCode === 400
    );
  });

  it('3. JOB-08 Auto-close after 7 days without customer response', async () => {
    const created = await claimService.createDispatcherClaim({
      order_id: Number(sampleOrder.id),
      claim_type: 'Loss',
      amount: 1500000,
      reason: '[UNIT_TEST] Auto close 7 days'
    }, dispatcherId);
    createdClaimIds.push(created.id);

    await claimService.decideClaim(created.id, {
      action: 'APPROVE',
      approved_amount: 1500000,
      outcome: 'CUSTOMER_RETAIN'
    }, managerId);
    await claimService.recordDispatcherCall(created.id, {
      call_note: 'Đã gọi thông báo chuyển khoản'
    }, dispatcherId);
    await claimService.recordManagerPayment(created.id, {
      payment_date: '2026-11-10',
      transaction_code: 'FT-AUTOCLOSE-001',
      payment_proof_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
    }, managerId);

    const eightDaysAgo = new Date(Date.now() - 8 * 86400000);
    await prisma.compensation_claims.update({
      where: { id: BigInt(created.id) },
      data: { paid_at: eightDaysAgo }
    });

    const jobRes = await runJob08_AutoClosePaidClaims();
    assert.ok(jobRes.closedClaimIds.includes(created.id));

    const reloaded = await claimService.getClaimById(created.id);
    assert.equal(reloaded.status, 'CLOSED_COMPENSATED');
    assert.equal(reloaded.close_method, 'AUTO_7_DAYS');
    assert.equal(reloaded.customer_confirmed_at, null);
    assert.ok(reloaded.closed_at);
  });

  it('4. JOB-01 Keep Trip Data protects orders with open claims', async () => {
    const openClaim = await claimService.createDispatcherClaim({
      order_id: Number(sampleOrder.id),
      claim_type: 'Damage',
      amount: 500000,
      reason: '[UNIT_TEST] Retention protection check'
    }, dispatcherId);
    createdClaimIds.push(openClaim.id);

    const protectedRefs = await claimService.getProtectedClaimOrderAndTripIds();
    assert.ok(protectedRefs.protectedOrderIds.includes(Number(sampleOrder.id)));

    const dryRunRes = await runJob01_RetentionWithClaimHold({ dryRun: true });
    assert.equal(dryRunRes.dryRun, true);
    assert.ok(dryRunRes.protectedOrderCount >= 1);
  });

  it('5. Guest Claim submission enforces Delivered + 14-day window (BR-59)', async () => {
    if (nonDeliveredOrder) {
      await assert.rejects(
        () => claimService.createGuestClaimByToken(nonDeliveredOrder.tracking_token.trim(), {
          claim_type: 'Damage',
          reason: '[UNIT_TEST] Non-delivered guard'
        }),
        (err) => err.statusCode === 400
      );
    }

    if (deliveredOrder) {
      const tracking = await claimService.getOrderClaimsForTracking(deliveredOrder);
      if (tracking.can_submit_claim) {
        const guestClaim = await claimService.createGuestClaimByToken(deliveredOrder.tracking_token.trim(), {
          claim_type: 'Damage',
          amount: 800000,
          reason: '[UNIT_TEST] Valid guest claim within 14 days',
          submitted_by_name: 'Unit Test Guest',
          submitted_by_phone: '0909998888'
        });
        createdClaimIds.push(guestClaim.id);
        assert.equal(guestClaim.status, 'PENDING');
        assert.equal(guestClaim.source, 'CUSTOMER_CLAIM');
      }
    }
  });

  it('6. WF4 Guards: reject 0/empty approval, enforce liability_cap (MSG56), reject unknown replacement truck/driver', async () => {
    // 6a. Reject approval with 0 or omitted approved_amount (BUG-SYS-33 / TC_IC_07-11)
    const claimZero = await claimService.createDispatcherClaim({
      order_id: Number(sampleOrder.id),
      claim_type: 'Damage',
      amount: 1000000,
      reason: '[UNIT_TEST] Zero/empty amount guard'
    }, dispatcherId);
    createdClaimIds.push(claimZero.id);

    await assert.rejects(
      () => claimService.decideClaim(claimZero.id, { action: 'APPROVE', approved_amount: 0 }, managerId),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => claimService.decideClaim(claimZero.id, { action: 'APPROVE' }, managerId),
      (err) => err.statusCode === 400
    );

    // 6b. Enforce liability_cap Option B: > cap without comment -> 400; with comment -> 200 (BUG-SYS-32 / TC_IC_07-10)
    await assert.rejects(
      () => claimService.decideClaim(claimZero.id, {
        action: 'APPROVE',
        approved_amount: 900000000
      }, managerId),
      (err) => err.statusCode === 400
    );

    const overrideRes = await claimService.decideClaim(claimZero.id, {
      action: 'APPROVE',
      approved_amount: 900000000,
      comment: 'Phê duyệt ngoại lệ theo chỉ đạo BGĐ'
    }, managerId);
    assert.equal(overrideRes.claim.status, 'APPROVED');
    assert.equal(overrideRes.claim.approved_amount, 900000000);

    // 6c. Incident controller decideIncidentCompensation rejects 0 amount (BUG-SYS-33)
    const mockRes = () => {
      const state = { statusCode: 200, body: null };
      return {
        status(code) { state.statusCode = code; return this; },
        json(payload) { state.body = payload; return state; },
        _state: state
      };
    };
    const resZero = mockRes();
    await incidentController.decideIncidentCompensation(
      { params: { id: '1' }, body: { action: 'APPROVE', approved_amount: 0 }, user: { id: managerId } },
      resZero
    );
    assert.equal(resZero._state.statusCode, 400);

    // 6d. Incident replacement rejects non-existent plate & driver (BUG-SYS-21 / TC_IC_01-07, TC_IC_01-08)
    // and incidentService persists resolved_by, type, cargo_affected (BUG-SYS-22, 23, 25)
    if (sampleTrip) {
      const inc = await incidentService.createIncident({
        trip_id: Number(sampleTrip.id),
        type: 'BREAKDOWN',
        description: '[UNIT_TEST] Incident guards'
      }, dispatcherId);
      createdIncidentIds.push(inc.raw_id);

      await assert.rejects(
        () => incidentModel.dispatchReplacementWithTransaction({
          incidentId: inc.raw_id,
          newTruckPlate: '29H-767.99-FAKE',
          newDriverName: 'Non Existent Driver',
          userId: dispatcherId
        }),
        (err) => err.statusCode === 404 || err.statusCode === 400
      );

      // Reclassify to CARGO_DAMAGED and escalate with cargo_affected = false (BUG-SYS-22, 23, 25)
      const escalated = await incidentService.updateIncidentStatus(inc.raw_id, {
        status: 'ESCALATED',
        type: 'CARGO_DAMAGED',
        cargo_affected: false,
        escalation_reason: '[UNIT_TEST] Reclassified & escalated'
      }, dispatcherId);
      assert.equal(escalated.raw_type, 'CARGO_DAMAGED');
      assert.equal(escalated.cargo_affected, false);
      assert.equal(escalated.escalated_by, dispatcherId);

      // Reclassify to Other and resolve -> resolved_by persisted (BUG-SYS-22, 23)
      const resolved = await incidentService.updateIncidentStatus(inc.raw_id, {
        status: 'RESOLVED',
        type: 'Other',
        resolution_note: '[UNIT_TEST] Resolved at scene'
      }, dispatcherId);
      assert.equal(resolved.raw_type, 'Other');
      assert.equal(resolved.resolved_by, dispatcherId);
    }
  });

  it('7. Audit regression checks: GPS persistence, INCIDENT_SAFE_SELECT, no evidence leak, BigInt log fix, ID/state guards', async () => {
    const mockRes = () => {
      const state = { statusCode: 200, body: null };
      return {
        status(code) { state.statusCode = code; return this; },
        json(payload) { state.body = payload; return state; },
        _state: state
      };
    };

    // 7a. Invalid numeric ID & invalid action -> 400; non-existent ID -> 404
    const resBadId = mockRes();
    await incidentController.getIncidentById({ params: { id: 'abc' } }, resBadId);
    assert.equal(resBadId._state.statusCode, 400);

    const resBadAction = mockRes();
    await incidentController.decideIncidentCompensation(
      { params: { id: '1' }, body: { action: 'INVALID_ACTION' }, user: { id: managerId } },
      resBadAction
    );
    assert.equal(resBadAction._state.statusCode, 400);

    const resMissing = mockRes();
    await incidentController.decideIncidentCompensation(
      { params: { id: '999999999' }, body: { action: 'APPROVE', approved_amount: 500000 }, user: { id: managerId } },
      resMissing
    );
    assert.equal(resMissing._state.statusCode, 404);

    if (!sampleTrip) return;

    // 7b. driverModel.createIncident persists incident_lat & incident_lng
    const drvInc = await driverModel.createIncident({
      tripId: Number(sampleTrip.id),
      reportedBy: null,
      type: 'CARGO_DAMAGED',
      description: '[UNIT_TEST] Audit GPS persistence check',
      photos: ['https://res.cloudinary.com/demo/image/upload/damage.jpg'],
      incidentLat: 21.221155,
      incidentLng: 105.806712
    });
    createdIncidentIds.push(drvInc.id);
    assert.equal(Number(drvInc.incident_lat).toFixed(6), '21.221155');
    assert.equal(Number(drvInc.incident_lng).toFixed(6), '105.806712');

    const loadedModelInc = await incidentModel.findById(drvInc.id);
    assert.equal(Number(loadedModelInc.incident_lat).toFixed(6), '21.221155');
    assert.equal(Number(loadedModelInc.incident_lng).toFixed(6), '105.806712');

    // Escalate incident so it appears in manager major-incident queries
    await incidentService.updateIncidentStatus(drvInc.id, {
      status: 'ESCALATED',
      cargo_affected: true,
      escalation_reason: '[UNIT_TEST] Escalate audit check'
    }, dispatcherId);

    // 7c. Create claim with damage evidence photo -> verify it does NOT leak as payment_proof_url
    const tripStopWithOrder = await prisma.trip_stops.findFirst({
      where: { trip_id: BigInt(sampleTrip.id), order_id: { not: null } },
      select: { order_id: true }
    });
    const orderIdForTrip = tripStopWithOrder?.order_id ? Number(tripStopWithOrder.order_id) : Number(sampleOrder.id);
    const dmgClaim = await claimService.createDispatcherClaim({
      incident_id: drvInc.id,
      order_id: orderIdForTrip,
      claim_type: 'Damage',
      amount: 1200000,
      reason: '[UNIT_TEST] Check evidence vs payment_proof_url',
      evidence_photos: ['https://res.cloudinary.com/demo/image/upload/damage-evidence-only.jpg']
    }, dispatcherId);
    createdClaimIds.push(dmgClaim.id);

    const resBeforePay = mockRes();
    await incidentController.getIncidentById({ params: { id: String(drvInc.id) } }, resBeforePay);
    assert.equal(resBeforePay._state.statusCode, 200);
    assert.equal(resBeforePay._state.body.incident.payment_proof_url, null);
    assert.equal(resBeforePay._state.body.incident.status, 'ESCALATED');

    // 7d. sendIncidentDecisionEmail must NOT mutate ESCALATED status into APPROVED/REJECTED
    const resEmailOnly = mockRes();
    await incidentController.sendIncidentDecisionEmail(
      {
        params: { id: String(drvInc.id) },
        body: { email_type: 'APPROVAL', customer_email: 'audit-test@example.com', approved_amount: 1000000 },
        user: { id: managerId }
      },
      resEmailOnly
    );
    const resAfterEmailOnly = mockRes();
    await incidentController.getIncidentById({ params: { id: String(drvInc.id) } }, resAfterEmailOnly);
    assert.equal(resAfterEmailOnly._state.statusCode, 200);
    assert.equal(resAfterEmailOnly._state.body.incident.status, 'ESCALATED');

    // 7e. closeIncidentCase must block when incident is not APPROVED (400)
    const resCloseNotApproved = mockRes();
    await incidentController.closeIncidentCase(
      {
        params: { id: String(drvInc.id) },
        body: { transaction_code: 'FT-EARLY', payment_proof_url: 'https://res.cloudinary.com/demo/image/upload/receipt.jpg' },
        user: { id: managerId }
      },
      resCloseNotApproved
    );
    assert.equal(resCloseNotApproved._state.statusCode, 400);

    // 7f. decideIncidentCompensation APPROVE -> writes activity_logs without BigInt crash, returns SAFE_SELECT fields, blocks re-decide (400)
    const resApprove = mockRes();
    await incidentController.decideIncidentCompensation(
      {
        params: { id: String(drvInc.id) },
        body: {
          action: 'APPROVE',
          fault: 'COMPANY',
          approved_amount: 1000000,
          damage_percentage: 25,
          goods_handling_method: 'CUSTOMER_RETAIN',
          contract_clause_ref: 'Điều 8.2 - Audit Test',
          resolution_note: '[UNIT_TEST] Approved with audit checks'
        },
        user: { id: managerId }
      },
      resApprove
    );
    assert.equal(resApprove._state.statusCode, 200);

    const approveLogs = await prisma.activity_logs.findMany({
      where: {
        target_type: 'INCIDENT',
        target_id: BigInt(drvInc.id),
        action: 'APPROVE_INCIDENT_COMPENSATION'
      }
    });
    assert.equal(approveLogs.length, 1);

    const resAfterApprove = mockRes();
    await incidentController.getIncidentById({ params: { id: String(drvInc.id) } }, resAfterApprove);
    assert.equal(resAfterApprove._state.statusCode, 200);
    assert.equal(resAfterApprove._state.body.incident.status, 'APPROVED');
    assert.equal(resAfterApprove._state.body.incident.damage_percentage, 25);
    assert.equal(resAfterApprove._state.body.incident.goods_handling_method, 'CUSTOMER_RETAIN');
    assert.equal(resAfterApprove._state.body.incident.contract_clause_ref, 'Điều 8.2 - Audit Test');
    assert.equal(Number(resAfterApprove._state.body.incident.approved_compensation_amount), 1000000);
    assert.equal(resAfterApprove._state.body.incident.payment_proof_url, null);

    // Re-deciding finalized incident must be rejected (400)
    const resReDecide = mockRes();
    await incidentController.decideIncidentCompensation(
      {
        params: { id: String(drvInc.id) },
        body: { action: 'REJECT', rejection_reason: 'Late reject', contract_clause_ref: 'Điều 4.2' },
        user: { id: managerId }
      },
      resReDecide
    );
    assert.equal(resReDecide._state.statusCode, 400);

    // closeIncidentCase before Dispatcher call must be rejected (400)
    const resCloseNoCall = mockRes();
    await incidentController.closeIncidentCase(
      {
        params: { id: String(drvInc.id) },
        body: { transaction_code: 'FT-NOCALL', payment_proof_url: 'https://res.cloudinary.com/demo/image/upload/receipt.jpg' },
        user: { id: managerId }
      },
      resCloseNoCall
    );
    assert.equal(resCloseNoCall._state.statusCode, 400);
  });
});
