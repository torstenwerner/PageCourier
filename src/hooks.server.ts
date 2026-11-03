import { appConfig } from './lib/server/runtime-config';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { documentHeaders } from './lib/server/document-runtime';

export const handle: Handle = async ({ event, resolve }) => {
	if (
		!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method) &&
		event.request.headers.get('origin') !== appConfig.publicOrigin
	) {
		return Response.json(
			{ error: 'Uploads must come from the configured application origin.' },
			{
				status: 403,
				headers: documentHeaders
			}
		);
	}
	const response = await resolve(event);
	if (event.url.pathname.startsWith('/documents')) {
		for (const [name, value] of Object.entries(documentHeaders)) response.headers.set(name, value);
	}
	return response;
};

export const handleError: HandleServerError = ({ kind }) => {
	if (kind !== 'unknown') return;
	console.error(
		JSON.stringify({ level: 'error', operation: 'request', classification: 'UnexpectedFailure' })
	);
	return { message: 'The request could not be completed. Please try again.' };
};

export const init = () => {
	void appConfig;
};
