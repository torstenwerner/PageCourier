import { expect, test } from '@playwright/test';

test('serves the responsive PageCourier foundation without an unfinished upload flow', async ({
	page
}) => {
	await page.goto('/');

	await expect(page).toHaveTitle('PageCourier — Markdown, ready to travel.');
	await expect(page.getByRole('heading', { name: 'Markdown, ready to travel.' })).toBeVisible();
	await expect(page.getByText('Markdown sharing', { exact: true })).toBeVisible();
	await expect(page.getByText('Markdown sharing for small teams', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('main')).toContainText('shared by one link');
	await expect(page.getByText('One document, made readable and easy to pass along.')).toHaveCount(
		0
	);
	await expect(page.getByRole('contentinfo')).toHaveCount(0);
	await expect(page.getByText('Built for trusted, operator-run teams.')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'PageCourier on GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/torstenwerner/PageCourier'
	);
	await expect(page.locator('input[type="file"]')).toHaveCount(0);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
	await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');

	await page.setViewportSize({ width: 390, height: 844 });
	const hasHorizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(hasHorizontalOverflow).toBe(false);
});
