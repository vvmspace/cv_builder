const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const swaggerUi = require('swagger-ui-express');
const { Telegram } = require('telegraf');
const { UnifiedLLMClient } = require('abstractai');
const { render } = require('./tools/template_renderer');
const { launchBrowser, isNetlifyRuntime } = require('./runtime');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();

app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static('public'));

const CV_DIR = isNetlifyRuntime()
    ? path.join('/tmp', 'cvs')
    : path.join(__dirname, 'cvs');
const LAST_JSON_PATH = isNetlifyRuntime()
    ? path.join('/tmp', 'last.json')
    : path.join(__dirname, 'last.json');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const HAS_GEMMA = Boolean(process.env.GEMMA_API_URL && process.env.GEMMA_API_KEY);
const GEMMA_PRIMARY_MODEL = process.env.GEMMA_MODEL || 'gemma';
const DEFAULT_MODEL = HAS_GEMMA ? GEMMA_PRIMARY_MODEL : 'gemini-3.1-pro-preview';

fs.mkdirSync(CV_DIR, { recursive: true });

let mongoClientPromise = null;
const BASE_BOT_WORKER_MODEL_CHAIN = [
    'gemini-3.1-pro-preview',
    'gemma-4-31b-it',
    'gemma-4-26b-a4b-it',
    'gemini-2.5-flash',
    'openrouter/free',
    'gemini-2.0-flash',
    'nvidia/llama-nemotron-embed-vl-1b-v2:free',
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free'
];

function getBotWorkerModelChain() {
    return HAS_GEMMA
        ? [GEMMA_PRIMARY_MODEL, ...BASE_BOT_WORKER_MODEL_CHAIN]
        : [...BASE_BOT_WORKER_MODEL_CHAIN];
}

async function getVacanciesCollection() {
    const connectionString = process.env.MONGODB_CONNECTION_STRING;
    if (!connectionString) {
        return null;
    }

    if (!mongoClientPromise) {
        mongoClientPromise = MongoClient.connect(connectionString).catch((error) => {
            mongoClientPromise = null;
            throw error;
        });
    }

    const client = await mongoClientPromise;
    return client.db('vacancies').collection('vacancies');
}

async function getModelErrorsCollection() {
    const connectionString = process.env.MONGODB_CONNECTION_STRING;
    if (!connectionString) {
        return null;
    }

    if (!mongoClientPromise) {
        mongoClientPromise = MongoClient.connect(connectionString).catch((error) => {
            mongoClientPromise = null;
            throw error;
        });
    }

    const client = await mongoClientPromise;
    return client.db('vacancies').collection('models_errors');
}

async function saveModelLastError(model) {
    const collection = await getModelErrorsCollection();
    if (!collection || !model) {
        return;
    }

    await collection.updateOne(
        { model },
        {
            $set: {
                model,
                last_error_at: new Date()
            }
        },
        { upsert: true }
    );
}

async function getModelsWithoutRecentErrors(models, windowMs = 5 * 60 * 1000) {
    if (!process.env.MONGODB_CONNECTION_STRING) {
        return models;
    }

    const collection = await getModelErrorsCollection();
    if (!collection) {
        return models;
    }

    const threshold = new Date(Date.now() - windowMs);
    const recentErrors = await collection
        .find({ last_error_at: { $gte: threshold } }, { projection: { model: 1 } })
        .toArray();
    const blocked = new Set(recentErrors.map((row) => row.model).filter(Boolean));

    return models.filter((model) => !blocked.has(model));
}

async function createVacancy({
    vacancy_text,
    post_link,
    recruiter_name,
    recruiter_contact,
    comment_text = null,
    status = 'created'
}) {
    const collection = await getVacanciesCollection();
    if (!collection) {
        return null;
    }

    const now = new Date();
    const uuid = crypto.randomUUID();

    const doc = {
        uuid,
        vacancy_text: vacancy_text || null,
        post_link: post_link || null,
        recruiter_name: recruiter_name || null,
        recruiter_contact: recruiter_contact || null,
        file_name: null,
        position_title: null,
        recruiter_telegram: null,
        comment_text: comment_text || null,
        greeting_message: null,
        model: null,
        status: status || 'created',
        created_at: now,
        updated_at: now
    };

    await collection.insertOne(doc);
    return doc;
}

const TERMINAL_REGEN_BLOCK_STATUSES = new Set(['sent', 'send', 'cancelled', 'canceled', 'declined']);

async function createOrRefreshVacancyByPostLink({
    vacancy_text,
    post_link,
    recruiter_name,
    recruiter_contact,
    comment_text = null
}) {
    const collection = await getVacanciesCollection();
    if (!collection) {
        return null;
    }

    const normalizedPostLink = post_link || null;
    if (!normalizedPostLink) {
        return createVacancy({
            vacancy_text,
            post_link,
            recruiter_name,
            recruiter_contact,
            comment_text,
            status: 'created'
        });
    }

    const existing = await collection.findOne(
        { post_link: normalizedPostLink },
        { sort: { updated_at: -1, created_at: -1 } }
    );

    if (!existing) {
        return createVacancy({
            vacancy_text,
            post_link: normalizedPostLink,
            recruiter_name,
            recruiter_contact,
            comment_text,
            status: 'created'
        });
    }

    const existingStatus = String(existing.status || '').toLowerCase();
    if (TERMINAL_REGEN_BLOCK_STATUSES.has(existingStatus)) {
        return createVacancy({
            vacancy_text,
            post_link: normalizedPostLink,
            recruiter_name,
            recruiter_contact,
            comment_text,
            status: 'created'
        });
    }

    const now = new Date();
    await collection.updateOne(
        { _id: existing._id },
        {
            $set: {
                vacancy_text: vacancy_text || existing.vacancy_text || null,
                recruiter_name: recruiter_name || existing.recruiter_name || null,
                recruiter_contact: recruiter_contact || existing.recruiter_contact || null,
                comment_text: comment_text || null,
                status: 'created',
                updated_at: now,
                worker_error: null
            }
        }
    );

    return {
        ...existing,
        vacancy_text: vacancy_text || existing.vacancy_text || null,
        recruiter_name: recruiter_name || existing.recruiter_name || null,
        recruiter_contact: recruiter_contact || existing.recruiter_contact || null,
        comment_text: comment_text || null,
        status: 'created',
        updated_at: now,
        worker_error: null
    };
}

async function updateVacancy(post_link, {
    file_name,
    position_title,
    recruiter_telegram,
    comment_text,
    greeting_message,
    model,
    status = 'generated'
}) {
    const collection = await getVacanciesCollection();
    if (!collection) {
        return;
    }

    const now = new Date();

    await collection.findOneAndUpdate(
        { post_link: post_link || null },
        {
            $set: {
                file_name: file_name || null,
                position_title: position_title || null,
                recruiter_telegram: recruiter_telegram || null,
                comment_text: comment_text || null,
                greeting_message: greeting_message || null,
                model: model || null,
                status: status || 'generated',
                updated_at: now
            }
        },
        {
            sort: { created_at: -1 }
        }
    );
}

async function saveVacancy(args) {
    return updateVacancy(args?.post_link || null, args || {});
}

function getFallbackPath(preferredName, fallbackName) {
    const preferredPath = path.join(__dirname, preferredName);
    if (fs.existsSync(preferredPath)) {
        return preferredPath;
    }
    return path.join(__dirname, fallbackName);
}

function getGenerationAssets(fullCvOverride) {
    const FULL_CV_PATH = getFallbackPath('full_cv.md', 'full_cv.example.md');
    const JSON_PATH = getFallbackPath('cv.json', 'cv.example.json');
    const PROMPT_PATH = getFallbackPath('prompt.md', 'prompt.example.md');

    return {
        fullCv: fullCvOverride || fs.readFileSync(FULL_CV_PATH, 'utf8'),
        exampleJson: fs.readFileSync(JSON_PATH, 'utf8'),
        promptTemplate: fs.readFileSync(PROMPT_PATH, 'utf8')
    };
}

function buildCvPrompt({ vacancyText, customComment, fullCv, exampleJson, promptTemplate }) {
    let customCommentBlock = '';
    if (customComment && customComment.trim() !== '') {
        customCommentBlock = `\nHere are some specific instructions from the user:\n<user instructions>\n${customComment}\n</user instructions>\n`;
    }

    return promptTemplate
        .replace('${vacancy_text}', vacancyText)
        .replace('${custom_comment_block}', customCommentBlock)
        .replace('${fullCv}', fullCv)
        .replace('${exampleJson}', exampleJson);
}

function normalizeGeneratedCvJson(generated) {
    if (!generated) {
        throw new Error('LLM returned empty response');
    }

    if (generated.raw_text) {
        const snippet = String(generated.raw_text).substring(0, 500);
        throw new Error(`LLM returned non-JSON output; expected CV JSON. Raw output begins with: "${snippet}..."`);
    }

    if (typeof generated !== 'object' || Array.isArray(generated)) {
        throw new Error('LLM returned invalid CV JSON structure');
    }

    return generated;
}

async function generateContentWithFallbackChain({
    prompt,
    model,
    useFallbackChain = false
}) {
    if (!useFallbackChain) {
        return {
            result: await llmClient.generateContent(prompt, model),
            usedModel: model || null
        };
    }

    let modelsToTry = getBotWorkerModelChain();

    if (model && modelsToTry.includes(model)) {
        modelsToTry = [model, ...modelsToTry.filter((m) => m !== model)];
    } else if (model) {
        modelsToTry = [model, ...modelsToTry];
    }

    modelsToTry = await getModelsWithoutRecentErrors(modelsToTry);
    if (modelsToTry.length === 0) {
        throw new Error('No models available: all models have errors in the last 5 minutes');
    }

    let lastError = null;
    for (const currentModel of modelsToTry) {
        try {
            // eslint-disable-next-line no-await-in-loop
            return {
                // eslint-disable-next-line no-await-in-loop
                result: await llmClient.generateContent(prompt, currentModel),
                usedModel: currentModel
            };
        } catch (error) {
            lastError = error;
            console.error(`[ModelFallback] ${currentModel} failed: ${error.message}`);
            try {
                // eslint-disable-next-line no-await-in-loop
                await saveModelLastError(currentModel);
            } catch (saveError) {
                console.error(`[ModelFallback] Failed to save model error for ${currentModel}:`, saveError);
            }
        }
    }

    throw lastError || new Error('Failed to generate content with fallback chain');
}

const DEFAULT_TEMPLATE = process.env.DEFAULT_TEMPLATE || 'dark_matrix';

function getTemplatePath(template) {
    const filePath = path.join(TEMPLATES_DIR, `${template}.html`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Unsupported template: ${template}`);
    }
    return filePath;
}

function templateExists(template) {
    return fs.existsSync(path.join(TEMPLATES_DIR, `${template}.html`));
}

function resolveTemplate(requestedTemplate, generatedJson) {
    // 1. Requested template is valid and exists
    if (requestedTemplate && templateExists(requestedTemplate)) {
        return requestedTemplate;
    }
    // 2. LLM suggested a template
    const llmTemplate = generatedJson && generatedJson.template;
    if (llmTemplate && templateExists(llmTemplate)) {
        return llmTemplate;
    }
    // 3. DEFAULT_TEMPLATE env/constant
    if (templateExists(DEFAULT_TEMPLATE)) {
        return DEFAULT_TEMPLATE;
    }
    // 4. Random from actually existing templates
    const existing = fs.readdirSync(TEMPLATES_DIR)
        .filter((f) => f.endsWith('.html'))
        .map((f) => f.replace(/\.html$/, ''));
    if (existing.length === 0) {
        throw new Error('No templates found in templates directory');
    }
    return existing[Math.floor(Math.random() * existing.length)];
}

async function renderAndGeneratePdfs({ generatedJson, templates, baseName }) {
    const browser = await launchBrowser();
    const artifacts = [];

    try {
        for (const template of templates) {
            const templatePath = getTemplatePath(template);
            const htmlContent = render(templatePath, generatedJson);
            const htmlFilename = `${baseName}_${template}.html`;
            const pdfFilename = `${baseName}_${template}.pdf`;
            const htmlPath = path.join(CV_DIR, htmlFilename);
            const pdfPath = path.join(CV_DIR, pdfFilename);

            fs.writeFileSync(htmlPath, htmlContent);

            const page = await browser.newPage();
            await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
            await page.pdf({
                path: pdfPath,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0mm',
                    right: '0mm',
                    bottom: '0mm',
                    left: '0mm'
                }
            });
            await page.close();

            artifacts.push({
                template,
                html_filename: htmlFilename,
                pdf_filename: pdfFilename,
                html_path: htmlPath,
                pdf_path: pdfPath,
                html_url: `/cvs/${htmlFilename}`,
                pdf_url: `/cvs/${pdfFilename}`
            });
        }
    } finally {
        await browser.close();
    }

    return artifacts;
}

async function generateCvArtifacts({
    vacancyText,
    customComment,
    model = DEFAULT_MODEL,
    templates = null,
    resolveTemplates = null,
    fullCvText,
    useFallbackChain = false
}) {
    const assets = getGenerationAssets(fullCvText);
    const prompt = buildCvPrompt({
        vacancyText,
        customComment,
        fullCv: assets.fullCv,
        exampleJson: assets.exampleJson,
        promptTemplate: assets.promptTemplate
    });

    const effectiveTemplates = templates || [DEFAULT_TEMPLATE];
    console.log(`Calling LLM for templates [${effectiveTemplates.join(', ')}] using model ${model}...`);
    const { result, usedModel } = await generateContentWithFallbackChain({ prompt, model, useFallbackChain });
    const generatedJson = normalizeGeneratedCvJson(result);

    // If caller wants to resolve templates after seeing the JSON (e.g. use LLM-suggested template)
    const finalTemplates = resolveTemplates ? resolveTemplates(generatedJson) : effectiveTemplates;

    const baseName = `${generatedJson.cv_filename_prefix || 'cv'}_${Date.now()}`;
    const artifacts = await renderAndGeneratePdfs({ generatedJson, templates: finalTemplates, baseName });

    return {
        generatedJson,
        usedModel,
        fullCv: assets.fullCv,
        artifacts,
        baseName
    };
}

async function generateTelegramComment({
    vacancyText,
    customComment,
    fullCv,
    generatedCvJson,
    model = DEFAULT_MODEL,
    useFallbackChain = false
}) {
    const prefix = generatedCvJson && generatedCvJson.cv_filename_prefix
        ? generatedCvJson.cv_filename_prefix
        : 'CV';
    const prompt = `${prefix} You are helping a candidate prepare for a screening and interview.\nReturn JSON only with this schema:\n{\n  "comment_markdown": "string"\n}\n\nTask:\n1) Compare FULL CV vs GENERATED CV for this vacancy.\n2) Explain what was emphasized, de-emphasized, and what gaps remain.\n3) Give practical screening and interview recommendations.\n4) Keep it concise but useful (max ~500 words).\n5) Resume and advice must be in English.\n\nVacancy:\n${vacancyText}\n\nCustom comment from user (optional):\n${customComment || '(none)'}\n\nFULL CV:\n${fullCv}\n\nGENERATED CV JSON:\n${JSON.stringify(generatedCvJson, null, 2)}\n`;

    const { result, usedModel } = await generateContentWithFallbackChain({ prompt, model, useFallbackChain });
    const response = result;

    if (response && typeof response.comment_markdown === 'string' && response.comment_markdown.trim()) {
        return {
            commentMarkdown: response.comment_markdown.trim(),
            usedModel
        };
    }

    if (response && typeof response.raw_text === 'string' && response.raw_text.trim()) {
        return {
            commentMarkdown: response.raw_text.trim(),
            usedModel
        };
    }

    return {
        commentMarkdown: 'CVs generated. Review the highlighted experience against the vacancy and prepare short examples for the most relevant projects, tradeoffs, and production incidents.',
        usedModel
    };
}

function getGeneratedCommentText(generation, fallbackText = '') {
    const value =
        generation?.generatedJson?.comment_for_user
        && String(generation.generatedJson.comment_for_user).trim();
    return value || fallbackText || '';
}

function getGeneratedPositionTitle(generation) {
    return generation.generatedJson.role_original
        || generation.generatedJson.role
        || generation.generatedJson.position_title
        || null;
}

async function processOneCreatedVacancy() {
    const collection = await getVacanciesCollection();
    if (!collection) {
        return { processed: false, reason: 'mongodb_disabled' };
    }

    const vacancy = await collection.findOne(
        { status: 'created' },
        { sort: { updated_at: 1, created_at: 1 } }
    );

    if (!vacancy) {
        return { processed: false, reason: 'no_created_vacancies' };
    }

    const lockResult = await collection.updateOne(
        { _id: vacancy._id, status: 'created' },
        {
            $set: {
                status: 'processing',
                updated_at: new Date()
            }
        }
    );

    if (lockResult.modifiedCount !== 1) {
        return { processed: false, reason: 'lock_conflict' };
    }

    try {
        if (!vacancy.vacancy_text || String(vacancy.vacancy_text).trim() === '') {
            throw new Error('Vacancy has empty vacancy_text');
        }

        const generation = await generateCvArtifacts({
            vacancyText: String(vacancy.vacancy_text),
            customComment: String(vacancy.comment_text || ''),
            resolveTemplates: (generatedJson) => [
                resolveTemplate('dark', generatedJson),
                resolveTemplate('light', generatedJson)
            ],
            useFallbackChain: true
        });

        const darkArtifact = generation.artifacts.find((a) => a.template !== 'light');
        const lightArtifact = generation.artifacts.find((a) => a.template === 'light');
        const primaryArtifact = darkArtifact || lightArtifact || generation.artifacts[0];
        if (!primaryArtifact) {
            throw new Error('CV artifact generation failed');
        }

        let commentText = getGeneratedCommentText(generation);
        if (!commentText) {
            const commentResult = await generateTelegramComment({
                vacancyText: String(vacancy.vacancy_text),
                customComment: String(vacancy.comment_text || ''),
                fullCv: generation.fullCv,
                generatedCvJson: generation.generatedJson,
                useFallbackChain: true
            });
            commentText = commentResult.commentMarkdown;
        }

        const summary = buildTelegramSummaryMessage({
            recruiterName: vacancy.recruiter_name || null,
            recruiterContact: vacancy.recruiter_contact || null,
            postLink: vacancy.post_link || null,
            commentText,
            model: generation.usedModel || null
        });
        const greetingMessage =
            generation.generatedJson.greeting_message &&
            String(generation.generatedJson.greeting_message).trim();

        await collection.updateOne(
            { _id: vacancy._id },
            {
                $set: {
                    status: 'generated',
                    file_name: primaryArtifact.pdf_filename,
                    position_title: getGeneratedPositionTitle(generation),
                    recruiter_telegram: generation.generatedJson.recruiter_telegram || null,
                    post_link: vacancy.post_link || null,
                    comment_text: commentText || null,
                    greeting_message: generation.generatedJson.greeting_message || null,
                    model: generation.usedModel || null,
                    updated_at: new Date(),
                    worker_error: null
                }
            }
        );

        const telegram = createTelegramClient();
        const workerChatId = process.env.CHAT_ID || '280615376';
        await sendGeneratedCvToTelegram({
            telegram,
            chatId: workerChatId,
            darkArtifact,
            lightArtifact,
            summary,
            greetingMessage
        });

        return { processed: true, uuid: vacancy.uuid || null };
    } catch (error) {
        await collection.updateOne(
            { _id: vacancy._id },
            {
                $set: {
                    status: 'created',
                    updated_at: new Date(),
                    worker_error: error.message
                }
            }
        );

        throw error;
    }
}

function startVacancyWorker({ intervalMs = 600_000 } = {}) {
    if (String(process.env.WORKER_ON || '').toLowerCase() !== 'true') {
        console.log('[Worker] WORKER_ON is not true. Worker is disabled.');
        return null;
    }

    if (!process.env.MONGODB_CONNECTION_STRING) {
        console.log('[Worker] MONGODB_CONNECTION_STRING not set. Worker is disabled.');
        return null;
    }

    let isRunning = false;

    async function tick() {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            const result = await processOneCreatedVacancy();
            if (result.processed) {
                console.log(`[Worker] Processed vacancy${result.uuid ? ` ${result.uuid}` : ''}`);
            }
        } catch (error) {
            console.error('[Worker] Failed to process vacancy:', error);
        } finally {
            isRunning = false;
        }
    }

    const timer = setInterval(tick, intervalMs);
    tick();

    console.log(`[Worker] Started. Poll interval: ${intervalMs}ms`);

    return () => {
        clearInterval(timer);
        console.log('[Worker] Stopped.');
    };
}

function extractUrls(text) {
    if (!text) return [];
    return Array.from(text.matchAll(/https?:\/\/[^\s]+/gi)).map((m) => m[0]);
}

function pickLinkedInPostUrl(urls) {
    return urls.find((url) => /linkedin\.com\/(posts|feed\/update)/i.test(url));
}

function stripUrls(text) {
    if (!text) return '';
    return text.replace(/https?:\/\/[^\s]+/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchText(url) {
    const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CVBuilderBot/1.0; +https://example.local)'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }

    return response.text();
}

function tryParseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function parseLinkedInPostHtml(html, sourceUrl) {
    const $ = cheerio.load(html);

    let socialPost = null;
    $('script[type="application/ld+json"]').each((_, el) => {
        if (socialPost) return;
        const raw = $(el).contents().text().trim();
        if (!raw) return;
        const parsed = tryParseJson(raw);
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of candidates) {
            if (item && (item['@type'] === 'SocialMediaPosting' || item.articleBody)) {
                socialPost = item;
                break;
            }
        }
    });

    const canonicalUrl = $('link[rel="canonical"]').attr('href')
        || $('meta[property="og:url"]').attr('content')
        || sourceUrl;

    const vacancyText = (socialPost && socialPost.articleBody)
        || $('meta[name="description"]').attr('content')
        || $('meta[property="og:description"]').attr('content')
        || '';

    const ogImage = $('meta[property="og:image"]').attr('content') || null;

    const author = socialPost && socialPost.author && typeof socialPost.author === 'object' ? socialPost.author : {};
    const recruiterName = author.name
        || $('meta[property="og:title"]').attr('content')?.split('|').pop()?.trim()
        || null;
    const recruiterContact = author.url || null;

    let recruiterAvatarUrl = null;
    if (author.image) {
        if (typeof author.image === 'string') {
            recruiterAvatarUrl = author.image;
        } else if (Array.isArray(author.image) && author.image.length > 0) {
            recruiterAvatarUrl = author.image[0].url || author.image[0];
        } else if (typeof author.image === 'object' && author.image.url) {
            recruiterAvatarUrl = author.image.url;
        }
    }

    if (!vacancyText.trim()) {
        throw new Error('Failed to extract vacancy text from LinkedIn post HTML');
    }

    return {
        vacancy_text: vacancyText.trim(),
        recruiter_name: recruiterName,
        recruiter_contact: recruiterContact,
        post_link: canonicalUrl,
        post_image_url: ogImage,
        recruiter_avatar_url: recruiterAvatarUrl
    };
}

async function fetchAndParseLinkedInPost(link) {
    const html = await fetchText(link);
    return parseLinkedInPostHtml(html, link);
}

function getTelegramMessageFromUpdate(update) {
    return update?.message || update?.edited_message || update?.channel_post || update?.edited_channel_post || null;
}

function buildTelegramSummaryMessage({ recruiterName, recruiterContact, postLink, commentText, model }) {
    const lines = [];
    if (recruiterName) lines.push(`Recruiter: ${recruiterName}`);
    if (recruiterContact) lines.push(`Recruiter contact: ${recruiterContact}`);
    if (postLink) lines.push(`Post link: ${postLink}`);
    if (model) lines.push(`Model: ${model}`);
    lines.push('');
    lines.push(commentText || '');
    return lines.join('\n').trim();
}

async function sendTelegramTextInChunks(telegram, chatId, text) {
    const maxLen = 3800;
    for (let i = 0; i < text.length; i += maxLen) {
        const chunk = text.slice(i, i + maxLen);
        await telegram.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
    }
}

function createTelegramClient() {
    const telegramToken = process.env.TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN;
    if (!telegramToken && process.env.MOCK_TELEGRAM !== 'true') {
        throw new Error('TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN is not configured');
    }

    class MockTelegram {
        async sendMessage(chat, text, opts) { console.log(`[MockTelegram] sendMessage to ${chat}`); }
        async sendMediaGroup(chat, media) { console.log(`[MockTelegram] sendMediaGroup to ${chat}`); }
    }

    return process.env.MOCK_TELEGRAM === 'true'
        ? new MockTelegram()
        : new Telegram(telegramToken);
}

async function sendGeneratedCvToTelegram({
    telegram,
    chatId,
    darkArtifact,
    lightArtifact,
    summary,
    greetingMessage
}) {
    const media = [];
    const MAX_CAPTION_LENGTH = 1000;
    const caption = summary.length > MAX_CAPTION_LENGTH ? summary.slice(0, MAX_CAPTION_LENGTH) : summary;

    if (darkArtifact) {
        media.push(
            {
                type: 'document',
                media: {
                    source: darkArtifact.pdf_path,
                    filename: darkArtifact.pdf_filename
                },
                caption
            }
        );
    }

    if (lightArtifact) {
        media.push(
            {
                type: 'document',
                media: {
                    source: lightArtifact.pdf_path,
                    filename: lightArtifact.pdf_filename
                }
            }
        );
    }

    if (greetingMessage) {
        await telegram.sendMessage(chatId, greetingMessage);
    }

    if (media.length > 0) {
        await telegram.sendMediaGroup(chatId, media);
        if (summary.length > MAX_CAPTION_LENGTH) {
            const remaining = summary.slice(MAX_CAPTION_LENGTH);
            await sendTelegramTextInChunks(telegram, chatId, remaining.trimStart());
        }
    } else {
        await sendTelegramTextInChunks(telegram, chatId, summary);
    }
}

async function processTelegramUpdate(update) {
    const message = getTelegramMessageFromUpdate(update);
    if (!message || !message.chat || typeof message.chat.id === 'undefined') {
        return;
    }

    const chatId = message.chat.id;
    const incomingText = message.text || message.caption || '';
    const urls = extractUrls(incomingText);
    const linkedinUrl = pickLinkedInPostUrl(urls);
    const textWithoutUrls = stripUrls(incomingText);

    const telegram = createTelegramClient();

    let vacancyText;
    let linkedinData = null;
    const customComment = stripUrls(incomingText);

    if (linkedinUrl) {
        linkedinData = await fetchAndParseLinkedInPost(linkedinUrl);
        if (textWithoutUrls) {
            vacancyText = `${textWithoutUrls}\n\n${linkedinData.vacancy_text}`;
        } else {
            vacancyText = linkedinData.vacancy_text;
        }
    } else {
        if (!textWithoutUrls) {
            await telegram.sendMessage(chatId, 'Send a LinkedIn post link or paste vacancy text in the same message.');
            return;
        }
        vacancyText = textWithoutUrls;
    }

    if (linkedinUrl) {
        try {
            await createOrRefreshVacancyByPostLink({
                vacancy_text: vacancyText,
                post_link: linkedinData?.post_link || linkedinUrl || null,
                recruiter_name: linkedinData?.recruiter_name || null,
                recruiter_contact: linkedinData?.recruiter_contact || null,
                comment_text: customComment || null
            });
        } catch (error) {
            console.error('Failed to create or refresh vacancy in MongoDB:', error);
        }
    }

    const generation = await generateCvArtifacts({
        vacancyText,
        customComment,
        resolveTemplates: (generatedJson) => [
            resolveTemplate('dark', generatedJson),
            resolveTemplate('light', generatedJson)
        ],
        useFallbackChain: true
    });

    let commentText =
        (generation.generatedJson.comment_for_user && String(generation.generatedJson.comment_for_user).trim()) || '';
    if (!commentText) {
        const vacancyTextForComment = linkedinData?.vacancy_text || vacancyText;
        const commentResult = await generateTelegramComment({
            vacancyText: vacancyTextForComment,
            customComment,
            fullCv: generation.fullCv,
            generatedCvJson: generation.generatedJson,
            useFallbackChain: true
        });
        commentText = commentResult.commentMarkdown;
    }

    const commentFilename = `${generation.baseName}.comment.md`;
    const commentPath = path.join(CV_DIR, commentFilename);
    fs.writeFileSync(commentPath, commentText);

    const darkArtifact = generation.artifacts.find((a) => a.template !== 'light');
    const lightArtifact = generation.artifacts.find((a) => a.template === 'light');

    const summary = buildTelegramSummaryMessage({
        recruiterName: linkedinData?.recruiter_name || null,
        recruiterContact: linkedinData?.recruiter_contact || null,
        postLink: linkedinData?.post_link || null,
        commentText,
        model: generation.usedModel || null
    });

    if (linkedinUrl) {
        try {
            const primaryArtifact = darkArtifact || lightArtifact || generation.artifacts[0] || null;
            if (primaryArtifact) {
                await updateVacancy(linkedinData?.post_link || linkedinUrl || null, {
                    file_name: primaryArtifact.pdf_filename,
                    position_title:
                        generation.generatedJson.role_original
                        || generation.generatedJson.role
                        || generation.generatedJson.position_title
                        || null,
                    recruiter_telegram: generation.generatedJson.recruiter_telegram || null,
                    comment_text: commentText,
                    greeting_message: generation.generatedJson.greeting_message || null,
                    model: generation.usedModel || null,
                    status: 'generated'
                });
            }
        } catch (error) {
            console.error('Failed to update vacancy in MongoDB:', error);
        }
    }

    const greetingMessage =
        generation.generatedJson.greeting_message &&
        String(generation.generatedJson.greeting_message).trim();

    await sendGeneratedCvToTelegram({
        telegram,
        chatId,
        darkArtifact,
        lightArtifact,
        summary,
        greetingMessage
    });
}

// Initialize LLM Client
const geminiApiKey = process.env.GEMINI_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const gemmaApiUrl = process.env.GEMMA_API_URL;
const gemmaApiKey = process.env.GEMMA_API_KEY;
if (!geminiApiKey && !openRouterApiKey && !HAS_GEMMA) {
    console.error('Error: no LLM credentials found. Configure GEMMA_API_URL+GEMMA_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY.');
    process.exit(1);
}

const llmClient = new UnifiedLLMClient(geminiApiKey, openRouterApiKey, gemmaApiUrl, gemmaApiKey);


async function handleGenerateCvRequest(req, res) {
    try {
        const {
            vacancy_text,
            custom_comment,
            model = DEFAULT_MODEL,
            template,
            full_cv_text
        } = req.body;

        if (!vacancy_text) {
            return res.status(400).json({ error: 'vacancy_text is required' });
        }

        const generation = await generateCvArtifacts({
            vacancyText: vacancy_text,
            customComment: custom_comment,
            model,
            resolveTemplates: (generatedJson) => [resolveTemplate(template, generatedJson)],
            fullCvText: full_cv_text
        });

        const artifact = generation.artifacts[0];
        fs.writeFileSync(LAST_JSON_PATH, JSON.stringify(generation.generatedJson, null, 2));

        res.json({
            success: true,
            html_url: artifact.html_url,
            pdf_url: artifact.pdf_url,
            pdf_absolute_path: artifact.pdf_path,
            greeting_message: generation.generatedJson.greeting_message,
            match_rate: generation.generatedJson.match_rate ? parseInt(generation.generatedJson.match_rate) : null,
            top_tech_and_skills: generation.generatedJson.top_tech_and_skills,
            why_answer: generation.generatedJson.why_answer,
            email: generation.generatedJson.email
        });
    } catch (error) {
        console.error('Error generating CV:', error);
        res.status(500).json({ error: error.message });
    }
}

app.post('/api/v1/generate-cv', handleGenerateCvRequest);
app.post('/api/v1/generate_cv', handleGenerateCvRequest);

// Receives Telegram Update; register this URL with Telegram setWebhook API.
app.post('/api/v1/telegram/webhook', async (req, res) => {
    res.status(200).json({ ok: true });

    processTelegramUpdate(req.body).catch(async (error) => {
        console.error('Telegram webhook processing error:', error);
        try {
            const msg = getTelegramMessageFromUpdate(req.body);
            const chatId = msg?.chat?.id;
            const token = process.env.TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN;
            if (chatId && token) {
                const telegram = new Telegram(token);
                await telegram.sendMessage(chatId, `Failed to process request: ${error.message}`);
            } else if (chatId && process.env.MOCK_TELEGRAM === 'true') {
                console.log(`[MockTelegram] Failed to process request: ${error.message}`);
            }
        } catch (notifyError) {
            console.error('Failed to notify telegram chat about error:', notifyError);
        }
    });
});

app.get('/api/v1/vacancies', async (req, res) => {
    const statusFilterRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const statusFilter = statusFilterRaw
        ? statusFilterRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    try {
        const collection = await getVacanciesCollection();
        if (!collection) {
            return res.json({ vacancies: [] });
        }

        const query = statusFilter.length > 0
            ? { status: { $in: statusFilter } }
            : {};
        const vacancies = await collection.find(query).toArray();
        const statusOrder = {
            generated: 0,
            connection_requested: 1,
            sent: 2,
            cancelled: 3,
            declined: 4,
            created: 5
        };

        vacancies.sort((a, b) => {
            const aRank = statusOrder[a.status] ?? Number.MAX_SAFE_INTEGER;
            const bRank = statusOrder[b.status] ?? Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) {
                return aRank - bRank;
            }

            const aTime = (a.updated_at || a.created_at || new Date(0)).getTime();
            const bTime = (b.updated_at || b.created_at || new Date(0)).getTime();
            return aTime - bTime;
        });

        res.json({ vacancies });
    } catch (error) {
        console.error('Failed to fetch vacancies:', error);
        res.status(500).json({ error: 'Failed to fetch vacancies' });
    }
});

app.patch('/api/v1/vacancies/:uuid', async (req, res) => {
    const { uuid } = req.params;
    const { status, comment } = req.body || {};

    const authToken = process.env.AUTH_TOKEN;
    if (authToken) {
        const authHeader = req.get('authorization') || '';
        const expected = `Bearer ${authToken}`;
        if (authHeader !== expected) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const collection = await getVacanciesCollection();
        if (!collection) {
            return res.json({ success: true });
        }

        const update = {
            updated_at: new Date()
        };

        if (typeof status === 'string') {
            update.status = status;
        }
        if (typeof comment === 'string') {
            update.comment_text = comment;
        }

        await collection.updateOne(
            { uuid },
            {
                $set: update
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to update vacancy:', error);
        res.status(500).json({ error: 'Failed to update vacancy' });
    }
});

const openApiSpec = {
    openapi: '3.0.0',
    info: {
        title: 'CV AI Adapter API',
        version: '1.0.0'
    },
    paths: {
        '/api/v1/generate_cv': {
            post: {
                summary: 'Generate CV',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    vacancy_text: { type: 'string' },
                                    custom_comment: { type: 'string' },
                                    template: { type: 'string', enum: ['dark', 'light', 'dark_calendly', 'light_calendly', 'dark_deep_blue', 'dark_deep_blue_with_photo'], default: 'dark_calendly' },
                                    model: { type: 'string', default: DEFAULT_MODEL },
                                    full_cv_text: { type: 'string' }
                                },
                                required: ['vacancy_text']
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'CV generated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        html_url: { type: 'string' },
                                        pdf_url: { type: 'string' },
                                        pdf_absolute_path: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    400: {
                        description: 'Bad request'
                    }
                }
            }
        },
        '/api/v1/telegram/webhook': {
            post: {
                summary: 'Telegram webhook',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object'
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Accepted'
                    }
                }
            }
        },
        '/api/v1/vacancies': {
            get: {
                summary: 'Get vacancies',
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        required: false,
                        description: 'Optional status filter. Supports comma-separated values.',
                        schema: { type: 'string' }
                    }
                ],
                responses: {
                    200: {
                        description: 'List of vacancies',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        vacancies: {
                                            type: 'array',
                                            items: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/v1/vacancies/{uuid}': {
            patch: {
                summary: 'Update vacancy',
                parameters: [
                    {
                        name: 'uuid',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' }
                    }
                ],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                    comment: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Updated'
                    },
                    401: {
                        description: 'Unauthorized'
                    }
                }
            }
        }
    }
};

app.get('/api/v1/docs.json', (req, res) => {
    res.json(openApiSpec);
});

app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Serve static files for verification if needed
app.use('/cvs', express.static(CV_DIR));

module.exports = {
    app,
    handleGenerateCvRequest,
    processTelegramUpdate,
    processOneCreatedVacancy,
    startVacancyWorker,
    parseLinkedInPostHtml,
    extractUrls,
    pickLinkedInPostUrl,
    stripUrls,
    buildTelegramSummaryMessage,
    saveVacancy,
    getVacanciesCollection,
    createVacancy,
    updateVacancy
};
