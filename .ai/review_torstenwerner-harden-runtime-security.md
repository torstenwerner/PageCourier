# Runtime security and operations review

## Scope and comparison

Reviewed the implementation of torstenwerner/PageCourier#6 against `main` (merge base `37a724f1f2efc3e3d7bd17461ab9635937b9db4a`). The review covered response and CSP headers, origin handling, health routes, diagnostics, storage readiness, shutdown cleanup, operator guidance, tests, and runtime/performance implications.

## Implementation assessment

- Application and document responses now carry non-indexing, no-referrer, MIME-sniffing, and frame-protection headers. Document pages, downloads, and their error responses remain `private, no-store`; robots metadata is global and `robots.txt` remains restrictive.
- CSP retains the existing nonce behavior for Mermaid styles, adds same-origin form submissions, and permits HTTPS remote images. The Markdown renderer continues to remove HTTP, relative, and data image URLs.
- State-changing requests still require the configured `PUBLIC_ORIGIN`. Canonical share URLs are produced from configuration rather than the incoming Host header; HSTS is sent only for the configured canonical HTTPS origin.
- `/health/live` does not access storage. `/health/ready` performs one bounded, non-writing `HeadBucket` request and reports storage failures as 503 without provider details.
- Structured JSON application events include only safe operation/classification and route-template/method/status fields. Storage errors are reduced to allow-listed classifications; document content, IDs, full share URLs, credentials, and raw provider messages are not emitted.
- The adapter-node server already drains active requests, closes idle connections, and enforces a shutdown timeout on SIGINT/SIGTERM. The application now destroys its S3 client after the adapter's shutdown event.
- Upload parsing and storage reads remain bounded and in-memory; no temporary document files or replica-local state were added. Readiness adds one bounded S3 request per probe; default INFO request logging adds one small structured record per application response and can be reduced with `LOG_LEVEL`.

## Findings

No correctness, security, regression, or performance findings requiring changes were identified.

## Readability and follow-up

The new health routes are small, and logging uses typed operation/classification values with an allow-listed context shape. Keep future diagnostic fields limited to route templates and safe classifications; do not add raw request URLs, document IDs, or provider messages.

## Validation and CI

- `npm test` — passed: 74 unit tests and 9 Chromium browser tests; 2 optional MinIO TLS integration tests were skipped because the MinIO test endpoint was not configured.
- `npm run check` — passed with no Svelte or TypeScript diagnostics.
- `npm run lint` — passed.
- `npm audit --omit=dev` — 0 production dependency vulnerabilities. `npm ci` reported 17 advisories in the full dependency tree (4 low, 13 moderate); no dependency manifests were changed in this task.
- The browser build reported a large-chunk advisory (>500 kB); this change adds no runtime dependency or bundled rendering library.
- No GitHub Actions workflow or GitLab CI configuration is present in this repository, so there is no GitLab pipeline status to report.
