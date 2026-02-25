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
    }

    /**
     * Generates content using the Gemini API.
     * @param {string} prompt - The prompt to send.
     * @param {string} model - The model identifier (e.g., 'gemini-2.5-flash').
     * @param {object} schema - Optional JSON schema for structured output.
     * @returns {Promise<object>} - The parsed JSON response.
     */
    async generateContent(prompt, model = 'gemini-2.5-flash') {
        const url = new URL(`${this.baseUrl}/${model}:generateContent`);
        url.searchParams.append('key', this.apiKey);

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                response_mime_type: "application/json"
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
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(`Gemini API API Error: ${response.error.message}`));
                            return;
                        }
                        // Extract the text content from the candidate
                        if (response.candidates && response.candidates[0] && response.candidates[0].content) {
                            const text = response.candidates[0].content.parts[0].text;
                            try {
                                // Try to parse the text as JSON since we requested JSON mime type
                                resolve(JSON.parse(text));
                            } catch (e) {
                                // Fallback if the model returns text that isn't perfect JSON (unlikely with response_mime_type)
                                // or if we decide to remove response_mime_type later
                                resolve({ raw_text: text });
                            }
                        } else {
                            reject(new Error("Unexpected response structure from Gemini API"));
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
}

module.exports = { GeminiClient };
