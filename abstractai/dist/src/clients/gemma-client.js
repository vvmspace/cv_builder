"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GemmaClient = void 0;
const openai_1 = __importDefault(require("openai"));
const ws_1 = __importDefault(require("ws"));
const llm_client_1 = require("../llm-client");
const parse_llm_text_response_1 = require("../utils/parse-llm-text-response");
class GemmaClient extends llm_client_1.LLMClient {
    constructor(apiUrl, apiKey) {
        super(apiKey);
        this.baseUrl = apiUrl;
        this.defaultModel = process.env.GEMMA_MODEL || 'gemma';
        this.transport = this._resolveTransport();
        this.wsUrl = this.transport === 'ws' ? this._resolveWsUrl() : null;
        this.client = this.transport === 'http'
            ? new openai_1.default({
                apiKey,
                baseURL: this._resolveBaseUrl(),
                defaultHeaders: { 'x-api-key': apiKey }
            })
            : null;
    }
    _resolveBaseUrl() {
        const normalized = String(this.baseUrl || '').trim().replace(/\/+$/, '');
        if (!normalized) {
            throw new Error('Gemma API URL not configured');
        }
        if (/\/chat\/completions$/i.test(normalized)) {
            return normalized.replace(/\/chat\/completions$/i, '');
        }
        if (/\/v1$/i.test(normalized)) {
            return normalized;
        }
        return `${normalized}/v1`;
    }
    _resolveTransport() {
        const normalized = String(this.baseUrl || '').trim();
        return /^wss?:\/\//i.test(normalized) ? 'ws' : 'http';
    }
    _resolveWsUrl() {
        const normalized = String(this.baseUrl || '').trim().replace(/\/+$/, '');
        if (!normalized) {
            throw new Error('Gemma API URL not configured');
        }
        if (/\/chat\/completions$/i.test(normalized)) {
            return normalized;
        }
        if (/\/v1$/i.test(normalized)) {
            return `${normalized}/chat/completions`;
        }
        return `${normalized}/v1/chat/completions`;
    }
    _extractWsChunkText(message) {
        if (!message || typeof message !== 'object')
            return '';
        if (Array.isArray(message.choices) && message.choices.length > 0) {
            const content = message.choices[0]?.delta?.content || message.choices[0]?.message?.content;
            if (typeof content === 'string')
                return content;
            if (Array.isArray(content)) {
                return content
                    .filter((part) => part && typeof part.text === 'string')
                    .map((part) => part.text)
                    .join('');
            }
        }
        if (typeof message.delta === 'string')
            return message.delta;
        if (typeof message.text === 'string')
            return message.text;
        if (typeof message.content === 'string')
            return message.content;
        return '';
    }
    _isWsDoneMessage(message) {
        if (!message || typeof message !== 'object')
            return false;
        return message.done === true
            || message.type === 'done'
            || message.event === 'done'
            || message.finish_reason === 'stop'
            || message.choices?.[0]?.finish_reason === 'stop';
    }
    async _generateViaWebSocket(payload) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let collectedText = '';
            const timeoutMs = Number(process.env.GEMMA_WS_TIMEOUT_MS) || 60000;
            const ws = new ws_1.default(this.wsUrl, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'x-api-key': this.apiKey
                }
            });
            const cleanup = () => {
                clearTimeout(timeout);
                ws.removeAllListeners();
                if (ws.readyState === ws_1.default.OPEN || ws.readyState === ws_1.default.CONNECTING) {
                    ws.close();
                }
            };
            const finalizeResolve = (value) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                resolve(value);
            };
            const finalizeReject = (error) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                reject(error);
            };
            const timeout = setTimeout(() => {
                finalizeReject(new Error(`Gemma WebSocket timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            ws.on('open', () => {
                ws.send(JSON.stringify(payload));
            });
            ws.on('message', (raw) => {
                try {
                    const data = typeof raw === 'string' ? raw : raw.toString('utf8');
                    const msg = JSON.parse(data);
                    if (msg?.error) {
                        finalizeReject(new Error(`Gemma API error: ${msg.error.message || JSON.stringify(msg.error)}`));
                        return;
                    }
                    if (Array.isArray(msg?.choices) && msg.choices.length > 0 && msg.choices[0]?.message?.content) {
                        finalizeResolve((0, parse_llm_text_response_1.parseLLMTextResponse)(msg.choices[0].message.content, 'Gemma'));
                        return;
                    }
                    const chunk = this._extractWsChunkText(msg);
                    if (chunk) {
                        collectedText += chunk;
                    }
                    if (this._isWsDoneMessage(msg)) {
                        if (!collectedText) {
                            finalizeReject(new Error('Empty response from Gemma API'));
                            return;
                        }
                        finalizeResolve((0, parse_llm_text_response_1.parseLLMTextResponse)(collectedText, 'Gemma'));
                    }
                }
                catch (e) {
                    finalizeReject(new Error(`Failed to parse Gemma WebSocket response: ${e.message}`));
                }
            });
            ws.on('error', (error) => {
                finalizeReject(new Error(`Gemma WebSocket error: ${error.message}`));
            });
            ws.on('close', () => {
                if (settled)
                    return;
                if (!collectedText) {
                    finalizeReject(new Error('Gemma WebSocket closed before response was received'));
                    return;
                }
                finalizeResolve((0, parse_llm_text_response_1.parseLLMTextResponse)(collectedText, 'Gemma'));
            });
        });
    }
    async generateContent(prompt, model = this.defaultModel) {
        const payload = {
            model: model || this.defaultModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
        };
        if (this.transport === 'ws') {
            return this._generateViaWebSocket(payload);
        }
        try {
            const response = await this.client.chat.completions.create(payload);
            return (0, parse_llm_text_response_1.parseLLMTextResponse)(response?.choices?.[0]?.message?.content, 'Gemma');
        }
        catch (e) {
            throw new Error(`Gemma API error: ${e.message}`);
        }
    }
}
exports.GemmaClient = GemmaClient;
