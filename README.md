# Lambda Web Functions — Protocol Demos

A set of small, single-purpose functions that each demonstrate a web protocol or a popular
framework running on **AWS Lambda Web Functions**. Every function is a plain Node.js HTTP
server that listens on port 3000 — no Lambda handler, no API Gateway, no framework
lock-in.

> **Lambda Web Functions** run a web server on Lambda infrastructure: you write a standard
> HTTP server and the platform gives it a public HTTPS URL. You write `http.createServer()`
> (or use a framework like Hono), not an `exports.handler`.

## What each function demonstrates

**Protocols** — one web protocol each:

| Folder | Protocol | Framework |
|--------|----------|-----------|
| [`functions/rest-hono`](functions/rest-hono) | HTTP/1.1 request/response (REST) | [Hono](https://hono.dev/) |
| [`functions/sse-hono`](functions/sse-hono) | Server-Sent Events (`text/event-stream`) | Hono |
| [`functions/streaming-ndjson`](functions/streaming-ndjson) | Chunked streaming (NDJSON + text) | Hono |
| [`functions/rpc-connect`](functions/rpc-connect) | Connect + gRPC-Web RPC (unary + server-streaming) | [Connect](https://connectrpc.com/) |
| [`functions/webhook`](functions/webhook) | Signature-verified webhook receiver (HMAC-SHA256) | built-in `http` |

**Frameworks** — the same "just an HTTP server" contract, shown with popular API frameworks:

| Folder | Framework |
|--------|-----------|
| [`functions/express`](functions/express) | [Express](https://expressjs.com/) |
| [`functions/fastify`](functions/fastify) | [Fastify](https://fastify.dev/) |
| [`functions/rest-hono`](functions/rest-hono) | [Hono](https://hono.dev/) |

Each folder has its own README with routes, test commands, and any protocol-specific notes.

## Protocol support notes

Lambda Web Functions serve over **HTTP/1.1**. That shapes what works:

- ✅ **HTTP/1.1 REST, SSE, and chunked streaming** — fully supported; responses stream to
  the client incrementally rather than being buffered.
- ✅ **Connect and gRPC-Web** (unary + server-streaming) — both run over HTTP/1.1 from a
  single [Connect](https://connectrpc.com/) server.
- ❌ **Native gRPC**, **client-/bidirectional-streaming**, and **WebSockets** — all require
  HTTP/2 or the `Upgrade` handshake, which the HTTP/1.1 request/response edge does not
  provide. (`rpc-connect` exposes only unary and server-streaming; for server→client push
  use SSE via `sse-hono`.)

Requests also have a maximum duration (function timeout, up to 900s), so long-lived
streams and connections are bounded — there are no infinite SSE streams or sockets.

## The runtime contract

Every function follows the same rules:

1. It's a standard HTTP server that **listens on port 3000**
   (`process.env.AWS_LAMBDA_HTTP_ENDPOINT`, default `localhost:3000`). Your code must call
   `listen()` — a bare handler that never listens will not start.
2. The entry file is **`index.js`**.
3. **`GET /ping` is reserved** by the platform for health checks — use a namespaced path
   like `/health` for your own checks.

## Run locally

Each function is a plain Node server, so you can run it directly:

```bash
cd functions/rest-hono
npm install
node index.js        # listens on http://localhost:3000
```

`rpc-connect` also generates code from its `.proto`; see its README.

## Deploy

Deploy any function with the AWS CLI's one-command web deploy — it bundles the folder,
provisions the S3 artifact bucket and execution role, creates the function + endpoint, and
prints a live URL:

```bash
aws lambda-web deploy --name rest-hono --code ./functions/rest-hono --create
```

Re-run the same command to ship changes (it deploys a new revision and points the endpoint
at it). To deploy all of them:

```bash
for fn in rest-hono sse-hono streaming-ndjson rpc-connect express fastify webhook; do
  aws lambda-web deploy --name "$fn" --code "./functions/$fn" --create
done
```

(`webhook` reads a `WEBHOOK_SECRET` env var — add `--env WEBHOOK_SECRET=...` for it.)

Tear down a function:

```bash
aws lambda-web delete-web-function --function-name rest-hono
```

## Repo layout

```
.
├── README.md
└── functions/
    ├── rest-hono/            # HTTP/1.1 REST (Hono)
    ├── sse-hono/             # Server-Sent Events (Hono)
    ├── streaming-ndjson/     # chunked NDJSON / text streaming (Hono)
    ├── rpc-connect/          # Connect + gRPC-Web RPC (Connect)
    ├── webhook/              # HMAC-signed webhook receiver (http)
    ├── express/              # REST (Express)
    └── fastify/              # REST (Fastify)
```
