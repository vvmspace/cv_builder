const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN =
    process.env.TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN || 'test-telegram-token';

const { handler } = require('../netlify/functions/server');

function createEvent({ method, path, body, headers = {} }) {
    return {
        httpMethod: method,
        path,
        headers: { 'content-type': 'application/json', ...headers },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: body ? JSON.stringify(body) : null,
        isBase64Encoded: false
    };
}

test('telegram webhook returns 200 and ok true for minimal Update', async () => {
    const update = {
        message: {
            chat: { id: 123 },
            text: 'hello'
        }
    };

    const response = await handler(
        createEvent({
            method: 'POST',
            path: '/.netlify/functions/server/api/v1/telegram/webhook',
            body: update
        }),
        {}
    );

    assert.equal(response.statusCode, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.ok, true);
});

test('telegram webhook returns 200 for Update with LinkedIn URL in text', async () => {
    const update = {
        message: {
            chat: { id: 456 },
            text: 'https://www.linkedin.com/posts/someuser_activity-123-abc'
        }
    };

    const response = await handler(
        createEvent({
            method: 'POST',
            path: '/.netlify/functions/server/api/v1/telegram/webhook',
            body: update
        }),
        {}
    );

    assert.equal(response.statusCode, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.ok, true);
});
