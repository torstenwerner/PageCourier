<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import StatusMessage from './StatusMessage.svelte';

	interface Props {
		id: string;
		uploadMaxBytes: number;
		submitLabel: string;
		actionError?: string | null;
	}

	let { id, uploadMaxBytes, submitLabel, actionError = '' }: Props = $props();
	let input = $state<HTMLInputElement>();
	let busy = $state(false);
	let dragging = $state(false);
	let clientError = $state('');
	let dismissActionError = $state(false);
	let selectedName = $state('');
	let selectedSize = $state('');
	const errorMessage = $derived(clientError || (dismissActionError ? '' : actionError));

	function formatBytes(bytes: number): string {
		const mebibytes = bytes / 1_048_576;
		return `${Number.isInteger(mebibytes) ? mebibytes : mebibytes.toLocaleString(undefined, { maximumFractionDigits: 2 })} MiB`;
	}

	async function validateFile(file: File | undefined): Promise<string | undefined> {
		if (!file) return 'Choose one Markdown file to upload.';
		if (!/\.(md|markdown)$/i.test(file.name)) return 'Choose a file ending in .md or .markdown.';
		if (file.size === 0) return 'The selected file is empty. Choose a Markdown file with content.';
		if (file.size > uploadMaxBytes)
			return `The file exceeds the ${formatBytes(uploadMaxBytes)} limit. Choose a smaller file.`;
		try {
			const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
			if (!text.trim()) return 'The selected file contains no Markdown content.';
		} catch {
			return 'The file is not valid UTF-8 text. Save it as UTF-8 and try again.';
		}
		return undefined;
	}

	async function selectFile(file: File | undefined) {
		dismissActionError = true;
		selectedName = file?.name ?? '';
		selectedSize = file ? formatBytes(file.size) : '';
		clientError = (await validateFile(file)) ?? '';
	}

	function handleChange(event: Event) {
		void selectFile((event.currentTarget as HTMLInputElement).files?.[0]);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		const target = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget))
			dragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files[0];
		if (!input || !file) {
			clientError = 'Drop one Markdown file to upload.';
			return;
		}
		const files = new DataTransfer();
		files.items.add(file);
		input.files = files.files;
		void selectFile(file);
	}

	const submit: SubmitFunction = async ({ cancel }) => {
		dismissActionError = true;
		clientError = (await validateFile(input?.files?.[0])) ?? '';
		if (clientError) {
			cancel();
			return;
		}
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'failure') {
				clientError = result.data?.error ?? 'The upload could not be completed. Try again.';
				await update({ reset: false });
				return;
			}
			await update();
		};
	};
</script>

<form method="POST" enctype="multipart/form-data" use:enhance={submit}>
	<label
		class="drop-zone"
		class:dragging
		class:busy
		for={id}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		aria-disabled={busy}
	>
		<span class="drop-title">Choose a Markdown file or drop it here</span>
		<span class="drop-hint">One file at a time</span>
		<input
			bind:this={input}
			{id}
			class="file-input"
			type="file"
			name="file"
			accept=".md,.markdown,text/markdown"
			required
			disabled={busy}
			aria-describedby="{id}-rules"
			onchange={handleChange}
		/>
	</label>

	<p class="rules" id="{id}-rules">
		.md or .markdown · Maximum {formatBytes(uploadMaxBytes)}
	</p>
	<p class="privacy-note">
		Share links can be forwarded. Don’t upload secrets or private information.
	</p>

	{#if selectedName && !errorMessage}
		<p class="selected-file" aria-live="polite" aria-atomic="true">
			Selected: <strong>{selectedName}</strong> ({selectedSize})
		</p>
	{/if}

	{#if errorMessage}
		<StatusMessage kind="error" message={errorMessage} />
	{/if}

	{#if busy}
		<StatusMessage kind="status" message="Uploading and saving your document…" />
	{/if}

	<button class="submit-button" type="submit" disabled={busy} aria-busy={busy}>
		{busy ? 'Uploading…' : submitLabel}
	</button>
</form>

<style>
	form {
		display: grid;
		gap: 0.75rem;
		margin-top: 1.65rem;
	}

	.drop-zone {
		position: relative;
		display: grid;
		min-height: 7.25rem;
		align-content: center;
		gap: 0.5rem;
		padding: 1rem 1.2rem;
		border: 1px dashed var(--blue);
		background: var(--surface);
		cursor: pointer;
		transition:
			background-color 160ms ease-out,
			border-color 160ms ease-out;
	}

	.drop-zone:hover,
	.drop-zone.dragging {
		border-color: var(--ink);
		background: #eef2e7;
	}

	.drop-zone:focus-within {
		outline: 3px solid var(--blue);
		outline-offset: 3px;
	}

	.drop-zone.busy {
		cursor: wait;
		opacity: 0.7;
	}

	.drop-title {
		font-size: 1rem;
		font-weight: 700;
	}

	.drop-hint,
	.rules {
		color: var(--muted-ink);
		font-size: 0.875rem;
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		clip-path: inset(50%);
	}

	.rules,
	.privacy-note,
	.selected-file {
		margin: 0;
		line-height: 1.5;
	}

	.privacy-note,
	.selected-file {
		font-size: 0.875rem;
	}

	.privacy-note {
		color: var(--muted-ink);
	}

	.submit-button {
		justify-self: start;
		min-height: 2.85rem;
		padding: 0.7rem 1.1rem;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--surface);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.submit-button:hover:not(:disabled) {
		background: var(--blue);
	}

	.submit-button:focus-visible {
		outline: 3px solid var(--blue);
		outline-offset: 3px;
	}

	.submit-button:disabled {
		cursor: wait;
		opacity: 0.7;
	}

	@media (prefers-reduced-motion: reduce) {
		.drop-zone {
			transition: none;
		}
	}
</style>
