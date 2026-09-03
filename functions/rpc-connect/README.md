# rpc-connect

Demonstrates **RPC** on Lambda Web Functions using
[Connect](https://connectrpc.com/) (`@connectrpc/connect-node`). A single server serves
**both** the Connect protocol and **gRPC-Web**, auto-negotiated from the request
`Content-Type`. Both **unary** and **server-streaming** work over the HTTP/1.1 edge.

> **Not supported by the platform edge:** native gRPC (needs HTTP/2) and
> client-/bidirectional-streaming (need HTTP/2). This function exposes only the two shapes
> that work: unary and server-streaming.

## Service

Defined in [`proto/greet.proto`](proto/greet.proto):

- `Greet(GreetRequest) → GreetResponse` — **unary**
- `Countdown(CountdownRequest) → stream CountdownResponse` — **server-streaming**

RPC endpoints live at `/greet.v1.GreeterService/<Method>`. A plain `GET /` returns service
info.

## Code generation

The generated message code in `gen/` is produced from the `.proto` with
[buf](https://buf.build/). Regenerate after editing the proto:

```bash
npm install          # installs buf + protoc-gen-es (devDependencies)
npm run generate     # buf generate -> gen/greet_pb.js + .d.ts
```

`gen/` is committed so deploys don't require the codegen toolchain. This function is ESM
(`"type": "module"` in package.json); the entry file is still `index.js` as the runtime
requires.

## Test

**Connect unary** (plain POST + JSON — easiest to test with curl):

```bash
curl -X POST https://$DOMAIN/greet.v1.GreeterService/Greet \
  -H 'Content-Type: application/json' -d '{"name":"connect"}'
# -> {"greeting":"Hello, connect!"}
```

**With the Connect/gRPC-Web clients** (typed, recommended for real use). Point a
`@connectrpc/connect-web` client at `https://$DOMAIN`:

```ts
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web"; // or createGrpcWebTransport
import { GreeterService } from "./gen/greet_pb.js";

const transport = createConnectTransport({ baseUrl: "https://YOUR_DOMAIN" });
const client = createClient(GreeterService, transport);

// unary
console.log(await client.greet({ name: "connect" }));

// server-streaming
for await (const msg of client.countdown({ from: 5 })) console.log(msg.value);
```

Swap `createConnectTransport` for `createGrpcWebTransport` to exercise the **gRPC-Web**
wire protocol against the same endpoint — no server change needed.

## Deploy

See the [root README](../../README.md#deploy):

```bash
aws lambda-web deploy --name rpc-connect --code . --create
```

The runtime needs `index.js`, `package.json`, `node_modules/`, and the generated `gen/`
directory. `proto/` and `buf.*` are only used for codegen, not at runtime.
