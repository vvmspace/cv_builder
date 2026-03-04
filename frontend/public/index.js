(function setCvBuilderModels(globalScope) {
  globalScope.CV_BUILDER_MODELS = [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'arcee-ai/trinity-large-preview:free', label: 'Arcee Trinity Large (OR)' },
    { value: 'arcee-ai/trinity-mini:free', label: 'Arcee Trinity Mini (OR)' },
    { value: 'nvidia/llama-nemotron-embed-vl-1b-v2:free', label: 'Nvidia Llama Nemotron Embed VL 1B (OR)' },
    { value: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', label: 'Dolphin Mistral 24B Venice (OR)' },
    { value: 'openrouter/free', label: 'OpenRouter Free Auto (OR)' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
