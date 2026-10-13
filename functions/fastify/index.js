// fastify — REST API on Lambda Web Functions using Fastify.
//
// Standard Fastify app listening on port 3000. Demonstrates Fastify's routing, built-in
// JSON parsing, and schema-friendly handlers running as-is on the platform.
const Fastify = require('fastify');

const app = Fastify({ logger: false });

app.get('/', async () => ({
  service: 'fastify',
  framework: 'fastify',
  routes: ['GET /', 'GET /health', 'GET /items/:id', 'POST /echo'],
  timestamp: new Date().toISOString(),
}));

// Namespaced health check — /ping is reserved by the platform.
app.get('/health', async () => ({ status: 'ok' }));

app.get('/items/:id', async (req) => ({
  id: req.params.id,
  name: `item-${req.params.id}`,
  framework: 'fastify',
}));

app.post('/echo', async (req) => ({
  youSent: req.body,
  method: 'POST',
  at: new Date().toISOString(),
}));

app.setNotFoundHandler((req, reply) =>
  reply.code(404).send({ error: 'Not Found', path: req.url }),
);

// MUST listen on the host/port given by AWS_LAMBDA_HTTP_ENDPOINT (host:port) —
// the Web Functions runtime expects this. Falls back to localhost:3000 for
// local runs where the variable is unset.
const [host, portStr] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT || 'localhost:3000').split(':');
const port = Number(portStr);
app.listen({ port, host }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`fastify listening on port ${port}`);
});
