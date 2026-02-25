const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

const { handler } = require('../netlify/functions/server');

function createEvent({ method, path, body, headers = {} }) {
    return {
        httpMethod: method,
        path,
        headers,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: body ? JSON.stringify(body) : null,
        isBase64Encoded: false
    };
}

test('netlify handler serves root page', async () => {
    const response = await handler(createEvent({
        method: 'GET',
        path: '/.netlify/functions/server/'
    }), {});

    assert.equal(response.statusCode, 200);
    assert.match(response.body || '', /html/i);
});

test('netlify handler routes generate_cv and validates body', async () => {
    const response = await handler(createEvent({
        method: 'POST',
        path: '/.netlify/functions/server/api/v1/generate_cv',
        body: {},
        headers: {
            'content-type': 'application/json'
        }
    }), {});

    assert.equal(response.statusCode, 400);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.error, 'vacancy_text is required');
});
