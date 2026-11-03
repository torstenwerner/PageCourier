import { appConfig } from '../../lib/server/runtime-config';
import { documentStore, documentHeaders, failureResponse } from '../../lib/server/document-runtime';
import { readUpload } from '../../lib/server/upload';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { bytes, filename } = await readUpload(
			request,
			appConfig.uploadMaxBytes,
			appConfig.publicOrigin
		);
		const id = await documentStore.create(bytes, filename);
		return new Response(null, {
			status: 303,
			headers: { ...documentHeaders, location: `${appConfig.publicOrigin}/documents/${id}` }
		});
	} catch (cause) {
		return failureResponse(cause);
	}
};
