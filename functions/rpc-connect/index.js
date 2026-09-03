// rpc-connect — Connect + gRPC-Web RPC on Lambda Web Functions.
//
// A single @connectrpc/connect-node handler serves the Connect protocol AND gRPC-Web
// over HTTP/1.1, auto-negotiated by request Content-Type. Works on the
// Web Functions edge for both unary and server-streaming. (Native gRPC and
// client/bidi-streaming need HTTP/2, which the edge does not provide, so they are not
// exposed.)
//
// The server is a standard Node http.Server listening on the platform-required port
// 3000. We add a tiny non-RPC GET / info route so a browser/curl hitting the root sees
// something useful; all RPC lives under /greet.v1.GreeterService/*.
import { createServer } from 'node:http';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { create } from '@bufbuild/protobuf';
import { GreeterService, CountdownResponseSchema } from './gen/greet_pb.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Route registration: implement each RPC method.
function routes(router) {
  router.service(GreeterService, {
    // Unary
    async greet(req) {
      return { greeting: `Hello, ${req.name || 'world'}!` };
    },
    // Server-streaming — yields a stream of responses.
    async *countdown(req) {
      const from = req.from || 5;
      const start = Date.now();
      for (let v = from; v >= 0; v--) {
        yield create(CountdownResponseSchema, {
          value: v,
          elapsedMs: BigInt(Date.now() - start)
        });
        if (v > 0) await sleep(500);
      }
    }
  });
}

const handler = connectNodeAdapter({ routes });

const server = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        service: 'rpc-connect',
        protocols: ['Connect (unary + server-stream)', 'gRPC-Web (unary + server-stream)'],
        rpc: 'greet.v1.GreeterService',
        methods: ['Greet (unary)', 'Countdown (server-stream)'],
        note: 'native gRPC (HTTP/2) is not available on this edge'
      })
    );
    return;
  }
  // Everything else goes to the Connect/gRPC-Web handler.
  handler(req, res);
});

// MUST listen on port 3000 — the Web Functions runtime expects this.
server.listen(3000, '0.0.0.0', () => console.log('rpc-connect listening on port 3000'));
