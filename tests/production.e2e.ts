import { expect, test } from '@playwright/test';
import { compose, waitForReady, withStorageOutage } from './compose';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	S3Client
} from '@aws-sdk/client-s3';

test('local hostname aliases redirect before browser uploads', async ({ page, baseURL }) => {
	test.skip(!process.env.E2E_COMPOSE_PROJECT, 'Requires the isolated production Compose stack.');
	if (!baseURL) throw new Error('Missing acceptance origin.');
	const alias = new URL(baseURL);
	alias.hostname = 'localhost';
	await page.goto(`${alias.origin}/?source=alias`);
	await expect(page).toHaveURL(`${baseURL}/?source=alias`);
	await page.locator('input[type="file"]').setInputFiles({
		name: 'alias.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('# Alias upload\n')
	});
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(new RegExp(`^${baseURL}/documents/[a-f0-9]{32}$`));
	await expect(page.getByRole('heading', { name: 'Alias upload', exact: true })).toBeVisible();
});

test('production containers preserve documents across replacement, replicas and storage restarts', async ({
	request,
	baseURL
}) => {
	test.skip(!process.env.E2E_COMPOSE_PROJECT, 'Requires the isolated production Compose stack.');
	const replica = process.env.E2E_REPLICA_URL;
	if (!baseURL || !replica) throw new Error('Missing acceptance origins.');
	const bucket = 'pagecourier-development';
	const admin = new S3Client({
		endpoint: process.env.MINIO_TEST_ENDPOINT,
		region: 'us-east-1',
		forcePathStyle: true,
		maxAttempts: 1,
		credentials: {
			accessKeyId: 'local-development-admin',
			secretAccessKey: 'local-development-admin-password'
		}
	});
	const maximum = 5_242_880;
	const prefix = Buffer.from('\ufeff# Container boundary\r\nOriginal bytes.\r\n');
	const original = Buffer.concat([prefix, Buffer.alloc(maximum - prefix.length, 32)]);
	const upload = (buffer: Buffer, name = 'café.MARKDOWN', origin = baseURL) =>
		request.post('/documents', {
			headers: { Origin: origin, Host: 'untrusted.example' },
			multipart: { file: { name, mimeType: 'application/octet-stream', buffer } },
			maxRedirects: 0
		});
	const getCount = async () =>
		(await admin.send(new ListObjectsV2Command({ Bucket: bucket }))).KeyCount;
	try {
		expect(original.length).toBe(maximum);
		const saved = await upload(original);
		expect(saved.status()).toBe(303);
		const location = saved.headers().location;
		expect(location).toMatch(new RegExp(`^${baseURL}/documents/[a-f0-9]{32}$`));
		const path = new URL(location).pathname;
		const key = `documents/v1/${path.split('/').at(-1)}`;
		const duplicate = await upload(original);
		expect(duplicate.status()).toBe(303);
		expect(duplicate.headers().location).not.toBe(location);
		const persisted = await admin.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
		if (!persisted.Body) throw new Error('MinIO returned no object body.');
		expect(Buffer.from(await persisted.Body.transformToByteArray())).toEqual(original);
		const appStorage = new S3Client({
			endpoint: process.env.MINIO_TEST_ENDPOINT,
			region: 'us-east-1',
			forcePathStyle: true,
			maxAttempts: 1,
			credentials: {
				accessKeyId: 'local-development-app',
				secretAccessKey: 'local-development-app-password'
			}
		});
		try {
			await expect(
				appStorage.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
			).rejects.toMatchObject({ name: 'AccessDenied' });
		} finally {
			appStorage.destroy();
		}

		const checkReadable = async (origin: string) => {
			const page = await request.get(`${origin}${path}`);
			expect(page.status()).toBe(200);
			expect(await page.text()).toContain('Container boundary');
			const download = await request.get(`${origin}${path}/download`);
			expect(download.status()).toBe(200);
			expect(await download.body()).toEqual(original);
			expect(download.headers()['content-disposition']).toContain(
				"filename*=UTF-8''caf%C3%A9.MARKDOWN"
			);
			for (const response of [page, download]) {
				expect(response.headers()['cache-control']).toBe('private, no-store');
				expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
				expect(response.headers()['referrer-policy']).toBe('no-referrer');
				expect(response.headers()['x-content-type-options']).toBe('nosniff');
			}
		};
		await checkReadable(baseURL);
		await checkReadable(replica);
		const oldId = (await compose('ps', '-q', 'app')).trim();
		await compose('up', '--detach', '--no-deps', '--force-recreate', 'app');
		expect((await compose('ps', '-q', 'app')).trim()).not.toBe(oldId);
		await waitForReady(baseURL);
		await checkReadable(baseURL);
		await compose('restart', 'app');
		await waitForReady(baseURL);
		await checkReadable(baseURL);
		await compose('restart', 'minio');
		await waitForReady(baseURL);
		await checkReadable(baseURL);
		await checkReadable(replica);
		await compose('down');
		await compose('up', '--detach', '--wait', '--wait-timeout', '90');
		await checkReadable(baseURL);
		await checkReadable(replica);

		const beforeRejected = await getCount();
		for (const [buffer, name, status] of [
			[Buffer.alloc(maximum + 1, 65), 'large.md', 413],
			[Buffer.alloc(0), 'empty.md', 400],
			[Buffer.from(' \r\n\t'), 'blank.md', 400],
			[Buffer.from([0xff]), 'invalid.md', 400],
			[Buffer.from('# Invalid'), 'invalid.txt', 400]
		] as const) {
			const rejected = await upload(buffer, name);
			expect(rejected.status()).toBe(status);
			expect(rejected.headers().location).toBeUndefined();
		}
		expect(
			(await upload(Buffer.from('# Rejected'), 'origin.md', 'https://evil.example')).status()
		).toBe(403);
		expect(await getCount()).toBe(beforeRejected);
		expect((await request.get('/documents/invalid')).status()).toBe(404);
		expect((await request.get(`/documents/${'0'.repeat(32)}/download`)).status()).toBe(404);

		const probeCount = await getCount();
		for (let i = 0; i < 3; i++) expect((await request.get('/health/ready')).status()).toBe(200);
		expect(await getCount()).toBe(probeCount);
		await withStorageOutage(baseURL, async () => {
			const failed = await upload(Buffer.from('# Not saved'));
			expect(failed.status()).toBe(503);
			expect(failed.headers().location).toBeUndefined();
			for (const suffix of ['', '/download']) {
				const response = await request.get(`${baseURL}${path}${suffix}`);
				expect(response.status()).toBe(503);
				expect(await response.text()).not.toContain('minio:9000');
			}
			expect((await request.get('/health/live')).status()).toBe(200);
			expect((await request.get('/health/ready')).status()).toBe(503);
		});
		expect(await getCount()).toBe(probeCount);
		await checkReadable(replica);
		await admin.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
		for (const origin of [baseURL, replica]) {
			expect((await request.get(`${origin}${path}`)).status()).toBe(404);
			expect((await request.get(`${origin}${path}/download`)).status()).toBe(404);
		}

		const metadata = await upload(
			Buffer.from('# \\<Title\\> & "quotes"\n\nA **plain** excerpt.'),
			'metadata.md'
		);
		expect(metadata.status()).toBe(303);
		const html = await (await request.get(metadata.headers().location)).text();
		expect(html).toContain('property="og:type" content="article"');
		expect(html).toContain('property="og:title" content="&lt;Title> &amp; &quot;quotes&quot;"');
		expect(html).toContain(
			'property="og:description" content="&lt;Title> &amp; &quot;quotes&quot; A plain excerpt."'
		);
		expect(html).toContain(`property="og:url" content="${metadata.headers().location}"`);

		const logs = await compose('logs', '--no-color', 'app', 'replica');
		expect(logs).not.toContain(path.split('/').at(-1));
		expect(logs).not.toContain('Original bytes.');
		expect(logs).not.toContain('local-development-app-password');
		expect(logs).not.toContain('http://minio:9000');
		expect(logs).toContain('"classification"');

		const runtime = await compose(
			'exec',
			'-T',
			'app',
			'node',
			'-e',
			`
			const fs = require('node:fs');
			if (process.getuid() === 0) throw new Error('Root user');
			if (process.env.NODE_ENV !== 'production') throw new Error('Not production');
			if (fs.existsSync('/app/node_modules/vite')) throw new Error('Development dependency');
			try { fs.writeFileSync('/app/root-write', 'bad'); throw new Error('Writable root'); }
			catch (error) { if (error.code !== 'EROFS' && error.code !== 'EACCES') throw error; }
			fs.writeFileSync('/tmp/probe', 'temporary'); fs.unlinkSync('/tmp/probe');
			const mounts = fs.readFileSync('/proc/mounts', 'utf8');
			if (!/^\\S+ \\/ \\S+ ro[, ]/m.test(mounts)) throw new Error('Root mount not read-only');
			if (!/tmpfs \\/tmp tmpfs .*size=16384k/.test(mounts)) throw new Error('Unbounded tmpfs');
			const status = fs.readFileSync('/proc/self/status', 'utf8');
			if (!/^CapEff:\\s+0+$/m.test(status)) throw new Error('Effective capabilities');
			if (!/^NoNewPrivs:\\s+1$/m.test(status)) throw new Error('Privilege escalation allowed');
			console.log('hardened');
		`
		);
		expect(runtime).toContain('hardened');
		await compose('stop', 'app');
		const state = JSON.parse(await compose('ps', '--all', '--format', 'json', 'app'));
		expect(state.ExitCode).toBe(0);
		await compose('start', 'app');
		await waitForReady(baseURL);
	} finally {
		admin.destroy();
	}
});
