import { LLMClient } from '../llm-client';
import { GeminiClient } from './gemini-client';
import { OpenRouterClient } from './openrouter-client';
import { GemmaClient } from './gemma-client';
import type { JsonObject } from '../types';

export class UnifiedLLMClient extends LLMClient {
    geminiClient: GeminiClient | null;
    openRouterClient: OpenRouterClient | null;
    gemmaClient: GemmaClient | null;
    defaultModel: string;

    constructor(geminiKey: string | null, openRouterKey: string | null, gemmaApiUrl?: string | null, gemmaApiKey?: string | null) {
        super('unified');
        this.geminiClient = geminiKey ? new GeminiClient(geminiKey) : null;
        this.openRouterClient = openRouterKey ? new OpenRouterClient(openRouterKey) : null;
        this.gemmaClient = (gemmaApiUrl && gemmaApiKey) ? new GemmaClient(gemmaApiUrl, gemmaApiKey) : null;
        this.defaultModel = this.gemmaClient ? (process.env.GEMMA_MODEL || 'gemma') : 'gemini-3.1-pro-preview';
    }

    async generateContent(prompt: string, model?: string): Promise<JsonObject> {
        const resolvedModel = model || this.defaultModel;
        const isGoogleGemma = /^(?:gemma-[234]|gemma-2-)/i.test(resolvedModel);
        const isGemma = resolvedModel.startsWith('gemma');
        const isGemini = resolvedModel.startsWith('gemini');

        if (isGemini || isGoogleGemma) {
            if (!this.geminiClient) throw new Error('Google AI/Gemini API key not configured');
            return this.geminiClient.generateContent(prompt, resolvedModel);
        }
        if (isGemma) {
            if (!this.gemmaClient) throw new Error('Gemma API URL or key not configured');
            return this.gemmaClient.generateContent(prompt, resolvedModel);
        }
        if (!this.openRouterClient) throw new Error('OpenRouter API key not configured');
        return this.openRouterClient.generateContent(prompt, resolvedModel);
    }
}
