const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../config/prisma');
const claimService = require('../services/claimService');
const {
  runJob01_RetentionWithClaimHold,
  runJob08_AutoClosePaidClaims
} = require('../jobs/managerJobs');
const queueAdapter = require('../jobs/queueAdapter');

describe('BF-04 Incident & Compensation Claims Lifecycle', () => {
  const createdClaimIds = [];
  let managerId = null;
  let dispatcherId = null;
  let sampleOrder = null;
  let deliveredOrder = null;
  let nonDeliveredOrder = null;

  before(async () => {
    const [manager, dispatcher, anyOrder, delivOrder, draftOrTransit] = await Promise.all([
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
      })
    ]);

    assert.ok(manager, 'Seed Manager user must exist');
    assert.ok(dispatcher, 'Seed Dispatcher user must exist');
    assert.ok(anyOrder, 'Seed Order must exist');

    managerId = Number(manager.id);
    dispatcherId = Number(dispatcher.id);
    sampleOrder = anyOrder;
    deliveredOrder = delivOrder;
    nonDeliveredOrder = draftOrTransit;
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
});
