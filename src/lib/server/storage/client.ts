import { S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../config';

export function createS3Client(config: AppConfig['storage']): S3Client {
	return new S3Client({
		region: config.region,
		...(config.endpoint ? { endpoint: config.endpoint } : {}),
		forcePathStyle: config.forcePathStyle,
		maxAttempts: 3,
		requestHandler: {
			connectionTimeout: 3_000,
			requestTimeout: 10_000,
			throwOnRequestTimeout: true
		}
	});
}
