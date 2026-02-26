const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

const { GeminiClient } = require('../tools/llm_client');

test('GeminiClient uses preferred model when successful', async () => {
    const client = new GeminiClient('test-key');
    const calls = [];

    // Monkey-patch _callModel to avoid real HTTP requests
    // and capture the models being used.
    // eslint-disable-next-line no-param-reassign
    client._callModel = async (prompt, model) => {
        calls.push({ prompt, model });
        return { ok: true, model };
    };

    const result = await client.generateContent('test prompt', 'gemini-3.1-pro-preview');

    assert.deepEqual(result, { ok: true, model: 'gemini-3.1-pro-preview' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, 'gemini-3.1-pro-preview');
});

test('GeminiClient falls back on rate limit errors following configured chain', async () => {
    const client = new GeminiClient('test-key');
    const calls = [];

    const rateLimitError = new Error('rate limited');
    rateLimitError.isRateLimit = true;

    const modelsToSimulate = ['gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];

    // eslint-disable-next-line no-param-reassign
    client._callModel = async (prompt, model) => {
        calls.push({ prompt, model });
        if (model === 'gemini-3.1-pro-preview' || model === 'gemini-2.5-flash') {
            throw rateLimitError;
        }
        return { ok: true, model };
    };

    const result = await client.generateContent('test prompt', 'gemini-3.1-pro-preview');

    assert.deepEqual(result, { ok: true, model: 'gemini-2.0-flash' });
    assert.deepEqual(
        calls.map((c) => c.model),
        modelsToSimulate
    );
});

