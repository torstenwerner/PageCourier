import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const bucket = 'pagecourier-test';
const objects = new Map();
const storage = createServer(async (request, response) => {
	const url = new URL(request.url ?? '/', 'http://127.0.0.1');
	const prefix = `/${bucket}/`;
	if (
		request.method === 'HEAD' &&
		(url.pathname === `/${bucket}` || url.pathname === `/${bucket}/`)
	) {
		response.writeHead(200).end();
		return;
	}
	if (!url.pathname.startsWith(prefix)) {
		response.writeHead(404).end();
		return;
	}

	const key = decodeURIComponent(url.pathname.slice(prefix.length));
	if (request.method === 'PUT') {
		const filename = Buffer.from(request.headers['x-amz-meta-filename'] ?? '', 'base64').toString(
			'utf8'
		);
		if (filename === 'storage-fail.md') {
			request.resume();
			response
				.writeHead(503, { 'content-type': 'application/xml' })
				.end('<Error><Code>InternalError</Code><Message>Test storage failure</Message></Error>');
			return;
		}
		if (filename === 'slow.md') await new Promise((resolve) => setTimeout(resolve, 300));
		if (request.headers['if-none-match'] === '*' && objects.has(key)) {
			request.resume();
			response
				.writeHead(412, { 'content-type': 'application/xml' })
				.end('<Error><Code>PreconditionFailed</Code></Error>');
			return;
		}
		const chunks = [];
		for await (const chunk of request) chunks.push(chunk);
		objects.set(key, {
			bytes: Buffer.concat(chunks),
			filename: request.headers['x-amz-meta-filename'],
			contentType: request.headers['content-type'] ?? 'application/octet-stream'
		});
		response.writeHead(200, { etag: '"e2e-object"' }).end();
		return;
	}

	if (request.method === 'GET') {
		const object = objects.get(key);
		if (!object) {
			response
				.writeHead(404, { 'content-type': 'application/xml' })
				.end('<Error><Code>NoSuchKey</Code><Message>Not found</Message></Error>');
			return;
		}
		response.writeHead(200, {
			'content-length': object.bytes.length,
			'content-type': object.contentType,
			'x-amz-meta-filename': object.filename,
			etag: '"e2e-object"'
		});
		response.end(object.bytes);
		return;
	}

	response.writeHead(405).end();
});

await new Promise((resolve, reject) => {
	storage.once('error', reject);
	storage.listen(0, '127.0.0.1', resolve);
});
const address = storage.address();
if (!address || typeof address === 'string')
	throw new Error('Could not start the test object store.');

const app = spawn(process.execPath, ['build/index.js'], {
	env: {
		...process.env,
		NODE_ENV: 'development',
		HOST: '127.0.0.1',
		PORT: process.env.PORT ?? '4173',
		PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:4173',
		S3_BUCKET: bucket,
		AWS_REGION: 'us-east-1',
		AWS_ACCESS_KEY_ID: 'test',
		AWS_SECRET_ACCESS_KEY: 'test',
		S3_ENDPOINT: `http://127.0.0.1:${address.port}`,
		S3_FORCE_PATH_STYLE: 'true',
		UPLOAD_MAX_BYTES: '5242880',
		BODY_SIZE_LIMIT: '5308416'
	},
	stdio: 'inherit'
});

const stop = () => {
	if (app.exitCode === null) app.kill('SIGTERM');
	storage.close();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

const [code, signal] = await once(app, 'exit');
storage.close();
if (signal) process.exitCode = 1;
else process.exitCode = code ?? 1;
