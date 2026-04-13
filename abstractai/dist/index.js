"use strict";
const llm_client_1 = require("./src/llm-client");
const gemini_client_1 = require("./src/clients/gemini-client");
const openrouter_client_1 = require("./src/clients/openrouter-client");
const gemma_client_1 = require("./src/clients/gemma-client");
const unified_llm_client_1 = require("./src/clients/unified-llm-client");
const openai_compatible_client_1 = require("./src/openai-compatible-client");
function AbstractAI(options) {
    return new openai_compatible_client_1.OpenAICompatibleClient(options);
}
module.exports = Object.assign(AbstractAI, {
    OpenAI: openai_compatible_client_1.OpenAICompatibleClient,
    OpenAICompatibleClient: openai_compatible_client_1.OpenAICompatibleClient,
    default: openai_compatible_client_1.OpenAICompatibleClient,
    LLMClient: llm_client_1.LLMClient,
    GeminiClient: gemini_client_1.GeminiClient,
    GoogleAIClient: gemini_client_1.GeminiClient,
    OpenRouterClient: openrouter_client_1.OpenRouterClient,
    GemmaClient: gemma_client_1.GemmaClient,
    UnifiedLLMClient: unified_llm_client_1.UnifiedLLMClient,
    clients: {
        LLMClient: llm_client_1.LLMClient,
        GeminiClient: gemini_client_1.GeminiClient,
        GoogleAIClient: gemini_client_1.GeminiClient,
        OpenRouterClient: openrouter_client_1.OpenRouterClient,
        GemmaClient: gemma_client_1.GemmaClient,
        UnifiedLLMClient: unified_llm_client_1.UnifiedLLMClient
    }
});
