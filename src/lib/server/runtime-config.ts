import {
	AWS_REGION,
	HOST,
	LOG_LEVEL,
	PORT,
	PUBLIC_ORIGIN,
	S3_BUCKET,
	S3_ENDPOINT,
	S3_FORCE_PATH_STYLE,
	S3_KEY_PREFIX,
	UPLOAD_MAX_BYTES
} from '$app/env/private';
import { parseConfig } from './config';

export const appConfig = parseConfig({
	...process.env,
	AWS_REGION,
	HOST,
	LOG_LEVEL,
	PORT,
	PUBLIC_ORIGIN,
	S3_BUCKET,
	S3_ENDPOINT,
	S3_FORCE_PATH_STYLE,
	S3_KEY_PREFIX,
	UPLOAD_MAX_BYTES
});
