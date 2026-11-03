import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DocumentFailure } from '../../lib/server/documents';
import { render } from 'svelte/server';

const { create, get } = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn() }));
vi.mock('../../lib/server/runtime-config', () => ({
	appConfig: {
		publicOrigin: 'https://pages.example.com',
		uploadMaxBytes: 100,
		storage: { bucket: 'test', region: 'us-east-1', forcePathStyle: false, keyPrefix: '' }
	}
}));
vi.mock('../../lib/server/document-runtime', async (original) => {
	const actual = await original<typeof import('../../lib/server/document-runtime')>();
	return { ...actual, documentStore: { create, get } };
});
import { POST } from './+server';
import { GET } from './[id]/download/+server';
import { actions as startActions } from '../+page.server';
import DocumentPage from './[id]/+page.svelte';
import { actions as documentActions, load } from './[id]/+page.server';

const id = 'a'.repeat(32);
const origin = 'https://pages.example.com';
function uploadEvent(request: Request) {
	return { request } as Parameters<typeof POST>[0];
}
function downloadEvent() {
	return { params: { id } } as Parameters<typeof GET>[0];
}
function upload() {
	const form = new FormData();
	form.append('file', new Blob(['hello']), 'notes.md');
	return new Request('https://untrusted-host.example/documents', {
		method: 'POST',
		headers: { origin },
		body: form
	});
}
beforeEach(() => vi.clearAllMocks());

describe('document routes', () => {
	it('redirects to canonical origin only after persistence succeeds', async () => {
		create.mockResolvedValue(id);
		const response = await POST(uploadEvent(upload()));
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe(`${origin}/documents/${id}`);
		expect(create).toHaveBeenCalledWith(Buffer.from('hello'), 'notes.md');
	});

	it('does not redirect after a write fails', async () => {
		create.mockRejectedValue(new DocumentFailure(503, 'Storage unavailable.'));
		const response = await POST(uploadEvent(upload()));
		expect(response.status).toBe(503);
		expect(response.headers.get('location')).toBeNull();
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	});

	it('redirects both page upload actions only after storage succeeds', async () => {
		create.mockResolvedValue(id);
		const request = upload();
		await expect(
			startActions.default?.({
				request
			} as Parameters<NonNullable<typeof startActions.default>>[0])
		).rejects.toMatchObject({ status: 303, location: `${origin}/documents/${id}` });

		create.mockResolvedValue(`${'b'.repeat(32)}`);
		await expect(
			documentActions.default?.({
				request: upload()
			} as Parameters<NonNullable<typeof documentActions.default>>[0])
		).rejects.toMatchObject({
			status: 303,
			location: `${origin}/documents/${'b'.repeat(32)}`
		});
		expect(create).toHaveBeenCalledTimes(2);
	});

	it('returns actionable upload failures without changing the existing document', async () => {
		create.mockRejectedValue(
			new DocumentFailure(503, 'Document storage is temporarily unavailable.')
		);
		const result = await documentActions.default?.({
			request: upload()
		} as Parameters<NonNullable<typeof documentActions.default>>[0]);

		expect(result).toMatchObject({
			status: 503,
			data: { error: 'Document storage is temporarily unavailable.' }
		});
		expect(get).not.toHaveBeenCalled();
	});

	it('never writes invalid uploads', async () => {
		const req = upload();
		req.headers.delete('origin');
		const response = await POST(uploadEvent(req));
		expect(response.status).toBe(403);
		expect(create).not.toHaveBeenCalled();
	});

	it('serves exact bytes with private safe attachment headers', async () => {
		const bytes = Buffer.from('\ufeff# Hello\r\n');
		get.mockResolvedValue({ bytes, filename: 'café.md', source: '# Hello\r\n' });
		const response = await GET(downloadEvent());
		expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
		expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''caf%C3%A9.md");
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it.each([404, 503])('preserves %s errors on downloads and page loads', async (status) => {
		get.mockRejectedValue(new DocumentFailure(status, 'Safe message.'));
		const response = await GET(downloadEvent());
		expect(response.status).toBe(status);
		expect(await response.json()).toEqual({ error: 'Safe message.' });
		const setHeaders = vi.fn();
		await expect(
			load({
				...downloadEvent(),
				route: { id: '/documents/[id]' },
				setHeaders,
				parent: async () => ({}),
				depends: () => {},
				untrack: (fn) => fn()
			})
		).rejects.toMatchObject({ status });
		expect(setHeaders).toHaveBeenCalledWith(
			expect.objectContaining({ 'cache-control': 'private, no-store' })
		);
	});

	it('returns rendered Markdown and canonical metadata inputs from the server load', async () => {
		get.mockResolvedValue({
			filename: 'notes.md',
			source: '# Article title\n\nA readable paragraph.\n',
			bytes: Buffer.from('# Article title\n\nA readable paragraph.\n')
		});
		const result = await load({
			...downloadEvent(),
			setHeaders: vi.fn(),
			route: { id: '/documents/[id]' },
			parent: async () => ({}),
			depends: () => {},
			untrack: (fn) => fn()
		});

		expect(result).toBeDefined();
		if (!result) throw new Error('Document load did not return data.');
		expect(result.title).toBe('Article title');
		expect(result.description).toBe('Article title A readable paragraph.');
		expect(result.html).toContain('<h1 id="user-content-article-title">');
		expect(result.canonicalUrl).toBe(`${origin}/documents/${id}`);
	});

	it('escapes hostile Open Graph values in server-rendered head markup', () => {
		const { head } = render(DocumentPage, {
			props: {
				data: {
					filename: 'notes.md',
					id,
					uploadMaxBytes: 100,
					title: '<script>alert(1)</script> & "title"',
					description: '<img src=x onerror=alert(1)> & "description"',
					html: '<p>Safe content</p>',
					hasH1: true,
					canonicalUrl: `${origin}/documents/${id}`
				},
				form: null,
				params: { id }
			}
		});

		expect(head).toContain(
			'property="og:title" content="&lt;script>alert(1)&lt;/script> &amp; &quot;title&quot;"'
		);
		expect(head).toContain(
			'property="og:description" content="&lt;img src=x onerror=alert(1)> &amp; &quot;description&quot;"'
		);
		expect(head).toContain(`property="og:url" content="${origin}/documents/${id}"`);
		expect(head).toContain('property="og:type" content="article"');
		expect(head).not.toContain('<script>');
	});
});
