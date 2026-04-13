import type { JsonObject } from '../types';

export function parseLLMTextResponse(content: unknown, providerName: string): JsonObject {
    let text: unknown = content;

    if (Array.isArray(content)) {
        text = content
            .filter((part): part is { text: string } => Boolean(part) && typeof (part as { text?: unknown }).text === 'string')
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
            return JSON.parse(jsonStr) as JsonObject;
        } catch (firstErr) {
            // If direct parse fails, try to find the first '{' and last '}'
            const startIdx = jsonStr.indexOf('{');
            const endIdx = jsonStr.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const potentialJson = jsonStr.substring(startIdx, endIdx + 1);
                try {
                    return JSON.parse(potentialJson) as JsonObject;
                } catch (secondErr) {
                    throw firstErr; // Throw the original error if this also fails
                }
            }
            throw firstErr;
        }
    } catch {
        return { raw_text: text };
    }
}
