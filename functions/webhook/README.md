# webhook

Demonstrates a **signature-verified webhook receiver** — a canonical use of a public
HTTP endpoint. It verifies an **HMAC-SHA256** signature over the raw request body
(GitHub / Stripe style) with a timing-safe comparison before trusting the payload.

Dependency-free (built-in `http` + `crypto`): signature verification needs the exact raw
bytes, so it reads the body directly rather than through a JSON body parser that would
re-serialize it.

## Config

Set the shared secret via `WEBHOOK_SECRET` (defaults to a dev placeholder). On deploy,
pass it as an environment variable:

```bash
aws lambda-web deploy --name webhook --code . --create --env WEBHOOK_SECRET=your-secret
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| POST | `/webhook` | Verifies `x-signature-256: sha256=<hmac>` over the raw body |

Returns `200 {ok:true,...}` on a valid signature, `401` otherwise.

## Test

```bash
npm install   # no deps, but keeps things consistent
WEBHOOK_SECRET=test node index.js

# in another shell — compute the signature and send it:
BODY='{"event":"ping"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac test | awk '{print $2}')"
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "x-signature-256: $SIG" \
  -d "$BODY"
# -> {"ok":true,"received":{"event":"ping"}}

# wrong/missing signature -> 401
curl -X POST http://localhost:3000/webhook -d "$BODY"
```

## Deploy

See the [root README](../../README.md#deploy).
