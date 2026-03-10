const { test, expect } = require('@playwright/test');

test.describe('Web UI', () => {
    test('should generate CV and show download link when mocking API', async ({ page }) => {
        // Mock the API response to avoid backend puppeteer generation during frontend test
        await page.route('/api/v1/generate-cv', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    html_url: '/mock_cv_light.html',
                    pdf_url: '/mock_cv_light.pdf',
                    pdf_absolute_path: '/tmp/mock_cv_light.pdf'
                })
            });
        });

        // Provide a dummy file for the PDF download route
        await page.route('/mock_cv_light.pdf', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/pdf',
                body: Buffer.from('mock pdf content')
            });
        });

        await page.goto('/');

        await expect(page.locator('h1')).toHaveText('CV Adapt // VVM');
        await expect(page.locator('#templateSelect')).toHaveValue('dark_calendly');

        // Fill form
        await page.fill('#vacancyInput', 'Looking for a Software Engineer');
        await page.selectOption('#templateSelect', 'light');

        // Trigger generation
        const downloadPromise = page.waitForEvent('download');
        await page.click('#generateBtn');
        const download = await downloadPromise;

        await expect(page.locator('#status')).toContainText('Success! Downloading...');

        const htmlLink = page.locator('#status a', { hasText: 'Open HTML' });
        await expect(htmlLink).toBeVisible();
        await expect(htmlLink).toHaveAttribute('href', '/mock_cv_light.html');

        expect(download.url()).toContain('/mock_cv_light.pdf');
    });
});
