import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('renders common GFM constructs and display-only task lists', () => {
		const { html } = renderMarkdown(
			[
				'| Name | Value |',
				'| --- | --- |',
				'| Page | Courier |',
				'',
				'- [x] Ready',
				'- [ ] Pending',
				'',
				'~~old~~ and **new**',
				'',
				'> A short quote.',
				'',
				'1. First',
				'2. Second'
			].join('\n'),
			'notes.md'
		);

		expect(html).toContain('<table>');
		expect(html).toContain('<del>old</del>');
		expect(html).toContain('<strong>new</strong>');
		expect(html).toContain('<blockquote>');
		expect(html).toContain('<ol>');
		expect(html).toMatch(
			/<input[^>]*type="checkbox"[^>]*checked[^>]*disabled|<input[^>]*type="checkbox"[^>]*disabled[^>]*checked/
		);
		expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*disabled/);
	});

	it('adds same-document heading anchors and highlights known languages safely', () => {
		const { html } = renderMarkdown(
			'# A heading\n\n[Jump](#a-heading)\n\n```js\nconst answer = 42;\n```\n',
			'notes.md'
		);

		const headingId = html.match(/<h1 id="([^"]+)">/)?.[1];
		expect(headingId).toBeTruthy();
		expect(html).toContain(`href="#${headingId}"`);
		expect(html).toContain('hljs-keyword');
		expect(html).toContain('language-js');
	});

	it('keeps unknown language code safe as ordinary escaped text', () => {
		const { html } = renderMarkdown(
			'```unknown-language\n<script>alert(1)</script>\n```\n',
			'notes.md'
		);

		expect(html).toContain('language-unknown-language');
		expect(html).toContain('alert(1)');
		expect(html).not.toContain('<script>');
	});

	it('disables raw HTML and removes unsafe and relative resource URLs', () => {
		const { html } = renderMarkdown(
			[
				'<script>alert(1)</script>',
				'<img src=x onerror=alert(1)>',
				'[javascript](javascript:alert(1))',
				'[relative](/documents/secret)',
				'[http](http://example.com)',
				'[https](https://example.com)',
				'![remote](https://images.example.com/photo.png)',
				'![relative](/documents/secret/image.png)',
				'![data](data:image/svg+xml,<svg>)'
			].join('\n\n'),
			'notes.md'
		);

		expect(html).not.toContain('<script>');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('href="/documents/secret"');
		expect(html).not.toContain('src="/documents/secret/image.png"');
		expect(html).not.toContain('data:image');
		expect(html).toContain('href="http://example.com"');
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('src="https://images.example.com/photo.png"');
		expect(html).toContain('relative');
	});

	it('derives plain-text metadata from the first non-empty heading', () => {
		const rendered = renderMarkdown(
			'\n# **A readable title**\n\nText with `inline code`.\n',
			'notes.md'
		);

		expect(rendered.title).toBe('A readable title');
		expect(rendered.description).toBe('A readable title Text with inline code.');
		expect(rendered.html).toContain('<strong>A readable title</strong>');
	});

	it('finds headings nested inside blockquotes for document title and heading structure', () => {
		const rendered = renderMarkdown('> # A quoted title\n\nVisible paragraph.\n', 'notes.md');

		expect(rendered.title).toBe('A quoted title');
		expect(rendered.hasH1).toBe(true);
	});

	it('excludes disabled raw HTML from the title and description', () => {
		const rendered = renderMarkdown(
			'# <b>Plain title</b>\n\n<script>alert(1)</script>\n\nVisible paragraph.\n',
			'notes.md'
		);

		expect(rendered.title).toBe('Plain title');
		expect(rendered.description).toBe('Plain title Visible paragraph.');
		expect(rendered.description).not.toContain('<');
	});

	it('falls back to the filename and provides a useful empty description', () => {
		expect(renderMarkdown(' \n', 'notes.md')).toEqual({
			html: '',
			title: 'notes.md',
			description: 'A shared Markdown document.',
			hasH1: false
		});
	});

	it('limits the description to a concise 180-character excerpt', () => {
		const description = renderMarkdown('x'.repeat(220), 'notes.md').description;
		expect(Array.from(description)).toHaveLength(181);
		expect(description.endsWith('…')).toBe(true);
	});
});
