import { appConfig } from './lib/server/runtime-config';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { documentHeaders } from './lib/server/document-runtime';

function allowNonceStyles(response: Response): void {
	const policy = response.headers.get('content-security-policy');
	if (!policy) return;
	const nonce = policy.match(/(?:^|;)\s*script-src\b[^;]*('nonce-[A-Za-z0-9+/_=-]+')/)?.[1];
	if (!nonce) return;

	const directives = policy.split(';').map((directive) => directive.trim());
	const styleIndex = directives.findIndex((directive) => /^style-src\s/i.test(directive));
	if (styleIndex < 0) {
		directives.push(`style-src 'self' ${nonce}`);
	} else if (!directives[styleIndex].includes(nonce)) {
		directives[styleIndex] = `${directives[styleIndex]} ${nonce}`;
	}
	response.headers.set('content-security-policy', directives.join('; '));
}

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
	if (/^\/documents\/[a-f0-9]{32}$/.test(event.url.pathname)) {
		allowNonceStyles(response);
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
