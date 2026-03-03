<outdated>

Этот репозиторий существует для генерации и хранения CV адаптированных под вакансию через ИИ инструменты.
На вход тебе будет подаваться вакансия, а на выходе должны получаться красивые HTML и PDF версии: вначале ты генерируешь HTML пиздатым минималистичным дизайном, а потом из него собираешь PDF.
Резюме составляются только на английском.

Как это должно читаться CV:
- ошарашить (привлечь внимание)
- озадачить (ректутер/читающий специалист должен читать и видеть полный метч+)
- укрепить хорошее впечатление и создать (даже подсознательно, можно психотехниками без палева) (навязчивое) желание оффера


## При написании конвертера:
При генерации PDF из HTML проверяй отсутствия колонтитулов от конвертации, что нет разрыва логических блоков.
В общем смотри PDF перед сдачей.

Если на последней странице PDF контента меньше чем 15% и можно как-то перегруппировать блоки, чтобы этого избежать - сделай это.


## При написании HTML:
После генерации HTML смотри верстку.

При генерации HTML и PDF используй только данные из full_cv.md (fallback: full_cv.example.md), не добавляй абсурдные вещи, главное сохраняй логику позиций, чтобы мои показания не расходились на будущих интервью/скринингах.

По возможности прогугливай информацию о том, о чём пишешь, если недостаточно уверен.

Если упоминаешь версии, то ставь последние на последних проектах.

Структура:
- full_cv.md (fallback: full_cv.example.md) - это полное CV, бери данные отсюда
- tools - папка, где будет лежать какой-то нужный код для разработки (чтобы не пачкать корень). Генерацию HTML бери не себя, без создания тулзов.
- cvs
-- cv_name.html
-- cv_name.pdf
-- cv_name.comment.md - комментарий что добавлено в этом CV, советы как общаться по этой позиции

## Antigoals

- Manual editing: ПРОВЕРЯЙ СЕБЯ ПОСЛЕ СБОРКИ, УЧИТЫВАЙ РАЗБИЕНИЕ НА СТРАНИЦЫ ЕЩЁ НА ЭТАПЕ ПРОДУМЫВАНИЯ ДИЗАЙНА И СОЗДАНИЯ HTML.

</outdated>

# Project: CV AI Adapter

## Hosting & Running

- Possibility to run locally / on any server
- Possibility to run on Netlify
- Every method/function is a function that must be wrapped in a lambda (Netlify function) and in express

## API

API should has swagger with interface to be able to click endpoints from there.

### /api/v1/generate_cv

POST

Generate CV from vacancy text and full CV:
- prompt.md (fallback: prompt.example.md) - template for LLM
- full_cv.md (fallback: full_cv.example.md) - full CV. Can be sent as full_cv_text in body.
- cv.json (fallback: cv.example.json) - example of CV JSON

Body:
- vacancy_text: string
- custom_comment?: string
- template?: string = 'dark'
- model?: string = 'gemini-3.1-pro-preview'
- full_cv_text?: string // don't use it on frontend


Response:
- html_url: string // relative path to cv
- pdf_url: string // relative path to cv
- pdf_absolute_path: string // absolute path to cv

### /api/v1/telegram/webhook

POST

Receives Telegram Update payloads. Register this URL with Telegram once via `setWebhook` (e.g. `POST https://api.telegram.org/bot<token>/setWebhook` with `url=<base>/api/v1/telegram/webhook`).

Body reference: https://core.telegram.org/bots/api

### GET /api/v1/vacancies

Get vacancies list

Response:
- vacancies: array of vacancies

Order by updated_at asc and status: 'generated' should be first.

### PATCH /api/v1/vacancies/:uuid

If AUTH_TOKEN environment variable is set, check it in header Authorization: Bearer <token>, if it doesn't match, return 401.
If AUTH_TOKEN is not set, update without checking.

Update vacancy by uuid with partial update and set updated_at to current time

Body:
- status?: string
- comment?: string

If there are no status and no comment, just update updated_at to current time.

## Telegram bot

### Incoming message:

Incoming message can contain:
- link to vacancy
- custom comment

Supported links:
- link to post on LinkedIn: (https://www.linkedin.com/posts/username_some-text-activity-432142314-ObeP?utm...) - extract vacancy text like from linkedin.post.example.html

Action:
- remove all get parameters from linkedin post link
- parse vacancy text from linkedin post and use it as vacancy_text
- parse recruiter contact (linkedin profile link) and name from linkedin post and use it as recruiter_contact and recruiter_name in outgoing message
- use incoming text as custom_comment
- send to LLM and recieve cv_data_object
- build from cv_data_object CV in dark and light templates
- send CVs to telegram

### Outgoing messages:

Outgoing messages should be a reply to incoming message.
- attachment with CVs in dark and light templates
- recruiter_contact (linkedin profile link) and recruiter_name
- greeting_message: greeting_message from cv_data_object
- post text: comment_for_user from cv_data_object

### After parsing and before generation:

After parsing call createVacancy() method with:
- uuid: uuid auto generated
- vacancy_text
- post_link
- recruiter_name
- recruiter_contact
- status: 'created'
- created_at: Date.now()
- updated_at: Date.now()

### After generation:

After generation call updateVacancy(post_link, ...) method with:
- file_name = generated pdf file name
- position_title = role_original
- recruiter_telegram - if provided in generated json
- post_link
- comment_text
- greeting_message
- status: 'generated'
- updated_at: Date.now()

Statuses:
- 'created' - vacancy created
- 'generated' CV generated - by default
- For future: 'sent' - sent to recruiter, 'declined' - recruiter declined CV, 'cancelled' - decided not to send to recruiter, - will be used later 

If MONGODB_CONNECTION_STRING is set, save vacancy to mongodb `vacancies` collection.

### Environment variables:
- TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN
- MONGODB_CONNECTION_STRING

## Frontend

- The most simple frontend is in public/index.html
- Everytime when you update models, update list on frontend