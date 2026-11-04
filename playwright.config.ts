import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
	testDir: '.',
	testMatch: ['src/routes/**/*.e2e.ts', 'tests/**/*.e2e.ts'],
	workers: process.env.E2E_COMPOSE_PROJECT ? 1 : undefined,
	timeout: process.env.E2E_COMPOSE_PROJECT ? 120_000 : 30_000,
	reporter: 'list',
	use: {
		baseURL,
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: process.env.E2E_BASE_URL
		? undefined
		: {
				command: 'npm run build && node scripts/e2e-server.mjs',
				url: baseURL,
				timeout: 120_000,
				reuseExistingServer: !process.env.CI,
				env: {
					PORT: '4173',
					PUBLIC_ORIGIN: baseURL
				}
			}
});
