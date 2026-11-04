# Implementation review: configurable Helm chart

## Summary

Reviewed the working-tree changes against `origin/main` (merge base
`11ae33b08010e7ad915ad8d4b362d8079a82489c`), including the newly added,
untracked chart files. No code correctness, security, or performance defects
were identified in the chart implementation.

The chart provides an always-on Deployment and ClusterIP Service and selects
at most one optional exposure resource through `exposure.mode`. External
storage and credentials remain operator-managed. Chart defaults enforce a
non-root process, read-only root filesystem, dropped Linux capabilities,
disabled privilege escalation, an explicit writable `/tmp`, and disabled
default service-account token automounting. The Gateway route always matches
the application root path; chart-managed environment variables cannot be
overridden through `extraEnv`.

## Findings

No actionable code findings.

## Requirements and regression review

- `charts/pagecourier/templates/` always renders a Deployment and ClusterIP
  Service and conditionally renders only the selected Ingress, HTTPRoute, or
  VirtualService. `none` produces no routing resource.
- `values.schema.json` constrains the four mode values, validates the selected
  mode's required hosts/references, and prevents simultaneous image tag and
  digest selection. Templates provide actionable required-value errors.
- Image defaults use chart `appVersion`; validation compares packaged chart
  `appVersion` with the application package version.
- Application/storage settings, custom service account annotations, pod
  annotations, image pull secrets, resources, security contexts, probes,
  environment variables, and existing Secret references are configurable.
- Four exposure examples and separate workload-identity and external-Secret
  examples contain no real credentials.
- `README.md` documents local/OCI chart consumption, installation, upgrade and
  rollback, external storage, workload identity, existing Secret references,
  TLS/DNS/controller prerequisites, resources, probes, retention/backups, and
  routing troubleshooting.
- The change adds no application runtime code or new package dependencies.

## Security and performance

The chart does not create storage services, CRDs, controllers, gateways,
certificates, RBAC roles, or public-facing Service types. Secret examples use
`valueFrom.secretKeyRef`; documentation warns against committing credentials.
The default container security posture and least-privilege token setting reduce
pod and Kubernetes API exposure. Operators can still deliberately customize
security contexts, routing annotations, and environment values; those settings
remain deployment-owner responsibilities.

Two replicas are the default and share state through external storage. CPU and
memory requests/limits, probes, upload size, and port are configurable.
Readiness performs the application's bounded storage check at the configured
probe cadence; liveness remains independent of storage. No deployment
performance or controller-throughput measurements were made.

The dependency installation emitted npm's audit summary of 17 advisories (4
low, 13 moderate). No dependency or lockfile change was made for this work, and
the advisory details were not investigated as part of this chart review.

## Verification

| Check                | Result                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run helm:check` | Passed: Helm lint, package, four mode renders, resource selection, image metadata/tag/digest checks, workload identity and Secret examples, invalid exposure settings, and reserved environment-variable rejection |
| `npm run lint`       | Passed: Prettier and ESLint                                                                                                                                                                                        |
| `npm run check`      | Passed: Svelte/TypeScript checks; zero diagnostics                                                                                                                                                                 |
| `npm run test:unit`  | Passed: 88 tests; 2 skipped across 10 test files                                                                                                                                                                   |
| `git diff --check`   | Passed                                                                                                                                                                                                             |

Helm `v4.2.3` was used for local validation. The chart declares Kubernetes
`>=1.26`; the local `kubectl` was client-only `v1.35.2`. No Kubernetes API
server was used.

## Outstanding verification and follow-up

Actual Ingress, Gateway API, and Istio controller installations and end-to-end
routing were not tested, as explicitly selected for this pass. The README
states that these API/controller combinations are unverified and does not
claim runtime compatibility. The issue's installation-verification
acceptance criterion remains open until a suitable cluster is used.

Possible follow-up approaches:

| Option                                                                          | Pros                                                         | Cons                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Verify on an operator-provided cluster with the intended controllers            | Most representative of the target installation               | Requires access to suitable infrastructure and coordinated maintenance windows     |
| Use disposable clusters with pinned ingress, Gateway API, and Istio controllers | Repeatable integration evidence and isolated from production | Requires cluster provisioning and maintaining controller test versions             |
| Keep compatibility claims limited to the rendered API manifests                 | Avoids unsupported claims or cluster access                  | Leaves runtime routing compatibility unverified and the acceptance gate incomplete |

`npm run helm:check` is available for CI, but this repository has no existing
workflow files, so the command is not yet a CI gate. The next chart-publishing
workflow task can wire it into pull-request validation; alternatively, a
standalone validation workflow could be added, at the cost of possible
duplication with that work.

The requested `glab ci status` check could not run because no configured Git
remote points to GitLab; the only remote is GitHub. `gh workflow list` and
`gh run list` returned no workflow/run entries, so no pipeline status was
available to report.
