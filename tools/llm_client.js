const https = require('https');
const { URL } = require('url');

class LLMClient {
    constructor(apiKey) {
        if (this.constructor === LLMClient) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.apiKey = apiKey;
    }

    async generateContent(prompt, model) {
        throw new Error("Method 'generateContent' must be implemented.");
    }
}

class GeminiClient extends LLMClient {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
        this.apiKeys = String(apiKey)
            .split(',')
            .map((key) => key.trim())
            .filter(Boolean);
        this.fallbackChain = [
            'gemini-3.1-pro-preview',
            'gemini-2.5-flash',
            'gemini-2.0-flash'
        ];
    }

    /**
     * Low-level single-model call. Separated for easier testing/mocking.
     * Marks rate-limit errors with err.isRateLimit = true.
     * @param {string} prompt
     * @param {string} model
     * @returns {Promise<object>}
     * @private
     */
    async _callModel(prompt, model) {
        const isStreamingOnlyModel = model && model.startsWith('gemini-3.');
        const method = isStreamingOnlyModel ? 'streamGenerateContent' : 'generateContent';
        const url = new URL(`${this.baseUrl}/${model}:${method}`);
        url.searchParams.append('key', this._getRandomApiKey());

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.7
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode === 429) {
                            const err = new Error('Gemini API rate limit exceeded');
                            err.isRateLimit = true;
                            reject(err);
                            return;
                        }

                        if (!data) {
                            reject(new Error('Empty response from Gemini API'));
                            return;
                        }

                        // For streaming APIs, the response body is a sequence of JSON
                        // objects separated by newlines. For non-streaming, it is a single JSON.
                        const messages = [];
                        if (isStreamingOnlyModel) {
                            const lines = data.split('\n').map((l) => l.trim()).filter(Boolean);
                            for (const line of lines) {
                                try {
                                    messages.push(JSON.parse(line));
                                } catch (e) {
                                    // Ignore malformed lines; we'll fail later if nothing useful is parsed.
                                }
                            }
                        } else {
                            messages.push(JSON.parse(data));
                        }

                        if (messages.length === 0) {
                            reject(new Error('Failed to parse streaming response from Gemini API'));
                            return;
                        }

                        // Check for API errors on any message.
                        for (const msg of messages) {
                            if (msg && msg.error) {
                                const err = new Error(`Gemini API Error: ${msg.error.message}`);
                                const code = msg.error.code;
                                const status = msg.error.status;
                                if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
                                    err.isRateLimit = true;
                                }
                                reject(err);
                                return;
                            }
                        }

                        // Collect text from all candidate chunks.
                        let collectedText = '';
                        for (const msg of messages) {
                            if (msg.candidates && msg.candidates[0] && msg.candidates[0].content) {
                                const parts = msg.candidates[0].content.parts || [];
                                for (const part of parts) {
                                    if (typeof part.text === 'string') {
                                        collectedText += part.text;
                                    }
                                }
                            }
                        }

                        if (!collectedText) {
                            reject(new Error('Unexpected response structure from Gemini API'));
                            return;
                        }

                        try {
                            resolve(JSON.parse(collectedText));
                        } catch (e) {
                            resolve({ raw_text: collectedText });
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            });

            req.on('error', (e) => reject(e));
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

    /**
     * Generates content using the Gemini API with fallback queue in case of limits.
     * Fallback order (unless overridden by model parameter):
     *   gemini-3.1-pro-preview -> gemini-2.5-flash -> gemini-2.0-flash
     * @param {string} prompt
     * @param {string} model
     * @returns {Promise<object>}
     */
    async generateContent(prompt, model = 'gemini-3.1-pro-preview') {
        const chain = [...this.fallbackChain];

        let modelsToTry;
        if (model && chain.includes(model)) {
            const startIdx = chain.indexOf(model);
            modelsToTry = [...chain.slice(startIdx), ...chain.slice(0, startIdx)];
        } else if (model) {
            modelsToTry = [model, ...chain.filter((m) => m !== model)];
        } else {
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
            } catch (err) {
                lastError = err;
                if (!err.isRateLimit || i === modelsToTry.length - 1) {
                    break;
                }
            }
        }

        throw lastError || new Error('Failed to generate content with Gemini models');
    }
}

class OpenRouterClient extends LLMClient {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    }

    async generateContent(prompt, model = 'openrouter/free') {
        const payload = {
            model: model,
            messages: [{ role: 'user', content: prompt }]
        };

        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl);
            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'https://cvbuilder.local',
                    'X-Title': 'CV Builder',
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            reject(new Error(`OpenRouter API error: ${res.statusCode} ${data}`));
                            return;
                        }

                        const response = JSON.parse(data);
                        if (!response.choices || response.choices.length === 0) {
                            reject(new Error('Empty response from OpenRouter API'));
                            return;
                        }

                        const text = response.choices[0].message.content;
                        try {
                            let jsonStr = text;
                            const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                            if (match) {
                                jsonStr = match[1];
                            }
                            resolve(JSON.parse(jsonStr));
                        } catch (e) {
                            resolve({ raw_text: text });
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse OpenRouter response: ${e.message}`));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write(JSON.stringify(payload));
            req.end();
        });
    }
}

class UnifiedLLMClient extends LLMClient {
    constructor(geminiKey, openRouterKey) {
        super("unified");
        this.geminiClient = geminiKey ? new GeminiClient(geminiKey) : null;
        this.openRouterClient = openRouterKey ? new OpenRouterClient(openRouterKey) : null;
    }

    async generateContent(prompt, model) {
        const isGemini = !model || model.startsWith('gemini');
        if (isGemini) {
            if (!this.geminiClient) throw new Error('Gemini API key not configured');
            return this.geminiClient.generateContent(prompt, model);
        } else {
            if (!this.openRouterClient) throw new Error('OpenRouter API key not configured');
            return this.openRouterClient.generateContent(prompt, model);
        }
    }
}

module.exports = { GeminiClient, OpenRouterClient, UnifiedLLMClient };
