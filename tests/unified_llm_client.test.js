const test = require('node:test');
const assert = require('node:assert/strict');

const { UnifiedLLMClient } = require('../tools/llm_client');

test('UnifiedLLMClient uses Gemma as default when Gemma is configured', async () => {
    const client = new UnifiedLLMClient('gemini-key', 'openrouter-key', 'https://gemma.local', 'gemma-key');

    let gemmaCalled = 0;
    // eslint-disable-next-line no-param-reassign
    client.gemmaClient.generateContent = async () => {
        gemmaCalled += 1;
        return { provider: 'gemma' };
    };

    const result = await client.generateContent('test prompt');
    assert.deepEqual(result, { provider: 'gemma' });
    assert.equal(gemmaCalled, 1);
});

test('UnifiedLLMClient routes gemini models to Gemini client', async () => {
    const client = new UnifiedLLMClient('gemini-key', 'openrouter-key', 'https://gemma.local', 'gemma-key');

    let geminiModel = null;
    // eslint-disable-next-line no-param-reassign
    client.geminiClient.generateContent = async (prompt, model) => {
        geminiModel = model;
        return { provider: 'gemini' };
    };

    const result = await client.generateContent('test prompt', 'gemini-2.5-flash');
    assert.deepEqual(result, { provider: 'gemini' });
    assert.equal(geminiModel, 'gemini-2.5-flash');
});

test('UnifiedLLMClient routes non-gemini/gemma models to OpenRouter client', async () => {
    const client = new UnifiedLLMClient('gemini-key', 'openrouter-key');

    let openRouterModel = null;
    // eslint-disable-next-line no-param-reassign
    client.openRouterClient.generateContent = async (prompt, model) => {
        openRouterModel = model;
        return { provider: 'openrouter' };
    };

    const result = await client.generateContent('test prompt', 'openrouter/free');
    assert.deepEqual(result, { provider: 'openrouter' });
    assert.equal(openRouterModel, 'openrouter/free');
});
