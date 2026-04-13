import { LLMClient } from './src/llm-client';
import { GeminiClient } from './src/clients/gemini-client';
import { OpenRouterClient } from './src/clients/openrouter-client';
import { GemmaClient } from './src/clients/gemma-client';
import { UnifiedLLMClient } from './src/clients/unified-llm-client';
import { OpenAICompatibleClient } from './src/openai-compatible-client';

function AbstractAI(options?: ConstructorParameters<typeof OpenAICompatibleClient>[0]): OpenAICompatibleClient {
    return new OpenAICompatibleClient(options);
}

export = Object.assign(AbstractAI, {
    OpenAI: OpenAICompatibleClient,
    OpenAICompatibleClient,
    default: OpenAICompatibleClient,
    LLMClient,
    GeminiClient,
    GoogleAIClient: GeminiClient,
    OpenRouterClient,
    GemmaClient,
    UnifiedLLMClient,
    clients: {
        LLMClient,
        GeminiClient,
        GoogleAIClient: GeminiClient,
        OpenRouterClient,
        GemmaClient,
        UnifiedLLMClient
    }
});
