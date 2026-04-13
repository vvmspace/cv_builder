import OpenAI from 'openai';
import WebSocket from 'ws';
import { LLMClient } from '../llm-client';
import { parseLLMTextResponse } from '../utils/parse-llm-text-response';
import type { JsonObject } from '../types';

type GemmaWsMessage = {
    error?: { message?: string };
    choices?: Array<{
        delta?: { content?: string | Array<{ text?: string }> };
        message?: { content?: string | Array<{ text?: string }> };
        finish_reason?: string;
    }>;
    done?: boolean;
    type?: string;
    event?: string;
    finish_reason?: string;
    delta?: string;
    text?: string;
    content?: string;
};

export class GemmaClient extends LLMClient {
    private baseUrl: string;
    private defaultModel: string;
    transport: 'http' | 'ws';
    wsUrl: string | null;
    client: OpenAI | null;

    constructor(apiUrl: string, apiKey: string) {
        super(apiKey);
        this.baseUrl = apiUrl;
        this.defaultModel = process.env.GEMMA_MODEL || 'gemma';
        this.transport = this._resolveTransport();
        this.wsUrl = this.transport === 'ws' ? this._resolveWsUrl() : null;
        this.client = this.transport === 'http'
            ? new OpenAI({
                apiKey,
                baseURL: this._resolveBaseUrl(),
                defaultHeaders: { 'x-api-key': apiKey }
            })
            : null;
    }

    _resolveBaseUrl(): string {
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

    _resolveTransport(): 'http' | 'ws' {
        const normalized = String(this.baseUrl || '').trim();
        return /^wss?:\/\//i.test(normalized) ? 'ws' : 'http';
    }

    _resolveWsUrl(): string {
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

    _extractWsChunkText(message: GemmaWsMessage): string {
        if (!message || typeof message !== 'object') return '';

        if (Array.isArray(message.choices) && message.choices.length > 0) {
            const content = message.choices[0]?.delta?.content || message.choices[0]?.message?.content;
            if (typeof content === 'string') return content;
            if (Array.isArray(content)) {
                return content
                    .filter((part) => part && typeof part.text === 'string')
                    .map((part) => part.text as string)
                    .join('');
            }
        }

        if (typeof message.delta === 'string') return message.delta;
        if (typeof message.text === 'string') return message.text;
        if (typeof message.content === 'string') return message.content;
        return '';
    }

    _isWsDoneMessage(message: GemmaWsMessage): boolean {
        if (!message || typeof message !== 'object') return false;
        return message.done === true
            || message.type === 'done'
            || message.event === 'done'
            || message.finish_reason === 'stop'
            || message.choices?.[0]?.finish_reason === 'stop';
    }

    async _generateViaWebSocket(payload: JsonObject): Promise<JsonObject> {
        return new Promise((resolve, reject) => {
            let settled = false;
            let collectedText = '';
            const timeoutMs = Number(process.env.GEMMA_WS_TIMEOUT_MS) || 60000;

            const ws = new WebSocket(this.wsUrl as string, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'x-api-key': this.apiKey
                }
            });

            const cleanup = () => {
                clearTimeout(timeout);
                ws.removeAllListeners();
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            };

            const finalizeResolve = (value: JsonObject) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(value);
            };

            const finalizeReject = (error: Error) => {
                if (settled) return;
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
                    const msg = JSON.parse(data) as GemmaWsMessage;

                    if (msg?.error) {
                        finalizeReject(new Error(`Gemma API error: ${msg.error.message || JSON.stringify(msg.error)}`));
                        return;
                    }

                    if (Array.isArray(msg?.choices) && msg.choices.length > 0 && msg.choices[0]?.message?.content) {
                        finalizeResolve(parseLLMTextResponse(msg.choices[0].message.content, 'Gemma'));
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
                        finalizeResolve(parseLLMTextResponse(collectedText, 'Gemma'));
                    }
                } catch (e) {
                    finalizeReject(new Error(`Failed to parse Gemma WebSocket response: ${(e as Error).message}`));
                }
            });

            ws.on('error', (error) => {
                finalizeReject(new Error(`Gemma WebSocket error: ${error.message}`));
            });

            ws.on('close', () => {
                if (settled) return;
                if (!collectedText) {
                    finalizeReject(new Error('Gemma WebSocket closed before response was received'));
                    return;
                }
                finalizeResolve(parseLLMTextResponse(collectedText, 'Gemma'));
            });
        });
    }

    async generateContent(prompt: string, model = this.defaultModel): Promise<JsonObject> {
        const payload = {
            model: model || this.defaultModel,
            messages: [{ role: 'user' as const, content: prompt }],
            temperature: 0.7
        };

        if (this.transport === 'ws') {
            return this._generateViaWebSocket(payload);
        }

        try {
            const response = await (this.client as OpenAI).chat.completions.create(payload);
            return parseLLMTextResponse(response?.choices?.[0]?.message?.content, 'Gemma');
        } catch (e) {
            throw new Error(`Gemma API error: ${(e as Error).message}`);
        }
    }
}
