// sse-hono — Server-Sent Events on Lambda Web Functions, using Hono.
//
// Demonstrates one-way server push over HTTP/1.1. The Web Functions edge preserves
// text/event-stream and flushes chunks incrementally. streamSSE handles
// the event framing; we disable proxy buffering with X-Accel-Buffering: no.
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { streamSSE } = require('hono/streaming');

const app = new Hono();

app.get('/', (c) =>
  c.json({
    service: 'sse-hono',
    protocol: 'Server-Sent Events (text/event-stream)',
    framework: 'hono',
    try: 'curl -N https://<domain>/events?n=10',
    timestamp: new Date().toISOString()
  })
);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Emit `n` events (default 10), one every `delay` ms (default 500).
app.get('/events', (c) => {
  const n = Math.min(Number(c.req.query('n')) || 10, 100);
  const delay = Math.min(Number(c.req.query('delay')) || 500, 5000);

  c.header('Cache-Control', 'no-cache');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    const start = Date.now();
    for (let i = 1; i <= n; i++) {
      await stream.writeSSE({
        id: String(i),
        event: 'tick',
        data: JSON.stringify({ i, elapsedMs: Date.now() - start })
      });
      await stream.sleep(delay);
    }
    await stream.writeSSE({ event: 'done', data: 'complete' });
  });
});

app.notFound((c) => c.json({ error: 'Not Found', path: new URL(c.req.url).pathname }, 404));

serve({ fetch: app.fetch, port: 3000 }, (info) =>
  console.log(`sse-hono listening on ${info.port}`)
);
