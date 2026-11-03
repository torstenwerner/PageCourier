<script lang="ts">
	interface Props {
		kind: 'status' | 'error';
		message: string;
	}

	let { kind, message }: Props = $props();
</script>

<p
	class="message"
	class:error={kind === 'error'}
	role={kind === 'error' ? 'alert' : 'status'}
	aria-atomic="true"
>
	<span aria-hidden="true" class="mark">{kind === 'error' ? '!' : '✓'}</span>
	<span>{message}</span>
</p>

<style>
	.message {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		margin: 0;
		color: #1c596c;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.message.error {
		color: #8d2923;
	}

	.mark {
		display: inline-grid;
		flex: 0 0 1.35rem;
		width: 1.35rem;
		height: 1.35rem;
		place-items: center;
		border: 1px solid currentColor;
		border-radius: 50%;
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1;
	}
</style>
