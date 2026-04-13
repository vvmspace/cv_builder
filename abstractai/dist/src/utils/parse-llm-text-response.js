"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLLMTextResponse = parseLLMTextResponse;
function parseLLMTextResponse(content, providerName) {
    let text = content;
    if (Array.isArray(content)) {
        text = content
            .filter((part) => Boolean(part) && typeof part.text === 'string')
            .map((part) => part.text)
            .join('');
    }
    if (!text || typeof text !== 'string') {
        throw new Error(`Empty response from ${providerName} API`);
    }
    try {
        let jsonStr = text;
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match) {
            jsonStr = match[1];
        }
        return JSON.parse(jsonStr);
    }
    catch {
        return { raw_text: text };
    }
}
