import type { JsonObject } from './types';

export abstract class LLMClient {
    protected apiKey: string;

    constructor(apiKey: string) {
        if (new.target === LLMClient) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.apiKey = apiKey;
    }

    abstract generateContent(prompt: string, model?: string): Promise<JsonObject>;
}
