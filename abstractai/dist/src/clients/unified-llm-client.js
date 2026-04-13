"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedLLMClient = void 0;
const llm_client_1 = require("../llm-client");
const gemini_client_1 = require("./gemini-client");
const openrouter_client_1 = require("./openrouter-client");
const gemma_client_1 = require("./gemma-client");
class UnifiedLLMClient extends llm_client_1.LLMClient {
    constructor(geminiKey, openRouterKey, gemmaApiUrl, gemmaApiKey) {
        super('unified');
        this.geminiClient = geminiKey ? new gemini_client_1.GeminiClient(geminiKey) : null;
        this.openRouterClient = openRouterKey ? new openrouter_client_1.OpenRouterClient(openRouterKey) : null;
        this.gemmaClient = (gemmaApiUrl && gemmaApiKey) ? new gemma_client_1.GemmaClient(gemmaApiUrl, gemmaApiKey) : null;
        this.defaultModel = this.gemmaClient ? (process.env.GEMMA_MODEL || 'gemma') : 'gemini-3.1-pro-preview';
    }
    async generateContent(prompt, model) {
        const resolvedModel = model || this.defaultModel;
        const isGoogleGemma = /^(?:gemma-[234]|gemma-2-)/i.test(resolvedModel);
        const isGemma = resolvedModel.startsWith('gemma');
        const isGemini = resolvedModel.startsWith('gemini');
        if (isGemini || isGoogleGemma) {
            if (!this.geminiClient)
                throw new Error('Google AI/Gemini API key not configured');
            return this.geminiClient.generateContent(prompt, resolvedModel);
        }
        if (isGemma) {
            if (!this.gemmaClient)
                throw new Error('Gemma API URL or key not configured');
            return this.gemmaClient.generateContent(prompt, resolvedModel);
        }
        if (!this.openRouterClient)
            throw new Error('OpenRouter API key not configured');
        return this.openRouterClient.generateContent(prompt, resolvedModel);
    }
}
exports.UnifiedLLMClient = UnifiedLLMClient;
