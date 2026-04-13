import { LLMClient } from '../llm-client';
import { GeminiClient } from './gemini-client';
import { OpenRouterClient } from './openrouter-client';
import { GemmaClient } from './gemma-client';
import type { JsonObject } from '../types';
export declare class UnifiedLLMClient extends LLMClient {
    geminiClient: GeminiClient | null;
    openRouterClient: OpenRouterClient | null;
    gemmaClient: GemmaClient | null;
    defaultModel: string;
    constructor(geminiKey: string | null, openRouterKey: string | null, gemmaApiUrl?: string | null, gemmaApiKey?: string | null);
    generateContent(prompt: string, model?: string): Promise<JsonObject>;
}
