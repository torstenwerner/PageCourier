# Accessible Markdown Experience: Implementation Review

## Scope and verdict

Reviewed the uncommitted worktree against `origin/main` (the user was unavailable to select a base branch, so the repository's mainline was used). The implementation addresses issue #4: accessible Markdown upload, reading, and link sharing. Mermaid remains deferred as required.

**Verdict:** no unresolved blocking or major correctness/security findings. Two edge cases found during review were fixed and covered by regression tests.

## Findings

No unresolved P0, P1, P2, or P3 findings.

### Resolved during review

1. **[P2, fixed] Long fallback titles could overflow narrow screens.** When Markdown had no heading, the reader used the uploaded filename as its page heading; an unbroken filename could force horizontal scrolling. Added `overflow-wrap: anywhere` to the fallback heading and a 390px Playwright regression test. Wrapping preserves the complete filename; truncation would avoid overflow but hide part of the document title.
2. **[P2, fixed] Nested headings were omitted from title and H1 detection.** Heading discovery only inspected root-level Markdown nodes, so a valid heading inside a blockquote could produce a filename title and an unnecessary fallback H1. The renderer now visits headings recursively and has a unit test for a quoted H1. Restricting detection to root-level headings would be simpler, but would disagree with the rendered document structure.

## Requirements and implementation

- The home page preserves PageCourier's editorial introduction and route illustration while making the labeled, keyboard-operable file picker/drop target and upload action primary.
- Upload validation remains server-authoritative: one `.md`/`.markdown` file, bounded bytes, strict UTF-8, non-empty content, and an exact configured-origin check. A document URL is returned only after immutable storage succeeds; failures are announced without replacing the current page.
- The reader renders CommonMark/GFM on the server, derives a plain-text title/description, adds heading anchors, and exposes canonical metadata, copy-link with a manual-copy fallback, exact original download, and upload-another.
- Raw HTML is disabled; rendered markup is sanitized. Links are limited to HTTP(S), remote images to HTTPS, and unsupported relative resources do not route through application endpoints. Mermaid, math, relative images, attachments, and editing remain explicitly out of scope.
- README and surface/design documentation describe the sharing model, privacy limitations, supported Markdown, and the reader's typography/syntax-color tokens.

## Security and privacy

No exploitable vulnerability was identified in the changed code. Markdown output is server-rendered through a sanitizer with a constrained schema; unsafe URL schemes and credentials are rejected, same-document links are remapped to sanitized heading IDs, and metadata values are escaped by Svelte. Upload size, origin, filename, encoding, and multipart limits are checked before storage. Document and download responses are `private, no-store` and `no-referrer`.

The intentional bearer-link model is not access control: anyone with a document URL can read and download it. HTTPS remote images cause the image host to receive a reader's network request and IP address. Both limitations are documented. `npm audit --omit=dev` reported zero production dependency vulnerabilities; the earlier full-tree audit reported 17 findings in the installed dependency tree, which were not auto-fixed.

## Performance and operations

Each document page request reads the bounded object from S3 and renders it synchronously; the default upload limit is 5 MiB. This keeps memory/work per document bounded and is appropriate for the documented trusted small-team deployment, but repeated reads and rendering can become a throughput cost at higher traffic. A bounded cache could reduce that work because documents are immutable, but would add memory limits and invalidation/operations concerns; it is not required for this scope. Storage and upload deadlines remain enforced by the existing runtime.

## Verification

| Check                     | Result                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`           | Passed; zero Svelte/TypeScript diagnostics                                                                                                                           |
| `npm run test:unit`       | Passed; 58 passed, 2 skipped (optional MinIO integration tests)                                                                                                      |
| `npm run test:e2e`        | Passed; 6 browser journeys, including mobile overflow and upload failure/retry                                                                                       |
| Build                     | Passed as part of the Playwright web-server startup                                                                                                                  |
| `npx eslint .`            | Passed                                                                                                                                                               |
| Prettier on changed files | Passed                                                                                                                                                               |
| Impeccable detector       | No findings after documenting the reader type scale and code tokens                                                                                                  |
| `npm audit --omit=dev`    | Zero production vulnerabilities                                                                                                                                      |
| `npm run lint`            | Repository-wide Prettier check is blocked by seven pre-existing, untouched `.agents/skills/playwright-cli` Markdown files; all changed files pass the targeted check |

No GitLab CI run applies to this GitHub-backed repository, and these worktree changes are not associated with a pushed commit or pull request.

## UI quality audit

| Dimension                |     Score | Evidence                                                                                                                                                                         |
| ------------------------ | --------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            |       3/4 | Native labeled controls, skip links, visible focus, live status/error feedback, and keyboard/browser coverage. No dedicated screen-reader or automated contrast suite was added. |
| Performance              |       3/4 | Bounded uploads and server reads; per-request storage fetch and rendering may cost more under higher concurrency.                                                                |
| Responsive design        |       3/4 | Home/reader breakpoints, scrollable wide tables/code, and mobile no-overflow journeys; only representative browser widths are covered.                                           |
| Theming                  |       3/4 | Shared PageCourier palette and typography are documented; syntax colors are now explicit tokens.                                                                                 |
| Implementation integrity |       4/4 | Product-specific visual direction is preserved, required states and actions are functional, and the final design detector is clean.                                              |
| **Total**                | **16/20** | **Good**                                                                                                                                                                         |

**Integrity verdict:** the implementation expresses the established PageCourier identity rather than replacing it with a generic upload form. The reader extends the same colors, sans-serif system, fine rules, and flat surfaces; monospace and additional syntax accents are limited to code where they improve reading.

## Optional follow-up

If usage grows beyond the intended small-team deployment, measure document-page latency and concurrency before adding a bounded cache or rendering queue. The current implementation does not need an immediate follow-up change.
