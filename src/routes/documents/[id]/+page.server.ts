import { error, fail, redirect } from '@sveltejs/kit';
import { appConfig } from '../../../lib/server/runtime-config';
import { documentStore, documentHeaders } from '../../../lib/server/document-runtime';
import { DocumentFailure } from '../../../lib/server/documents';
import { createUploadedDocument } from '../../../lib/server/create-uploaded-document';
import { renderMarkdown } from '../../../lib/server/markdown';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders(documentHeaders);
	try {
		const document = await documentStore.get(params.id);
		const rendered = renderMarkdown(document.source, document.filename);
		return {
			filename: document.filename,
			id: params.id,
			uploadMaxBytes: appConfig.uploadMaxBytes,
			...rendered,
			canonicalUrl: `${appConfig.publicOrigin}/documents/${params.id}`
		};
	} catch (cause) {
		if (cause instanceof DocumentFailure) error(cause.status, cause.message);
		throw cause;
	}
};

export const actions: Actions = {
	default: async ({ request }) => {
		try {
			redirect(303, await createUploadedDocument(request), { external: true });
		} catch (cause) {
			if (cause instanceof DocumentFailure) return fail(cause.status, { error: cause.message });
			throw cause;
		}
	}
};
