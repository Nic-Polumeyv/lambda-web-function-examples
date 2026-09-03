# fastify

Demonstrates a [Fastify](https://fastify.dev/) REST API running unmodified on Lambda Web
Functions — Fastify's routing, built-in JSON parsing, and handlers work as-is because the
runtime just needs an HTTP server on port 3000.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check (`/ping` is reserved by the platform) |
| GET | `/items/:id` | Path-param example |
| POST | `/echo` | Echoes the JSON body back |

## Test

```bash
npm install
node index.js
curl http://localhost:3000/
curl http://localhost:3000/items/42
curl -X POST http://localhost:3000/echo -H 'Content-Type: application/json' -d '{"hello":"world"}'
```

## Deploy

See the [root README](../../README.md#deploy):

```bash
aws lambda-web deploy --name fastify --code . --create
```
