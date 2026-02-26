const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

const {
    parseLinkedInPostHtml,
    extractUrls,
    pickLinkedInPostUrl,
    stripUrls
} = require('../app');

const linkedinExamplePath = path.join(__dirname, '..', 'linkedin.post.example.html');

test('parseLinkedInPostHtml extracts vacancy_text from example HTML', () => {
    const html = fs.readFileSync(linkedinExamplePath, 'utf8');
    const sourceUrl = 'https://www.linkedin.com/posts/some-activity-123';
    const result = parseLinkedInPostHtml(html, sourceUrl);

    assert.ok(result.vacancy_text, 'vacancy_text should be present');
    assert.ok(
        result.vacancy_text.includes('Senior Go') || result.vacancy_text.includes('Back Office'),
        'vacancy_text should contain job title or key phrase'
    );
});

test('parseLinkedInPostHtml extracts post_link from canonical or sourceUrl', () => {
    const html = fs.readFileSync(linkedinExamplePath, 'utf8');
    const result = parseLinkedInPostHtml(html, 'https://example.com/fallback');

    assert.ok(result.post_link, 'post_link should be present');
    assert.ok(
        result.post_link.includes('linkedin.com'),
        'post_link should contain linkedin.com'
    );
});

test('parseLinkedInPostHtml throws when vacancy text cannot be extracted', () => {
    const emptyHtml = '<html><head></head><body></body></html>';
    assert.throws(
        () => parseLinkedInPostHtml(emptyHtml, 'https://linkedin.com/posts/x-1'),
        /Failed to extract vacancy text/
    );
});

test('extractUrls returns URLs from text', () => {
    const text = 'Check this https://linkedin.com/posts/foo-123 and https://example.com';
    const urls = extractUrls(text);
    assert.equal(urls.length, 2);
    assert.ok(urls[0].includes('linkedin.com'));
    assert.ok(urls[1].includes('example.com'));
});

test('extractUrls returns empty array for text without URLs', () => {
    assert.deepEqual(extractUrls('no links here'), []);
    assert.deepEqual(extractUrls(''), []);
});

test('pickLinkedInPostUrl selects LinkedIn post URL', () => {
    const urls = [
        'https://example.com',
        'https://www.linkedin.com/posts/user_activity-123-abc',
        'https://other.com'
    ];
    assert.equal(
        pickLinkedInPostUrl(urls),
        'https://www.linkedin.com/posts/user_activity-123-abc'
    );
});

test('pickLinkedInPostUrl returns undefined when no LinkedIn URL', () => {
    assert.equal(pickLinkedInPostUrl(['https://example.com']), undefined);
    assert.equal(pickLinkedInPostUrl([]), undefined);
});

test('stripUrls removes URLs and normalizes spaces', () => {
    const text = 'Hello https://linkedin.com/posts/foo  world';
    assert.equal(stripUrls(text), 'Hello world');
});
