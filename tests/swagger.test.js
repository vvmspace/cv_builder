const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

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

test('GET /api-docs.json returns OpenAPI spec', async () => {
    const response = await handler(
        createEvent({
            method: 'GET',
            path: '/.netlify/functions/server/api-docs.json'
        }),
        {}
    );

    assert.equal(response.statusCode, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.openapi, '3.0.0');
    assert.ok(parsed.paths['/api/v1/generate_cv']);
});

