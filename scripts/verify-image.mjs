import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/**
 * @param {{ manifests?: Array<{ platform?: { os?: string; architecture?: string } }> }} manifest
 * @param {Record<string, string | undefined>} labels
 * @param {{ version: string; revision: string }} expected
 */
export function verifyImageArtifacts(manifest, labels, { version, revision }) {
	const platforms = new Set(
		(manifest.manifests ?? [])
			.map(({ platform }) =>
				platform?.os && platform?.architecture
					? `${platform.os}/${platform.architecture}`
					: undefined
			)
			.filter(Boolean)
	);
	for (const required of ['linux/amd64', 'linux/arm64']) {
		if (!platforms.has(required)) {
			throw new Error(`Published image manifest is missing ${required}.`);
		}
	}

	const expectedLabels = {
		'org.opencontainers.image.source': 'https://github.com/torstenwerner/PageCourier',
		'org.opencontainers.image.version': version,
		'org.opencontainers.image.revision': revision.toLowerCase(),
		'org.opencontainers.image.licenses': 'MIT'
	};
	for (const [key, value] of Object.entries(expectedLabels)) {
		if (labels[key] !== value) {
			throw new Error(`Published image has incorrect ${key} metadata.`);
		}
	}
}

async function main() {
	const [manifestPath, labelsPath, version, revision] = process.argv.slice(2);
	if (!manifestPath || !labelsPath || !version || !revision) {
		throw new Error('Usage: verify-image.mjs <manifest-json> <labels-json> <version> <revision>');
	}
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	const labels = JSON.parse(await readFile(labelsPath, 'utf8'));
	verifyImageArtifacts(manifest, labels, { version, revision });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
