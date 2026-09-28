// Adapter for the synchronous subset of node:sqlite used by the shared API.
// A Durable Object owns this SQL connection and serializes all API operations.
export function durableDatabase(storage) {
  const sql = storage.sql;
  const db = {
    exec(statement) {
      // Durable Object SQLite manages these internally; user_version is unsupported.
      if (/^\s*PRAGMA\s+user_version\s*=/i.test(statement)) return;
      return sql.exec(statement);
    },
    prepare(statement) {
      return {
        get(...bindings) { return sql.exec(statement, ...bindings).next().value; },
        all(...bindings) { return sql.exec(statement, ...bindings).toArray(); },
        run(...bindings) {
          sql.exec(statement, ...bindings);
          return { changes: sql.exec('SELECT changes() AS changes').one().changes };
        },
      };
    },
  };
  let depth = 0;
  const transact = (work) => {
    if (depth) return work();
    return storage.transactionSync(() => {
      depth++;
      try { return work(); } finally { depth--; }
    });
  };
  db.exec('CREATE TABLE IF NOT EXISTS demo_clock (key TEXT PRIMARY KEY, data TEXT NOT NULL)');
  const clockState = {
    read() { const row = db.prepare("SELECT data FROM demo_clock WHERE key='shared'").get(); return row ? JSON.parse(row.data) : undefined; },
    write(data) { db.prepare("INSERT INTO demo_clock(key,data) VALUES ('shared',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data").run(JSON.stringify(data)); },
  };
  return { db, transact, clockState };
}
