const fs = require('fs');
const path = require('path');
const { renderString } = require('../tools/template_renderer');

const template = `
<h1>%title%</h1>
<!-- SECTION: skills -->
    <h2>%category%</h2>
    <ul>
<!-- SECTION: items -->
        <li>%value%</li>
<!-- END SECTION: items -->
    </ul>
<!-- END SECTION: skills -->
`;

const data = {
    title: "**CV Title**",
    skills: [
        {
            category: "Backend",
            items: ["Node.js", "Rust"]
        },
        {
            category: "Frontend",
            items: ["React"]
        }
    ]
};

console.log("Testing recursive renderer...");

try {
    const html = renderString(template, data);
    console.log("Output:");
    console.log(html);

    // Assertions
    if (!html.includes("<h2>Backend</h2>")) throw new Error("Missing Backend category");
    if (!html.includes("<li>Node.js</li>")) throw new Error("Missing Node.js item");
    if (!html.includes("<li>Rust</li>")) throw new Error("Missing Rust item");
    if (!html.includes("<h2>Frontend</h2>")) throw new Error("Missing Frontend category");
    if (!html.includes("<strong>CV Title</strong>")) throw new Error("Markdown title not rendered correctly");

    console.log("PASS: Recursive renderer working.");
} catch (error) {
    console.error("FAIL:", error);
    process.exit(1);
}
