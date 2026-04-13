const test = require('node:test');
const assert = require('node:assert/strict');

const { GemmaClient } = require('abstractai');

test('GemmaClient uses HTTP transport for http URL', () => {
    const client = new GemmaClient('https://gemma.local', 'test-key');

    assert.equal(client.transport, 'http');
    assert.equal(client.wsUrl, null);
    assert.equal(client._resolveBaseUrl(), 'https://gemma.local/v1');
});

test('GemmaClient uses WebSocket transport for ws URL', () => {
    const client = new GemmaClient('ws://gemma.local', 'test-key');

    assert.equal(client.transport, 'ws');
    assert.equal(client.wsUrl, 'ws://gemma.local/v1/chat/completions');
    assert.equal(client.client, null);
});

test('GemmaClient preserves chat completion suffix for WebSocket URL', () => {
    const client = new GemmaClient('wss://gemma.local/v1/chat/completions', 'test-key');
    assert.equal(client.wsUrl, 'wss://gemma.local/v1/chat/completions');
});
