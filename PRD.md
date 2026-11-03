# PageCourier Product Requirements Document

## 1. Product overview

PageCourier is a web application for uploading a Markdown file and sharing its
rendered content through a unique URL. Uploads are persisted in private,
S3-compatible object storage. Each successful upload creates a new, immutable
document and redirects the uploader to its document page.

- Source repository: <https://github.com/torstenwerner/PageCourier>
- License: MIT.
- Target release: initial minimum viable product (MVP).
- Intended deployment: trusted, operator-controlled environments serving small
  teams, not an unrestricted public anonymous upload service.
- Requirements status: MVP scope confirmed through a requirements interview.

This document defines the product and implementation acceptance criteria; it
does not constitute an implementation.

## 2. Goals and scope

### Goals

- Make sharing a Markdown file possible without registration or configuration
  by the uploader.
- Provide readable, accessible rendering with GitHub-flavored Markdown and
  Mermaid diagrams.
- Preserve the original uploaded file for download.
- Keep persistent application state entirely in S3-compatible storage.
- Make local container testing and Kubernetes deployment straightforward.
- Publish container images and an OCI Helm chart through GitHub Actions.

### Non-goals

The MVP does not include accounts, authentication, authorization, a Markdown
editor, editing existing documents, uploader-controlled deletion, deletion
tokens, automatic expiration, document listing/search, attachments, bundled
images, mathematical notation, localization, theme selection, or URL-subpath
hosting.

Public-service abuse management, quotas, CAPTCHA, billing, and a hosted-service
availability SLA are outside scope. An operator must not interpret this MVP as
ready for unrestricted public anonymous uploads.

## 3. User stories

| ID | User story |
| --- | --- |
| US-01 | As an uploader, I can select or drag a Markdown file onto the start page so that I can share it without creating an account. |
| US-02 | As an uploader, I am redirected to a unique document URL only after my file has been persisted successfully. |
| US-03 | As a reader with the URL, I can view a rendered document, including tables, highlighted code, and supported Mermaid diagrams. |
| US-04 | As a reader, I can copy the document URL and receive clear feedback about whether copying succeeded. |
| US-05 | As a reader, I can download the original Markdown file rather than an HTML conversion or rewritten source. |
| US-06 | As a reader, I can upload another file from the document page and receive a new URL without changing the existing document. |
| US-07 | As an operator, I can run the application and MinIO locally using Docker Compose. |
| US-08 | As an operator, I can install a configurable Helm chart against existing S3-compatible storage and my chosen routing infrastructure. |
| US-09 | As a maintainer, I can validate changes and publish versioned artifacts through GitHub Actions without deploying a Helm release. |

## 4. Functional requirements

### FR-01: Start page and uploading

- The start page must provide a file picker and drag-and-drop upload area.
- One file is uploaded per operation. Batch uploads are out of scope.
- Accept `.md` and `.markdown` extensions, case-insensitively, containing valid
  UTF-8 text. Do not rely solely on browser-provided MIME types.
- Reject zero-byte files and files consisting only of whitespace after decoding.
- The maximum original file size must be configurable, defaulting to 5 MiB
  (5,242,880 bytes). Upload transport/body limits must account for multipart
  overhead while enforcing this exact file-byte limit.
- Enforce validation server-side; client-side validation is supplementary.
- Show supported formats, the effective size limit, and a warning that share
  links can be forwarded and secrets must not be uploaded.
- Expose a visible upload-in-progress/busy state and prevent accidental duplicate
  submission while an upload is pending. A percentage indicator is not required.
- Validation and storage errors must be actionable and must not redirect to a
  success page or claim that a document was saved.
- Navigating to an upload control from a document page must provide the same
  upload behavior and validation as the start page.

### FR-02: Persistence, identity, and URLs

- Use private S3-compatible storage as the only persistent application datastore.
  No database is required.
- The SvelteKit server must receive and validate uploads, write objects, retrieve
  source content for rendering, and serve downloads. Browsers must not receive
  storage credentials or require direct S3 access.
- Each accepted upload must receive a server-generated, cryptographically random
  identifier with at least 128 bits of entropy and an application URL such as
  `/documents/{id}`. IDs must not be sequential or derived from filenames.
- Every upload creates a new document, even if its bytes or filename match an
  existing upload. Do not deduplicate documents or overwrite existing objects;
  enforce create-only writes and retry with a new ID on a collision.
- Persist original file bytes and the metadata needed to retrieve the document
  and download it with a safe filename. Object keys must not use user-controlled
  paths. A single upload must not expose a partially saved document.
- Redirect to the new document URL only after storage confirms a successful
  write.
- Successful uploads must remain accessible after app/container restarts and
  through other application replicas.
- Documents are immutable through the application and retained indefinitely.
  There is no application expiration or deletion endpoint.
- An operator can delete an object directly in storage. Its document URL must
  subsequently return a not-found response.
- Configure and document a canonical public application origin for share URLs
  and redirects behind proxies. Hosting is at the origin root, not a subpath.

### FR-03: Document rendering

- Display a readable document page with a title derived from the first non-empty
  Markdown heading, falling back to the uploaded filename. Treat the title as
  text, not executable markup.
- Support CommonMark and GitHub-flavored Markdown: tables, task lists,
  strikethrough, links, lists, blockquotes, and fenced code blocks.
- Task-list checkboxes are display-only; interacting with a page must not modify
  the stored source.
- Provide syntax highlighting for recognized fenced-code languages. Unknown
  languages must render safely as ordinary code.
- Disable embedded raw HTML. Sanitize generated markup, validate URL schemes,
  and prevent uploaded content from executing scripts.
- Support safe external HTTP/HTTPS links and same-document heading anchors.
  Embedded remote images must use HTTPS and load directly from their hosts;
  an image proxy is not required.
- Relative file links, local image paths, attachments, and bundled assets are
  unsupported. They must not be interpreted as privileged application routes.
  Document this limitation and the privacy implications of remote images.
- Mathematical notation is not rendered as math.
- Long code blocks and tables must remain usable on narrow screens without
  forcing the entire page beyond the viewport.

### FR-04: Mermaid diagrams

- Recognize fenced `mermaid` blocks and render diagrams in the browser.
- Enable Mermaid's strict security mode; disable embedded HTML labels and
  clickable diagram actions. Never relax security to make a diagram render.
- Bound source size, diagram complexity, and rendering work. Exact supported
  limits must be documented and tested during implementation.
- An invalid, unsupported, or over-limit diagram must show an inline error and
  accessible source/fallback without breaking the rest of the document.
- A render failure must not change the stored Markdown or downloaded bytes.
- If the rendering library cannot safely bound execution, isolate rendering in
  a cancellable execution context rather than accepting unbounded main-thread
  work.

### FR-05: Document actions

Each document page must provide:

| Action | Required behavior |
| --- | --- |
| Copy URL | Copy the canonical document URL with explicit success/failure feedback. If clipboard access is unavailable or denied, expose a selectable URL and instructions for manual copying. |
| Download Markdown | Download the exact original bytes, using a safe form of the original filename and attachment response headers. |
| Upload another file | Open an upload flow with the same rules as the start page; successful upload redirects to a new URL and leaves the previous document untouched. |

### FR-06: Error behavior

- Invalid uploads must produce clear client-visible validation errors.
- Missing, malformed, or operator-deleted document IDs must return a not-found
  response without disclosing storage details.
- S3 outages, access failures, and other operational errors must not masquerade
  as not-found responses. Show a temporary failure state and log diagnostic
  context without secrets or document content.
- A failed upload must leave the existing document page and its document intact.
- A failed download or copy action must not report success.
- Errors must not expose credentials, internal endpoints, stack traces, or raw
  storage-provider responses to readers.

## 5. Technology stack

Use maintained, stable versions at implementation time and commit dependency
lockfiles. Do not couple the PRD to transient version numbers.

| Layer | Requirement / implementation baseline |
| --- | --- |
| Language | TypeScript throughout application frontend, server, and test code. |
| Web framework | SvelteKit with Svelte and the Node adapter, running on an active Node.js LTS release. SvelteKit server routes/actions provide the backend; a separate API service is unnecessary. |
| Markdown | An established CommonMark/GFM parser and sanitizer, with syntax highlighting; a unified/remark/rehype pipeline is a suitable baseline. |
| Diagrams | Mermaid, configured to meet FR-04. |
| Object storage | AWS SDK for JavaScript v3 S3 client, supporting AWS S3 and compatible services such as MinIO. |
| Unit/integration tests | Vitest or the established equivalent selected during implementation. |
| Browser tests | Playwright, Chromium only for the MVP. |
| Packaging | Production OCI container image and Helm chart. |
| Local orchestration | Docker Compose with the production application image and MinIO. |
| CI and registry | GitHub Actions and GitHub Container Registry (GHCR). |

## 6. Non-functional requirements

### NFR-01: Security and privacy

- No application login is required for uploading, reading, or downloading.
  Anyone possessing a document URL can access and forward it; unguessable links
  are not authentication or a confidentiality guarantee.
- Mark application pages as non-indexable and provide a restrictive `robots.txt`.
  These are advisory measures, not access controls.
- Document/download responses must use private, no-store caching directives.
  Operator deletion must not be defeated by an application or shared cache.
- Use a no-referrer policy to avoid disclosing document URLs to external sites
  and image hosts. Remote image hosts still receive the reader's IP address.
- Apply appropriate browser security headers, including a content security
  policy compatible with safe Markdown and Mermaid rendering.
- Reject unsafe URL schemes, path traversal attempts, header injection through
  filenames, and upload requests from disallowed origins.
- Bound request sizes and expensive rendering operations. A valid 5 MiB source
  file must not imply permission for unbounded diagram rendering.
- Keep buckets private and grant application credentials only the required
  object read/write permissions. The app does not require object deletion.
- Keep secrets out of source, images, chart defaults, logs, and published
  artifacts. Production credentials must be supplied externally.

### NFR-02: Usability and accessibility

- Provide a responsive English-only interface suitable for desktop and mobile.
- Target WCAG 2.2 AA for application-owned controls, layout, and status feedback.
  Uploaded author content may itself be inaccessible.
- Support keyboard operation, visible focus, labeled inputs/buttons, readable
  contrast, and assistive-technology announcements for upload and copy results.
- Provide readable typography and an accessible fallback for failed diagrams.

### NFR-03: Reliability and scalability

- Keep replicas stateless; do not require local disk persistence or sticky
  sessions. Temporary buffers must be bounded and cleaned up.
- Allow horizontal scaling against the same bucket and canonical origin.
- Set explicit storage request timeouts and bounded retries. Do not silently
  fall back to local storage.
- No numeric throughput, latency, or availability SLA is committed for the MVP.
  The design targets small-team use and must avoid obvious unbounded resource
  consumption.
- Indefinite retention depends on operator bucket configuration: lifecycle
  policies must not automatically expire application objects.

### NFR-04: Operations

- Run the container as non-root, support a read-only root filesystem with
  explicitly mounted temporary storage where needed, and avoid privileged mode.
- Provide separate liveness and readiness endpoints. Liveness must not depend
  on S3; readiness must report required storage/configuration failures using
  bounded checks without creating test objects on each probe.
- Emit structured logs useful for diagnosis without document content,
  credentials, or full share URLs/identifiers. Operators must apply equivalent
  redaction to ingress/proxy access logs.
- Support graceful shutdown and configurable Kubernetes resource requests and
  limits.
- Operators own TLS, storage capacity/cost, backups/restoration, network access,
  monitoring, incident response, and infrastructure availability.

## 7. Configuration

Document configuration names, defaults, validation, and examples during
implementation. At minimum, support:

| Area | Required configuration |
| --- | --- |
| Application | Canonical public origin, listen address/port, upload size limit, log level. |
| Storage | Bucket, region, optional custom endpoint, path-style addressing, and optional key prefix for deployment isolation. |
| Credentials | AWS default credential-provider chain/workload identity or credentials injected from an existing Kubernetes Secret. |
| Helm runtime | Image repository/tag or digest, replicas, resources, security contexts, probes, service account, pod annotations, and environment/Secret references. |
| Routing | Exposure mode, hostname, annotations where supported, existing gateway references, and mode-appropriate TLS settings. |

Validate required configuration before serving traffic. AWS endpoints and
virtual-host addressing must work with defaults; MinIO must work with a custom
endpoint and path-style addressing. Local development may use HTTP to MinIO
inside its local container network; production storage transport must use HTTPS.

## 8. Local development and container strategy

- Provide a reproducible multi-stage build that produces a minimal production
  image, excluding development dependencies and build credentials.
- Build images for `linux/amd64` and `linux/arm64`.
- Docker Compose must run that production image with MinIO, persist local objects
  in a named volume, and provision a development bucket automatically.
- Local credentials must be explicitly development-only and must not become
  production defaults.
- Provide documented commands for starting the stack, running checks/tests,
  rebuilding the app image, and deliberately cleaning local persisted data.
- The local Compose stack is not a production deployment template.

## 9. Kubernetes and Helm strategy

The Helm chart deploys the application, not an S3 service. It must reference an
existing external S3-compatible bucket and must not install MinIO, infrastructure
controllers, CRDs, certificates, or gateway resources.

The chart must always create an application Deployment and ClusterIP Service.
Support exactly one exposure mode per release:

| Mode | Resources and behavior |
| --- | --- |
| `none` (default) | No external routing resource; retain the internal Service. |
| `ingress` | Standard Kubernetes Ingress with configurable class, hosts, annotations, and existing TLS Secret references. |
| `gateway` | Gateway API HTTPRoute referencing an existing Gateway, with configurable parent references, hostnames, and matching/attachment settings. TLS belongs to the existing Gateway. |
| `istio` | Istio VirtualService with configurable hosts and references to existing Istio gateways. TLS belongs to existing infrastructure. |

- Host the application at `/`; configurable subpath deployment is out of scope.
- Validate exposure values and fail clearly for invalid or contradictory
  configuration.
- Document the tested Kubernetes, Helm, Gateway API, and Istio compatibility
  matrix and required preinstalled API versions during implementation.
- Templates must not require Gateway API or Istio CRDs when those modes are
  disabled.
- Support AWS workload identity through configurable service accounts and
  annotations, as well as existing Secret references for compatible providers.
- Provide example values for all modes without embedding real credentials.
- Installing and upgrading releases is an operator action outside GitHub
  Actions. No CI deployment job, cluster credentials, or automatic rollout is
  part of this project.

## 10. GitHub Actions and GHCR publishing

### Pull requests

- Build the application and test the production container.
- Run static checks, unit/integration tests, and Playwright acceptance tests.
- Lint/package the Helm chart and render every exposure mode.
- Do not publish images or charts, and do not expose publish credentials to
  untrusted pull request code.

### Main branch

- Run required validation before publishing development artifacts.
- Publish both the container image and OCI Helm chart to GHCR.
- Use commit-identifiable image tags and unique SemVer-compatible development
  chart versions. Record the exact corresponding image version in each chart.

### Version tags

- Tags such as `v1.2.3` publish image version `1.2.3` and OCI chart version
  `1.2.3` after required validation succeeds.
- Release images must include both supported architectures in a multi-platform
  manifest. The chart must reference the corresponding image version.
- Do not silently replace an existing release version with different content.

### Artifact distribution

- Intended package locations are `ghcr.io/torstenwerner/pagecourier` for the
  container and `oci://ghcr.io/torstenwerner/charts/pagecourier` for the chart.
- Both packages must be public and linked to the public source repository.
  Initial package visibility/permissions may require a repository-owner action.
- Use appropriately scoped GitHub Actions permissions and registry
  authentication; never commit registry tokens.
- Publish source, version, revision, and MIT license metadata with the image and
  equivalent metadata with the chart.
- GitHub Actions builds, tests, packages, and publishes only. Deployment,
  installation, upgrades, and rollback remain outside these workflows.

## 11. Acceptance criteria and testing

CI acceptance tests must exercise the built production container against MinIO,
not only a development server or mocked storage.

| ID | Acceptance criterion |
| --- | --- |
| AC-01 | Uploading a valid Markdown file from the start page persists it and redirects to a document URL that renders its content. |
| AC-02 | Uploading another file from a document page creates a different URL; both original and new documents remain unchanged and accessible. |
| AC-03 | Uploading identical bytes with the same filename twice still creates distinct URLs. |
| AC-04 | A document remains readable and downloadable after restarting/replacing the application container, and a second app instance can retrieve it. |
| AC-05 | Downloads match uploaded bytes exactly, including line endings and any UTF-8 byte-order mark, and use safe attachment filenames. |
| AC-06 | Copy URL copies the canonical URL in Chromium where clipboard access is available; denied/unavailable access produces honest feedback and a manual-copy fallback. |
| AC-07 | CommonMark/GFM examples, heading anchors, and recognized/unknown code languages render correctly. |
| AC-08 | Valid Mermaid diagrams render; malformed and over-limit examples fail inline without preventing normal document use. |
| AC-09 | Raw HTML, script payloads, unsafe links, and Mermaid actions cannot execute uploaded code. |
| AC-10 | Zero-byte/whitespace-only files, invalid UTF-8, and unsupported extensions are rejected. A valid file at the configured size limit is accepted; one byte above is rejected, including when client checks are bypassed. |
| AC-11 | Missing/deleted IDs return not found; storage outages return operational errors rather than false success or false not-found responses. |
| AC-12 | Remote HTTPS images work; unsupported relative resources and disallowed URL schemes cannot resolve into privileged app behavior. |
| AC-13 | Upload/action controls work using a keyboard and at mobile viewport sizes, with accessible feedback for errors and status changes. |
| AC-14 | Chart linting and rendering succeed for all four exposure modes; only the selected routing resource appears, and `none` needs no optional CRDs. |
| AC-15 | Invalid chart exposure configuration fails clearly, and chart versions reference their matching image versions. |
| AC-16 | Compose provisions usable local storage; published release image manifests contain both required CPU architectures. |
| AC-17 | A deliberately simulated ID collision cannot overwrite an existing object; a new identifier is generated instead. |
| AC-18 | Document/download responses use required caching, indexing, referrer, and security headers; application logs do not disclose document content or full share URLs. |

Use TypeScript checks, linting, and unit/integration tests for validation,
identifier generation, storage behavior, rendering safety, errors, and
configuration. Use Playwright with Chromium for user-visible journeys.
Firefox and WebKit automation are deferred, not claimed as MVP release gates.

Helm rendering is a required CI gate. Before claiming support for a routing
integration, verify an installation against its documented controller/API
versions outside the GitHub Actions deployment pipeline.

## 12. Assumptions and dependencies

- Uploaders and readers belong to a trusted deployment context. The absence of
  accounts does not eliminate storage abuse or content risk.
- Operators provide a private bucket, sufficient storage permissions, suitable
  network access, and retention policies consistent with indefinite retention.
- Target S3-compatible services support required read/write and create-only
  object semantics. Compatibility must be verified, not inferred from branding.
- Share URLs depend on a stable public origin. Moving domains requires the
  operator to preserve redirects or accept broken historical links.
- Clipboard APIs normally require a secure context; production uses HTTPS.
- Remote images depend on third-party availability and privacy practices.
- Mermaid and Markdown dependencies must remain maintained and receive security
  updates; rendering support is constrained by the documented safety limits.
- Kubernetes operators supply any required ingress controller, Gateway API or
  Istio CRDs/controllers, gateways, DNS, TLS certificates, and Secrets.
- GitHub Actions and GHCR must be enabled, and maintainers must have permission
  to publish public container and Helm packages.
- The MIT license text and project documentation must be present in the
  implemented repository; third-party licenses and notices remain applicable.

## 13. Required implementation documentation

The implementation must include operator and contributor documentation covering
local startup, configuration, file/rendering limits, supported Markdown and
Mermaid behavior, security/privacy limitations, storage permissions and
retention, deletion through storage, backups, GHCR artifact consumption, all
four Helm exposure examples, and manual install/upgrade/rollback procedures.

The MVP is complete when these requirements and acceptance criteria are met,
artifacts are available in GHCR, and the documented deployment path has been
verified. Creating this PRD alone does not satisfy those implementation gates.
