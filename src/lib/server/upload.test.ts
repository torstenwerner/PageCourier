import { describe, expect, it } from 'vitest';
import { readUpload, MULTIPART_OVERHEAD } from './upload';

const origin = 'https://pages.example.com';
function request(
	bytes: Uint8Array,
	filename = 'notes.MARKDOWN',
	mime = 'application/octet-stream'
) {
	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), filename);
	return new Request(`${origin}/documents`, { method: 'POST', headers: { origin }, body: form });
}

describe('multipart validation', () => {
	it('accepts the exact limit and preserves BOM and CRLF irrespective of MIME', async () => {
		const bytes = Buffer.from('\ufeff# Hello\r\n');
		const result = await readUpload(request(bytes), bytes.length, origin);
		expect(result.bytes).toEqual(bytes);
		expect(result.filename).toBe('notes.MARKDOWN');
	});

	it('rejects one byte above the limit without Content-Length', async () => {
		await expect(readUpload(request(Buffer.from('12345')), 4, origin)).rejects.toMatchObject({
			status: 413
		});
	});

	it.each([
		[Buffer.alloc(0), 'notes.md'],
		[Buffer.from('\ufeff \r\n\t'), 'notes.md'],
		[Buffer.from([0xc0, 0xaf]), 'notes.md'],
		[Buffer.from('hello'), 'notes.txt']
	])('rejects invalid input %j / %s', async (bytes, name) => {
		await expect(readUpload(request(bytes, name), 100, origin)).rejects.toMatchObject({
			status: 400
		});
	});

	it('rejects extra files and fields', async () => {
		for (const extra of ['file', 'description']) {
			const form = new FormData();
			form.append('file', new Blob(['hello']), 'notes.md');
			if (extra === 'file') form.append(extra, new Blob(['other']), 'other.md');
			else form.append(extra, 'text');
			await expect(
				readUpload(
					new Request(origin, {
						method: 'POST',
						headers: { origin },
						body: form
					}),
					100,
					origin
				)
			).rejects.toMatchObject({ status: 400 });
		}
	});

	it.each([undefined, 'null', 'https://evil.example'])('rejects Origin %s', async (value) => {
		const req = request(Buffer.from('hello'));
		if (value) req.headers.set('origin', value);
		else req.headers.delete('origin');
		await expect(readUpload(req, 100, origin)).rejects.toMatchObject({ status: 403 });
	});

	it('rejects malformed multipart and unexpected field names', async () => {
		const malformed = new Request(origin, {
			method: 'POST',
			headers: {
				origin,
				'content-type': 'multipart/form-data; boundary=abc'
			},
			body: '--abc\r\nContent-Disposition: form-data; name="file"; filename="a.md"\r\n\r\nhello'
		});
		await expect(readUpload(malformed, 100, origin)).rejects.toMatchObject({ status: 400 });
		const form = new FormData();
		form.append('other', new Blob(['hello']), 'a.md');
		await expect(
			readUpload(
				new Request(origin, { method: 'POST', headers: { origin }, body: form }),
				100,
				origin
			)
		).rejects.toMatchObject({ status: 400 });
	});

	it('bounds total transport even when Content-Length lies', async () => {
		const req = new Request(origin, {
			method: 'POST',
			headers: {
				origin,
				'content-type': 'multipart/form-data; boundary=abc',
				'content-length': '1'
			},
			body: 'x'.repeat(MULTIPART_OVERHEAD + 101)
		});
		await expect(readUpload(req, 100, origin)).rejects.toMatchObject({ status: 413 });
	});

	it('rejects a declared oversized request before parsing', async () => {
		const req = request(Buffer.from('hello'));
		req.headers.set('content-length', String(MULTIPART_OVERHEAD + 101));
		await expect(readUpload(req, 100, origin)).rejects.toMatchObject({ status: 413 });
	});

	it('preserves safe Unicode filenames and strips uploaded paths', async () => {
		const result = await readUpload(request(Buffer.from('hello'), '../café.md'), 100, origin);
		expect(result.filename).toBe('café.md');
	});
});
