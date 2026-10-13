# iam-auth

Demonstrates an endpoint protected by **IAM authentication (SigV4)**. The application code
is an ordinary HTTP server listening on the host/port the platform assigns — what makes it
IAM-protected is the **deploy-time** setting `--auth-type IamAuth`. With `IamAuth`, the
platform verifies a SigV4 signature and the caller's IAM permission **before** the request
reaches your code; unsigned or unauthorized requests are rejected at the edge with an
opaque `403`.

## Deploy

```bash
aws lambda-web deploy --name iam-auth --code . --auth-type IamAuth --create
```

## The SigV4 signing recipe

Calling an `IamAuth` endpoint requires a correctly SigV4-signed request. Three details are
easy to get wrong, and every mistake comes back as the **same opaque HTML `403`** with no
error code — so they're hard to diagnose:

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
**resource-based policy** to the function. The commands live under `aws lambda-web`, take
the **function** ARN as `--resource-arn`, and the policy's `Resource` is scoped to the
**endpoint** ARN:

```bash
FN_ARN=arn:aws:lambda:<region>:<account>:web-function/<name>
EP_ARN=$FN_ARN/endpoint/<endpoint-name>

# grant a specific CloudFront distribution invoke access
aws lambda-web put-resource-policy --resource-arn "$FN_ARN" --policy '{
  "Version":"2012-10-17",
  "Statement":[{
    "Sid":"AllowCloudFront","Effect":"Allow",
    "Principal":{"Service":"cloudfront.amazonaws.com"},
    "Action":"lambda:InvokeWebFunctionEndpoint",
    "Resource":"'"$EP_ARN"'",
    "Condition":{"StringEquals":{"AWS:SourceArn":"arn:aws:cloudfront::<account>:distribution/<id>"}}
  }]}'

aws lambda-web get-resource-policy    --resource-arn "$FN_ARN"   # returns policy + RevisionId
aws lambda-web delete-resource-policy --resource-arn "$FN_ARN"   # removes it
```

`put`/`get` return a `RevisionId` (optimistic-concurrency token). Removing the policy makes
`get` return `ResourceNotFoundException: The function does not have a policy`.
