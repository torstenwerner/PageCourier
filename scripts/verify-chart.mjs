import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * @param {string} chartYaml
 * @param {{ chartVersion: string; imageTag: string; revision: string }} expectedMetadata
 */
export function verifyChartMetadata(chartYaml, { chartVersion, imageTag, revision }) {
	const expected = [
		['version', chartVersion, 'chart version'],
		['appVersion', imageTag, 'image version'],
		['org.opencontainers.image.version', chartVersion, 'chart OCI version'],
		['org.opencontainers.image.revision', revision.toLowerCase(), 'revision'],
		['org.opencontainers.image.source', 'https://github.com/torstenwerner/PageCourier', 'source'],
		['artifacthub.io/license', 'MIT', 'license']
	];
	for (const [key, value, label] of expected) {
		if (getScalar(chartYaml, key) !== value) {
			throw new Error(`Packaged chart does not contain the expected ${label}.`);
		}
	}
}

/** @param {string} yaml @param {string} key */
function getScalar(yaml, key) {
	const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const line = yaml.split('\n').find((entry) => new RegExp(`^\\s*${escapedKey}:`).test(entry));
	if (!line) return undefined;
	const match = new RegExp(
		`^\\s*${escapedKey}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\s#]+))\\s*(?:#.*)?$`
	).exec(line);
	return match?.[1] ?? match?.[2] ?? match?.[3];
}

async function main() {
	const [packagePath, chartVersion, imageTag, revision] = process.argv.slice(2);
	if (!packagePath || !chartVersion || !imageTag || !revision) {
		throw new Error(
			'Usage: verify-chart.mjs <chart-package> <chart-version> <image-tag> <revision>'
		);
	}
	const { stdout } = await execFileAsync('helm', ['show', 'chart', packagePath]);
	verifyChartMetadata(stdout, { chartVersion, imageTag, revision });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
