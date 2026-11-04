import { documentStore, healthHeaders } from '../../../lib/server/document-runtime';
import { DocumentFailure } from '../../../lib/server/documents';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		await documentStore.checkReady();
		return Response.json({ status: 'ready' }, { headers: healthHeaders });
	} catch (cause) {
		if (!(cause instanceof DocumentFailure)) throw cause;
		return Response.json(
			{ status: 'not_ready', error: cause.message },
			{ status: cause.status, headers: healthHeaders }
		);
	}
};
