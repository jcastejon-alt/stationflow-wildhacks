import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

// Report only RFC 1918 IPv4 addresses already assigned to this computer.
// This does not scan the network, configure a router, or open a tunnel.
export function getPrivateLanAddresses(interfaces = networkInterfaces()) {
  const seen = new Set();
  const result = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const entry of addresses || []) {
      if (entry.internal || !['IPv4', 4].includes(entry.family)) continue;
      const octets = entry.address.split('.');
      if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) continue;
      const [a, b] = octets.map(Number);
      if (!(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))) continue;
      if (seen.has(entry.address)) continue;
      seen.add(entry.address);
      result.push({ name, address: entry.address });
    }
  }
  return result;
}

export async function startLanDemo({
  host = '0.0.0.0',
  port = 3002,
  dbPath = resolve('data/stationflow-lan.sqlite'),
  staticDir = resolve('dist'),
  cafeteriaHours,
  interfaces = networkInterfaces(),
  log = console.log,
} = {}) {
  if (!existsSync(resolve(staticDir, 'index.html'))) throw new Error('The built demo is missing. Run npm run build, then run npm run demo:lan. No server was started.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('The LAN demo port must be a whole number from 1 to 65535.');
  const app = createApp({ dbPath, staticDir, cafeteriaHours });
  const server = app.listen(port, host);
  try {
    await new Promise((resolveReady, reject) => {
      server.once('listening', resolveReady);
      server.once('error', reject);
    });
  } catch (error) {
    app.locals.close();
    throw error;
  }
  const actualPort = server.address().port;
  const addresses = getPrivateLanAddresses(interfaces);
  const urls = { localhost: `http://localhost:${actualPort}`, lan: addresses.map(({ name, address }) => ({ interface: name, url: `http://${address}:${actualPort}` })) };
  log('StationFlow local Wi-Fi demo — no cloud publication or tunnel.');
  log(`On this computer: ${urls.localhost}`);
  for (const entry of urls.lan) log(`On the same Wi-Fi (${entry.interface}): ${entry.url}`);
  if (!urls.lan.length) log('No private IPv4 address was found. Connect this computer and your devices to the same Wi-Fi, then restart this launcher. Localhost remains available.');
  if (urls.lan.length > 1) log('More than one private address is available. Use the interface connected to the same Wi-Fi as the phone and iPad.');
  log(`Separate LAN demo database: ${resolve(dbPath)}`);
  log('Public demo accounts only. No real campus IDs, Sodexo orders, or payments. The service is reachable by devices on this local network.');
  log('Keep this terminal open during the demo; press Ctrl+C when finished.');
  let closing;
  const close = () => {
    if (!closing) closing = new Promise((resolveClosed, reject) => {
      server.close((error) => {
        try { app.locals.close(); } catch (closeError) { reject(closeError); return; }
        if (error) reject(error); else resolveClosed();
      });
      server.closeIdleConnections();
    });
    return closing;
  };
  return { app, server, urls, close };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be a whole number from 1 to 65535.');
    process.exitCode = 1;
  } else {
    try {
      const demo = await startLanDemo({ host: process.env.HOST || '0.0.0.0', port, dbPath: process.env.DB_PATH || resolve('data/stationflow-lan.sqlite'), cafeteriaHours: { opensAt: process.env.CAFETERIA_OPENS_AT, closesAt: process.env.CAFETERIA_CLOSES_AT } });
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void demo.close().then(() => { process.exitCode = 0; }, (error) => { console.error(error.message); process.exitCode = 1; }); });
    } catch (error) {
      console.error(`LAN demo could not start: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
