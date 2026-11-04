import { describe, expect, it } from 'vitest';
import { deriveArtifactVersions } from '../../../scripts/artifact-version.mjs';
import {
	assertReleaseVersionAvailable,
	checkManifestExists
} from '../../../scripts/check-release-availability.mjs';
import { updateChartMetadata } from '../../../scripts/prepare-chart.mjs';
import { verifyChartMetadata } from '../../../scripts/verify-chart.mjs';
import { verifyImageArtifacts } from '../../../scripts/verify-image.mjs';

const revision = 'a'.repeat(40);

describe('artifact versioning', () => {
	it('derives matching stable release image and chart versions', () => {
		expect(
			deriveArtifactVersions({
				ref: 'refs/tags/v1.2.3',
				sha: revision,
				runNumber: '17',
				runAttempt: '1'
			})
		).toEqual({
			channel: 'release',
			artifactVersion: '1.2.3',
			chartVersion: '1.2.3',
			imageTag: '1.2.3',
			revision
		});
	});

	it('uses unique, commit-identifiable development versions per run attempt', () => {
		const input = {
			ref: 'refs/heads/main',
			sha: revision,
			runNumber: '17',
			runAttempt: '2'
		};
		const versions = deriveArtifactVersions(input);

		expect(versions.chartVersion).toBe('0.0.1-dev.17.2');
		expect(versions.imageTag).toBe(`sha-${revision}-run-17-attempt-2`);
		expect(versions.artifactVersion).toBe(versions.chartVersion);
		expect(versions.revision).toBe(revision);
	});

	it.each(['refs/tags/v01.2.3', 'refs/tags/v1.2', 'refs/tags/v1.2.3-rc.1', 'refs/heads/feature'])(
		'rejects unsupported publishing ref %s',
		(ref) => {
			expect(() =>
				deriveArtifactVersions({
					ref,
					sha: revision,
					runNumber: '1',
					runAttempt: '1'
				})
			).toThrow('Unsupported publishing ref');
		}
	);

	it('rejects missing hashes and invalid run counters', () => {
		expect(() =>
			deriveArtifactVersions({
				ref: 'refs/heads/main',
				sha: 'short',
				runNumber: '1',
				runAttempt: '1'
			})
		).toThrow('full 40- or 64-character');
		expect(() =>
			deriveArtifactVersions({
				ref: 'refs/heads/main',
				sha: revision,
				runNumber: '0',
				runAttempt: '1'
			})
		).toThrow('GITHUB_RUN_NUMBER');
	});
});

describe('versioned artifact safeguards', () => {
	it('prepares chart version, image version, source, license, and revision together', () => {
		const sourceChart = [
			'version: 0.0.1',
			"appVersion: '0.0.1'",
			'annotations:',
			'  artifacthub.io/license: MIT',
			'  org.opencontainers.image.source: "https://github.com/torstenwerner/PageCourier"',
			'  org.opencontainers.image.version: "0.0.1"',
			'  org.opencontainers.image.revision: "unknown"'
		].join('\n');
		const imageTag = `sha-${revision}-run-17-attempt-1`;
		const chartYaml = updateChartMetadata(sourceChart, {
			chartVersion: '0.0.1-dev.17.1',
			imageTag,
			revision
		});

		expect(chartYaml).toContain('version: "0.0.1-dev.17.1"');
		expect(chartYaml).toContain(`appVersion: "${imageTag}"`);
		verifyChartMetadata(chartYaml, {
			chartVersion: '0.0.1-dev.17.1',
			imageTag,
			revision
		});
	});

	it('rejects chart/image version or provenance mismatches', () => {
		expect(() =>
			verifyChartMetadata(
				[
					'version: "1.2.3"',
					'appVersion: "1.2.2"',
					'annotations:',
					'  artifacthub.io/license: MIT',
					'  org.opencontainers.image.source: "https://github.com/torstenwerner/PageCourier"',
					'  org.opencontainers.image.version: "1.2.3"',
					`  org.opencontainers.image.revision: "${revision}"`
				].join('\n'),
				{ chartVersion: '1.2.3', imageTag: '1.2.3', revision }
			)
		).toThrow('expected image version');
	});

	it('rejects a release if either registry already contains its version', async () => {
		const fetchImpl: typeof fetch = async (input) => {
			const url = String(input);
			if (url.includes('/token?')) {
				return new Response(JSON.stringify({ token: 'read-token' }), { status: 200 });
			}
			return new Response(null, {
				status: url.includes('/charts/pagecourier/') ? 404 : 200
			});
		};

		await expect(
			assertReleaseVersionAvailable('1.2.3', {
				username: 'workflow',
				token: 'token',
				fetchImpl
			})
		).rejects.toThrow('Release versions are immutable');
	});

	it('fails closed when the registry cannot be inspected', async () => {
		await expect(
			checkManifestExists('torstenwerner/pagecourier', '1.2.3', {
				username: 'workflow',
				token: 'token',
				fetchImpl: async () => new Response(null, { status: 503 })
			})
		).rejects.toThrow('GHCR read authorization failed');
	});

	it('checks release manifest architectures and image metadata, not build settings', () => {
		expect(() =>
			verifyImageArtifacts(
				{
					manifests: [
						{ platform: { os: 'linux', architecture: 'amd64' } },
						{ platform: { os: 'linux', architecture: 'arm64' } }
					]
				},
				{
					'org.opencontainers.image.source': 'https://github.com/torstenwerner/PageCourier',
					'org.opencontainers.image.version': '1.2.3',
					'org.opencontainers.image.revision': revision,
					'org.opencontainers.image.licenses': 'MIT'
				},
				{ version: '1.2.3', revision }
			)
		).not.toThrow();

		expect(() =>
			verifyImageArtifacts(
				{ manifests: [{ platform: { os: 'linux', architecture: 'amd64' } }] },
				{},
				{ version: '1.2.3', revision }
			)
		).toThrow('missing linux/arm64');
	});
});
