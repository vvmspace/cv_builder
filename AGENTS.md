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

### Outgoing message:

Outgoing message should contain:
- attachment with CVs in dark and light templates
- recruiter_contact (linkedin profile link) and recruiter_name
- post text: comment_for_user from cv_data_object

### Environment variables:
- TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN

## Frontend

- The most simple frontend is in public/index.html