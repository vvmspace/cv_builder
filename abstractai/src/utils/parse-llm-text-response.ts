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
        return JSON.parse(jsonStr) as JsonObject;
    } catch {
        return { raw_text: text };
    }
}
