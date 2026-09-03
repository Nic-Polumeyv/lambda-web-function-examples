// webhook — signature-verified webhook receiver on Lambda Web Functions.
//
// A canonical "HTTP server with a public URL" use case: receive provider webhooks
// (GitHub / Stripe style) and verify an HMAC-SHA256 signature over the RAW request body
// before trusting the payload. Uses the built-in `http` module because signature
// verification needs the exact raw bytes (body parsers that re-serialize would break it)
// and a timing-safe comparison.
//
// Set the shared secret via the WEBHOOK_SECRET environment variable.
const http = require('http');
const crypto = require('crypto');

const SECRET = process.env.WEBHOOK_SECRET || 'dev-secret-change-me';
const SIG_HEADER = 'x-signature-256'; // e.g. GitHub uses x-hub-signature-256

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        service: 'webhook',
        purpose: 'HMAC-SHA256 signature-verified POST receiver',
        howto:
          'POST /webhook with header ' +
          SIG_HEADER +
          ': sha256=<hex hmac of the raw body using WEBHOOK_SECRET>',
      }),
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const provided = req.headers[SIG_HEADER] || '';
      const expected =
        'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');

      if (!provided || !timingSafeEqual(provided, expected)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid signature' }));
        return;
      }

      let payload = null;
      try {
        payload = JSON.parse(raw.toString('utf8'));
      } catch (_) {
        payload = raw.toString('utf8');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, received: payload }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
});

// MUST listen on port 3000 — the Web Functions runtime expects this.
server.listen(3000, '0.0.0.0', () => console.log('webhook listening on port 3000'));
