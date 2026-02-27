const { test, expect } = require('@playwright/test');

test.describe('Telegram Webhook', () => {
    test('should process mock telegram update via webhook', async ({ request }) => {
        const response = await request.post('/api/v1/telegram/webhook', {
            data: {
                message: {
                    chat: { id: 123456 },
                    text: 'Here is a vacancy for a Full Stack Developer'
                }
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.ok).toBe(true);
    });
});
