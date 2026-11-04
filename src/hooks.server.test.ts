import { beforeEach, describe, expect, it, vi } from 'vitest';

const { close, appConfig } = vi.hoisted(() => ({
	close: vi.fn(),
	appConfig: { publicOrigin: 'https://pages.example.com' }
}));
vi.mock('./lib/server/runtime-config', () => ({
	appConfig
}));
vi.mock('./lib/server/document-runtime', () => ({
	documentHeaders: {
		'cache-control': 'private, no-store',
		'x-robots-tag': 'noindex, nofollow',
		'referrer-policy': 'no-referrer',
		'x-content-type-options': 'nosniff'
	},
	documentStore: { close }
}));

import { handle, init } from './hooks.server';

const id = 'a'.repeat(32);

function event(url: string, method = 'GET', origin?: string) {
	const headers = new Headers();
	if (origin) headers.set('origin', origin);
	return {
		request: new Request(url, { method, headers }),
		url: new URL(url),
		route: { id: '/documents/[id]' }
	} as Parameters<typeof handle>[0]['event'];
}

beforeEach(() => {
	appConfig.publicOrigin = 'https://pages.example.com';
	vi.clearAllMocks();
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('runtime request hardening', () => {
	it.each([
		['GET', 'http://localhost', '/?source=local'],
		['GET', 'https://localhost', '/?source=local'],
		['HEAD', 'http://[::1]', `/documents/${id}?source=local`]
	])(
		'redirects local %s page visits from %s before displaying upload forms',
		async (method, host, path) => {
			appConfig.publicOrigin = 'http://127.0.0.1:3000';
			const resolve = vi.fn(async () => new Response('unexpected'));
			const response = await handle({
				event: event(`${host}:3000${path}`, method),
				resolve
			} as Parameters<typeof handle>[0]);

			expect(response.status).toBe(307);
			expect(response.headers.get('location')).toBe(`${appConfig.publicOrigin}${path}`);
			expect(response.headers.get('cache-control')).toBe('private, no-store');
			expect(resolve).not.toHaveBeenCalled();
		}
	);

	it.each([
		'http://127.0.0.1:3000/',
		'https://127.0.0.1:3000/',
		'http://localhost:3001/',
		'http://attacker.example:3000/',
		'http://localhost:3000/health/ready',
		`http://localhost:3000/documents/${id}/download`
	])('does not canonicalize unrelated reads or API requests: %s', async (url) => {
		appConfig.publicOrigin = 'http://127.0.0.1:3000';
		const resolve = vi.fn(async () => new Response('unchanged'));
		const response = await handle({
			event: event(url),
			resolve
		} as Parameters<typeof handle>[0]);
		expect(response.status).toBe(200);
		expect(response.headers.get('location')).toBeNull();
		expect(resolve).toHaveBeenCalledOnce();
	});

	it.each([undefined, 'null', 'http://localhost:3000', 'http://evil.example:3000'])(
		'still rejects local writes with a non-canonical origin: %s',
		async (origin) => {
			appConfig.publicOrigin = 'http://127.0.0.1:3000';
			const resolve = vi.fn(async () => new Response('unexpected'));
			const response = await handle({
				event: event('http://localhost:3000/', 'POST', origin),
				resolve
			} as Parameters<typeof handle>[0]);
			expect(response.status).toBe(403);
			expect(response.headers.get('location')).toBeNull();
			expect(resolve).not.toHaveBeenCalled();
		}
	);

	it('adds private document and browser security headers while retaining the CSP nonce', async () => {
		const log = vi.spyOn(console, 'info');
		const response = await handle({
			event: event(`https://pages.example.com/documents/${id}`),
			resolve: async () =>
				new Response('document', {
					headers: {
						'content-security-policy': "default-src 'self'; script-src 'nonce-test-nonce'"
					}
				})
		} as Parameters<typeof handle>[0]);

		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('x-frame-options')).toBe('DENY');
		expect(response.headers.get('permissions-policy')).toBe(
			'camera=(), microphone=(), geolocation=()'
		);
		expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000');
		expect(response.headers.get('content-security-policy')).toContain(
			"style-src 'self' 'nonce-test-nonce'"
		);
		const logEvent = log.mock.calls.at(-1)?.[0];
		expect(typeof logEvent).toBe('string');
		if (typeof logEvent !== 'string') throw new Error('Request log event is missing.');
		expect(JSON.parse(logEvent)).toMatchObject({
			operation: 'request',
			classification: 'Completed',
			route: '/documents/[id]'
		});
		expect(logEvent).not.toContain(id);
	});

	it('does not apply configured-origin HSTS to an untrusted request host', async () => {
		const response = await handle({
			event: event(`https://attacker.example/documents/${id}`),
			resolve: async () => new Response('document')
		} as Parameters<typeof handle>[0]);

		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(response.headers.get('strict-transport-security')).toBeNull();
	});

	it('rejects disallowed writes before route handling and keeps the response private', async () => {
		const resolve = vi.fn(async () => new Response('unexpected'));
		const response = await handle({
			event: event('https://attacker.example/documents', 'POST', 'https://evil.example'),
			resolve
		} as Parameters<typeof handle>[0]);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Uploads must come from the configured application origin.'
		});
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(response.headers.get('strict-transport-security')).toBeNull();
		expect(resolve).not.toHaveBeenCalled();
	});

	it('closes the storage client after the adapter drains requests on shutdown', () => {
		init();
		process.emit('sveltekit:shutdown');
		expect(close).toHaveBeenCalledOnce();
	});
});
