import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';

async function freePort() {
	const server = createServer();
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No acceptance port available.');
	await new Promise((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
	return String(address.port);
}

const project = `pagecourier-acceptance-${randomBytes(8).toString('hex')}`;
const env = {
	...process.env,
	APP_PORT: await freePort(),
	REPLICA_PORT: await freePort(),
	MINIO_PORT: await freePort(),
	E2E_COMPOSE_PROJECT: project,
	PAGECOURIER_IMAGE: 'pagecourier:acceptance'
};
env.E2E_BASE_URL = `http://127.0.0.1:${env.APP_PORT}`;
env.PUBLIC_ORIGIN = env.E2E_BASE_URL;
env.E2E_REPLICA_URL = `http://127.0.0.1:${env.REPLICA_PORT}`;
env.MINIO_TEST_ENDPOINT = `http://127.0.0.1:${env.MINIO_PORT}`;
env.AWS_ACCESS_KEY_ID = 'local-development-admin';
env.AWS_SECRET_ACCESS_KEY = 'local-development-admin-password';
const composeArgs = ['compose', '--project-name', project, '--profile', 'acceptance'];
let active;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => {
		interrupted = true;
		active?.kill('SIGTERM');
	});
}

async function run(command, args) {
	if (interrupted) throw new Error('Acceptance interrupted.');
	active = spawn(command, args, { env, stdio: 'inherit' });
	const [code, signal] = await once(active, 'exit');
	active = undefined;
	if (code !== 0) throw new Error(`${command} failed (${signal ?? code}).`);
}

try {
	await run('docker', [
		...composeArgs,
		'up',
		'--build',
		'--detach',
		'--wait',
		'--wait-timeout',
		'180'
	]);
	await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run']);
	await run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test']);
} catch (cause) {
	console.error(cause instanceof Error ? cause.message : cause);
	process.exitCode = 1;
	// Print app diagnostics only; never dump object-store access logs or configuration.
	const child = spawn('docker', [...composeArgs, 'logs', '--no-color', 'app', 'replica'], {
		env,
		stdio: 'inherit'
	});
	await once(child, 'exit');
} finally {
	const child = spawn('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans'], {
		env,
		stdio: 'inherit'
	});
	const [code] = await once(child, 'exit');
	if (code !== 0) {
		console.error(`Acceptance cleanup failed; remove only project ${project} manually.`);
		process.exitCode = 1;
	}
}
