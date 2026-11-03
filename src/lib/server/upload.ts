import busboy from 'busboy';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DocumentFailure, safeFilename } from './documents';

export const MULTIPART_OVERHEAD = 65_536;

export async function readUpload(request: Request, maximumBytes: number, origin: string) {
	if (request.headers.get('origin') !== origin)
		throw new DocumentFailure(403, 'Uploads must come from the configured application origin.');
	const contentType = request.headers.get('content-type') ?? '';
	if (!/^multipart\/form-data(?:;|$)/i.test(contentType) || !request.body)
		throw new DocumentFailure(400, 'Submit one Markdown file as multipart form data.');
	const maximumBody = maximumBytes + MULTIPART_OVERHEAD;
	const length = request.headers.get('content-length');
	if (length && (!/^\d+$/.test(length) || Number(length) > maximumBody))
		throw new DocumentFailure(413, 'Upload request is too large.');
	let parser: ReturnType<typeof busboy>;
	try {
		parser = busboy({
			headers: { 'content-type': contentType },
			preservePath: true,
			defParamCharset: 'utf8',
			limits: { fileSize: maximumBytes + 1, files: 1, fields: 0, parts: 2, headerPairs: 32 }
		});
	} catch {
		throw new DocumentFailure(400, 'Malformed multipart upload.');
	}
	let failure: DocumentFailure | undefined;
	let filename = '';
	let fileCount = 0;
	let fileSize = 0;
	const chunks: Buffer[] = [];
	const reject = (status: number, message: string) => {
		failure ??= new DocumentFailure(status, message);
	};
	parser.on('file', (field, stream, info) => {
		fileCount++;
		const originalName = info.filename ?? '';
		filename = safeFilename(originalName);
		if (
			field !== 'file' ||
			!/\.(md|markdown)$/i.test(originalName) ||
			Buffer.byteLength(originalName) > 1024
		)
			reject(400, 'Upload one .md or .markdown file using the file field.');
		stream.on('limit', () => reject(413, `File exceeds the ${maximumBytes}-byte limit.`));
		stream.on('error', () => reject(400, 'Malformed or interrupted multipart upload.'));
		stream.on('data', (chunk: Buffer) => {
			fileSize += chunk.length;
			if (fileSize > maximumBytes) reject(413, `File exceeds the ${maximumBytes}-byte limit.`);
			if (!failure) chunks.push(chunk);
		});
	});
	parser.on('filesLimit', () => reject(400, 'Upload exactly one file.'));
	parser.on('fieldsLimit', () => reject(400, 'Unexpected upload field.'));
	parser.on('partsLimit', () => reject(400, 'Upload exactly one file without additional fields.'));
	let total = 0;
	const limiter = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			total += chunk.length;
			callback(
				total > maximumBody ? new DocumentFailure(413, 'Upload request is too large.') : null,
				chunk
			);
		}
	});
	try {
		await pipeline(
			Readable.fromWeb(request.body as import('node:stream/web').ReadableStream),
			limiter,
			parser,
			{ signal: AbortSignal.timeout(30_000) }
		);
	} catch (cause) {
		if (cause instanceof DocumentFailure) throw cause;
		throw new DocumentFailure(400, 'Malformed or interrupted multipart upload.');
	}
	if (failure) throw failure;
	if (fileCount !== 1) throw new DocumentFailure(400, 'Upload exactly one Markdown file.');
	const bytes = Buffer.concat(chunks);
	let source: string;
	try {
		source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new DocumentFailure(400, 'The file must contain valid UTF-8 text.');
	}
	if (!source.trim()) throw new DocumentFailure(400, 'The file must contain non-whitespace text.');
	return { bytes, filename };
}
