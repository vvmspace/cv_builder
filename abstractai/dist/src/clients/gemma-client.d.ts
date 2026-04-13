import OpenAI from 'openai';
import { LLMClient } from '../llm-client';
import type { JsonObject } from '../types';
type GemmaWsMessage = {
    error?: {
        message?: string;
    };
    choices?: Array<{
        delta?: {
            content?: string | Array<{
                text?: string;
            }>;
        };
        message?: {
            content?: string | Array<{
                text?: string;
            }>;
        };
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
export declare class GemmaClient extends LLMClient {
    private baseUrl;
    private defaultModel;
    transport: 'http' | 'ws';
    wsUrl: string | null;
    client: OpenAI | null;
    constructor(apiUrl: string, apiKey: string);
    _resolveBaseUrl(): string;
    _resolveTransport(): 'http' | 'ws';
    _resolveWsUrl(): string;
    _extractWsChunkText(message: GemmaWsMessage): string;
    _isWsDoneMessage(message: GemmaWsMessage): boolean;
    _generateViaWebSocket(payload: JsonObject): Promise<JsonObject>;
    generateContent(prompt: string, model?: string): Promise<JsonObject>;
}
export {};
