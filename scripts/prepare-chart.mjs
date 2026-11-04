import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const sourceUrl = 'https://github.com/torstenwerner/PageCourier';

/**
 * @param {string} chartYaml
 * @param {{ chartVersion: string; imageTag: string; revision: string }} metadata
 */
export function updateChartMetadata(chartYaml, { chartVersion, imageTag, revision }) {
	if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(chartVersion ?? '')) {
		throw new Error('Chart version must be a SemVer version.');
	}
	if (!/^[A-Za-z0-9_.+-]+$/.test(imageTag ?? '')) {
		throw new Error('Image tag contains unsupported characters.');
	}
	if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(revision ?? '')) {
		throw new Error('Revision must be a full commit hash.');
	}

	/** @type {Array<[RegExp, string]>} */
	const fields = [
		[/^version: .+$/m, `version: "${chartVersion}"`],
		[/^appVersion: .+$/m, `appVersion: "${imageTag}"`],
		[
			/^[ ]{2}org\.opencontainers\.image\.version: .+$/m,
			`  org.opencontainers.image.version: "${chartVersion}"`
		],
		[
			/^[ ]{2}org\.opencontainers\.image\.revision: .+$/m,
			`  org.opencontainers.image.revision: "${revision.toLowerCase()}"`
		],
		[
			/^[ ]{2}org\.opencontainers\.image\.source: .+$/m,
			`  org.opencontainers.image.source: "${sourceUrl}"`
		]
	];
	let result = chartYaml;
	for (const [pattern, replacement] of fields) {
		if (!pattern.test(result)) {
			throw new Error(`Chart metadata is missing required field ${pattern}.`);
		}
		result = result.replace(pattern, replacement);
	}
	return result;
}

async function main() {
	const {
		CHART_VERSION: chartVersion,
		IMAGE_TAG: imageTag,
		REVISION: revision,
		CHART_OUTPUT: outputDir
	} = process.env;
	if (!chartVersion || !imageTag || !revision || !outputDir) {
		throw new Error('CHART_VERSION, IMAGE_TAG, REVISION, and CHART_OUTPUT are required.');
	}

	await mkdir(outputDir, { recursive: true });
	await cp('charts/pagecourier', outputDir, { recursive: true });
	const chartPath = `${outputDir}/Chart.yaml`;
	const chartYaml = await readFile(chartPath, 'utf8');
	await writeFile(chartPath, updateChartMetadata(chartYaml, { chartVersion, imageTag, revision }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
