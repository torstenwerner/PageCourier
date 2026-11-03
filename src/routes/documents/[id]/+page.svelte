<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import StatusMessage from '../../../lib/components/StatusMessage.svelte';
	import UploadForm from '../../../lib/components/UploadForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let copied = $state(false);
	let copyFailed = $state(false);
	let shareUrlInput = $state<HTMLInputElement>();

	async function copyUrl() {
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
			await navigator.clipboard.writeText(data.canonicalUrl);
			copied = true;
			copyFailed = false;
		} catch {
			copied = false;
			copyFailed = true;
			await tick();
			shareUrlInput?.focus();
			shareUrlInput?.select();
		}
	}

	function selectShareUrl() {
		shareUrlInput?.select();
	}
</script>

<svelte:head>
	<title>{data.title} — PageCourier</title>
	<meta name="description" content={data.description} />
	<meta property="og:title" content={data.title} />
	<meta property="og:description" content={data.description} />
	<meta property="og:url" content={data.canonicalUrl} />
	<meta property="og:type" content="article" />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>

<a class="skip-link" href="#document-main">Skip to document</a>

<div class="page-frame">
	<header class="site-header">
		<a class="brand" href={resolve('/')} aria-label="PageCourier home">
			<svg aria-hidden="true" viewBox="0 0 36 36">
				<rect width="36" height="36" rx="9" fill="#d7f05b" />
				<path d="M10 7h11l6 6v16H10z" fill="#152c39" />
				<path
					d="M21 7v7h6M14 18h10M14 22h10M14 26h6"
					fill="none"
					stroke="#f7f8f3"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.7"
				/>
			</svg>
			<span>PageCourier</span>
		</a>
		<p class="header-note">Markdown sharing</p>
	</header>

	<main id="document-main">
		<div class="document-shell">
			<header class="document-header">
				<div class="document-ident">
					<p class="filename">Shared Markdown · {data.filename}</p>
					{#if !data.hasH1}
						<h1>{data.title}</h1>
					{/if}
				</div>
				<nav class="document-actions" aria-label="Document actions">
					<button class="copy-button" type="button" onclick={copyUrl}>Copy link</button>
					<a
						class="download-link"
						href={resolve('/documents/[id]/download', { id: data.id })}
						data-sveltekit-reload>Download original Markdown</a
					>
				</nav>
			</header>

			{#if copied}
				<div class="copy-feedback">
					<StatusMessage kind="status" message="Link copied to clipboard." />
				</div>
			{/if}

			{#if copyFailed}
				<div class="copy-feedback manual-copy">
					<StatusMessage
						kind="error"
						message="Clipboard access is unavailable. Select the URL below and copy it manually."
					/>
					<label for="share-url">Share URL</label>
					<input
						bind:this={shareUrlInput}
						id="share-url"
						type="url"
						value={data.canonicalUrl}
						readonly
						onclick={selectShareUrl}
					/>
				</div>
			{/if}

			<article class="markdown-body" aria-label={`Shared document: ${data.title}`}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html data.html}
			</article>
		</div>

		<section class="upload-another" aria-labelledby="upload-another-heading">
			<h2 id="upload-another-heading">Share another Markdown file</h2>
			<p>Each upload creates a new page. This document will stay unchanged.</p>
			<UploadForm
				id="document-upload"
				uploadMaxBytes={data.uploadMaxBytes}
				submitLabel="Upload another file"
				actionError={form?.error}
			/>
		</section>
	</main>
</div>

<style>
	.page-frame {
		width: min(100% - 3rem, 76rem);
		min-height: 100vh;
		margin: 0 auto;
		padding: 2rem 0 4rem;
	}

	.skip-link {
		position: absolute;
		z-index: 1;
		top: 0.75rem;
		left: 0.75rem;
		padding: 0.7rem 0.9rem;
		transform: translateY(-160%);
		background: var(--ink);
		color: var(--surface);
		font-size: 0.95rem;
		font-weight: 700;
		text-decoration: none;
	}

	.skip-link:focus {
		transform: translateY(0);
	}

	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--line);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		font-size: 1.05rem;
		font-weight: 750;
		letter-spacing: -0.025em;
		text-decoration: none;
	}

	.brand svg {
		width: 2.25rem;
		height: 2.25rem;
	}

	.header-note {
		margin: 0;
		color: var(--muted-ink);
		font-size: 0.875rem;
	}

	main {
		max-width: 64rem;
		margin: 3rem auto 0;
	}

	.document-shell {
		background: var(--surface);
	}

	.document-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--line);
	}

	.document-ident {
		min-width: 0;
	}

	.filename {
		margin: 0;
		color: var(--muted-ink);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}

	.document-ident h1 {
		margin: 0.5rem 0 0;
		font-size: 1.75rem;
		letter-spacing: -0.025em;
		overflow-wrap: anywhere;
	}

	.document-actions {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.copy-button,
	.download-link {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--ink);
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}

	.copy-button {
		background: var(--ink);
		color: var(--surface);
	}

	.copy-button:hover {
		background: var(--blue);
	}

	.download-link:hover {
		background: var(--surface-muted);
	}

	.copy-button:focus-visible,
	.download-link:focus-visible,
	.manual-copy input:focus-visible {
		outline: 3px solid var(--blue);
		outline-offset: 3px;
	}

	.copy-feedback {
		display: grid;
		gap: 0.65rem;
		margin: 1rem 2rem 0;
	}

	.manual-copy label {
		font-size: 0.875rem;
		font-weight: 700;
	}

	.manual-copy input {
		width: 100%;
		min-height: 2.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}

	.markdown-body {
		min-width: 0;
		padding: 2.5rem;
		font-size: 1rem;
		line-height: 1.7;
		overflow-wrap: anywhere;
	}

	.markdown-body :global(> :first-child) {
		margin-top: 0;
	}

	.markdown-body :global(h1),
	.markdown-body :global(h2),
	.markdown-body :global(h3),
	.markdown-body :global(h4) {
		margin: 2rem 0 0.8rem;
		line-height: 1.2;
		letter-spacing: -0.025em;
	}

	.markdown-body :global(h1) {
		font-size: 2rem;
	}

	.markdown-body :global(h2) {
		font-size: 1.55rem;
	}

	.markdown-body :global(h3) {
		font-size: 1.25rem;
	}

	.markdown-body :global(p),
	.markdown-body :global(ul),
	.markdown-body :global(ol),
	.markdown-body :global(blockquote),
	.markdown-body :global(table),
	.markdown-body :global(pre) {
		margin: 1rem 0;
	}

	.markdown-body :global(a) {
		color: var(--blue);
		text-decoration-thickness: 1px;
		text-underline-offset: 0.15em;
	}

	.markdown-body :global(a:hover) {
		color: var(--ink);
	}

	.markdown-body :global(blockquote) {
		margin-inline: 0;
		padding: 0.25rem 1rem;
		border-inline-start: 2px solid var(--line);
		color: var(--muted-ink);
	}

	.markdown-body :global(pre) {
		max-width: 100%;
		overflow: auto;
		padding: 1rem;
		background: #152c39;
		color: #f7f8f3;
		font-size: 0.875rem;
		line-height: 1.6;
		tab-size: 2;
	}

	.markdown-body :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.92em;
	}

	.markdown-body :global(pre code) {
		font-size: inherit;
	}

	.markdown-body :global(:not(pre) > code) {
		padding: 0.12em 0.3em;
		background: var(--surface-muted);
		overflow-wrap: anywhere;
	}

	.markdown-body :global(.hljs-keyword),
	.markdown-body :global(.hljs-literal),
	.markdown-body :global(.hljs-type),
	.markdown-body :global(.hljs-selector-tag) {
		color: var(--code-keyword);
		font-weight: 700;
	}

	.markdown-body :global(.hljs-string),
	.markdown-body :global(.hljs-attr),
	.markdown-body :global(.hljs-template-variable) {
		color: #d7f05b;
	}

	.markdown-body :global(.hljs-number),
	.markdown-body :global(.hljs-built_in),
	.markdown-body :global(.hljs-symbol) {
		color: var(--code-number);
	}

	.markdown-body :global(.hljs-comment),
	.markdown-body :global(.hljs-quote) {
		color: var(--code-comment);
		font-style: italic;
	}

	.markdown-body :global(table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
	}

	.markdown-body :global(th),
	.markdown-body :global(td) {
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}

	.markdown-body :global(th) {
		background: var(--surface-muted);
	}

	.markdown-body :global(.contains-task-list) {
		padding-inline-start: 0;
		list-style: none;
	}

	.markdown-body :global(input[type='checkbox']) {
		margin-inline-end: 0.45rem;
		accent-color: var(--blue);
	}

	.markdown-body :global(img) {
		max-width: 100%;
		height: auto;
	}

	.upload-another {
		margin-top: 2.5rem;
		padding: 1.5rem 0;
		border-top: 1px solid var(--line);
	}

	.upload-another h2 {
		margin: 0;
		font-size: 1.4rem;
		letter-spacing: -0.02em;
	}

	.upload-another > p {
		margin: 0.6rem 0 0;
		color: var(--muted-ink);
		line-height: 1.5;
	}

	@media (max-width: 760px) {
		.page-frame {
			width: min(100% - 2.5rem, 42rem);
			padding-top: 1.4rem;
		}

		main {
			margin-top: 2rem;
		}

		.document-header {
			align-items: flex-start;
			flex-direction: column;
			padding: 1.25rem;
		}

		.document-actions {
			width: 100%;
		}

		.copy-button,
		.download-link {
			flex: 1 1 10rem;
		}

		.copy-feedback {
			margin-inline: 1.25rem;
		}

		.markdown-body {
			padding: 1.5rem 1.25rem;
		}
	}

	@media (max-width: 480px) {
		.page-frame {
			width: calc(100% - 2rem);
			padding-top: 1rem;
		}

		.header-note {
			max-width: 8.5rem;
			text-align: right;
		}

		.document-actions {
			flex-direction: column;
		}

		.copy-button,
		.download-link {
			width: 100%;
			flex: none;
		}

		.markdown-body {
			padding: 1.25rem 1rem;
		}
	}
</style>
