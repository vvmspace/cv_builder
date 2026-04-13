import { LLMClient } from '../llm-client';
import type { JsonObject } from '../types';
export declare class OpenRouterClient extends LLMClient {
    private client;
    constructor(apiKey: string);
    generateContent(prompt: string, model?: string): Promise<JsonObject>;
}
