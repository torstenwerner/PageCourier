import { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';

const registry = 'https://ghcr.io';
const repositories = ['torstenwerner/pagecourier', 'torstenwerner/charts/pagecourier'];

/**
 * @param {string} repository
 * @param {string} version
 * @param {{ username: string; token: string; fetchImpl?: typeof fetch }} options
 */
export async function checkManifestExists(
	repository,
	version,
	{ username, token, fetchImpl = fetch }
) {
	const credentials = Buffer.from(`${username}:${token}`).toString('base64');
	const scope = encodeURIComponent(`repository:${repository}:pull`);
	const tokenResponse = await fetchImpl(`${registry}/token?service=ghcr.io&scope=${scope}`, {
		headers: { authorization: `Basic ${credentials}` }
	});
	if (!tokenResponse.ok) {
		throw new Error(`GHCR read authorization failed (HTTP ${tokenResponse.status}).`);
	}

	const tokenBody = await tokenResponse.json();
	const bearerToken = tokenBody.token ?? tokenBody.access_token;
	if (typeof bearerToken !== 'string' || bearerToken.length === 0) {
		throw new Error('GHCR returned no registry read token.');
	}

	const response = await fetchImpl(
		`${registry}/v2/${repository}/manifests/${encodeURIComponent(version)}`,
		{
			method: 'HEAD',
			headers: {
				authorization: `Bearer ${bearerToken}`,
				accept: [
					'application/vnd.oci.image.index.v1+json',
					'application/vnd.docker.distribution.manifest.list.v2+json',
					'application/vnd.oci.image.manifest.v1+json',
					'application/vnd.docker.distribution.manifest.v2+json'
				].join(', ')
			}
		}
	);

	if (response.status === 404) return false;
	if (response.ok) return true;
	throw new Error(`Could not inspect GHCR artifact version (HTTP ${response.status}).`);
}

/**
 * @param {string} version
 * @param {{ username: string; token: string; fetchImpl?: typeof fetch }} options
 */
export async function assertReleaseVersionAvailable(
	version,
	{ username, token, fetchImpl = fetch }
) {
	if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) {
		throw new Error('Release version must be a stable SemVer X.Y.Z version.');
	}
	if (!username || !token) {
		throw new Error('GHCR_USERNAME and GHCR_TOKEN are required for release checks.');
	}

	const existing = await Promise.all(
		repositories.map(async (repository) => ({
			repository,
			exists: await checkManifestExists(repository, version, {
				username,
				token,
				fetchImpl
			})
		}))
	);

	const present = existing.filter(({ exists }) => exists).map(({ repository }) => repository);
	if (present.length > 0) {
		throw new Error(
			`Refusing to publish ${version}; an existing GHCR release artifact was found (${present.join(', ')}). Release versions are immutable; reconcile a partial publication manually.`
		);
	}
}

async function main() {
	const { RELEASE_VERSION: version, GHCR_USERNAME: username, GHCR_TOKEN: token } = process.env;
	if (!version || !username || !token) {
		throw new Error('RELEASE_VERSION, GHCR_USERNAME, and GHCR_TOKEN are required.');
	}
	await assertReleaseVersionAvailable(version, { username, token });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
