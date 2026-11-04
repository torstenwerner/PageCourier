# PageCourier

PageCourier is a web application for sharing rendered Markdown through a
unique link. The server stores immutable uploads in private S3-compatible
storage and serves readable document pages, canonical share links, and exact
original downloads.

## Requirements

- Node.js 24 LTS and npm
- Playwright's Chromium browser to run browser tests

Use `nvm use` to select the Node version from `.nvmrc`, then install the locked
dependencies:

```sh
npm ci
```

## Configuration

Development starts with safe local defaults. Copy `.env.example` to `.env` to
override them. SvelteKit loads `.env` for development; never put credentials in
the example file or client-side code.

| Variable              | Required   | Default                   | Description                                                                                                  |
| --------------------- | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_ORIGIN`       | Production | `http://localhost:<PORT>` | Canonical HTTP(S) origin used for public links. It must not include a path, query, fragment, or credentials. |
| `HOST`                | No         | `0.0.0.0`                 | Address on which the Node server listens.                                                                    |
| `PORT`                | No         | `3000`                    | Listen port, from 1 through 65,535.                                                                          |
| `UPLOAD_MAX_BYTES`    | No         | `5242880`                 | Positive, safe-integer upload limit in bytes (5 MiB by default).                                             |
| `LOG_LEVEL`           | No         | `info`                    | Minimum structured application log level: `trace`, `debug`, `info`, `warn`, `error`, or `fatal`.             |
| `S3_BUCKET`           | Production | `pagecourier-development` | S3-compatible bucket name.                                                                                   |
| `AWS_REGION`          | Production | `us-east-1`               | AWS region for the bucket.                                                                                   |
| `S3_ENDPOINT`         | No         | unset                     | Optional custom HTTP(S) endpoint; production endpoints must use HTTPS.                                       |
| `S3_FORCE_PATH_STYLE` | No         | `false`                   | Whether to use path-style S3 addressing. Must be `true` or `false`.                                          |
| `S3_KEY_PREFIX`       | No         | empty                     | Optional key prefix, without a leading slash or `..` path segment.                                           |

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
npm test                  # Unit and browser tests
npm run build             # Production build
```

The browser suite uses an isolated local S3-protocol test server; no external
storage service or credentials are required. Unit tests include deterministic
multipart, collision, storage-failure, rendering-safety and route coverage.

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
