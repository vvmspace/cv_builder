const test = require('node:test');
const assert = require('node:assert/strict');
const OpenAI = require('openai');

const AbstractAI = require('abstractai');

test('abstractai supports chat.completions.create in OpenAI format', async () => {
    const client = new AbstractAI();
    client.unified.generateContent = async () => ({ answer: 'ok' });
    client.unified.defaultModel = 'gemini-2.5-flash';

    const result = await client.chat.completions.create({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Say ok' }]
    });

    assert.equal(result.object, 'chat.completion');
    assert.equal(result.model, 'gemini-2.5-flash');
    assert.equal(result.choices[0].message.role, 'assistant');
    assert.equal(result.choices[0].message.content, '{"answer":"ok"}');
});

test('abstractai supports responses.create in OpenAI format', async () => {
    const client = new AbstractAI();
    client.unified.generateContent = async () => ({ raw_text: 'plain text' });
    client.unified.defaultModel = 'gemma';

    const result = await client.responses.create({
        input: 'Hello'
    });

    assert.equal(result.object, 'response');
    assert.equal(result.model, 'gemma');
    assert.equal(result.output_text, 'plain text');
    assert.equal(result.output[0].content[0].text, 'plain text');
});

test('abstractai keeps named exports for backward compatibility', () => {
    const { UnifiedLLMClient, GeminiClient, OpenAICompatibleClient } = require('abstractai');
    assert.ok(typeof UnifiedLLMClient === 'function');
    assert.ok(typeof GeminiClient === 'function');
    assert.ok(typeof OpenAICompatibleClient === 'function');
});

test('abstractai client extends OpenAI', () => {
    const client = new AbstractAI();
    assert.ok(client instanceof OpenAI);
});

test('abstractai exposes custom helper methods on the same client instance', async () => {
    const client = new AbstractAI();
    client.unified.generateContent = async (prompt, model) => ({ prompt, model, ok: true });

    const a = await client.generateContent('plain prompt', 'gemini-2.5-flash');
    assert.equal(a.ok, true);
    assert.equal(a.model, 'gemini-2.5-flash');

    const b = await client.generateFromMessages([{ role: 'user', content: 'Hello' }], 'gemini-2.0-flash');
    assert.equal(b.ok, true);
    assert.equal(b.model, 'gemini-2.0-flash');
    assert.match(String(b.prompt), /USER: Hello/);

    const c = await client.generateFromInput('Input text', 'gemma');
    assert.equal(c.ok, true);
    assert.equal(c.model, 'gemma');

    assert.equal(client.getUnifiedClient(), client.unified);
});
