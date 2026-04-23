const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { getWorldPaths, resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const { renderPageOutput, setActiveTheme } = require("../../src/services");

async function resetWorld(worldName) {
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

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
  assert.equal(result.html, "<h1>Eldoria</h1>\n<p>A northern empire.</p>");
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
  assert.deepEqual(result.theme, {
    name: "eldoria",
    fileName: "eldoria.css",
    href: "/themes/eldoria.css?world=page-output-theme-world"
  });
});

test("GET /pages/:id/rendered returns the rendered page output", async () => {
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

  await router({ method: "GET", url: "/pages/eldoria/rendered?world=page-output-route-world" }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.html, "<h1>Eldoria</h1>\n<p>Hello <span>world</span></p>");
  assert.equal(result.body.theme.href, "/themes/northern.css?world=page-output-route-world");
});
