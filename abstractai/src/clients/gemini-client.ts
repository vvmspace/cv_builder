import https from 'https';
import { URL } from 'url';
import { LLMClient } from '../llm-client';
import { parseLLMTextResponse } from '../utils/parse-llm-text-response';
import type { JsonObject, RateLimitError } from '../types';

export class GeminiClient extends LLMClient {
    private baseUrl: string;
    private apiKeys: string[];
    private fallbackChain: string[];

    constructor(apiKey: string) {
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

    async _callModel(prompt: string, model: string): Promise<JsonObject> {
        const isStreamingOnlyModel = model && model.startsWith('gemini-3.');
        const method = isStreamingOnlyModel ? 'streamGenerateContent' : 'generateContent';
        const url = new URL(`${this.baseUrl}/${model}:${method}`);
        url.searchParams.append('key', this._getRandomApiKey());

        const isGemma = model && model.toLowerCase().includes('gemma');
        const systemInstruction = 'Return valid JSON only. Do not include markdown formatting, preambles, or explanations. Start with "{" and end with "}".';
        
        // For Gemma models, we also prepend instructions to the user prompt since they often ignore system_instruction
        const effectivePrompt = isGemma 
            ? `STRICT: RETURN ONLY VALID JSON. NO TEXT BEFORE OR AFTER.\n\n${prompt}\n\nSTRICT: JSON ONLY.`
            : prompt;

        const payload = {
            system_instruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: [{
                parts: [{ text: effectivePrompt }]
            }],
            generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.1
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode === 429) {
                            const err = new Error('Google AI/Gemini API rate limit exceeded') as RateLimitError;
                            err.isRateLimit = true;
                            reject(err);
                            return;
                        }

                        if (!data) {
                            reject(new Error('Empty response from Google AI/Gemini API'));
                            return;
                        }

                        const messages: JsonObject[] = [];
                        if (isStreamingOnlyModel) {
                            const lines = data.split('\n').map((l) => l.trim()).filter(Boolean);
                            for (const line of lines) {
                                try {
                                    messages.push(JSON.parse(line) as JsonObject);
                                } catch {
                                    // Ignore malformed lines.
                                }
                            }
                        } else {
                            messages.push(JSON.parse(data) as JsonObject);
                        }

                        if (messages.length === 0) {
                            reject(new Error('Failed to parse streaming response from Google AI/Gemini API'));
                            return;
                        }

                        for (const msg of messages) {
                            const errorObj = (msg as { error?: { message?: string; code?: number; status?: string } }).error;
                            if (errorObj) {
                                const err = new Error(`Google AI/Gemini API Error: ${errorObj.message}`) as RateLimitError;
                                if (errorObj.code === 429 || errorObj.status === 'RESOURCE_EXHAUSTED') {
                                    err.isRateLimit = true;
                                }
                                reject(err);
                                return;
                            }
                        }

                        let collectedText = '';
                        for (const msg of messages) {
                            const candidates = (msg as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
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

                        resolve(parseLLMTextResponse(collectedText, `Google AI/Gemini (${model})`));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${(e as Error).message}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(JSON.stringify(payload));
            req.end();
        });
    }

    _getRandomApiKey(): string {
        if (this.apiKeys.length === 0) {
            throw new Error('Gemini API key not configured');
        }
        const index = Math.floor(Math.random() * this.apiKeys.length);
        return this.apiKeys[index];
    }

    async generateContent(prompt: string, model = 'gemini-3.1-pro-preview'): Promise<JsonObject> {
        const chain = [...this.fallbackChain];
        let modelsToTry: string[];

        if (model && chain.includes(model)) {
            const startIdx = chain.indexOf(model);
            modelsToTry = [...chain.slice(startIdx), ...chain.slice(0, startIdx)];
        } else if (model) {
            modelsToTry = [model, ...chain.filter((m) => m !== model)];
        } else {
            modelsToTry = chain;
        }

        let lastError: unknown;
        for (let i = 0; i < modelsToTry.length; i += 1) {
            const currentModel = modelsToTry[i];
            try {
                if (currentModel !== model) {
                    // eslint-disable-next-line no-console
                    console.warn(`Falling back to model ${currentModel} due to rate limits or errors on previous model.`);
                }
                // eslint-disable-next-line no-await-in-loop
                return await this._callModel(prompt, currentModel);
            } catch (err) {
                lastError = err;
                if (!(err as RateLimitError).isRateLimit || i === modelsToTry.length - 1) {
                    break;
                }
            }
        }

        throw (lastError as Error) || new Error('Failed to generate content with Google AI/Gemini models');
    }
}
