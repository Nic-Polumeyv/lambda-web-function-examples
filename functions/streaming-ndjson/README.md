# streaming-ndjson

Demonstrates **raw chunked HTTP streaming** (`Transfer-Encoding: chunked`) on Lambda Web
Functions using Hono's `stream`. Two payload shapes:

- **NDJSON** — one JSON object per line (great for structured event/record streams).
- **text** — incremental tokens (simulates LLM-style output).

The edge flushes each `write()` to the client as it happens, not buffered to the end.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/ndjson?n=10&delay=400` | `n` JSON lines, one every `delay` ms |
| GET | `/text?n=10&delay=400` | `n` text tokens, one every `delay` ms |

## Test

```bash
curl -N "https://$DOMAIN/ndjson?n=10&delay=400"
curl -N "https://$DOMAIN/text?n=10&delay=400"
```

Lines/tokens should arrive spread out over time, not all at once.

## Deploy

See the [root README](../../README.md#deploy):

```bash
aws lambda-web deploy --name streaming-ndjson --code . --create
```
