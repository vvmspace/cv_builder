# abstractai

OpenAI-compatible client with routing to `Gemini`, `OpenRouter`, and OpenAI-compatible `Gemma` backends.

## Install

```bash
npm i abstractai
```

## OpenAI-Compatible Usage

`abstractai` extends official `openai` client semantics.

```js
require('dotenv').config();
const OpenAI = require('abstractai');

// Keys are read from process.env by default.
const client = new OpenAI();

const completion = await client.chat.completions.create({
  model: 'gemini-2.5-flash', // or 'gemma-4-27b-it' via Google API
  messages: [{ role: 'user', content: 'Generate JSON for this template...' }]
});

console.log(completion.choices[0].message.content);
```

Expected `.env` keys (any available route will be used):

```env
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
GEMMA_API_URL=...
GEMMA_API_KEY=...
OPENAI_API_KEY=optional-fallback-for-base-openai-client
```

## Responses API

```js
const OpenAI = require('abstractai');
const client = new OpenAI();

const result = await client.responses.create({
  model: 'gemma',
  input: 'Generate JSON for this template:...'
});

console.log(result.output_text);
```

## Legacy Low-Level API

```js
const { UnifiedLLMClient } = require('abstractai');

const llm = new UnifiedLLMClient(
  process.env.GEMINI_API_KEY,
  process.env.OPENROUTER_API_KEY,
  process.env.GEMMA_API_URL,
  process.env.GEMMA_API_KEY
);

const data = await llm.generateContent('prompt text', 'gemini-2.5-flash');
console.log(data);
```

## Custom Methods On Same Client

You can use OpenAI-compatible methods and custom helpers on one instance:

```js
require('dotenv').config();
const OpenAI = require('abstractai');
const client = new OpenAI();

const custom = await client.generateContent('prompt text', 'gemini-2.5-flash');
const fromMessages = await client.generateFromMessages(
  [{ role: 'user', content: 'Hello' }],
  'gemini-2.0-flash'
);
const fromInput = await client.generateFromInput('Input text', 'gemma');

const unified = client.getUnifiedClient(); // UnifiedLLMClient instance
```
