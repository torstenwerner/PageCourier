# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small-team members who need to share a Markdown document without asking the
uploader to register, and readers who receive its link.

## Product Purpose

PageCourier lets an uploader share a Markdown file as a readable web page
through a unique URL. Success means the reader can open the shared page without
an account and the uploader can preserve and share the original Markdown.

## Positioning

PageCourier creates an immutable document from each successful upload and
delivers it through a unique link, without uploader registration. It is intended
for trusted, operator-controlled environments serving small teams, not as an
unrestricted public anonymous upload service.

## Operating Context

Uploaders choose or drop one Markdown file and share the resulting link.
Readers open a link to read the rendered document or download its original
source. Operators provide private S3-compatible storage and run the service in
a trusted environment.

## Capabilities and Constraints

- Markdown documents are intended to render with GitHub-flavored Markdown and
  Mermaid diagrams while preserving the original file for download.
- Each successful upload creates a new immutable document. The MVP has no
  accounts, editing, uploader deletion, automatic expiration, document
  listing/search, attachments, or URL-subpath hosting.
- Persistent application state belongs in private S3-compatible storage.
- The initial application-foundation task does not yet implement upload,
  document storage, or a document-reading route.
- Node.js 24 LTS, TypeScript, SvelteKit/Svelte, the Node adapter, and
  S3-compatible storage are the confirmed implementation baseline.

## Evidence on Hand

- `PRD.md` is the accepted source of product requirements.
- No customer testimonials, benchmarks, or other external proof are available;
  future work must not fabricate them.

## Product Principles

- Sharing does not require uploader registration.
- Links identify immutable documents and can be forwarded by their recipients.
- Rendered content should be readable and accessible.
- Keep persistent state in private S3-compatible storage.
- Operate for trusted small-team environments, not unrestricted public uploads.

## Accessibility & Inclusion

Target WCAG 2.2 AA for application-owned controls and layout. Support keyboard
operation, visible focus, labeled controls, readable contrast, and assistive
technology announcements for status feedback.
