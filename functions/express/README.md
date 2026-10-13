# express

Demonstrates a conventional [Express](https://expressjs.com/) REST API running unmodified
on Lambda Web Functions — routing, JSON body parsing, path params, and middleware all work
because the runtime just needs an HTTP server listening on the host/port it assigns.

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
aws lambda-web deploy --name express --code . --create
```
