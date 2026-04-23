const assert = require("node:assert/strict");
const test = require("node:test");

const {
  escapeHtml,
  renderInline,
  renderMarkdown
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

  assert.equal(html, "<p>Hello &lt;script&gt;alert(1)&lt;/script&gt;</p>");
});
