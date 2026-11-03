import { appConfig } from './runtime-config';
import { documentStore } from './document-runtime';
import { readUpload } from './upload';

export async function createUploadedDocument(request: Request): Promise<string> {
	const { bytes, filename } = await readUpload(
		request,
		appConfig.uploadMaxBytes,
		appConfig.publicOrigin
	);
	const id = await documentStore.create(bytes, filename);
	return `${appConfig.publicOrigin}/documents/${id}`;
}
