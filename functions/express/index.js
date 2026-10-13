// express — REST API on Lambda Web Functions using Express.
//
// Standard Express app listening on port 3000. Demonstrates that a conventional Express
// server runs as-is: routing, JSON body parsing, path params, and middleware.
const express = require('express');

const app = express();
app.use(express.json());

app.get('/', (req, res) =>
  res.json({
    service: 'express',
    framework: 'express',
    routes: ['GET /', 'GET /health', 'GET /items/:id', 'POST /echo'],
    timestamp: new Date().toISOString(),
  }),
);

// Namespaced health check — /ping is reserved by the platform.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/items/:id', (req, res) =>
  res.json({ id: req.params.id, name: `item-${req.params.id}`, framework: 'express' }),
);

app.post('/echo', (req, res) =>
  res.json({ youSent: req.body, method: 'POST', at: new Date().toISOString() }),
);

app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));

// MUST listen on the host/port given by AWS_LAMBDA_HTTP_ENDPOINT (host:port) —
// the Web Functions runtime expects this. Falls back to localhost:3000 for
// local runs where the variable is unset.
const [hostname, portStr] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT || 'localhost:3000').split(':');
const port = Number(portStr);
app.listen(port, hostname, () => console.log(`express listening on port ${port}`));
