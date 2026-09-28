import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.js';

// All writes in this suite target fresh temporary databases, never the rehearsal database.
async function fixture(t, initial = '2026-09-28T13:30:00Z', cafeteriaHours) {
  const dir = await mkdtemp(join(tmpdir(), 'stationflow-cafeteria-'));
  const dbPath = join(dir, 'test.sqlite');
  let now = Date.parse(initial), app, server, base;
  const cookies = new Map();
  async function open() {
    app = createApp({ dbPath, now: () => now, realNow: () => Date.parse('2026-09-28T12:00:00Z'), cafeteriaHours, staticDir: dir });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    base = `http://127.0.0.1:${server.address().port}/api`;
  }
  async function close() { if (server) { await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); }); app.locals.close(); server = null; } }
  const db = (run) => { const connection = new DatabaseSync(dbPath); try { return run(connection); } finally { connection.close(); } };
  const request = async (path, method = 'GET', body, who = path.startsWith('/staff/') ? 'manager' : '10001') => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookies.has(who) ? { Cookie: cookies.get(who) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  await open();
  t.after(async () => { await close(); await rm(dir, { recursive: true, force: true }); });
  for (const identifier of ['10001', 'manager', 'cafeteria', 'hub']) {
    const result = await request('/auth/login', 'POST', { identifier, password: 'CampusDemo!26' }, 'none');
    assert.equal(result.status, 200);
    cookies.set(identifier, result.headers.get('set-cookie').split(';')[0]);
  }
  const slots = async (stationId, mode = 'scheduled') => (await request(`/slots?stationId=${stationId}&timingMode=${mode}`)).body;
  const body = async (stationId = 'omelet', mode = 'asap', overrides = {}) => {
    const catalog = (await request('/catalog')).body;
    const item = catalog.items.find((item) => item.stationId === stationId);
    return { idempotencyKey: randomUUID(), stationId, itemId: item.id, selections: Object.fromEntries(item.groups.filter((group) => group.min).map((group) => [group.id, group.options.slice(0, group.min).map((option) => option.id)])), exclusions: [], paymentMode: 'regular', timingMode: mode, ...(mode === 'scheduled' ? { slotId: (await slots(stationId)).slots[0]?.id } : {}), ...overrides };
  };
  return { request, slots, body, db, setTime: (time) => { now = typeof time === 'number' ? time : Date.parse(time); }, restart: async (mutate) => { await close(); if (mutate) db(mutate); await open(); } };
}
function error(result, code) { assert.equal(result.status, code === 'INVALID_TIMING_MODE' || code === 'INVALID_INPUT' ? 400 : 409, JSON.stringify(result.body)); assert.equal(result.body.error.code, code); }

// Same-day breakfast scheduling intentionally differs from the unchanged retail horizon.
test('before opening, omelets can be scheduled across the whole breakfast service but Right now is closed', async (t) => {
  const f = await fixture(t, '2026-09-28T12:00:00Z'); // 07:00 Central
  const morning = await f.slots('omelet');
  assert.equal(morning.service.open, false);
  assert.equal(morning.service.canOrderNow, false);
  assert.equal(morning.service.canSchedule, true);
  assert.equal(morning.service.acceptingScheduled, true);
  assert.equal(morning.slots.length, 18);
  assert.equal(morning.slots[0].startsAt, '2026-09-28T13:00:00.000Z');
  assert.equal(morning.slots.at(-1).endsAt, '2026-09-28T16:00:00.000Z');
  assert.equal((await f.slots('omelet', 'asap')).slots.length, 0);
  error(await f.request('/orders', 'POST', await f.body()), 'SERVICE_CLOSED');
  const order = await f.request('/orders', 'POST', await f.body('omelet', 'scheduled', { slotId: morning.slots.at(-1).id }));
  assert.equal(order.status, 201);
  assert.equal(order.body.order.timingMode, 'scheduled');
  assert.equal(order.body.order.slot.startsAt, '2026-09-28T15:50:00.000Z');
  error(await f.request('/orders', 'POST', await f.body('omelet', 'scheduled', { slotId: `omelet:${Date.parse('2026-09-29T13:00:00Z')}` })), 'SLOT_UNAVAILABLE');
  const burger = await f.slots('hamburger');
  assert.equal(burger.service.canSchedule, false);
  assert.equal(burger.slots.length, 0);
});

test('whole-window and exact 11 AM boundaries prevent omelet spillover or early hamburger acceptance', async (t) => {
  const f = await fixture(t, '2026-09-28T15:48:00Z'); // 10:48, final legal breakfast request boundary
  const last = (await f.slots('omelet')).slots;
  assert.equal(last.length, 1);
  assert.equal(last[0].startsAt, '2026-09-28T15:50:00.000Z');
  assert.equal(last[0].endsAt, '2026-09-28T16:00:00.000Z');
  assert.equal((await f.request('/orders', 'POST', await f.body('omelet', 'scheduled'))).status, 201);
  f.setTime('2026-09-28T15:48:00.001Z');
  assert.equal((await f.slots('omelet')).slots.length, 0);
  f.setTime('2026-09-28T15:59:00Z');
  error(await f.request('/orders', 'POST', await f.body()), 'SERVICE_CLOSED');
  error(await f.request('/orders', 'POST', await f.body('hamburger', 'scheduled', { slotId: `hamburger:${Date.parse('2026-09-28T16:10:00Z')}` })), 'SERVICE_CLOSED');
  error(await f.request('/staff/orders', 'POST', await f.body('hamburger')), 'SERVICE_CLOSED');
  f.setTime('2026-09-28T16:00:00Z');
  assert.equal((await f.slots('omelet')).slots.length, 0);
  const result = await f.request('/orders', 'POST', await f.body('hamburger'));
  assert.equal(result.status, 201);
  assert.equal(result.body.order.slot.startsAt, '2026-09-28T16:10:00.000Z');
  assert.equal(result.body.order.payment.status, 'not_required');
  error(await f.request('/orders', 'POST', await f.body('hamburger', 'scheduled', { slotId: `hamburger:${Date.parse('2026-09-28T15:50:00Z')}` })), 'SLOT_UNAVAILABLE');
  error(await f.request('/orders', 'POST', await f.body('omelet', 'scheduled', { slotId: `omelet:${Date.parse('2026-09-28T16:10:00Z')}` })), 'SERVICE_CLOSED');
});

test('accepted breakfast survives the grill changeover and stays visible and actionable in the shared staff queue', async (t) => {
  const f = await fixture(t);
  const payload = await f.body();
  const breakfast = (await f.request('/orders', 'POST', payload)).body.order;
  f.setTime('2026-09-28T16:00:00Z');
  const burger = (await f.request('/orders', 'POST', await f.body('hamburger'))).body.order;
  assert.equal(burger.physicalStationId, 'cafeteria-grill');
  assert.equal(burger.queueGroupId, breakfast.queueGroupId);
  assert.equal(burger.queueAhead, 1);
  const staff = await f.request('/staff/orders?stationId=hamburger', 'GET', undefined, 'cafeteria');
  assert.deepEqual(staff.body.orders.map((order) => order.id), [breakfast.id, burger.id]);
  const catalog = (await f.request('/catalog')).body;
  assert.equal(catalog.stations.find((station) => station.id === 'hamburger').queue.active, 2);
  assert.equal(catalog.stations.find((station) => station.id === 'omelet').queue.active, 2);
  assert.deepEqual((await f.request('/orders', 'POST', payload)).body.order.slot, breakfast.slot);
  for (const [expectedStatus, status] of [['received', 'entered'], ['entered', 'preparing'], ['preparing', 'ready'], ['ready', 'picked_up']]) {
    assert.equal((await f.request(`/staff/orders/${breakfast.id}`, 'PATCH', { expectedStatus, status }, 'cafeteria')).status, 200);
    if (status === 'ready') {
      assert.equal((await f.request(`/orders/${burger.token}`)).body.order.queueAhead, 0);
      const grill = (await f.request('/catalog')).body.stations.find((station) => station.id === 'hamburger');
      assert.equal(grill.queue.ready, 1);
      assert.equal(grill.queue.active, 1);
    }
  }
  assert.equal((await f.request(`/orders/${burger.token}`)).body.order.queueAhead, 0);
});

test('sandwiches continue through afternoon and use complete windows through closing', async (t) => {
  const f = await fixture(t, '2026-09-28T19:00:00Z');
  for (const time of ['2026-09-28T19:00:00Z', '2026-09-28T21:00:00Z']) {
    f.setTime(time);
    const result = await f.slots('sandwich');
    assert.equal(result.service.open, true);
    assert.equal(result.service.canOrderNow, true);
    assert.equal(result.slots.at(-1).endsAt, '2026-09-29T01:00:00.000Z');
    assert.equal((await f.request('/orders', 'POST', await f.body('sandwich'))).status, 201);
  }
  f.setTime('2026-09-29T00:48:00Z');
  assert.equal((await f.slots('sandwich')).slots.length, 1);
  f.setTime('2026-09-29T00:48:00.001Z');
  assert.equal((await f.slots('sandwich')).slots.length, 0);
  f.setTime('2026-09-29T01:00:00Z');
  error(await f.request('/orders', 'POST', await f.body('sandwich')), 'SERVICE_CLOSED');
});

test('ASAP resolves once under concurrent same-key retries and replays after closure, pause, and stock changes', async (t) => {
  const f = await fixture(t);
  const payload = await f.body();
  const attempts = await Promise.all([f.request('/orders', 'POST', payload), f.request('/orders', 'POST', payload)]);
  assert.deepEqual(attempts.map((result) => result.status).sort(), [200, 201]);
  const order = attempts[0].body.order;
  assert.equal(order.id, attempts[1].body.order.id);
  const stored = f.db((db) => JSON.parse(db.prepare('SELECT canonical FROM orders WHERE id=?').get(order.id).canonical));
  assert.equal(stored.timingMode, 'asap');
  assert.equal(stored.slotId, undefined);
  await f.request('/staff/stations/omelet', 'PATCH', { paused: true });
  await f.request('/staff/items/build-your-omelet', 'PATCH', { available: false });
  f.setTime('2026-09-28T16:00:00Z');
  const replay = await f.request('/orders', 'POST', payload);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, order.id);
  assert.deepEqual(replay.body.order.slot, order.slot);
  error(await f.request('/orders', 'POST', { ...payload, timingMode: 'scheduled', slotId: order.slot.id }), 'IDEMPOTENCY_CONFLICT');
  error(await f.request('/orders', 'POST', { ...payload, slotId: order.slot.id }), 'INVALID_TIMING_MODE');
});

test('ASAP capacity races keep the walk-in reservation and do not use past windows', async (t) => {
  const f = await fixture(t, '2026-09-28T15:48:00Z');
  await f.request('/staff/stations/omelet', 'PATCH', { capacity: 2, onlineCapacity: 1 });
  const attempts = await Promise.all([f.body(), f.body()]);
  const results = await Promise.all(attempts.map((body) => f.request('/orders', 'POST', body)));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  error(results.find((result) => result.status === 409), 'SLOT_FULL');
  await f.request('/staff/stations/omelet', 'PATCH', { paused: true });
  const service = (await f.slots('omelet', 'asap')).service;
  assert.equal(service.canOrderNow, true);
  assert.equal(service.acceptingOrders, false);
  assert.equal((await f.request('/staff/orders', 'POST', await f.body(), 'cafeteria')).status, 201);
  error(await f.request('/staff/orders', 'POST', await f.body(), 'cafeteria'), 'SLOT_FULL');
  f.setTime('2026-09-28T15:48:00.001Z');
  error(await f.request('/staff/orders', 'POST', await f.body(), 'cafeteria'), 'SERVICE_CLOSED');
});

test('ASAP skips reserved capacity and future scheduled tickets are not counted ahead of earlier pickup', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/omelet', 'PATCH', { capacity: 1, onlineCapacity: 1 });
  const slots = (await f.slots('omelet')).slots;
  const later = (await f.request('/orders', 'POST', await f.body('omelet', 'scheduled', { slotId: slots.at(-1).id }))).body.order;
  const first = (await f.request('/orders', 'POST', await f.body())).body.order;
  const second = (await f.request('/orders', 'POST', await f.body())).body.order;
  assert.equal(first.slot.id, slots[0].id);
  assert.equal(second.slot.id, slots[1].id);
  assert.equal(first.queueAhead, 0);
  assert.equal(second.queueAhead, 1);
  assert.equal((await f.request(`/orders/${later.token}`)).body.order.queueAhead, 2);
});

test('persistent demo permissions migrate while legacy scheduled canonical values and snapshots stay byte-for-byte intact', async (t) => {
  const f = await fixture(t);
  const payload = await f.body('omelet', 'scheduled');
  delete payload.timingMode;
  const order = (await f.request('/orders', 'POST', payload)).body.order;
  let before;
  await f.restart((db) => {
    const row = db.prepare('SELECT * FROM orders WHERE id=?').get(order.id);
    const oldSnapshot = JSON.parse(row.snapshot);
    delete oldSnapshot.timingMode; delete oldSnapshot.physicalStationId; delete oldSnapshot.queueGroupId;
    db.prepare('UPDATE orders SET snapshot=? WHERE id=?').run(JSON.stringify(oldSnapshot), order.id);
    for (const id of ['staff-cafeteria', 'manager-demo']) {
      const profile = JSON.parse(db.prepare('SELECT data FROM users WHERE id=?').get(id).data);
      profile.stationIds = profile.stationIds.filter((station) => station !== 'hamburger');
      db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(profile), id);
    }
    before = db.prepare('SELECT snapshot,canonical,payment,owner_id FROM orders WHERE id=?').get(order.id);
  });
  f.setTime('2026-09-28T16:00:00Z');
  for (const who of ['cafeteria', 'manager']) assert.ok((await f.request('/auth/me', 'GET', undefined, who)).body.user.stationIds.includes('hamburger'));
  assert.deepEqual((await f.request('/auth/me', 'GET', undefined, 'hub')).body.user.stationIds, ['hub']);
  assert.equal((await f.request('/staff/orders?stationId=hamburger', 'GET', undefined, 'hub')).status, 403);
  for (const retry of [payload, { ...payload, timingMode: 'scheduled' }]) {
    const response = await f.request('/orders', 'POST', retry);
    assert.equal(response.status, 200);
    assert.equal(response.body.order.id, order.id);
    assert.deepEqual(response.body.order.slot, order.slot);
  }
  assert.deepEqual(f.db((db) => db.prepare('SELECT snapshot,canonical,payment,owner_id FROM orders WHERE id=?').get(order.id)), before);
  const staffBurger = await f.request('/staff/orders', 'POST', await f.body('hamburger'), 'cafeteria');
  assert.equal(staffBurger.status, 201);
  assert.equal(staffBurger.body.order.studentId, undefined);
});

test('old breakfast reservations share the physical grill capacity with the new hamburger menu', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/omelet', 'PATCH', { capacity: 1, onlineCapacity: 1 });
  const order = (await f.request('/orders', 'POST', await f.body('omelet', 'scheduled'))).body.order;
  // Represent an accepted ticket from the previous version, which used cafeteria meal blocks.
  await f.restart((db) => {
    const row = db.prepare('SELECT snapshot,canonical FROM orders WHERE id=?').get(order.id);
    const snapshot = JSON.parse(row.snapshot), canonical = JSON.parse(row.canonical);
    const slotId = `omelet:${Date.parse('2026-09-28T16:10:00Z')}`;
    snapshot.slot.id = slotId; snapshot.slot.startsAt = '2026-09-28T16:10:00.000Z'; snapshot.slot.endsAt = '2026-09-28T16:20:00.000Z'; canonical.slotId = slotId;
    db.prepare('UPDATE orders SET slot_id=?,snapshot=?,canonical=? WHERE id=?').run(slotId, JSON.stringify(snapshot), JSON.stringify(canonical), order.id);
  });
  f.setTime('2026-09-28T16:00:00Z');
  const slots = (await f.slots('hamburger')).slots;
  assert.equal(slots[0].remaining, 0);
  error(await f.request('/orders', 'POST', await f.body('hamburger', 'scheduled', { slotId: slots[0].id })), 'SLOT_FULL');
  assert.equal((await f.request('/orders', 'POST', await f.body('hamburger'))).body.order.slot.id, slots[1].id);
  await f.request('/staff/stations/hamburger', 'PATCH', { capacity: 3, onlineCapacity: 2, paused: true });
  const stations = (await f.request('/catalog')).body.stations;
  for (const id of ['omelet', 'hamburger']) {
    const station = stations.find((station) => station.id === id);
    assert.equal(station.capacity, 3); assert.equal(station.onlineCapacity, 2); assert.equal(station.paused, true);
  }
  assert.equal(stations.find((station) => station.id === 'sandwich').paused, false);
});

test('cafeteria hours can be configured without changing omelet or retail service boundaries', async (t) => {
  const f = await fixture(t, '2026-12-07T13:00:00Z', { opensAt: '07:00', closesAt: '18:00' }); // CST
  assert.equal((await f.slots('sandwich')).service.open, true);
  const eggs = await f.slots('omelet');
  assert.equal(eggs.service.open, false); assert.equal(eggs.service.canSchedule, true);
  assert.equal(eggs.slots[0].startsAt, '2026-12-07T14:00:00.000Z');
  assert.equal(eggs.slots.at(-1).endsAt, '2026-12-07T17:00:00.000Z');
  assert.equal((await f.slots('sandwich')).slots.at(-1).endsAt, '2026-12-08T00:00:00.000Z');
  const retail = await f.slots('starbucks');
  assert.ok(retail.slots.length <= 12);
  assert.equal((await f.request('/slots?stationId=starbucks&timingMode=asap')).status, 400);
  error(await f.request('/orders', 'POST', await f.body('starbucks', 'asap', { paymentAuthorized: true })), 'INVALID_TIMING_MODE');
  assert.throws(() => createApp({ dbPath: ':memory:', cafeteriaHours: { opensAt: '25:00' } }), /Cafeteria hours/);
});

test('breakfast and 11 AM presets are manager-only, and accepted windows remain unchanged', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('/staff/demo-clock', 'PATCH', { mode: 'breakfast' }, 'cafeteria')).status, 403);
  const breakfast = await f.request('/staff/demo-clock', 'PATCH', { mode: 'breakfast' });
  assert.equal(breakfast.body.serviceClock.now, '2026-09-28T13:30:00.000Z');
  const order = (await f.request('/orders', 'POST', await f.body())).body.order;
  const transition = await f.request('/staff/demo-clock', 'PATCH', { mode: 'transition' });
  assert.equal(transition.body.serviceClock.now, '2026-09-28T16:00:00.000Z');
  assert.equal((await f.slots('omelet')).service.open, false);
  assert.equal((await f.slots('hamburger')).service.canOrderNow, true);
  assert.deepEqual((await f.request(`/orders/${order.token}`)).body.order.slot, order.slot);
});
