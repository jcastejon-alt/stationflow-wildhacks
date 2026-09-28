import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
const SESSION_HOURS = 8;
const COOKIE = 'sf_session';
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const hashPassword = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
const passwordMatches = (password, stored) => { const [salt, hash] = stored.split(':'); return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 32)); };
const allStations = ['omelet', 'hamburger', 'sandwich', 'hub', 'frothy', 'starbucks'];
const demoUsers = [
  { id: 'student-demo-1', identifier: '10001', displayName: 'Student 10001', role: 'student', studentId: '10001', stationIds: [] },
  { id: 'student-demo-2', identifier: '10002', displayName: 'Student 10002', role: 'student', studentId: '10002', stationIds: [] },
  { id: 'staff-cafeteria', identifier: 'cafeteria', displayName: 'Cafeteria Team', role: 'staff', stationIds: ['omelet', 'hamburger', 'sandwich'] },
  { id: 'staff-grill', identifier: 'grill', displayName: 'Cafeteria Grill', role: 'staff', stationIds: ['omelet', 'hamburger'] },
  { id: 'staff-sandwich', identifier: 'sandwich', displayName: 'Sandwich Station', role: 'staff', stationIds: ['sandwich'] },
  { id: 'staff-hub', identifier: 'hub', displayName: 'Hub Team', role: 'staff', stationIds: ['hub'] },
  { id: 'staff-frothy', identifier: 'frothy', displayName: 'Frothy Monkey Team', role: 'staff', stationIds: ['frothy'] },
  { id: 'staff-starbucks', identifier: 'starbucks', displayName: 'We Proudly Serve Starbucks Team', role: 'staff', stationIds: ['starbucks'] },
  { id: 'staff-coffee', identifier: 'coffee', displayName: 'Coffee Team', role: 'staff', stationIds: ['frothy', 'starbucks'] },
  { id: 'queue-demo-fixture', identifier: 'QUEUE-DEMO', displayName: 'Rush simulation', role: 'student', studentId: 'QUEUE-DEMO', stationIds: [], disabledLogin: true },
  { id: 'manager-demo', identifier: 'manager', displayName: 'Demo Manager', role: 'manager', stationIds: allStations },
];

const studentAccounts = new Map([['10001', 'student-demo-1'], ['10002', 'student-demo-2']]);
const normalizeIdentifier = (value) => {
  const identifier = value.trim().toLowerCase();
  return identifier === 'd10001' || identifier === 'd10002' ? identifier.slice(1) : identifier;
};

// A configured public origin is explicit deployment configuration, never a forwarded header.
export function validatePublicOrigin(value) {
  if (value === undefined) return undefined;
  const invalid = () => { throw new Error('PUBLIC_ORIGIN must be one exact HTTPS origin, for example https://demo.example.com, without a trailing slash, path, query, credentials, or wildcard.'); };
  if (typeof value !== 'string' || !value || value.includes('*')) return invalid();
  let parsed;
  try { parsed = new URL(value); } catch { return invalid(); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || parsed.origin !== value) return invalid();
  return parsed.origin;
}

export function createAuth({ db, fail, requiredString, exactKeys, realNow, allowedOrigins, publicOrigin }) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, identifier TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const { identifier, ...user } of demoUsers) {
      const existing = db.prepare('SELECT identifier,data FROM users WHERE id=?').get(user.id);
      if (!existing) db.prepare('INSERT INTO users(id,identifier,password_hash,data) VALUES (?,?,?,?)').run(user.id, identifier.toLowerCase(), hashPassword(user.disabledLogin ? randomBytes(32).toString('hex') : 'CampusDemo!26'), JSON.stringify(user));
      else if (studentAccounts.get(identifier) === user.id) {
        // Keep stable account IDs, password hashes, sessions, order ownership, and accepted snapshots.
        // Only the two known fictional student profiles change their displayed ID to the numeric form.
        const profile = { ...JSON.parse(existing.data), id: user.id, role: 'student', studentId: identifier, displayName: `Student ${identifier}`, stationIds: [] };
        db.prepare('UPDATE users SET identifier=?,data=? WHERE id=?').run(identifier, JSON.stringify(profile), user.id);
      } else if (['staff-cafeteria', 'manager-demo'].includes(user.id)) {
        // Known demo staff keep stable IDs, passwords and sessions while their assigned grill gains its lunch menu.
        const profile = { ...JSON.parse(existing.data), ...user };
        db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(profile), user.id);
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const dummyPassword = db.prepare('SELECT password_hash FROM users LIMIT 1').get().password_hash;
  const attempts = new Map();
  const cookieToken = (req) => {
    const value = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  };
  const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'strict', secure: Boolean(publicOrigin) || req.secure, path: '/', maxAge: SESSION_HOURS * 3600000 });
  const requireUser = (req) => { if (!req.user) fail(401, 'AUTH_REQUIRED', 'Sign in to your demo account to continue.'); return req.user; };
  const requireStudent = (req) => { const user = requireUser(req); if (user.role !== 'student') fail(403, 'STUDENT_REQUIRED', 'Use a demo student account for student ordering.'); return user; };
  const requireStaff = (req, stationId) => {
    const user = requireUser(req);
    if (!['staff', 'manager'].includes(user.role)) fail(403, 'STAFF_REQUIRED', 'This action requires an assigned demo staff account.');
    if (stationId && !user.stationIds.includes(stationId)) fail(403, 'STATION_FORBIDDEN', 'This station is not assigned to your demo staff account.');
    return user;
  };
  const attach = (req, res, next) => {
    req.user = null;
    const token = cookieToken(req);
    if (token) {
      const session = db.prepare('SELECT users.data FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(hashToken(token), realNow());
      if (session) { const user = JSON.parse(session.data); if (!user.disabledLogin) req.user = user; }
    }
    next();
  };
  const protectOrigin = (req, res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin;
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'ORIGIN_FORBIDDEN', 'Cross-origin writes are not allowed.');
      if (publicOrigin) {
        if (origin !== publicOrigin) fail(403, 'ORIGIN_FORBIDDEN', 'Writes must come from the configured HTTPS demo origin.');
      } else if (origin) {
        let trusted = false;
        try { const parsed = new URL(origin); trusted = parsed.origin === `${req.protocol}://${req.get('host')}` || allowedOrigins.includes(parsed.origin); } catch {}
        if (!trusted) fail(403, 'ORIGIN_FORBIDDEN', 'Cross-origin writes are not allowed.');
      }
    }
    next();
  };
  const checkAttempts = (req, res) => {
    const key = req.ip || 'local';
    const current = attempts.get(key);
    if (current && current.until <= realNow()) attempts.delete(key);
    if (attempts.get(key)?.count >= 8) {
      res.set('Retry-After', String(Math.ceil((attempts.get(key).until - realNow()) / 1000)));
      fail(429, 'LOGIN_THROTTLED', 'Too many sign-in attempts. Try again in 15 minutes.');
    }
    return key;
  };
  const failedAttempt = (key) => {
    const prior = attempts.get(key) || { count: 0, until: realNow() + 900000 };
    attempts.set(key, { count: prior.count + 1, until: prior.until });
  };
  const startSession = (req, res, row, metadata = {}) => {
    const oldToken = cookieToken(req);
    const token = randomBytes(32).toString('base64url');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (oldToken) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(oldToken));
      db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(realNow());
      db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(hashToken(token), row.id, realNow() + SESSION_HOURS * 3600000);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    attempts.delete(req.ip || 'local');
    res.cookie(COOKIE, token, cookieOptions(req));
    res.json({ user: JSON.parse(row.data), ...metadata });
  };
  const install = (api) => {
    api.get('/auth/me', (req, res) => res.json({ user: req.user }));
    api.post('/auth/student', (req, res) => {
      exactKeys(req.body, new Set(['studentId']));
      const identifier = normalizeIdentifier(requiredString(req.body.studentId, 'studentId', 80));
      const key = checkAttempts(req, res);
      const accountId = studentAccounts.get(identifier);
      const row = accountId ? db.prepare('SELECT * FROM users WHERE id=? AND identifier=?').get(accountId, identifier) : undefined;
      const profile = row ? JSON.parse(row.data) : undefined;
      if (!row || profile.role !== 'student' || profile.disabledLogin) {
        failedAttempt(key);
        fail(401, 'INVALID_DEMO_STUDENT', 'Choose fictional demo student ID 10001 or 10002. Real campus IDs are not supported.');
      }
      startSession(req, res, row, { demo: true, authMode: 'demo_student_id', notice: "Fictional public demo profiles only. Selecting an ID does not verify anyone's identity." });
    });
    api.post('/auth/login', (req, res) => {
      exactKeys(req.body, new Set(['identifier', 'password']));
      const identifier = normalizeIdentifier(requiredString(req.body.identifier, 'identifier', 80));
      const password = requiredString(req.body.password, 'password', 200);
      const key = checkAttempts(req, res);
      const row = db.prepare('SELECT * FROM users WHERE identifier=?').get(identifier);
      const matched = passwordMatches(password, row?.password_hash || dummyPassword);
      if (!row || !matched || JSON.parse(row.data).disabledLogin) {
        failedAttempt(key);
        fail(401, 'INVALID_CREDENTIALS', 'The demo ID or password is incorrect.');
      }
      startSession(req, res, row);
    });
    api.post('/auth/logout', (req, res) => {
      if (req.body !== undefined) exactKeys(req.body, new Set());
      const token = cookieToken(req);
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
      res.clearCookie(COOKIE, { ...cookieOptions(req), maxAge: undefined });
      res.json({ ok: true });
    });
  };
  return { attach, protectOrigin, install, requireUser, requireStudent, requireStaff };
}
