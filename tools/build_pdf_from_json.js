const fs = require('fs');
const path = require('path');
const { render } = require('./template_renderer');
const { launchBrowser } = require('../runtime');

const ROOT_DIR = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const OUTPUT_DIR = path.join(ROOT_DIR, 'cvs');

function getTemplatePath(template) {
    const templateFileByName = {
        light: 'light.html',
        light_calendly: 'light_calendly.html',
        dark_deep_blue: 'dark_deep_blue.html',
        dark_deep_blue_with_photo: 'dark_deep_blue_with_photo.html',
        dark_deep_blue_with_photo_calendly: 'dark_deep_blue_with_photo_calendly.html',
        dark_matrix: 'dark_matrix.html',
        dark_matrix_calendly: 'dark_matrix_calendly.html'
    };
    const templateFile = templateFileByName[template];
    if (!templateFile) {
        throw new Error(`Unsupported template: ${template}`);
    }
    return path.join(TEMPLATES_DIR, templateFile);
}

function parseCliArgs() {
    const inputPathArg = process.argv[2];
    const outputPdfArg = process.argv[3];
    const VALID_TEMPLATES = ['light', 'light_calendly', 'dark_deep_blue', 'dark_deep_blue_with_photo', 'dark_deep_blue_with_photo_calendly', 'dark_matrix', 'dark_matrix_calendly'];
    const templateArg = process.argv[4] || 'dark_matrix_calendly';

    if (!inputPathArg) {
        console.error('Usage: node tools/build_pdf_from_json.js <input_json_file> [output_pdf_file] [template]');
        console.error('Example: node tools/build_pdf_from_json.js ./last.json ./cvs/manual_dark.pdf dark_matrix');
        process.exit(1);
    }

    if (!VALID_TEMPLATES.includes(templateArg)) {
        console.error(`Template must be one of: ${VALID_TEMPLATES.join(', ')}`);
        process.exit(1);
    }

    return {
        inputPath: path.resolve(inputPathArg),
        outputPdfArg,
        template: templateArg
    };
}

function resolveOutputPaths(outputPdfArg, template) {
    if (outputPdfArg) {
        const outputPdfPath = path.resolve(outputPdfArg.endsWith('.pdf') ? outputPdfArg : `${outputPdfArg}.pdf`);
        const outputHtmlPath = outputPdfPath.replace(/\.pdf$/i, '.html');
        return { outputPdfPath, outputHtmlPath };
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const baseName = `cv_manual_${Date.now()}_${template}`;
    return {
        outputPdfPath: path.join(OUTPUT_DIR, `${baseName}.pdf`),
        outputHtmlPath: path.join(OUTPUT_DIR, `${baseName}.html`)
    };
}

async function buildPdfFromJson() {
    const { inputPath, outputPdfArg, template } = parseCliArgs();

    if (!fs.existsSync(inputPath)) {
        throw new Error(`Input JSON file not found: ${inputPath}`);
    }

    const rawJson = fs.readFileSync(inputPath, 'utf8');
    const data = JSON.parse(rawJson);
    const templatePath = getTemplatePath(template);
    const { outputPdfPath, outputHtmlPath } = resolveOutputPaths(outputPdfArg, template);

    fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });
    fs.mkdirSync(path.dirname(outputHtmlPath), { recursive: true });

    const html = render(templatePath, data);
    fs.writeFileSync(outputHtmlPath, html);

    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        await page.goto(`file://${outputHtmlPath}`, { waitUntil: 'networkidle0' });
        await page.pdf({
            path: outputPdfPath,
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
    } finally {
        await browser.close();
    }

    console.log(JSON.stringify({
        success: true,
        template,
        input_json_path: inputPath,
        html_path: outputHtmlPath,
        pdf_path: outputPdfPath
    }, null, 2));
}

buildPdfFromJson().catch((error) => {
    console.error(`Failed to build PDF from JSON: ${error.message}`);
    process.exit(1);
});
