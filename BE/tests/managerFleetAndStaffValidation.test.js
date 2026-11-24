const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaConfigPath = require.resolve(path.resolve(__dirname, '../config/prisma'));
const modulePaths = [
  '../controllers/fleetController',
  '../services/staffAccountService',
  '../models/staffAccountModel',
  '../models/userModel',
  '../models/fleetModel',
  '../models/driverModel',
  '../models/leaveModel',
  '../services/fleetService'
].map((p) => {
  try { return require.resolve(path.resolve(__dirname, p)); } catch { return null; }
}).filter(Boolean);

let tables = {};
let ids = {};

const matchValue = (rowVal, cond) => {
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
    if ('not' in cond) return String(rowVal) !== String(cond.not);
    if ('in' in cond) return cond.in.map(String).includes(String(rowVal));
    return true;
  }
  return String(rowVal) === String(cond);
};
const matches = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => k === 'OR' || matchValue(row[k], v));

const uniqueCols = {
  users: ['username', 'email'],
  driver_profiles: ['license_number', 'user_account_id'],
  trucks: ['plate_number']
};

const p2002 = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

const withRelations = (table, row) => {
  if (!row) return null;
  if (table !== 'users') return { ...row };
  const dp = tables.driver_profiles.find((p) => String(p.user_account_id) === String(row.id)) || null;
  return {
    ...row,
    roles: { id: row.role_id, name: row.role_id === 3n ? 'DISPATCHER' : row.role_id === 4n ? 'DRIVER' : 'OTHER' },
    driver_profiles: dp ? { ...dp } : null
  };
};

const makeModel = (table) => ({
  findFirst: async ({ where } = {}) => withRelations(table, tables[table].find((r) => matches(r, where))),
  findUnique: async ({ where } = {}) => withRelations(table, tables[table].find((r) => matches(r, where))),
  findMany: async ({ where } = {}) => tables[table].filter((r) => matches(r, where)).map((r) => withRelations(table, r)),
  create: async ({ data }) => {
    for (const col of uniqueCols[table] || []) {
      if (data[col] !== undefined && data[col] !== null && tables[table].some((r) => String(r[col]) === String(data[col]))) {
        throw p2002();
      }
    }
    const row = { id: BigInt(++ids[table]), created_at: new Date(), updated_at: new Date(), ...data };
    tables[table].push(row);
    return withRelations(table, row);
  },
  update: async ({ where, data }) => {
    const row = tables[table].find((r) => matches(r, where));
    if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
    for (const col of uniqueCols[table] || []) {
      if (data[col] !== undefined && tables[table].some((r) => r !== row && String(r[col]) === String(data[col]))) {
        throw p2002();
      }
    }
    Object.assign(row, data);
    return withRelations(table, row);
  }
});

const prismaMock = {
  users: makeModel('users'),
  driver_profiles: makeModel('driver_profiles'),
  trucks: makeModel('trucks'),
  $transaction: async (fn) => {
    const snapshot = JSON.parse(JSON.stringify(tables, (k, v) => (typeof v === 'bigint' ? `__big__${v}` : v)));
    try {
      return await fn(prismaMock);
    } catch (err) {
      const restored = {};
      for (const [t, rows] of Object.entries(snapshot)) {
        restored[t] = rows.map((r) => {
          const o = { ...r };
          for (const [k, v] of Object.entries(o)) {
            if (typeof v === 'string' && v.startsWith('__big__')) o[k] = BigInt(v.slice(7));
            else if (k.endsWith('_at') || k === 'license_expiry' || k.endsWith('_expiry')) o[k] = v ? new Date(v) : v;
          }
          return o;
        });
      }
      tables = restored;
      throw err;
    }
  }
};

require.cache[prismaConfigPath] = {
  id: prismaConfigPath,
  filename: prismaConfigPath,
  loaded: true,
  exports: prismaMock
};
modulePaths.forEach((p) => { delete require.cache[p]; });

const fleetController = require('../controllers/fleetController');
const staffAccountService = require('../services/staffAccountService');

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; }
});

const seed = () => {
  tables = {
    users: [
      { id: 3n, username: 'dispatcher01', full_name: 'Điều phối 01', email: 'dispatcher01@nexlog.vn', phone: '0900000003', role_id: 3n, status: 'ACTIVE', order_form_token: 'disp_dispatcher01_abcdef', password_hash: 'x' },
      { id: 4n, username: 'driver01', full_name: 'Tài xế 01', email: 'driver01@nexlog.vn', phone: '0900000004', role_id: 4n, status: 'ACTIVE', order_form_token: null, password_hash: 'x' }
    ],
    driver_profiles: [
      { id: 10n, user_account_id: 4n, license_number: 'GPLX-EXIST01', license_class: 'C', license_expiry: new Date('2030-01-01T00:00:00.000Z'), status: 'ACTIVE' }
    ],
    trucks: [
      { id: 20n, plate_number: '29H-12345', model: 'Hino 500', allowed_payload: 5000, box_length: 620, box_width: 210, box_height: 220, required_license_class: 'C', inspection_expiry: new Date('2028-01-01T00:00:00.000Z'), insurance_expiry: new Date('2028-01-01T00:00:00.000Z'), status: 'AVAILABLE' }
    ]
  };
  ids = { users: 100, driver_profiles: 200, trucks: 300 };
};

describe('Manager Fleet, Drivers, Trucks & Staff Accounts Bug Fixes (BUG-MGR-01..08)', () => {
  beforeEach(seed);

  test('BUG-MGR-01: Rejects registering Dispatcher/Manager/Admin as Driver with 409 without mutating role_id', async () => {
    const res = createMockRes();
    await fleetController.createDriver({
      body: { full_name: 'Dispatcher 01', phone: '0900000003', email: 'dispatcher01@nexlog.vn', license_number: 'GPLX-NEW999', license_class: 'C', expiry: '2031-01-01' }
    }, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /Tài khoản không phải Driver/i);
    assert.equal(tables.users.find((u) => u.id === 3n).role_id, 3n);
    assert.equal(tables.driver_profiles.length, 1);
  });

  test('BUG-MGR-01: createDriver is atomic - failed profile insert leaves no orphan user', async () => {
    const before = tables.users.length;
    const res = createMockRes();
    // license_number trùng sẽ bị chặn trước; ép lỗi trong transaction bằng cách làm trùng user_account_id không xảy ra -> dùng lỗi DB giả
    const origCreate = prismaMock.driver_profiles.create;
    prismaMock.driver_profiles.create = async () => { throw new Error('boom'); };
    try {
      await fleetController.createDriver({
        body: { full_name: 'Tài xế Mới', phone: '0911000111', license_number: 'GPLX-ATOMIC1', license_class: 'C', expiry: '2031-01-01' }
      }, res);
    } finally {
      prismaMock.driver_profiles.create = origCreate;
    }
    assert.equal(res.statusCode, 500);
    assert.equal(tables.users.length, before);
  });

  test('BUG-MGR-02: updateDriverProfile saves expiry sent as `expiry` field', async () => {
    const res = createMockRes();
    await fleetController.updateDriverProfile({ params: { id: '10' }, body: { license_class: 'C', expiry: '2031-01-01' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.profile.license_expiry, '2031-01-01');
  });

  test('BUG-MGR-03: Enforces required/unique/valid license fields, forbids re-registration, and keeps user fields read-only on edit', async () => {
    const run = async (body) => { const r = createMockRes(); await fleetController.createDriver({ body }, r); return r; };
    assert.equal((await run({ full_name: 'N', phone: '0911223344', license_class: 'C', expiry: '2030-05-05' })).statusCode, 400);
    assert.equal((await run({ full_name: 'N', phone: '0911223344', license_number: 'G-888', license_class: 'Z', expiry: '2030-05-05' })).statusCode, 400);
    assert.equal((await run({ full_name: 'N', phone: '0911223344', license_number: 'G-888', license_class: 'C', expiry: '2020-01-01' })).statusCode, 400);
    assert.equal((await run({ full_name: 'N', phone: '0911223344', license_number: 'GPLX-EXIST01', license_class: 'C', expiry: '2030-05-05' })).statusCode, 409);
    assert.equal((await run({ full_name: 'Tài xế 01', phone: '0900000004', license_number: 'GPLX-ANOTHER', license_class: 'C', expiry: '2030-05-05' })).statusCode, 409);

    const res6 = createMockRes();
    await fleetController.updateDriverProfile({
      params: { id: '10' },
      body: { full_name: 'Hacked Name', phone: '0999999999', email: 'hacked@nexlog.vn', license_class: 'FC' }
    }, res6);
    assert.equal(res6.statusCode, 200);
    const u = tables.users.find((x) => x.id === 4n);
    assert.equal(u.full_name, 'Tài xế 01');
    assert.equal(u.phone, '0900000004');
    assert.equal(u.email, 'driver01@nexlog.vn');
  });

  test('BUG-MGR-04: Driver staff account needs real license data, rolls back atomically, and syncs profile/token on role switch', async () => {
    await assert.rejects(
      () => staffAccountService.createStaffAccount({ username: 'drv_test_1', full_name: 'Driver Test 1', email: 'drv1@nexlog.vn', phone: '0912345678', role: 'DRIVER', password: 'Password@123' }),
      (err) => err.statusCode === 400
    );

    const before = tables.users.length;
    await assert.rejects(
      () => staffAccountService.createStaffAccount({ username: 'drv_dup_lic', full_name: 'Dup', email: 'drvdup@nexlog.vn', phone: '0912345678', role: 'DRIVER', password: 'Password@123', license_number: 'GPLX-EXIST01', license_class: 'C', license_expiry: '2030-12-31' }),
      (err) => err.statusCode === 409
    );
    assert.equal(tables.users.length, before);

    const toDriver = await staffAccountService.updateStaffAccount(3, { role: 'DRIVER', license_number: 'GPLX-SWITCH01', license_class: 'FC', license_expiry: '2031-06-30' });
    assert.equal(Number(toDriver.role_id), 4);
    assert.equal(toDriver.order_form_token, null);
    assert.equal(toDriver.driver_profile.license_number, 'GPLX-SWITCH01');

    const toDisp = await staffAccountService.updateStaffAccount(3, { role: 'DISPATCHER' });
    assert.equal(Number(toDisp.role_id), 3);
    assert.ok(toDisp.order_form_token);
    assert.equal(toDisp.driver_profile.status, 'INACTIVE');
  });

  test('BUG-MGR-05: Invalid status values are rejected with 400 instead of coerced to ACTIVE', async () => {
    await assert.rejects(
      () => staffAccountService.createStaffAccount({ username: 'disp_bad_st', full_name: 'Bad', email: 'badst@nexlog.vn', role: 'DISPATCHER', status: 'INACTIVE', password: 'Password@123' }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(() => staffAccountService.updateStaffAccount(3, { status: 'abc' }), (err) => err.statusCode === 400);
  });

  test('BUG-MGR-06: Enforces >= 8 char password policy, random password when omitted, never returns initial_password', async () => {
    await assert.rejects(
      () => staffAccountService.createStaffAccount({ username: 'disp_short', full_name: 'Short', email: 'shortpwd@nexlog.vn', role: 'DISPATCHER', password: '1' }),
      (err) => err.statusCode === 400
    );
    const created = await staffAccountService.createStaffAccount({ username: 'disp_rand_pwd', full_name: 'Random', email: 'randpwd@nexlog.vn', role: 'DISPATCHER' });
    assert.equal(created.initial_password, undefined);
  });

  test('BUG-MGR-07: Null or wrong-type fields and missing full_name return 400 instead of 500 TypeError', async () => {
    await assert.rejects(() => staffAccountService.updateStaffAccount(3, { full_name: null }), (err) => err.statusCode === 400);
    await assert.rejects(
      () => staffAccountService.createStaffAccount({ username: 'disp_bad_phone', full_name: 'Bad Phone', email: 'badphone@nexlog.vn', phone: 123456789, role: 'DISPATCHER', password: 'Password@123' }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => staffAccountService.createStaffAccount({ username: 'disp_no_name', email: 'noname@nexlog.vn', role: 'DISPATCHER', password: 'Password@123' }),
      (err) => err.statusCode === 400
    );
  });

  test('BUG-MGR-08: createTruck & updateTruck validate status (forbidding ON_TRIP), positive numbers, and required valid dates', async () => {
    const ok = { allowed_payload: 5000, box_length: 620, box_width: 210, box_height: 220, inspection_expiry: '2029-01-01', insurance_expiry: '2029-01-01' };
    const cases = [
      { plate_number: '29H-00001', ...ok, status: 'ON_TRIP' },
      { plate_number: '29H-00002', ...ok, status: 'FOO' },
      { plate_number: '29H-00003', ...ok, allowed_payload: 0 },
      { plate_number: '29H-00004', ...ok, allowed_payload: -100 },
      { plate_number: '29H-00005', ...ok, allowed_payload: 'abc' },
      { plate_number: '29H-00006', allowed_payload: 5000, inspection_expiry: '2029-01-01', insurance_expiry: '2029-01-01' },
      { plate_number: '29H-00007', ...ok, inspection_expiry: 'not-a-date' },
      { plate_number: '29H-00008', allowed_payload: 5000, box_length: 620, box_width: 210, box_height: 220 }
    ];
    for (const body of cases) {
      const res = createMockRes();
      await fleetController.createTruck({ body }, res);
      assert.equal(res.statusCode, 400, `Expected 400 for ${body.plate_number}`);
    }
    const putRes = createMockRes();
    await fleetController.updateTruck({ params: { id: '20' }, body: { status: 'ON_TRIP' } }, putRes);
    assert.equal(putRes.statusCode, 400);

    const goodRes = createMockRes();
    await fleetController.createTruck({ body: { plate_number: '29H-99999', ...ok } }, goodRes);
    assert.equal(goodRes.statusCode, 201);
  });
});
