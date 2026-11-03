import { randomBytes } from 'node:crypto';
import {
	S3Client,
	CreateBucketCommand,
	DeleteBucketCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { describe, it, expect } from 'vitest';
import { DocumentStore } from './documents';
import { createS3Client } from './storage/client';

const endpoint = process.env.MINIO_TEST_ENDPOINT;

describe.skipIf(!endpoint)('MinIO integration', () => {
	it('enforces atomic conditional creation and retrieves from another instance until operator deletion', async () => {
		const bucket = `pagecourier-test-${randomBytes(8).toString('hex')}`;
		const config = {
			bucket,
			region: 'us-east-1',
			endpoint,
			forcePathStyle: true,
			keyPrefix: 'test/'
		};
		const admin = new S3Client({
			...config,
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ''
			}
		});
		const firstClient = createS3Client(config);
		const secondClient = createS3Client(config);
		const ids: string[] = [];
		await admin.send(new CreateBucketCommand({ Bucket: bucket }));
		try {
			const store = new DocumentStore(firstClient, config, 100);
			const original = Buffer.from('\ufeff# Original\r\n');
			const first = await store.create(original, 'café.md');
			ids.push(first);
			const next = 'b'.repeat(32);
			let attempt = 0;
			const collidingStore = new DocumentStore(firstClient, config, 100, () =>
				attempt++ === 0 ? first : next
			);
			const second = await collidingStore.create(Buffer.from('different'), 'other.md');
			ids.push(second);
			const replica = new DocumentStore(secondClient, config, 100);
			expect(second).toBe(next);
			expect((await replica.get(first)).bytes).toEqual(original);
			expect((await replica.get(first)).filename).toBe('café.md');
			expect((await replica.get(second)).source).toBe('different');
			await admin.send(
				new DeleteObjectCommand({ Bucket: bucket, Key: `test/documents/v1/${first}` })
			);
			await expect(replica.get(first)).rejects.toMatchObject({ status: 404 });
		} finally {
			for (const id of ids)
				await admin.send(
					new DeleteObjectCommand({ Bucket: bucket, Key: `test/documents/v1/${id}` })
				);
			await admin.send(new DeleteBucketCommand({ Bucket: bucket }));
			admin.destroy();
			firstClient.destroy();
			secondClient.destroy();
		}
	});
});
