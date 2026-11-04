import { beforeEach, describe, expect, it, vi } from 'vitest';

const { close } = vi.hoisted(() => ({ close: vi.fn() }));
vi.mock('./lib/server/runtime-config', () => ({
	appConfig: { publicOrigin: 'https://pages.example.com' }
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
	vi.clearAllMocks();
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('runtime request hardening', () => {
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
