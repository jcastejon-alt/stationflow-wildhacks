import { createApp } from './app.js';
import { resolve } from 'node:path';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const app = createApp({ dbPath: process.env.DB_PATH || resolve('data/stationflow.sqlite'), publicOrigin: process.env.PUBLIC_ORIGIN, cafeteriaHours: { opensAt: process.env.CAFETERIA_OPENS_AT, closesAt: process.env.CAFETERIA_CLOSES_AT } });
const server = app.listen(port, host, () => {
  console.log(`StationFlow demo API listening on http://${host}:${port}`);
  if (process.env.PUBLIC_ORIGIN) console.log(`Configured HTTPS demo origin: ${process.env.PUBLIC_ORIGIN}. Secure cookies enabled; forwarded headers are not trusted.`);
  console.log('Independent prototype · Demo orders only. Public demo credentials only; assigned staff access is enforced locally. No campus authentication or real payments.');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => { app.locals.close(); process.exit(0); });
    server.closeIdleConnections();
  });
}
