const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  process.env.JWT_SECRET = 'wf4-systest-secret-key';
}

// Spy outgoing SMTP emails before loading emailService/routes
const sentEmails = [];
process.env.SMTP_USER = 'systest@nexlog.vn';
process.env.SMTP_PASS = 'systest-pass';
nodemailer.createTransport = () => ({
  verify: async () => true,
  sendMail: async (mailOptions) => {
    sentEmails.push({
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      from: mailOptions.from
    });
    return { messageId: `systest-mail-${Date.now()}-${sentEmails.length}` };
  }
});

// Ensure BigInt JSON serialization matches BE/server.js
BigInt.prototype.toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

const prisma = require('../config/prisma');
const apiRoutes = require('../routes');
const { runJob08_AutoClosePaidClaims } = require('../jobs/managerJobs');
const queueAdapter = require('../jobs/queueAdapter');

const RUN_TAG = `WF4ST_${Date.now().toString().slice(-6)}`;
const TEST_PHOTO_URL = 'https://res.cloudinary.com/demo/image/upload/wf4_evidence.jpg';
const TEST_PROOF_URL = 'https://res.cloudinary.com/demo/image/upload/wf4_payment_unc.jpg';
const TEST_POD_URL = 'https://res.cloudinary.com/demo/image/upload/wf4_pod_signed.jpg';

const buildJwtCookie = (user) => {
  const pwdv = user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
  const token = jwt.sign(
    {
      id: Number(user.id),
      username: user.username,
      role_id: Number(user.role_id),
      pwdv
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
  return `token=${token}`;
};

describe('Workflow 4 Complete 51-Case System Test Suite (TC_IC_01 .. TC_IC_08)', () => {
  let server = null;
  let baseUrl = '';

  // Synthetic actors & assets
  const registry = {
    userIds: [],
    driverProfileIds: [],
    truckIds: [],
    customerIds: [],
    contractIds: [],
    orderIds: [],
    tripIds: [],
    stopIds: [],
    incidentIds: [],
    claimIds: []
  };

  let managerUser = null;
  let dispatcherUser = null;
  let driver1User = null;
  let driver2User = null;
  let driver1Profile = null;
  let driver2Profile = null;
  let cookies = {};
  let truck1 = null;
  let truck2 = null;
  let locPickup = null;
  let locDropoff = null;
  let customerWithCap100M = null;
  let customerWithoutContract = null;
  let createdLocations = [];

  // Shared state across ordered scenario TCs
  const s1 = { ctx: null, incidentId: null, notifBeforeId: 0 };
  const s2 = { ctx: null, incOtherId: null, incBreakdownId: null };
  const s3 = { ctx: null, incidentId: null, managerNotifBeforeId: 0 };
  const s4 = { ctx: null, incDamagedId: null, claimId: null, incAltId: null, altClaimId: null, managerNotifBeforeId: 0 };
  const s5 = { deliveredCtx: null, expiredCtx: null, guestClaimId: null, managerNotifBeforeId: 0 };
  const s6 = { queueCtx: null, queueClaimId: null, incCtx: null, incidentId: null, incClaimId: null };
  const s7 = {
    zeroCtx: null,
    zeroClaimId: null,
    zeroIncId: null,
    capCtx: null,
    capIncId: null,
    capClaimId: null,
    mainCtx: null,
    mainIncId: null,
    mainClaimId: null
  };
  const s8 = { ctx: null, incId: null, claimId: null };

  const httpReq = async (method, routePath, { body = undefined, cookie = null } = {}) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${baseUrl}${routePath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  };

  const createInTransitShipment = async (label, opts = {}) => {
    const unique = `${RUN_TAG}_${label}_${Math.floor(Math.random() * 1000)}`;
    const targetCustomer = opts.customer || customerWithCap100M;
    const assignedTruck = opts.truck || truck1;
    const assignedDriver = opts.driverProfile || driver1Profile;
    const orderStatus = opts.orderStatus || 'IN_TRANSIT';
    const tripStatus = opts.tripStatus || 'In Progress';
    const dropoffStatus = opts.dropoffStatus || 'Pending';

    const order = await prisma.orders.create({
      data: {
        order_code: `O-${unique}`.slice(0, 20),
        tracking_token: `T-${unique}`.slice(0, 43),
        customer_id: targetCustomer.id,
        contract_id: opts.contractId !== undefined ? opts.contractId : null,
        pickup_location_id: locPickup.id,
        delivery_location_id: locDropoff.id,
        order_type: 'Import',
        status: orderStatus,
        is_closed: orderStatus === 'DELIVERED',
        agreed_price: 3500000,
        receiver_name: `Receiver ${label}`,
        receiver_phone: '0908887766',
        responsible_dispatcher_id: dispatcherUser.id,
        created_by: dispatcherUser.id
      }
    });
    registry.orderIds.push(order.id);

    if (opts.withCargo !== false) {
      await prisma.order_cargos.create({
        data: {
          order_id: order.id,
          cargo_type: 'General',
          cargo_name: `Linh kien ${label}`,
          quantity: 10,
          unit: 'Kien',
          actual_weight_kg: 500,
          chargeable_weight_kg: 500,
          declared_value: opts.declaredValue ?? 20000000
        }
      });
    }

    if (opts.deliveredAt) {
      await prisma.order_status_history.create({
        data: {
          order_id: order.id,
          status: 'DELIVERED',
          changed_by: driver1User.id,
          changed_at: opts.deliveredAt
        }
      });
    }

    let trip = null;
    let pickupStop = null;
    let dropoffStop = null;
    let waybillV1 = null;

    if (opts.withTrip !== false) {
      trip = await prisma.trips.create({
        data: {
          trip_code: `TR-${unique}`.slice(0, 20),
          status: tripStatus,
          created_by: dispatcherUser.id,
          planned_start: new Date()
        }
      });
      registry.tripIds.push(trip.id);

      await prisma.trip_trucks.create({
        data: {
          trip_id: trip.id,
          truck_id: assignedTruck.id,
          assignment_type: 'Primary',
          assigned_time: new Date()
        }
      });

      await prisma.trip_drivers.create({
        data: {
          trip_id: trip.id,
          driver_id: assignedDriver.id,
          driver_role: 'Primary',
          assignment_type: 'Primary',
          assigned_time: new Date()
        }
      });

      pickupStop = await prisma.trip_stops.create({
        data: {
          trip_id: trip.id,
          order_id: order.id,
          sequence: 1,
          stop_type: 'Pickup',
          location_id: locPickup.id,
          status: 'Done',
          actual_arrival: new Date(Date.now() - 3600000)
        }
      });
      dropoffStop = await prisma.trip_stops.create({
        data: {
          trip_id: trip.id,
          order_id: order.id,
          sequence: 2,
          stop_type: 'Drop-off',
          location_id: locDropoff.id,
          status: dropoffStatus,
          ...(dropoffStatus === 'Done' ? { actual_arrival: opts.deliveredAt || new Date() } : {})
        }
      });
      registry.stopIds.push(pickupStop.id, dropoffStop.id);

      waybillV1 = await prisma.waybills.create({
        data: {
          trip_id: trip.id,
          waybill_number: `WB-${unique.slice(-10)}-V1`.slice(0, 20),
          issued_by: dispatcherUser.id,
          status: 'Valid',
          trip_data_snapshot: {
            version: 1,
            truck_plate: assignedTruck.plate_number
          }
        }
      });
    }

    return { order, trip, pickupStop, dropoffStop, waybillV1 };
  };

  before(async () => {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use('/api', apiRoutes);
    app.use((err, req, res, _next) => {
      res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Create isolated test users for all 4 roles needed
    const createTestUser = async (roleId, suffix) => {
      const u = await prisma.users.create({
        data: {
          username: `${RUN_TAG}_${suffix}`.toLowerCase(),
          email: `${RUN_TAG}_${suffix}@systest.local`.toLowerCase(),
          full_name: `SysTest ${suffix} ${RUN_TAG}`,
          phone: `0900${Math.floor(100000 + Math.random() * 899999)}`,
          password_hash: '$2b$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyha',
          role_id: BigInt(roleId),
          status: 'ACTIVE'
        }
      });
      registry.userIds.push(u.id);
      return u;
    };

    [managerUser, dispatcherUser, driver1User, driver2User] = await Promise.all([
      createTestUser(2, 'MGR'),
      createTestUser(3, 'DISP'),
      createTestUser(4, 'DRV1'),
      createTestUser(4, 'DRV2')
    ]);

    const futureExp = new Date('2030-12-31T00:00:00.000Z');
    [driver1Profile, driver2Profile] = await Promise.all([
      prisma.driver_profiles.create({
        data: {
          user_account_id: driver1User.id,
          license_number: `LIC1-${RUN_TAG}`.slice(0, 30),
          license_class: 'FC',
          license_expiry: futureExp,
          status: 'Active'
        }
      }),
      prisma.driver_profiles.create({
        data: {
          user_account_id: driver2User.id,
          license_number: `LIC2-${RUN_TAG}`.slice(0, 30),
          license_class: 'FC',
          license_expiry: futureExp,
          status: 'Active'
        }
      })
    ]);
    registry.driverProfileIds.push(driver1Profile.id, driver2Profile.id);

    cookies = {
      manager: buildJwtCookie(managerUser),
      dispatcher: buildJwtCookie(dispatcherUser),
      driver1: buildJwtCookie(driver1User),
      driver2: buildJwtCookie(driver2User)
    };

    // Synthetic trucks
    [truck1, truck2] = await Promise.all([
      prisma.trucks.create({
        data: {
          plate_number: `99H-${RUN_TAG.slice(-3)}.01`,
          model: 'Hino 500 Test 1',
          allowed_payload: 8000,
          box_length: 6.2,
          box_width: 2.2,
          box_height: 2.1,
          required_license_class: 'C',
          status: 'On Trip',
          inspection_expiry: futureExp,
          insurance_expiry: futureExp
        }
      }),
      prisma.trucks.create({
        data: {
          plate_number: `99H-${RUN_TAG.slice(-3)}.02`,
          model: 'Hino 500 Test 2',
          allowed_payload: 8000,
          box_length: 6.2,
          box_width: 2.2,
          box_height: 2.1,
          required_license_class: 'C',
          status: 'Available',
          inspection_expiry: futureExp,
          insurance_expiry: futureExp
        }
      })
    ]);
    registry.truckIds.push(truck1.id, truck2.id);

    // Pickup & Dropoff locations (reuse existing or create synthetic)
    const locs = await prisma.locations.findMany({ take: 2, orderBy: { id: 'asc' } });
    if (locs.length >= 2) {
      locPickup = locs[0];
      locDropoff = locs[1];
    } else {
      locPickup = await prisma.locations.create({
        data: { name: `Kho Lay ${RUN_TAG}`, address: 'Noi Bai, Ha Noi', latitude: 21.221, longitude: 105.806 }
      });
      locDropoff = await prisma.locations.create({
        data: { name: `Kho Giao ${RUN_TAG}`, address: 'Bac Ninh', latitude: 21.186, longitude: 106.076 }
      });
      createdLocations.push(locPickup.id, locDropoff.id);
    }

    // Synthetic customers (1 with active 100M contract, 1 without contract)
    [customerWithCap100M, customerWithoutContract] = await Promise.all([
      prisma.customers.create({
        data: {
          company_name: `Cong Ty Test WF4 ${RUN_TAG}`,
          registered_address: 'Soc Son, Ha Noi',
          contact_person: 'Nguyen Van Test',
          phone: '0912345678',
          email: 'systest.customer.wf4@example.com'
        }
      }),
      prisma.customers.create({
        data: {
          company_name: `Khach Vang Lai ${RUN_TAG}`,
          registered_address: 'Dong Anh, Ha Noi',
          contact_person: 'Tran Van Guest',
          phone: '0987654321',
          email: 'systest.bare.wf4@example.com'
        }
      })
    ]);
    registry.customerIds.push(customerWithCap100M.id, customerWithoutContract.id);

    const contract100M = await prisma.transport_contracts.create({
      data: {
        customer_id: customerWithCap100M.id,
        contract_number: `HD-WF4-${RUN_TAG}`.slice(0, 30),
        contract_type: 'Customer',
        status: 'ACTIVE',
        liability_cap: 100000000n,
        terms_and_responsibilities: 'Dieu khoan van chuyen chuan',
        pricing_conditions: 'Theo don gia thoa thuan',
        compensation_terms: 'Gioi han trach nhiem 100.000.000 VND',
        valid_from: new Date('2026-01-01T00:00:00.000Z'),
        valid_to: futureExp
      }
    });
    registry.contractIds.push(contract100M.id);
  });

  after(async () => {
    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }

      if (registry.claimIds.length > 0) {
        await prisma.notifications.deleteMany({
          where: { target_type: 'COMPENSATION_CLAIM', target_id: { in: registry.claimIds } }
        });
        await prisma.activity_logs.deleteMany({
          where: { target_type: 'COMPENSATION_CLAIM', target_id: { in: registry.claimIds } }
        });
      }
      if (registry.incidentIds.length > 0) {
        await prisma.notifications.deleteMany({
          where: { target_type: 'INCIDENT', target_id: { in: registry.incidentIds } }
        });
        await prisma.activity_logs.deleteMany({
          where: { target_type: 'INCIDENT', target_id: { in: registry.incidentIds } }
        });
      }
      if (registry.stopIds.length > 0) {
        await prisma.activity_logs.deleteMany({
          where: { target_type: 'TRIP_STOP', target_id: { in: registry.stopIds } }
        });
      }
      if (registry.tripIds.length > 0) {
        await prisma.activity_logs.deleteMany({
          where: { target_type: 'TRIP', target_id: { in: registry.tripIds } }
        });
        await prisma.trip_events.deleteMany({ where: { trip_id: { in: registry.tripIds } } });
        await prisma.delivery_evidences.deleteMany({ where: { trip_stop_id: { in: registry.stopIds } } });
        await prisma.waybills.deleteMany({ where: { trip_id: { in: registry.tripIds } } });
      }
      if (registry.orderIds.length > 0) {
        await prisma.order_status_history.deleteMany({ where: { order_id: { in: registry.orderIds } } });
        await prisma.delivery_evidences.deleteMany({ where: { order_id: { in: registry.orderIds } } });
        await prisma.compensation_claims.deleteMany({ where: { order_id: { in: registry.orderIds } } });
      }
      if (registry.incidentIds.length > 0) {
        await prisma.compensation_claims.deleteMany({ where: { incident_id: { in: registry.incidentIds } } });
        await prisma.incidents.deleteMany({ where: { id: { in: registry.incidentIds } } });
      }
      if (registry.tripIds.length > 0) {
        await prisma.trip_trucks.deleteMany({ where: { trip_id: { in: registry.tripIds } } });
        await prisma.trip_drivers.deleteMany({ where: { trip_id: { in: registry.tripIds } } });
        await prisma.trip_stops.deleteMany({ where: { trip_id: { in: registry.tripIds } } });
        await prisma.trips.deleteMany({ where: { id: { in: registry.tripIds } } });
      }
      if (registry.orderIds.length > 0) {
        await prisma.order_cargos.deleteMany({ where: { order_id: { in: registry.orderIds } } });
        await prisma.orders.deleteMany({ where: { id: { in: registry.orderIds } } });
      }
      if (registry.contractIds.length > 0) {
        await prisma.transport_contracts.deleteMany({ where: { id: { in: registry.contractIds } } });
      }
      if (registry.customerIds.length > 0) {
        await prisma.customers.deleteMany({ where: { id: { in: registry.customerIds } } });
      }
      if (registry.truckIds.length > 0) {
        await prisma.trucks.deleteMany({ where: { id: { in: registry.truckIds } } });
      }
      if (createdLocations.length > 0) {
        await prisma.locations.deleteMany({ where: { id: { in: createdLocations } } });
      }
      if (registry.userIds.length > 0) {
        await prisma.notifications.deleteMany({ where: { user_account_id: { in: registry.userIds } } });
        await prisma.activity_logs.deleteMany({ where: { actor_id: { in: registry.userIds } } });
        await prisma.driver_profiles.deleteMany({ where: { id: { in: registry.driverProfileIds } } });
        await prisma.users.deleteMany({ where: { id: { in: registry.userIds } } });
      }
    } finally {
      if (queueAdapter?.gpsFlushTimer) {
        clearInterval(queueAdapter.gpsFlushTimer);
      }
      await prisma.$disconnect();
    }
  });

  // ============================================================================
  // SCENARIO 1: TC_IC_01 - Breakdown & Replacement (TC_IC_01-01 .. TC_IC_01-08)
  // ============================================================================
  it('TC_IC_01-01: Driver reports a Breakdown with an evidence photo', async () => {
    const maxNotif = await prisma.notifications.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    s1.notifBeforeId = maxNotif ? Number(maxNotif.id) : 0;
    s1.ctx = await createInTransitShipment('S1');

    const res = await httpReq('POST', '/api/driver/incidents', {
      cookie: cookies.driver1,
      body: {
        trip_id: Number(s1.ctx.trip.id),
        type: 'Breakdown',
        description: '[TC_IC_01-01] No lop xe giua cao toc',
        photos: [TEST_PHOTO_URL],
        incident_lat: 21.2211,
        incident_lng: 105.8067
      }
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    s1.incidentId = Number(res.body.incident.id);
    registry.incidentIds.push(BigInt(s1.incidentId));

    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s1.incidentId) } });
    assert.equal(Number(incRow.trip_id), Number(s1.ctx.trip.id));
    assert.equal(incRow.type, 'Breakdown');
    assert.equal(incRow.status, 'Reported');
    assert.deepEqual(incRow.photos, [TEST_PHOTO_URL]);
  });

  it('TC_IC_01-02: The system alerts the dispatcher', async () => {
    const notifs = await prisma.notifications.findMany({
      where: {
        id: { gt: BigInt(s1.notifBeforeId) },
        user_account_id: dispatcherUser.id,
        target_type: 'INCIDENT',
        target_id: BigInt(s1.incidentId)
      }
    });
    assert.ok(notifs.length >= 1, 'Dispatcher must receive notification for Breakdown incident');
  });

  it('TC_IC_01-03: Dispatcher gets the incident with its evidence', async () => {
    const res = await httpReq('GET', '/api/dispatcher/incidents', { cookie: cookies.dispatcher });
    assert.equal(res.status, 200);
    const found = (res.body.incidents || []).find((i) => Number(i.raw_id) === s1.incidentId);
    assert.ok(found, 'Incident must appear in GET /api/dispatcher/incidents');
    assert.equal(found.description, '[TC_IC_01-01] No lop xe giua cao toc');
    assert.equal(found.truck, truck1.plate_number);
    assert.equal(found.driver, driver1User.full_name);
    assert.deepEqual(found.photos, [TEST_PHOTO_URL]);
  });

  it('TC_IC_01-07: A non-existent replacement plate must be rejected', async () => {
    const res = await httpReq('PATCH', `/api/dispatcher/incidents/INC-${s1.incidentId}/status`, {
      cookie: cookies.dispatcher,
      body: {
        status: 'RESOLVED_REPLACED',
        new_truck: '99Z-404.99',
        new_driver: driver2User.full_name,
        replacement_reason: 'Test unknown plate'
      }
    });
    assert.equal(res.status, 404, `Expected 404 for non-existent plate, got ${res.status}`);

    const activeTrucks = await prisma.trip_trucks.findMany({
      where: { trip_id: s1.ctx.trip.id, released_time: null }
    });
    assert.equal(activeTrucks.length, 1);
    assert.equal(activeTrucks[0].truck_id, truck1.id);
  });

  it('TC_IC_01-08: A non-existent replacement driver must be rejected', async () => {
    const res = await httpReq('PATCH', `/api/dispatcher/incidents/INC-${s1.incidentId}/status`, {
      cookie: cookies.dispatcher,
      body: {
        status: 'RESOLVED_REPLACED',
        new_truck: truck2.plate_number,
        new_driver: 'Unknown Replacement Driver 999',
        replacement_reason: 'Test unknown driver'
      }
    });
    assert.equal(res.status, 404, `Expected 404 for non-existent driver, got ${res.status}`);

    const activeDrivers = await prisma.trip_drivers.findMany({
      where: { trip_id: s1.ctx.trip.id, released_time: null }
    });
    assert.equal(activeDrivers.length, 1);
    assert.equal(activeDrivers[0].driver_id, driver1Profile.id);
  });

  it('TC_IC_01-04: Dispatcher selects a replacement truck and driver', async () => {
    const res = await httpReq('PATCH', `/api/dispatcher/incidents/INC-${s1.incidentId}/status`, {
      cookie: cookies.dispatcher,
      body: {
        status: 'RESOLVED_REPLACED',
        new_truck: truck2.plate_number,
        new_driver: driver2User.full_name,
        replacement_reason: 'Dieu xe cuu ho thay the xe hong'
      }
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const [incRow, oldTruckRow, tripTrucks, tripDrivers] = await Promise.all([
      prisma.incidents.findUnique({ where: { id: BigInt(s1.incidentId) } }),
      prisma.trucks.findUnique({ where: { id: truck1.id } }),
      prisma.trip_trucks.findMany({ where: { trip_id: s1.ctx.trip.id }, orderBy: { id: 'asc' } }),
      prisma.trip_drivers.findMany({ where: { trip_id: s1.ctx.trip.id }, orderBy: { id: 'asc' } })
    ]);

    assert.equal(incRow.status, 'RESOLVED');
    assert.equal(incRow.resolved_by, dispatcherUser.id);
    assert.equal(oldTruckRow.status, 'MAINTENANCE');
    assert.ok(tripTrucks.find((tt) => tt.truck_id === truck1.id && tt.released_time !== null));
    assert.ok(tripTrucks.find((tt) => tt.truck_id === truck2.id && tt.released_time === null));
    assert.ok(tripDrivers.find((td) => td.driver_id === driver1Profile.id && td.released_time !== null));
    assert.ok(tripDrivers.find((td) => td.driver_id === driver2Profile.id && td.released_time === null));
  });

  it('TC_IC_01-05: The waybill is re-issued', async () => {
    const waybills = await prisma.waybills.findMany({
      where: { trip_id: s1.ctx.trip.id },
      orderBy: { id: 'asc' }
    });
    assert.equal(waybills.length, 2);
    assert.equal(waybills[0].status, 'Superseded');
    assert.equal(waybills[1].status, 'Valid');
    assert.equal(waybills[1].trip_data_snapshot?.version, 2);
    assert.equal(waybills[1].trip_data_snapshot?.new_truck_plate, truck2.plate_number);
  });

  it('TC_IC_01-06: Transport flow BF-03 continues with the new driver', async () => {
    const [drv1Active, drv2Active] = await Promise.all([
      httpReq('GET', '/api/driver/trips/active', { cookie: cookies.driver1 }),
      httpReq('GET', '/api/driver/trips/active', { cookie: cookies.driver2 })
    ]);
    assert.equal(drv1Active.status, 200);
    assert.equal(drv2Active.status, 200);

    const drv1HasS1 = (drv1Active.body.upcomingTrips || []).some((t) => Number(t.id) === Number(s1.ctx.trip.id));
    const drv2Trip = (drv2Active.body.upcomingTrips || []).find((t) => Number(t.id) === Number(s1.ctx.trip.id));
    assert.equal(drv1HasS1, false, 'Old driver must no longer see replaced trip');
    assert.ok(drv2Trip, 'Replacement driver must see the trip in active trips');

    const arriveRes = await httpReq(
      'POST',
      `/api/driver/trips/${s1.ctx.trip.id}/stops/${s1.ctx.dropoffStop.id}/arrive`,
      {
        cookie: cookies.driver2,
        body: { phoneLat: 21.186, phoneLng: 106.076, phoneTime: new Date().toISOString() }
      }
    );
    assert.equal(arriveRes.status, 200, `Arrive failed: ${JSON.stringify(arriveRes.body)}`);

    const deliverRes = await httpReq(
      'POST',
      `/api/driver/trips/${s1.ctx.trip.id}/stops/${s1.ctx.dropoffStop.id}/delivery`,
      {
        cookie: cookies.driver2,
        body: { pod_photo_url: TEST_POD_URL, receiver_name: 'Nguoi Nhan S1' }
      }
    );
    assert.equal(deliverRes.status, 200, `Delivery failed: ${JSON.stringify(deliverRes.body)}`);

    const orderAfter = await prisma.orders.findUnique({ where: { id: s1.ctx.order.id } });
    assert.equal(orderAfter.status, 'DELIVERED');
  });

  // ============================================================================
  // SCENARIO 2: TC_IC_02 - Minor Incident & Reclassification (02-01 .. 02-06)
  // ============================================================================
  it('TC_IC_02-01: Driver reports an "Other" incident with a photo', async () => {
    await prisma.trucks.update({ where: { id: truck1.id }, data: { status: 'On Trip' } });
    await prisma.driver_profiles.update({ where: { id: driver1Profile.id }, data: { status: 'Active' } });
    s2.ctx = await createInTransitShipment('S2');

    const res = await httpReq('POST', '/api/driver/incidents', {
      cookie: cookies.driver1,
      body: {
        trip_id: Number(s2.ctx.trip.id),
        type: 'Other',
        description: '[TC_IC_02-01] Ket xe cuc bo 20 phut',
        photos: [TEST_PHOTO_URL]
      }
    });
    assert.equal(res.status, 201);
    s2.incOtherId = Number(res.body.incident.id);
    registry.incidentIds.push(BigInt(s2.incOtherId));

    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s2.incOtherId) } });
    assert.equal(Number(incRow.trip_id), Number(s2.ctx.trip.id));
    assert.equal(incRow.type, 'Other');
    assert.deepEqual(incRow.photos, [TEST_PHOTO_URL]);
  });

  it('TC_IC_02-02: Dispatcher classifies the incident as Other after checking evidence', async () => {
    const misRes = await httpReq('POST', '/api/driver/incidents', {
      cookie: cookies.driver1,
      body: {
        trip_id: Number(s2.ctx.trip.id),
        type: 'Breakdown',
        description: '[TC_IC_02-02] Tai xe chon nham Breakdown thuc te chi ket xe',
        photos: [TEST_PHOTO_URL]
      }
    });
    assert.equal(misRes.status, 201);
    s2.incBreakdownId = Number(misRes.body.incident.id);
    registry.incidentIds.push(BigInt(s2.incBreakdownId));

    const patchRes = await httpReq('PATCH', `/api/dispatcher/incidents/INC-${s2.incBreakdownId}/status`, {
      cookie: cookies.dispatcher,
      body: {
        status: 'RESOLVED',
        type: 'Other',
        resolution_note: 'Da kiem tra anh, xe khong hong chi un tac nhe'
      }
    });
    assert.equal(patchRes.status, 200);
    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s2.incBreakdownId) } });
    assert.equal(incRow.type, 'Other');
  });

  it('TC_IC_02-03: Dispatcher enters a handling note and lets the trip continue', async () => {
    const patchRes = await httpReq('PATCH', `/api/dispatcher/incidents/INC-${s2.incOtherId}/status`, {
      cookie: cookies.dispatcher,
      body: {
        status: 'RESOLVED',
        resolution_note: '[TC_IC_02-03] Huong dan tai xe di tuyen tranh'
      }
    });
    assert.equal(patchRes.status, 200);
    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s2.incOtherId) } });
    assert.equal(incRow.status, 'RESOLVED');
    assert.equal(incRow.resolution_note, '[TC_IC_02-03] Huong dan tai xe di tuyen tranh');
    assert.ok(incRow.resolved_time);
  });

  it('TC_IC_02-04: The handler is recorded (traceability: resolved_by = dispatcher id)', async () => {
    const [r1, r2] = await Promise.all([
      prisma.incidents.findUnique({ where: { id: BigInt(s2.incOtherId) } }),
      prisma.incidents.findUnique({ where: { id: BigInt(s2.incBreakdownId) } })
    ]);
    assert.equal(r1.resolved_by, dispatcherUser.id);
    assert.equal(r2.resolved_by, dispatcherUser.id);
  });

  it('TC_IC_02-05: No truck/driver change, no new waybill', async () => {
    const [tripRow, tTrucks, tDrivers, waybills] = await Promise.all([
      prisma.trips.findUnique({ where: { id: s2.ctx.trip.id } }),
      prisma.trip_trucks.findMany({ where: { trip_id: s2.ctx.trip.id } }),
      prisma.trip_drivers.findMany({ where: { trip_id: s2.ctx.trip.id } }),
      prisma.waybills.findMany({ where: { trip_id: s2.ctx.trip.id } })
    ]);
    assert.equal(tripRow.status, 'In Progress');
    assert.equal(tTrucks.length, 1);
    assert.equal(tTrucks[0].truck_id, truck1.id);
    assert.equal(tTrucks[0].released_time, null);
    assert.equal(tDrivers.length, 1);
    assert.equal(tDrivers[0].driver_id, driver1Profile.id);
    assert.equal(tDrivers[0].released_time, null);
    assert.equal(waybills.length, 1);
    assert.equal(waybills[0].status, 'Valid');
  });

  it('TC_IC_02-06: Driver continues BF-03 and delivers', async () => {
    const arr = await httpReq('POST', `/api/driver/trips/${s2.ctx.trip.id}/stops/${s2.ctx.dropoffStop.id}/arrive`, {
      cookie: cookies.driver1,
      body: { phoneLat: 21.186, phoneLng: 106.076, phoneTime: new Date().toISOString() }
    });
    assert.equal(arr.status, 200);

    const deliv = await httpReq('POST', `/api/driver/trips/${s2.ctx.trip.id}/stops/${s2.ctx.dropoffStop.id}/delivery`, {
      cookie: cookies.driver1,
      body: { pod_photo_url: TEST_POD_URL, receiver_name: 'Nguoi Nhan S2' }
    });
    assert.equal(deliv.status, 200);

    const orderAfter = await prisma.orders.findUnique({ where: { id: s2.ctx.order.id } });
    assert.equal(orderAfter.status, 'DELIVERED');
  });

  // ============================================================================
  // SCENARIO 3: TC_IC_03 - Major incident without cargo impact (03-01 .. 03-08)
  // ============================================================================
  it('TC_IC_03-01: Driver reports a major incident (Accident)', async () => {
    await prisma.trucks.update({ where: { id: truck1.id }, data: { status: 'On Trip' } });
    await prisma.driver_profiles.update({ where: { id: driver1Profile.id }, data: { status: 'Active' } });
    s3.ctx = await createInTransitShipment('S3');

    const res = await httpReq('POST', '/api/driver/incidents', {
      cookie: cookies.driver1,
      body: {
        trip_id: Number(s3.ctx.trip.id),
        type: 'Accident',
        description: '[TC_IC_03-01] Va cham giao thong nhe o can xe, hang an toan',
        photos: [TEST_PHOTO_URL]
      }
    });
    assert.equal(res.status, 201);
    s3.incidentId = Number(res.body.incident.id);
    registry.incidentIds.push(BigInt(s3.incidentId));

    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s3.incidentId) } });
    assert.equal(incRow.type, 'Accident');
    assert.equal(incRow.status, 'Reported');
  });

  it('TC_IC_03-02: Dispatcher escalates to the manager', async () => {
    const maxNotif = await prisma.notifications.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    s3.managerNotifBeforeId = maxNotif ? Number(maxNotif.id) : 0;

    const res = await httpReq('PATCH', `/api/dispatcher/incidents/INC-${s3.incidentId}/status`, {
      cookie: cookies.dispatcher,
      body: {
        status: 'ESCALATED',
        cargo_affected: false,
        escalation_reason: '[TC_IC_03-02] Tai nan giao thong can Quan ly xac dinh loi'
      }
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s3.incidentId) } });
    assert.equal(incRow.status, 'Escalated');
    assert.equal(incRow.escalation_reason, '[TC_IC_03-02] Tai nan giao thong can Quan ly xac dinh loi');
    assert.ok(incRow.escalated_time);
  });

  it('TC_IC_03-03: The escalating user is recorded (escalated_by = dispatcher id)', async () => {
    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s3.incidentId) } });
    assert.equal(incRow.escalated_by, dispatcherUser.id);
  });

  it('TC_IC_03-04: The manager is alerted on escalation', async () => {
    const notifs = await prisma.notifications.findMany({
      where: {
        id: { gt: BigInt(s3.managerNotifBeforeId) },
        user_account_id: managerUser.id,
        target_type: 'INCIDENT',
        target_id: BigInt(s3.incidentId)
      }
    });
    assert.ok(notifs.length >= 1, 'Manager must receive notification on escalation');
  });

  it('TC_IC_03-05: Manager sees the incident in the escalated list', async () => {
    const res = await httpReq('GET', '/api/manager/incidents?status=ESCALATED', { cookie: cookies.manager });
    assert.equal(res.status, 200);
    const found = (res.body.incidents || []).find((x) => Number(x.id) === s3.incidentId);
    assert.ok(found, 'Escalated incident must appear in GET /api/manager/incidents?status=ESCALATED');
    // Also validate BUG-UI-10: summary reflects unfiltered counts
    assert.ok(res.body.summary && typeof res.body.summary.total === 'number');
  });

  it('TC_IC_03-06: Dispatcher assesses "customer cargo not affected" and Manager sees it', async () => {
    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s3.incidentId) } });
    assert.equal(incRow.cargo_affected, false);

    const res = await httpReq('GET', `/api/manager/incidents/${s3.incidentId}`, { cookie: cookies.manager });
    assert.equal(res.status, 200);
    assert.equal(res.body.incident.cargo_affected, false);
  });

  it('TC_IC_03-07: Manager resolves the major incident (fault), no compensation', async () => {
    const res = await httpReq('POST', `/api/manager/incidents/${s3.incidentId}/resolve`, {
      cookie: cookies.manager,
      body: { fault: 'COMPANY', resolution_note: '[TC_IC_03-07] Xac dinh loi cong ty, khong boi thuong hang hoa' }
    });
    assert.equal(res.status, 200);
    const incRow = await prisma.incidents.findUnique({ where: { id: BigInt(s3.incidentId) } });
    assert.equal(incRow.status, 'RESOLVED');
    assert.equal(incRow.fault, 'COMPANY');
    assert.equal(incRow.resolved_by, managerUser.id);
  });

  it('TC_IC_03-08: No claim is created; the flow ends', async () => {
    const count = await prisma.compensation_claims.count({
      where: { incident_id: BigInt(s3.incidentId) }
    });
    assert.equal(count, 0);
    // Complete trip cleanly
    await prisma.trips.update({ where: { id: s3.ctx.trip.id }, data: { status: 'Completed' } });
  });

  // ============================================================================
  // SCENARIO 4: TC_IC_04 - Major incident affecting cargo -> internal claim (04-01 .. 04-05)
  // ============================================================================
  it('TC_IC_04-01: Dispatcher escalates, confirms cargo affected and creates a claim', async () => {
    s4.ctx = await createInTransitShipment('S4');
    const drvRes = await httpReq('POST', '/api/driver/incidents', {
      cookie: cookies.driver1,
      body: {
        trip_id: Number(s4.ctx.trip.id),
        type: 'Cargo Damaged',
        description: '[TC_IC_04-01] Thung hang bi mop meo do rung lac',
        photos: [TEST_PHOTO_URL]
      }
    });
    assert.equal(drvRes.status, 201);
    s4.incDamagedId = Number(drvRes.body.incident.id);
    registry.incidentIds.push(BigInt(s4.incDamagedId));

    const maxNotif = await prisma.notifications.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    s4.managerNotifBeforeId = maxNotif ? Number(maxNotif.id) : 0;
    const mailCountBefore = sentEmails.length;

    const escRes = await httpReq('PATCH', `/api/dispatcher/incidents/INC-${s4.incDamagedId}/status`, {
      cookie: cookies.dispatcher,
      body: {
        status: 'ESCALATED',
        type: 'CARGO_DAMAGED',
        cargo_affected: true,
        create_claim: true,
        order_id: Number(s4.ctx.order.id),
        claim_type: 'Damage',
        amount: 5000000,
        escalation_reason: '[TC_IC_04-01] Hang hoa hu hong can boi thuong'
      }
    });
    assert.equal(escRes.status, 200, `Expected 200, got ${escRes.status}: ${JSON.stringify(escRes.body)}`);
    assert.ok(escRes.body.incident.created_claim, 'Dispatcher escalation must create Pending claim');
    s4.claimId = Number(escRes.body.incident.created_claim.id);
    registry.claimIds.push(BigInt(s4.claimId));
    assert.equal(escRes.body.incident.created_claim.status, 'PENDING');
    s4._mailCountBefore = mailCountBefore;
  });

  it('TC_IC_04-02: Claim saved as Pending and manager alerted', async () => {
    const claimRow = await prisma.compensation_claims.findUnique({ where: { id: BigInt(s4.claimId) } });
    assert.equal(claimRow.status, 'PENDING');
    assert.equal(Number(claimRow.incident_id), s4.incDamagedId);

    const notifs = await prisma.notifications.findMany({
      where: {
        id: { gt: BigInt(s4.managerNotifBeforeId) },
        user_account_id: managerUser.id,
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(s4.claimId)
      }
    });
    assert.ok(notifs.length >= 1, 'Manager must receive claim alert');
  });

  it('TC_IC_04-03: Customer is informed that the cargo is affected', async () => {
    const newEmails = sentEmails.slice(s4._mailCountBefore);
    const affectedMail = newEmails.find((m) => m.to === customerWithCap100M.email);
    assert.ok(affectedMail, 'Customer must receive email informing cargo affected');
  });

  it('TC_IC_04-04: (Alternative path) Manager creates a claim when resolving with an amount', async () => {
    const altInc = await prisma.incidents.create({
      data: {
        trip_id: s4.ctx.trip.id,
        trip_stop_id: s4.ctx.dropoffStop.id,
        type: 'CARGO_DAMAGED',
        status: 'Escalated',
        description: '[TC_IC_04-04] Su co hu hong cho Manager resolve kem amount',
        photos: [TEST_PHOTO_URL],
        reported_time: new Date()
      }
    });
    s4.incAltId = Number(altInc.id);
    registry.incidentIds.push(altInc.id);

    const res = await httpReq('POST', `/api/manager/incidents/${s4.incAltId}/resolve`, {
      cookie: cookies.manager,
      body: { fault: 'COMPANY', compensation_amount: 5000000, resolution_note: 'Manager resolve with amount' }
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.claim, 'resolveIncident with compensation_amount > 0 must create Pending claim');
    s4.altClaimId = Number(res.body.claim.id);
    registry.claimIds.push(BigInt(s4.altClaimId));

    const claimRow = await prisma.compensation_claims.findUnique({ where: { id: BigInt(s4.altClaimId) } });
    assert.equal(claimRow.status, 'PENDING');
    assert.equal(Number(claimRow.order_id), Number(s4.ctx.order.id));
    assert.equal(Number(claimRow.incident_id), s4.incAltId);
  });

  it('TC_IC_04-05: Claim enters the manager queue with full trip data', async () => {
    const res = await httpReq('GET', '/api/manager/claims', { cookie: cookies.manager });
    assert.equal(res.status, 200);
    const item = (res.body.claims || []).find((c) => Number(c.id) === s4.claimId);
    assert.ok(item, 'Claim must appear in GET /api/manager/claims');
    assert.equal(item.trip_code, s4.ctx.trip.trip_code);
    assert.equal(item.truck_plate, truck1.plate_number);
    assert.equal(item.driver_name, driver1User.full_name);
    assert.equal(item.order_code, s4.ctx.order.order_code);
    assert.ok(Array.isArray(item.incident_photos) && item.incident_photos.includes(TEST_PHOTO_URL));

    await prisma.trips.update({ where: { id: s4.ctx.trip.id }, data: { status: 'Completed' } });
  });

  // ============================================================================
  // SCENARIO 5: TC_IC_05 - Guest submits claim within 14 days (05-01 .. 05-03)
  // ============================================================================
  it('TC_IC_05-01: Guest opens the tracking page of a delivered order', async () => {
    const deliveredAtRecent = new Date(Date.now() - 2 * 86400000);
    s5.deliveredCtx = await createInTransitShipment('S5_OK', {
      orderStatus: 'DELIVERED',
      tripStatus: 'Completed',
      dropoffStatus: 'Done',
      deliveredAt: deliveredAtRecent
    });

    const res = await httpReq('GET', `/api/orders/customer-view/${s5.deliveredCtx.order.tracking_token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.order.status, 'DELIVERED');
    assert.equal(res.body.order.can_submit_claim, true);
  });

  it('TC_IC_05-02: Guest submits a claim in time', async () => {
    const maxNotif = await prisma.notifications.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    s5.managerNotifBeforeId = maxNotif ? Number(maxNotif.id) : 0;

    const res = await httpReq('POST', `/api/orders/customer-claim/${s5.deliveredCtx.order.tracking_token}`, {
      body: {
        claim_type: 'Damage',
        amount: 3000000,
        reason: '[TC_IC_05-02] Khach phat hien mop hang khi mo kien',
        photos: [TEST_PHOTO_URL],
        submitted_by_name: 'Khach Hang S5',
        submitted_by_phone: '0905556677'
      }
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    s5.guestClaimId = Number(res.body.claim.id);
    registry.claimIds.push(BigInt(s5.guestClaimId));
    assert.equal(res.body.claim.status, 'PENDING');
    assert.equal(res.body.claim.source, 'CUSTOMER_CLAIM');
  });

  it('TC_IC_05-03: 14-day limit enforced and manager notified for valid claim', async () => {
    const mgrNotifs = await prisma.notifications.findMany({
      where: {
        id: { gt: BigInt(s5.managerNotifBeforeId) },
        user_account_id: managerUser.id,
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(s5.guestClaimId)
      }
    });
    assert.ok(mgrNotifs.length >= 1, 'Manager must be notified on valid guest claim');

    const delivered15DaysAgo = new Date(Date.now() - 15 * 86400000);
    s5.expiredCtx = await createInTransitShipment('S5_EXP', {
      orderStatus: 'DELIVERED',
      tripStatus: 'Completed',
      dropoffStatus: 'Done',
      deliveredAt: delivered15DaysAgo
    });

    const lateRes = await httpReq('POST', `/api/orders/customer-claim/${s5.expiredCtx.order.tracking_token}`, {
      body: {
        claim_type: 'Damage',
        amount: 1000000,
        reason: '[TC_IC_05-03] Khieu nai qua han 15 ngay'
      }
    });
    assert.equal(lateRes.status, 400, `Expected 400 for >14 day claim, got ${lateRes.status}`);
  });

  // ============================================================================
  // SCENARIO 6: TC_IC_06 - Manager rejects a claim (06-01 .. 06-08)
  // ============================================================================
  it('TC_IC_06-01: Manager reviews the file (customer, contract, order, photos, no fake data)', async () => {
    // 1) Review real data on incident with contract/order
    const resReal = await httpReq('GET', `/api/manager/incidents/${s4.incDamagedId}`, { cookie: cookies.manager });
    assert.equal(resReal.status, 200);
    assert.equal(resReal.body.incident.order.customer.company_name, customerWithCap100M.company_name);
    assert.equal(resReal.body.incident.order.order_code, s4.ctx.order.order_code);
    assert.ok(resReal.body.incident.incident_photos.includes(TEST_PHOTO_URL));
    assert.equal(Number(resReal.body.incident.contract.liability_cap), 100000000);

    // 2) Review incident WITHOUT contract/declared_value -> verify no fabricated defaults (BUG-UI-09)
    const bareCtx = await createInTransitShipment('S6_BARE', {
      customer: customerWithoutContract,
      withCargo: false,
      tripStatus: 'Completed'
    });
    const bareInc = await prisma.incidents.create({
      data: {
        trip_id: bareCtx.trip.id,
        type: 'ACCIDENT',
        status: 'Escalated',
        description: 'Su co khong co hop dong khung'
      }
    });
    registry.incidentIds.push(bareInc.id);

    const resBare = await httpReq('GET', `/api/manager/incidents/${bareInc.id}`, { cookie: cookies.manager });
    assert.equal(resBare.status, 200);
    assert.equal(resBare.body.incident.contract, null);
    assert.equal(resBare.body.incident.claim_code, null);
    assert.equal(resBare.body.incident.order.declared_value, undefined);
  });

  it('TC_IC_06-02: Rejecting without a reason is blocked', async () => {
    const res = await httpReq('POST', `/api/manager/claims/${s5.guestClaimId}/decide`, {
      cookie: cookies.manager,
      body: { action: 'REJECT' }
    });
    assert.equal(res.status, 400);
    const claimRow = await prisma.compensation_claims.findUnique({ where: { id: BigInt(s5.guestClaimId) } });
    assert.equal(claimRow.status, 'PENDING');
  });

  it('TC_IC_06-03: Manager rejects from the claim queue with a reason', async () => {
    s6._mailBeforeQueue = sentEmails.length;
    const res = await httpReq('POST', `/api/manager/claims/${s5.guestClaimId}/decide`, {
      cookie: cookies.manager,
      body: {
        action: 'REJECT',
        comment: '[TC_IC_06-03] Hang bi hu hong do dong goi sai quy cach',
        contract_clause_ref: 'Dieu 4.2'
      }
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.claim.status, 'REJECTED');

    const claimRow = await prisma.compensation_claims.findUnique({ where: { id: BigInt(s5.guestClaimId) } });
    assert.equal(claimRow.status, 'REJECTED');
    assert.equal(claimRow.rejection_reason, '[TC_IC_06-03] Hang bi hu hong do dong goi sai quy cach');
    assert.equal(claimRow.reviewed_by, managerUser.id);
  });

  it('TC_IC_06-04: Rejection e-mail is sent (claim queue path)', async () => {
    const newMails = sentEmails.slice(s6._mailBeforeQueue);
    const rejMail = newMails.find((m) => m.to === customerWithCap100M.email);
    assert.ok(rejMail, 'Rejection email must be sent on claim queue rejection path');
  });

  it('TC_IC_06-05: Rejection shown on the tracking page', async () => {
    const res = await httpReq('GET', `/api/orders/customer-view/${s5.deliveredCtx.order.tracking_token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.order.incident.status, 'REJECTED');
    assert.equal(res.body.order.incident.rejection_reason, '[TC_IC_06-03] Hang bi hu hong do dong goi sai quy cach');
    assert.equal(res.body.order.incident.clause_ref, 'Dieu 4.2');
  });

  it('TC_IC_06-06: Reject from the major-incident screen: save, transition, e-mail', async () => {
    s6.incCtx = await createInTransitShipment('S6_INC', { tripStatus: 'Completed' });
    const inc = await prisma.incidents.create({
      data: {
        trip_id: s6.incCtx.trip.id,
        trip_stop_id: s6.incCtx.dropoffStop.id,
        type: 'CARGO_DAMAGED',
        status: 'Escalated',
        cargo_affected: true,
        description: '[TC_IC_06-06] Su co tu choi qua incident screen',
        photos: [TEST_PHOTO_URL]
      }
    });
    s6.incidentId = Number(inc.id);
    registry.incidentIds.push(inc.id);

    const claim = await prisma.compensation_claims.create({
      data: {
        incident_id: inc.id,
        order_id: s6.incCtx.order.id,
        source: 'INCIDENT',
        amount: 2000000n,
        status: 'PENDING',
        reason: 'Pending claim before incident screen reject',
        created_by: dispatcherUser.id
      }
    });
    s6.incClaimId = Number(claim.id);
    registry.claimIds.push(claim.id);

    const mailBefore = sentEmails.length;
    const res = await httpReq('POST', `/api/manager/incidents/${s6.incidentId}/decide`, {
      cookie: cookies.manager,
      body: {
        action: 'REJECT',
        fault: 'CUSTOMER',
        rejection_reason: '[TC_IC_06-06] Mien tru trach nhiem do khach khong boc lot chong soc',
        contract_clause_ref: 'Dieu 4.2 - Hop dong'
      }
    });
    assert.equal(res.status, 200);

    const [incAfter, claimAfter] = await Promise.all([
      prisma.incidents.findUnique({ where: { id: inc.id } }),
      prisma.compensation_claims.findUnique({ where: { id: claim.id } })
    ]);
    assert.equal(claimAfter.status, 'REJECTED');
    assert.equal(incAfter.status, 'REJECTED');
    assert.ok(sentEmails.slice(mailBefore).some((m) => m.to === customerWithCap100M.email));
  });

  it('TC_IC_06-07: Reason on the tracking page (incident-screen path)', async () => {
    const res = await httpReq('GET', `/api/orders/customer-view/${s6.incCtx.order.tracking_token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.order.incident.status, 'REJECTED');
    assert.equal(res.body.order.incident.rejection_reason, '[TC_IC_06-06] Mien tru trach nhiem do khach khong boc lot chong soc');
    assert.equal(res.body.order.incident.clause_ref, 'Dieu 4.2 - Hop dong');
  });

  it('TC_IC_06-08: Dispatcher logs the phone call to the customer (closes REJECTED -> CLOSED_REJECTED)', async () => {
    const [call1, call2] = await Promise.all([
      httpReq('POST', `/api/dispatcher/claims/${s5.guestClaimId}/record-call`, {
        cookie: cookies.dispatcher,
        body: { call_contact_phone: '0905556677', call_note: '[TC_IC_06-08] Da goi thong bao tu choi Guest Claim' }
      }),
      httpReq('POST', `/api/dispatcher/claims/${s6.incClaimId}/record-call`, {
        cookie: cookies.dispatcher,
        body: { call_contact_phone: '0912345678', call_note: '[TC_IC_06-08] Da goi thong bao tu choi Incident Claim' }
      })
    ]);
    assert.equal(call1.status, 200);
    assert.equal(call2.status, 200);

    assert.equal(call1.body.claim.status, 'CLOSED_REJECTED');
    assert.ok(call1.body.claim.called_at);
    assert.equal(call1.body.claim.called_by, Number(dispatcherUser.id));

    assert.equal(call2.body.claim.status, 'CLOSED_REJECTED');
    const incAfter = await prisma.incidents.findUnique({ where: { id: BigInt(s6.incidentId) } });
    assert.equal(incAfter.status, 'CLOSED');

    // Re-verify Fix 1.1: CLOSED_REJECTED Guest Claim stays REJECTED on public tracking page!
    const trackAfterClose = await httpReq('GET', `/api/orders/customer-view/${s5.deliveredCtx.order.tracking_token}`);
    assert.equal(trackAfterClose.status, 200);
    assert.equal(trackAfterClose.body.order.incident.status, 'REJECTED');
    assert.equal(trackAfterClose.body.order.incident.clause_ref, 'Dieu 4.2');
  });

  // ============================================================================
  // SCENARIO 7: TC_IC_07 - Approval, Option A/B, Payment & Confirm (07-01 .. 07-11)
  // ============================================================================
  it('TC_IC_07-11: Approval with zero/empty amount is blocked (HTTP 400)', async () => {
    s7.zeroCtx = await createInTransitShipment('S7_ZERO', { tripStatus: 'Completed' });
    const inc = await prisma.incidents.create({
      data: {
        trip_id: s7.zeroCtx.trip.id,
        type: 'CARGO_DAMAGED',
        status: 'Escalated',
        cargo_affected: true,
        description: '[TC_IC_07-11] Test zero amount guard'
      }
    });
    s7.zeroIncId = Number(inc.id);
    registry.incidentIds.push(inc.id);

    const claim = await prisma.compensation_claims.create({
      data: {
        incident_id: inc.id,
        order_id: s7.zeroCtx.order.id,
        source: 'INCIDENT',
        amount: 2000000n,
        status: 'PENDING',
        reason: '[TC_IC_07-11] Pending claim',
        created_by: dispatcherUser.id
      }
    });
    s7.zeroClaimId = Number(claim.id);
    registry.claimIds.push(claim.id);

    const [incEmpty, incZero, clmEmpty, clmZero] = await Promise.all([
      httpReq('POST', `/api/manager/incidents/${s7.zeroIncId}/decide`, {
        cookie: cookies.manager,
        body: { action: 'APPROVE', fault: 'COMPANY' }
      }),
      httpReq('POST', `/api/manager/incidents/${s7.zeroIncId}/decide`, {
        cookie: cookies.manager,
        body: { action: 'APPROVE', fault: 'COMPANY', approved_amount: 0 }
      }),
      httpReq('POST', `/api/manager/claims/${s7.zeroClaimId}/decide`, {
        cookie: cookies.manager,
        body: { action: 'APPROVE' }
      }),
      httpReq('POST', `/api/manager/claims/${s7.zeroClaimId}/decide`, {
        cookie: cookies.manager,
        body: { action: 'APPROVE', approved_amount: 0 }
      })
    ]);

    assert.equal(incEmpty.status, 400);
    assert.equal(incZero.status, 400);
    assert.equal(clmEmpty.status, 400);
    assert.equal(clmZero.status, 400);
  });

  it('TC_IC_07-10: Option B - Above contract liability_cap (100M) requires justification comment (MSG56)', async () => {
    s7.capCtx = await createInTransitShipment('S7_CAP', {
      tripStatus: 'Completed',
      contractId: registry.contractIds[0]
    });
    const inc = await prisma.incidents.create({
      data: {
        trip_id: s7.capCtx.trip.id,
        type: 'CARGO_DAMAGED',
        status: 'Escalated',
        cargo_affected: true,
        description: '[TC_IC_07-10] Test Option B 100M cap'
      }
    });
    s7.capIncId = Number(inc.id);
    registry.incidentIds.push(inc.id);

    const claim = await prisma.compensation_claims.create({
      data: {
        incident_id: inc.id,
        order_id: s7.capCtx.order.id,
        source: 'INCIDENT',
        amount: 900000000n,
        status: 'PENDING',
        reason: '[TC_IC_07-10] 900M claim against 100M cap',
        created_by: dispatcherUser.id
      }
    });
    s7.capClaimId = Number(claim.id);
    registry.claimIds.push(claim.id);

    // 1. Both incident decide & claim decide MUST reject 900M > 100M when comment/note is omitted
    const incNoComment = await httpReq('POST', `/api/manager/incidents/${s7.capIncId}/decide`, {
      cookie: cookies.manager,
      body: {
        action: 'APPROVE',
        fault: 'COMPANY',
        approved_amount: 900000000
      }
    });
    assert.equal(incNoComment.status, 400, `Expected 400 MSG56 on incident decide, got ${incNoComment.status}`);
    assert.match(incNoComment.body.message, /MSG56|vượt hạn mức/i);

    const clmNoComment = await httpReq('POST', `/api/manager/claims/${s7.capClaimId}/decide`, {
      cookie: cookies.manager,
      body: {
        action: 'APPROVE',
        approved_amount: 900000000
      }
    });
    assert.equal(clmNoComment.status, 400, `Expected 400 MSG56 on claim decide, got ${clmNoComment.status}`);
    assert.match(clmNoComment.body.message, /MSG56|vượt hạn mức/i);

    const stayedPending = await prisma.compensation_claims.findUnique({ where: { id: claim.id } });
    assert.equal(stayedPending.status, 'PENDING');

    // 2. Option B Override: WITH exception justification comment -> HTTP 200
    const incOverride = await httpReq('POST', `/api/manager/incidents/${s7.capIncId}/decide`, {
      cookie: cookies.manager,
      body: {
        action: 'APPROVE',
        fault: 'COMPANY',
        approved_amount: 900000000,
        resolution_note: 'Phe duyet ngoai le vuot tran 100M theo quyet dinh BGD'
      }
    });
    assert.equal(incOverride.status, 200, `Expected 200 override, got ${incOverride.status}: ${JSON.stringify(incOverride.body)}`);
    const overriddenClaim = await prisma.compensation_claims.findUnique({ where: { id: claim.id } });
    assert.equal(overriddenClaim.status, 'APPROVED');
    assert.equal(Number(overriddenClaim.approved_amount), 900000000);
  });

  it('TC_IC_07-01: Manager approves with option and amount (4,000,000 VND)', async () => {
    s7.mainCtx = await createInTransitShipment('S7_MAIN', { tripStatus: 'Completed' });
    const inc = await prisma.incidents.create({
      data: {
        trip_id: s7.mainCtx.trip.id,
        type: 'CARGO_DAMAGED',
        status: 'Escalated',
        cargo_affected: true,
        description: '[TC_IC_07-01] Hu hong 20% lo hang 20M',
        photos: [TEST_PHOTO_URL]
      }
    });
    s7.mainIncId = Number(inc.id);
    registry.incidentIds.push(inc.id);

    const claim = await prisma.compensation_claims.create({
      data: {
        incident_id: inc.id,
        order_id: s7.mainCtx.order.id,
        source: 'INCIDENT',
        amount: 5000000n,
        status: 'PENDING',
        reason: '[TC_IC_07-01] Pending claim for 4M approval',
        created_by: dispatcherUser.id
      }
    });
    s7.mainClaimId = Number(claim.id);
    registry.claimIds.push(claim.id);

    s7._mailBeforeApprove = sentEmails.length;
    const res = await httpReq('POST', `/api/manager/incidents/${s7.mainIncId}/decide`, {
      cookie: cookies.manager,
      body: {
        action: 'APPROVE',
        fault: 'COMPANY',
        approved_amount: 4000000,
        damage_percentage: 20,
        goods_handling_method: 'CUSTOMER_RETAIN',
        contract_clause_ref: 'Dieu 8.2',
        resolution_note: 'Duyet boi thuong 4.000.000 d theo ty le 20%'
      }
    });
    assert.equal(res.status, 200);
    const claimRow = await prisma.compensation_claims.findUnique({ where: { id: claim.id } });
    assert.equal(claimRow.status, 'APPROVED');
    assert.equal(Number(claimRow.approved_amount), 4000000);
  });

  it('TC_IC_07-02: Handling option and damage rate kept on the file', async () => {
    const res = await httpReq('GET', `/api/manager/incidents/${s7.mainIncId}`, { cookie: cookies.manager });
    assert.equal(res.status, 200);
    assert.equal(Number(res.body.incident.approved_compensation_amount), 4000000);
    assert.equal(Number(res.body.incident.damage_percentage), 20);
    assert.equal(res.body.incident.goods_handling_method, 'CUSTOMER_RETAIN');
    assert.equal(res.body.incident.contract_clause_ref, 'Dieu 8.2');
  });

  it('TC_IC_07-03: Approval e-mail and tracking page result', async () => {
    const newMails = sentEmails.slice(s7._mailBeforeApprove);
    assert.ok(newMails.some((m) => m.to === customerWithCap100M.email && m.subject.includes('4.000.000')));

    const track = await httpReq('GET', `/api/orders/customer-view/${s7.mainCtx.order.tracking_token}`);
    assert.equal(track.status, 200);
    assert.equal(track.body.order.incident.status, 'APPROVED');
    assert.equal(Number(track.body.order.incident.compensation_amount), 4000000);
  });

  it('TC_IC_07-04: Option A - Dispatcher gets 403 on payment recording and only logs customer phone call', async () => {
    const [dispClose, dispPay] = await Promise.all([
      httpReq('PATCH', `/api/manager/incidents/${s7.mainIncId}/close`, {
        cookie: cookies.dispatcher,
        body: { transaction_code: 'FT-DISP', payment_proof_url: TEST_PROOF_URL }
      }),
      httpReq('POST', `/api/manager/claims/${s7.mainClaimId}/record-payment`, {
        cookie: cookies.dispatcher,
        body: { transaction_code: 'FT-DISP', payment_proof_url: TEST_PROOF_URL }
      })
    ]);
    assert.equal(dispClose.status, 403);
    assert.equal(dispPay.status, 403);

    const callRes = await httpReq('POST', `/api/dispatcher/claims/${s7.mainClaimId}/record-call`, {
      cookie: cookies.dispatcher,
      body: {
        call_contact_phone: '0912345678',
        call_note: '[TC_IC_07-04] Da goi thong bao va lay STK khach hang'
      }
    });
    assert.equal(callRes.status, 200);
    assert.equal(callRes.body.claim.status, 'APPROVED');
    assert.ok(callRes.body.claim.called_at);
  });

  it('TC_IC_07-05: Payment without proof is blocked', async () => {
    const res = await httpReq('PATCH', `/api/manager/incidents/${s7.mainIncId}/close`, {
      cookie: cookies.manager,
      body: { transaction_code: 'FT261127001' }
    });
    assert.equal(res.status, 400);
  });

  it('TC_IC_07-06: After payment the claim waits for customer confirmation (PAID, not DONE immediately)', async () => {
    const res = await httpReq('PATCH', `/api/manager/incidents/${s7.mainIncId}/close`, {
      cookie: cookies.manager,
      body: {
        payment_date: '2026-11-27',
        transaction_code: 'FT261127999',
        payment_proof_url: TEST_PROOF_URL,
        close_note: 'Da chuyen khoan 4.000.000 d. Ma GD: FT261127999'
      }
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const [claimRow, incRow] = await Promise.all([
      prisma.compensation_claims.findUnique({ where: { id: BigInt(s7.mainClaimId) } }),
      prisma.incidents.findUnique({ where: { id: BigInt(s7.mainIncId) } })
    ]);
    assert.equal(claimRow.status, 'PAID');
    assert.equal(claimRow.closed_at, null);
    assert.equal(incRow.status, 'PAID');
  });

  it('TC_IC_07-07: Tracking page shows the payment proof', async () => {
    const track = await httpReq('GET', `/api/orders/customer-view/${s7.mainCtx.order.tracking_token}`);
    assert.equal(track.status, 200);
    assert.equal(track.body.order.incident.status, 'PAID');
    assert.equal(Number(track.body.order.incident.compensation_amount), 4000000);
    assert.equal(track.body.order.incident.transaction_code, 'FT261127999');
    assert.equal(track.body.order.incident.payment_proof_url, TEST_PROOF_URL);
    assert.equal(track.body.order.claims[0].status, 'PAID');
    assert.ok(track.body.order.claims[0].auto_close_deadline);
  });

  it('TC_IC_07-08: Guest confirms the money was received', async () => {
    const res = await httpReq('POST', `/api/orders/customer-confirm-claim/${s7.mainCtx.order.tracking_token}`, {
      body: { claim_id: s7.mainClaimId }
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.claim.customer_confirmed_at);
    assert.equal(res.body.claim.close_method, 'CUSTOMER_CONFIRMED');
  });

  it('TC_IC_07-09: Claim closes as Compensated (CLOSED_COMPENSATED)', async () => {
    const [claimRow, incRow] = await Promise.all([
      prisma.compensation_claims.findUnique({ where: { id: BigInt(s7.mainClaimId) } }),
      prisma.incidents.findUnique({ where: { id: BigInt(s7.mainIncId) } })
    ]);
    assert.equal(claimRow.status, 'CLOSED_COMPENSATED');
    assert.ok(claimRow.closed_at);
    assert.equal(incRow.status, 'DONE');
  });

  // ============================================================================
  // SCENARIO 8: TC_IC_08 - Background job auto-closes after 7 days (08-01 .. 08-02)
  // ============================================================================
  it('TC_IC_08-01: A background job checks the 7-day confirmation window', async () => {
    const jobsSrc = fs.readFileSync(path.resolve(__dirname, '../jobs/managerJobs.js'), 'utf8');
    assert.ok(typeof runJob08_AutoClosePaidClaims === 'function');
    assert.match(jobsSrc, /job:auto-close-paid-claims/);
    assert.match(jobsSrc, /runJob08_AutoClosePaidClaims/);
  });

  it('TC_IC_08-02: Claim auto-closes as Compensated (CLOSED_COMPENSATED) after 7 days', async () => {
    s8.ctx = await createInTransitShipment('S8_AUTO', { tripStatus: 'Completed' });
    const inc = await prisma.incidents.create({
      data: {
        trip_id: s8.ctx.trip.id,
        type: 'CARGO_DAMAGED',
        status: 'PAID',
        cargo_affected: true,
        description: '[TC_IC_08-02] Cho tu dong dong sau 7 ngay'
      }
    });
    s8.incId = Number(inc.id);
    registry.incidentIds.push(inc.id);

    const eightDaysAgo = new Date(Date.now() - 8 * 86400000);
    const claim = await prisma.compensation_claims.create({
      data: {
        incident_id: inc.id,
        order_id: s8.ctx.order.id,
        source: 'INCIDENT',
        amount: 2500000n,
        approved_amount: 2500000n,
        reason: '[TC_IC_08-02] Boi thuong qua 7 ngay khong xac nhan',
        status: 'PAID',
        paid_by: managerUser.id,
        paid_at: eightDaysAgo,
        payment_date: eightDaysAgo,
        transaction_code: 'FT-8DAYS-AGO',
        payment_proof_url: TEST_PROOF_URL,
        customer_confirmed_at: null,
        created_by: dispatcherUser.id
      }
    });
    s8.claimId = Number(claim.id);
    registry.claimIds.push(claim.id);

    const jobRes = await runJob08_AutoClosePaidClaims();
    assert.ok(jobRes.closedClaimIds.includes(s8.claimId), 'JOB-08 must auto-close claim paid > 7 days ago');

    const [claimAfter, incAfter] = await Promise.all([
      prisma.compensation_claims.findUnique({ where: { id: claim.id } }),
      prisma.incidents.findUnique({ where: { id: inc.id } })
    ]);
    assert.equal(claimAfter.status, 'CLOSED_COMPENSATED');
    assert.equal(claimAfter.close_method, 'AUTO_7_DAYS');
    assert.equal(claimAfter.customer_confirmed_at, null);
    assert.ok(claimAfter.closed_at);
    assert.equal(incAfter.status, 'DONE');
  });
});
