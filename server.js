const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { GeminiClient } = require('./tools/llm_client');
const { render } = require('./tools/template_renderer');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const CV_DIR = path.join(__dirname, 'cvs');
const TOOLS_DIR = path.join(__dirname, 'tools');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

function getFallbackPath(preferredName, fallbackName) {
    const preferredPath = path.join(__dirname, preferredName);
    if (fs.existsSync(preferredPath)) {
        return preferredPath;
    }
    return path.join(__dirname, fallbackName);
}

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    console.error("Error: GEMINI_API_KEY not found in environment variables.");
    process.exit(1);
}
const llmClient = new GeminiClient(geminiApiKey);

app.post('/api/generate-cv', async (req, res) => {
    try {
        const { vacancy_text, custom_comment, model = 'gemini-2.5-flash', template = 'dark' } = req.body;

        if (!vacancy_text) {
            return res.status(400).json({ error: 'vacancy_text is required' });
        }

        console.log(`Received request for model: ${model}, template: ${template}`);

        // 1. Prepare Prompt
        const FULL_CV_PATH = getFallbackPath('full_cv.md', 'full_cv.example.md');
        const JSON_PATH = getFallbackPath('cv.json', 'cv.example.json');
        const PROMPT_PATH = getFallbackPath('prompt.md', 'prompt.example.md');

        const fullCv = fs.readFileSync(FULL_CV_PATH, 'utf8');
        const exampleJson = fs.readFileSync(JSON_PATH, 'utf8');
        const promptTemplate = fs.readFileSync(PROMPT_PATH, 'utf8');

        // Prepare custom comment block
        let customCommentBlock = "";
        if (custom_comment && custom_comment.trim() !== "") {
            customCommentBlock = `
Here are some specific instructions from the user:
<user instructions>
${custom_comment}
</user instructions>
`;
        }

        // Construct the prompt by replacing placeholders
        const prompt = promptTemplate
            .replace('${vacancy_text}', vacancy_text)
            .replace('${custom_comment_block}', customCommentBlock)
            .replace('${fullCv}', fullCv)
            .replace('${exampleJson}', exampleJson);

        // 2. Call LLM
        console.log("Calling LLM...");
        const generatedJson = await llmClient.generateContent(prompt, model); // gemini-2.5-flash
        console.log("LLM Response received.");

        // 3. Render HTML
        console.log("Rendering HTML...");
        const templateFile = template === 'light' ? 'light.html' : 'dark.html';
        const currentTemplatePath = path.join(TEMPLATES_DIR, templateFile);

        const htmlContent = render(currentTemplatePath, generatedJson);
        const timestamp = Date.now();
        const htmlFilename = `cv_${timestamp}.html`;
        const htmlPath = path.join(CV_DIR, htmlFilename);
        fs.writeFileSync(htmlPath, htmlContent);

        // 4. Generate PDF
        console.log("Generating PDF...");
        const pdfFilename = `cv_${timestamp}.pdf`;
        const pdfPath = path.join(CV_DIR, pdfFilename);

        const browser = await puppeteer.launch({ headless: "new" });
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
        await browser.close();

        console.log(`CV Generated: ${pdfPath}`);

        // 5. Respond
        res.json({
            success: true,
            html_url: `/cvs/${htmlFilename}`,
            pdf_url: `/cvs/${pdfFilename}`, // In a real app, serve static files
            pdf_absolute_path: pdfPath
        });

    } catch (error) {
        console.error("Error generating CV:", error);
        res.status(500).json({ error: error.message });
    }
});

// Serve static files for verification if needed
app.use('/cvs', express.static(CV_DIR));

app.listen(port, () => {
    console.log(`CV Generator Service listening at http://localhost:${port}`);
});
