import { documentHeaders, failureResponse } from '../../lib/server/document-runtime';
import { createUploadedDocument } from '../../lib/server/create-uploaded-document';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const location = await createUploadedDocument(request);
		return new Response(null, {
			status: 303,
			headers: { ...documentHeaders, location }
		});
	} catch (cause) {
		return failureResponse(cause);
	}
};
