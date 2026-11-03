import { fail, redirect } from '@sveltejs/kit';
import { appConfig } from '../lib/server/runtime-config';
import { DocumentFailure } from '../lib/server/documents';
import { createUploadedDocument } from '../lib/server/create-uploaded-document';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ uploadMaxBytes: appConfig.uploadMaxBytes });

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
