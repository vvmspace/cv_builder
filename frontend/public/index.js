(function setCvBuilderModels(globalScope) {
  globalScope.CV_BUILDER_MODELS = [
    { value: 'gemma', label: 'Gemma (Custom API)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
    { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT' },
    { value: 'gemma-3-27b-it', label: 'Gemma 3 27B IT' },
    { value: 'openrouter/free', label: 'OpenRouter Free Auto (OR)' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
