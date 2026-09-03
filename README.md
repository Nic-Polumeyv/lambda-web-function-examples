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
| [`functions/iam-auth`](functions/iam-auth) | IAM (SigV4) authenticated endpoint — verified signing recipe | built-in `http` |

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

(`webhook` reads a `WEBHOOK_SECRET` env var — add `--env WEBHOOK_SECRET=...` for it.
`iam-auth` should be deployed with `--auth-type IamAuth` — see its README and the Auth
section below.)

Tear down a function:

```bash
aws lambda-web delete-web-function --function-name rest-hono
```

## Staging vs. prod

You don't need separate functions, stacks, or accounts to run a staging→prod flow — it's
built into the resource model. There are three layers:

- **Function** — the top-level container (just a name).
- **Revision** — an immutable snapshot of your code + config. Every deploy creates a new
  one (`rev-xxxxx`); old revisions are retained.
- **Endpoint** — a routable URL with its own auth type and a **revision-weights** table
  that decides which revision(s) its traffic hits.

The separation lives at the **endpoint** layer: a single function can have **multiple
endpoints**, each pointing at different revisions and each with its own URL.

### Two endpoints on one function

Give a function both a `staging` and a `prod` endpoint — each gets a distinct URL:

```bash
# stand up a staging endpoint and deploy to it
aws lambda-web deploy --name my-api --code . --endpoint-name staging --create

# ...validate the staging URL, then stand up prod
aws lambda-web deploy --name my-api --code . --endpoint-name prod --create
```

### Auto-deploy vs. pinned

Each endpoint has an **auto-deployment mode** that controls how it tracks new revisions:

- **`LatestRevision`** (default for `HomeRegion` endpoints) — the endpoint automatically
  serves the newest revision. Deploy and traffic shifts. Good for `staging`/`dev`.
- **`Disabled`** (pinned) — the endpoint stays on the revision(s) you set until you
  explicitly repoint it. New deploys create revisions but don't touch its traffic. Good
  for `prod`.

A typical setup: `staging` on `LatestRevision` (always serves the latest build), `prod`
pinned. You promote by pointing `prod` at the revision that `staging` already validated.

### Canary / blue-green

An endpoint's revision-weights can split traffic across **two** revisions (weights sum to
100), which gives you canary and blue-green rollouts on a pinned endpoint:

```bash
# send 10% of prod traffic to a new revision, 90% to the current one
aws lambda-web update-web-function-endpoint --function-name my-api --endpoint-name prod \
  --revision-weights '[{"revisionId":"rev-new","weight":10},{"revisionId":"rev-old","weight":90}]'
```

Shift the weights toward the new revision as you gain confidence, then set it to 100 to
finish the rollout (or back to the old revision to roll back).

> **Geographic vs. lifecycle:** staging/prod is the *lifecycle* axis (endpoints +
> revisions on one function). Endpoint **type** (`HomeRegion`, `MultiRegion`, `PerRegion`)
> is a separate *geographic* axis for where an endpoint serves from.

## Auth

Auth is set **per endpoint** (the `authType`), so one function can expose, say, a public
endpoint and an IAM-locked endpoint at the same time. Two modes:

### `ApplicationManaged` (default)

The platform enforces **no** auth — every request reaches your app, and **your code is
responsible for authenticating each request**. Use this when the endpoint is genuinely
public, or when you do auth in the app: bearer tokens (JWT/OAuth), session cookies, API-key
headers, or signature verification. All the demos here use `ApplicationManaged`;
[`functions/webhook`](functions/webhook) is the canonical example of app-level auth (it
verifies an HMAC signature in the handler because the platform isn't checking anything).

### `IamAuth`

The request must be **SigV4-signed** and the caller needs the
`lambda:InvokeWebFunctionEndpoint` IAM permission; the platform rejects unsigned or
unauthorized requests at the edge (an opaque `403`) before they reach your code. Good for
service-to-service calls, internal APIs, or fronting with CloudFront OAC. Deploy with:

```bash
aws lambda-web deploy --name my-api --code . --auth-type IamAuth --create
```

The SigV4 recipe has three easy-to-miss requirements (each failure returns the same opaque
`403`) — all verified against a live endpoint in [`functions/iam-auth`](functions/iam-auth):

- **Signing service name is `lambda`** (not `execute-api` or `lambda-web`).
- **`x-amz-content-sha256` header is mandatory** (the SHA-256 of the body). Some SigV4
  helpers omit it — set it explicitly.
- **IAM action `lambda:InvokeWebFunctionEndpoint`**, scoped to the endpoint ARN.

To grant another account or service invoke access, attach a **resource policy** to the
endpoint (`lambda:InvokeWebFunctionEndpoint` for that principal, scoped to the endpoint
ARN). See [`functions/iam-auth`](functions/iam-auth) for the working signing example.

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
    ├── iam-auth/             # IAM (SigV4) authenticated endpoint (http)
    ├── express/              # REST (Express)
    └── fastify/              # REST (Fastify)
```
