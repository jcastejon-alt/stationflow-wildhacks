import { DurableObject } from 'cloudflare:workers';
import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { createApiApp } from '../server/api-core.js';
import { durableDatabase } from './sqlite-adapter.js';

const jsonError = (status, code, message) => new Response(JSON.stringify({ error: { code, message } }), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export class StationDatabase extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const { db, transact, clockState } = durableDatabase(ctx.storage);
    const app = createApiApp({ db, transact, clockState, publicOrigin: env.PUBLIC_ORIGIN, originCheckedAtEdge: true });
    this.handler = httpServerHandler(createServer(app));
  }

  fetch(request) {
    return this.handler.fetch(request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
        return jsonError(403, 'HTTPS_REQUIRED', 'Use HTTPS for this demo.');
      }
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
        const origin = request.headers.get('Origin');
        if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== url.origin) || (env.PUBLIC_ORIGIN && origin !== env.PUBLIC_ORIGIN)) {
          return jsonError(403, 'ORIGIN_FORBIDDEN', 'Cross-origin writes are not allowed.');
        }
      }
      const id = env.STATION_DB.idFromName('stationflow-v1');
      const headers = new Headers(request.headers);
      // The Node HTTP bridge exposes the internal scheme. Convey the scheme
      // validated here so the API can set Secure on HTTPS session cookies.
      headers.set('X-Stationflow-Proto', url.protocol);
      return env.STATION_DB.get(id).fetch(new Request(request, { headers }));
    }
    return env.ASSETS.fetch(request);
  },
};
