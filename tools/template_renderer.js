const fs = require('fs');
const path = require('path');

/**
 * Basic Markdown to HTML converter.
 * Supports **bold** and *italic*.
 */
function renderMarkdown(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Convert simple newlines to <br> if needed, but usually block elements handle layout
    //.replace(/\n/g, '<br>'); 
}

/**
 * Recursively renders a template string with data.
 * @param {string} templateStr - The raw template string.
 * @param {object} data - The data object.
 * @returns {string} - Rendered HTML.
 */
function renderString(templateStr, data) {
    let output = templateStr;

    // 1. Handle Sections (Arrays)
    // Regex matches <!-- SECTION: key --> ... <!-- END SECTION: key -->
    const sectionRegex = /<!-- SECTION: (\w+) -->([\s\S]*?)<!-- END SECTION: \1 -->/g;

    output = output.replace(sectionRegex, (match, key, content) => {
        const items = data[key];

        // If data is missing or not an array, remove the section
        if (!items || !Array.isArray(items)) {
            return '';
        }

        return items.map(item => {
            if (typeof item === 'object' && item !== null) {
                // Recursive render for objects
                return renderString(content, item);
            } else {
                // For primitives (strings/numbers), map to %value%
                return renderString(content, { value: item });
            }
        }).join('');
    });

    // 2. Handle Variables
    // Matches %key% or %key|default%
    output = output.replace(/%([\w_]+)(?:\|([^%]+))?%/g, (match, key, defaultValue) => {
        let value = data[key];

        if (value === undefined || value === null) {
            return defaultValue !== undefined ? defaultValue : '';
        }

        return renderMarkdown(String(value));
    });

    return output;
}

/**
 * Renders a template file with data.
 * @param {string} templatePath - Absolute path to the template file.
 * @param {object} data - Data to populate the template.
 * @returns {string} - The rendered HTML.
 */
function render(templatePath, data) {
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
    }
    const template = fs.readFileSync(templatePath, 'utf8');
    return renderString(template, data);
}

module.exports = { render, renderString };
