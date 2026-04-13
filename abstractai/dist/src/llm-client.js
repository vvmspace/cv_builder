"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
class LLMClient {
    constructor(apiKey) {
        if (new.target === LLMClient) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.apiKey = apiKey;
    }
}
exports.LLMClient = LLMClient;
