const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePdf() {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3];

    if (!inputPath || !outputPath) {
        console.error('Usage: node generate_pdf.js <input_html_file> <output_pdf_file>');
        process.exit(1);
    }

    const fullInputPath = path.resolve(inputPath);
    const fullOutputPath = path.resolve(outputPath);

    if (!fs.existsSync(fullInputPath)) {
        console.error(`Input file not found: ${fullInputPath}`);
        process.exit(1);
    }

    console.log(`Generating PDF from ${fullInputPath} to ${fullOutputPath}...`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Load the HTML file
    await page.goto(`file://${fullInputPath}`, { waitUntil: 'networkidle0' });

    // Set styling for printing
    await page.emulateMediaType('print');

    // Generate PDF
    await page.pdf({
        path: fullOutputPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '0px',
            right: '0px',
            bottom: '0px',
            left: '0px'
        }
    });

    await browser.close();
    console.log('PDF Generated Successfully!');
}

generatePdf().catch(err => {
    console.error('Error generation PDF:', err);
    process.exit(1);
});
