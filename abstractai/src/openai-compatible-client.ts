import OpenAI from 'openai';
import { UnifiedLLMClient } from './clients/unified-llm-client';
import type { JsonObject } from './types';

type Message = { role?: string; content?: unknown };
type OutputItem = { content?: unknown; text?: unknown };
type OpenAICompatOptions = {
    geminiApiKey?: string;
    openRouterApiKey?: string;
    gemmaApiUrl?: string;
    gemmaApiKey?: string;
    openaiApiKey?: string;
};
type ChatCreateParams = { model?: string; messages?: Message[]; stream?: boolean };
type ResponsesCreateParams = { model?: string; input?: string | OutputItem[]; stream?: boolean };

function makeId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeMessageContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof (item as { text?: unknown }).text === 'string') {
                    return (item as { text: string }).text;
                }
                return '';
            })
            .join('\n')
            .trim();
    }
    return '';
}

export function buildPromptFromMessages(messages?: Message[]): string {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('messages is required');
    }

    return messages
        .map((m) => {
            const role = String(m?.role || 'user').toUpperCase();
            const content = normalizeMessageContent(m?.content);
            return `${role}: ${content}`;
        })
        .join('\n\n');
}

export function buildPromptFromInput(input?: string | OutputItem[]): string {
    if (typeof input === 'string') {
        return input;
    }
    if (Array.isArray(input)) {
        return input
            .map((item) => normalizeMessageContent(item?.content ?? item?.text ?? item))
            .join('\n')
            .trim();
    }
    throw new Error('input is required');
}

function toAssistantText(result: JsonObject): string {
    if (typeof result.raw_text === 'string') {
        return result.raw_text;
    }
    return JSON.stringify(result);
}

export class OpenAICompatibleClient extends OpenAI {
    unified: UnifiedLLMClient;

    constructor(options: OpenAICompatOptions = {}) {
        super({
            apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY || 'abstractai-local-key'
        });

        const geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || null;
        const openRouterApiKey = options.openRouterApiKey || process.env.OPENROUTER_API_KEY || null;
        const gemmaApiUrl = options.gemmaApiUrl || process.env.GEMMA_API_URL || null;
        const gemmaApiKey = options.gemmaApiKey || process.env.GEMMA_API_KEY || null;

        this.unified = new UnifiedLLMClient(
            geminiApiKey,
            openRouterApiKey,
            gemmaApiUrl,
            gemmaApiKey
        );

        const chatResource = {
            completions: {
                create: async (params: ChatCreateParams = {}) => {
                    if (params.stream) {
                        throw new Error('Streaming is not supported in abstractai OpenAI-compatible client');
                    }
                    const prompt = buildPromptFromMessages(params.messages);
                    const model = params.model;
                    const generated = await this.unified.generateContent(prompt, model);
                    const text = toAssistantText(generated);
                    const created = Math.floor(Date.now() / 1000);

                    return {
                        id: makeId('chatcmpl'),
                        object: 'chat.completion',
                        created,
                        model: model || this.unified.defaultModel,
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: text
                                },
                                finish_reason: 'stop'
                            }
                        ]
                    };
                }
            }
        };

        const responsesResource = {
            create: async (params: ResponsesCreateParams = {}) => {
                if (params.stream) {
                    throw new Error('Streaming is not supported in abstractai OpenAI-compatible client');
                }
                const prompt = buildPromptFromInput(params.input);
                const model = params.model;
                const generated = await this.unified.generateContent(prompt, model);
                const text = toAssistantText(generated);
                const created = Math.floor(Date.now() / 1000);

                return {
                    id: makeId('resp'),
                    object: 'response',
                    created_at: created,
                    model: model || this.unified.defaultModel,
                    output: [
                        {
                            type: 'message',
                            role: 'assistant',
                            content: [
                                {
                                    type: 'output_text',
                                    text
                                }
                            ]
                        }
                    ],
                    output_text: text
                };
            }
        };

        Object.defineProperty(this, 'chat', {
            value: chatResource,
            writable: true,
            configurable: true
        });

        Object.defineProperty(this, 'responses', {
            value: responsesResource,
            writable: true,
            configurable: true
        });
    }

    async generateContent(prompt: string, model?: string): Promise<JsonObject> {
        return this.unified.generateContent(prompt, model);
    }

    async generateFromMessages(messages: Message[], model?: string): Promise<JsonObject> {
        const prompt = buildPromptFromMessages(messages);
        return this.unified.generateContent(prompt, model);
    }

    async generateFromInput(input: string | OutputItem[], model?: string): Promise<JsonObject> {
        const prompt = buildPromptFromInput(input);
        return this.unified.generateContent(prompt, model);
    }

    getUnifiedClient(): UnifiedLLMClient {
        return this.unified;
    }
}
