// rest-hono — HTTP/1.1 request/response on Lambda Web Functions, using Hono.
//
// Demonstrates the baseline protocol: plain REST over HTTP/1.1. Hono runs on the
// Node HTTP server via @hono/node-server, listening on the platform-required port 3000.
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');

const app = new Hono();

app.get('/', (c) =>
  c.json({
    service: 'rest-hono',
    protocol: 'HTTP/1.1 REST',
    framework: 'hono',
    routes: ['GET /', 'GET /health', 'GET /items/:id', 'POST /echo'],
    timestamp: new Date().toISOString()
  })
);

// Namespaced health check — do NOT use /ping (reserved by the platform).
app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/items/:id', (c) =>
  c.json({ id: c.req.param('id'), name: `item-${c.req.param('id')}`, protocol: 'rest' })
);

app.post('/echo', async (c) => {
  let body = null;
  try {
    body = await c.req.json();
  } catch (_) {
    body = await c.req.text();
  }
  return c.json({ youSent: body, method: 'POST', at: new Date().toISOString() });
});

app.notFound((c) => c.json({ error: 'Not Found', path: new URL(c.req.url).pathname }, 404));

serve({ fetch: app.fetch, port: 3000 }, (info) =>
  console.log(`rest-hono listening on ${info.port}`)
);
