import { describe, expect, it } from 'vitest';
import { DEFAULT_UPLOAD_MAX_BYTES, parseConfig } from './config';

describe('parseConfig', () => {
	it('provides documented development defaults', () => {
		const config = parseConfig({ NODE_ENV: 'development' });

		expect(config).toMatchObject({
			publicOrigin: 'http://localhost:3000',
			host: '0.0.0.0',
			port: 3000,
			uploadMaxBytes: DEFAULT_UPLOAD_MAX_BYTES,
			logLevel: 'info',
			storage: {
				bucket: 'pagecourier-development',
				region: 'us-east-1',
				forcePathStyle: false,
				keyPrefix: ''
			}
		});
	});

	it('derives the local origin from a custom listen port', () => {
		expect(parseConfig({ PORT: '4173' }).publicOrigin).toBe('http://localhost:4173');
	});

	it('requires the public origin and S3 location in production', () => {
		expect(() => parseConfig({ NODE_ENV: 'production' })).toThrow(
			'Missing required production configuration: PUBLIC_ORIGIN, S3_BUCKET, AWS_REGION.'
		);
	});

	it.each([
		'https://pages.example.com/path',
		'https://pages.example.com/',
		'ftp://pages.example.com'
	])('rejects non-canonical public origins: %s', (PUBLIC_ORIGIN) => {
		expect(() => parseConfig({ PUBLIC_ORIGIN })).toThrow(
			'PUBLIC_ORIGIN must be a canonical HTTP(S) origin'
		);
	});

	it.each(['0', '-1', '5.5', '9007199254740992'])(
		'rejects invalid upload limits: %s',
		(UPLOAD_MAX_BYTES) => {
			expect(() => parseConfig({ UPLOAD_MAX_BYTES })).toThrow(
				'Invalid configuration: UPLOAD_MAX_BYTES'
			);
		}
	);

	it('rejects invalid listen ports', () => {
		expect(() => parseConfig({ PORT: '65536' })).toThrow(
			'Invalid configuration: PORT must be between 1 and 65535.'
		);
	});

	it('rejects invalid booleans and path prefixes', () => {
		expect(() => parseConfig({ S3_FORCE_PATH_STYLE: 'yes' })).toThrow(
			'Invalid configuration: S3_FORCE_PATH_STYLE'
		);
		expect(() => parseConfig({ S3_KEY_PREFIX: 'documents/../private' })).toThrow(
			'Invalid configuration: S3_KEY_PREFIX'
		);
	});

	it('requires HTTPS for a production S3 endpoint', () => {
		expect(() =>
			parseConfig({
				NODE_ENV: 'production',
				PUBLIC_ORIGIN: 'https://pages.example.com',
				S3_BUCKET: 'pagecourier',
				AWS_REGION: 'us-east-1',
				S3_ENDPOINT: 'http://minio.internal:9000'
			})
		).toThrow('S3_ENDPOINT must use HTTPS in production.');
	});

	it('allows explicitly opted-in local HTTP only with a loopback canonical origin', () => {
		const env = {
			NODE_ENV: 'production',
			PUBLIC_ORIGIN: 'http://127.0.0.1:3000',
			S3_BUCKET: 'pagecourier-development',
			AWS_REGION: 'us-east-1',
			S3_ENDPOINT: 'http://minio:9000',
			S3_ALLOW_LOCAL_HTTP: 'true'
		};
		expect(parseConfig(env).storage.endpoint).toBe(env.S3_ENDPOINT);
		expect(() => parseConfig({ ...env, S3_ALLOW_LOCAL_HTTP: 'yes' })).toThrow(
			'S3_ALLOW_LOCAL_HTTP'
		);
		expect(() => parseConfig({ ...env, PUBLIC_ORIGIN: 'https://pages.example.com' })).toThrow(
			'requires a loopback PUBLIC_ORIGIN'
		);
		expect(() => parseConfig({ ...env, S3_ENDPOINT: 'http://storage.example.com' })).toThrow(
			'must use HTTPS in production'
		);
		expect(() => parseConfig({ ...env, S3_ALLOW_LOCAL_HTTP: 'false' })).toThrow(
			'must use HTTPS in production'
		);
	});
});
