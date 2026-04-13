const { UnifiedLLMClient, GeminiClient } = require('../abstractai');
const assert = require('assert');

async function testGemmaRouting() {
    console.log('Testing Gemma 4 routing to Google AI client...');

    // Mock GeminiClient to avoid actual API calls
    const originalGenerateContent = GeminiClient.prototype.generateContent;
    let lastCalledModel = null;
    
    GeminiClient.prototype.generateContent = async function(prompt, model) {
        lastCalledModel = model;
        return { success: true, model_used: model };
    };

    const unified = new UnifiedLLMClient('fake-gemini-key', 'fake-or-key', 'http://fake-gemma-url', 'fake-gemma-key');

    try {
        // Test Gemma 4
        console.log('Testing gemma-4-31b-it...');
        await unified.generateContent('test prompt', 'gemma-4-31b-it');
        assert.strictEqual(lastCalledModel, 'gemma-4-31b-it', 'gemma-4-31b-it should be routed to GeminiClient');

        console.log('Testing gemma-4-26b-a4b-it...');
        await unified.generateContent('test prompt', 'gemma-4-26b-a4b-it');
        assert.strictEqual(lastCalledModel, 'gemma-4-26b-a4b-it', 'gemma-4-26b-a4b-it should be routed to GeminiClient');

        // Test Gemma 2 (which should also be routed to Google if it starts with gemma-2-)
        console.log('Testing gemma-2-9b-it...');
        await unified.generateContent('test prompt', 'gemma-2-9b-it');
        assert.strictEqual(lastCalledModel, 'gemma-2-9b-it', 'gemma-2-9b-it should be routed to GeminiClient');

        // Test custom Gemma (not gemma-2, 3, or 4)
        console.log('Testing custom gemma (should NOT go to GeminiClient)...');
        lastCalledModel = null;
        try {
            // This will throw because of fake URL, which is expected since it should bypass GeminiClient
            await unified.generateContent('test prompt', 'gemma-custom');
        } catch (e) {
            // Error is expected, we just want to verify that lastCalledModel is still null
            // meaning it didn't go through the mocked GeminiClient.
        }
        assert.strictEqual(lastCalledModel, null, 'gemma-custom should NOT be routed to GeminiClient');

        console.log('✅ Gemma 4 routing tests passed!');
    } finally {
        // Restore original method
        GeminiClient.prototype.generateContent = originalGenerateContent;
    }
}

testGemmaRouting().catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
});
