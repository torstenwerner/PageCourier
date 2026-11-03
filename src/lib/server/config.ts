export const DEFAULT_UPLOAD_MAX_BYTES = 5_242_880;

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
	publicOrigin: string;
	host: string;
	port: number;
	uploadMaxBytes: number;
	logLevel: LogLevel;
	storage: {
		bucket: string;
		region: string;
		endpoint?: string;
		forcePathStyle: boolean;
		keyPrefix: string;
	};
}

function invalid(key: string, detail: string): never {
	throw new Error(`Invalid configuration: ${key} ${detail}`);
}

function parseInteger(key: string, value: string, minimum: number, maximum: number): number {
	if (!/^\d+$/.test(value)) {
		return invalid(key, 'must be a whole number.');
	}

	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
		return invalid(key, `must be between ${minimum} and ${maximum}.`);
	}

	return parsed;
}

function parseOrigin(value: string): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch (error) {
		if (error instanceof TypeError) {
			return invalid('PUBLIC_ORIGIN', 'must be a canonical HTTP(S) origin.');
		}
		throw error;
	}

	if (
		(url.protocol !== 'http:' && url.protocol !== 'https:') ||
		url.origin !== value ||
		url.username ||
		url.password
	) {
		return invalid('PUBLIC_ORIGIN', 'must be a canonical HTTP(S) origin without a path.');
	}

	return url.origin;
}

function parseEndpoint(value: string, isProduction: boolean): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch (error) {
		if (error instanceof TypeError) {
			return invalid('S3_ENDPOINT', 'must be a valid HTTP(S) URL.');
		}
		throw error;
	}

	if (
		(url.protocol !== 'http:' && url.protocol !== 'https:') ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		return invalid(
			'S3_ENDPOINT',
			'must be an HTTP(S) URL without credentials, query, or fragment.'
		);
	}

	if (isProduction && url.protocol !== 'https:') {
		return invalid('S3_ENDPOINT', 'must use HTTPS in production.');
	}

	return value;
}

function parseBoolean(key: string, value: string): boolean {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return invalid(key, 'must be either true or false.');
}

function parseLogLevel(value: string): LogLevel {
	if ((LOG_LEVELS as readonly string[]).includes(value)) {
		return value as LogLevel;
	}
	return invalid('LOG_LEVEL', `must be one of ${LOG_LEVELS.join(', ')}.`);
}

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
	const isProduction = env.NODE_ENV === 'production';
	const port = parseInteger('PORT', env.PORT ?? '3000', 1, 65_535);
	const requiredProductionValues = [
		['PUBLIC_ORIGIN', env.PUBLIC_ORIGIN],
		['S3_BUCKET', env.S3_BUCKET],
		['AWS_REGION', env.AWS_REGION]
	].filter(([, value]) => !value);

	if (isProduction && requiredProductionValues.length > 0) {
		throw new Error(
			`Missing required production configuration: ${requiredProductionValues
				.map(([key]) => key)
				.join(', ')}.`
		);
	}

	const host = env.HOST ?? '0.0.0.0';
	if (host.trim() !== host || host.length === 0 || /[/?#\s]/.test(host)) {
		return invalid(
			'HOST',
			'must be a non-empty listen address without whitespace or URL delimiters.'
		);
	}

	const publicOrigin = env.PUBLIC_ORIGIN
		? parseOrigin(env.PUBLIC_ORIGIN)
		: `http://localhost:${port}`;

	const uploadMaxBytes = parseInteger(
		'UPLOAD_MAX_BYTES',
		env.UPLOAD_MAX_BYTES ?? String(DEFAULT_UPLOAD_MAX_BYTES),
		1,
		Number.MAX_SAFE_INTEGER - 65_536
	);

	const logLevel = parseLogLevel(env.LOG_LEVEL ?? 'info');
	const bucket = env.S3_BUCKET ?? 'pagecourier-development';
	const region = env.AWS_REGION ?? 'us-east-1';
	if (bucket.trim() !== bucket || bucket.length === 0) {
		return invalid('S3_BUCKET', 'must be a non-empty bucket name without surrounding whitespace.');
	}
	if (region.trim() !== region || region.length === 0) {
		return invalid('AWS_REGION', 'must be a non-empty region without surrounding whitespace.');
	}

	const endpoint = env.S3_ENDPOINT ? parseEndpoint(env.S3_ENDPOINT, isProduction) : undefined;
	const forcePathStyle = parseBoolean('S3_FORCE_PATH_STYLE', env.S3_FORCE_PATH_STYLE ?? 'false');
	const keyPrefix = env.S3_KEY_PREFIX ?? '';
	if (
		keyPrefix.startsWith('/') ||
		keyPrefix.includes('\\') ||
		keyPrefix.split('/').includes('..')
	) {
		return invalid(
			'S3_KEY_PREFIX',
			'must not start with / or contain backslashes or .. path segments.'
		);
	}

	return {
		publicOrigin,
		host,
		port,
		uploadMaxBytes,
		logLevel,
		storage: {
			bucket,
			region,
			...(endpoint ? { endpoint } : {}),
			forcePathStyle,
			keyPrefix
		}
	};
}
