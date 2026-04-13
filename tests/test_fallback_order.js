const { GeminiClient } = require('../abstractai');
const assert = require('assert');

async function testFallbackOrder() {
    console.log('Testing internal fallback order in GeminiClient...');

    const client = new GeminiClient('fake-key');
    let calledModels = [];

    // Mock _callModel to record the order of models called
    client._callModel = async function(prompt, model) {
        calledModels.push(model);
        const err = new Error('Rate limit exceeded');
        err.isRateLimit = true; // Essential for triggering fallback logic
        throw err;
    };

    try {
        console.log('Attempting generation with gemini-3.1-pro-preview...');
        await client.generateContent('test prompt', 'gemini-3.1-pro-preview');
    } catch (e) {
        console.log('Final error caught (expected)');
    }

    const expectedOrder = [
        'gemini-3.1-pro-preview',
        'gemma-4-31b-it',
        'gemma-4-26b-a4b-it',
        'gemini-2.5-flash',
        'gemini-2.0-flash'
    ];

    console.log('Actual fallback order:', calledModels);
    assert.deepStrictEqual(calledModels, expectedOrder, 'Fallback order should include Gemma 4 models in the correct sequence');

    console.log('✅ Fallback order test passed!');
}

testFallbackOrder().catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
});
