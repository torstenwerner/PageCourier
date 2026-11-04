import { appConfig } from './lib/server/runtime-config';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { documentHeaders, documentStore } from './lib/server/document-runtime';
import { logRuntimeEvent } from './lib/server/logging';

const securityHeaders: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'no-referrer',
	'x-robots-tag': 'noindex, nofollow',
	'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};
if (appConfig.publicOrigin.startsWith('https://')) {
	securityHeaders['strict-transport-security'] = 'max-age=31536000';
}

function headersForOrigin(origin: string): Record<string, string> {
	const headers = { ...securityHeaders };
	if (origin !== appConfig.publicOrigin) delete headers['strict-transport-security'];
	return headers;
}

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
		logRuntimeEvent('warn', 'request', 'OriginRejected', {
			method: event.request.method,
			route: event.route.id ?? 'unmatched',
			status: 403
		});
		return Response.json(
			{ error: 'Uploads must come from the configured application origin.' },
			{
				status: 403,
				headers: { ...headersForOrigin(event.url.origin), ...documentHeaders }
			}
		);
	}
	const response = await resolve(event);
	for (const [name, value] of Object.entries(headersForOrigin(event.url.origin)))
		response.headers.set(name, value);
	if (event.url.pathname === '/documents' || event.url.pathname.startsWith('/documents/')) {
		for (const [name, value] of Object.entries(documentHeaders)) response.headers.set(name, value);
	}
	if (/^\/documents\/[a-f0-9]{32}$/.test(event.url.pathname)) {
		allowNonceStyles(response);
	}
	logRuntimeEvent('info', 'request', 'Completed', {
		method: event.request.method,
		route: event.route.id ?? 'unmatched',
		status: response.status
	});
	return response;
};

export const handleError: HandleServerError = ({ event, kind }) => {
	if (kind !== 'unknown') return;
	logRuntimeEvent('error', 'request', 'UnexpectedFailure', {
		method: event.request.method,
		route: event.route.id ?? 'unmatched',
		status: 500
	});
	return { message: 'The request could not be completed. Please try again.' };
};

export const init = () => {
	void appConfig;
	process.once('sveltekit:shutdown', () => documentStore.close());
};
