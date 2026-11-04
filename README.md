# PageCourier

PageCourier is a web application for sharing rendered Markdown through a
unique link. The server stores immutable uploads in private S3-compatible
storage and serves readable document pages, canonical share links, and exact
original downloads.

## Requirements

- Node.js 24 LTS and npm
- Playwright's Chromium browser to run browser tests
- Docker with Compose v2 and BuildKit for the local production stack

Use `nvm use` to select the Node version from `.nvmrc`, then install the locked
dependencies:

```sh
npm ci
```

## Configuration

Development starts with safe local defaults. Copy `.env.example` to `.env` to
override them. SvelteKit loads `.env` for development; never put credentials in
the example file or client-side code.

| Variable              | Required   | Default                   | Description                                                                                                                                                                           |
| --------------------- | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ORIGIN`       | Production | `http://localhost:<PORT>` | Canonical HTTP(S) origin used for public links. It must not include a path, query, fragment, or credentials.                                                                          |
| `HOST`                | No         | `0.0.0.0`                 | Address on which the Node server listens.                                                                                                                                             |
| `PORT`                | No         | `3000`                    | Listen port, from 1 through 65,535.                                                                                                                                                   |
| `UPLOAD_MAX_BYTES`    | No         | `5242880`                 | Positive, safe-integer upload limit in bytes (5 MiB by default).                                                                                                                      |
| `LOG_LEVEL`           | No         | `info`                    | Minimum structured application log level: `trace`, `debug`, `info`, `warn`, `error`, or `fatal`.                                                                                      |
| `S3_BUCKET`           | Production | `pagecourier-development` | S3-compatible bucket name.                                                                                                                                                            |
| `AWS_REGION`          | Production | `us-east-1`               | AWS region for the bucket.                                                                                                                                                            |
| `S3_ENDPOINT`         | No         | unset                     | Optional custom HTTP(S) endpoint; production endpoints must use HTTPS.                                                                                                                |
| `S3_ALLOW_LOCAL_HTTP` | No         | `false`                   | Explicit local-testing exception: HTTP endpoints named `minio`, `localhost`, `127.0.0.1`, or `[::1]` only, with a loopback canonical origin. Never enable for production deployments. |
| `S3_FORCE_PATH_STYLE` | No         | `false`                   | Whether to use path-style S3 addressing. Must be `true` or `false`.                                                                                                                   |
| `S3_KEY_PREFIX`       | No         | empty                     | Optional key prefix, without a leading slash or `..` path segment.                                                                                                                    |

Production configuration is validated before the server starts. Set
`PUBLIC_ORIGIN`, `S3_BUCKET`, and `AWS_REGION` in the deployment environment.
The AWS SDK uses its default credential-provider chain (for example workload
identity or an injected credentials source); credentials are not application
configuration and must never be committed.

The application exposes `GET /health/live` and `GET /health/ready`. Liveness
only confirms that the process can serve requests and stays healthy during S3
outages. Readiness performs a bounded, non-writing `HeadBucket` request and
returns 503 when the configured storage is unavailable or inaccessible. Probe
both endpoints independently; do not use readiness as the process liveness
check. Readiness requires the bucket-level `s3:ListBucket` permission in
addition to object access.

Application logs are newline-delimited JSON with a timestamp, level,
operation, classification, and (for requests) the route template, method, and
status. Request paths, document IDs, share URLs, uploaded content, credentials,
and raw storage-provider errors are not logged. Set `LOG_LEVEL` to control the
minimum level. The Node adapter handles SIGINT/SIGTERM by stopping new
connections, draining in-flight requests, and closing idle connections within
its bounded shutdown period; the application closes the S3 client after the
adapter's shutdown event.

## Development

```sh
npm run dev
```

## Production

Build and start the Node-adapter server with the required production settings:

```sh
npm run build
PUBLIC_ORIGIN=https://pages.example.com \
S3_BUCKET=pagecourier \
AWS_REGION=us-east-1 \
npm start
```

The start command sets production mode before loading the built server. Provide
storage credentials through the AWS default credential-provider chain.

## Checks and tests

```sh
npm run check             # Svelte and TypeScript checks
npm run lint              # Prettier and ESLint
npm run test:unit         # Vitest unit tests
npm run test:e2e:install  # Install Playwright Chromium once
npm run test:e2e          # Node-adapter browser journeys with local test storage
npm run test:acceptance   # Isolated production containers and real MinIO (Docker required)
npm run helm:check        # Helm lint, package, four-mode render, and invalid-value checks
npm test                  # Unit and browser tests
npm run build             # Production build
```

The browser suite uses an isolated local S3-protocol test server; no external
storage service or credentials are required. Unit tests include deterministic
multipart, collision, storage-failure, rendering-safety and route coverage.
The production acceptance command instead uses the exact production image and
real MinIO; it is the release acceptance gate, not a replacement for fast tests.

## Local production-container stack

**This Compose stack is for local development and acceptance only, not a
production deployment template.** Ports bind to loopback. All credentials in
`compose.yaml` and the provisioning script are explicitly public development-only
values. Never reuse them elsewhere. The application image has no credentials or
local storage defaults baked into it.

From a clean checkout with Docker running:

```sh
docker compose up --build --detach --wait --wait-timeout 180
# Open http://127.0.0.1:3000 (localhost redirects to the configured origin).
docker compose logs --follow app
docker compose up --build --detach --wait app  # Rebuild after source changes
docker compose restart                       # Retains uploaded documents
docker compose down                          # Also retains uploaded documents
```

MinIO stores objects in the project-scoped `minio-data` named volume. Provisioning
automatically creates the private `pagecourier-development` bucket and a separate
application user limited to `ListBucket`, `GetObject`, and `PutObject`; it cannot
delete objects. Re-provisioning is idempotent and does not delete documents.
MinIO's API is at `http://127.0.0.1:9000`; its browser console is disabled.
The app runs as UID 1000, with read-only root storage, no Linux capabilities,
no privilege escalation, and a 16 MiB `/tmp` tmpfs. Document bytes are bounded
in-memory buffers, not files in that mount. SIGTERM drains requests; Compose's
15-second stop grace exceeds the configured 10-second adapter shutdown deadline.

Compose explicitly enables `S3_ALLOW_LOCAL_HTTP=true` for `http://minio:9000`
and the loopback public origin. Production mode and all other validation remain
active. Normal production configurations still reject HTTP storage endpoints;
use HTTPS and external credentials in real deployments. To change local ports,
set `APP_PORT` and/or `MINIO_PORT` consistently for every Compose command.
Compose honors `PUBLIC_ORIGIN` from the environment or `.env`, defaulting to
`http://127.0.0.1:${APP_PORT:-3000}`. If you set `APP_PORT`, also update any explicit
`PUBLIC_ORIGIN` to match. Local page visits using another loopback hostname on the
same port redirect to the configured origin before displaying the
upload form. POST requests still require that exact origin; aliases, missing
origins, and unrelated sites are not accepted. After configuration or source
changes, run `docker compose up --build --detach --wait app` and reload the page.

Upstream MinIO community image tags are no longer available from the original
registries. `containers/minio.Dockerfile` therefore builds the server and client
from fixed upstream Git commits with a digest-pinned Go toolchain and runtime.
Their AGPL license texts accompany those local images, and their exact source
revisions are recorded in OCI labels. These local storage images are separate
from the MIT-licensed PageCourier image and are not publishing artifacts.
Initial storage builds download upstream sources/Go dependencies and can need
substantial memory. Update the reviewed commits and base digests deliberately.

To **deliberately and permanently remove all documents in this local stack**:

```sh
docker compose down --volumes
```

Do not add `--volumes` to ordinary shutdowns. Changing the Compose project name
uses a different volume; it does not erase the previous project's data.

### Production acceptance and architecture builds

```sh
npm ci
npm run test:e2e:install
npm run test:acceptance

# Build each supported application architecture locally, without publishing.
docker buildx build --platform linux/amd64 --load -t pagecourier:amd64 .
docker buildx build --platform linux/arm64 --load -t pagecourier:arm64 .
```

Acceptance creates a uniquely named `pagecourier-acceptance-*` Compose project
with dynamically allocated loopback ports, builds the production app, runs unit
tests (including real MinIO conditional collisions) and shared Chromium journeys,
and exercises a second production replica. It stops/restarts storage and replaces
app containers only in that isolated project. A `finally` cleanup removes only
the acceptance project's containers and disposable volume; the ordinary local
stack remains untouched. SIGINT/SIGTERM also trigger cleanup. A forced process
kill or Docker daemon failure can require manual cleanup of the exact project
name shown in the output. Never clean up other projects indiscriminately.

The browser busy-state test delays a request before forwarding it unchanged,
and the remote-image test supplies a deterministic HTTPS image. Application
requests still reach the production server and all uploads use real MinIO.
Storage failures are real service outages, not filename-triggered S3 mocks.
Deterministic collision injection stays in unit/storage tests, not the image.
Published multi-architecture manifest verification belongs to the publishing
workflow task.

| Acceptance criteria  | Coverage                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01, AC-02         | Shared Chromium start-page/drop/document-page upload journeys with real storage.                                                                              |
| AC-03, AC-04, AC-05  | Container integration: duplicate uploads, app restart/replacement, second replica, MinIO restart, exact BOM/CRLF bytes and safe filenames.                    |
| AC-06                | Chromium clipboard success and unavailable-access fallback.                                                                                                   |
| AC-07                | Deterministic Markdown/GFM/anchors/code-language tests; shared browser rendering journeys.                                                                    |
| AC-08, AC-09         | Shared Chromium Mermaid/CSP/payload tests plus deterministic sanitizer and complexity-boundary tests.                                                         |
| AC-10                | Real production multipart uploads at exactly 5,242,880 bytes and one byte above, empty/blank/invalid UTF-8/extension rejection; bounded multipart unit tests. |
| AC-11                | Real deletion/missing-ID 404 and storage-outage upload/read/download 503, independent liveness and readiness; browser failed-upload preservation.             |
| AC-12, AC-13         | Shared HTTPS-image, keyboard, busy/error/clipboard feedback and mobile-overflow journeys; deterministic URL sanitizer tests.                                  |
| AC-16 (local), AC-17 | Compose provisioning/persistence, both architecture builds; real MinIO conditional collision test plus deterministic retry bounds.                            |
| AC-18                | Container/browser response headers, captured redacted app diagnostics, non-writing readiness and deterministic failure-path tests.                            |
| AC-19                | Container server-rendered escaped Open Graph metadata plus deterministic title/excerpt/escaping tests.                                                        |

If startup fails, inspect `docker compose ps --all` and
`docker compose logs app provision`; verify Docker has enough disk/memory and
the loopback ports are free. Missing buckets or denied storage access produce
unhealthy readiness but healthy liveness; verify provisioning succeeded instead
of repeatedly restarting the app. Access the app by its configured canonical
origin, not `localhost` when Compose specifies `127.0.0.1`. For custom production
storage, use HTTPS and do not disable certificate verification. Keep provider
debug/access logging out of captured acceptance artifacts.

## Kubernetes deployment with Helm

The chart installs only the PageCourier Deployment, a ClusterIP Service, and
its service account (unless an existing account is selected). It never installs
S3/MinIO, an ingress or mesh controller, Gateway API/Istio CRDs, certificates,
or gateways. Configure an existing private S3-compatible bucket before
installing; the configured identity needs `s3:GetObject` and `s3:PutObject` on
the application prefix and `s3:ListBucket` on the bucket. Conditional
create-only writes must be supported by the provider.

The chart defaults to `exposure.mode: none`. The single mode setting selects
exactly one optional route: standard Kubernetes Ingress, Gateway API HTTPRoute,
or Istio VirtualService. Each route serves `/`; subpath hosting is unsupported.
DNS, controller installation, HTTP-to-HTTPS redirects, TLS certificates and
gateway listeners are operator-managed. Ingress TLS refers to an existing
Secret; Gateway API and Istio TLS are configured on the existing listener or
gateway, not in this chart. Configure proxy body limits to accept at least
5 MiB plus multipart overhead (the chart's example uses 6 MiB) and redact
document paths/IDs in proxy access logs.

The chart metadata version and `appVersion` currently both match the repository
image version `0.0.1`. Before chart publication is implemented, install from a
checkout:

```sh
helm upgrade --install pagecourier ./charts/pagecourier \
  --namespace pagecourier --create-namespace \
  --values charts/pagecourier/examples/none.yaml
```

After the OCI chart package is published, use its version and an operator-owned
values file instead:

```sh
helm upgrade --install pagecourier \
  oci://ghcr.io/torstenwerner/charts/pagecourier \
  --version 0.0.1 --namespace pagecourier --create-namespace \
  --values values-production.yaml
```

Use the corresponding example as a starting point for each route:
`charts/pagecourier/examples/none.yaml`, `ingress.yaml`, `gateway.yaml`, or
`istio.yaml`. External credential examples are in
`charts/pagecourier/examples/aws-workload-identity.yaml` and
`external-secret.yaml`. The examples contain only placeholder public names,
bucket names, and role identifiers; they contain no credentials. For an ingress, set `className`, host
entries, optional annotations, and the name of an existing TLS Secret. For a
Gateway API route, set `parentRefs` to an existing Gateway (including optional
namespace/section name), hostnames, and optional method/header/query match
constraints. The chart always adds a root `PathPrefix` match. For Istio, set the VirtualService hosts
and references to existing Istio Gateways. Do not configure TLS certificates
or gateway resources in PageCourier values.

Set `app.publicOrigin`, `storage.bucket`, and `storage.region` for every
deployment. The chart also supports a custom HTTPS S3 endpoint, path-style
addressing, a key prefix, upload limits, log level, port, resource
requests/limits, replica count, probes, pod/container security contexts,
annotations, and image pull secrets. The defaults run as UID/GID 1000, drop
all Linux capabilities, disallow privilege escalation, use a read-only root
filesystem, and mount a size-limited writable `/tmp`. Keep at least one replica;
multiple replicas share state exclusively through the configured bucket.
Tune resource limits and probe timing for the target workload and storage
latency. Readiness performs a bounded non-writing bucket check; liveness does
not depend on S3.

For AWS EKS IRSA, create the service account with the role annotation. The
chart creates a service account by default:

```yaml
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/pagecourier
```

For an existing service account, set `create: false` and its `name`. For
non-AWS providers, reference an existing Kubernetes Secret; do not put
credentials directly in a values file:

```yaml
extraEnv:
  - name: AWS_ACCESS_KEY_ID
    valueFrom:
      secretKeyRef:
        name: pagecourier-storage-credentials
        key: access-key-id
  - name: AWS_SECRET_ACCESS_KEY
    valueFrom:
      secretKeyRef:
        name: pagecourier-storage-credentials
        key: secret-access-key
```

`extraEnvFrom` can also reference an existing Secret or ConfigMap. Store
production values and secret references in an operator-managed file outside
source control or inject them through a secret manager. `extraEnv` cannot
override variables managed by the chart, including `NODE_ENV`, `PORT`, and the
application/storage settings.

To select an image by digest, set `image.digest` to a complete `sha256:` digest
and leave `image.tag` empty. To select a tag, set `image.tag` and leave digest
empty. The schema rejects malformed digests and simultaneous nonempty tag and
digest values. `appVersion` is the default image tag when neither is overridden.

Upgrade using the same chart version pin and values file, then inspect rollout
and application readiness:

```sh
helm upgrade pagecourier ./charts/pagecourier \
  --namespace pagecourier --values values-production.yaml
kubectl rollout status deployment/pagecourier --namespace pagecourier
kubectl get pods,service --namespace pagecourier
helm history pagecourier --namespace pagecourier
```

Rollback to a reviewed revision with
`helm rollback pagecourier <REVISION> --namespace pagecourier`. Helm rollback
does not restore deleted S3 objects or replace the operator's backup plan.
Retention is indefinite unless the bucket owner configures lifecycle expiration;
do not expire PageCourier objects. Back up the bucket and its lifecycle, access,
and encryption configuration independently of Helm release history.

### Compatibility and verification

| Component/API      | Chart target or local check                                                               | Verification status                                                               |
| ------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Kubernetes         | Chart declares Kubernetes `>=1.26`; uses `apps/v1`, core `v1`, and `networking.k8s.io/v1` | Rendered locally; no Kubernetes API server installation was run                   |
| Helm               | Chart API v2; local checks ran with Helm `v4.2.3`                                         | Lint, package, and template checks passed; Helm 3 compatibility was not exercised |
| Gateway API        | `gateway.networking.k8s.io/v1` `HTTPRoute`                                                | Template rendered; CRD/controller installation and routing were not verified      |
| Istio              | `networking.istio.io/v1` `VirtualService`                                                 | Template rendered; CRD/controller installation and routing were not verified      |
| Ingress controller | Standard `networking.k8s.io/v1` Ingress                                                   | Template rendered; controller routing was not verified                            |

These are manifest targets, not a claim of tested controller compatibility.
Actual installations and end-to-end routing verification remain outstanding;
rendering does not prove controller/API runtime compatibility. Before exposing
the application, verify the installed controller supports the selected API
version and test DNS, TLS, body-size handling, readiness, uploads and downloads.
Run `npm run helm:check` to lint, package, render all four modes, assert that
only the selected routing resource appears, and reject invalid exposure and
image settings. This check is suitable for a later CI workflow; it does not
deploy a Helm release.

### Routing troubleshooting

Start with `helm get values pagecourier --namespace pagecourier` and confirm
that the release selected the intended exposure mode, hostname, and existing
Gateway/Ingress/Istio references. Check the internal Service and ready
endpoints before debugging the external controller:

```sh
kubectl get deployment,service,endpoints pagecourier --namespace pagecourier
kubectl get pods --namespace pagecourier
kubectl describe pod -l app.kubernetes.io/instance=pagecourier --namespace pagecourier
```

For Ingress, inspect `kubectl describe ingress pagecourier -n pagecourier` and
the ingress controller's events/logs. For Gateway API, inspect the HTTPRoute
and referenced Gateway and confirm `Accepted` and `ResolvedRefs` conditions
(and listener/programmed status) are true. For Istio, inspect the
VirtualService, referenced Gateway, and Istio ingress-gateway logs. A missing
API kind usually means the selected mode's CRDs/controller are not installed;
install and verify that infrastructure before enabling the mode. If routing
works but requests fail, check DNS and TLS at the existing listener, proxy
body-size limits, forwarded origin handling, and pod readiness. Do not copy
full document URLs or IDs into shared logs or support reports.

## Document API

Submit exactly one multipart file field named `file` to `POST /documents`.
Include an `Origin` header equal to `PUBLIC_ORIGIN`, even for API clients.
Missing/null or mismatched origins are rejected. Files must have a
case-insensitive `.md` or `.markdown` extension, strict UTF-8 encoding and
non-whitespace content; MIME types are not authoritative.

```sh
curl -i -H 'Origin: http://localhost:3000' \
  -F 'file=@notes.md' http://localhost:3000/documents
```

Only a confirmed S3 write produces a 303 redirect to the canonical
`PUBLIC_ORIGIN/documents/{id}` location. Validation errors return JSON with an
`error` message (400), oversized requests/files return 413, disallowed origins
return 403, and operational storage failures return a safe 503. The document
page retrieves source on the server. `GET /documents/{id}/download` returns
the exact original bytes, including UTF-8 BOM and original line endings, with
safe attachment filenames. Malformed, missing and operator-deleted IDs return
404; permissions and storage outages are not treated as missing objects.

Pages include `noindex, nofollow` metadata and responses include non-indexing,
no-referrer, MIME-sniffing, and frame-protection headers. Document/download
responses and document errors use private, no-store caching. The content
security policy allows only same-origin application resources and HTTPS remote
images; raw HTML remains disabled and sanitized. Anyone with a document URL
can retrieve its content; do not upload secrets. There are no application
edit/delete or listing endpoints.

### Markdown rendering and sharing

Document pages render CommonMark and GitHub-flavored Markdown, including
tables, display-only task lists, strikethrough, links, lists, blockquotes, and
fenced code blocks with syntax highlighting for recognized languages. Unknown
code languages remain escaped plain code. Heading links use same-document
anchors. Raw HTML is disabled and the generated markup is sanitized.

External links support HTTP and HTTPS. Remote images load directly from their
HTTPS hosts; those hosts can observe the reader's network request and IP
address. Relative file links, local image paths, attachments, and bundled
assets are unsupported and are not routed through PageCourier. Mathematical
notation is not rendered as math.

Fenced Mermaid blocks render in the browser only when they use the supported
flowchart subset: `flowchart` with `TB`, `TD`, `BT`, `LR`, or `RL` direction,
node identifiers up to 16 ASCII letters/digits/underscores, labels, and
Mermaid's basic flowchart edges. Sequence diagrams, comments, directives,
custom styling, links, click actions, HTML, and other Mermaid syntax remain
available as source but are not rendered. Raw source remains available in an
expandable, accessible fallback; malformed diagrams show an inline error and
do not disable document actions.

Mermaid work is bounded before parsing/rendering: each diagram is limited to
4,096 UTF-8 bytes, 64 lines, 40 unique node identifiers, 60 edges, and 120
Unicode characters per label. A document renders at most 20 diagrams with at
most 16,384 UTF-8 bytes of Mermaid source in total. Mermaid is configured with
strict security, HTML labels disabled, and matching text/edge limits. The
supported syntax excludes interactive and embedded-style features; generated
SVG is checked against an SVG element/attribute allowlist before insertion.
Rendering is presentation-only and never rewrites the stored Markdown or
downloaded bytes.

Mermaid's generated SVG includes a stylesheet. The document response mirrors
SvelteKit's per-response script nonce into `style-src`, and the reader applies
that nonce to the generated SVG stylesheet. Mermaid's inline style attributes
are removed before the SVG enters the document. Runtime CSP hardening must
preserve this nonce relationship or move Mermaid styles to an allowed
stylesheet; do not add `unsafe-inline`.

Document URLs are share links, not access controls. Anyone who receives or is
forwarded a link can read and download the immutable document. Documents remain
available indefinitely unless an operator removes their storage object.

### Upload and transport limits

`UPLOAD_MAX_BYTES` applies to original file bytes, inclusive at the limit.
Multipart transport has an additional 65,536-byte allowance. The parser rejects
extra files/fields, malformed forms, filenames longer than 1,024 UTF-8 bytes,
and oversized bodies even without a truthful Content-Length. It holds only
bounded bytes in memory, never temporary document files. Parsing has a
30-second deadline; multipart header blocks are also bounded by Busboy's
16 KiB limit. Filename metadata is sanitized and limited to 180 code points.

`npm start` derives the Node adapter's `BODY_SIZE_LIMIT` from the configured
file limit plus this overhead. A runtime server hook checks all state-changing
requests against `PUBLIC_ORIGIN`, replacing SvelteKit's request-host-based
origin check so canonical submissions work behind proxies without trusting Host.
Use this startup command rather than invoking `build/index.js` directly.
Configure ingress/proxy body limits to allow at least the same transport size.
Development's `PUBLIC_ORIGIN` must match the URL used to submit uploads.

## Storage contract and operations

Objects use `<S3_KEY_PREFIX>/documents/v1/<id>` (without the extra slash for an
empty prefix). IDs are 16 cryptographically random bytes encoded as 32 lowercase
hexadecimal characters. Keys never contain uploaded paths. Each upload creates
one object whose body is the untouched original file and whose `filename`
metadata is a base64-encoded UTF-8 safe basename. Downloads use an ASCII
filename fallback and RFC 5987 `filename*` encoding.

A single `PutObject` with `If-None-Match: *` atomically saves bytes and metadata.
The service must support conditional create-only PUT semantics: a collision
must return `PreconditionFailed` rather than overwrite. The app tries at most
five fresh IDs on collisions. Conditional conflicts and other errors fail
explicitly. SDK requests allow at most three attempts with a 3-second connection
timeout and 10-second request timeout; object-body reads have a separate
10-second deadline. No local-storage fallback or deduplication exists.
An ambiguous interrupted write can leave a complete, unreachable object, but
never produces a success redirect or a partially saved document.

Provision a private bucket before starting the app. The application requires
`s3:GetObject` and `s3:PutObject` on the configured object prefix, not object
deletion. AWS additionally requires `s3:ListBucket` on the bucket to distinguish
an absent key as 404: without it, AWS may return AccessDenied for missing keys,
which the app correctly reports as an operational 503. Readiness uses
`HeadBucket`, which also requires bucket-level access. Listing is not exposed
by the application. Operators may enforce conditional writes using bucket
policies in addition to application checks; verify compatible providers support
the conditional PUT contract. The app does not require public bucket access.

Use AWS's default credential chain/workload identity. For MinIO set
`S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true`, and supply credentials externally via
the default chain (for example `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`).
Production requires HTTPS, including for MinIO; private CAs can be trusted via
Node's `NODE_EXTRA_CA_CERTS`. Do not disable certificate verification.

Retention is indefinite. Do not configure lifecycle expiration for application
objects. Operators own storage capacity, backups/restoration and direct object
deletion. Delete the document's single object using operator credentials to
make its URL return 404; no cache or application-local state retains it.
Restoring an object restores its URL. Replicas need only shared storage and the
same canonical origin. Keep credentials outside the repository and use
workload identity or an external secret provider. Terminate HTTPS at a trusted
ingress, validate forwarded host/protocol headers there, and configure ingress
and proxy access/error logs to omit document URL path segments and query
strings (or redact document IDs) just as the application does. Monitor
readiness failures and safe operational error classifications; do not enable
provider debug logging that records request URLs, headers, or object keys.

### MinIO integration tests

Against a dedicated disposable MinIO service, run:

```sh
MINIO_TEST_ENDPOINT=https://localhost:9000 \
AWS_ACCESS_KEY_ID=<test-access-key> \
AWS_SECRET_ACCESS_KEY=<test-secret-key> \
npm run test:unit
```

The tests create randomly named test buckets and clean up only their own
objects/buckets using test-admin permissions. They verify real conditional
collisions, byte preservation, independent-client retrieval and operator
deletion. Without `MINIO_TEST_ENDPOINT`, MinIO tests are explicitly skipped.
The production-adapter integration test also requires `npm run build` first
and an HTTPS MinIO endpoint; it starts isolated app instances to exercise
real multipart requests, redirects, exact-size limits and downloads.
