<!--
THESIS: Make the one-file-to-one-link promise actionable without replacing PageCourier's editorial introduction.
OWN-WORLD: Mineral green, ink navy, and signal lime; precise sans typography, fine rules, and the flat route diagram.
STORY: A small-team member chooses or drops one Markdown file, understands the sharing and privacy limits, and receives its page only after storage succeeds.
FIRST VIEWPORT: Brand and headline lead; the upload field and primary action sit beneath the lead at left, balanced by the existing file-to-link schematic at right.
FORM: Operate-mode extension of the established home surface; the upload is an accessible native form with a reusable drop target and inline states.
-->
<script lang="ts">
	import UploadForm from '../lib/components/UploadForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>PageCourier — Markdown, ready to travel.</title>
	<meta
		name="description"
		content="Turn a Markdown file into a readable page you can share with one unique link."
	/>
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>

<div class="page-frame">
	<header class="site-header">
		<div class="brand">
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
		</div>
		<p class="header-note">Markdown sharing</p>
	</header>

	<main id="main">
		<section class="intro" aria-labelledby="page-title">
			<div class="intro-copy">
				<h1 id="page-title">Markdown,<br />ready to travel.</h1>
				<p class="lead">
					PageCourier is built around one idea: Markdown should travel as a readable page, shared by
					one link.
				</p>
				<UploadForm
					id="start-upload"
					uploadMaxBytes={data.uploadMaxBytes}
					submitLabel="Upload and get a link"
					actionError={form?.error}
				/>
				<a
					class="github-link"
					href="https://github.com/torstenwerner/PageCourier"
					aria-label="PageCourier on GitHub"
				>
					<svg aria-hidden="true" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.45 3.04-1.15 3.04-1.15.61 1.54.23 2.68.12 2.96.71.78 1.14 1.78 1.14 3 0 4.29-2.61 5.23-5.1 5.51.4.34.75 1.02.75 2.06v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"
						/>
					</svg>
				</a>
			</div>

			<figure class="journey" aria-label="One Markdown file becomes a page to share">
				<div class="journey-topline">
					<span>ONE FILE</span>
					<span class="journey-rule" aria-hidden="true"></span>
					<span>ONE LINK</span>
				</div>

				<div class="journey-flow">
					<div class="source">
						<span class="step-label">YOUR MARKDOWN</span>
						<div class="paper" aria-hidden="true">
							<span class="paper-fold"></span>
							<span class="paper-line wide"></span>
							<span class="paper-line"></span>
							<span class="paper-line short"></span>
							<span class="file-extension">.MD</span>
						</div>
					</div>

					<svg class="transfer" aria-hidden="true" viewBox="0 0 120 32">
						<path d="M2 16h106m0 0-10-10m10 10-10 10" />
					</svg>

					<div class="destination">
						<span class="step-label">A PAGE TO SHARE</span>
						<div class="link-mark" aria-hidden="true">
							<svg viewBox="0 0 44 44">
								<path d="M18 25.5 15.5 28a6 6 0 0 1-8.5-8.5l7-7a6 6 0 0 1 8.5 0" />
								<path d="m26 18.5 2.5-2.5a6 6 0 0 1 8.5 8.5l-7 7a6 6 0 0 1-8.5 0" />
								<path d="m16 28 12-12" />
							</svg>
						</div>
						<span class="link-caption">unique link</span>
					</div>
				</div>
			</figure>
		</section>
	</main>
</div>

<style>
	.page-frame {
		width: min(100% - 3rem, 76rem);
		min-height: 100vh;
		margin: 0 auto;
		padding: 2rem 0 1.5rem;
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
		color: var(--muted-ink);
		font-size: 0.875rem;
	}

	.header-note {
		margin: 0;
	}

	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(21rem, 0.9fr);
		align-items: center;
		gap: 4rem;
		min-height: min(70vh, 44rem);
		padding: 4rem 0;
	}

	.intro-copy {
		max-width: 38rem;
	}

	h1 {
		max-width: 16ch;
		margin: 0;
		font-size: 4.5rem;
		font-weight: 750;
		letter-spacing: -0.04em;
		line-height: 0.99;
	}

	.lead {
		max-width: 43rem;
		margin: 1.65rem 0 0;
		color: var(--muted-ink);
		font-size: 1.15rem;
		line-height: 1.6;
	}

	.github-link {
		display: inline-flex;
		width: 2.5rem;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		margin-top: 2rem;
		color: var(--muted-ink);
	}

	.github-link:hover {
		color: var(--ink);
	}

	.github-link svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	.journey {
		position: relative;
		margin: 0;
		padding: 2rem;
		overflow: hidden;
		background: var(--ink);
		color: var(--surface);
	}

	.journey::after {
		position: absolute;
		right: -2.25rem;
		bottom: -3rem;
		width: 8rem;
		height: 8rem;
		border: 1px solid rgb(247 248 243 / 18%);
		border-radius: 50%;
		content: '';
		pointer-events: none;
	}

	.journey-topline {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #d5e0dc;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.journey-rule {
		height: 1px;
		flex: 1;
		background: #61747a;
	}

	.journey-flow {
		display: grid;
		grid-template-columns: minmax(5.5rem, 1fr) minmax(4rem, 0.85fr) minmax(5.5rem, 1fr);
		align-items: center;
		gap: 0.8rem;
		padding: 3.3rem 0 2.5rem;
	}

	.source,
	.destination {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
	}

	.step-label {
		color: #d5e0dc;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.09em;
	}

	.paper {
		position: relative;
		display: flex;
		width: 6rem;
		height: 7rem;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.3rem 0.8rem 0.7rem;
		background: var(--surface);
	}

	.paper-fold {
		position: absolute;
		top: 0;
		right: 0;
		width: 1.2rem;
		height: 1.2rem;
		background: linear-gradient(45deg, #c8d2cc 0 50%, #e8eeea 51%);
	}

	.paper-line {
		display: block;
		width: 78%;
		height: 2px;
		background: #99a8a4;
	}

	.paper-line.wide {
		width: 100%;
		background: var(--blue);
	}

	.paper-line.short {
		width: 56%;
	}

	.file-extension {
		margin-top: auto;
		color: var(--blue);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.1em;
	}

	.transfer {
		width: 100%;
		overflow: visible;
	}

	.transfer path {
		fill: none;
		stroke: var(--lime);
		stroke-dasharray: 2 4;
		stroke-linecap: round;
		stroke-width: 1.6;
	}

	.destination {
		align-items: center;
		text-align: center;
	}

	.link-mark {
		display: grid;
		width: 5rem;
		height: 5rem;
		place-items: center;
		border-radius: 50%;
		background: var(--lime);
	}

	.link-mark svg {
		width: 2.75rem;
		height: 2.75rem;
		fill: none;
		stroke: var(--ink);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}

	.link-caption {
		color: #f1f3ea;
		font-size: 0.85rem;
	}

	@media (max-width: 800px) {
		.page-frame {
			width: min(100% - 2.5rem, 42rem);
			padding-top: 1.4rem;
		}

		.intro {
			grid-template-columns: 1fr;
			gap: 3rem;
			min-height: auto;
			padding: 4.25rem 0 3rem;
		}

		h1 {
			font-size: 3.5rem;
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

		.intro {
			gap: 2.4rem;
			padding-top: 3.4rem;
		}

		h1 {
			font-size: 3rem;
		}

		.lead {
			font-size: 1.05rem;
		}

		.journey {
			padding: 1.35rem;
		}

		.journey-flow {
			grid-template-columns: minmax(4.4rem, 1fr) minmax(2.5rem, 0.75fr) minmax(4.4rem, 1fr);
			gap: 0.45rem;
			padding: 2.5rem 0 2rem;
		}

		.step-label {
			font-size: 0.62rem;
		}

		.paper {
			width: 5.25rem;
			height: 6.25rem;
		}

		.link-mark {
			width: 4.25rem;
			height: 4.25rem;
		}

		.link-mark svg {
			width: 2.4rem;
			height: 2.4rem;
		}
	}
</style>
