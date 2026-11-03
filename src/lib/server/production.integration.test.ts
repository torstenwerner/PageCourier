import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
	CreateBucketCommand,
	DeleteBucketCommand,
	DeleteObjectCommand,
	ListObjectsV2Command,
	S3Client
} from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

const endpoint = process.env.MINIO_TEST_ENDPOINT;

async function cleanBucket(client: S3Client, bucket: string) {
	try {
		const objects = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
		for (const object of objects.Contents ?? [])
			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
		await client.send(new DeleteBucketCommand({ Bucket: bucket }));
	} catch (cause) {
		if (!(cause instanceof Error) || cause.name !== 'NoSuchBucket') throw cause;
	}
}

async function freePort(): Promise<number> {
	const server = createServer();
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No test port.');
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
	return address.port;
}

describe.skipIf(!endpoint?.startsWith('https:'))('production adapter with MinIO TLS', () => {
	it('validates real uploads, uses canonical redirects, and retrieves from another replica', async () => {
		const bucket = `pagecourier-http-${randomBytes(8).toString('hex')}`;
		const client = new S3Client({
			endpoint,
			region: 'us-east-1',
			forcePathStyle: true,
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ''
			}
		});
		const ports = [await freePort(), await freePort()];
		const origin = `http://127.0.0.1:${ports[0]}`;
		const processes: ChildProcess[] = [];
		const logs: string[] = [];
		const maximum = 524_288; // Multipart overhead exceeds the Node adapter's default body limit.
		await client.send(new CreateBucketCommand({ Bucket: bucket }));
		try {
			for (const port of ports) {
				const child = spawn(process.execPath, ['scripts/start.mjs'], {
					env: {
						...process.env,
						PUBLIC_ORIGIN: origin,
						HOST: '127.0.0.1',
						PORT: String(port),
						S3_BUCKET: bucket,
						AWS_REGION: 'us-east-1',
						S3_ENDPOINT: endpoint,
						S3_FORCE_PATH_STYLE: 'true',
						S3_KEY_PREFIX: '',
						UPLOAD_MAX_BYTES: String(maximum)
					},
					stdio: ['ignore', 'pipe', 'pipe']
				});
				processes.push(child);
				child.stdout?.on('data', (chunk) => logs.push(String(chunk)));
				child.stderr?.on('data', (chunk) => logs.push(String(chunk)));
				let ready = false;
				for (let attempt = 0; attempt < 100; attempt++) {
					if (child.exitCode !== null) throw new Error(`App exited: ${logs.join('')}`);
					try {
						const response = await fetch(`http://127.0.0.1:${port}/`, {
							signal: AbortSignal.timeout(500)
						});
						if (response.ok) {
							ready = true;
							break;
						}
					} catch (cause) {
						if (!(cause instanceof TypeError) && !(cause instanceof DOMException)) throw cause;
					}
					await delay(100);
				}
				if (!ready) throw new Error('Production app did not become ready.');
			}
			const upload = async (bytes: Uint8Array, name = 'café.md', requestOrigin = origin) => {
				const form = new FormData();
				form.append('file', new Blob([new Uint8Array(bytes)], { type: 'text/plain' }), name);
				return fetch(`${origin}/documents`, {
					method: 'POST',
					headers: { origin: requestOrigin, host: 'untrusted.example' },
					body: form,
					redirect: 'manual'
				});
			};
			const prefix = Buffer.from('\ufeff# Hello\r\n<script>alert(1)</script>');
			const bytes = Buffer.concat([prefix, Buffer.alloc(maximum - prefix.length, 32)]);
			expect(bytes.length).toBe(maximum);
			const response = await upload(bytes);
			expect(response.status).toBe(303);
			const location = response.headers.get('location');
			expect(location).toMatch(new RegExp(`^${origin}/documents/[a-f0-9]{32}$`));
			if (!location) throw new Error('Missing document location.');
			const duplicate = await upload(bytes);
			expect(duplicate.status).toBe(303);
			expect(duplicate.headers.get('location')).not.toBe(location);
			const path = new URL(location).pathname;
			const replica = `http://127.0.0.1:${ports[1]}`;
			const download = await fetch(`${replica}${path}/download`);
			expect(download.status).toBe(200);
			expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
			expect(download.headers.get('content-disposition')).toContain(
				"filename*=UTF-8''caf%C3%A9.md"
			);
			expect(download.headers.get('cache-control')).toBe('private, no-store');
			const page = await fetch(`${replica}${path}`);
			expect(page.status).toBe(200);
			const html = await page.text();
			expect(html).toContain('# Hello');
			expect(html).toContain('&lt;script');
			expect(html).not.toContain('<script>alert(1)</script>');
			expect(page.headers.get('content-security-policy')).toContain("object-src 'none'");
			for (const [invalid, filename, expected] of [
				[Buffer.alloc(maximum + 1, 65), 'a.md', 413],
				[Buffer.from([0xff]), 'a.md', 400],
				[Buffer.from(' \t\r\n'), 'a.md', 400],
				[Buffer.from('hello'), 'a.txt', 400]
			] as const) {
				const rejected = await upload(invalid, filename);
				expect(rejected.status).toBe(expected);
				expect(rejected.headers.get('location')).toBeNull();
			}
			expect((await upload(Buffer.from('hello'), 'a.md', 'https://evil.example')).status).toBe(403);
			const objects = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
			expect(objects.Contents).toHaveLength(2);
			expect((await fetch(`${replica}/documents/invalid/download`)).status).toBe(404);
			await client.send(
				new DeleteObjectCommand({ Bucket: bucket, Key: `documents/v1/${path.split('/').at(-1)}` })
			);
			expect((await fetch(`${replica}${path}/download`)).status).toBe(404);
			expect((await fetch(`${replica}${path}`)).status).toBe(404);
			await client.send(
				new DeleteObjectCommand({
					Bucket: bucket,
					Key: `documents/v1/${duplicate.headers.get('location')?.split('/').at(-1)}`
				})
			);
			await client.send(new DeleteBucketCommand({ Bucket: bucket }));
			// Missing buckets are operational failures, not missing documents.
			const failed = await upload(Buffer.from('hello'));
			expect(failed.status).toBe(503);
			expect(failed.headers.get('location')).toBeNull();
			expect((await fetch(`${replica}${path}/download`)).status).toBe(503);
			expect(logs.join('')).not.toContain(path.split('/').at(-1));
			expect(logs.join('')).not.toContain(endpoint);
			expect(logs.join('')).not.toContain('# Hello');
		} finally {
			for (const child of processes) {
				if (child.exitCode === null) {
					const closed = once(child, 'close');
					child.kill('SIGTERM');
					await closed;
				}
			}
			await cleanBucket(client, bucket);
			client.destroy();
		}
	}, 30_000);
});
