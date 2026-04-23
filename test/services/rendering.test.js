const assert = require("node:assert/strict");
const test = require("node:test");

const {
  escapeHtml,
  isHtmlTag,
  renderInline,
  renderMarkdown,
  renderMarkdownToHtml,
  sanitizeHtml
} = require("../../src/services/rendering");

test("escapeHtml escapes unsafe HTML characters", () => {
  assert.equal(
    escapeHtml('<div class="note">Hi & bye</div>'),
    "&lt;div class=&quot;note&quot;&gt;Hi &amp; bye&lt;/div&gt;"
  );
});

test("renderInline handles emphasis, strong text, code and links", () => {
  const html = renderInline("Use *italics*, **bold**, `code`, and [docs](/docs).");

  assert.equal(
    html,
    "Use <em>italics</em>, <strong>bold</strong>, <code>code</code>, and <a href=\"/docs\">docs</a>."
  );
});

test("isHtmlTag detects basic HTML tags", () => {
  assert.equal(isHtmlTag("<div>"), true);
  assert.equal(isHtmlTag("</div>"), true);
  assert.equal(isHtmlTag("plain text"), false);
});

test("renderMarkdown renders headings and paragraphs", () => {
  const html = renderMarkdown("# Eldoria\n\nA northern empire.");

  assert.equal(html, "<h1>Eldoria</h1>\n<p>A northern empire.</p>");
});

test("renderMarkdown renders unordered and ordered lists", () => {
  const html = renderMarkdown("- North\n- South\n\n1. First\n2. Second");

  assert.equal(
    html,
    "<ul><li>North</li><li>South</li></ul>\n<ol><li>First</li><li>Second</li></ol>"
  );
});

test("renderMarkdown renders fenced code blocks safely", () => {
  const html = renderMarkdown("```\nconst x = 1 < 2;\n```");

  assert.equal(html, "<pre><code>const x = 1 &lt; 2;</code></pre>");
});

test("renderMarkdown escapes raw HTML in standard markdown rendering", () => {
  const html = renderMarkdown("Hello <script>alert(1)</script>");

  assert.equal(html, "<p>Hello <script>alert(1)</script></p>");
});

test("renderMarkdown preserves inline HTML tags inside paragraphs", () => {
  const html = renderMarkdown("Hello <span class=\"note\">world</span>");

  assert.equal(html, "<p>Hello <span class=\"note\">world</span></p>");
});

test("renderMarkdown preserves HTML blocks", () => {
  const html = renderMarkdown("<div class=\"card\">\nContent block\n</div>");

  assert.equal(html, "<div class=\"card\">\nContent block\n</div>");
});

test("sanitizeHtml removes script tags", () => {
  const html = sanitizeHtml("<p>Hello</p><script>alert(1)</script><p>World</p>");

  assert.equal(html, "<p>Hello</p><p>World</p>");
});

test("sanitizeHtml removes unsafe inline event handlers", () => {
  const html = sanitizeHtml("<div onclick=\"alert(1)\" onmouseover='x()' onload=test>Safe</div>");

  assert.equal(html, "<div>Safe</div>");
});

test("renderMarkdownToHtml sanitizes rendered output", () => {
  const html = renderMarkdownToHtml("Hello <span onclick=\"alert(1)\">world</span><script>alert(1)</script>");

  assert.equal(html, "<p>Hello <span>world</span></p>");
});
