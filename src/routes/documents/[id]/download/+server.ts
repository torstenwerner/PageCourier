import {
	documentStore,
	documentHeaders,
	failureResponse
} from '../../../../lib/server/document-runtime';
import { attachment } from '../../../../lib/server/documents';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const document = await documentStore.get(params.id);
		return new Response(new Uint8Array(document.bytes), {
			headers: {
				...documentHeaders,
				'content-type': 'text/markdown; charset=utf-8',
				'content-security-policy': "default-src 'none'; sandbox",
				'content-disposition': attachment(document.filename),
				'content-length': String(document.bytes.length)
			}
		});
	} catch (cause) {
		return failureResponse(cause);
	}
};
