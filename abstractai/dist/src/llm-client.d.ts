import type { JsonObject } from './types';
export declare abstract class LLMClient {
    protected apiKey: string;
    constructor(apiKey: string);
    abstract generateContent(prompt: string, model?: string): Promise<JsonObject>;
}
