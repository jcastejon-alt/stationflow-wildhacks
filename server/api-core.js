import express from 'express';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { stations as seedStations, items as seedItems } from './seed.js';
import { createAuth, validatePublicOrigin } from './auth.js';
import { createServicePolicy } from './service.js';

const SLOT_MS = 10 * 60 * 1000;
const LEAD_MS = 2 * 60 * 1000;
const HORIZON_MS = 2 * 60 * 60 * 1000;
const ACTIVE = "('received','entered','preparing','ready')";
const PREP_PENDING = "('received','entered','preparing')";
const ORDER_FIELDS = new Set(['idempotencyKey', 'stationId', 'itemId', 'selections', 'exclusions', 'items', 'slotId', 'paymentMode', 'paymentAuthorized', 'timingMode']);
const ORDER_ITEM_FIELDS = new Set(['itemId', 'selections', 'exclusions', 'quantity']);
const MAX_ORDER_UNITS = 6;
const FORWARD = { received: ['entered', 'cancelled'], entered: ['preparing', 'cancelled'], preparing: ['ready'], ready: ['picked_up'] };

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requiredString = (value, name, max = 200) => {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || !value.trim()) fail(400, 'INVALID_INPUT', `${name} must be a nonempty string.`);
  return value;
};
const exactKeys = (value, allowed) => {
  if (!object(value)) fail(400, 'INVALID_INPUT', 'A JSON object is required.');
  if (Object.keys(value).some((key) => !allowed.has(key))) fail(400, 'INVALID_INPUT', 'This request contains unsupported fields.');
};
const booleanField = (value) => { if (typeof value !== 'boolean') fail(400, 'INVALID_INPUT', 'available must be true or false.'); };

export function createApiApp({ db, transact, clockState, now = () => new Date(), realNow = () => Date.now(), cafeteriaHours, publicOrigin, originCheckedAtEdge = false, allowedOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'] } = {}) {
  const trustedPublicOrigin = validatePublicOrigin(publicOrigin);
  const { locations, intervalsFor, serviceAt } = createServicePolicy(cafeteriaHours);
  if (!db || !transact) throw new Error('A database and transaction function are required');
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, station_id TEXT NOT NULL REFERENCES stations(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, token TEXT NOT NULL UNIQUE,
      pickup_code TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE, canonical TEXT NOT NULL,
      station_id TEXT NOT NULL REFERENCES stations(id), item_id TEXT NOT NULL REFERENCES items(id),
      slot_id TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('online','walk_in')),
      status TEXT NOT NULL CHECK(status IN ('received','entered','preparing','ready','picked_up','cancelled')),
      snapshot TEXT NOT NULL, events TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_slot ON orders(station_id, slot_id);
    CREATE INDEX IF NOT EXISTS orders_queue ON orders(station_id, source, status, seq);
  `);
  const auth = createAuth({ db, transact, fail, requiredString, exactKeys, realNow, allowedOrigins, publicOrigin: trustedPublicOrigin, originCheckedAtEdge });
  transact(() => {
    const columns = new Set(db.prepare('PRAGMA table_info(orders)').all().map((column) => column.name));
    if (!columns.has('owner_id')) db.exec('ALTER TABLE orders ADD COLUMN owner_id TEXT REFERENCES users(id)');
    if (!columns.has('actor_id')) {
      db.exec('ALTER TABLE orders ADD COLUMN actor_id TEXT REFERENCES users(id)');
      db.exec("UPDATE orders SET idempotency_key='legacy:' || idempotency_key");
    }
    if (!columns.has('payment')) {
      db.exec('ALTER TABLE orders ADD COLUMN payment TEXT');
      db.exec("ALTER TABLE orders ADD COLUMN payment_events TEXT NOT NULL DEFAULT '[]'");
      for (const row of db.prepare('SELECT id,station_id,created_at FROM orders').all()) {
        const cafeteria = ['omelet', 'hamburger', 'sandwich'].includes(row.station_id);
        db.prepare('UPDATE orders SET payment=? WHERE id=?').run(JSON.stringify({ status: cafeteria ? 'not_required' : 'pending', method: cafeteria ? 'cafeteria_entry' : 'counter', authorized: false, updatedAt: null }), row.id);
      }
    }
    if (!columns.has('unit_count')) db.exec('ALTER TABLE orders ADD COLUMN unit_count INTEGER NOT NULL DEFAULT 1 CHECK(unit_count BETWEEN 1 AND 6)');
    // SQLite cannot alter a CHECK constraint in place. Keep existing tickets and
    // their original snapshots while opening the new staff-entered state.
    const ordersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get().sql;
    if (!ordersSql.includes("'entered'")) {
      db.exec(`
        CREATE TABLE orders_with_entered (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, token TEXT NOT NULL UNIQUE,
          pickup_code TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE, canonical TEXT NOT NULL,
          station_id TEXT NOT NULL REFERENCES stations(id), item_id TEXT NOT NULL REFERENCES items(id),
          slot_id TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('online','walk_in')),
          status TEXT NOT NULL CHECK(status IN ('received','entered','preparing','ready','picked_up','cancelled')),
          snapshot TEXT NOT NULL, events TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          owner_id TEXT REFERENCES users(id), actor_id TEXT REFERENCES users(id),
          payment TEXT, payment_events TEXT NOT NULL DEFAULT '[]',
          unit_count INTEGER NOT NULL DEFAULT 1 CHECK(unit_count BETWEEN 1 AND 6)
        );
        INSERT INTO orders_with_entered SELECT seq,id,token,pickup_code,idempotency_key,canonical,station_id,item_id,slot_id,source,status,snapshot,events,created_at,updated_at,owner_id,actor_id,payment,payment_events,unit_count FROM orders;
        DROP TABLE orders;
        ALTER TABLE orders_with_entered RENAME TO orders;
        CREATE INDEX orders_slot ON orders(station_id, slot_id);
        CREATE INDEX orders_queue ON orders(station_id, source, status, seq);
      `);
    }
    db.exec('CREATE INDEX IF NOT EXISTS orders_owner ON orders(owner_id, seq)');
    db.exec('CREATE TABLE IF NOT EXISTS rush_intents (actor_id TEXT NOT NULL REFERENCES users(id), intent_key TEXT NOT NULL, station_id TEXT NOT NULL REFERENCES stations(id), response TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(actor_id,intent_key))');
    for (const station of seedStations) {
      const stored = db.prepare('SELECT data FROM stations WHERE id=?').get(station.id);
      const data = stored ? { ...station, ...JSON.parse(stored.data), locationId: station.locationId, name: station.name, location: station.location, description: station.description } : { ...station };
      data.physicalStationId = station.physicalStationId || station.id;
      data.queueGroupId = station.queueGroupId || station.id;
      if (station.id === 'hamburger') {
        const grill = JSON.parse(db.prepare('SELECT data FROM stations WHERE id=?').get('omelet').data);
        Object.assign(data, { capacity: grill.capacity, onlineCapacity: grill.onlineCapacity, paused: grill.paused });
      }
      db.prepare('INSERT INTO stations(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(station.id, JSON.stringify(data));
    }
    for (const item of seedItems) db.prepare('INSERT OR IGNORE INTO items(id,station_id,data) VALUES (?,?,?)').run(item.id, item.stationId, JSON.stringify(item));
    // Evolve retail demo menus in place while retaining staff availability toggles.
    // Accepted order snapshots remain immutable, including legacy coffee tickets.
    for (const seed of seedItems.filter((candidate) => ['hub', 'frothy', 'starbucks'].includes(candidate.stationId))) {
      const row = db.prepare('SELECT data FROM items WHERE id=?').get(seed.id);
      const old = JSON.parse(row.data);
      const oldGroups = new Map((old.groups || []).map((group) => [group.id, group]));
      const item = {
        ...seed,
        available: old.available ?? seed.available,
        ...(old.retired ? { retired: true } : {}),
        groups: seed.groups.map((group) => {
          const oldGroup = oldGroups.get(group.id);
          const oldOptions = new Map((oldGroup?.options || []).map((option) => [option.id, option]));
          return { ...group, options: group.options.map((option) => ({ ...option, available: oldOptions.get(option.id)?.available ?? option.available })) };
        }),
      };
      db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(item), seed.id);
    }
    // Evolve sandwich choices while preserving staff stock for unchanged IDs.
    // Accepted tickets keep their original immutable JSON snapshots.
    for (const seed of seedItems.filter((candidate) => candidate.stationId === 'sandwich')) {
      const row = db.prepare('SELECT data FROM items WHERE id=?').get(seed.id);
      const old = JSON.parse(row.data);
      const oldGroups = new Map((old.groups || []).map((group) => [group.id, group]));
      const item = { ...seed, available: old.available ?? seed.available, groups: seed.groups.map((group) => {
        const oldOptions = new Map((oldGroups.get(group.id)?.options || []).map((option) => [option.id, option]));
        return { ...group, options: group.options.map((option) => ({ ...option, available: oldOptions.get(option.id)?.available ?? option.available })) };
      }) };
      db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(item), seed.id);
    }
    // Replace the old bun/cheese screens with two burger choices, while
    // retaining stock switches for ingredients that still exist.
    for (const seed of seedItems.filter((candidate) => candidate.stationId === 'hamburger')) {
      const row = db.prepare('SELECT data FROM items WHERE id=?').get(seed.id);
      const old = JSON.parse(row.data);
      const oldGroups = new Map((old.groups || []).map((group) => [group.id, group]));
      const item = { ...seed, available: old.available ?? seed.available, groups: seed.groups.map((group) => {
        const oldOptions = new Map((oldGroups.get(group.id)?.options || []).map((option) => [option.id, option]));
        return { ...group, options: group.options.map((option) => ({ ...option, available: oldOptions.get(option.id)?.available ?? option.available })) };
      }) };
      db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(item), seed.id);
    }
    // Retire briefly seeded research placeholders without deleting any accepted snapshot.
    for (const retired of ['frothy-tea', 'frothy-smoothie', 'frothy-bakery-combo', 'frothy-coffee-exchange']) {
      const row = db.prepare('SELECT data FROM items WHERE id=?').get(retired);
      if (row) db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(row.data), available: false, retired: true }), retired);
    }
    db.exec('PRAGMA user_version = 8');
  });
  const savedClock = clockState?.read() || {};
  let clockMode = savedClock.mode || 'live', presetTime = savedClock.presetTime || 0, presetStarted = savedClock.presetStarted || 0;
  const clock = () => {
    const date = new Date(clockMode === 'live' ? now() : presetTime + (realNow() - presetStarted));
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid server clock');
    return date;
  };
  const chicagoDay = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const serviceDay = (value) => chicagoDay.format(new Date(value));
  const serviceClock = () => ({ mode: clockMode, now: clock().toISOString(), label: clockMode === 'live' ? 'Live Central time' : `Simulated ${({ breakfast: 'Monday breakfast', transition: 'Monday grill changeover', lunch: 'Monday lunch', near_close: 'Monday near closing', closed: 'Monday after hours' })[clockMode]} · advances in real time` });
  const stationById = (id) => {
    const row = db.prepare('SELECT data FROM stations WHERE id=?').get(id);
    if (!row) fail(404, 'STATION_NOT_FOUND', 'That demo station does not exist.');
    return JSON.parse(row.data);
  };
  const itemById = (id) => {
    const row = db.prepare('SELECT data FROM items WHERE id=?').get(id);
    if (!row) fail(404, 'ITEM_NOT_FOUND', 'That demo menu item does not exist.');
    return JSON.parse(row.data);
  };
  const physicalIds = (station) => db.prepare('SELECT data FROM stations ORDER BY rowid').all().map((row) => JSON.parse(row.data)).filter((candidate) => candidate.physicalStationId === station.physicalStationId).map((candidate) => candidate.id);
  const slotAt = (station, startsAtMs) => {
    const id = `${station.id}:${startsAtMs}`;
    const ids = physicalIds(station);
    const slotIds = ids.map((stationId) => `${stationId}:${startsAtMs}`);
    // A ticket can contain several items; reserve one unit of kitchen capacity
    // per item, including each quantity. Old snapshots count as one unit.
    const counts = db.prepare(`SELECT COALESCE(SUM(unit_count),0) AS total, COALESCE(SUM(CASE WHEN source='online' THEN unit_count ELSE 0 END),0) AS online FROM orders WHERE station_id IN (${ids.map(() => '?').join(',')}) AND slot_id IN (${slotIds.map(() => '?').join(',')})`).get(...ids, ...slotIds);
    const totalRemaining = Math.max(0, station.capacity - counts.total);
    const remaining = Math.max(0, Math.min(totalRemaining, station.onlineCapacity - counts.online));
    return { id, startsAt: new Date(startsAtMs).toISOString(), endsAt: new Date(startsAtMs + SLOT_MS).toISOString(), remaining, totalRemaining, capacity: station.capacity, onlineCapacity: station.onlineCapacity, available: !station.paused && remaining > 0 };
  };
  const timingMode = (value) => {
    if (value === undefined) return 'scheduled';
    if (!['asap', 'scheduled'].includes(value)) fail(400, 'INVALID_TIMING_MODE', 'Choose asap or scheduled ordering.');
    return value;
  };
  const slotsFor = (station, time, mode = 'scheduled') => {
    const cafeteria = station.locationId === 'cafeteria';
    const service = serviceAt(station, time);
    if (!(mode === 'scheduled' ? service.canSchedule : service.canOrderNow)) return [];
    const intervals = intervalsFor(station, time);
    const interval = cafeteria && mode === 'scheduled' ? intervals.find((candidate) => candidate.today) : intervals.find((candidate) => candidate.start <= time && time < candidate.end);
    if (!interval) return [];
    const first = Math.ceil(Math.max(time + LEAD_MS, interval.start) / SLOT_MS) * SLOT_MS;
    const slots = [];
    for (let start = first; start + SLOT_MS <= interval.end && (cafeteria || start < time + HORIZON_MS); start += SLOT_MS) slots.push(slotAt(station, start));
    return slots;
  };
  const stationView = (station) => {
    const ids = physicalIds(station);
    const queue = { received: 0, entered: 0, preparing: 0, ready: 0, active: 0 };
    const today = serviceDay(clock());
    for (const row of db.prepare(`SELECT status,json_extract(snapshot,'$.slot.startsAt') AS starts_at FROM orders WHERE station_id IN (${ids.map(() => '?').join(',')}) AND status IN ${ACTIVE}`).all(...ids)) {
      if (serviceDay(row.starts_at) !== today) continue;
      queue[row.status]++;
      if (row.status !== 'ready') queue.active++;
    }
    return { ...station, service: serviceAt(station, clock().getTime()), queue };
  };
  const orderFromRow = (row) => {
    if (!row) fail(404, 'ORDER_NOT_FOUND', 'That private demo ticket was not found.');
    const snapshot = JSON.parse(row.snapshot);
    const items = snapshot.items || [{ itemId: snapshot.itemId, itemName: snapshot.itemName, quantity: 1, selectionSummary: snapshot.selectionSummary, exclusions: snapshot.exclusions, unitPricing: snapshot.pricing }];
    const station = stationById(row.station_id), ids = physicalIds(station);
    // Match the pickup-window order shown to the kitchen. Declined payments
    // keep their reserved capacity but cannot be work ahead of this ticket.
    const criterion = "(json_extract(snapshot,'$.slot.startsAt')<? OR (json_extract(snapshot,'$.slot.startsAt')=? AND seq<?))";
    const day = serviceDay(snapshot.slot.startsAt);
    const queueAhead = db.prepare(`SELECT json_extract(snapshot,'$.slot.startsAt') AS starts_at FROM orders WHERE station_id IN (${ids.map(() => '?').join(',')}) AND source='online' AND status IN ${PREP_PENDING} AND COALESCE(json_extract(payment,'$.status'),'pending')!='declined' AND ${criterion}`).all(...ids, snapshot.slot.startsAt, snapshot.slot.startsAt, row.seq).filter((earlier) => serviceDay(earlier.starts_at) === day).length;
    return { ...snapshot, items, unitCount: snapshot.unitCount || 1, physicalStationId: station.physicalStationId, queueGroupId: station.queueGroupId, status: row.status, updatedAt: row.updated_at, queueAhead, events: JSON.parse(row.events), payment: JSON.parse(row.payment) };
  };
  const withoutToken = (order) => { const { token, ...result } = order; return result; };
  const forUser = (row, user) => row.owner_id === user.id ? orderFromRow(row) : withoutToken(orderFromRow(row));
  const accessibleOrder = (row, req) => {
    const user = auth.requireUser(req);
    if (!row || (user.role === 'student' && row.owner_id !== user.id)) fail(404, 'ORDER_NOT_FOUND', 'That private demo ticket was not found.');
    if (user.role !== 'student') auth.requireStaff(req, row.station_id);
    return row;
  };
  const rowById = (id) => db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  const rowByToken = (token) => db.prepare('SELECT * FROM orders WHERE token=?').get(token);

  const normalizeChoices = (line) => {
    const itemId = requiredString(line.itemId, 'itemId');
    if (!object(line.selections)) fail(400, 'INVALID_SELECTIONS', 'selections must be an object of option arrays.');
    const selections = {};
    for (const key of Object.keys(line.selections).sort()) {
      requiredString(key, 'Option group');
      const values = line.selections[key];
      if (!Array.isArray(values) || values.length > 50 || values.some((value) => typeof value !== 'string' || !value || value.length > 200)) fail(400, 'INVALID_SELECTIONS', 'Each option group must contain an array of option IDs.');
      if (values.length) Object.defineProperty(selections, key, { value: [...values].sort(), enumerable: true });
    }
    const exclusions = line.exclusions === undefined ? [] : line.exclusions;
    if (!Array.isArray(exclusions) || exclusions.length > 50 || exclusions.some((value) => typeof value !== 'string' || !value || value.length > 200)) fail(400, 'INVALID_EXCLUSIONS', 'exclusions must be an array of option IDs.');
    return { itemId, selections, exclusions: [...exclusions].sort() };
  };
  const normalizeOrder = (body, source) => {
    exactKeys(body, ORDER_FIELDS);
    const idempotencyKey = requiredString(body.idempotencyKey, 'idempotencyKey');
    const stationId = requiredString(body.stationId, 'stationId');
    const mode = timingMode(body.timingMode);
    if (mode === 'asap' && body.slotId !== undefined) fail(400, 'INVALID_TIMING_MODE', 'Right now orders must not specify a pickup window.');
    const slotId = mode === 'scheduled' ? requiredString(body.slotId, 'slotId') : undefined;
    if (!['regular', 'meal_exchange'].includes(body.paymentMode)) fail(400, 'INVALID_PAYMENT_MODE', 'Choose regular or meal_exchange demo ordering.');
    if (body.paymentAuthorized !== undefined && typeof body.paymentAuthorized !== 'boolean') fail(400, 'INVALID_INPUT', 'paymentAuthorized must be true or false.');
    const usesCart = body.items !== undefined;
    if (usesCart && (body.itemId !== undefined || body.selections !== undefined || body.exclusions !== undefined)) fail(400, 'INVALID_INPUT', 'Send either items or the legacy single item fields.');
    let payload;
    if (usesCart) {
      if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20) fail(400, 'INVALID_ITEMS', 'Add between 1 and 20 configured items to the cart.');
      const items = body.items.map((line) => {
        exactKeys(line, ORDER_ITEM_FIELDS);
        const quantity = line.quantity === undefined ? 1 : line.quantity;
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_UNITS) fail(400, 'INVALID_QUANTITY', 'Each item quantity must be between 1 and 6.');
        return { ...normalizeChoices(line), quantity };
      });
      const units = items.reduce((sum, line) => sum + line.quantity, 0);
      if (units > MAX_ORDER_UNITS) fail(400, 'ORDER_TOO_LARGE', 'A demo order can contain at most 6 items total.');
      payload = { stationId, items, slotId, paymentMode: body.paymentMode, paymentAuthorized: body.paymentAuthorized === true, source };
    } else {
      const { itemId, selections, exclusions } = normalizeChoices(body);
      // Preserve the exact legacy scheduled canonical shape; old browser retries remain valid.
      payload = { stationId, itemId, selections, exclusions, slotId, paymentMode: body.paymentMode, paymentAuthorized: body.paymentAuthorized === true, source };
    }
    if (mode === 'asap') { delete payload.slotId; payload.timingMode = 'asap'; }
    const canonical = payload.items ? JSON.stringify({ ...payload, items: [...payload.items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }) : JSON.stringify(payload);
    return { idempotencyKey, payload, canonical };
  };
  const createOrder = (body, source, actor, { simulated = false } = {}) => {
    if (simulated && actor.id !== 'queue-demo-fixture') throw new Error('Rush fixtures require the disabled internal account');
    const { idempotencyKey, payload, canonical } = normalizeOrder(body, source);
    const scopedKey = `${actor.id}:${idempotencyKey}`;
    if (source === 'walk_in' && !actor.stationIds.includes(payload.stationId)) fail(403, 'STATION_FORBIDDEN', 'This station is not assigned to your demo staff account.');
    return transact(() => {
      // Retry must return an accepted ticket even after its slot/menu becomes unavailable.
      const previous = db.prepare('SELECT * FROM orders WHERE idempotency_key=?').get(scopedKey);
      if (previous) {
        if (previous.canonical !== canonical) fail(409, 'IDEMPOTENCY_CONFLICT', 'This request key already belongs to a different order. Use a new key for changed choices.');
        return { replay: true, order: orderFromRow(previous) };
      }
      const station = stationById(payload.stationId);
      const mode = payload.timingMode || 'scheduled';
      if (mode === 'asap' && station.locationId !== 'cafeteria') fail(400, 'INVALID_TIMING_MODE', 'Right now ordering is available for cafeteria stations only.');
      if (station.paused && source === 'online') fail(409, 'STATION_PAUSED', 'This station is paused. Try another station or check back soon.');
      const isRetail = station.locationId !== 'cafeteria';
      const requestedItems = payload.items || [{ itemId: payload.itemId, selections: payload.selections, exclusions: payload.exclusions, quantity: 1 }];
      const unitCount = requestedItems.reduce((sum, line) => sum + line.quantity, 0);
      if (payload.paymentMode === 'meal_exchange' && unitCount !== 1) fail(400, 'EXCHANGE_CART_LIMIT', 'One fictional meal swipe covers exactly one eligible item in this demo. Use a regular order for multiple items.');
      const configuredItems = requestedItems.map((line, lineIndex) => {
        const item = itemById(line.itemId);
        if (item.stationId !== station.id) fail(400, 'STATION_ITEM_MISMATCH', 'Every cart item must belong to this station.');
        if (item.retired) fail(409, 'ITEM_RETIRED', 'This retired demo item no longer accepts new orders.');
        if (!item.available) fail(409, 'ITEM_UNAVAILABLE', 'This item is sold out in the demo menu.');
        if (payload.paymentMode === 'meal_exchange' && (!['hub', 'frothy', 'starbucks'].includes(station.id) || !item.exchangeEligible)) fail(400, 'EXCHANGE_NOT_ELIGIBLE', 'This item is not configured for a fictional meal exchange. Choose a regular demo order.');
        const knownGroups = new Set(item.groups.map((group) => group.id));
        const rawLine = payload.items ? body.items[lineIndex] : body;
        // Old single-item cafeteria clients still send a bun choice. The live
        // catalog has no bun screen, but retain and validate that legacy note.
        const legacyHamburger = !payload.items && item.id === 'build-your-hamburger';
        if (Object.keys(rawLine.selections).some((key) => !knownGroups.has(key) && !(legacyHamburger && key === 'hamburger-bun'))) fail(400, 'INVALID_SELECTIONS', 'An option group does not belong to this item.');
        const selected = new Set();
        const selectionSummary = item.groups.map((group) => {
          const values = line.selections[group.id] ?? [];
          if (new Set(values).size !== values.length) fail(400, 'DUPLICATE_OPTION', 'Choose each option only once.');
          const legacySandwichToast = !payload.items && item.id === 'build-your-sandwich' && group.id === 'sandwich-toast' && values.length === 0;
          if (!legacySandwichToast && (values.length < group.min || values.length > group.max)) fail(400, 'OPTION_COUNT', `${group.label}: choose ${group.min === group.max ? group.min : `${group.min}–${group.max}`} option(s).`);
          const labels = values.map((id) => {
            const choice = group.options.find((option) => option.id === id);
            if (!choice) fail(400, 'INVALID_OPTION', `An option does not belong to ${group.label}.`);
            if (!choice.available) fail(409, 'OPTION_UNAVAILABLE', `${choice.label} is currently sold out. Update your choices.`);
            selected.add(id);
            return choice.label;
          });
          return { group: group.id, label: group.label, kind: group.kind || 'customization', values: labels };
        });
        if (legacyHamburger && line.selections['hamburger-bun']) {
          const bunIds = line.selections['hamburger-bun'];
          if (new Set(bunIds).size !== bunIds.length) fail(400, 'DUPLICATE_OPTION', 'Choose each option only once.');
          if (bunIds.length !== 1) fail(400, 'OPTION_COUNT', 'Legacy bun choice requires one option.');
          const bunLabels = { 'burger-brioche': 'Brioche bun', 'burger-wheat': 'Wheat bun' };
          if (!bunLabels[bunIds[0]]) fail(400, 'INVALID_OPTION', 'That legacy bun option is not recognized.');
          selectionSummary.unshift({ group: 'hamburger-bun', label: 'Bun (legacy request)', kind: 'customization', values: [bunLabels[bunIds[0]]] });
        }
        const allOptions = new Map(item.groups.flatMap((group) => group.options.map((option) => [option.id, option.label])));
        if (new Set(line.exclusions).size !== line.exclusions.length) fail(400, 'INVALID_EXCLUSIONS', 'List each excluded option only once.');
        const exclusions = line.exclusions.map((id) => {
          if (!allOptions.has(id)) fail(400, 'INVALID_EXCLUSIONS', 'An excluded option does not belong to this item.');
          if (selected.has(id)) fail(400, 'CONFLICTING_OPTIONS', 'An option cannot be both selected and excluded.');
          return allOptions.get(id);
        });
        const unitPricing = payload.paymentMode === 'meal_exchange'
          ? { amountCents: null, currency: 'USD', status: 'meal_swipe', sourceUrl: null, note: 'One fictional demo meal swipe; not an institutional benefit.' }
          : !isRetail
            ? { amountCents: null, currency: 'USD', status: 'included', sourceUrl: null, note: 'Included in the fictional cafeteria meal; no separate demo price.' }
            : item.pricing || { amountCents: null, currency: 'USD', status: 'unverified', sourceUrl: null, note: 'A current menu price was not verified.' };
        return { itemId: item.id, itemName: item.name, quantity: line.quantity, selectionSummary, exclusions, unitPricing };
      });
      const firstItem = configuredItems[0];
      if (isRetail && source === 'online' && !payload.paymentAuthorized) fail(400, 'PAYMENT_AUTHORIZATION_REQUIRED', 'Authorize the assigned demo cashier to view your linked demo ID and simulate payment before ordering.');
      const createdAt = clock().toISOString();
      const orderTime = Date.parse(createdAt);
      const service = serviceAt(station, orderTime);
      if (station.locationId === 'cafeteria' ? !(mode === 'asap' ? service.canOrderNow : service.canSchedule) : !service.open) fail(409, 'SERVICE_CLOSED', mode === 'asap' ? 'No complete pickup window remains in the current service. Right now ordering does not promise immediate preparation.' : 'This menu is not accepting new scheduled orders today. Hamburger ordering begins at 11 AM.');
      const candidates = slotsFor(station, orderTime, mode);
      // Resolution belongs inside the capacity transaction, after canonical replay lookup.
      const slot = mode === 'asap' ? candidates.find((candidate) => candidate.totalRemaining >= unitCount && (source === 'walk_in' || candidate.remaining >= unitCount)) : candidates.find((candidate) => candidate.id === payload.slotId);
      if (!slot) fail(409, mode === 'asap' ? 'SLOT_FULL' : 'SLOT_UNAVAILABLE', mode === 'asap' ? 'No pickup window has capacity in this service. Choose another station or try later.' : 'That pickup window has passed or falls outside this menu service. Choose another window.');
      if (slot.totalRemaining < unitCount || (source === 'online' && slot.remaining < unitCount)) fail(409, 'SLOT_FULL', 'That pickup window is full or does not have capacity for every item in your cart. Choose another window or remove items.');
      const id = randomUUID();
      const token = randomBytes(32).toString('base64url');
      let pickupCode;
      do { pickupCode = String(randomInt(100000, 1000000)); } while (db.prepare('SELECT 1 FROM orders WHERE pickup_code=?').get(pickupCode));
      const postTotalRemaining = slot.totalRemaining - unitCount;
      const postRemaining = Math.max(0, Math.min(postTotalRemaining, slot.remaining - (source === 'online' ? unitCount : 0)));
      const reservedSlot = { ...slot, totalRemaining: postTotalRemaining, remaining: postRemaining, available: postRemaining > 0 };
      const payment = { status: isRetail ? simulated ? 'approved' : 'pending' : 'not_required', method: !isRetail ? 'cafeteria_entry' : source === 'walk_in' ? 'counter' : payload.paymentMode === 'meal_exchange' ? 'meal_exchange' : 'campus_account', ...(isRetail && source === 'online' ? { studentId: actor.studentId } : {}), authorized: !simulated && isRetail && source === 'online' && payload.paymentAuthorized, updatedAt: simulated && isRetail ? createdAt : null };
      const priceAmounts = configuredItems.map((line) => line.unitPricing.amountCents);
      const totalCents = priceAmounts.every((amount) => Number.isInteger(amount) && amount >= 0)
        ? configuredItems.reduce((sum, line) => sum + line.unitPricing.amountCents * line.quantity, 0) : null;
      const pricing = payload.paymentMode === 'meal_exchange'
        ? { amountCents: null, currency: 'USD', status: 'meal_swipe', sourceUrl: null, note: 'One fictional demo meal swipe; not an institutional benefit.' }
        : station.locationId === 'cafeteria'
          ? { amountCents: null, currency: 'USD', status: 'included', sourceUrl: null, note: 'Included in the fictional cafeteria meal; no separate demo price.' }
        : !payload.items ? firstItem.unitPricing
          : { amountCents: totalCents, currency: 'USD', status: totalCents === null ? 'unverified' : 'demo', sourceUrl: null, note: totalCents === null ? 'A current menu price was not verified.' : 'Illustrative total demo price; not an official campus price.' };
      const snapshot = { workflowVersion: 2, timingMode: mode, physicalStationId: station.physicalStationId, queueGroupId: station.queueGroupId, ...(simulated ? { simulated: true } : {}), ...(source === 'online' ? { studentId: actor.studentId } : {}), id, token, pickupCode, stationId: station.id, itemId: firstItem.itemId, itemName: firstItem.itemName, stationName: station.name, location: station.location, items: configuredItems, unitCount, selectionSummary: firstItem.selectionSummary, exclusions: firstItem.exclusions, pricing, slot: reservedSlot, status: 'received', paymentMode: payload.paymentMode, source, createdAt, updatedAt: createdAt, queueAhead: 0, events: [{ status: 'received', at: createdAt }] };
      db.prepare('INSERT INTO orders(id,token,pickup_code,idempotency_key,canonical,station_id,item_id,slot_id,source,status,snapshot,events,created_at,updated_at,owner_id,actor_id,payment,payment_events,unit_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, token, pickupCode, scopedKey, canonical, station.id, firstItem.itemId, slot.id, source, 'received', JSON.stringify(snapshot), JSON.stringify(snapshot.events), createdAt, createdAt, source === 'online' ? actor.id : null, actor.id, JSON.stringify(payment), JSON.stringify([{ status: payment.status, at: createdAt, ...(simulated ? { simulated: true } : {}) }]), unitCount);
      return { replay: false, order: orderFromRow(rowById(id)) };
    });
  };
  const transition = (row, status, expectedStatus, studentId) => {
    if (!row) fail(404, 'ORDER_NOT_FOUND', 'That demo ticket was not found.');
    const snapshot = JSON.parse(row.snapshot);
    const legacyPrepare = !snapshot.workflowVersion && row.status === 'received' && status === 'preparing';
    if (row.status !== expectedStatus || (!FORWARD[row.status]?.includes(status) && !legacyPrepare)) fail(409, 'STATUS_CONFLICT', 'The ticket changed or this transition is not allowed. Refresh the queue.');
    const payment = JSON.parse(row.payment);
    if (status === 'entered' && row.source === 'online' && payment.method !== 'cafeteria_entry' && snapshot.studentId) {
      if (typeof studentId !== 'string' || !studentId.trim()) fail(400, 'STUDENT_ID_REQUIRED', 'Enter the student ID before accepting this ticket.');
      if (studentId.trim() !== snapshot.studentId) fail(409, 'STUDENT_ID_MISMATCH', 'The student ID does not match this ticket.');
    } else if (studentId !== undefined) fail(400, 'INVALID_INPUT', 'studentId is only used when accepting an online retail ticket.');
    if (status === 'preparing' && !['not_required', 'approved'].includes(payment.status)) fail(409, 'PAYMENT_REQUIRED', 'The assigned cashier must approve the simulated retail payment before preparation.');
    if (status === 'cancelled' && payment.status === 'approved') fail(409, 'PAYMENT_ALREADY_APPROVED', 'Payment was already approved in the demo. Cancellation cannot simulate a refund.');
    const updatedAt = clock().toISOString();
    const events = [...JSON.parse(row.events), { status, at: updatedAt }];
    const changed = db.prepare('UPDATE orders SET status=?, updated_at=?, events=? WHERE id=? AND status=?').run(status, updatedAt, JSON.stringify(events), row.id, expectedStatus);
    if (changed.changes !== 1) fail(409, 'STATUS_CONFLICT', 'The ticket changed. Refresh the queue.');
    return orderFromRow(rowById(row.id));
  };

  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '32kb', strict: true }));
  const api = express.Router();
  api.use(auth.protectOrigin, auth.attach);
  auth.install(api);
  api.get('/health', (req, res) => res.json({ ok: true, demo: true }));
  api.get('/catalog', (req, res) => res.json({ stations: db.prepare('SELECT data FROM stations ORDER BY rowid').all().map((row) => stationView(JSON.parse(row.data))), items: db.prepare('SELECT data FROM items ORDER BY rowid').all().map((row) => JSON.parse(row.data)).filter((item) => !item.retired), locations, serviceClock: serviceClock(), demo: true }));
  api.get('/slots', (req, res) => { const station = stationById(requiredString(req.query.stationId, 'stationId')); const mode = timingMode(req.query.timingMode); if (mode === 'asap' && station.locationId !== 'cafeteria') fail(400, 'INVALID_TIMING_MODE', 'Right now ordering is available for cafeteria stations only.'); const time = clock().getTime(); res.json({ slots: slotsFor(station, time, mode), service: serviceAt(station, time), timingMode: mode }); });
  api.get('/my/orders', (req, res) => { const user = auth.requireStudent(req); res.json({ orders: db.prepare('SELECT * FROM orders WHERE owner_id=? ORDER BY seq DESC').all(user.id).map(orderFromRow) }); });
  api.post('/orders', (req, res) => { const user = auth.requireStudent(req); const result = createOrder(req.body, 'online', user); res.status(result.replay ? 200 : 201).json({ order: result.order }); });
  api.post('/staff/orders', (req, res) => { const user = auth.requireStaff(req); const result = createOrder(req.body, 'walk_in', user); res.status(result.replay ? 200 : 201).json({ order: result.order }); });
  api.get('/orders/:token', (req, res) => { const row = accessibleOrder(rowByToken(req.params.token), req); res.json({ order: forUser(row, req.user) }); });
  api.post('/orders/:token/cancel', (req, res) => {
    auth.requireStudent(req);
    if (req.body !== undefined) exactKeys(req.body, new Set());
    res.json({ order: transact(() => transition(accessibleOrder(rowByToken(req.params.token), req), 'cancelled', 'received')) });
  });
  api.get('/staff/orders', (req, res) => {
    const user = auth.requireStaff(req);
    const stationId = req.query.stationId === undefined ? undefined : requiredString(req.query.stationId, 'stationId');
    const currentDay = req.query.currentDay;
    if (currentDay !== undefined && currentDay !== 'true' && currentDay !== 'false') fail(400, 'INVALID_INPUT', 'currentDay must be true or false.');
    if (stationId) { auth.requireStaff(req, stationId); stationById(stationId); }
    const ids = stationId ? physicalIds(stationById(stationId)).filter((id) => user.stationIds.includes(id)) : user.stationIds;
    const rows = db.prepare(`SELECT * FROM orders WHERE station_id IN (${ids.map(() => '?').join(',')}) ORDER BY seq ASC`).all(...ids);
    const today = serviceDay(clock());
    res.json({ orders: rows.filter((row) => currentDay !== 'true' || serviceDay(JSON.parse(row.snapshot).slot.startsAt) === today).map((row) => withoutToken(orderFromRow(row))) });
  });
  api.post('/staff/orders/:id/accept', (req, res) => {
    auth.requireStaff(req);
    exactKeys(req.body, new Set(['expectedStatus']));
    if (!['received', 'entered'].includes(req.body.expectedStatus)) fail(400, 'INVALID_EXPECTED_STATUS', 'Accept requires expectedStatus received or entered.');
    const order = transact(() => {
      const row = accessibleOrder(rowById(req.params.id), req);
      if (row.status !== req.body.expectedStatus) fail(409, 'STATUS_CONFLICT', 'The ticket changed. Refresh the queue.');
      const snapshot = JSON.parse(row.snapshot);
      const payment = JSON.parse(row.payment);
      let nextPayment = payment;
      let paymentEvents = JSON.parse(row.payment_events);
      const retailOnline = row.source === 'online' && payment.method !== 'cafeteria_entry';
      if (retailOnline) {
        if (!snapshot.studentId || payment.studentId !== snapshot.studentId) fail(409, 'STUDENT_ID_MISMATCH', 'This ticket has no matching linked demo student ID.');
        if (payment.status === 'pending') {
          if (payment.authorized !== true) fail(409, 'PAYMENT_AUTHORIZATION_REQUIRED', 'This ticket has no demo payment authorization.');
          const at = clock().toISOString();
          nextPayment = { ...payment, status: 'approved', updatedAt: at };
          paymentEvents = [...paymentEvents, { status: 'approved', at, simulated: true }];
        } else if (payment.status !== 'approved') fail(409, 'PAYMENT_REQUIRED', 'A declined demo payment cannot be accepted.');
      } else if (!['not_required', 'approved'].includes(payment.status)) {
        fail(409, 'PAYMENT_REQUIRED', 'This ticket requires separate demo payment before preparation.');
      }
      const at = clock().toISOString();
      const events = [...JSON.parse(row.events), ...(row.status === 'received' ? [{ status: 'entered', at }] : []), { status: 'preparing', at }];
      const changed = db.prepare('UPDATE orders SET status=?, updated_at=?, events=?, payment=?, payment_events=? WHERE id=? AND status=? AND payment=?')
        .run('preparing', at, JSON.stringify(events), JSON.stringify(nextPayment), JSON.stringify(paymentEvents), row.id, req.body.expectedStatus, row.payment);
      if (changed.changes !== 1) fail(409, 'STATUS_CONFLICT', 'The ticket changed. Refresh the queue.');
      return withoutToken(orderFromRow(rowById(row.id)));
    });
    res.json({ order });
  });
  api.patch('/staff/orders/:id', (req, res) => {
    auth.requireStaff(req);
    exactKeys(req.body, new Set(['status', 'expectedStatus', 'studentId']));
    const status = requiredString(req.body.status, 'status');
    const expected = requiredString(req.body.expectedStatus, 'expectedStatus');
    res.json({ order: transact(() => withoutToken(transition(accessibleOrder(rowById(req.params.id), req), status, expected, req.body.studentId))) });
  });
  api.patch('/staff/orders/:id/payment', (req, res) => {
    auth.requireStaff(req);
    exactKeys(req.body, new Set(['status', 'expectedStatus']));
    if (!['approved', 'declined'].includes(req.body.status) || req.body.expectedStatus !== 'pending') fail(400, 'INVALID_PAYMENT_STATUS', 'Choose approved or declined with expectedStatus pending.');
    const order = transact(() => {
      const row = accessibleOrder(rowById(req.params.id), req);
      const payment = JSON.parse(row.payment);
      if (row.status !== 'entered' || payment.status !== 'pending' || payment.method === 'cafeteria_entry') fail(409, 'PAYMENT_CONFLICT', 'Accept the ticket before confirming payment, or refresh if it changed.');
      const updatedAt = clock().toISOString();
      const nextPayment = { ...payment, status: req.body.status, updatedAt };
      const events = [...JSON.parse(row.payment_events), { status: req.body.status, at: updatedAt }];
      const result = db.prepare('UPDATE orders SET payment=?,payment_events=?,updated_at=? WHERE id=? AND status=? AND payment=?').run(JSON.stringify(nextPayment), JSON.stringify(events), updatedAt, row.id, 'entered', row.payment);
      if (result.changes !== 1) fail(409, 'PAYMENT_CONFLICT', 'Payment changed. Refresh before simulating payment.');
      return withoutToken(orderFromRow(rowById(row.id)));
    });
    res.json({ order });
  });
  api.patch('/staff/stations/:id', (req, res) => {
    auth.requireStaff(req, req.params.id);
    exactKeys(req.body, new Set(['paused', 'capacity', 'onlineCapacity']));
    if (Object.keys(req.body).length === 0) fail(400, 'INVALID_INPUT', 'Choose at least one station setting to update.');
    const station = transact(() => {
      const station = { ...stationById(req.params.id), ...req.body };
      if (typeof station.paused !== 'boolean') fail(400, 'INVALID_INPUT', 'paused must be true or false.');
      if (![station.capacity, station.onlineCapacity].every((value) => Number.isSafeInteger(value) && value > 0 && value <= 10000) || station.onlineCapacity > station.capacity) fail(400, 'INVALID_CAPACITY', 'Capacities must be positive whole numbers up to 10,000; online capacity cannot exceed total capacity.');
      for (const id of physicalIds(station)) {
        auth.requireStaff(req, id);
        const shared = { ...stationById(id), capacity: station.capacity, onlineCapacity: station.onlineCapacity, paused: station.paused };
        db.prepare('UPDATE stations SET data=? WHERE id=?').run(JSON.stringify(shared), id);
      }
      return stationView(station);
    });
    res.json({ station });
  });
  api.patch('/staff/items/:id', (req, res) => {
    auth.requireStaff(req);
    exactKeys(req.body, new Set(['available'])); booleanField(req.body.available);
    const item = transact(() => { const item = { ...itemById(req.params.id), available: req.body.available }; auth.requireStaff(req, item.stationId); if (item.retired && req.body.available) fail(409, 'ITEM_RETIRED', 'This retired demo item cannot be reactivated.'); db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(item), item.id); return item; });
    res.json({ item });
  });
  api.patch('/staff/items/:id/groups/:groupId/options/:optionId', (req, res) => {
    auth.requireStaff(req);
    exactKeys(req.body, new Set(['available'])); booleanField(req.body.available);
    const item = transact(() => {
      const item = itemById(req.params.id);
      auth.requireStaff(req, item.stationId);
      const group = item.groups.find((candidate) => candidate.id === req.params.groupId);
      const option = group?.options.find((candidate) => candidate.id === req.params.optionId);
      if (!option) fail(404, 'OPTION_NOT_FOUND', 'That option does not belong to this demo item.');
      option.available = req.body.available;
      db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(item), item.id);
      return item;
    });
    res.json({ item });
  });
  api.post('/staff/demo-rush', (req, res) => {
    const manager = auth.requireStaff(req);
    if (manager.role !== 'manager') fail(403, 'MANAGER_REQUIRED', 'Only the demo manager can add a clearly labeled rush simulation.');
    exactKeys(req.body, new Set(['stationId', 'idempotencyKey']));
    const stationId = requiredString(req.body.stationId, 'stationId');
    const intentKey = requiredString(req.body.idempotencyKey, 'idempotencyKey');
    auth.requireStaff(req, stationId);
    const result = transact(() => {
      const previous = db.prepare('SELECT station_id,response FROM rush_intents WHERE actor_id=? AND intent_key=?').get(manager.id, intentKey);
      if (previous) {
        if (previous.station_id !== stationId) fail(409, 'IDEMPOTENCY_CONFLICT', 'This rush request key belongs to a different station.');
        return JSON.parse(previous.response);
      }
      const station = stationById(stationId);
      const orders = [];
      let reason = '';
      if (!serviceAt(station, clock().getTime()).open) reason = 'This location is closed in the selected service clock.';
      else if (station.paused) reason = 'Online ordering is paused for this station.';
      const slot = !reason ? slotsFor(station, clock().getTime()).find((candidate) => candidate.available) : null;
      if (!reason && !slot) reason = 'No pickup window has online space before the service closes.';
      const items = db.prepare('SELECT data FROM items WHERE station_id=? ORDER BY rowid').all(stationId).map((row) => JSON.parse(row.data));
      const item = items.find((candidate) => candidate.available && !candidate.retired && candidate.groups.every((group) => group.options.filter((option) => option.available).length >= group.min));
      if (!reason && !item) reason = 'No available item has all its required choices in stock.';
      if (!reason) {
        const selections = Object.fromEntries(item.groups.filter((group) => group.min > 0).map((group) => [group.id, group.options.filter((option) => option.available).slice(0, group.min).map((option) => option.id)]));
        const fixture = JSON.parse(db.prepare('SELECT data FROM users WHERE id=?').get('queue-demo-fixture').data);
        const batchKey = createHash('sha256').update(`${manager.id}:${intentKey}`).digest('hex');
        for (let i = 0; i < 3; i++) {
          try {
            const result = createOrder({ idempotencyKey: `rush-${batchKey}-${i}`, stationId, itemId: item.id, selections, exclusions: [], slotId: slot.id, paymentMode: 'regular', paymentAuthorized: station.locationId !== 'cafeteria' }, 'online', fixture, { simulated: true });
            orders.push(withoutToken(result.order));
          } catch (error) {
            if (!(error instanceof ApiError) || !['SLOT_FULL', 'SLOT_UNAVAILABLE', 'SERVICE_CLOSED', 'STATION_PAUSED', 'ITEM_UNAVAILABLE', 'OPTION_UNAVAILABLE'].includes(error.code)) throw error;
            reason = error.message;
            break;
          }
        }
      }
      const message = orders.length ? `${orders.length} labeled rush-simulation ticket${orders.length === 1 ? '' : 's'} added to ${station.name}. No real student account or payment was used.${reason ? ` ${reason}` : ''}` : `No rush tickets created. ${reason}`;
      const response = { created: orders.length, orders, message };
      db.prepare('INSERT INTO rush_intents(actor_id,intent_key,station_id,response,created_at) VALUES (?,?,?,?,?)').run(manager.id, intentKey, stationId, JSON.stringify(response), clock().toISOString());
      return response;
    });
    res.json(result);
  });
  api.patch('/staff/demo-clock', (req, res) => {
    const user = auth.requireStaff(req);
    if (user.role !== 'manager') fail(403, 'MANAGER_REQUIRED', 'Only the demo manager can change the shared service clock.');
    exactKeys(req.body, new Set(['mode']));
    const presets = { breakfast: '2026-09-28T13:30:00.000Z', transition: '2026-09-28T16:00:00.000Z', lunch: '2026-09-28T17:00:00.000Z', near_close: '2026-09-28T20:45:00.000Z', closed: '2026-09-29T04:00:00.000Z' };
    if (req.body.mode !== 'live' && !Object.hasOwn(presets, req.body.mode)) fail(400, 'INVALID_CLOCK_MODE', 'Choose live, breakfast, transition, lunch, near_close, or closed.');
    clockMode = req.body.mode;
    if (clockMode !== 'live') { presetTime = Date.parse(presets[clockMode]); presetStarted = realNow(); }
    clockState?.write({ mode: clockMode, presetTime, presetStarted });
    res.json({ serviceClock: serviceClock() });
  });
  api.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That demo API endpoint does not exist.' } }));
  app.use('/api', api);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ApiError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request must contain valid JSON.' } });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'The demo order request is too large.' } });
    if (String(error.message).includes('database is locked')) return res.status(503).json({ error: { code: 'TEMPORARILY_BUSY', message: 'The demo database is busy. Retry with the same request key.' } });
    console.error('Demo API error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The demo request could not be completed. Retry with the same request key.' } });
  });
  return app;
}
