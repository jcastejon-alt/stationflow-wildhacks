import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { getPrivateLanAddresses, startLanDemo } from '../server/lan-demo.js';

const address = (ip, extra = {}) => ({ address: ip, family: 'IPv4', internal: false, ...extra });

test('LAN addresses list only assigned private IPv4 interfaces without duplicates', () => {
  const result = getPrivateLanAddresses({
    lo0: [address('127.0.0.1', { internal: true })],
    en0: [address('192.168.1.10'), address('fe80::1', { family: 'IPv6' })],
    en1: [address('10.3.4.5', { family: 4 }), address('172.16.0.3'), address('172.31.255.8')],
    duplicate: [address('192.168.1.10')],
    public: [address('8.8.8.8'), address('172.15.0.1'), address('172.32.0.1'), address('169.254.1.2'), address('192.168.1.999')],
    absent: undefined,
  });
  assert.deepEqual(result, [{ name: 'en0', address: '192.168.1.10' }, { name: 'en1', address: '10.3.4.5' }, { name: 'en1', address: '172.16.0.3' }, { name: 'en1', address: '172.31.255.8' }]);
});

test('LAN launcher refuses a missing build without creating its database or opening a server', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stationflow-lan-guard-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'lan.sqlite');
  await assert.rejects(startLanDemo({ host: '127.0.0.1', port: 0, staticDir: join(dir, 'missing'), dbPath, interfaces: {}, log: () => {} }), /npm run build/);
  assert.equal(existsSync(dbPath), false);
});

test('LAN helper serves built routes and same-origin authenticated API on one ephemeral loopback port', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stationflow-lan-local-'));
  const dist = join(dir, 'dist');
  await mkdir(dist);
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Local demo fixture</title>');
  const logs = [];
  // Deliberately bind only loopback in this test; do not expose a persistent LAN service.
  const demo = await startLanDemo({ host: '127.0.0.1', port: 0, staticDir: dist, dbPath: join(dir, 'lan.sqlite'), cafeteriaHours: { opensAt: '07:00', closesAt: '18:00' }, interfaces: { en0: [address('192.168.1.10')] }, log: (line) => logs.push(line) });
  t.after(async () => { await demo.close(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${demo.server.address().port}`;
  const page = await fetch(`${base}/kitchen`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Local demo fixture/);
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, demo: true });
  const catalog = await (await fetch(`${base}/api/catalog`)).json();
  assert.match(catalog.locations.find((location) => location.id === 'cafeteria').hoursLabel, /7:00 AM–6:00 PM/);
  const lanOrigin = `http://192.168.1.10:${demo.server.address().port}`;
  // node:http preserves a custom Host; fetch may replace it with the loopback URL host.
  const login = await new Promise((resolveResponse, reject) => {
    const request = httpRequest(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Host: new URL(lanOrigin).host, Origin: lanOrigin } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolveResponse({ status: response.statusCode, headers: response.headers, body: JSON.parse(body) }));
    });
    request.on('error', reject);
    request.end(JSON.stringify({ identifier: 'D10001', password: 'CampusDemo!26' }));
  });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const current = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal((await current.json()).user.studentId, '10001');
  assert.equal(demo.urls.lan[0].url, lanOrigin);
  assert.ok(logs.some((line) => line.includes('Separate LAN demo database')));
  assert.ok(logs.some((line) => line.includes('no cloud publication')));
});
