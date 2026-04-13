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
        try {
            return JSON.parse(jsonStr);
        }
        catch (firstErr) {
            // If direct parse fails, try to find the first '{' and last '}'
            const startIdx = jsonStr.indexOf('{');
            const endIdx = jsonStr.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const potentialJson = jsonStr.substring(startIdx, endIdx + 1);
                try {
                    return JSON.parse(potentialJson);
                }
                catch (secondErr) {
                    throw firstErr; // Throw the original error if this also fails
                }
            }
            throw firstErr;
        }
    }
    catch {
        return { raw_text: text };
    }
}
