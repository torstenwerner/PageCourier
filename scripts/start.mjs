process.env.NODE_ENV = 'production';
const limit = process.env.UPLOAD_MAX_BYTES ?? '5242880';
if (
	!/^\d+$/.test(limit) ||
	!Number.isSafeInteger(Number(limit)) ||
	Number(limit) < 1 ||
	Number(limit) > Number.MAX_SAFE_INTEGER - 65536
) {
	throw new Error('Invalid configuration: UPLOAD_MAX_BYTES.');
}
process.env.BODY_SIZE_LIMIT = String(Number(limit) + 65536);
await import('../build/index.js');
