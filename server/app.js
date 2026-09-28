import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApiApp } from './api-core.js';
import { validatePublicOrigin } from './auth.js';

export function createApp({ dbPath = resolve('data/stationflow.sqlite'), staticDir = resolve('dist'), ...options } = {}) {
  validatePublicOrigin(options.publicOrigin);
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  let transactionDepth = 0;
  const transact = (work) => {
    if (transactionDepth) return work();
    db.exec('BEGIN IMMEDIATE');
    transactionDepth++;
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    finally { transactionDepth--; }
  };
  const app = createApiApp({ ...options, db, transact });
  if (existsSync(resolve(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false }));
    app.use((req, res, next) => req.method === 'GET' && !req.path.includes('.') ? res.sendFile(resolve(staticDir, 'index.html')) : next());
  }
  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found. Start the Vite dev server for the demo interface.' } }));
  app.locals.close = () => db.close();
  return app;
}
