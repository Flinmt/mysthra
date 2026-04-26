const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { getTemplatesRoot, getWorldPaths, resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const { generateSessionToken } = require("../../src/utils/auth");
const {
  parsePageTemplateOverride,
  parsePageThemeOverride,
  renderPageOutput,
  setActiveTheme,
  stripPageTemplateOverride,
  stripPageThemeOverride
} = require("../../src/services");

const createdWorlds = new Set();
const createdTemplateFiles = new Set();

async function resetWorld(worldName) {
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

function getTestTemplatePath(fileName) {
  const filePath = path.join(getTemplatesRoot(), fileName);
  createdTemplateFiles.add(filePath);
  return filePath;
}

test.after(async () => {
  await Promise.all([
    ...[...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    ),
    ...[...createdTemplateFiles].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  ]);
});

function createAuthenticatedHeaders() {
  return {
    cookie: `mysthra_session=${generateSessionToken()}`
  };
}

test("parsePageThemeOverride reads the top-level theme marker", () => {
  assert.equal(parsePageThemeOverride("<!-- theme: ashlands -->\n# Eldoria\n"), "ashlands");
});

test("stripPageThemeOverride removes the top-level theme marker from markdown", () => {
  assert.equal(stripPageThemeOverride("<!-- theme: ashlands -->\n# Eldoria\n"), "# Eldoria\n");
});

test("parsePageTemplateOverride reads the top-level template marker", () => {
  assert.equal(parsePageTemplateOverride("<!-- template: chronicle -->\n# Eldoria\n"), "chronicle");
});

test("stripPageTemplateOverride removes the top-level template marker from markdown", () => {
  assert.equal(stripPageTemplateOverride("<!-- template: chronicle -->\n# Eldoria\n"), "# Eldoria\n");
});

test("renderPageOutput returns rendered html with no theme when none is active", async () => {
  const worldName = "page-output-no-theme-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.pages, { recursive: true });

  await fs.writeFile(
    path.join(worldPaths.pages, "eldoria.md"),
    "# Eldoria\nA northern empire.\n",
    "utf8"
  );

  const result = await renderPageOutput(worldName, "eldoria");

  assert.equal(result.page.slug, "eldoria");
  assert.equal(result.page.themeOverride, null);
  assert.equal(result.page.templateOverride, null);
  assert.equal(result.html, "<h1>Eldoria</h1>\n<p>A northern empire.</p>");
  assert.equal(result.documentHtml, "<h1>Eldoria</h1>\n<p>A northern empire.</p>");
  assert.equal(result.template, null);
  assert.equal(result.theme, null);
});

test("renderPageOutput returns the active theme reference separately from html", async () => {
  const worldName = "page-output-theme-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.pages, { recursive: true });
  await fs.mkdir(worldPaths.themes, { recursive: true });

  await fs.writeFile(
    path.join(worldPaths.pages, "tharos.md"),
    "# King Tharos\nRuled by fear.\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(worldPaths.themes, "eldoria.css"),
    "body { color: #123456; }",
    "utf8"
  );
  await setActiveTheme(worldName, "eldoria");

  const result = await renderPageOutput(worldName, "tharos");

  assert.equal(result.html, "<h1>King Tharos</h1>\n<p>Ruled by fear.</p>");
  assert.equal(result.documentHtml, "<h1>King Tharos</h1>\n<p>Ruled by fear.</p>");
  assert.deepEqual(result.theme, {
    name: "eldoria",
    fileName: "eldoria.css",
    href: "/api/themes/eldoria.css?world=page-output-theme-world",
    source: "world"
  });
});

test("renderPageOutput prefers a page theme override over the active world theme", async () => {
  const worldName = "page-output-override-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.pages, { recursive: true });
  await fs.mkdir(worldPaths.themes, { recursive: true });

  await fs.writeFile(
    path.join(worldPaths.pages, "eldoria.md"),
    "<!-- theme: ashlands -->\n# Eldoria\nBurning plains.\n",
    "utf8"
  );
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body { color: blue; }", "utf8");
  await fs.writeFile(path.join(worldPaths.themes, "ashlands.css"), "body { color: orange; }", "utf8");
  await setActiveTheme(worldName, "eldoria");

  const result = await renderPageOutput(worldName, "eldoria");

  assert.equal(result.page.themeOverride, "ashlands");
  assert.equal(result.page.content, "# Eldoria\nBurning plains.\n");
  assert.deepEqual(result.theme, {
    name: "ashlands",
    fileName: "ashlands.css",
    href: "/api/themes/ashlands.css?world=page-output-override-world",
    source: "page"
  });
});

test("renderPageOutput wraps rendered html with a page template override", async () => {
  const worldName = "page-output-template-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  const templatesRoot = getTemplatesRoot();
  await fs.mkdir(worldPaths.pages, { recursive: true });
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.mkdir(templatesRoot, { recursive: true });

  await fs.writeFile(
    path.join(worldPaths.pages, "eldoria.md"),
    "<!-- template: chronicle-page-output-test -->\n# Eldoria\nNorthern empire.\n",
    "utf8"
  );
  await fs.writeFile(
    getTestTemplatePath("chronicle-page-output-test.html"),
    "<html><head><title>{{title}}</title><link rel=\"stylesheet\" href=\"{{themeHref}}\"></head><body><main>{{content}}</main></body></html>",
    "utf8"
  );
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body { color: blue; }", "utf8");
  await setActiveTheme(worldName, "eldoria");

  const result = await renderPageOutput(worldName, "eldoria");

  assert.equal(result.page.templateOverride, "chronicle-page-output-test");
  assert.deepEqual(result.template, {
    name: "chronicle-page-output-test",
    fileName: "chronicle-page-output-test.html"
  });
  assert.equal(
    result.documentHtml,
    "<html><head><title>Eldoria</title><link rel=\"stylesheet\" href=\"/api/themes/eldoria.css?world=page-output-template-world\"></head><body><main><h1>Eldoria</h1>\n<p>Northern empire.</p></main></body></html>"
  );
});

test("GET /api/pages/:id/rendered returns the rendered page output", async () => {
  const worldName = "page-output-route-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.pages, { recursive: true });
  await fs.mkdir(worldPaths.themes, { recursive: true });

  await fs.writeFile(
    path.join(worldPaths.pages, "eldoria.md"),
    "# Eldoria\nHello <span onclick=\"alert(1)\">world</span>\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(worldPaths.themes, "northern.css"),
    "main { color: steelblue; }",
    "utf8"
  );
  await setActiveTheme(worldName, "northern");

  const result = {
    statusCode: null,
    headers: null,
    body: null
  };

  const response = {
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers;
    },
    end(body) {
      result.body = JSON.parse(body);
    }
  };

  await router({
    method: "GET",
    url: "/api/pages/eldoria/rendered?world=page-output-route-world",
    headers: createAuthenticatedHeaders()
  }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.html, "<h1>Eldoria</h1>\n<p>Hello <span>world</span></p>");
  assert.equal(result.body.documentHtml, "<h1>Eldoria</h1>\n<p>Hello <span>world</span></p>");
  assert.equal(result.body.theme.href, "/api/themes/northern.css?world=page-output-route-world");
  assert.equal(result.body.theme.source, "world");
});
