import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const releaseRef = /^refs\/tags\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const commitHash = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

/**
 * @param {{ ref?: string; sha?: string; runNumber?: string | number; runAttempt?: string | number }} input
 */
export function deriveArtifactVersions({ ref, sha, runNumber, runAttempt }) {
	if (typeof sha !== 'string' || !commitHash.test(sha)) {
		throw new Error('GITHUB_SHA must be a full 40- or 64-character commit hash.');
	}
	const revision = sha.toLowerCase();

	if (ref === 'refs/heads/main') {
		const run = parsePositiveInteger(runNumber, 'GITHUB_RUN_NUMBER');
		const attempt = parsePositiveInteger(runAttempt, 'GITHUB_RUN_ATTEMPT');
		return {
			channel: 'development',
			artifactVersion: `0.0.1-dev.${run}.${attempt}`,
			chartVersion: `0.0.1-dev.${run}.${attempt}`,
			imageTag: `sha-${revision}-run-${run}-attempt-${attempt}`,
			revision
		};
	}

	const match = releaseRef.exec(ref ?? '');
	if (match) {
		const version = match.slice(1).join('.');
		return {
			channel: 'release',
			artifactVersion: version,
			chartVersion: version,
			imageTag: version,
			revision
		};
	}

	throw new Error(`Unsupported publishing ref: ${ref ?? '(missing)'}`);
}

/** @param {string | number | undefined} value @param {string} name */
function parsePositiveInteger(value, name) {
	if (!/^[1-9]\d*$/.test(String(value ?? ''))) {
		throw new Error(`${name} must be a positive integer.`);
	}
	return Number(value);
}

async function main() {
	const versions = deriveArtifactVersions({
		ref: process.env.GITHUB_REF,
		sha: process.env.GITHUB_SHA,
		runNumber: process.env.GITHUB_RUN_NUMBER,
		runAttempt: process.env.GITHUB_RUN_ATTEMPT
	});

	const output = Object.entries({
		artifact_version: versions.artifactVersion,
		chart_version: versions.chartVersion,
		image_tag: versions.imageTag,
		revision: versions.revision
	})
		.map(([key, value]) => `${key}=${value}`)
		.join('\n');

	if (process.env.GITHUB_OUTPUT) {
		await appendFile(process.env.GITHUB_OUTPUT, `${output}\n`);
	} else {
		process.stdout.write(`${output}\n`);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
