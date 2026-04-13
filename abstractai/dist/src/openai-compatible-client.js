"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleClient = void 0;
exports.buildPromptFromMessages = buildPromptFromMessages;
exports.buildPromptFromInput = buildPromptFromInput;
const openai_1 = __importDefault(require("openai"));
const unified_llm_client_1 = require("./clients/unified-llm-client");
function makeId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}
function normalizeMessageContent(content) {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content)) {
        return content
            .map((item) => {
            if (typeof item === 'string')
                return item;
            if (item && typeof item.text === 'string') {
                return item.text;
            }
            return '';
        })
            .join('\n')
            .trim();
    }
    return '';
}
function buildPromptFromMessages(messages) {
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
function buildPromptFromInput(input) {
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
function toAssistantText(result) {
    if (typeof result.raw_text === 'string') {
        return result.raw_text;
    }
    return JSON.stringify(result);
}
class OpenAICompatibleClient extends openai_1.default {
    constructor(options = {}) {
        super({
            apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY || 'abstractai-local-key'
        });
        const geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || null;
        const openRouterApiKey = options.openRouterApiKey || process.env.OPENROUTER_API_KEY || null;
        const gemmaApiUrl = options.gemmaApiUrl || process.env.GEMMA_API_URL || null;
        const gemmaApiKey = options.gemmaApiKey || process.env.GEMMA_API_KEY || null;
        this.unified = new unified_llm_client_1.UnifiedLLMClient(geminiApiKey, openRouterApiKey, gemmaApiUrl, gemmaApiKey);
        const chatResource = {
            completions: {
                create: async (params = {}) => {
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
            create: async (params = {}) => {
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
    async generateContent(prompt, model) {
        return this.unified.generateContent(prompt, model);
    }
    async generateFromMessages(messages, model) {
        const prompt = buildPromptFromMessages(messages);
        return this.unified.generateContent(prompt, model);
    }
    async generateFromInput(input, model) {
        const prompt = buildPromptFromInput(input);
        return this.unified.generateContent(prompt, model);
    }
    getUnifiedClient() {
        return this.unified;
    }
}
exports.OpenAICompatibleClient = OpenAICompatibleClient;
