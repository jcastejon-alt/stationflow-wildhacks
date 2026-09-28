import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { stations as seedStations, items as seedItems } from '../server/seed.js';
import { createApp } from '../server/app.js';

async function fixture(t, { setup } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'stationflow-test-'));
  const dbPath = join(dir, 'test.sqlite');
  let time = Date.parse('2026-09-28T17:01:00.000Z');
  let realTime = Date.parse('2026-09-26T22:00:00.000Z');
  if (setup) await setup(dbPath);
  let app, server, base;
  async function open() {
    app = createApp({ dbPath, now: () => new Date(time), realNow: () => realTime, staticDir: dir });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    base = `http://127.0.0.1:${server.address().port}/api`;
  }
  async function close() {
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
    app.locals.close();
  }
  await open();
  t.after(async () => { await close(); await rm(dir, { recursive: true, force: true }); });
  const cookies = new Map();
  const raw = async (path, method = 'GET', body, options = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(options.cookie ? { Cookie: options.cookie } : {}), ...options.headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const login = async (identifier, password = 'CampusDemo!26', headers = {}) => {
    const result = await raw('/auth/login', 'POST', { identifier, password }, { headers });
    if (result.status === 200) cookies.set(identifier, result.headers.get('set-cookie').split(';')[0]);
    return result;
  };
  await login('D10001'); await login('manager');
  const request = (path, method = 'GET', body) => raw(path, method, body, { cookie: cookies.get(path.startsWith('/staff/') ? 'manager' : 'D10001') });
  const client = async (identifier) => {
    if (!cookies.has(identifier)) await login(identifier);
    return (path, method = 'GET', body, options = {}) => raw(path, method, body, { cookie: cookies.get(identifier), ...options });
  };
  const slots = async (stationId = 'hub') => (await request(`/slots?stationId=${stationId}`)).body.slots;
  const payload = async (overrides = {}) => {
    const stationId = overrides.stationId || 'hub';
    return { idempotencyKey: randomUUID(), stationId, itemId: 'seasoned-fries', selections: {}, exclusions: [], slotId: (await slots(stationId))[0].id, paymentMode: 'regular', paymentAuthorized: stationId !== 'omelet' && stationId !== 'sandwich', ...overrides };
  };
  return { request, raw, login, client, cookies, dbPath, getRealTime: () => realTime, setRealTime: (value) => { realTime = value; }, slots, payload, getTime: () => time, setTime: (value) => { time = value; }, restart: async () => { await close(); await open(); } };
}
const assertError = (result, status, code) => {
  assert.equal(result.status, status, JSON.stringify(result.body));
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, 'string');
};

test('catalog contains six menu stations and clearly labeled illustrative Hub prices', async (t) => {
  const f = await fixture(t);
  const { body, headers } = await f.request('/catalog');
  assert.equal(body.demo, true);
  assert.deepEqual(body.stations.map((station) => station.id), ['omelet', 'hamburger', 'sandwich', 'hub', 'frothy', 'starbucks']);
  assert.equal(body.items.length, 21);
  assert.equal(body.locations.length, 4);
  assert.equal(body.items.find((item) => item.id === 'chicken-tenders').exchangeEligible, true);
  assert.equal(body.items.find((item) => item.id === 'hub-burger').exchangeEligible, true);
  assert.equal(body.items.find((item) => item.id === 'veggie-wrap').exchangeEligible, false);
  assert.deepEqual(Object.fromEntries(body.items.filter((item) => item.stationId === 'hub').map((item) => [item.id, item.pricing.amountCents])), {
    'chicken-tenders': 849, 'hub-burger': 899, 'veggie-wrap': 749, 'chicken-wrap': 849, 'garden-salad': 649, 'seasoned-fries': 299, 'iced-tea': 199,
  });
  assert.ok(body.items.filter((item) => item.stationId === 'hub').every((item) => item.pricing.status === 'demo' && item.pricing.sourceUrl === null && item.pricing.note === 'Illustrative demo price; not an official campus price.'));
  assert.equal(body.items.find((item) => item.id === 'hub-burger').groups.find((group) => group.id === 'burger-toppings').kind, 'customization');
  assert.equal(body.items.find((item) => item.id === 'hub-burger').groups.find((group) => group.id === 'burger-sauce').kind, 'sauce');
  const cafeteriaBurger = body.items.find((item) => item.id === 'build-your-hamburger');
  assert.deepEqual(cafeteriaBurger.groups.map((group) => group.id), ['hamburger-toppings']);
  assert.deepEqual(cafeteriaBurger.groups[0].options.map((option) => option.label), ['Lettuce', 'Cheese', 'Pickles', 'Tomato']);
  assert.match(cafeteriaBurger.description, /All sauces are available in person/);
  const hubBurger = body.items.find((item) => item.id === 'hub-burger');
  assert.deepEqual(hubBurger.groups.map((group) => group.id), ['burger-toppings', 'burger-sauce']);
  assert.deepEqual(hubBurger.groups[0].options.map((option) => option.label), ['Lettuce', 'Cheese', 'Pickles', 'Tomato']);
  for (const id of ['chicken-tenders', 'hub-burger', 'veggie-wrap', 'chicken-wrap', 'garden-salad']) {
    const item = body.items.find((candidate) => candidate.id === id);
    const sauceGroups = item.groups.filter((group) => group.kind === 'sauce');
    assert.equal(sauceGroups.length, 1, id);
    assert.deepEqual(sauceGroups[0].options.map((option) => option.label), ['Ranch', 'Hub sauce'], id);
    assert.equal(sauceGroups[0].min, 0);
    assert.equal(sauceGroups[0].max, 2);
    assert.match(sauceGroups[0].label, /small cup/);
  }
  assert.equal(body.items.find((item) => item.id === 'hub-burger').name, 'Hub burger');
  assert.match(body.items.find((item) => item.id === 'hub-burger').description, /self-serve counter/);
  assert.equal(body.items.find((item) => item.id === 'build-your-sandwich').groups.find((group) => group.id === 'sauces').kind, 'sauce');
  const coffee = body.items.filter((item) => ['frothy', 'starbucks'].includes(item.stationId));
  assert.ok(coffee.every((item) => item.pricing.status === 'demo' && item.pricing.sourceUrl === null));
  assert.ok(body.items.filter((item) => item.stationId === 'frothy').every((item) => item.exchangeEligible === false));
  for (const id of ['frothy-latte', 'frothy-mocha', 'frothy-chai', 'starbucks-latte']) assert.equal(body.items.find((item) => item.id === id).groups.find((group) => group.id === `${id}-milk`).min, 1);
  for (const id of ['frothy-coffee', 'frothy-cold-brew', 'starbucks-coffee']) assert.equal(body.items.find((item) => item.id === id).groups.find((group) => group.id === `${id}-milk`).min, 0);
  assert.ok(body.items.find((item) => item.id === 'starbucks-latte').groups.find((group) => group.id === 'starbucks-latte-milk').options.some((option) => option.id === 'starbucks-latte-two-percent'));
  assert.equal(body.items.find((item) => item.id === 'starbucks-bakery-combo').name, 'Muffin + drip coffee combo');
  assert.ok(body.items.find((item) => item.id === 'starbucks-bakery-combo').groups.every((group) => group.kind === 'customization'));
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.deepEqual((await f.request('/health')).body, { ok: true, demo: true });
});

test('sandwich and wrap show sauce then required toast and reach staff as configured lines', async (t) => {
  const f = await fixture(t);
  const menu = (await f.request('/catalog')).body.items.filter((item) => item.stationId === 'sandwich');
  assert.deepEqual(menu.map((item) => item.id), ['build-your-sandwich', 'build-your-wrap']);
  for (const item of menu) {
    assert.deepEqual(item.groups.slice(1, 4).map((group) => group.label), ['Protein', 'Cheese', 'Vegetables']);
    assert.deepEqual(item.groups[1].options.map((option) => option.label), ['Turkey breast', 'Smoked ham', 'Roast beef', 'Chicken Caesar']);
    assert.deepEqual(item.groups[2].options.map((option) => option.label), ['American', 'Swiss', 'Cheddar']);
    assert.deepEqual(item.groups[3].options.map((option) => option.label), ['Leaf lettuce', 'Tomato', 'Banana peppers', 'Green peppers', 'Onions', 'Pickles', 'Cucumbers']);
    assert.equal(item.groups.at(-2).kind, 'sauce');
    assert.deepEqual(item.groups.at(-2).options.map((option) => option.label), ['Chipotle mayo', 'Ranch', 'Mayonnaise', 'Mustard', 'Vinegar', 'Honey mustard', 'Caesar']);
    assert.ok(item.groups.at(-2).options.slice(4).every((option) => option.note.includes('Additional demo option')));
    assert.equal(item.groups.at(-1).min, 1);
  }
  assert.deepEqual(menu[0].groups[0].options.map((option) => option.label), ['Wheat bread', 'White bread']);
  assert.deepEqual(menu[1].groups[0].options.map((option) => option.label), ['12-inch Flour tortilla', '12-inch Wheat tortilla']);
  const { itemId, selections, exclusions, ...base } = await f.payload({ stationId: 'sandwich', paymentAuthorized: false });
  const wrap = { itemId: 'build-your-wrap', selections: { 'wrap-base': ['wrap-wheat'], 'wrap-protein': ['wrap-turkey'], 'wrap-sauces': ['wrap-ranch'], 'wrap-toast': ['wrap-light'] }, exclusions: [], quantity: 1 };
  assertError(await f.request('/orders', 'POST', { ...base, items: [{ ...wrap, selections: { ...wrap.selections, 'wrap-toast': [] } }] }), 400, 'OPTION_COUNT');
  const created = await f.request('/orders', 'POST', { ...base, items: [wrap] });
  assert.equal(created.status, 201);
  const ticket = (await f.request('/staff/orders?stationId=sandwich')).body.orders[0];
  assert.equal(ticket.items[0].itemName, 'Your custom wrap');
  assert.deepEqual(ticket.items[0].selectionSummary.at(-2).values, ['Ranch']);
  assert.deepEqual(ticket.items[0].selectionSummary.at(-1).values, ['Lightly toasted']);
});

test('Hub burger accepts only online ingredients and cup sauces, preserving accepted staff snapshots', async (t) => {
  const f = await fixture(t);
  const { itemId, selections, exclusions, ...base } = await f.payload();
  const line = { itemId: 'hub-burger', selections: { 'burger-toppings': ['burger-cheese', 'burger-pickles'], 'burger-sauce': ['burger-ranch', 'burger-hub-sauce'] }, exclusions: [], quantity: 1 };
  const payload = { ...base, items: [line] };
  const created = await f.request('/orders', 'POST', payload);
  assert.equal(created.status, 201);
  const order = created.body.order;
  assert.equal(order.items[0].itemName, 'Hub burger');
  assert.deepEqual(order.items[0].selectionSummary[0].values, ['Cheese', 'Pickles']);
  assert.deepEqual(order.items[0].selectionSummary[1].values, ['Hub sauce', 'Ranch']);
  const staff = (await f.request('/staff/orders?stationId=hub')).body.orders[0];
  assert.deepEqual(staff.items, order.items);
  const db = new DatabaseSync(f.dbPath);
  const stored = JSON.parse(db.prepare('SELECT snapshot FROM orders WHERE id=?').get(order.id).snapshot);
  assert.deepEqual(stored.items, order.items);
  const menu = JSON.parse(db.prepare('SELECT data FROM items WHERE id=?').get('hub-burger').data);
  menu.name = 'Changed later';
  db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(menu), menu.id);
  db.close();
  assert.equal((await f.request(`/orders/${order.token}`)).body.order.items[0].itemName, 'Hub burger');
  const retry = await f.request('/orders', 'POST', payload);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.order.items, order.items);
  const invalid = await f.request('/orders', 'POST', { ...base, idempotencyKey: randomUUID(), items: [{ ...line, selections: { 'burger-sauce': ['burger-ketchup'] } }] });
  assertError(invalid, 400, 'INVALID_OPTION');
  const other = await f.request('/orders', 'POST', { ...base, idempotencyKey: randomUUID(), items: [{ ...line, selections: { 'burger-toppings': ['burger-onion'] } }] });
  assertError(other, 400, 'INVALID_OPTION');
});

test('cafeteria hamburger accepts toppings without online sauces', async (t) => {
  const f = await fixture(t);
  const { itemId, selections, exclusions, ...base } = await f.payload({ stationId: 'hamburger', paymentAuthorized: false });
  const line = { itemId: 'build-your-hamburger', selections: { 'hamburger-toppings': ['grill-lettuce', 'grill-cheese', 'grill-pickles', 'grill-tomato'] }, exclusions: [], quantity: 1 };
  const created = await f.request('/orders', 'POST', { ...base, items: [line] });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.order.items[0].selectionSummary.map((group) => group.label), ['Ingredients']);
  assertError(await f.request('/orders', 'POST', { ...base, idempotencyKey: randomUUID(), items: [{ ...line, selections: { 'hamburger-bun': ['burger-brioche'] } }] }), 400, 'INVALID_SELECTIONS');
  assertError(await f.request('/orders', 'POST', { ...base, idempotencyKey: randomUUID(), items: [{ ...line, selections: { 'hamburger-sauce': ['grill-ranch'] } }] }), 400, 'INVALID_SELECTIONS');
});

test('each Hub sauce choice is a separate cup and retired sauces cannot be ordered', async (t) => {
  const f = await fixture(t);
  const cases = [
    ['chicken-tenders', 'tender-dip', 'tender', 'bbq'],
    ['veggie-wrap', 'wrap-sauce', 'veggie-wrap', 'herb-dressing'],
    ['chicken-wrap', 'chicken-wrap-sauce', 'chicken-wrap', 'caesar-dressing'],
    ['garden-salad', 'salad-dressing', 'salad', 'balsamic'],
  ];
  for (const [itemId, groupId, prefix, retiredOption] of cases) {
    const selections = { [groupId]: [`${prefix}-ranch`, `${prefix}-hub-sauce`] };
    const created = await f.request('/orders', 'POST', await f.payload({ itemId, selections }));
    assert.equal(created.status, 201, itemId);
    const summary = created.body.order.selectionSummary.find((group) => group.group === groupId);
    assert.equal(summary.kind, 'sauce');
    assert.deepEqual(summary.values, ['Hub sauce', 'Ranch']);
    assertError(await f.request('/orders', 'POST', await f.payload({ itemId, selections: { [groupId]: [retiredOption] } })), 400, 'INVALID_OPTION');
  }
});

test('slots are stable ten-minute UTC windows with a two-minute lead and two-hour horizon', async (t) => {
  const f = await fixture(t);
  const slots = await f.slots();
  assert.equal(slots.length, 12);
  assert.deepEqual(slots, await f.slots());
  for (const slot of slots) {
    const start = Date.parse(slot.startsAt);
    assert.ok(start >= f.getTime() + 120000);
    assert.ok(start < f.getTime() + 7200000);
    assert.equal(start % 600000, 0);
    assert.equal(Date.parse(slot.endsAt) - start, 600000);
    assert.equal(slot.remaining, 7);
    assert.equal(slot.totalRemaining, 10);
  }
});

test('the final online and total slot is reserved atomically under concurrent requests', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/hub', 'PATCH', { capacity: 1, onlineCapacity: 1 });
  const [one, two] = await Promise.all([f.payload(), f.payload()]);
  const results = await Promise.all([f.request('/orders', 'POST', one), f.request('/orders', 'POST', two)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(results.find((result) => result.status === 409).body.error.code, 'SLOT_FULL');
  assert.equal((await f.request('/staff/orders?stationId=hub')).body.orders.length, 1);
  assert.equal((await f.slots())[0].remaining, 0);
  assert.equal((await f.slots())[0].totalRemaining, 0);
});

test('one regular cart creates one staff ticket with server priced custom lines and unit capacity', async (t) => {
  const f = await fixture(t);
  const { itemId, selections, exclusions, ...base } = await f.payload();
  const items = [
    { itemId: 'seasoned-fries', selections: {}, exclusions: [], quantity: 2 },
    { itemId: 'chicken-tenders', selections: { 'tender-dip': ['tender-hub-sauce'] }, exclusions: [], quantity: 1 },
  ];
  const body = { ...base, items };
  const created = await f.request('/orders', 'POST', body);
  assert.equal(created.status, 201);
  const order = created.body.order;
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[1].selectionSummary[0].values[0], 'Hub sauce');
  assert.equal(order.pricing.amountCents, 1447);
  assert.equal(order.unitCount, 3);
  assert.equal((await f.slots())[0].remaining, 4);
  const replay = await f.request('/orders', 'POST', { ...body, items: [...items].reverse() });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, order.id);
  const staff = (await f.request('/staff/orders?stationId=hub')).body.orders;
  assert.equal(staff.length, 1);
  assert.deepEqual(staff[0].items, order.items);
  assert.equal((await f.request('/my/orders')).body.orders[0].id, order.id);
  const db = new DatabaseSync(f.dbPath);
  assert.equal(db.prepare('SELECT unit_count FROM orders WHERE id=?').get(order.id).unit_count, 3);
  const fries = JSON.parse(db.prepare('SELECT data FROM items WHERE id=?').get('seasoned-fries').data);
  fries.pricing.amountCents = 9999;
  db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(fries), fries.id);
  db.close();
  assert.equal((await f.request(`/orders/${order.token}`)).body.order.pricing.amountCents, 1447);
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' })).status, 200);
  assert.equal((await f.request(`/staff/orders/${order.id}/payment`, 'PATCH', { status: 'approved', expectedStatus: 'pending' })).status, 200);
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'preparing', expectedStatus: 'entered' })).status, 200);
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'ready', expectedStatus: 'preparing' })).status, 200);
  assert.equal((await f.request(`/orders/${order.token}`)).body.order.status, 'ready');
});

test('cart rejects mixed stations, invalid customizations, extra swipe units, and overbooking', async (t) => {
  const f = await fixture(t);
  const { itemId, selections, exclusions, ...base } = await f.payload();
  const fries = { itemId: 'seasoned-fries', selections: {}, exclusions: [], quantity: 2 };
  const cart = (items, overrides = {}) => ({ ...base, idempotencyKey: randomUUID(), items, ...overrides });
  assertError(await f.request('/orders', 'POST', cart([fries, { itemId: 'starbucks-coffee', selections: {}, exclusions: [] }])), 400, 'STATION_ITEM_MISMATCH');
  assertError(await f.request('/orders', 'POST', cart([{ itemId: 'iced-tea', selections: {}, exclusions: [] }])), 400, 'OPTION_COUNT');
  assertError(await f.request('/orders', 'POST', cart([fries], { paymentMode: 'meal_exchange' })), 400, 'EXCHANGE_CART_LIMIT');
  assertError(await f.request('/orders', 'POST', cart([{ ...fries, quantity: 7 }])), 400, 'INVALID_QUANTITY');
  assertError(await f.request('/orders', 'POST', cart([fries, { ...fries, quantity: 5 }])), 400, 'ORDER_TOO_LARGE');
  assertError(await f.request('/orders', 'POST', cart([{ ...fries, pricing: { amountCents: 1 } }])), 400, 'INVALID_INPUT');
  await f.request('/staff/stations/hub', 'PATCH', { capacity: 3, onlineCapacity: 3 });
  const results = await Promise.all([f.request('/orders', 'POST', cart([fries])), f.request('/orders', 'POST', cart([fries]))]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await f.slots())[0].totalRemaining, 1);
});

test('one demo swipe cannot pay for two eligible units at Hub or Starbucks', async (t) => {
  const f = await fixture(t);
  const { itemId: hubItemId, selections: hubSelections, exclusions: hubExclusions, ...hubBase } = await f.payload({ paymentMode: 'meal_exchange' });
  const hubLine = { itemId: 'chicken-tenders', selections: {}, exclusions: [], quantity: 1 };
  assertError(await f.request('/orders', 'POST', { ...hubBase, items: [{ ...hubLine, quantity: 2 }] }), 400, 'EXCHANGE_CART_LIMIT');
  assertError(await f.request('/orders', 'POST', { ...hubBase, idempotencyKey: randomUUID(), items: [hubLine, { ...hubLine, itemId: 'hub-burger' }] }), 400, 'EXCHANGE_CART_LIMIT');
  const hubOne = await f.request('/orders', 'POST', { ...hubBase, idempotencyKey: randomUUID(), items: [hubLine] });
  assert.equal(hubOne.status, 201);
  assert.equal(hubOne.body.order.pricing.status, 'meal_swipe');
  const { itemId: coffeeItemId, selections: coffeeSelections, exclusions: coffeeExclusions, ...coffeeBase } = await f.payload({ stationId: 'starbucks', paymentMode: 'meal_exchange' });
  const coffeeLine = { itemId: 'starbucks-bakery-combo', selections: { 'starbucks-combo-muffin': ['starbucks-combo-blueberry'] }, exclusions: [], quantity: 1 };
  assertError(await f.request('/orders', 'POST', { ...coffeeBase, items: [{ ...coffeeLine, quantity: 2 }] }), 400, 'EXCHANGE_CART_LIMIT');
  const coffeeOne = await f.request('/orders', 'POST', { ...coffeeBase, idempotencyKey: randomUUID(), items: [coffeeLine] });
  assert.equal(coffeeOne.status, 201);
  assert.equal(coffeeOne.body.order.unitCount, 1);
  assert.equal(coffeeOne.body.order.payment.method, 'meal_exchange');
});

test('simultaneous same-key retries produce one ticket and replay even after sold out and paused', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/hub', 'PATCH', { capacity: 1, onlineCapacity: 1 });
  const payload = await f.payload();
  const results = await Promise.all([f.request('/orders', 'POST', payload), f.request('/orders', 'POST', payload)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 201]);
  assert.equal(results[0].body.order.id, results[1].body.order.id);
  await f.request('/staff/stations/hub', 'PATCH', { paused: true });
  await f.request('/staff/items/seasoned-fries', 'PATCH', { available: false });
  f.setTime(f.getTime() + 7200000);
  const replay = await f.request('/orders', 'POST', payload);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, results[0].body.order.id);
  assert.equal((await f.request('/staff/orders?stationId=hub')).body.orders.length, 1);
});

test('canonical choices replay regardless of order or omitted empty groups/exclusions', async (t) => {
  const f = await fixture(t);
  f.setTime(Date.parse('2026-09-28T13:30:00Z')); // 08:30 Central breakfast
  const body = await f.payload({ stationId: 'omelet', itemId: 'build-your-omelet', selections: { eggs: ['whole-eggs'], 'omelet-vegetables': ['spinach', 'tomato'], 'omelet-protein': [] }, exclusions: ['ham', 'onion'] });
  const created = await f.request('/orders', 'POST', body);
  const retry = await f.request('/orders', 'POST', { ...body, selections: { 'omelet-vegetables': ['tomato', 'spinach'], eggs: ['whole-eggs'] }, exclusions: ['onion', 'ham'] });
  assert.equal(created.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(created.body.order.id, retry.body.order.id);
  f.setTime(Date.parse('2026-09-28T17:01:00Z')); // Retail lunch service
  const plain = await f.payload();
  const { exclusions, ...noExclusions } = plain;
  await f.request('/orders', 'POST', noExclusions);
  assert.equal((await f.request('/orders', 'POST', plain)).status, 200);
});

test('a used key rejects a different payload but is scoped to the authenticated actor', async (t) => {
  const f = await fixture(t);
  const body = await f.payload();
  assert.equal((await f.request('/orders', 'POST', body)).status, 201);
  assertError(await f.request('/orders', 'POST', { ...body, itemId: 'chicken-tenders' }), 409, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await f.request('/staff/orders', 'POST', body)).status, 201);
});

test('only tenders and the Hub burger accept meal swipe and prices are server-snapshotted', async (t) => {
  const f = await fixture(t);
  const regular = await f.payload({ itemId: 'chicken-tenders' });
  const tenderOrder = await f.request('/orders', 'POST', regular);
  assert.equal(tenderOrder.status, 201);
  assert.deepEqual(tenderOrder.body.order.pricing, { amountCents: 849, currency: 'USD', status: 'demo', sourceUrl: null, note: 'Illustrative demo price; not an official campus price.' });
  const db = new DatabaseSync(f.dbPath);
  const tenderData = JSON.parse(db.prepare('SELECT data FROM items WHERE id=?').get('chicken-tenders').data);
  tenderData.pricing.amountCents = 1234;
  db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(tenderData), 'chicken-tenders');
  db.close();
  const replay = await f.request('/orders', 'POST', regular);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.pricing.amountCents, 849);
  assert.equal((await f.request(`/orders/${tenderOrder.body.order.token}`)).body.order.pricing.amountCents, 849);
  assertError(await f.request('/orders', 'POST', { ...regular, idempotencyKey: randomUUID(), pricing: { amountCents: 1 } }), 400, 'INVALID_INPUT');
  const tenderSwipe = await f.request('/orders', 'POST', await f.payload({ itemId: 'chicken-tenders', paymentMode: 'meal_exchange' }));
  assert.equal(tenderSwipe.status, 201);
  assert.equal(tenderSwipe.body.order.pricing.status, 'meal_swipe');
  const swipe = await f.payload({ itemId: 'hub-burger', paymentMode: 'meal_exchange' });
  const burger = await f.request('/orders', 'POST', swipe);
  assert.equal(burger.status, 201);
  assert.equal(burger.body.order.pricing.amountCents, null);
  assert.equal(burger.body.order.pricing.status, 'meal_swipe');
  assert.equal(burger.body.order.selectionSummary[0].kind, 'customization');
  assert.equal(burger.body.order.selectionSummary[1].kind, 'sauce');
  const veggie = await f.payload({ itemId: 'veggie-wrap', paymentMode: 'meal_exchange' });
  assertError(await f.request('/orders', 'POST', veggie), 400, 'EXCHANGE_NOT_ELIGIBLE');
});

test('concurrent staff status changes compare expected status and preserve exact events', async (t) => {
  const f = await fixture(t);
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' });
  await f.request(`/staff/orders/${order.id}/payment`, 'PATCH', { status: 'approved', expectedStatus: 'pending' });
  const path = `/staff/orders/${order.id}`;
  const results = await Promise.all([f.request(path, 'PATCH', { status: 'preparing', expectedStatus: 'entered' }), f.request(path, 'PATCH', { status: 'preparing', expectedStatus: 'entered' })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assertError(await f.request(path, 'PATCH', { status: 'picked_up', expectedStatus: 'preparing' }), 409, 'STATUS_CONFLICT');
  assertError(await f.request(`/orders/${order.token}/cancel`, 'POST'), 409, 'STATUS_CONFLICT');
  assert.equal((await f.request(path, 'PATCH', { status: 'ready', expectedStatus: 'preparing' })).status, 200);
  const finished = await f.request(path, 'PATCH', { status: 'picked_up', expectedStatus: 'ready' });
  assert.equal(finished.status, 200);
  assert.deepEqual(finished.body.order.events.map((event) => event.status), ['received', 'entered', 'preparing', 'ready', 'picked_up']);
  assertError(await f.request(path, 'PATCH', { status: 'received', expectedStatus: 'picked_up' }), 409, 'STATUS_CONFLICT');
});

test('cancellation only from received conservatively retains reserved capacity', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/hub', 'PATCH', { capacity: 1, onlineCapacity: 1 });
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  assert.equal((await f.request(`/orders/${order.token}/cancel`, 'POST')).body.order.status, 'cancelled');
  assertError(await f.request(`/orders/${order.token}/cancel`, 'POST'), 409, 'STATUS_CONFLICT');
  assert.equal((await f.slots())[0].remaining, 0);
  assertError(await f.request('/orders', 'POST', await f.payload()), 409, 'SLOT_FULL');
});

test('pause blocks online orders but allows a staff walk-in and exposes paused slots', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/hub', 'PATCH', { paused: true });
  assert.ok((await f.slots()).every((slot) => slot.available === false));
  assertError(await f.request('/orders', 'POST', await f.payload()), 409, 'STATION_PAUSED');
  const walkIn = await f.request('/staff/orders', 'POST', await f.payload());
  assert.equal(walkIn.status, 201);
  assert.equal(walkIn.body.order.source, 'walk_in');
});

test('sold-out items and ingredients are enforced; accepted snapshots remain intact', async (t) => {
  const f = await fixture(t);
  f.setTime(Date.parse('2026-09-28T13:30:00Z')); // 08:30 Central breakfast
  const body = await f.payload({ stationId: 'omelet', itemId: 'build-your-omelet', selections: { eggs: ['whole-eggs'], 'omelet-vegetables': ['spinach'] }, exclusions: ['onion'] });
  const order = (await f.request('/orders', 'POST', body)).body.order;
  const optionPath = '/staff/items/build-your-omelet/groups/omelet-vegetables/options/spinach';
  assert.equal((await f.request(optionPath, 'PATCH', { available: false })).status, 200);
  assertError(await f.request('/orders', 'POST', { ...body, idempotencyKey: randomUUID() }), 409, 'OPTION_UNAVAILABLE');
  assert.equal((await f.request('/orders', 'POST', body)).status, 200);
  await f.request('/staff/items/build-your-omelet', 'PATCH', { available: false });
  assertError(await f.request('/orders', 'POST', { ...body, idempotencyKey: randomUUID() }), 409, 'ITEM_UNAVAILABLE');
  const current = (await f.request(`/orders/${order.token}`)).body.order;
  assert.deepEqual(current.selectionSummary, order.selectionSummary);
  assert.deepEqual(current.exclusions, ['Onion']);
  assert.deepEqual(current.slot, order.slot);
});

test('closed, arbitrary, or other-station windows are rejected with alternatives available', async (t) => {
  const f = await fixture(t);
  const body = await f.payload();
  f.setTime(Date.parse((await f.slots())[0].startsAt) - 119000);
  assertError(await f.request('/orders', 'POST', body), 409, 'SLOT_UNAVAILABLE');
  assert.ok((await f.slots()).some((slot) => slot.available));
  assertError(await f.request('/orders', 'POST', await f.payload({ slotId: 'hub:9999999999999' })), 409, 'SLOT_UNAVAILABLE');
  assertError(await f.request('/orders', 'POST', await f.payload({ slotId: (await f.slots('sandwich'))[0].id })), 409, 'SLOT_UNAVAILABLE');
});

test('all choice minima/maxima, membership, duplicates, and exclusions are validated', async (t) => {
  const f = await fixture(t);
  f.setTime(Date.parse('2026-09-28T13:30:00Z')); // 08:30 Central breakfast
  const base = await f.payload({ stationId: 'omelet', itemId: 'build-your-omelet', selections: { eggs: ['whole-eggs'] } });
  const cases = [
    [{ selections: {} }, 'OPTION_COUNT'],
    [{ selections: { eggs: ['whole-eggs', 'egg-whites'] } }, 'OPTION_COUNT'],
    [{ selections: { eggs: ['whole-eggs', 'whole-eggs'] } }, 'DUPLICATE_OPTION'],
    [{ selections: { eggs: ['spinach'] } }, 'INVALID_OPTION'],
    [{ selections: { eggs: ['whole-eggs'], invented: [] } }, 'INVALID_SELECTIONS'],
    [{ selections: [] }, 'INVALID_SELECTIONS'],
    [{ exclusions: ['whole-eggs'] }, 'CONFLICTING_OPTIONS'],
    [{ exclusions: ['invented'] }, 'INVALID_EXCLUSIONS'],
    [{ exclusions: ['onion', 'onion'] }, 'INVALID_EXCLUSIONS'],
    [{ exclusions: null }, 'INVALID_EXCLUSIONS'],
  ];
  for (const [changes, code] of cases) assertError(await f.request('/orders', 'POST', { ...base, idempotencyKey: randomUUID(), ...changes }), 400, code);
  assertError(await f.request('/orders', 'POST', { ...base, idempotencyKey: randomUUID(), stationId: 'hub' }), 400, 'STATION_ITEM_MISMATCH');
});

test('station limits are independent and online cannot consume the walk-in reservation', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/hub', 'PATCH', { capacity: 2, onlineCapacity: 1 });
  await f.request('/staff/stations/hamburger', 'PATCH', { capacity: 1, onlineCapacity: 1 });
  assert.equal((await f.request('/orders', 'POST', await f.payload())).status, 201);
  const hubSlot = (await f.slots())[0];
  assert.equal(hubSlot.remaining, 0);
  assert.equal(hubSlot.totalRemaining, 1);
  assertError(await f.request('/orders', 'POST', await f.payload()), 409, 'SLOT_FULL');
  const omelet = await f.payload({ stationId: 'hamburger', itemId: 'build-your-hamburger', selections: { 'hamburger-bun': ['burger-brioche'] } });
  assert.equal((await f.request('/orders', 'POST', omelet)).status, 201);
  assert.equal((await f.request('/staff/orders', 'POST', await f.payload())).status, 201);
  assertError(await f.request('/staff/orders', 'POST', await f.payload()), 409, 'SLOT_FULL');
});

test('public callers cannot forge a walk-in source or attach identity fields', async (t) => {
  const f = await fixture(t);
  assertError(await f.request('/orders', 'POST', await f.payload({ source: 'walk_in' })), 400, 'INVALID_INPUT');
  assertError(await f.request('/orders', 'POST', await f.payload({ studentId: 'sensitive' })), 400, 'INVALID_INPUT');
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  assert.equal(order.source, 'online');
  assert.match(order.token, /^[A-Za-z0-9_-]{43}$/);
  assertError(await f.request(`/orders/${order.pickupCode}`), 404, 'ORDER_NOT_FOUND');
  assertError(await f.request(`/orders/${order.id}`), 404, 'ORDER_NOT_FOUND');
  assertError(await f.request(`/orders/${order.pickupCode}/cancel`, 'POST'), 404, 'ORDER_NOT_FOUND');
  assert.ok(!(await f.request('/staff/orders?stationId=hub')).body.orders[0].token);
});

test('digital queue ahead counts only active previous online orders at the same station', async (t) => {
  const f = await fixture(t);
  const first = (await f.request('/orders', 'POST', await f.payload())).body.order;
  await f.request('/staff/orders', 'POST', await f.payload());
  await f.request('/orders', 'POST', await f.payload({ stationId: 'hamburger', itemId: 'build-your-hamburger', selections: { 'hamburger-bun': ['burger-brioche'] } }));
  const second = (await f.request('/orders', 'POST', await f.payload())).body.order;
  assert.equal(first.queueAhead, 0);
  assert.equal(second.queueAhead, 1);
  await f.request(`/orders/${first.token}/cancel`, 'POST');
  assert.equal((await f.request(`/orders/${second.token}`)).body.order.queueAhead, 0);
});

test('ready tickets leave the preparation queue while capacity and history remain reserved', async (t) => {
  const f = await fixture(t);
  const first = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const second = (await f.request('/orders', 'POST', await f.payload())).body.order;
  assert.equal(second.queueAhead, 1);
  const reserved = (await f.slots())[0].remaining;
  assert.equal((await f.request(`/staff/orders/${first.id}/accept`, 'POST', { expectedStatus: 'received' })).status, 200);
  assert.equal((await f.request(`/staff/orders/${first.id}`, 'PATCH', { status: 'ready', expectedStatus: 'preparing' })).status, 200);
  assert.equal((await f.request(`/orders/${second.token}`)).body.order.queueAhead, 0);
  assert.equal((await f.slots())[0].remaining, reserved);
  const station = (await f.request('/catalog')).body.stations.find((candidate) => candidate.id === 'hub');
  assert.equal(station.queue.ready, 1);
  assert.equal(station.queue.active, 1);
  assert.equal((await f.request('/staff/orders?currentDay=true&stationId=hub')).body.orders.length, 2);

  f.setTime(Date.parse('2026-09-29T17:01:00.000Z'));
  const third = (await f.request('/orders', 'POST', await f.payload())).body.order;
  assert.equal(third.queueAhead, 0);
  assert.equal((await f.request('/staff/orders?currentDay=true&stationId=hub')).body.orders.length, 1);
  assert.equal((await f.request('/staff/orders?stationId=hub')).body.orders.length, 3);
  const nextDay = (await f.request('/catalog')).body.stations.find((candidate) => candidate.id === 'hub');
  assert.equal(nextDay.queue.ready, 0);
  assert.equal(nextDay.queue.active, 1);
});

test('retail queue ahead follows pickup windows and excludes declined payment', async (t) => {
  const f = await fixture(t);
  const slots = await f.slots('hub');
  const later = (await f.request('/orders', 'POST', await f.payload({ slotId: slots[1].id }))).body.order;
  const earlier = (await f.request('/orders', 'POST', await f.payload({ slotId: slots[0].id }))).body.order;
  assert.equal(earlier.queueAhead, 0);
  assert.equal((await f.request(`/orders/${later.token}`)).body.order.queueAhead, 1);
  assert.equal((await f.request(`/staff/orders/${earlier.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' })).status, 200);
  assert.equal((await f.request(`/staff/orders/${earlier.id}/payment`, 'PATCH', { status: 'declined', expectedStatus: 'pending' })).status, 200);
  assert.equal((await f.request(`/orders/${later.token}`)).body.order.queueAhead, 0);
  assert.equal((await f.slots('hub'))[0].totalRemaining, slots[0].totalRemaining - 1);
});

test('capacity reductions preserve accepted tickets while blocking further orders', async (t) => {
  const f = await fixture(t);
  const first = (await f.request('/orders', 'POST', await f.payload())).body.order;
  await f.request('/orders', 'POST', await f.payload());
  assert.equal((await f.request('/staff/stations/hub', 'PATCH', { capacity: 1, onlineCapacity: 1 })).status, 200);
  assert.equal((await f.slots())[0].remaining, 0);
  assert.equal((await f.slots())[0].totalRemaining, 0);
  assertError(await f.request('/orders', 'POST', await f.payload()), 409, 'SLOT_FULL');
  assert.deepEqual((await f.request(`/orders/${first.token}`)).body.order.slot, first.slot);
  assertError(await f.request('/staff/stations/hub', 'PATCH', { capacity: 0 }), 400, 'INVALID_CAPACITY');
  assertError(await f.request('/staff/stations/hub', 'PATCH', { capacity: 2, onlineCapacity: 3 }), 400, 'INVALID_CAPACITY');
  assertError(await f.request('/staff/stations/hub', 'PATCH', { onlineCapacity: 1.5 }), 400, 'INVALID_CAPACITY');
});

test('tickets, events, settings, and idempotency survive database reopening', async (t) => {
  const f = await fixture(t);
  const body = await f.payload();
  const order = (await f.request('/orders', 'POST', body)).body.order;
  await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' });
  await f.request(`/staff/orders/${order.id}/payment`, 'PATCH', { status: 'approved', expectedStatus: 'pending' });
  await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'preparing', expectedStatus: 'entered' });
  await f.request('/staff/stations/hub', 'PATCH', { paused: true });
  await f.request('/staff/items/seasoned-fries', 'PATCH', { available: false });
  await f.restart();
  const ticket = await f.request(`/orders/${order.token}`);
  assert.equal(ticket.status, 200);
  assert.equal(ticket.body.order.status, 'preparing');
  assert.equal(ticket.body.order.events.length, 3);
  const catalog = (await f.request('/catalog')).body;
  assert.equal(catalog.stations.find((station) => station.id === 'hub').paused, true);
  assert.equal(catalog.items.find((item) => item.id === 'seasoned-fries').available, false);
  const replay = await f.request('/orders', 'POST', body);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, order.id);
  assert.equal(replay.body.order.status, 'preparing');
});

test('configuration endpoints validate JSON types and missing resources', async (t) => {
  const f = await fixture(t);
  assertError(await f.request('/staff/items/seasoned-fries', 'PATCH', { available: 'false' }), 400, 'INVALID_INPUT');
  assertError(await f.request('/staff/items/missing', 'PATCH', { available: false }), 404, 'ITEM_NOT_FOUND');
  assertError(await f.request('/staff/items/build-your-omelet/groups/eggs/options/missing', 'PATCH', { available: false }), 404, 'OPTION_NOT_FOUND');
  assertError(await f.request('/slots'), 400, 'INVALID_INPUT');
  assertError(await f.request('/slots?stationId=missing'), 404, 'STATION_NOT_FOUND');
  assert.equal((await f.request('/staff/orders')).status, 200);
  assertError(await f.request('/unknown'), 404, 'NOT_FOUND');
  assertError(await f.request('/orders', 'POST', null), 400, 'INVALID_JSON');
});

test('authentication uses hashed passwords, HttpOnly cookies, expiry, rotation, and revocable logout', async (t) => {
  const f = await fixture(t);
  assert.deepEqual((await f.raw('/auth/me')).body, { user: null });
  assertError(await f.raw('/orders', 'POST', await f.payload()), 401, 'AUTH_REQUIRED');
  const login = await f.login('D10002');
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);
  assert.equal(login.body.user.studentId, '10002');
  const cookie = f.cookies.get('D10002');
  assert.equal((await f.raw('/auth/me', 'GET', undefined, { cookie })).body.user.id, 'student-demo-2');
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  const storedPassword = db.prepare('SELECT password_hash FROM users WHERE identifier=?').get('10002').password_hash;
  assert.ok(!storedPassword.includes('CampusDemo!26'));
  assert.equal(storedPassword.split(':')[1].length, 64);
  assert.ok(!db.prepare('SELECT token_hash FROM sessions').all().some((row) => cookie.includes(row.token_hash)));
  db.close();
  const rotated = await f.raw('/auth/login', 'POST', { identifier: 'D10002', password: 'CampusDemo!26' }, { cookie });
  const newCookie = rotated.headers.get('set-cookie').split(';')[0];
  assert.notEqual(newCookie, cookie);
  assert.equal((await f.raw('/auth/me', 'GET', undefined, { cookie })).body.user, null);
  assert.equal((await f.raw('/auth/logout', 'POST', {}, { cookie: newCookie })).status, 200);
  assert.equal((await f.raw('/auth/me', 'GET', undefined, { cookie: newCookie })).body.user, null);
  await f.login('D10002');
  f.setRealTime(f.getRealTime() + 8 * 3600000 + 1);
  assert.equal((await f.raw('/auth/me', 'GET', undefined, { cookie: f.cookies.get('D10002') })).body.user, null);
});

test('login throttles repeated failures and never distinguishes unknown IDs from bad passwords', async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 8; i++) {
    const result = await f.login(i % 2 ? 'not-a-user' : 'D10001', 'wrong-password');
    assertError(result, 401, 'INVALID_CREDENTIALS');
  }
  assertError(await f.login('D10001'), 429, 'LOGIN_THROTTLED');
  f.setRealTime(f.getRealTime() + 900001);
  assert.equal((await f.login('D10001')).status, 200);
});

test('mutation origin guard accepts exact local Vite origins and rejects evil, null, and cross-site writes', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.login('D10002', 'CampusDemo!26', { Origin: 'http://127.0.0.1:5173' })).status, 200);
  assert.equal((await f.login('D10002', 'CampusDemo!26', { Origin: 'http://localhost:5173' })).status, 200);
  for (const origin of ['https://evil.example', 'http://127.0.0.1:51730', 'null']) assertError(await f.login('D10002', 'CampusDemo!26', { Origin: origin }), 403, 'ORIGIN_FORBIDDEN');
  assertError(await f.login('D10002', 'CampusDemo!26', { Origin: 'http://127.0.0.1:5173', 'Sec-Fetch-Site': 'cross-site' }), 403, 'ORIGIN_FORBIDDEN');
});

test('students own private tickets and identical request keys cannot cross accounts', async (t) => {
  const f = await fixture(t);
  const one = await f.client('D10001');
  const two = await f.client('D10002');
  const body = await f.payload();
  const first = (await one('/orders', 'POST', body)).body.order;
  assertError(await two(`/orders/${first.token}`), 404, 'ORDER_NOT_FOUND');
  assertError(await two(`/orders/${first.token}/cancel`, 'POST'), 404, 'ORDER_NOT_FOUND');
  const second = await two('/orders', 'POST', body);
  assert.equal(second.status, 201);
  assert.notEqual(second.body.order.id, first.id);
  assert.equal(second.body.order.payment.studentId, '10002');
  assert.deepEqual((await one('/my/orders')).body.orders.map((order) => order.id), [first.id]);
  assert.deepEqual((await two('/my/orders')).body.orders.map((order) => order.id), [second.body.order.id]);
  assert.equal((await one('/orders', 'POST', body)).body.order.id, first.id);
  assertError(await one('/staff/orders'), 403, 'STAFF_REQUIRED');
  assertError(await (await f.client('manager'))('/orders', 'POST', body), 403, 'STUDENT_REQUIRED');
});

test('assigned staff can share only their station queues and cannot mutate unassigned resources', async (t) => {
  const f = await fixture(t);
  const hubOrder = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const omelet = (await f.request('/orders', 'POST', await f.payload({ stationId: 'hamburger', itemId: 'build-your-hamburger', selections: { 'hamburger-bun': ['burger-brioche'] } }))).body.order;
  const sandwich = (await f.request('/orders', 'POST', await f.payload({ stationId: 'sandwich', itemId: 'build-your-sandwich', selections: { bread: ['wheat'], 'sandwich-protein': ['turkey'] } }))).body.order;
  const cafeteria = await f.client('cafeteria');
  const hub = await f.client('hub');
  const cafeteriaOrders = (await cafeteria('/staff/orders')).body.orders;
  assert.deepEqual(cafeteriaOrders.map((order) => order.id), [omelet.id, sandwich.id]);
  assert.ok(cafeteriaOrders.every((order) => !order.token && !order.payment.studentId));
  assert.equal((await hub('/staff/orders')).body.orders[0].payment.studentId, '10001');
  assertError(await cafeteria('/staff/orders?stationId=hub'), 403, 'STATION_FORBIDDEN');
  assertError(await cafeteria(`/orders/${hubOrder.token}`), 403, 'STATION_FORBIDDEN');
  assertError(await cafeteria('/staff/stations/hub', 'PATCH', { paused: true }), 403, 'STATION_FORBIDDEN');
  assertError(await cafeteria('/staff/items/seasoned-fries', 'PATCH', { available: false }), 403, 'STATION_FORBIDDEN');
  assertError(await cafeteria('/staff/items/chicken-tenders/groups/tender-dip/options/tender-ranch', 'PATCH', { available: false }), 403, 'STATION_FORBIDDEN');
  assertError(await cafeteria(`/staff/orders/${hubOrder.id}`, 'PATCH', { status: 'cancelled', expectedStatus: 'received' }), 403, 'STATION_FORBIDDEN');
  assertError(await cafeteria('/staff/orders', 'POST', await f.payload()), 403, 'STATION_FORBIDDEN');
  assertError(await cafeteria(`/staff/orders/${hubOrder.id}/payment`, 'PATCH', { status: 'approved', expectedStatus: 'pending' }), 403, 'STATION_FORBIDDEN');
  assert.equal((await hub(`/orders/${hubOrder.token}`)).body.order.token, undefined);
});

test('cafeteria never requires another ID or payment authorization at a station', async (t) => {
  const f = await fixture(t);
  const payload = await f.payload({ stationId: 'hamburger', itemId: 'build-your-hamburger', selections: { 'hamburger-bun': ['burger-brioche'] }, paymentAuthorized: false });
  const order = (await f.request('/orders', 'POST', payload)).body.order;
  assert.deepEqual(order.pricing, { amountCents: null, currency: 'USD', status: 'included', sourceUrl: null, note: 'Included in the fictional cafeteria meal; no separate demo price.' });
  assert.deepEqual(order.payment, { status: 'not_required', method: 'cafeteria_entry', authorized: false, updatedAt: null });
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received' })).status, 200);
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'preparing', expectedStatus: 'entered' })).status, 200);
  assertError(await f.request(`/staff/orders/${order.id}/payment`, 'PATCH', { status: 'approved', expectedStatus: 'pending' }), 409, 'PAYMENT_CONFLICT');
});

test('one-click accept scopes cafeteria grill and sandwich queues, then mark ready', async (t) => {
  const f = await fixture(t);
  const grill = await f.client('grill');
  const sandwich = await f.client('sandwich');
  const hamburger = (await f.request('/orders', 'POST', await f.payload({ stationId: 'hamburger', itemId: 'build-your-hamburger', selections: { 'hamburger-bun': ['burger-brioche'] }, paymentAuthorized: false }))).body.order;
  const sandwichOrder = (await f.request('/orders', 'POST', await f.payload({ stationId: 'sandwich', itemId: 'build-your-sandwich', selections: { bread: ['wheat'], 'sandwich-protein': ['turkey'] }, paymentAuthorized: false }))).body.order;
  assert.equal((await grill('/staff/orders')).body.orders.length, 1);
  assert.equal((await sandwich('/staff/orders')).body.orders.length, 1);
  assertError(await sandwich(`/staff/orders/${hamburger.id}/accept`, 'POST', { expectedStatus: 'received' }), 403, 'STATION_FORBIDDEN');
  assertError(await grill(`/staff/orders/${sandwichOrder.id}/accept`, 'POST', { expectedStatus: 'received' }), 403, 'STATION_FORBIDDEN');
  const accepted = await grill(`/staff/orders/${hamburger.id}/accept`, 'POST', { expectedStatus: 'received' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.order.status, 'preparing');
  assert.equal(accepted.body.order.payment.status, 'not_required');
  assert.deepEqual(accepted.body.order.events.map((event) => event.status), ['received', 'entered', 'preparing']);
  assert.equal((await f.request(`/orders/${hamburger.token}`)).body.order.status, 'preparing');
  assertError(await grill(`/staff/orders/${hamburger.id}/accept`, 'POST', { expectedStatus: 'received' }), 409, 'STATUS_CONFLICT');
  assert.equal((await sandwich(`/staff/orders/${sandwichOrder.id}/accept`, 'POST', { expectedStatus: 'received' })).status, 200);
  assert.equal((await grill(`/staff/orders/${hamburger.id}`, 'PATCH', { status: 'ready', expectedStatus: 'preparing' })).status, 200);
  assert.equal((await f.request(`/orders/${hamburger.token}`)).body.order.status, 'ready');
});

test('one-click accept atomically approves authorized retail demo payment and is compare-and-set', async (t) => {
  const f = await fixture(t);
  const hub = await f.client('hub');
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const path = `/staff/orders/${order.id}/accept`;
  const results = await Promise.all([hub(path, 'POST', { expectedStatus: 'received' }), hub(path, 'POST', { expectedStatus: 'received' })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const accepted = results.find((result) => result.status === 200).body.order;
  assert.equal(accepted.status, 'preparing');
  assert.equal(accepted.payment.status, 'approved');
  assert.deepEqual(accepted.events.map((event) => event.status), ['received', 'entered', 'preparing']);
  assert.equal((await f.request('/my/orders')).body.orders[0].payment.status, 'approved');
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  assert.deepEqual(JSON.parse(db.prepare('SELECT payment_events FROM orders WHERE id=?').get(order.id).payment_events).map((event) => event.status), ['pending', 'approved']);
  db.close();
  assert.equal((await hub(`/staff/orders/${order.id}`, 'PATCH', { status: 'ready', expectedStatus: 'preparing' })).status, 200);
});

test('one-click accept finishes entered tickets and rejects invalid retail authorization', async (t) => {
  const f = await fixture(t);
  const hub = await f.client('hub');
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const path = `/staff/orders/${order.id}/accept`;
  assertError(await hub(path, 'POST', { expectedStatus: 'entered' }), 409, 'STATUS_CONFLICT');
  assert.equal((await hub(`/staff/orders/${order.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' })).status, 200);
  assert.equal((await hub(path, 'POST', { expectedStatus: 'entered' })).status, 200);
  assert.deepEqual((await f.request(`/orders/${order.token}`)).body.order.events.map((event) => event.status), ['received', 'entered', 'preparing']);
  const blocked = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const db = new DatabaseSync(f.dbPath);
  const row = db.prepare('SELECT payment FROM orders WHERE id=?').get(blocked.id);
  db.prepare('UPDATE orders SET payment=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(row.payment), authorized: false }), blocked.id);
  assertError(await hub(`/staff/orders/${blocked.id}/accept`, 'POST', { expectedStatus: 'received' }), 409, 'PAYMENT_AUTHORIZATION_REQUIRED');
  const wrong = db.prepare('SELECT payment FROM orders WHERE id=?').get(blocked.id);
  db.prepare('UPDATE orders SET payment=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(wrong.payment), authorized: true, studentId: '10002' }), blocked.id);
  db.close();
  assertError(await hub(`/staff/orders/${blocked.id}/accept`, 'POST', { expectedStatus: 'received' }), 409, 'STUDENT_ID_MISMATCH');
  assert.equal((await f.request(`/orders/${blocked.token}`)).body.order.status, 'received');
});

test('retail payment consent is required and ID is derived solely from the student session', async (t) => {
  const f = await fixture(t);
  assertError(await f.request('/orders', 'POST', await f.payload({ paymentAuthorized: false })), 400, 'PAYMENT_AUTHORIZATION_REQUIRED');
  assertError(await f.request('/orders', 'POST', await f.payload({ paymentAuthorized: true, studentId: 'D10002' })), 400, 'INVALID_INPUT');
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  assert.equal(order.payment.authorized, true);
  assert.equal(order.payment.status, 'pending');
  assert.equal(order.payment.method, 'campus_account');
  assert.equal(order.payment.studentId, '10001');
  assertError(await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'preparing', expectedStatus: 'received' }), 409, 'STATUS_CONFLICT');
  const publicCatalog = JSON.stringify((await f.raw('/catalog')).body);
  assert.ok(!publicCatalog.includes('10001'));
  assert.ok(!publicCatalog.includes(order.token));
});

test('staff entry verifies the online retail student ID and drives the visible queue before payment', async (t) => {
  const f = await fixture(t);
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const statusPath = `/staff/orders/${order.id}`;
  const paymentPath = `${statusPath}/payment`;
  assertError(await f.request(statusPath, 'PATCH', { status: 'preparing', expectedStatus: 'received' }), 409, 'STATUS_CONFLICT');
  assertError(await f.request(paymentPath, 'PATCH', { status: 'approved', expectedStatus: 'pending' }), 409, 'PAYMENT_CONFLICT');
  assertError(await f.request(statusPath, 'PATCH', { status: 'entered', expectedStatus: 'received' }), 400, 'STUDENT_ID_REQUIRED');
  assertError(await f.request(statusPath, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10002' }), 409, 'STUDENT_ID_MISMATCH');
  const student = await f.client('D10001');
  assertError(await student(statusPath, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' }), 403, 'STAFF_REQUIRED');
  const entered = await f.request(statusPath, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' });
  assert.equal(entered.status, 200);
  assert.deepEqual(entered.body.order.events.map((event) => event.status), ['received', 'entered']);
  assert.equal((await f.request(`/orders/${order.token}`)).body.order.status, 'entered');
  const queue = (await f.request('/catalog')).body.stations.find((station) => station.id === 'hub').queue;
  assert.equal(queue.entered, 1);
  assert.equal(queue.active, 1);
  assertError(await f.request(statusPath, 'PATCH', { status: 'preparing', expectedStatus: 'entered' }), 409, 'PAYMENT_REQUIRED');
  assertError(await f.request(statusPath, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' }), 409, 'STATUS_CONFLICT');
  assert.equal((await f.request(paymentPath, 'PATCH', { status: 'approved', expectedStatus: 'pending' })).status, 200);
  assert.equal((await f.request(statusPath, 'PATCH', { status: 'preparing', expectedStatus: 'entered' })).status, 200);
});

test('payment approval is compare-and-set, blocks double charge, then permits preparation without a fake refund', async (t) => {
  const f = await fixture(t);
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const path = `/staff/orders/${order.id}/payment`;
  assertError(await f.request(path, 'PATCH', { status: 'approved', expectedStatus: 'pending' }), 409, 'PAYMENT_CONFLICT');
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' })).status, 200);
  const results = await Promise.all([f.request(path, 'PATCH', { status: 'approved', expectedStatus: 'pending' }), f.request(path, 'PATCH', { status: 'approved', expectedStatus: 'pending' })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const approved = results.find((result) => result.status === 200).body.order;
  assert.equal(approved.payment.status, 'approved');
  assert.ok(approved.payment.updatedAt);
  assertError(await f.request(`/orders/${order.token}/cancel`, 'POST'), 409, 'STATUS_CONFLICT');
  assertError(await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'cancelled', expectedStatus: 'entered' }), 409, 'PAYMENT_ALREADY_APPROVED');
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'preparing', expectedStatus: 'entered' })).status, 200);
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  const events = JSON.parse(db.prepare('SELECT payment_events FROM orders WHERE id=?').get(order.id).payment_events);
  assert.deepEqual(events.map((event) => event.status), ['pending', 'approved']);
  assert.ok(!JSON.stringify(events).includes('10001'));
  db.close();
});

test('declined payments cannot prepare, can cancel, and staff walk-ins have counter payment without an ID', async (t) => {
  const f = await fixture(t);
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  const paymentPath = `/staff/orders/${order.id}/payment`;
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received', studentId: '10001' })).status, 200);
  assert.equal((await f.request(paymentPath, 'PATCH', { status: 'declined', expectedStatus: 'pending' })).status, 200);
  assertError(await f.request(paymentPath, 'PATCH', { status: 'approved', expectedStatus: 'pending' }), 409, 'PAYMENT_CONFLICT');
  assertError(await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'preparing', expectedStatus: 'entered' }), 409, 'PAYMENT_REQUIRED');
  assertError(await f.request(`/orders/${order.token}/cancel`, 'POST'), 409, 'STATUS_CONFLICT');
  assert.equal((await f.request(`/staff/orders/${order.id}`, 'PATCH', { status: 'cancelled', expectedStatus: 'entered' })).status, 200);
  const walkIn = (await f.request('/staff/orders', 'POST', await f.payload({ paymentAuthorized: false }))).body.order;
  assert.equal(walkIn.payment.method, 'counter');
  assert.equal(walkIn.payment.status, 'pending');
  assert.equal(walkIn.payment.authorized, false);
  assert.equal(walkIn.payment.studentId, undefined);
  assert.ok(walkIn.token);
  assert.equal((await f.request(`/staff/orders/${walkIn.id}`, 'PATCH', { status: 'entered', expectedStatus: 'received' })).status, 200);
  assert.equal((await f.request(`/staff/orders/${walkIn.id}/payment`, 'PATCH', { status: 'declined', expectedStatus: 'pending' })).status, 200);
  assertError(await f.request(`/staff/orders/${walkIn.id}`, 'PATCH', { status: 'preparing', expectedStatus: 'entered' }), 409, 'PAYMENT_REQUIRED');
  const cancelledWalkIn = await f.request(`/staff/orders/${walkIn.id}`, 'PATCH', { status: 'cancelled', expectedStatus: 'entered' });
  assert.equal(cancelledWalkIn.status, 200);
  assert.equal(cancelledWalkIn.body.order.status, 'cancelled');
  assert.equal(cancelledWalkIn.body.order.payment.status, 'declined');
  assertError(await f.request(`/staff/orders/${walkIn.id}`, 'PATCH', { status: 'cancelled', expectedStatus: 'received' }), 409, 'STATUS_CONFLICT');
  const hub = await f.client('hub');
  assert.equal((await hub(`/orders/${walkIn.token}`)).status, 200);
  assertError(await f.request(`/orders/${walkIn.token}`), 404, 'ORDER_NOT_FOUND');
});

test('Starbucks muffin and drip coffee demo combo uses one swipe and sends milk choices to staff', async (t) => {
  const f = await fixture(t);
  const coffee = await f.client('coffee');
  const body = await f.payload({ stationId: 'starbucks', itemId: 'starbucks-bakery-combo', paymentMode: 'meal_exchange', selections: {
    'starbucks-combo-muffin': ['starbucks-combo-blueberry'],
    'starbucks-combo-coffee-milk': ['starbucks-combo-coffee-oat'],
    'starbucks-combo-coffee-sweetener': ['starbucks-combo-coffee-sugar'],
  } });
  const result = await f.request('/orders', 'POST', body);
  assert.equal(result.status, 201);
  assert.equal(result.body.order.itemName, 'Muffin + drip coffee combo');
  assert.equal(result.body.order.payment.method, 'meal_exchange');
  assert.equal(result.body.order.payment.status, 'pending');
  assert.deepEqual(result.body.order.pricing, { amountCents: null, currency: 'USD', status: 'meal_swipe', sourceUrl: null, note: 'One fictional demo meal swipe; not an institutional benefit.' });
  assert.deepEqual(result.body.order.selectionSummary.map((group) => group.values), [['Blueberry muffin'], ['Oat milk'], ['Sugar']]);
  const staff = await coffee('/staff/orders?stationId=starbucks');
  assert.equal(staff.body.orders.length, 1);
  assert.deepEqual(staff.body.orders[0].selectionSummary, result.body.order.selectionSummary);
  assert.equal(staff.body.orders[0].token, undefined);
  assert.equal((await f.request('/orders', 'POST', body)).status, 200);
  assertError(await f.request('/orders', 'POST', { ...body, idempotencyKey: randomUUID(), selections: {} }), 400, 'OPTION_COUNT');
  assertError(await f.request('/orders', 'POST', { ...body, idempotencyKey: randomUUID(), pricing: { amountCents: 1 } }), 400, 'INVALID_INPUT');
  const frothy = await f.payload({ stationId: 'frothy', itemId: 'frothy-coffee', paymentMode: 'meal_exchange' });
  assertError(await f.request('/orders', 'POST', frothy), 400, 'EXCHANGE_NOT_ELIGIBLE');
  assert.equal((await coffee('/staff/orders')).body.orders.length, 1);
  assertError(await coffee('/staff/orders?stationId=hub'), 403, 'STATION_FORBIDDEN');
});

test('latte requires milk while drip coffee can be ordered black', async (t) => {
  const f = await fixture(t);
  const latte = await f.payload({ stationId: 'frothy', itemId: 'frothy-latte', selections: { 'frothy-latte-temperature': ['frothy-latte-iced'] } });
  assertError(await f.request('/orders', 'POST', latte), 400, 'OPTION_COUNT');
  const withMilk = await f.request('/orders', 'POST', { ...latte, idempotencyKey: randomUUID(), selections: { ...latte.selections, 'frothy-latte-milk': ['frothy-latte-almond'] } });
  assert.equal(withMilk.status, 201);
  assert.deepEqual(withMilk.body.order.selectionSummary.find((group) => group.group === 'frothy-latte-milk').values, ['Almond milk']);
  const black = await f.request('/orders', 'POST', await f.payload({ stationId: 'starbucks', itemId: 'starbucks-coffee', selections: {} }));
  assert.equal(black.status, 201);
  assert.deepEqual(black.body.order.selectionSummary.find((group) => group.group === 'starbucks-coffee-milk').values, []);
});

test('no preopening or closed slots, complete windows before close, and same rules for walk-ins', async (t) => {
  const f = await fixture(t);
  f.setTime(Date.parse('2026-09-28T11:59:00Z')); // 06:59 Central
  assert.equal((await f.slots('starbucks')).length, 0);
  f.setTime(Date.parse('2026-09-28T12:00:00Z'));
  assert.equal((await f.request('/slots?stationId=starbucks')).body.service.open, true);
  assert.ok((await f.slots('starbucks')).length > 0);
  f.setTime(Date.parse('2026-09-28T20:48:00Z')); // Last full Starbucks window
  const last = await f.slots('starbucks');
  assert.equal(last.length, 1);
  assert.equal(last[0].endsAt, '2026-09-28T21:00:00.000Z');
  const body = await f.payload({ stationId: 'starbucks', itemId: 'starbucks-coffee', slotId: last[0].id });
  assert.equal((await f.request('/orders', 'POST', body)).status, 201);
  f.setTime(Date.parse('2026-09-28T20:49:00Z'));
  assert.equal((await f.slots('starbucks')).length, 0);
  const near = (await f.request('/slots?stationId=starbucks')).body.service;
  assert.equal(near.open, true);
  assert.equal(near.acceptingOrders, false);
  assert.equal(near.label, 'Orders closed for this service');
  assertError(await f.request('/staff/orders', 'POST', { ...body, idempotencyKey: randomUUID() }), 409, 'SLOT_UNAVAILABLE');
  f.setTime(Date.parse('2026-09-28T21:00:00Z'));
  assertError(await f.request('/orders', 'POST', { ...body, idempotencyKey: randomUUID() }), 409, 'SERVICE_CLOSED');
  assertError(await f.request('/staff/orders', 'POST', { ...body, idempotencyKey: randomUUID() }), 409, 'SERVICE_CLOSED');
  assert.equal((await f.request('/orders', 'POST', body)).status, 200);
});

test('cafeteria continuous demo schedule and retail weekend hours remain DST-aware', async (t) => {
  const f = await fixture(t);
  f.setTime(Date.parse('2026-09-28T19:00:00Z')); // Monday 14:00: sandwich continues through the afternoon
  assert.equal((await f.slots('omelet')).length, 0);
  assert.ok((await f.slots('sandwich')).length > 0);
  const service = (await f.request('/slots?stationId=omelet')).body.service;
  assert.equal(service.nextOpensAt, '2026-09-29T13:00:00.000Z');
  assert.match(service.scheduleNote, /not verified/);
  f.setTime(Date.parse('2026-09-27T14:30:00Z')); // Sunday 09:30 breakfast is active in this explicit demo policy
  assert.ok((await f.slots('omelet')).length > 0);
  assert.equal((await f.slots('frothy')).length, 0);
  assert.ok((await f.slots('starbucks')).length > 0);
  f.setTime(Date.parse('2026-09-26T17:00:00Z')); // Saturday noon
  assert.equal((await f.slots('starbucks')).length, 0);
  assert.ok((await f.slots('frothy')).length > 0);
  f.setTime(Date.parse('2026-12-07T12:59:00Z')); // Winter Monday 06:59 CST
  assert.equal((await f.slots('starbucks')).length, 0);
  f.setTime(Date.parse('2026-12-07T13:00:00Z'));
  assert.ok((await f.slots('starbucks')).length > 0);
});

test('only manager controls the advancing demo clock, preserving accepted snapshots and resetting live on restart', async (t) => {
  const f = await fixture(t);
  const cafeteria = await f.client('cafeteria');
  assertError(await cafeteria('/staff/demo-clock', 'PATCH', { mode: 'lunch' }), 403, 'MANAGER_REQUIRED');
  assertError(await f.raw('/staff/demo-clock', 'PATCH', { mode: 'lunch' }), 401, 'AUTH_REQUIRED');
  assertError(await f.request('/staff/demo-clock', 'PATCH', { mode: 'invented' }), 400, 'INVALID_CLOCK_MODE');
  const lunch = await f.request('/staff/demo-clock', 'PATCH', { mode: 'lunch' });
  assert.equal(lunch.body.serviceClock.now, '2026-09-28T17:00:00.000Z');
  assert.match(lunch.body.serviceClock.label, /Simulated/);
  const order = (await f.request('/orders', 'POST', await f.payload())).body.order;
  f.setRealTime(f.getRealTime() + 60000);
  assert.equal((await f.request('/catalog')).body.serviceClock.now, '2026-09-28T17:01:00.000Z');
  await f.request('/staff/demo-clock', 'PATCH', { mode: 'near_close' });
  assert.equal((await f.slots('starbucks')).length, 1);
  await f.request('/staff/demo-clock', 'PATCH', { mode: 'closed' });
  for (const id of ['omelet', 'hamburger', 'sandwich', 'hub', 'frothy', 'starbucks']) assert.equal((await f.slots(id)).length, 0);
  assert.deepEqual((await f.request(`/orders/${order.token}`)).body.order.slot, order.slot);
  await f.restart();
  assert.equal((await f.request('/catalog')).body.serviceClock.mode, 'live');
});

test('V1 SQLite migration preserves legacy snapshots and states, makes anonymous tickets staff-only, and keeps settings', async (t) => {
  const legacySnapshot = { id: 'legacy-order', token: 'legacy-private-token', pickupCode: '654321', stationId: 'hub', itemId: 'seasoned-fries', itemName: 'Original fries name', stationName: 'Original Hub name', location: 'Original location', selectionSummary: [], exclusions: ['Original exclusion'], slot: { id: 'hub:1790615400000', startsAt: '2026-09-28T17:10:00.000Z', endsAt: '2026-09-28T17:20:00.000Z', remaining: 6, totalRemaining: 9, capacity: 10, onlineCapacity: 7, available: true }, status: 'received', source: 'online', paymentMode: 'regular', createdAt: '2026-09-28T17:00:00.000Z', updatedAt: '2026-09-28T17:00:00.000Z', queueAhead: 0, events: [{ status: 'received', at: '2026-09-28T17:00:00.000Z' }] };
  const f = await fixture(t, { setup: (dbPath) => {
    const db = new DatabaseSync(dbPath);
    db.exec(`CREATE TABLE stations(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE items(id TEXT PRIMARY KEY,station_id TEXT NOT NULL,data TEXT NOT NULL);
      CREATE TABLE orders(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,token TEXT UNIQUE,pickup_code TEXT UNIQUE,idempotency_key TEXT UNIQUE,canonical TEXT,station_id TEXT,item_id TEXT,slot_id TEXT,source TEXT,status TEXT,snapshot TEXT,events TEXT,created_at TEXT,updated_at TEXT);`);
    const station = { ...seedStations.find((station) => station.id === 'hub'), paused: true, capacity: 5, onlineCapacity: 2 };
    delete station.locationId;
    db.prepare('INSERT INTO stations VALUES (?,?)').run('hub', JSON.stringify(station));
    const item = { ...seedItems.find((item) => item.id === 'seasoned-fries'), available: false };
    db.prepare('INSERT INTO items VALUES (?,?,?)').run(item.id, 'hub', JSON.stringify(item));
    const oldBurger = structuredClone(seedItems.find((candidate) => candidate.id === 'hub-burger'));
    oldBurger.groups[0].options[0].available = false;
    oldBurger.groups = oldBurger.groups.filter((group) => group.id !== 'burger-sauce');
    db.prepare('INSERT INTO items VALUES (?,?,?)').run(oldBurger.id, 'hub', JSON.stringify(oldBurger));
    db.prepare('INSERT INTO orders(id,token,pickup_code,idempotency_key,canonical,station_id,item_id,slot_id,source,status,snapshot,events,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(legacySnapshot.id, legacySnapshot.token, legacySnapshot.pickupCode, 'legacy-key', '{}', 'hub', item.id, legacySnapshot.slot.id, 'online', 'ready', JSON.stringify(legacySnapshot), JSON.stringify([...legacySnapshot.events, { status: 'preparing', at: legacySnapshot.createdAt }, { status: 'ready', at: legacySnapshot.createdAt }]), legacySnapshot.createdAt, legacySnapshot.updatedAt);
    db.close();
  } });
  const hub = await f.client('hub');
  assertError(await f.request(`/orders/${legacySnapshot.token}`), 404, 'ORDER_NOT_FOUND');
  assert.deepEqual((await f.request('/my/orders')).body.orders, []);
  const list = await hub('/staff/orders');
  assert.equal(list.body.orders.length, 1);
  assert.equal(list.body.orders[0].status, 'ready');
  assert.deepEqual(list.body.orders[0].slot, legacySnapshot.slot);
  assert.deepEqual(list.body.orders[0].exclusions, legacySnapshot.exclusions);
  assert.equal(list.body.orders[0].itemName, legacySnapshot.itemName);
  assert.equal(list.body.orders[0].token, undefined);
  assert.equal(list.body.orders[0].payment.studentId, undefined);
  assert.equal(list.body.orders[0].payment.status, 'pending'); // Never invent a historical approved charge.
  assert.equal(list.body.orders[0].unitCount, 1);
  assert.equal(list.body.orders[0].items[0].itemName, legacySnapshot.itemName);
  const catalog = (await f.request('/catalog')).body;
  assert.equal(catalog.stations.find((station) => station.id === 'hub').onlineCapacity, 2);
  assert.equal(catalog.stations.find((station) => station.id === 'hub').paused, true);
  assert.equal(catalog.items.find((item) => item.id === 'seasoned-fries').available, false);
  const migratedBurger = catalog.items.find((item) => item.id === 'hub-burger');
  assert.equal(migratedBurger.groups.find((group) => group.id === 'burger-toppings').options.find((option) => option.id === 'burger-lettuce').available, false);
  assert.ok(migratedBurger.groups.some((group) => group.id === 'burger-sauce'));
  assert.equal(catalog.stations.length, 6);
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  const stored = db.prepare('SELECT * FROM orders WHERE id=?').get(legacySnapshot.id);
  assert.deepEqual(JSON.parse(stored.snapshot), legacySnapshot);
  assert.equal(stored.actor_id, null);
  assert.equal(stored.owner_id, null);
  assert.equal(stored.idempotency_key, 'legacy:legacy-key');
  assert.equal(stored.unit_count, 1);
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get().sql, /'entered'/);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='orders_queue'").get());
  db.close();
  await f.restart();
  assert.equal((await hub('/staff/orders')).body.orders.length, 1);
});

test('coffee catalog migration preserves availability and accepted snapshots while retiring old Frothy exchange', async (t) => {
  const f = await fixture(t, { setup: (dbPath) => {
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE items(id TEXT PRIMARY KEY,station_id TEXT NOT NULL,data TEXT NOT NULL)');
    const latte = structuredClone(seedItems.find((item) => item.id === 'frothy-latte'));
    latte.name = 'Old sample latte';
    latte.available = false;
    latte.groups = latte.groups.slice(0, 2);
    latte.groups[0].options[0].available = false;
    const combo = structuredClone(seedItems.find((item) => item.id === 'starbucks-bakery-combo'));
    combo.name = 'Old bakery combo';
    combo.groups = [];
    const oldExchange = { id: 'frothy-coffee-exchange', stationId: 'frothy', name: 'Old exchange sample', available: true, exchangeEligible: true, groups: [] };
    for (const item of [latte, combo, oldExchange]) db.prepare('INSERT INTO items VALUES (?,?,?)').run(item.id, item.stationId, JSON.stringify(item));
    db.close();
  } });
  let catalog = (await f.request('/catalog')).body;
  const latte = catalog.items.find((item) => item.id === 'frothy-latte');
  assert.equal(latte.name, 'Café latte');
  assert.equal(latte.available, false);
  assert.equal(latte.groups[0].options[0].available, false);
  assert.equal(latte.groups.length, 3);
  assert.equal(catalog.items.find((item) => item.id === 'starbucks-bakery-combo').groups.length, 3);
  assert.equal(catalog.items.some((item) => item.id === 'frothy-coffee-exchange'), false);
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  assert.equal(JSON.parse(db.prepare('SELECT data FROM items WHERE id=?').get('frothy-coffee-exchange').data).retired, true);
  db.close();
  await f.request('/staff/items/starbucks-bakery-combo/groups/starbucks-combo-muffin/options/starbucks-combo-blueberry', 'PATCH', { available: false });
  const created = await f.request('/orders', 'POST', await f.payload({ stationId: 'frothy', itemId: 'frothy-cold-brew', selections: { 'frothy-cold-brew-milk': ['frothy-cold-brew-almond'] } }));
  assert.equal(created.status, 201);
  const snapshot = created.body.order;
  await f.restart();
  catalog = (await f.request('/catalog')).body;
  assert.equal(catalog.items.find((item) => item.id === 'frothy-latte').available, false);
  assert.equal(catalog.items.find((item) => item.id === 'starbucks-bakery-combo').groups[0].options[0].available, false);
  const accepted = (await f.request(`/orders/${snapshot.token}`)).body.order;
  assert.equal(accepted.itemName, snapshot.itemName);
  assert.deepEqual(accepted.selectionSummary, snapshot.selectionSummary);
  assert.deepEqual(accepted.pricing, snapshot.pricing);
});

test('cafeteria sauce removal and sandwich menu migration keep unchanged staff stock', async (t) => {
  const f = await fixture(t, { setup: (dbPath) => {
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE items(id TEXT PRIMARY KEY,station_id TEXT NOT NULL,data TEXT NOT NULL)');
    for (const id of ['build-your-hamburger', 'build-your-sandwich']) {
      const item = structuredClone(seedItems.find((candidate) => candidate.id === id));
      item.available = false;
      if (id === 'build-your-sandwich') {
        const sauce = item.groups.find((group) => group.id === 'sauces');
        sauce.kind = 'customization';
        item.groups[0].options.unshift({ id: 'sourdough', label: 'Sourdough', available: true });
        item.groups = item.groups.filter((group) => group.id !== 'sandwich-toast');
        sauce.options = [{ id: 'mustard', label: 'Mustard', available: true }, { id: 'ranch', label: 'Ranch', available: false }];
      } else {
        item.groups.unshift({ id: 'hamburger-bun', label: 'Bun', min: 1, max: 1, kind: 'customization', options: [{ id: 'burger-brioche', label: 'Brioche bun', available: true }] });
        item.groups.splice(1, 0, { id: 'hamburger-cheese', label: 'Cheese', min: 0, max: 1, kind: 'customization', options: [{ id: 'grill-cheddar', label: 'Cheddar', available: true }] });
        const toppings = item.groups.find((group) => group.id === 'hamburger-toppings');
        toppings.options.find((option) => option.id === 'grill-lettuce').available = false;
        toppings.options.push({ id: 'grill-onion', label: 'Onion', available: true });
        item.groups.push({ id: 'hamburger-sauce', label: 'Sauce', min: 0, max: 1, kind: 'sauce', options: [{ id: 'grill-ketchup', label: 'Ketchup', available: false }] });
      }
      db.prepare('INSERT INTO items VALUES (?,?,?)').run(item.id, item.stationId, JSON.stringify(item));
    }
    db.close();
  } });
  for (const id of ['build-your-hamburger', 'build-your-sandwich']) {
    const item = (await f.request('/catalog')).body.items.find((candidate) => candidate.id === id);
    assert.equal(item.available, false);
    if (id === 'build-your-sandwich') {
      const sauce = item.groups.find((group) => group.id === 'sauces');
      assert.equal(sauce.kind, 'sauce');
      assert.equal(item.groups[0].options.some((option) => option.id === 'sourdough'), false);
      assert.equal(item.groups.at(-1).id, 'sandwich-toast');
      assert.equal(sauce.options.find((option) => option.id === 'ranch').available, false);
      assert.deepEqual(sauce.options.slice(0, 4).map((option) => option.label), ['Chipotle mayo', 'Ranch', 'Mayonnaise', 'Mustard']);
    } else {
      assert.deepEqual(item.groups.map((group) => group.id), ['hamburger-toppings']);
      assert.equal(item.groups[0].options.find((option) => option.id === 'grill-lettuce').available, false);
      assert.equal(item.groups[0].options.some((option) => option.id === 'grill-onion'), false);
    }
  }
  await f.restart();
  assert.equal((await f.request('/catalog')).body.items.find((item) => item.id === 'build-your-sandwich').groups.find((group) => group.id === 'sauces').options.find((option) => option.id === 'ranch').available, false);
});

test('Hub sauce migration removes old dips and retains stock for surviving cups', async (t) => {
  const f = await fixture(t, { setup: (dbPath) => {
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE items(id TEXT PRIMARY KEY,station_id TEXT NOT NULL,data TEXT NOT NULL)');
    const tender = structuredClone(seedItems.find((item) => item.id === 'chicken-tenders'));
    const sauce = tender.groups.find((group) => group.id === 'tender-dip');
    sauce.options.find((option) => option.id === 'tender-ranch').available = false;
    sauce.options.push({ id: 'bbq', label: 'BBQ', available: true });
    db.prepare('INSERT INTO items VALUES (?,?,?)').run(tender.id, tender.stationId, JSON.stringify(tender));
    db.close();
  } });
  const tender = (await f.request('/catalog')).body.items.find((item) => item.id === 'chicken-tenders');
  const sauce = tender.groups.find((group) => group.id === 'tender-dip');
  assert.deepEqual(sauce.options.map((option) => option.id), ['tender-ranch', 'tender-hub-sauce']);
  assert.equal(sauce.options.find((option) => option.id === 'tender-ranch').available, false);
  assert.equal(sauce.options.find((option) => option.id === 'tender-hub-sauce').available, true);
  await f.restart();
  const reloaded = (await f.request('/catalog')).body.items.find((item) => item.id === 'chicken-tenders').groups[0];
  assert.deepEqual(reloaded.options, sauce.options);
});

test('rush simulation is manager-only and uses a disabled internal account, never student histories', async (t) => {
  const f = await fixture(t);
  const body = { stationId: 'hub', idempotencyKey: 'rush-account-check' };
  assertError(await f.raw('/staff/demo-rush', 'POST', body), 401, 'AUTH_REQUIRED');
  assertError(await (await f.client('D10001'))('/staff/demo-rush', 'POST', body), 403, 'STAFF_REQUIRED');
  assertError(await (await f.client('hub'))('/staff/demo-rush', 'POST', body), 403, 'MANAGER_REQUIRED');
  assertError(await f.login('QUEUE-DEMO'), 401, 'INVALID_CREDENTIALS');
  assertError(await f.request('/orders', 'POST', await f.payload({ simulated: true })), 400, 'INVALID_INPUT');
  const result = await f.request('/staff/demo-rush', 'POST', body);
  assert.equal(result.status, 200);
  assert.equal(result.body.created, 3);
  assert.ok(result.body.orders.every((order) => order.simulated === true && order.source === 'online' && !order.token));
  assert.ok(result.body.orders.every((order) => order.payment.status === 'approved' && order.payment.studentId === 'QUEUE-DEMO' && order.payment.authorized === false));
  assert.deepEqual((await f.request('/my/orders')).body.orders, []);
  assert.deepEqual((await (await f.client('D10002'))('/my/orders')).body.orders, []);
  const studentOrder = (await f.request('/orders', 'POST', await f.payload())).body.order;
  assert.equal(studentOrder.queueAhead, 3);
  assert.equal(studentOrder.simulated, undefined);
  assert.equal(studentOrder.payment.status, 'pending');
  assert.equal((await f.request('/my/orders')).body.orders.length, 1);
});

test('rush intent retries are atomic and durable, returning the same tickets after closure', async (t) => {
  const f = await fixture(t);
  const body = { stationId: 'hub', idempotencyKey: 'rush-concurrent-retry' };
  const [one, two] = await Promise.all([f.request('/staff/demo-rush', 'POST', body), f.request('/staff/demo-rush', 'POST', body)]);
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  assert.deepEqual(one.body, two.body);
  assert.equal((await f.request('/staff/orders?stationId=hub')).body.orders.length, 3);
  assertError(await f.request('/staff/demo-rush', 'POST', { ...body, stationId: 'omelet' }), 409, 'IDEMPOTENCY_CONFLICT');
  f.setTime(Date.parse('2026-09-29T04:00:00Z'));
  await f.restart();
  const retry = await f.request('/staff/demo-rush', 'POST', body);
  assert.deepEqual(retry.body, one.body);
  assert.equal((await f.request('/staff/orders?stationId=hub')).body.orders.length, 3);
});

test('rush respects the remaining capacity of one window and does not spill into later windows', async (t) => {
  const f = await fixture(t);
  await f.request('/staff/stations/hub', 'PATCH', { capacity: 2, onlineCapacity: 1 });
  const slotsBefore = await f.slots();
  const result = await f.request('/staff/demo-rush', 'POST', { stationId: 'hub', idempotencyKey: 'rush-one-space' });
  assert.equal(result.body.created, 1);
  assert.match(result.body.message, /full/i);
  assert.equal(result.body.orders[0].slot.id, slotsBefore[0].id);
  const slotsAfter = await f.slots();
  assert.equal(slotsAfter[0].remaining, 0);
  assert.equal(slotsAfter[0].totalRemaining, 1);
  assert.equal(slotsAfter[1].remaining, 1);
  const walkIn = await f.request('/staff/orders', 'POST', await f.payload({ slotId: slotsAfter[0].id }));
  assert.equal(walkIn.status, 201);
  assert.equal(walkIn.body.order.simulated, undefined);
});

test('rush never seeds when closed, paused, or required ingredients are unavailable; zero-result retries remain zero', async (t) => {
  const f = await fixture(t);
  f.setTime(Date.parse('2026-09-29T04:00:00Z'));
  const body = { stationId: 'hub', idempotencyKey: 'rush-closed' };
  const closed = await f.request('/staff/demo-rush', 'POST', body);
  assert.equal(closed.status, 200);
  assert.equal(closed.body.created, 0);
  assert.match(closed.body.message, /closed/);
  f.setTime(Date.parse('2026-09-28T17:01:00Z'));
  assert.deepEqual((await f.request('/staff/demo-rush', 'POST', body)).body, closed.body);
  await f.request('/staff/stations/hub', 'PATCH', { paused: true });
  const paused = await f.request('/staff/demo-rush', 'POST', { stationId: 'hub', idempotencyKey: 'rush-paused' });
  assert.equal(paused.body.created, 0);
  assert.match(paused.body.message, /paused/);
  f.setTime(Date.parse('2026-09-28T13:30:00Z')); // Breakfast stock validation
  for (const egg of ['whole-eggs', 'egg-whites']) await f.request(`/staff/items/build-your-omelet/groups/eggs/options/${egg}`, 'PATCH', { available: false });
  const unavailable = await f.request('/staff/demo-rush', 'POST', { stationId: 'omelet', idempotencyKey: 'rush-stock' });
  assert.equal(unavailable.body.created, 0);
  assert.match(unavailable.body.message, /required choices/);
  assert.deepEqual((await f.request('/staff/orders')).body.orders, []);
});
