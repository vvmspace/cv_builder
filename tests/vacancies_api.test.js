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

test('GET /api/v1/vacancies returns empty list without MongoDB', async () => {
    delete process.env.MONGODB_CONNECTION_STRING;

    const response = await handler(
        createEvent({
            method: 'GET',
            path: '/.netlify/functions/server/api/v1/vacancies'
        }),
        {}
    );

    assert.equal(response.statusCode, 200);
    const parsed = JSON.parse(response.body);
    assert.ok(Array.isArray(parsed.vacancies));
});

test('PATCH /api/v1/vacancies/:uuid enforces AUTH_TOKEN when set', async () => {
    process.env.AUTH_TOKEN = 'secret-token';

    const response = await handler(
        createEvent({
            method: 'PATCH',
            path: '/.netlify/functions/server/api/v1/vacancies/test-uuid',
            body: { status: 'sent' }
        }),
        {}
    );

    assert.equal(response.statusCode, 401);
});

test('PATCH /api/v1/vacancies/:uuid succeeds without AUTH_TOKEN even without MongoDB', async () => {
    delete process.env.AUTH_TOKEN;
    delete process.env.MONGODB_CONNECTION_STRING;

    const response = await handler(
        createEvent({
            method: 'PATCH',
            path: '/.netlify/functions/server/api/v1/vacancies/test-uuid',
            body: { status: 'sent', comment: 'Nice vacancy' }
        }),
        {}
    );

    assert.equal(response.statusCode, 200);
});

