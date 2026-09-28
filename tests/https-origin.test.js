import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { validatePublicOrigin } from '../server/auth.js';

const configuredOrigin = 'https://stationflow-demo.example';
async function serverFixture(t, options = {}) {
  const app = createApp({ dbPath: ':memory:', ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
    app.locals.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, headers = {}) => {
    const response = await fetch(`${base}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  return { app, base, request, login: (headers) => request('/auth/login', { identifier: 'D10001', password: 'CampusDemo!26' }, headers) };
}

test('PUBLIC_ORIGIN requires one canonical HTTPS origin and fails before any database directory is created', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stationflow-public-origin-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'must-not-exist', 'test.sqlite');
  const invalid = [null, '', ' ', 'not a URL', 'http://demo.example.com', 'https://demo.example.com/', 'https://demo.example.com/path', 'https://demo.example.com?query=1', 'https://demo.example.com#fragment', 'https://user:password@demo.example.com', 'https://*.example.com', '*', 'https://demo.example.com https://evil.example', 'https://demo.example.com:443', 'HTTPS://demo.example.com', ['https://demo.example.com']];
  for (const publicOrigin of invalid) assert.throws(() => createApp({ dbPath, publicOrigin }), /PUBLIC_ORIGIN must be one exact HTTPS origin/);
  assert.equal(existsSync(join(dir, 'must-not-exist')), false);
  assert.equal(validatePublicOrigin(configuredOrigin), configuredOrigin);
  assert.equal(validatePublicOrigin('https://demo.example.com:8443'), 'https://demo.example.com:8443');
  assert.equal(validatePublicOrigin(undefined), undefined);
});

test('configured HTTPS origin works behind loopback HTTP and issues Secure HttpOnly session cookies without trusting proxies', async (t) => {
  const f = await serverFixture(t, { publicOrigin: configuredOrigin });
  assert.equal(f.app.get('trust proxy'), false);
  const login = await f.login({ Origin: configuredOrigin });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /; Secure(?:;|$)/);
  assert.match(setCookie, /; HttpOnly(?:;|$)/);
  assert.match(setCookie, /; SameSite=Strict(?:;|$)/);
  const cookie = setCookie.split(';')[0];
  const logout = await f.request('/auth/logout', {}, { Origin: configuredOrigin, Cookie: cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /; Secure(?:;|$)/);
  const current = await fetch(`${f.base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal((await current.json()).user, null);
});

test('configured public origin rejects every other write origin, absent origins, and forwarded-header spoofing', async (t) => {
  const f = await serverFixture(t, { publicOrigin: configuredOrigin });
  for (const headers of [
    {},
    { Origin: 'null' },
    { Origin: 'https://evil.example' },
    { Origin: `${configuredOrigin}/path` },
    { Origin: 'http://127.0.0.1:5173' },
    { Origin: 'http://localhost:5173' },
    { Origin: f.base },
    { Origin: configuredOrigin, 'Sec-Fetch-Site': 'cross-site' },
    { Origin: 'https://evil.example', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'stationflow-demo.example', 'X-Forwarded-For': '127.0.0.1' },
    { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'stationflow-demo.example', Forwarded: 'proto=https;host=stationflow-demo.example' },
  ]) {
    const result = await f.login(headers);
    assert.equal(result.status, 403, JSON.stringify(headers));
    assert.equal(result.body.error.code, 'ORIGIN_FORBIDDEN');
    assert.equal(result.headers.get('set-cookie'), null);
  }
  // Untrusted forwarding fields cannot replace the configured value in either direction.
  const valid = await f.login({ Origin: configuredOrigin, 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'evil.example' });
  assert.equal(valid.status, 200);
  assert.match(valid.headers.get('set-cookie'), /; Secure(?:;|$)/);
});

test('default local mode preserves local login and cannot be made secure or cross-origin by forwarded headers', async (t) => {
  const f = await serverFixture(t);
  const login = await f.login({ Origin: 'http://127.0.0.1:5173', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'evil.example' });
  assert.equal(login.status, 200);
  assert.doesNotMatch(login.headers.get('set-cookie'), /; Secure(?:;|$)/);
  const spoof = await f.login({ Origin: 'https://evil.example', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'evil.example' });
  assert.equal(spoof.status, 403);
  assert.equal((await f.login({})).status, 200);
});
