const puppeteer = require('puppeteer');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const serverless = require('serverless-http');

function isNetlifyRuntime() {
    return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launchBrowser() {
    if (!isNetlifyRuntime()) {
        return puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    const executablePath = await chromium.executablePath();

    return puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: true
    });
}

function createNetlifyHandler(app, functionName = 'server') {
    return serverless(app, {
        basePath: `/.netlify/functions/${functionName}`
    });
}

function startExpressServer(app, port) {
    return app.listen(port, () => {
        console.log(`CV Generator Service listening at http://localhost:${port}`);
    });
}

module.exports = {
    isNetlifyRuntime,
    launchBrowser,
    createNetlifyHandler,
    startExpressServer
};
