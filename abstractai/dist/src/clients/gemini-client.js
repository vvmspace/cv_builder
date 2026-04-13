"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
const llm_client_1 = require("../llm-client");
class GeminiClient extends llm_client_1.LLMClient {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        this.apiKeys = String(apiKey)
            .split(',')
            .map((key) => key.trim())
            .filter(Boolean);
        this.fallbackChain = [
            'gemini-3.1-pro-preview',
            'gemma-4-31b-it',
            'gemma-4-26b-a4b-it',
            'gemini-2.5-flash',
            'gemini-2.0-flash'
        ];
    }
    async _callModel(prompt, model) {
        const isStreamingOnlyModel = model && model.startsWith('gemini-3.');
        const method = isStreamingOnlyModel ? 'streamGenerateContent' : 'generateContent';
        const url = new url_1.URL(`${this.baseUrl}/${model}:${method}`);
        url.searchParams.append('key', this._getRandomApiKey());
        const payload = {
            contents: [{
                    parts: [{ text: prompt }]
                }],
            generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.7
            }
        };
        return new Promise((resolve, reject) => {
            const req = https_1.default.request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode === 429) {
                            const err = new Error('Google AI/Gemini API rate limit exceeded');
                            err.isRateLimit = true;
                            reject(err);
                            return;
                        }
                        if (!data) {
                            reject(new Error('Empty response from Google AI/Gemini API'));
                            return;
                        }
                        const messages = [];
                        if (isStreamingOnlyModel) {
                            const lines = data.split('\n').map((l) => l.trim()).filter(Boolean);
                            for (const line of lines) {
                                try {
                                    messages.push(JSON.parse(line));
                                }
                                catch {
                                    // Ignore malformed lines.
                                }
                            }
                        }
                        else {
                            messages.push(JSON.parse(data));
                        }
                        if (messages.length === 0) {
                            reject(new Error('Failed to parse streaming response from Google AI/Gemini API'));
                            return;
                        }
                        for (const msg of messages) {
                            const errorObj = msg.error;
                            if (errorObj) {
                                const err = new Error(`Google AI/Gemini API Error: ${errorObj.message}`);
                                if (errorObj.code === 429 || errorObj.status === 'RESOURCE_EXHAUSTED') {
                                    err.isRateLimit = true;
                                }
                                reject(err);
                                return;
                            }
                        }
                        let collectedText = '';
                        for (const msg of messages) {
                            const candidates = msg.candidates;
                            const parts = candidates?.[0]?.content?.parts || [];
                            for (const part of parts) {
                                if (typeof part.text === 'string') {
                                    collectedText += part.text;
                                }
                            }
                        }
                        if (!collectedText) {
                            reject(new Error('Unexpected response structure from Google AI/Gemini API'));
                            return;
                        }
                        try {
                            resolve(JSON.parse(collectedText));
                        }
                        catch {
                            resolve({ raw_text: collectedText });
                        }
                    }
                    catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(JSON.stringify(payload));
            req.end();
        });
    }
    _getRandomApiKey() {
        if (this.apiKeys.length === 0) {
            throw new Error('Gemini API key not configured');
        }
        const index = Math.floor(Math.random() * this.apiKeys.length);
        return this.apiKeys[index];
    }
    async generateContent(prompt, model = 'gemini-3.1-pro-preview') {
        const chain = [...this.fallbackChain];
        let modelsToTry;
        if (model && chain.includes(model)) {
            const startIdx = chain.indexOf(model);
            modelsToTry = [...chain.slice(startIdx), ...chain.slice(0, startIdx)];
        }
        else if (model) {
            modelsToTry = [model, ...chain.filter((m) => m !== model)];
        }
        else {
            modelsToTry = chain;
        }
        let lastError;
        for (let i = 0; i < modelsToTry.length; i += 1) {
            const currentModel = modelsToTry[i];
            try {
                if (currentModel !== model) {
                    // eslint-disable-next-line no-console
                    console.warn(`Falling back to model ${currentModel} due to rate limits or errors on previous model.`);
                }
                // eslint-disable-next-line no-await-in-loop
                return await this._callModel(prompt, currentModel);
            }
            catch (err) {
                lastError = err;
                if (!err.isRateLimit || i === modelsToTry.length - 1) {
                    break;
                }
            }
        }
        throw lastError || new Error('Failed to generate content with Google AI/Gemini models');
    }
}
exports.GeminiClient = GeminiClient;
