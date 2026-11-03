import { appConfig } from './runtime-config';
import { createS3Client } from './storage/client';
import { DocumentStore, DocumentFailure } from './documents';

export const documentStore = new DocumentStore(
	createS3Client(appConfig.storage),
	appConfig.storage,
	appConfig.uploadMaxBytes
);

export const documentHeaders = {
	'cache-control': 'private, no-store',
	'x-robots-tag': 'noindex, nofollow',
	'referrer-policy': 'no-referrer',
	'x-content-type-options': 'nosniff'
};

export function failureResponse(cause: unknown): Response {
	if (!(cause instanceof DocumentFailure)) throw cause;
	return Response.json(
		{ error: cause.message },
		{ status: cause.status, headers: documentHeaders }
	);
}
