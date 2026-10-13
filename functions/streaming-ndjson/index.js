// streaming-ndjson — chunked incremental delivery on Lambda Web Functions, using Hono.
//
// Demonstrates raw chunked HTTP streaming (Transfer-Encoding: chunked) with two common
// payload shapes: newline-delimited JSON (NDJSON) and plain text. The edge flushes each
// write to the client as it happens — useful for LLM token streaming, log
// tailing, and progress feeds.
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { stream } = require('hono/streaming');

const app = new Hono();

app.get('/', (c) =>
  c.json({
    service: 'streaming-ndjson',
    protocol: 'chunked HTTP streaming (NDJSON / text)',
    framework: 'hono',
    routes: ['GET /ndjson?n=10&delay=400', 'GET /text?n=10&delay=400'],
    timestamp: new Date().toISOString()
  })
);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Newline-delimited JSON, one object per line, flushed incrementally.
app.get('/ndjson', (c) => {
  const n = Math.min(Number(c.req.query('n')) || 10, 100);
  const delay = Math.min(Number(c.req.query('delay')) || 400, 5000);
  c.header('Content-Type', 'application/x-ndjson');
  c.header('X-Accel-Buffering', 'no');
  return stream(c, async (s) => {
    const start = Date.now();
    for (let i = 1; i <= n; i++) {
      await s.write(JSON.stringify({ i, elapsedMs: Date.now() - start }) + '\n');
      await s.sleep(delay);
    }
  });
});

// Plain-text token stream (simulates LLM-style incremental output).
app.get('/text', (c) => {
  const n = Math.min(Number(c.req.query('n')) || 10, 100);
  const delay = Math.min(Number(c.req.query('delay')) || 400, 5000);
  c.header('Content-Type', 'text/plain; charset=utf-8');
  c.header('X-Accel-Buffering', 'no');
  return stream(c, async (s) => {
    for (let i = 1; i <= n; i++) {
      await s.write(`token-${i} `);
      await s.sleep(delay);
    }
    await s.write('\n[done]\n');
  });
});

app.notFound((c) => c.json({ error: 'Not Found', path: new URL(c.req.url).pathname }, 404));

// Listen on the host/port the platform assigns via AWS_LAMBDA_HTTP_ENDPOINT
// (host:port). Falls back to localhost:3000 for local runs where the
// variable is unset.
const [hostname, portStr] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT || 'localhost:3000').split(':');
const port = Number(portStr);

serve({ fetch: app.fetch, hostname, port }, (info) =>
  console.log(`streaming-ndjson listening on ${info.port}`)
);
