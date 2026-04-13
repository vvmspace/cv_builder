import OpenAI from 'openai';
import { LLMClient } from '../llm-client';
import { parseLLMTextResponse } from '../utils/parse-llm-text-response';
import type { JsonObject } from '../types';

export class OpenRouterClient extends LLMClient {
    private client: OpenAI;

    constructor(apiKey: string) {
        super(apiKey);
        this.client = new OpenAI({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://abstractai.local',
                'X-Title': 'AbstractAI'
            }
        });
    }

    async generateContent(prompt: string, model = 'openrouter/free'): Promise<JsonObject> {
        try {
            const response = await this.client.chat.completions.create({
                model,
                messages: [{ role: 'user' as const, content: prompt }]
            });
            return parseLLMTextResponse(response?.choices?.[0]?.message?.content, 'OpenRouter');
        } catch (e) {
            throw new Error(`OpenRouter API error: ${(e as Error).message}`);
        }
    }
}
