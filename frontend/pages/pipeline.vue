<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const vacancies = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const activeCopyUuid = ref('');

const statuses = [
  'generated',
  'connection_requested',
  'sent',
  'cancelled',
  'declined',
  'created'
];
const filterStatuses = ['all', 'generated', 'connection_requested', 'sent', 'declined', 'cancelled'];
const selectedFilterStatus = ref('all');
const quickSearch = ref('');
const refreshIntervalMs = ref(0);
let refreshTimer = null;
const refreshOptions = [
  { label: 'off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
  { label: '10m', value: 600000 },
  { label: '30m', value: 1800000 }
];
const tabCounts = ref({
  all: 0,
  generated: 0,
  connection_requested: 0,
  sent: 0,
  declined: 0,
  cancelled: 0
});

const statusLabels = {
  generated: 'Generated',
  connection_requested: 'Connection Requested',
  sent: 'Sent',
  cancelled: 'Cancelled',
  declined: 'Declined',
  created: 'Created',
  all: 'All'
};

const linkedinPath =
  'M13.5 13.5H11.2V9.85C11.2 8.98 11.18 7.86 9.98 7.86C8.77 7.86 8.58 8.8 8.58 9.79V13.5H6.28V6.1H8.48V7.11H8.51C8.81 6.53 9.55 5.92 10.66 5.92C12.99 5.92 13.5 7.45 13.5 9.44V13.5ZM3.68 5.09C2.94 5.09 2.34 4.49 2.34 3.75C2.34 3.01 2.94 2.41 3.68 2.41C4.42 2.41 5.02 3.01 5.02 3.75C5.02 4.49 4.42 5.09 3.68 5.09ZM4.84 13.5H2.52V6.1H4.84V13.5ZM14.66 0.25H1.34C0.73 0.25 0.25 0.73 0.25 1.34V14.66C0.25 15.27 0.73 15.75 1.34 15.75H14.66C15.27 15.75 15.75 15.27 15.75 14.66V1.34C15.75 0.73 15.27 0.25 14.66 0.25Z';
const pdfPath =
  'M3 1.75A1.75 1.75 0 0 1 4.75 0h4.04c.46 0 .9.18 1.23.51l2.47 2.47c.33.33.51.77.51 1.23v10.04A1.75 1.75 0 0 1 11.25 16h-6.5A1.75 1.75 0 0 1 3 14.25V1.75Zm5.5.5v2a1 1 0 0 0 1 1h2M5.4 10.9H4.7V6.8h1.4c.93 0 1.4.41 1.4 1.18c0 .78-.47 1.2-1.4 1.2H5.4v1.72Zm0-2.35h.52c.4 0 .61-.18.61-.57c0-.37-.21-.55-.61-.55H5.4v1.12Zm3.18 2.35H7.5V6.8h1.09c1.25 0 1.97.73 1.97 2.03c0 1.33-.72 2.07-1.98 2.07Zm-.22-3.42v2.74h.24c.67 0 1.06-.5 1.06-1.38c0-.85-.38-1.36-1.06-1.36h-.24Zm3.14 3.42h-.91V6.8h2.43v.72H11.5v1.05h1.36v.71H11.5v1.62Z';
const htmlPath =
  'M2 1.75A1.75 1.75 0 0 1 3.75 0h4.04c.46 0 .9.18 1.23.51l2.47 2.47c.33.33.51.77.51 1.23v10.04A1.75 1.75 0 0 1 10.25 16h-6.5A1.75 1.75 0 0 1 2 14.25V1.75Zm5.5.5v2a1 1 0 0 0 1 1h2M3.7 10.8V6.9h.88v1.58h1.5V6.9h.89v3.9h-.89V9.23h-1.5v1.57H3.7Zm4.33 0V6.9h2.76v.77H8.92v.8h1.63v.76H8.92v.8h1.93v.77H8.03Z';
const copyPath =
  'M3.75 2A1.75 1.75 0 0 0 2 3.75v7.5C2 12.22 2.78 13 3.75 13h5.5c.97 0 1.75-.78 1.75-1.75v-7.5A1.75 1.75 0 0 0 9.25 2h-5.5Zm7.5 2.5h.5c.97 0 1.75.78 1.75 1.75v6.5c0 .97-.78 1.75-1.75 1.75h-5.5A1.75 1.75 0 0 1 4.5 12.75v-.5h4.75c1.52 0 2.75-1.23 2.75-2.75V4.5Z';
const jsonPath =
  'M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5.362a1.5 1.5 0 0 0-.44-1.06L9.71 1.45A1.5 1.5 0 0 0 8.65 1.012l-4.65.488zm9.5 4.5h-3a1 1 0 0 1-1-1v-3l4 4zm-7.646 2.854a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L3.5 9.793l.646-.647a.5.5 0 0 1 .708 0zm4.792 0a.5.5 0 0 1 .708 0l1.5 1.5a.5.5 0 0 1-.708.708l-.646-.647v1.86a.5.5 0 0 1-.223.416l-1 1.5a.5.5 0 0 1-.832-.554l.805-1.208V11.5a.5.5 0 0 1 .5-.5h.646l-.647-.646a.5.5 0 0 1 0-.708z';

function setAllTabCounts(list) {
  const next = {
    all: list.length,
    generated: 0,
    connection_requested: 0,
    sent: 0,
    declined: 0,
    cancelled: 0
  };

  for (const item of list) {
    const status = item.status;
    if (Object.hasOwn(next, status)) {
      next[status] += 1;
    }
  }

  tabCounts.value = next;
}

function setSingleTabCount(status, count) {
  if (!Object.hasOwn(tabCounts.value, status)) {
    return;
  }

  tabCounts.value = {
    ...tabCounts.value,
    [status]: Math.max(0, count)
  };
}

function adjustTabCountsOnStatusChange(previousStatus, nextStatus) {
  const nextCounts = { ...tabCounts.value };

  if (Object.hasOwn(nextCounts, previousStatus)) {
    nextCounts[previousStatus] = Math.max(0, nextCounts[previousStatus] - 1);
  }
  if (Object.hasOwn(nextCounts, nextStatus)) {
    nextCounts[nextStatus] += 1;
  }

  tabCounts.value = nextCounts;
}

function tabCount(status) {
  return tabCounts.value[status] || 0;
}

const filteredVacancies = computed(() => {
  let list = vacancies.value;
  const query = quickSearch.value.trim().toLowerCase();
  
  if (query.length >= 3) {
    list = list.filter((item) => {
      const role = String(item.position_title || '').toLowerCase();
      const recruiter = String(item.recruiter_name || '').toLowerCase();
      return role.includes(query) || recruiter.includes(query);
    });
  }

  return [...list].sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
});

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function formatDate(input) {
  if (!input) return '-';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function postLink(vacancy) {
  return vacancy.post_link || vacancy.link || '';
}

function recruiterLink(vacancy) {
  return vacancy.recruiter_contact || '';
}

function recruiterName(vacancy) {
  return vacancy.recruiter_name || 'Unknown recruiter';
}

function cvPdfLink(vacancy) {
  if (!vacancy.file_name) return '';
  return `/cvs/${vacancy.file_name}`;
}

function cvHtmlLink(vacancy) {
  if (!vacancy.file_name) return '';
  return `/cvs/${vacancy.file_name.replace(/\.pdf$/i, '.html')}`;
}

function cvJsonLink(vacancy) {
  if (vacancy.json_url) return vacancy.json_url;
  if (!vacancy.file_name) return '';
  // Fallback if not saved in db but follows the pattern
  return `/cvs/${vacancy.file_name.replace(/_([a-zA-Z0-9_-]+)\.pdf$/i, '.json')}`;
}

function fileNameFromUrl(url, fallback) {
  if (!url) return fallback;
  const tail = url.split('/').pop();
  return tail || fallback;
}

function copyId(vacancy) {
  return vacancy.uuid || vacancy.post_link || vacancy.created_at || '';
}

async function fetchVacancies() {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const params = new URLSearchParams();
    if (selectedFilterStatus.value !== 'all') {
      params.set('status', selectedFilterStatus.value);
    }
    const query = params.toString();
    const response = await fetch(`/api/v1/vacancies${query ? `?${query}` : ''}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Failed to fetch vacancies');
    }

    const fetched = normalizeArray(payload.vacancies);
    vacancies.value = fetched;

    if (selectedFilterStatus.value === 'all') {
      setAllTabCounts(fetched);
    } else {
      setSingleTabCount(selectedFilterStatus.value, fetched.length);
    }
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    isLoading.value = false;
  }
}

async function updateStatus(vacancy, nextStatus) {
  const previousStatus = vacancy.status;
  vacancy.status = nextStatus;

  try {
    const response = await fetch(`/api/v1/vacancies/${vacancy.uuid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });

    const payload = await response.json();
    if (!response.ok || payload.success !== true) {
      throw new Error(payload.error || 'Failed to update status');
    }

    adjustTabCountsOnStatusChange(previousStatus, nextStatus);

    await fetchVacancies();
  } catch (error) {
    vacancy.status = previousStatus;
    errorMessage.value = error.message;
  }
}

async function copyGreeting(text) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    errorMessage.value = 'Failed to copy greeting message';
  }
}

function handleCopy(vacancy) {
  const id = copyId(vacancy);
  copyGreeting(vacancy.greeting_message || '');
  activeCopyUuid.value = id;
  setTimeout(() => {
    if (activeCopyUuid.value === id) {
      activeCopyUuid.value = '';
    }
  }, 1500);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (!refreshIntervalMs.value) {
    return;
  }

  refreshTimer = setInterval(() => {
    fetchVacancies();
  }, refreshIntervalMs.value);
}

watch(selectedFilterStatus, () => {
  fetchVacancies();
});

watch(refreshIntervalMs, () => {
  startAutoRefresh();
});

onMounted(() => {
  fetchVacancies();
  startAutoRefresh();
});

onBeforeUnmount(() => {
  stopAutoRefresh();
});
</script>

<template>
  <main class="page">
    <header class="header">
      <h1 class="title">CV Pipeline</h1>
      <nav class="nav">
        <NuxtLink class="nav-link" to="/">Generator</NuxtLink>
        <NuxtLink class="nav-link" to="/pipeline">Pipeline</NuxtLink>
      </nav>
    </header>

    <section class="card">
      <div class="toolbar">
        <div class="toolbar-row">
          <button type="button" @click="fetchVacancies" :disabled="isLoading">
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>

          <div class="interval-wrap">
            <label for="refreshInterval" class="toolbar-label">Auto-refresh</label>
            <select id="refreshInterval" class="interval-select" v-model.number="refreshIntervalMs">
              <option v-for="option in refreshOptions" :key="option.label" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="status-filters">
          <button
            v-for="status in filterStatuses"
            :key="status"
            type="button"
            class="filter-chip"
            :class="{ active: selectedFilterStatus === status }"
            @click="selectedFilterStatus = status"
          >
            {{ statusLabels[status] || status }} ({{ tabCount(status) }})
          </button>
        </div>

        <div class="search-wrap">
          <label for="quickSearch" class="toolbar-label">Search (role or recruiter)</label>
          <input
            id="quickSearch"
            v-model="quickSearch"
            class="search-input"
            type="text"
            placeholder="Type at least 3 letters..."
          >
        </div>
      </div>

      <p class="status-error" v-if="errorMessage">{{ errorMessage }}</p>

      <div class="pipeline-table" v-if="filteredVacancies.length">
        <div class="row head">
          <div class="col position">Position</div>
          <div class="col post">Post</div>
          <div class="col recruiter">Recruiter</div>
          <div class="col status">Status</div>
          <div class="col model">Model</div>
          <div class="col greeting">Greeting Message</div>
          <div class="col files">CV</div>
          <div class="col updated">Updated</div>
        </div>

        <div class="row body" v-for="vacancy in filteredVacancies" :key="vacancy.uuid || vacancy.post_link || vacancy.created_at">
          <div class="col position" data-label="Position">
            {{ vacancy.position_title || '-' }}
          </div>

          <div class="col post" data-label="Post">
            <a v-if="postLink(vacancy)" class="icon-link" :href="postLink(vacancy)" target="_blank" rel="noopener noreferrer" title="Open LinkedIn Post">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path :d="linkedinPath" /></svg>
            </a>
            <span v-else>-</span>
          </div>

          <div class="col recruiter" data-label="Recruiter">
            <a
              v-if="recruiterLink(vacancy)"
              class="name-link"
              :href="recruiterLink(vacancy)"
              target="_blank"
              rel="noopener noreferrer"
              :title="recruiterName(vacancy)"
            >
              <span>{{ recruiterName(vacancy) }}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path :d="linkedinPath" /></svg>
            </a>
            <span v-else>{{ recruiterName(vacancy) }}</span>
          </div>

          <div class="col status" data-label="Status">
            <select
              class="status-select"
              :value="vacancy.status || 'created'"
              @change="updateStatus(vacancy, $event.target.value)"
            >
              <option v-for="status in statuses" :key="status" :value="status">{{ statusLabels[status] || status }}</option>
            </select>
          </div>

          <div class="col model" data-label="Model">
            <span class="model-chip">{{ vacancy.model || '-' }}</span>
          </div>

          <div class="col greeting" data-label="Greeting Message">
            <div class="greeting-wrap" v-if="vacancy.greeting_message">
              <p class="greeting-text">{{ vacancy.greeting_message }}</p>
              <button
                type="button"
                class="copy-icon"
                :title="activeCopyUuid === copyId(vacancy) ? 'Copied' : 'Copy greeting'"
                @click="handleCopy(vacancy)"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path :d="copyPath" /></svg>
              </button>
            </div>
            <span v-else>-</span>
          </div>

          <div class="col files" data-label="CV">
            <div class="file-links" v-if="cvPdfLink(vacancy) || cvHtmlLink(vacancy)">
              <a
                v-if="cvPdfLink(vacancy)"
                class="icon-link"
                :href="cvPdfLink(vacancy)"
                :download="fileNameFromUrl(cvPdfLink(vacancy), 'cv.pdf')"
                title="Download PDF"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path :d="pdfPath" /></svg>
              </a>
              <a
                v-if="cvHtmlLink(vacancy)"
                class="icon-link"
                :href="cvHtmlLink(vacancy)"
                :download="fileNameFromUrl(cvHtmlLink(vacancy), 'cv.html')"
                title="Download HTML"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path :d="htmlPath" /></svg>
              </a>
              <a
                v-if="cvJsonLink(vacancy)"
                class="icon-link"
                :href="cvJsonLink(vacancy)"
                :download="fileNameFromUrl(cvJsonLink(vacancy), 'cv.json')"
                title="Download JSON"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path :d="jsonPath" /></svg>
              </a>
            </div>
            <span v-else>-</span>
          </div>

          <div class="col updated" data-label="Updated">
            {{ formatDate(vacancy.updated_at || vacancy.created_at) }}
          </div>
        </div>
      </div>

      <div v-else class="empty muted">
        {{ quickSearch.trim().length >= 3 ? 'No matches for this query.' : 'No vacancies yet.' }}
      </div>
    </section>
  </main>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.interval-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-label {
  font-size: 0.82rem;
  color: var(--muted);
}

.interval-select {
  min-width: 88px;
  font-size: 0.85rem;
  padding: 6px 8px;
}

.status-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.search-wrap {
  width: 100%;
  max-width: 420px;
}

.search-input {
  width: 100%;
}

.filter-chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(19, 29, 42, 0.9);
  color: var(--muted);
  font-weight: 600;
  text-transform: none;
  padding: 6px 11px;
  font-size: 0.8rem;
}

.filter-chip.active {
  color: #06221e;
  border-color: transparent;
  background: linear-gradient(130deg, #53e3c2, #3fd4f0);
}

.pipeline-table {
  border: 1px solid rgba(83, 227, 194, 0.15);
  border-radius: 12px;
  overflow: hidden;
}

.row {
  display: grid;
  grid-template-columns: 2.2fr 0.7fr 1.4fr 1.2fr 1.4fr 2.5fr 1fr 1.1fr;
  gap: 10px;
  padding: 10px 12px;
  align-items: start;
}

.row.head {
  position: sticky;
  top: 0;
  background: rgba(16, 22, 33, 0.96);
  z-index: 1;
  border-bottom: 1px solid var(--line);
}

.row.head .col {
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 600;
}

.row.body {
  border-bottom: 1px solid var(--line);
}

.row.body:last-child {
  border-bottom: none;
}

.row.body:hover {
  background: rgba(83, 227, 194, 0.06);
}

.col {
  font-size: 0.9rem;
  line-height: 1.3;
}

.col.position {
  font-weight: 600;
}

.name-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px dashed rgba(83, 227, 194, 0.4);
  padding-bottom: 1px;
}

.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(83, 227, 194, 0.2);
  border-radius: 10px;
  color: var(--text);
  text-decoration: none;
  background: rgba(18, 28, 42, 0.7);
}

.icon-link:hover,
.name-link:hover {
  color: var(--accent);
  border-color: rgba(83, 227, 194, 0.5);
}

svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.status-select {
  width: 100%;
  min-width: 190px;
  font-size: 0.9rem;
}

.model-chip {
  display: inline-block;
  border: 1px solid rgba(83, 227, 194, 0.2);
  border-radius: 10px;
  padding: 5px 8px;
  font-size: 0.8rem;
  color: var(--muted);
  word-break: break-word;
}

.greeting-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.greeting-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.copy-icon {
  padding: 7px;
  min-width: 34px;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.file-links {
  display: flex;
  gap: 8px;
}

.empty {
  border: 1px dashed var(--line);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}

@media (max-width: 1000px) {
  .toolbar-row {
    width: 100%;
    justify-content: space-between;
  }

  .interval-wrap {
    width: 100%;
    justify-content: space-between;
  }

  .interval-select {
    min-width: 110px;
  }

  .status-filters {
    width: 100%;
  }

  .search-wrap {
    max-width: none;
  }

  .pipeline-table {
    border: none;
    overflow: visible;
  }

  .row.head {
    display: none;
  }

  .row.body {
    display: block;
    background: rgba(19, 29, 42, 0.92);
    border: 1px solid var(--line);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px;
  }

  .col {
    display: block;
    margin-bottom: 10px;
  }

  .col:last-child {
    margin-bottom: 0;
  }

  .col::before {
    content: attr(data-label);
    display: block;
    color: var(--muted);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 3px;
  }

  .status-select {
    min-width: 0;
  }

  .greeting-wrap {
    flex-direction: row;
  }
}
</style>
