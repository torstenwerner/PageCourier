import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import {
	GetObjectCommand,
	HeadBucketCommand,
	PutObjectCommand,
	type S3Client
} from '@aws-sdk/client-s3';
import type { AppConfig } from './config';
import { logRuntimeEvent, type RuntimeClassification, type RuntimeOperation } from './logging';

export class DocumentFailure extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
	}
}

export function safeFilename(name: string): string {
	const basename = name.split(/[/\\]/).at(-1) ?? '';
	const safe = Array.from(basename)
		.filter((character) => {
			const code = character.charCodeAt(0);
			return code > 31 && (code < 127 || code > 159);
		})
		.join('')
		.replace(/[\u202a-\u202e\u2066-\u2069"<>:|?*]/g, '')
		.trim();
	return Array.from(safe).slice(0, 180).join('') || 'document.md';
}

export function attachment(name: string): string {
	const safe = safeFilename(name);
	const fallback = safe.replace(/[^\x20-\x7e]/g, '_');
	const encoded = encodeURIComponent(safe).replace(
		/[!'()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
	);
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function validId(id: string): boolean {
	return /^[a-f0-9]{32}$/.test(id);
}

function errorName(error: unknown): string {
	return error instanceof Error ? error.name : 'Unknown';
}

function storageClassification(name: string): RuntimeClassification {
	switch (name) {
		case 'AccessDenied':
		case 'NoSuchBucket':
		case 'TimeoutError':
		case 'PreconditionFailed':
		case 'ConditionalRequestConflict':
			return name;
		default:
			return 'StorageFailure';
	}
}

export function operationalFailure(operation: RuntimeOperation, cause: unknown): never {
	// Never serialize provider errors: their messages may contain endpoints or object keys.
	const classification = storageClassification(errorName(cause));
	logRuntimeEvent('error', operation, classification);
	throw new DocumentFailure(503, 'Document storage is temporarily unavailable. Please try again.');
}

export interface StoredDocument {
	bytes: Uint8Array;
	filename: string;
	source: string;
}

export class DocumentStore {
	constructor(
		private readonly client: S3Client,
		private readonly config: AppConfig['storage'],
		private readonly maximumBytes: number,
		private readonly generateId = () => randomBytes(16).toString('hex')
	) {}

	private key(id: string): string {
		const prefix = this.config.keyPrefix.replace(/\/?$/, '/');
		return `${this.config.keyPrefix ? prefix : ''}documents/v1/${id}`;
	}

	async checkReady(): Promise<void> {
		try {
			await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }), {
				abortSignal: AbortSignal.timeout(10_000)
			});
		} catch (cause) {
			operationalFailure('readiness', cause);
		}
	}

	close(): void {
		this.client.destroy();
	}

	async create(bytes: Uint8Array, filename: string): Promise<string> {
		for (let attempt = 0; attempt < 5; attempt++) {
			const id = this.generateId();
			if (!validId(id)) throw new Error('Invalid document ID generator.');
			try {
				await this.client.send(
					new PutObjectCommand({
						Bucket: this.config.bucket,
						Key: this.key(id),
						Body: bytes,
						ContentType: 'text/markdown; charset=utf-8',
						IfNoneMatch: '*',
						Metadata: { filename: Buffer.from(safeFilename(filename)).toString('base64') }
					})
				);
				return id;
			} catch (cause) {
				if (errorName(cause) === 'PreconditionFailed') continue;
				operationalFailure('create', cause);
			}
		}
		operationalFailure('create', new Error('Collision attempts exhausted.'));
	}

	async get(id: string): Promise<StoredDocument> {
		if (!validId(id)) throw new DocumentFailure(404, 'Document not found.');
		try {
			const result = await this.client.send(
				new GetObjectCommand({
					Bucket: this.config.bucket,
					Key: this.key(id)
				}),
				{ abortSignal: AbortSignal.timeout(35_000) }
			);
			if (!(result.Body instanceof Readable)) throw new Error('Missing object body.');
			const body = result.Body;
			const timeout = setTimeout(() => body.destroy(new Error('Object read timed out.')), 10_000);
			try {
				if (result.ContentLength === undefined || result.ContentLength > this.maximumBytes)
					throw new Error('Invalid object size.');
				const chunks: Uint8Array[] = [];
				let size = 0;
				for await (const chunk of body) {
					if (!(chunk instanceof Uint8Array)) throw new Error('Invalid object body.');
					size += chunk.length;
					if (size > this.maximumBytes) throw new Error('Object exceeds read limit.');
					chunks.push(chunk);
				}
				const bytes = Buffer.concat(chunks);
				const encoded = result.Metadata?.filename;
				if (!encoded || encoded.length > 1024) throw new Error('Invalid filename metadata.');
				const filenameBytes = Buffer.from(encoded, 'base64');
				if (filenameBytes.toString('base64') !== encoded)
					throw new Error('Invalid metadata encoding.');
				const filename = new TextDecoder('utf-8', { fatal: true }).decode(filenameBytes);
				if (safeFilename(filename) !== filename || bytes.length !== result.ContentLength)
					throw new Error('Invalid object metadata.');
				const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
				if (!source.trim()) throw new Error('Invalid document content.');
				return { bytes, filename, source };
			} finally {
				clearTimeout(timeout);
				body.destroy();
			}
		} catch (cause) {
			if (errorName(cause) === 'NoSuchKey') throw new DocumentFailure(404, 'Document not found.');
			operationalFailure('get', cause);
		}
	}
}
