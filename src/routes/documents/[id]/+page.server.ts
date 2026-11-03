import { error } from '@sveltejs/kit';
import { documentStore, documentHeaders } from '../../../lib/server/document-runtime';
import { DocumentFailure } from '../../../lib/server/documents';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders(documentHeaders);
	try {
		const document = await documentStore.get(params.id);
		return { filename: document.filename, source: document.source, id: params.id };
	} catch (cause) {
		if (cause instanceof DocumentFailure) error(cause.status, cause.message);
		throw cause;
	}
};
