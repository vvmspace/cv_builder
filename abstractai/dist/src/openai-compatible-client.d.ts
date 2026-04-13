import OpenAI from 'openai';
import { UnifiedLLMClient } from './clients/unified-llm-client';
import type { JsonObject } from './types';
type Message = {
    role?: string;
    content?: unknown;
};
type OutputItem = {
    content?: unknown;
    text?: unknown;
};
type OpenAICompatOptions = {
    geminiApiKey?: string;
    openRouterApiKey?: string;
    gemmaApiUrl?: string;
    gemmaApiKey?: string;
    openaiApiKey?: string;
};
export declare function buildPromptFromMessages(messages?: Message[]): string;
export declare function buildPromptFromInput(input?: string | OutputItem[]): string;
export declare class OpenAICompatibleClient extends OpenAI {
    unified: UnifiedLLMClient;
    constructor(options?: OpenAICompatOptions);
    generateContent(prompt: string, model?: string): Promise<JsonObject>;
    generateFromMessages(messages: Message[], model?: string): Promise<JsonObject>;
    generateFromInput(input: string | OutputItem[], model?: string): Promise<JsonObject>;
    getUnifiedClient(): UnifiedLLMClient;
}
export {};
