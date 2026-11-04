import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export async function compose(...args: string[]): Promise<string> {
	const project = process.env.E2E_COMPOSE_PROJECT;
	if (!project || !/^pagecourier-acceptance-[a-f0-9]+$/.test(project)) {
		throw new Error('Refusing to control a non-acceptance Compose project.');
	}
	const result = await execute(
		'docker',
		['compose', '--project-name', project, '--profile', 'acceptance', ...args],
		{ timeout: 120_000, maxBuffer: 4 * 1024 * 1024 }
	);
	return result.stdout;
}

export async function waitForReady(baseURL: string): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			const response = await fetch(`${baseURL}/health/ready`, {
				signal: AbortSignal.timeout(2000)
			});
			if (response.ok) return;
		} catch (cause) {
			if (!(cause instanceof TypeError) && !(cause instanceof DOMException)) throw cause;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error('Acceptance application storage did not become ready.');
}

export async function withStorageOutage(baseURL: string, run: () => Promise<void>): Promise<void> {
	await compose('stop', 'minio');
	try {
		await run();
	} finally {
		await compose('start', 'minio');
		await waitForReady(baseURL);
	}
}
