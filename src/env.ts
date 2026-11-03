import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_ORIGIN: {
		description: 'Canonical public HTTP(S) origin.',
		schema: (value) => value
	},
	HOST: {
		description: 'Listen address for the Node server.',
		schema: (value) => value
	},
	PORT: {
		description: 'Listen port for the Node server.',
		schema: (value) => value
	},
	UPLOAD_MAX_BYTES: {
		description: 'Maximum allowed upload size in bytes.',
		schema: (value) => value
	},
	LOG_LEVEL: {
		description: 'Application log level.',
		schema: (value) => value
	},
	S3_BUCKET: {
		description: 'S3-compatible bucket name.',
		schema: (value) => value
	},
	AWS_REGION: {
		description: 'AWS region for the configured bucket.',
		schema: (value) => value
	},
	S3_ENDPOINT: {
		description: 'Optional custom S3-compatible endpoint.',
		schema: (value) => value
	},
	S3_FORCE_PATH_STYLE: {
		description: 'Use path-style S3 addressing when true.',
		schema: (value) => value
	},
	S3_KEY_PREFIX: {
		description: 'Optional key prefix for storage isolation.',
		schema: (value) => value
	}
});
