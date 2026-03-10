const { test, expect } = require('@playwright/test');

test.describe('CV Generation API', () => {
    test('should return 400 if vacancy_text is missing', async ({ request }) => {
        const response = await request.post('/api/v1/generate_cv', {
            data: { custom_comment: 'test' }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('vacancy_text is required');
    });

    test('should successfully generate mock CV', async ({ request }) => {
        const response = await request.post('/api/v1/generate_cv', {
            data: { vacancy_text: 'Software Engineer', template: 'dark' }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.pdf_url).toMatch(/_dark\.pdf$/);
        expect(data.html_url).toMatch(/_dark\.html$/);
        expect(data.pdf_absolute_path).toBeDefined();
    });

    test('should support dark_calendly template', async ({ request }) => {
        const response = await request.post('/api/v1/generate_cv', {
            data: { vacancy_text: 'Software Engineer', template: 'dark_calendly' }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.pdf_url).toMatch(/_dark_calendly\.pdf$/);
        expect(data.html_url).toMatch(/_dark_calendly\.html$/);
        expect(data.pdf_absolute_path).toBeDefined();
    });
});
