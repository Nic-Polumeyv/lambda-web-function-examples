# sse-hono

Demonstrates **Server-Sent Events** (`text/event-stream`) on Lambda Web Functions using
Hono's `streamSSE`. The edge preserves `text/event-stream` and flushes each event to the
client as it's written, so this is a good fit for live feeds and LLM token push.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/events?n=10&delay=500` | Emits `n` events, one every `delay` ms |

## Test

Use `curl -N` to disable buffering so you see events arrive incrementally:

```bash
curl -N "https://$DOMAIN/events?n=10&delay=500"
```

You should see one `event: tick` block roughly every 500ms, then a final `event: done`.

## Notes

- Sets `X-Accel-Buffering: no` to defeat any intermediary buffering.
- The function's timeout (max 900s) bounds how long a stream can stay open — there are no
  infinite SSE connections.

## Deploy

See the [root README](../../README.md#deploy):

```bash
aws lambda-web deploy --name sse-hono --code . --create
```
