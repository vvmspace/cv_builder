const { parseLLMTextResponse } = require('../abstractai/dist/src/utils/parse-llm-text-response');

const testCases = [
    {
        name: 'Clean JSON',
        input: '{"key": "value"}',
        expected: { key: 'value' }
    },
    {
        name: 'JSON in markdown blocks',
        input: '```json\n{"key": "value"}\n```',
        expected: { key: 'value' }
    },
    {
        name: 'JSON in markdown blocks (no lang)',
        input: '```\n{"key": "value"}\n```',
        expected: { key: 'value' }
    },
    {
        name: 'JSON with preamble',
        input: 'Here is the JSON:\n```json\n{"key": "value"}\n```',
        expected: { key: 'value' }
    },
    {
        name: 'Mixed preamble and JSON',
        input: 'Expert CV writer summary...\n{\n  "key": "value"\n}\nSome footer text.',
        expected: { key: 'value' }
    },
    {
        name: 'Non-JSON text',
        input: 'Hello world',
        expected: { raw_text: 'Hello world' }
    }
];

testCases.forEach(tc => {
    try {
        const result = parseLLMTextResponse(tc.input, 'Test');
        const success = JSON.stringify(result) === JSON.stringify(tc.expected);
        console.log(`${tc.name}: ${success ? 'PASSED' : 'FAILED'}`);
        if (!success) {
            console.log(`  Expected: ${JSON.stringify(tc.expected)}`);
            console.log(`  Got:      ${JSON.stringify(result)}`);
        }
    } catch (e) {
        console.log(`${tc.name}: ERROR - ${e.message}`);
    }
});
