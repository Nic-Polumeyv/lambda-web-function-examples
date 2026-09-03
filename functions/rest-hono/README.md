# rest-hono

Demonstrates the **baseline HTTP/1.1 request/response** protocol on Lambda Web Functions
using [Hono](https://hono.dev/) on `@hono/node-server`.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check (namespaced — `/ping` is reserved by the platform) |
| GET | `/items/:id` | Path-param example |
| POST | `/echo` | Echoes the JSON (or text) body back |

## Test

Replace `$DOMAIN` with the endpoint domain printed by deploy.

```bash
curl https://$DOMAIN/
curl https://$DOMAIN/items/42
curl -X POST https://$DOMAIN/echo -H 'Content-Type: application/json' -d '{"hello":"world"}'
```

## Deploy

See the [root README](../../README.md#deploy):

```bash
aws lambda-web deploy --name rest-hono --code . --create
```
