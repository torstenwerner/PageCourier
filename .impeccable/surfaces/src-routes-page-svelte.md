---
version: 1
slug: 'src-routes-page-svelte'
primary_target: 'src/routes/+page.svelte'
related_targets: ['src/routes/documents/[id]/+page.svelte']
---

## Scope and visitor mode

The PageCourier start page introduces the service and lets a visitor upload one Markdown file. Operate: the primary task is choosing or dropping a file and sharing its resulting page.

## Audience and task

Small-team members need to turn one Markdown file into an immutable readable page without registering. The reader receives a unique URL and can copy it or download the original file.

## Content and constraints

Keep the established PageCourier identity, headline, file-to-link illustration, and accessible GitHub project link. Show supported `.md` and `.markdown` formats, the effective size limit, and the warning that share links can be forwarded and secrets must not be uploaded. Preserve single-file upload, server validation, and redirect only after storage succeeds. Mermaid rendering is deferred.

## Chosen direction and memorable moment

Use the mineral-green canvas, ink-navy text and diagram, signal-lime route marks, precise sans typography, and fine separators. Keep the introduction at left and the file-to-link diagram at right on wide screens; the upload drop target and primary action follow the lead copy. Stack them naturally on narrow screens. The memorable moment is choosing one file as the route diagram becomes an actual upload task.

## Unresolved decisions

The document reader uses the same identity and exposes copy, original download, and upload-another actions. Mermaid support remains a follow-up; raw HTML and unsupported relative resources are not rendered as application routes.
