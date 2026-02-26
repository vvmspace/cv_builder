const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { Telegram } = require('telegraf');
const { GeminiClient } = require('./tools/llm_client');
const { render } = require('./tools/template_renderer');
const { launchBrowser, isNetlifyRuntime } = require('./runtime');
require('dotenv').config();

const app = express();

app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static('public'));

const CV_DIR = isNetlifyRuntime()
    ? path.join('/tmp', 'cvs')
    : path.join(__dirname, 'cvs');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

fs.mkdirSync(CV_DIR, { recursive: true });

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
        throw new Error('LLM returned non-JSON output; expected CV JSON');
    }

    if (typeof generated !== 'object' || Array.isArray(generated)) {
        throw new Error('LLM returned invalid CV JSON structure');
    }

    return generated;
}

function getTemplatePath(template) {
    const templateFile = template === 'light' ? 'light.html' : 'dark.html';
    return path.join(TEMPLATES_DIR, templateFile);
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

async function generateCvArtifacts({ vacancyText, customComment, model = 'gemini-3.1-pro-preview', templates = ['dark'], fullCvText }) {
    const assets = getGenerationAssets(fullCvText);
    const prompt = buildCvPrompt({
        vacancyText,
        customComment,
        fullCv: assets.fullCv,
        exampleJson: assets.exampleJson,
        promptTemplate: assets.promptTemplate
    });

    console.log(`Calling LLM for templates [${templates.join(', ')}] using model ${model}...`);
    const generatedJson = normalizeGeneratedCvJson(await llmClient.generateContent(prompt, model));
    const baseName = `cv_${Date.now()}`;
    const artifacts = await renderAndGeneratePdfs({ generatedJson, templates, baseName });

    return {
        generatedJson,
        fullCv: assets.fullCv,
        artifacts,
        baseName
    };
}

async function generateTelegramComment({ vacancyText, customComment, fullCv, generatedCvJson, model = 'gemini-3.1-pro-preview' }) {
    const prompt = `You are helping a candidate prepare for a screening and interview.\nReturn JSON only with this schema:\n{\n  "comment_markdown": "string"\n}\n\nTask:\n1) Compare FULL CV vs GENERATED CV for this vacancy.\n2) Explain what was emphasized, de-emphasized, and what gaps remain.\n3) Give practical screening and interview recommendations.\n4) Keep it concise but useful (max ~500 words).\n5) Resume and advice must be in English.\n\nVacancy:\n${vacancyText}\n\nCustom comment from user (optional):\n${customComment || '(none)'}\n\nFULL CV:\n${fullCv}\n\nGENERATED CV JSON:\n${JSON.stringify(generatedCvJson, null, 2)}\n`;

    const response = await llmClient.generateContent(prompt, model);

    if (response && typeof response.comment_markdown === 'string' && response.comment_markdown.trim()) {
        return response.comment_markdown.trim();
    }

    if (response && typeof response.raw_text === 'string' && response.raw_text.trim()) {
        return response.raw_text.trim();
    }

    return 'CVs generated. Review the highlighted experience against the vacancy and prepare short examples for the most relevant projects, tradeoffs, and production incidents.';
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

function buildTelegramSummaryMessage({ recruiterName, recruiterContact, postLink, commentText }) {
    const lines = [];
    if (recruiterName) lines.push(`Recruiter: ${recruiterName}`);
    if (recruiterContact) lines.push(`Recruiter contact: ${recruiterContact}`);
    if (postLink) lines.push(`Post link: ${postLink}`);
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

async function processTelegramUpdate(update) {
    const telegramToken = process.env.TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN;
    if (!telegramToken) {
        throw new Error('TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN is not configured');
    }

    const message = getTelegramMessageFromUpdate(update);
    if (!message || !message.chat || typeof message.chat.id === 'undefined') {
        return;
    }

    const chatId = message.chat.id;
    const incomingText = message.text || message.caption || '';
    const urls = extractUrls(incomingText);
    const linkedinUrl = pickLinkedInPostUrl(urls);
    const textWithoutUrls = stripUrls(incomingText);
    const telegram = new Telegram(telegramToken);

    let vacancyText;
    let linkedinData = null;
    let customComment = '';

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

    const generation = await generateCvArtifacts({
        vacancyText,
        customComment,
        templates: ['dark', 'light']
    });

    let commentText =
        (generation.generatedJson.comment_for_user && String(generation.generatedJson.comment_for_user).trim()) || '';
    if (!commentText) {
        commentText = await generateTelegramComment({
            vacancyText: linkedinData.vacancy_text,
            customComment,
            fullCv: generation.fullCv,
            generatedCvJson: generation.generatedJson
        });
    }

    const commentFilename = `${generation.baseName}.comment.md`;
    const commentPath = path.join(CV_DIR, commentFilename);
    fs.writeFileSync(commentPath, commentText);

    const darkArtifact = generation.artifacts.find((a) => a.template === 'dark');
    const lightArtifact = generation.artifacts.find((a) => a.template === 'light');

    const summary = buildTelegramSummaryMessage({
        recruiterName: linkedinData?.recruiter_name || null,
        recruiterContact: linkedinData?.recruiter_contact || null,
        postLink: linkedinData?.post_link || null,
        commentText
    });

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

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    console.error('Error: GEMINI_API_KEY not found in environment variables.');
    process.exit(1);
}
const llmClient = new GeminiClient(geminiApiKey);

async function handleGenerateCvRequest(req, res) {
    try {
        const {
            vacancy_text,
            custom_comment,
            model = 'gemini-3.1-pro-preview',
            template = 'dark',
            full_cv_text
        } = req.body;

        if (!vacancy_text) {
            return res.status(400).json({ error: 'vacancy_text is required' });
        }

        const generation = await generateCvArtifacts({
            vacancyText: vacancy_text,
            customComment: custom_comment,
            model,
            templates: [template],
            fullCvText: full_cv_text
        });

        const artifact = generation.artifacts[0];

        res.json({
            success: true,
            html_url: artifact.html_url,
            pdf_url: artifact.pdf_url,
            pdf_absolute_path: artifact.pdf_path
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
            }
        } catch (notifyError) {
            console.error('Failed to notify telegram chat about error:', notifyError);
        }
    });
});

// Serve static files for verification if needed
app.use('/cvs', express.static(CV_DIR));

module.exports = {
    app,
    handleGenerateCvRequest,
    processTelegramUpdate,
    parseLinkedInPostHtml,
    extractUrls,
    pickLinkedInPostUrl,
    stripUrls,
    buildTelegramSummaryMessage
};
