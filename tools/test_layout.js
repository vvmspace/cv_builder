const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function checkLayout() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('Usage: node tools/test_layout.js <input_html_file>');
        process.exit(1);
    }

    const fullInputPath = path.resolve(inputPath);
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Load content
    await page.goto(`file://${fullInputPath}`, { waitUntil: 'networkidle0' });

    // A4 dimensions at 96 DPI (approximate web rendering)
    // A4 is 210mm x 297mm. 
    // In CSS pixels (96dpi): 210mm = 794px, 297mm = 1123px.
    const PAGE_HEIGHT = 1123;

    console.log(`Analyzing layout for A4 Page Height: ${PAGE_HEIGHT}px...`);

    // Get all critical elements
    const issues = await page.evaluate((PAGE_HEIGHT) => {
        const elements = document.querySelectorAll('.job-item, section, h3, .header-info');
        const issues = [];

        elements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const startPage = Math.floor(rect.top / PAGE_HEIGHT);
            const endPage = Math.floor(rect.bottom / PAGE_HEIGHT);

            // Logic: If an element starts on one page and ends on another, it MIGHT be split.
            // We specifically care if it's "broken" badly.

            // Check if element crosses a page boundary
            if (startPage !== endPage) {
                // Calculate how much is on the next page
                const breakPoint = (startPage + 1) * PAGE_HEIGHT;
                const overflow = rect.bottom - breakPoint;

                // If the element has 'page-break-inside: avoid' (check computed style)
                const style = window.getComputedStyle(el);
                const avoidBreak = style.pageBreakInside === 'avoid' || style.breakInside === 'avoid';

                issues.push({
                    tag: el.tagName,
                    class: el.className,
                    text: el.innerText.substring(0, 30) + '...',
                    startPage: startPage + 1,
                    endPage: endPage + 1,
                    crossesBoundary: true,
                    avoidBreak: avoidBreak,
                    top: rect.top,
                    bottom: rect.bottom
                });
            }
        });
        return issues;
    }, PAGE_HEIGHT);

    if (issues.length > 0) {
        console.log('⚠️  POTENTIAL LAYOUT ISSUES DETECTED:');
        issues.forEach(i => {
            console.log(`[Page ${i.startPage} -> ${i.endPage}] Element <${i.tag} class="${i.class}"> "${i.text}" crosses page boundary.`);
            if (i.avoidBreak) {
                console.log(`   🔴 ERROR: Element is set to avoid breaks but is crossing! This means it's too tall for the remaining space.`);
            } else {
                console.log(`   🟠 WARNING: Element might be split. Check visually.`);
            }
        });
    } else {
        console.log('✅ No obvious element breaks detected.');
    }

    // Capture screenshot with page break lines for manual review
    await page.setViewport({ width: 794, height: 2300 }); // 2 pages approx

    // Draw lines
    await page.evaluate((PAGE_HEIGHT) => {
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.left = '0';
        line.style.right = '0';
        line.style.top = `${PAGE_HEIGHT}px`;
        line.style.height = '2px';
        line.style.backgroundColor = 'red';
        line.style.zIndex = '9999';
        line.style.pointerEvents = 'none';
        document.body.appendChild(line);
    }, PAGE_HEIGHT);

    const screenshotPath = inputPath.replace('.html', '_debug.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Debug screenshot saved to: ${screenshotPath}`);

    await browser.close();
}

checkLayout().catch(console.error);
