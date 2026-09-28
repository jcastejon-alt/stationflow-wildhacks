import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.js';

async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'stationflow-student-login-'));
  const dbPath = join(dir, 'demo.sqlite');
  let realTime = Date.parse('2026-09-28T17:00:00Z');
  let app, server, base;
  const open = async () => {
    app = createApp({ dbPath, now: () => new Date('2026-09-28T17:00:00Z'), realNow: () => realTime, ...options });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    base = `http://127.0.0.1:${server.address().port}/api`;
  };
  const close = async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
    app.locals.close();
  };
  await open();
  t.after(async () => { await close(); await rm(dir, { recursive: true, force: true }); });
  const request = async (path, { method = 'GET', body, cookie, headers = {} } = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  return {
    request, dbPath,
    student: (studentId, cookie, headers = {}) => request('/auth/student', { method: 'POST', body: { studentId }, cookie, headers }),
    staff: (identifier, password = 'CampusDemo!26', cookie) => request('/auth/login', { method: 'POST', body: { identifier, password }, cookie }),
    advance: (milliseconds) => { realTime += milliseconds; },
    restart: async (offlineEdit) => { await close(); if (offlineEdit) offlineEdit(dbPath); await open(); },
  };
}
const error = (result, status, code) => {
  assert.equal(result.status, status, JSON.stringify(result.body));
  assert.equal(result.body.error.code, code);
  assert.equal(result.cookie, undefined);
};

test('ID-only student selector permits only the two fictional profiles and preserves numeric/legacy aliases', async (t) => {
  const f = await fixture(t);
  for (const [entered, numeric, stable] of [['10001', '10001', 'student-demo-1'], ['D10001', '10001', 'student-demo-1'], ['10002', '10002', 'student-demo-2'], ['d10002', '10002', 'student-demo-2']]) {
    const result = await f.student(entered);
    assert.equal(result.status, 200);
    assert.equal(result.body.user.id, stable);
    assert.equal(result.body.user.studentId, numeric);
    assert.equal(result.body.user.role, 'student');
    assert.deepEqual(result.body.user.stationIds, []);
    assert.equal(result.body.demo, true);
    assert.equal(result.body.authMode, 'demo_student_id');
    assert.match(result.body.notice, /Fictional public demo profiles/);
    assert.match(result.body.notice, /does not verify/);
    assert.match(result.headers.get('set-cookie'), /HttpOnly/);
    assert.match(result.headers.get('set-cookie'), /SameSite=Strict/);
  }
  for (const rejected of ['1234567', '10003', '00010001', 'manager', 'frothy', 'starbucks', 'QUEUE-DEMO']) error(await f.student(rejected), 401, 'INVALID_DEMO_STUDENT');
  error(await f.student(10001), 400, 'INVALID_INPUT');
});

test('student entry rejects injected fields and cannot grant staff privileges; account switching revokes the prior session', async (t) => {
  const f = await fixture(t);
  for (const injected of [{ role: 'manager' }, { userId: 'manager-demo' }, { stationIds: ['hub'] }, { identifier: 'manager' }, { password: 'CampusDemo!26' }]) error(await f.request('/auth/student', { method: 'POST', body: { studentId: '10001', ...injected } }), 400, 'INVALID_INPUT');
  const manager = await f.staff('manager');
  assert.equal(manager.status, 200);
  const student = await f.student('10001', manager.cookie);
  assert.equal(student.status, 200);
  assert.notEqual(student.cookie, manager.cookie);
  assert.equal((await f.request('/auth/me', { cookie: manager.cookie })).body.user, null);
  error(await f.request('/staff/orders', { cookie: student.cookie }), 403, 'STAFF_REQUIRED');
  error(await f.request('/staff/demo-clock', { method: 'PATCH', body: { mode: 'lunch' }, cookie: student.cookie }), 403, 'STAFF_REQUIRED');
  const rotated = await f.student('10002', student.cookie);
  assert.equal((await f.request('/auth/me', { cookie: student.cookie })).body.user, null);
  assert.equal((await f.request('/auth/me', { cookie: rotated.cookie })).body.user.studentId, '10002');
  await f.request('/auth/logout', { method: 'POST', body: {}, cookie: rotated.cookie });
  assert.equal((await f.request('/auth/me', { cookie: rotated.cookie })).body.user, null);
  const expires = await f.student('10001');
  f.advance(8 * 3600000 + 1);
  assert.equal((await f.request('/auth/me', { cookie: expires.cookie })).body.user, null);
});

test('both student selector and password login share failure throttling and its expiry', async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 4; i++) error(await f.student('99999'), 401, 'INVALID_DEMO_STUDENT');
  for (let i = 0; i < 4; i++) error(await f.staff('hub', 'wrong-password'), 401, 'INVALID_CREDENTIALS');
  const throttled = await f.student('10001');
  error(throttled, 429, 'LOGIN_THROTTLED');
  assert.equal(throttled.headers.get('retry-after'), '900');
  error(await f.staff('manager'), 429, 'LOGIN_THROTTLED');
  f.advance(900001);
  assert.equal((await f.student('10001')).status, 200);
  assert.equal((await f.staff('manager')).status, 200);
});

test('student selector inherits HTTPS origin protection and Secure cookies', async (t) => {
  const publicOrigin = 'https://stationflow-demo.example';
  const f = await fixture(t, { publicOrigin });
  error(await f.student('10001'), 403, 'ORIGIN_FORBIDDEN');
  error(await f.student('10001', undefined, { Origin: 'https://evil.example', 'X-Forwarded-Host': 'stationflow-demo.example', 'X-Forwarded-Proto': 'https' }), 403, 'ORIGIN_FORBIDDEN');
  error(await f.student('10001', undefined, { Origin: publicOrigin, 'Sec-Fetch-Site': 'cross-site' }), 403, 'ORIGIN_FORBIDDEN');
  const accepted = await f.student('10001', undefined, { Origin: publicOrigin });
  assert.equal(accepted.status, 200);
  assert.match(accepted.headers.get('set-cookie'), /; Secure(?:;|$)/);
});

test('separate Frothy and Starbucks staff accounts require passwords and stay within their own assignments', async (t) => {
  const f = await fixture(t);
  for (const [identifier, own, other] of [['frothy', 'frothy', 'starbucks'], ['starbucks', 'starbucks', 'frothy']]) {
    error(await f.student(identifier), 401, 'INVALID_DEMO_STUDENT');
    error(await f.staff(identifier, 'wrong'), 401, 'INVALID_CREDENTIALS');
    const result = await f.staff(identifier);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.user.stationIds, [own]);
    assert.equal((await f.request(`/staff/orders?stationId=${own}`, { cookie: result.cookie })).status, 200);
    error(await f.request(`/staff/orders?stationId=${other}`, { cookie: result.cookie }), 403, 'STATION_FORBIDDEN');
    error(await f.request(`/staff/stations/${other}`, { method: 'PATCH', body: { paused: true }, cookie: result.cookie }), 403, 'STATION_FORBIDDEN');
  }
  assert.deepEqual((await f.staff('coffee')).body.user.stationIds, ['frothy', 'starbucks']);
  for (const alias of ['D10001', '10001', 'D10002', '10002']) {
    const result = await f.staff(alias);
    assert.equal(result.status, 200);
    assert.equal(result.body.user.role, 'student');
    assert.ok(['10001', '10002'].includes(result.body.user.studentId));
  }
});

test('numeric ID migration preserves stable ownership, old cookies, accepted snapshots, and idempotency', async (t) => {
  const f = await fixture(t);
  const login = await f.staff('D10001');
  const slotId = (await f.request('/slots?stationId=hub')).body.slots[0].id;
  const payload = { stationId: 'hub', itemId: 'seasoned-fries', selections: {}, exclusions: [], slotId, paymentMode: 'regular', paymentAuthorized: true, idempotencyKey: 'preserve-old-demo-identity' };
  const created = await f.request('/orders', { method: 'POST', body: payload, cookie: login.cookie });
  assert.equal(created.status, 201);
  let original;
  await f.restart((dbPath) => {
    const db = new DatabaseSync(dbPath);
    const row = db.prepare('SELECT data FROM users WHERE id=?').get('student-demo-1');
    db.prepare('UPDATE users SET identifier=?,data=? WHERE id=?').run('d10001', JSON.stringify({ ...JSON.parse(row.data), studentId: 'D10001' }), 'student-demo-1');
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(created.body.order.id);
    const historicalPayment = { ...JSON.parse(order.payment), studentId: 'D10001' };
    db.prepare('UPDATE orders SET payment=? WHERE id=?').run(JSON.stringify(historicalPayment), order.id);
    original = { snapshot: order.snapshot, canonical: order.canonical, payment: JSON.stringify(historicalPayment), owner: order.owner_id, key: order.idempotency_key };
    db.close();
  });
  const session = await f.request('/auth/me', { cookie: login.cookie });
  assert.equal(session.body.user.id, 'student-demo-1');
  assert.equal(session.body.user.studentId, '10001');
  const newLogin = await f.student('10001');
  const replay = await f.request('/orders', { method: 'POST', body: payload, cookie: newLogin.cookie });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, created.body.order.id);
  assert.equal(replay.body.order.payment.studentId, 'D10001');
  assert.deepEqual((await f.request('/my/orders', { cookie: newLogin.cookie })).body.orders.map((order) => order.id), [created.body.order.id]);
  const other = await f.student('10002');
  error(await f.request(`/orders/${created.body.order.token}`, { cookie: other.cookie }), 404, 'ORDER_NOT_FOUND');
  const next = await f.request('/orders', { method: 'POST', body: { ...payload, idempotencyKey: 'new-numeric-profile-order' }, cookie: newLogin.cookie });
  assert.equal(next.body.order.payment.studentId, '10001');
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  const stored = db.prepare('SELECT * FROM orders WHERE id=?').get(created.body.order.id);
  assert.equal(stored.snapshot, original.snapshot);
  assert.equal(stored.canonical, original.canonical);
  assert.equal(stored.payment, original.payment);
  assert.equal(stored.owner_id, original.owner);
  assert.equal(stored.idempotency_key, original.key);
  assert.equal(db.prepare('SELECT identifier FROM users WHERE id=?').get('student-demo-1').identifier, '10001');
  db.close();
});

test('all new online tickets snapshot their linked fictional ID, including cafeteria; walk-ins remain unnamed', async (t) => {
  const f = await fixture(t);
  const student = await f.student('D10001');
  assert.equal(student.body.user.displayName, 'Student 10001');
  const manager = await f.staff('manager');
  const slotId = (await f.request('/slots?stationId=hamburger')).body.slots[0].id;
  const payload = { idempotencyKey: 'cafeteria-linked-profile', stationId: 'hamburger', itemId: 'build-your-hamburger', selections: { 'hamburger-bun': ['burger-brioche'] }, exclusions: [], slotId, paymentMode: 'regular' };
  const online = await f.request('/orders', { method: 'POST', body: payload, cookie: student.cookie });
  assert.equal(online.status, 201);
  assert.equal(online.body.order.studentId, '10001');
  assert.equal(online.body.order.payment.status, 'not_required');
  assert.equal(online.body.order.payment.studentId, undefined);
  error(await f.request('/orders', { method: 'POST', body: { ...payload, idempotencyKey: 'forged-student-id', studentId: '10002' }, cookie: student.cookie }), 400, 'INVALID_INPUT');
  const walkIn = await f.request('/staff/orders', { method: 'POST', body: payload, cookie: manager.cookie });
  assert.equal(walkIn.status, 201);
  assert.equal(walkIn.body.order.studentId, undefined);
  const staffList = await f.request('/staff/orders?stationId=hamburger', { cookie: manager.cookie });
  assert.equal(staffList.body.orders.find((order) => order.id === online.body.order.id).studentId, '10001');
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  assert.equal(JSON.parse(db.prepare('SELECT snapshot FROM orders WHERE id=?').get(online.body.order.id).snapshot).studentId, '10001');
  db.close();
  const rush = await f.request('/staff/demo-rush', { method: 'POST', body: { stationId: 'hub', idempotencyKey: 'rush-linked-profile' }, cookie: manager.cookie });
  assert.equal(rush.body.created, 3);
  assert.ok(rush.body.orders.every((order) => order.studentId === 'QUEUE-DEMO' && order.simulated));
});

test('retired legacy items cannot be reactivated or ordered anew, while accepted retries preserve their ticket', async (t) => {
  const f = await fixture(t);
  const student = await f.student('10001');
  const coffee = await f.staff('coffee');
  const slotId = (await f.request('/slots?stationId=frothy')).body.slots[0].id;
  const payload = { idempotencyKey: 'legacy-accepted-frothy', stationId: 'frothy', itemId: 'frothy-coffee', selections: {}, exclusions: [], slotId, paymentMode: 'regular', paymentAuthorized: true };
  const accepted = await f.request('/orders', { method: 'POST', body: payload, cookie: student.cookie });
  assert.equal(accepted.status, 201);
  let preservedSnapshot;
  await f.restart((dbPath) => {
    const db = new DatabaseSync(dbPath);
    const current = JSON.parse(db.prepare('SELECT data FROM items WHERE id=?').get('frothy-coffee').data);
    const legacy = { ...current, id: 'frothy-tea', name: 'Historical demo tea' };
    db.prepare('INSERT INTO items(id,station_id,data) VALUES (?,?,?)').run('frothy-tea', 'frothy', JSON.stringify(legacy));
    const order = db.prepare('SELECT snapshot,canonical FROM orders WHERE id=?').get(accepted.body.order.id);
    preservedSnapshot = JSON.stringify({ ...JSON.parse(order.snapshot), itemId: 'frothy-tea', itemName: legacy.name });
    const canonical = { ...JSON.parse(order.canonical), itemId: 'frothy-tea' };
    db.prepare('UPDATE orders SET item_id=?,snapshot=?,canonical=? WHERE id=?').run('frothy-tea', preservedSnapshot, JSON.stringify(canonical), accepted.body.order.id);
    db.close();
  });
  const legacyPayload = { ...payload, itemId: 'frothy-tea' };
  assert.ok(!(await f.request('/catalog')).body.items.some((item) => item.id === 'frothy-tea'));
  error(await f.request('/staff/items/frothy-tea', { method: 'PATCH', body: { available: true }, cookie: coffee.cookie }), 409, 'ITEM_RETIRED');
  error(await f.request('/orders', { method: 'POST', body: { ...legacyPayload, idempotencyKey: 'new-retired-order' }, cookie: student.cookie }), 409, 'ITEM_RETIRED');
  // Independently verify that a stale/inconsistent available flag cannot bypass the order guard.
  const db = new DatabaseSync(f.dbPath);
  const retired = JSON.parse(db.prepare('SELECT data FROM items WHERE id=?').get('frothy-tea').data);
  assert.equal(retired.retired, true);
  assert.equal(retired.available, false);
  db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify({ ...retired, available: true }), 'frothy-tea');
  db.close();
  error(await f.request('/orders', { method: 'POST', body: { ...legacyPayload, idempotencyKey: 'new-retired-inconsistent-flag' }, cookie: student.cookie }), 409, 'ITEM_RETIRED');
  const replay = await f.request('/orders', { method: 'POST', body: legacyPayload, cookie: student.cookie });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, accepted.body.order.id);
  assert.equal(replay.body.order.itemName, 'Historical demo tea');
  const verify = new DatabaseSync(f.dbPath, { readOnly: true });
  assert.equal(verify.prepare('SELECT snapshot FROM orders WHERE id=?').get(accepted.body.order.id).snapshot, preservedSnapshot);
  verify.close();
});
