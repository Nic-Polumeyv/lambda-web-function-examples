// iam-auth — a Web Function deployed behind IAM (SigV4) auth.
//
// The application code is ordinary: a plain HTTP server on port 3000. What makes this an
// IAM-protected endpoint is the DEPLOY-TIME setting `--auth-type IamAuth`, not anything in
// here. With IamAuth, the platform verifies a SigV4 signature and the caller's IAM
// permission BEFORE the request reaches this code — so if your handler runs at all, the
// caller was authenticated. Unsigned/unauthorized requests are rejected at the edge.
//
// This handler just reports what it received, so you can confirm authenticated requests
// land here.
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      service: 'iam-auth',
      note: 'If you can read this, your request was SigV4-signed and authorized.',
      method: req.method,
      path: req.url,
      timestamp: new Date().toISOString(),
    }),
  );
});

// MUST listen on the host/port given by AWS_LAMBDA_HTTP_ENDPOINT (host:port) —
// the Web Functions runtime expects this. Falls back to localhost:3000 for
// local runs where the variable is unset.
const [hostname, portStr] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT || 'localhost:3000').split(':');
const port = Number(portStr);
server.listen(port, hostname, () => console.log(`iam-auth listening on port ${port}`));
