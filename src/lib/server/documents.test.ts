import { Readable } from 'node:stream';
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	HeadBucketCommand
} from '@aws-sdk/client-s3';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DocumentStore, attachment, safeFilename, validId } from './documents';

const config = { bucket: 'test', region: 'us-east-1', forcePathStyle: true, keyPrefix: 'private/' };
const id = 'a'.repeat(32);
afterEach(() => vi.restoreAllMocks());

describe('document storage', () => {
	it('checks bucket readiness with one bounded, non-writing request', async () => {
		const client = new S3Client({ region: config.region });
		const send = vi.spyOn(client, 'send').mockResolvedValue(undefined);
		const store = new DocumentStore(client, config, 100);

		await store.checkReady();

		expect(send).toHaveBeenCalledOnce();
		expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
		expect(send.mock.calls[0][0].input).toEqual({ Bucket: config.bucket });
		expect(send.mock.calls[0][1]?.abortSignal).toBeInstanceOf(AbortSignal);
	});

	it('logs safe readiness failures and returns an operational error', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const client = new S3Client({ region: config.region });
		vi.spyOn(client, 'send').mockRejectedValue(
			Object.assign(new Error('secret endpoint and bucket details'), { name: 'AccessDenied' })
		);

		await expect(new DocumentStore(client, config, 100).checkReady()).rejects.toMatchObject({
			status: 503,
			message: expect.not.stringContaining('secret endpoint')
		});
		const event = log.mock.calls[0][0] as string;
		expect(event).toContain('"operation":"readiness"');
		expect(event).toContain('"classification":"AccessDenied"');
		expect(event).not.toContain('secret endpoint');
	});

	it('destroys its storage client when closed', () => {
		const client = new S3Client({ region: config.region });
		const destroy = vi.spyOn(client, 'destroy').mockImplementation(() => {});

		new DocumentStore(client, config, 100).close();

		expect(destroy).toHaveBeenCalledOnce();
	});

	it('uses create-only server keys, preserves bytes and retries collisions with fresh IDs', async () => {
		const client = new S3Client({ region: config.region });
		const send = vi
			.spyOn(client, 'send')
			.mockRejectedValueOnce(Object.assign(new Error('sensitive'), { name: 'PreconditionFailed' }))
			.mockImplementationOnce(async () => ({}));
		const nextId = 'b'.repeat(32);
		const store = new DocumentStore(
			client,
			config,
			100,
			vi.fn().mockReturnValueOnce(id).mockReturnValueOnce(nextId)
		);
		const bytes = Buffer.from('\ufeff# hello\r\n');
		expect(await store.create(bytes, '../notes.md')).toBe(nextId);
		const commands = send.mock.calls.map(([command]) => command);
		expect(commands[0]).toBeInstanceOf(PutObjectCommand);
		expect(commands.map((command) => command.input)).toEqual([
			expect.objectContaining({ Key: `private/documents/v1/${id}`, IfNoneMatch: '*', Body: bytes }),
			expect.objectContaining({
				Key: `private/documents/v1/${nextId}`,
				IfNoneMatch: '*',
				Body: bytes
			})
		]);
		expect(commands[1].input).toMatchObject({
			Metadata: { filename: Buffer.from('notes.md').toString('base64') }
		});
	});

	it('generates fresh cryptographic 128-bit IDs for identical uploads', async () => {
		const client = new S3Client({ region: config.region });
		vi.spyOn(client, 'send').mockImplementation(async () => ({}));
		const store = new DocumentStore(client, { ...config, keyPrefix: '' }, 100);
		const first = await store.create(Buffer.from('hello'), 'a.md');
		const second = await store.create(Buffer.from('hello'), 'a.md');
		expect(validId(first)).toBe(true);
		expect(first).not.toBe(second);
	});

	it('bounds collision retries and redacts logs', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const client = new S3Client({ region: config.region });
		const send = vi
			.spyOn(client, 'send')
			.mockRejectedValue(Object.assign(new Error('secret'), { name: 'PreconditionFailed' }));
		await expect(
			new DocumentStore(client, config, 100, () => id).create(Buffer.from('hello'), 'a.md')
		).rejects.toMatchObject({ status: 503 });
		expect(send).toHaveBeenCalledTimes(5);
		expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
		expect(JSON.stringify(log.mock.calls)).not.toContain(id);
	});

	it.each(['AccessDenied', 'NoSuchBucket', 'TimeoutError', 'ConditionalRequestConflict'])(
		'reports %s as operational failure rather than not found',
		async (name) => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const client = new S3Client({ region: config.region });
			vi.spyOn(client, 'send').mockRejectedValue(
				Object.assign(new Error('provider secret'), { name })
			);
			const store = new DocumentStore(client, config, 100);
			await expect(store.get(id)).rejects.toMatchObject({ status: 503 });
			await expect(store.create(Buffer.from('hello'), 'a.md')).rejects.toMatchObject({
				status: 503
			});
		}
	);

	it('returns 404 for malformed IDs without touching storage and for missing objects', async () => {
		const client = new S3Client({ region: config.region });
		const send = vi
			.spyOn(client, 'send')
			.mockRejectedValue(Object.assign(new Error(), { name: 'NoSuchKey' }));
		const store = new DocumentStore(client, config, 100);
		await expect(store.get('../private')).rejects.toMatchObject({ status: 404 });
		expect(send).not.toHaveBeenCalled();
		await expect(store.get(id)).rejects.toMatchObject({ status: 404 });
		expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
	});

	it('retrieves exact original bytes and decodes source separately', async () => {
		const client = new S3Client({ region: config.region });
		const bytes = Buffer.from('\ufeff# Hello\r\n');
		vi.spyOn(client, 'send').mockImplementation(async () => ({
			Body: Readable.from([bytes]),
			ContentLength: bytes.length,
			Metadata: { filename: Buffer.from('notes.md').toString('base64') }
		}));
		const result = await new DocumentStore(client, config, 100).get(id);
		expect(result.bytes).toEqual(bytes);
		expect(result.source).toBe('# Hello\r\n');
	});

	it('rejects corrupt metadata and oversized objects', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const client = new S3Client({ region: config.region });
		const send = vi.spyOn(client, 'send');
		for (const value of [
			{ ContentLength: 5, Metadata: { filename: 'invalid' } },
			{ ContentLength: 101, Metadata: { filename: Buffer.from('a.md').toString('base64') } }
		]) {
			send.mockImplementationOnce(async () => ({
				...value,
				Body: Readable.from([Buffer.from('hello')])
			}));
			await expect(new DocumentStore(client, config, 100).get(id)).rejects.toMatchObject({
				status: 503
			});
		}
	});

	it('rejects a stream that exceeds its declared size and closes the body', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const client = new S3Client({ region: config.region });
		const body = Readable.from([Buffer.alloc(101, 65)]);
		vi.spyOn(client, 'send').mockImplementation(async () => ({
			Body: body,
			ContentLength: 5,
			Metadata: { filename: Buffer.from('a.md').toString('base64') }
		}));
		await expect(new DocumentStore(client, config, 100).get(id)).rejects.toMatchObject({
			status: 503
		});
		expect(body.destroyed).toBe(true);
	});
});

describe('safe download names', () => {
	it('removes paths and injection characters, preserving Unicode with encoded headers', () => {
		const filename = safeFilename('..\\../café"\r\n.md');
		expect(filename).toBe('café.md');
		expect(attachment(filename)).toBe(
			'attachment; filename="caf_.md"; filename*=UTF-8\'\'caf%C3%A9.md'
		);
		expect(safeFilename('../')).toBe('document.md');
	});
});
