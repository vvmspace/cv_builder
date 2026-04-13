"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterClient = void 0;
const openai_1 = __importDefault(require("openai"));
const llm_client_1 = require("../llm-client");
const parse_llm_text_response_1 = require("../utils/parse-llm-text-response");
class OpenRouterClient extends llm_client_1.LLMClient {
    constructor(apiKey) {
        super(apiKey);
        this.client = new openai_1.default({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://abstractai.local',
                'X-Title': 'AbstractAI'
            }
        });
    }
    async generateContent(prompt, model = 'openrouter/free') {
        try {
            const response = await this.client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }]
            });
            return (0, parse_llm_text_response_1.parseLLMTextResponse)(response?.choices?.[0]?.message?.content, 'OpenRouter');
        }
        catch (e) {
            throw new Error(`OpenRouter API error: ${e.message}`);
        }
    }
}
exports.OpenRouterClient = OpenRouterClient;
