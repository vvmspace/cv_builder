import { LLMClient } from '../llm-client';
import type { JsonObject } from '../types';
export declare class GeminiClient extends LLMClient {
    private baseUrl;
    private apiKeys;
    private fallbackChain;
    constructor(apiKey: string);
    _callModel(prompt: string, model: string): Promise<JsonObject>;
    _getRandomApiKey(): string;
    generateContent(prompt: string, model?: string): Promise<JsonObject>;
}
