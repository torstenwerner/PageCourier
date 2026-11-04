import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentFailure } from '../../lib/server/documents';

const { checkReady } = vi.hoisted(() => ({ checkReady: vi.fn() }));
vi.mock('../../lib/server/document-runtime', () => ({
	documentStore: { checkReady },
	healthHeaders: {
		'cache-control': 'no-store',
		'content-type': 'application/json; charset=utf-8'
	}
}));

import { GET as live } from './live/+server';
import { GET as ready } from './ready/+server';

beforeEach(() => vi.clearAllMocks());

describe('health endpoints', () => {
	it('keeps liveness healthy without checking storage', async () => {
		const response = await live({} as Parameters<typeof live>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(checkReady).not.toHaveBeenCalled();
	});

	it('reports ready after the storage check succeeds', async () => {
		checkReady.mockResolvedValue(undefined);
		const response = await ready({} as Parameters<typeof ready>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'ready' });
		expect(checkReady).toHaveBeenCalledOnce();
	});

	it('reports storage failure as unavailable without exposing provider details', async () => {
		checkReady.mockRejectedValue(
			new DocumentFailure(503, 'Document storage is temporarily unavailable. Please try again.')
		);
		const response = await ready({} as Parameters<typeof ready>[0]);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			status: 'not_ready',
			error: 'Document storage is temporarily unavailable. Please try again.'
		});
	});
});
