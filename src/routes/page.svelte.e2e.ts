import { expect, test } from '@playwright/test';
import { mermaidLimits } from '../lib/mermaid/limits';

async function upload(
	page: import('@playwright/test').Page,
	id: string,
	name: string,
	source: string
) {
	const previousUrl = page.url();
	await page.locator(`#${id}`).setInputFiles({
		name,
		mimeType: 'text/markdown',
		buffer: Buffer.from(source)
	});
	await expect(page.getByText(`Selected: ${name}`, { exact: false })).toBeVisible();
	const submitName = id === 'start-upload' ? 'Upload and get a link' : 'Upload another file';
	await page.getByRole('button', { name: submitName }).click();
	await page.waitForURL(
		(url) => url.toString() !== previousUrl && /\/documents\/[a-f0-9]{32}$/.test(url.pathname)
	);
	return page.url();
}

test('home page keeps its introduction and offers an accessible responsive upload flow', async ({
	page
}) => {
	await page.goto('/');

	await expect(page).toHaveTitle('PageCourier — Markdown, ready to travel.');
	await expect(page.getByRole('heading', { name: 'Markdown, ready to travel.' })).toBeVisible();
	await expect(page.getByText('Markdown sharing', { exact: true })).toBeVisible();
	await expect(page.getByRole('main')).toContainText('shared by one link');
	await expect(page.getByRole('link', { name: 'PageCourier on GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/torstenwerner/PageCourier'
	);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
	await expect(page.getByLabel('Choose a Markdown file or drop it here')).toBeVisible();
	await expect(page.getByText('.md or .markdown · Maximum 5 MiB')).toBeVisible();
	await expect(page.getByText(/Share links can be forwarded/)).toBeVisible();

	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#start-upload')).toBeFocused();

	await page.locator('#start-upload').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not markdown')
	});
	await expect(page.getByRole('alert')).toContainText('ending in .md or .markdown');
	await expect(page).toHaveURL('/');

	await page.setViewportSize({ width: 390, height: 844 });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});

test('keeps liveness independent from storage and verifies readiness', async ({ request }) => {
	const live = await request.get('/health/live');
	expect(live.status()).toBe(200);
	expect(live.headers()['cache-control']).toBe('no-store');
	expect(await live.json()).toEqual({ status: 'ok' });

	const ready = await request.get('/health/ready');
	expect(ready.status()).toBe(200);
	expect(ready.headers()['cache-control']).toBe('no-store');
	expect(await ready.json()).toEqual({ status: 'ready' });
});

test('validates a dropped file and redirects to the server-rendered document after storage', async ({
	page
}) => {
	await page.goto('/');
	await page.locator('#start-upload').setInputFiles({
		name: 'seed.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('# Seed\n')
	});
	await expect(page.getByText('Selected: seed.md', { exact: false })).toBeVisible();
	const droppedName = await page.evaluate(() => {
		const input = document.getElementById('start-upload') as HTMLInputElement;
		const dropZone = input.closest('label');
		if (!dropZone) throw new Error('Upload drop target is missing.');
		const transfer = new DataTransfer();
		transfer.items.add(
			new File(['# Travel notes\n\nA readable page.\n'], 'travel.md', {
				type: 'text/markdown'
			})
		);
		const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true });
		const drop = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(dragOver, 'dataTransfer', { value: transfer });
		Object.defineProperty(drop, 'dataTransfer', { value: transfer });
		dropZone.dispatchEvent(dragOver);
		dropZone.dispatchEvent(drop);
		return input.files?.[0]?.name;
	});
	expect(droppedName).toBe('travel.md');
	await expect(page.getByText('Selected: travel.md', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Upload and get a link' }).click();
	await expect(page).toHaveURL(/\/documents\/[a-f0-9]{32}$/);
	await expect(page.getByRole('heading', { name: 'Travel notes' })).toBeVisible();
	await expect(page.locator('.markdown-body')).toContainText('A readable page.');
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		'Travel notes'
	);
});

test('shows storage failure without replacing a document, then uploads a distinct document', async ({
	page
}) => {
	await page.goto('/');
	const originalUrl = await upload(
		page,
		'start-upload',
		'original.md',
		'# Original notes\n\nThe first document remains unchanged.\n'
	);

	await page.locator('#document-upload').setInputFiles({
		name: 'storage-fail.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('# Failed upload\n')
	});
	await expect(page.getByText('Selected: storage-fail.md', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Upload another file' }).click();
	await expect(page.getByRole('alert')).toContainText('storage is temporarily unavailable');
	await expect(page).toHaveURL(originalUrl);
	await expect(page.locator('.markdown-body')).toContainText(
		'The first document remains unchanged.'
	);

	const nextUrl = await upload(
		page,
		'document-upload',
		'next.md',
		'# A second page\n\nEach document has its own URL.\n'
	);
	expect(nextUrl).not.toBe(originalUrl);
	await expect(page.getByRole('heading', { name: 'A second page' })).toBeVisible();

	await page.goto(originalUrl);
	await expect(page.getByRole('heading', { name: 'Original notes' })).toBeVisible();
	await expect(page.locator('.markdown-body')).toContainText(
		'The first document remains unchanged.'
	);
});

test('shows busy state, preserves original bytes for download, and copies the canonical URL', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	const longCell = 'wide-cell-'.repeat(30);
	const codeLine = 'code-value '.repeat(30);
	const source = [
		'# Download check',
		'',
		'Original Markdown stays intact.',
		'',
		'| Column | Value |',
		'| --- | --- |',
		`| Long | ${longCell} |`,
		'',
		'```text',
		codeLine,
		'```',
		''
	].join('\n');
	await page.locator('#start-upload').setInputFiles({
		name: 'slow.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from(source)
	});
	await expect(page.getByText('Selected: slow.md', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Upload and get a link' }).click();
	await expect(page.getByRole('status')).toContainText('Uploading and saving');
	await expect(page).toHaveURL(/\/documents\/[a-f0-9]{32}$/);
	const documentUrl = page.url();
	await expect(page.getByRole('heading', { name: 'Download check' })).toBeVisible();

	const download = await page.request.get(`${documentUrl}/download`);
	expect(download.status()).toBe(200);
	expect(Buffer.from(await download.body())).toEqual(Buffer.from(source));

	await page.getByRole('button', { name: 'Copy link' }).click();
	await expect(page.getByRole('status')).toContainText('Link copied to clipboard.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(documentUrl);

	await page.setViewportSize({ width: 390, height: 844 });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});

test('offers a selectable manual-copy fallback when clipboard access is unavailable', async ({
	page
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
	});
	await page.goto('/');
	const documentUrl = await upload(
		page,
		'start-upload',
		'manual-copy.md',
		'# Manual copy\n\nA document link.\n'
	);

	await page.getByRole('button', { name: 'Copy link' }).click();
	await expect(page.getByRole('alert')).toContainText('Clipboard access is unavailable');
	const shareUrl = page.getByRole('textbox', { name: 'Share URL' });
	await expect(shareUrl).toHaveValue(documentUrl);
	await expect(shareUrl).toBeFocused();
	expect(await shareUrl.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(0);
});

test('wraps a long fallback title without horizontal overflow on mobile', async ({ page }) => {
	await page.goto('/');
	const filename = `${'a'.repeat(120)}.md`;
	await upload(page, 'start-upload', filename, 'A document without a heading.\n');

	await expect(page.locator('.document-ident h1')).toHaveText(filename);
	await page.setViewportSize({ width: 390, height: 844 });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});

test('renders bounded Mermaid flowcharts with accessible errors and unchanged document actions', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const imageRequests: string[] = [];
	await page.route('https://images.example.test/photo.png', async (route) => {
		imageRequests.push(route.request().url());
		await route.fulfill({
			status: 200,
			contentType: 'image/png',
			body: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
				'base64'
			)
		});
	});
	await page.addInitScript(() => {
		(window as Window & { mermaidPayloadExecuted?: boolean }).mermaidPayloadExecuted = false;
	});
	await page.goto('/');

	const manyNodes = Array.from({ length: 41 }, (_, index) => `N${index} --> N${index + 1}`).join(
		'\n'
	);
	const source = [
		'# Mermaid rendering',
		'',
		'```mermaid',
		'flowchart TD',
		'Start[Start] --> Decision{Ready?}',
		'Decision --> Finish[Done]',
		'```',
		'',
		'![Remote image](https://images.example.test/photo.png)',
		'',
		'![Insecure image](http://images.example.test/photo.png)',
		'',
		'```mermaid',
		'flowchart TD',
		'A -->',
		'```',
		'',
		'```mermaid',
		'sequenceDiagram',
		'Alice->>Bob: Hello',
		'```',
		'',
		'```mermaid',
		'flowchart TD',
		`A["<img src=x onerror="window.mermaidPayloadExecuted=true">"]`,
		'```',
		'',
		'```mermaid',
		'flowchart TD',
		'A["<script>window.mermaidPayloadExecuted=true</script>"]',
		'```',
		'',
		'```mermaid',
		'flowchart TD',
		'A --> B',
		'click A "javascript:alert(1)"',
		'```',
		'',
		'```mermaid',
		'flowchart TD',
		manyNodes,
		'```',
		'',
		'```mermaid',
		'flowchart TD',
		`A[${'x'.repeat(mermaidLimits.maxSourceBytes)}]`,
		'```',
		''
	].join('\n');

	const documentUrl = await upload(page, 'start-upload', 'diagrams.md', source);
	const documentResponse = await page.reload();
	const csp = documentResponse?.headers()['content-security-policy'];
	if (!csp) throw new Error('Document response is missing a Content-Security-Policy header.');
	expect(documentResponse?.headers()['cache-control']).toBe('private, no-store');
	expect(documentResponse?.headers()['x-robots-tag']).toBe('noindex, nofollow');
	expect(documentResponse?.headers()['referrer-policy']).toBe('no-referrer');
	expect(documentResponse?.headers()['x-content-type-options']).toBe('nosniff');
	expect(documentResponse?.headers()['x-frame-options']).toBe('DENY');
	expect(csp).toContain("style-src 'self' 'nonce-");
	expect(csp).toContain("img-src 'self' https:");
	expect(csp).not.toContain('unsafe-inline');
	const styleNonce = csp.match(/style-src[^;]*'nonce-([^']+)'/)?.[1];
	expect(styleNonce).toBeTruthy();
	await expect(page.getByRole('heading', { name: 'Mermaid rendering' })).toBeVisible();
	const remoteImage = page.locator('.markdown-body img');
	await expect(remoteImage).toHaveAttribute('src', 'https://images.example.test/photo.png');
	await expect
		.poll(() => remoteImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
		.toBe(1);
	expect(imageRequests.length).toBeGreaterThan(0);
	expect(imageRequests.every((url) => url === 'https://images.example.test/photo.png')).toBe(true);
	await expect(page.locator('.markdown-body img[src^="http://"]')).toHaveCount(0);
	await expect(page.locator('.mermaid-output svg')).toHaveCount(1);
	await expect(page.getByRole('img', { name: 'Rendered Mermaid flowchart' })).toBeVisible();
	const diagramBounds = await page.locator('.mermaid-output svg').evaluate((svg) => {
		const { width, height } = svg.getBoundingClientRect();
		return { width, height, graphicElements: svg.querySelectorAll('path, rect, text').length };
	});
	expect(diagramBounds.width).toBeGreaterThan(0);
	expect(diagramBounds.height).toBeGreaterThan(0);
	expect(diagramBounds.graphicElements).toBeGreaterThan(0);
	expect(
		await page
			.locator('.mermaid-output svg style')
			.evaluate((style) => (style as HTMLStyleElement).nonce)
	).toBe(styleNonce);
	expect(
		await page.locator('.mermaid-output svg[style], .mermaid-output svg [style]').count()
	).toBe(0);
	await expect(page.locator('.mermaid-status[role="alert"]')).toHaveCount(7);
	await expect(page.locator('.mermaid-source').nth(1)).toHaveAttribute('open', '');
	expect(
		await page.evaluate(
			() => (window as Window & { mermaidPayloadExecuted?: boolean }).mermaidPayloadExecuted
		)
	).toBe(false);
	expect(await page.locator('.mermaid-output a').count()).toBe(0);
	expect(await page.locator('.mermaid-output script, .mermaid-output foreignObject').count()).toBe(
		0
	);

	await page.getByRole('button', { name: 'Copy link' }).click();
	await expect(page.locator('.copy-feedback [role="status"]')).toContainText(
		'Link copied to clipboard.'
	);
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(documentUrl);

	const download = await page.request.get(`${documentUrl}/download`);
	expect(download.status()).toBe(200);
	expect(Buffer.from(await download.body())).toEqual(Buffer.from(source));
});

test('keeps diagrams after the per-document rendering cap as source', async ({ page }) => {
	await page.goto('/');
	const source = Array.from(
		{ length: mermaidLimits.maxDiagrams + 1 },
		(_, index) => `\`\`\`mermaid\nflowchart TD\nN${index}[Step ${index}]\n\`\`\``
	).join('\n\n');

	await upload(page, 'start-upload', 'many-diagrams.md', source);
	await expect(page.locator('.mermaid-diagram')).toHaveCount(mermaidLimits.maxDiagrams);
	await expect(page.locator('.mermaid-status[role="alert"]')).toHaveCount(1);
	await expect(page.locator('.mermaid-source pre')).toHaveCount(mermaidLimits.maxDiagrams);
	await expect(page.locator('article > pre > code.language-mermaid')).toHaveCount(1);
	await expect(page.locator('article > pre > code.language-mermaid')).toContainText('N20');
});
