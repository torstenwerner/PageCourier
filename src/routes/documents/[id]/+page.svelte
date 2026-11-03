<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.filename} - PageCourier</title>
</svelte:head>

<main>
	<h1>{data.filename}</h1>
	<a href={resolve('/documents/[id]/download', { id: data.id })} data-sveltekit-reload
		>Download original Markdown</a
	>
	<p>Markdown rendering and the full document interface are not available yet.</p>
	<pre>{data.source}</pre>
</main>

<style>
	main {
		max-width: 76rem;
		margin: 2rem auto;
		padding: 1rem;
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
