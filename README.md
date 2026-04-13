# CV Builder

Service for generating tailored CVs (`HTML` + `PDF`) from vacancy text, with Telegram integration, MongoDB pipeline tracking, and a Nuxt-based frontend.

## Stack

- Backend: `Express`
- Frontend: `Nuxt 3` (static build served by Express from `public/`)
- PDF rendering: `Puppeteer`
- DB: `MongoDB` (optional)
- Bot: `Telegram` (`telegraf` API client)

## Main Features

- Generate CV via API (`/api/v1/generate_cv` or `/api/v1/generate-cv`).
- Telegram webhook flow for LinkedIn vacancies.
- Pipeline page (`/pipeline`) with:
  - adaptive layout (div-table on wide screens, cards on mobile),
  - status update,
  - status tabs with counters,
  - auto-refresh interval,
  - model column,
  - recruiter/post links and CV downloads.
- Background worker (optional) that processes `created` vacancies from MongoDB.
- LLM fallback chain for bot/worker with temporary model blocking based on recent errors.

## Project Layout

- `app.js`: Express app, API, Telegram flow, worker logic.
- `server.js`: app entrypoint and worker start.
- `frontend/`: Nuxt source.
- `public/`: generated frontend static output (served by Express).
- `templates/`: CV templates (`dark.html`, `light.html`, `dark_calendly.html`).
- `cvs/`: generated artifacts (`.html`, `.pdf`, optional `.comment.md`).
- `tools/`: helpers and scripts.

## Scripts

- `npm run start`: start backend server.
- `npm run start:mock`: start with mock LLM and mock Telegram.
- `npm run dev`: backend watch mode.
- `npm run dev:frontend`: run Nuxt frontend in dev mode.
- `npm run build:frontend`: generate Nuxt static build into `public/`.
- `npm run build`: alias for `build:frontend`.
- `npm run json`: render CV from ready JSON via `tools/build_pdf_from_json.js`.
- `npm run test:e2e`: Playwright tests.

## Environment Variables

Required for real generation:

- `GEMMA_API_URL` + `GEMMA_API_KEY`, or `GEMINI_API_KEY`, or `OPENROUTER_API_KEY`

Optional for Gemma:

- `GEMMA_MODEL` (default: `gemma`)

Telegram:

- `TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN`

MongoDB / pipeline:

- `MONGODB_CONNECTION_STRING`

Worker:

- `WORKER_ON=true` to enable worker (otherwise disabled)
- `CHAT_ID` (optional, default: `280615376`) — destination for worker outgoing messages

Optional:

- `AUTH_TOKEN` for `PATCH /api/v1/vacancies/:uuid`
- `PORT` (default: `3000`)

## API

Swagger UI:

- `GET /api/v1/docs`
- `GET /api/v1/docs.json`

### `POST /api/v1/generate_cv` (alias: `/api/v1/generate-cv`)

Body:

- `vacancy_text` (required)
- `custom_comment` (optional)
- `template`: `dark|light|dark_calendly` (default `dark_calendly`)
- `model` (optional)
- `full_cv_text` (optional)

Response:

- `success`
- `html_url`
- `pdf_url`
- `pdf_absolute_path`

### `POST /api/v1/telegram/webhook`

Receives Telegram Update payload.

### `GET /api/v1/vacancies`

Returns vacancies sorted by status priority and `updated_at` ascending.

Optional query:

- `status`: one status or comma-separated list, e.g.
  - `?status=generated`
  - `?status=generated,sent`

### `PATCH /api/v1/vacancies/:uuid`

Partial update (`status`, `comment`) and always updates `updated_at`.

If `AUTH_TOKEN` is set, requires `Authorization: Bearer <token>`.

## Telegram Bot Behavior

Incoming message may include:

- LinkedIn post URL
- custom text/comment

Flow:

1. Parse LinkedIn post (vacancy text, recruiter name/contact).
2. Generate CVs (`dark` + `light`).
3. Send outgoing message:
   - greeting message,
   - attachments (CV PDFs),
   - summary text with recruiter info, post link, comment and **used model**.

MongoDB persistence rule:

- vacancy is saved/updated in DB only if LinkedIn link is present.

## Worker

Worker runs in background only when:

- `WORKER_ON=true`
- `MONGODB_CONNECTION_STRING` is set

Polling interval:

- every 1 minute

Per tick:

1. Take one vacancy with `status='created'`.
2. Lock as `processing`.
3. Generate CVs.
4. Update vacancy to `generated` with:
   - `file_name`
   - `position_title`
   - `recruiter_telegram`
   - `post_link`
   - `comment_text`
   - `greeting_message`
   - `model` (used model)
5. Send Telegram message to `CHAT_ID` using same outgoing rules as manual Telegram flow.

On failure:

- return vacancy to `created`
- save `worker_error`

## Model Fallback Chain (Bot + Worker)

Priority order:

1. `gemma` (or `GEMMA_MODEL`) when `GEMMA_API_URL` + `GEMMA_API_KEY` are set
2. `gemini-3.1-pro-preview`
3. `gemini-2.5-flash`
4. `openrouter/free`
5. `gemini-2.0-flash`
6. `nvidia/llama-nemotron-embed-vl-1b-v2:free`
7. `cognitivecomputations/dolphin-mistral-24b-venice-edition:free`

If `MONGODB_CONNECTION_STRING` is set:

- failed model calls are saved in `models_errors` collection:
  - `model`
  - `last_error_at`
- models with errors in the last 5 minutes are skipped before selection.

## Frontend Routes

- `/`: manual CV generation UI.
- `/pipeline`: vacancies pipeline UI with status filtering and auto-refresh.

## Local Run

1. `npm install`
2. configure `.env`
3. `npm run build:frontend`
4. `npm run start`

Open:

- `http://localhost:3000`
- `http://localhost:3000/pipeline`
- `http://localhost:3000/api/v1/docs`
