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
		command: 'npm run build && npm start',
		url: baseURL,
		timeout: 120_000,
		reuseExistingServer: !process.env.CI,
		env: {
			NODE_ENV: 'production',
			HOST: '127.0.0.1',
			PORT: '4173',
			PUBLIC_ORIGIN: baseURL,
			S3_BUCKET: 'pagecourier-test',
			AWS_REGION: 'us-east-1'
		}
	}
});
