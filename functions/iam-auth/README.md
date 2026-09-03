# iam-auth

Demonstrates an endpoint protected by **IAM authentication (SigV4)**. The application code
is an ordinary HTTP server on port 3000 — what makes it IAM-protected is the **deploy-time**
setting `--auth-type IamAuth`. With `IamAuth`, the platform verifies a SigV4 signature and
the caller's IAM permission **before** the request reaches your code; unsigned or
unauthorized requests are rejected at the edge with an opaque `403`.

## Deploy

```bash
aws lambda-web deploy --name iam-auth --code . --auth-type IamAuth --create
```

## The SigV4 signing recipe (verified)

Calling an `IamAuth` endpoint requires a correctly SigV4-signed request. Three details are
easy to get wrong, and every mistake comes back as the **same opaque HTML `403`** with no
error code — so they're hard to diagnose. All three were confirmed against a live endpoint:

| Requirement | Wrong value → result |
|---|---|
| **Signing service name is `lambda`** | `execute-api` → 403, `lambda-web` → 403 |
| **`x-amz-content-sha256` header is mandatory** (S3-style; the SHA-256 of the body) | omitted → 403 |
| **IAM action `lambda:InvokeWebFunctionEndpoint`** on the caller, scoped to the endpoint ARN | missing permission → 403 |

Only `service=lambda` **and** the `x-amz-content-sha256` header **and** the IAM permission
together return `200`.

> Note: `aws4fetch` and some SigV4 helpers omit `x-amz-content-sha256` by default — set it
> explicitly or the request fails.

## Test

An unsigned request is rejected:

```bash
curl -i https://<domain>/     # => HTTP/1.1 403 Forbidden
```

A signed request succeeds. Example using `botocore` (ships with the AWS CLI / boto3):

```python
import hashlib, urllib.request, urllib.error
from botocore.session import Session
from botocore.awsrequest import AWSRequest
from botocore.auth import SigV4Auth

url, region = "https://<domain>/", "us-east-1"
creds = Session().get_credentials().get_frozen_credentials()

req = AWSRequest(method="GET", url=url, data=b"")
req.headers["x-amz-content-sha256"] = hashlib.sha256(b"").hexdigest()  # required
SigV4Auth(creds, "lambda", region).add_auth(req)                       # service = "lambda"

r = urllib.request.Request(url, method="GET", headers=dict(req.headers.items()))
print(urllib.request.urlopen(r).read().decode())   # => 200 + JSON from the function
```

The caller's IAM identity needs `lambda:InvokeWebFunctionEndpoint` on the endpoint ARN.

## Granting other principals (resource policy)

To let another account or an AWS service (e.g. CloudFront) invoke the endpoint, attach a
resource policy granting the `lambda:InvokeWebFunctionEndpoint` action to that principal,
scoped to the endpoint ARN (typically with a source-ARN condition).
