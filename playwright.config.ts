import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
	testDir: './src/routes',
	testMatch: '**/*.e2e.ts',
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
	webServer: {
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
