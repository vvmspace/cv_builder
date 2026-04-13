import { LLMClient } from './src/llm-client';
import { GeminiClient } from './src/clients/gemini-client';
import { OpenRouterClient } from './src/clients/openrouter-client';
import { GemmaClient } from './src/clients/gemma-client';
import { UnifiedLLMClient } from './src/clients/unified-llm-client';
import { OpenAICompatibleClient } from './src/openai-compatible-client';
declare function AbstractAI(options?: ConstructorParameters<typeof OpenAICompatibleClient>[0]): OpenAICompatibleClient;
declare const _default: typeof AbstractAI & {
    OpenAI: typeof OpenAICompatibleClient;
    OpenAICompatibleClient: typeof OpenAICompatibleClient;
    default: typeof OpenAICompatibleClient;
    LLMClient: typeof LLMClient;
    GeminiClient: typeof GeminiClient;
    GoogleAIClient: typeof GeminiClient;
    OpenRouterClient: typeof OpenRouterClient;
    GemmaClient: typeof GemmaClient;
    UnifiedLLMClient: typeof UnifiedLLMClient;
    clients: {
        LLMClient: typeof LLMClient;
        GeminiClient: typeof GeminiClient;
        GoogleAIClient: typeof GeminiClient;
        OpenRouterClient: typeof OpenRouterClient;
        GemmaClient: typeof GemmaClient;
        UnifiedLLMClient: typeof UnifiedLLMClient;
    };
};
export = _default;
