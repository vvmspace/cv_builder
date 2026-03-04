<script setup>
import { computed, onMounted, ref } from 'vue';

const STORAGE_KEYS = {
  vacancyInput: 'cv_builder.vacancy_text',
  customCommentInput: 'cv_builder.custom_comment',
  templateSelect: 'cv_builder.template',
  modelSelect: 'cv_builder.model'
};

const vacancyText = ref('');
const customComment = ref('');
const template = ref('dark');
const model = ref('gemini-3.1-pro-preview');
const isGenerating = ref(false);
const statusHtml = ref('');

const modelOptions = computed(() => {
  if (typeof window === 'undefined') {
    return [{ value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' }];
  }

  const injectedModels = window.CV_BUILDER_MODELS;
  if (Array.isArray(injectedModels) && injectedModels.length > 0) {
    return injectedModels;
  }

  return [{ value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' }];
});

function loadField(key, set) {
  const value = localStorage.getItem(key);
  if (typeof value === 'string') {
    set(value);
  }
}

function persistField(key, value) {
  localStorage.setItem(key, value);
}

function restoreField(field) {
  if (field === 'vacancyInput') {
    loadField(STORAGE_KEYS.vacancyInput, (v) => {
      vacancyText.value = v;
    });
    return;
  }

  if (field === 'customCommentInput') {
    loadField(STORAGE_KEYS.customCommentInput, (v) => {
      customComment.value = v;
    });
    return;
  }

  if (field === 'templateSelect') {
    loadField(STORAGE_KEYS.templateSelect, (v) => {
      template.value = v;
    });
    return;
  }

  if (field === 'modelSelect') {
    loadField(STORAGE_KEYS.modelSelect, (v) => {
      model.value = v;
    });
  }
}

async function generateCV() {
  const currentVacancyText = vacancyText.value.trim();
  if (!currentVacancyText) {
    window.alert('Please enter a job description.');
    return;
  }

  isGenerating.value = true;
  statusHtml.value = '<span class="loader"></span>Adapting CV... This may take up to 30 seconds.';

  try {
    const response = await fetch('/api/v1/generate-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vacancy_text: currentVacancyText,
        custom_comment: customComment.value.trim(),
        model: model.value,
        template: template.value
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Unknown error occurred');
    }

    statusHtml.value = 'Success! Downloading...';

    const link = document.createElement('a');
    link.href = payload.pdf_url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    statusHtml.value = `Success! Downloading... <a href="${payload.html_url}" target="_blank" rel="noopener noreferrer"> [Open HTML]</a>`;
  } catch (error) {
    statusHtml.value = `<span style="color: #ff5555;">Error: ${error.message}</span>`;
  } finally {
    isGenerating.value = false;
  }
}

onMounted(() => {
  restoreField('vacancyInput');
  restoreField('customCommentInput');
  restoreField('templateSelect');
  restoreField('modelSelect');
});
</script>

<template>
  <div class="page-wrap">
    <h1>CV Adapt // VVM</h1>

    <div class="container">
      <div class="field-block">
        <div class="field-header">
          <button
            class="restore-btn"
            type="button"
            title="Restore from localStorage"
            @click="restoreField('vacancyInput')"
          >
            ↴
          </button>
        </div>
        <textarea
          id="vacancyInput"
          v-model="vacancyText"
          placeholder="// PASTE JOB DESCRIPTION HERE..."
          style="height: 200px;"
          @input="persistField(STORAGE_KEYS.vacancyInput, vacancyText)"
        />
      </div>

      <div class="field-block">
        <div class="field-header">
          <button
            class="restore-btn"
            type="button"
            title="Restore from localStorage"
            @click="restoreField('customCommentInput')"
          >
            ↴
          </button>
        </div>
        <textarea
          id="customCommentInput"
          v-model="customComment"
          placeholder="// ENTER CUSTOM INSTRUCTIONS HERE (OPTIONAL)..."
          style="height: 100px;"
          @input="persistField(STORAGE_KEYS.customCommentInput, customComment)"
        />
      </div>

      <div class="controls">
        <NuxtLink class="route-link" to="/pipeline">Pipeline</NuxtLink>

        <select
          id="templateSelect"
          v-model="template"
          @change="persistField(STORAGE_KEYS.templateSelect, template)"
        >
          <option value="dark">Dark Theme</option>
          <option value="light">Light Theme</option>
        </select>

        <select
          id="modelSelect"
          v-model="model"
          @change="persistField(STORAGE_KEYS.modelSelect, model)"
        >
          <option v-for="modelOption in modelOptions" :key="modelOption.value" :value="modelOption.value">
            {{ modelOption.label }}
          </option>
        </select>

        <button id="generateBtn" type="button" :disabled="isGenerating" @click="generateCV">
          Generate PDF
        </button>
      </div>

      <div id="status" v-html="statusHtml" />

      <div class="links-row">
        <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer" title="API Documentation">API Docs</a>
        <span>|</span>
        <a href="https://github.com/vvmspace/cv_builder" target="_blank" rel="noopener noreferrer">
          Welcome to contribute
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(html),
:global(body),
:global(#__nuxt) {
  margin: 0;
  min-height: 100%;
}

.page-wrap {
  --bg-color: #0d1117;
  --text-primary: #e6edf3;
  --accent-color: #00e5e5;
  --border-color: #30363d;
  --input-bg: #161b22;

  background-color: var(--bg-color);
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  margin: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

h1 {
  color: var(--accent-color);
  margin-bottom: 2rem;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.container {
  width: 90%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-header {
  display: flex;
  justify-content: flex-end;
}

.restore-btn {
  background: transparent;
  color: var(--accent-color);
  border: 1px solid var(--border-color);
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 6px;
  font-size: 0.95rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

textarea {
  width: 100%;
  height: 300px;
  background-color: var(--input-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 1rem;
  font-family: inherit;
  resize: vertical;
  font-size: 14px;
}

textarea:focus {
  outline: 1px solid var(--accent-color);
}

.controls {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

select {
  background-color: var(--input-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-family: inherit;
}

button {
  background-color: var(--accent-color);
  color: #000;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  transition: opacity 0.2s;
}

button:hover {
  opacity: 0.9;
}

button:disabled {
  background-color: #555;
  cursor: not-allowed;
}

.route-link {
  color: var(--accent-color);
  text-decoration: none;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
}

#status {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #8b949e;
  min-height: 1.5rem;
}

#status :deep(a) {
  color: var(--accent-color);
}

.loader {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--text-primary);
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

.links-row {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  gap: 1rem;
}

.links-row a {
  color: var(--accent-color);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.links-row a:hover {
  opacity: 1;
}

.links-row span {
  color: var(--border-color);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .controls {
    justify-content: stretch;
  }

  .controls > * {
    width: 100%;
  }

  button {
    width: 100%;
  }
}
</style>
