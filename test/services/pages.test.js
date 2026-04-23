const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { ensureWorldStructure, getWorldPaths } = require("../../src/data");
const { router } = require("../../src/routes");
const {
  buildPageFileName,
  listPages,
  readPage,
  slugFromFileName,
  titleFromMarkdown
} = require("../../src/services/pages");

test("slugFromFileName removes the markdown extension", () => {
  assert.equal(slugFromFileName("king-tharos.md"), "king-tharos");
});

test("buildPageFileName appends the markdown extension", () => {
  assert.equal(buildPageFileName("king-tharos"), "king-tharos.md");
});

test("titleFromMarkdown prefers the first markdown heading", () => {
  const content = "Intro line\n# Kingdom of Eldoria\nMore text";
  assert.equal(titleFromMarkdown(content, "kingdom-of-eldoria"), "Kingdom of Eldoria");
});

test("titleFromMarkdown falls back to the slug when no heading exists", () => {
  assert.equal(titleFromMarkdown("No heading here", "plain-page"), "plain-page");
});

test("listPages returns markdown page metadata for a world", async () => {
  const worldName = "pages-listing-world";
  const worldPaths = await ensureWorldStructure(worldName);

  await fs.writeFile(
    path.join(worldPaths.pages, "eldoria.md"),
    "# Kingdom of Eldoria\nA northern empire.\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(worldPaths.pages, "tharos.md"),
    "Tyrant ruler notes.\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(worldPaths.pages, "ignore.txt"),
    "This should not be listed.\n",
    "utf8"
  );

  const pages = await listPages(worldName);

  assert.deepEqual(pages, [
    {
      id: "eldoria",
      title: "Kingdom of Eldoria",
      slug: "eldoria",
      filePath: path.join(worldPaths.pages, "eldoria.md")
    },
    {
      id: "tharos",
      title: "tharos",
      slug: "tharos",
      filePath: path.join(worldPaths.pages, "tharos.md")
    }
  ]);
});

test("listPages creates the world structure if it does not exist yet", async () => {
  const worldName = "empty-pages-world";
  const pages = await listPages(worldName);
  const worldPaths = getWorldPaths(worldName);
  const stats = await fs.stat(worldPaths.pages);

  assert.deepEqual(pages, []);
  assert.equal(stats.isDirectory(), true);
});

test("readPage returns the markdown content and extracted title", async () => {
  const worldName = "page-reading-world";
  const worldPaths = await ensureWorldStructure(worldName);

  await fs.writeFile(
    path.join(worldPaths.pages, "eldoria.md"),
    "# Kingdom of Eldoria\nA northern empire.\n",
    "utf8"
  );

  const page = await readPage(worldName, "eldoria");

  assert.deepEqual(page, {
    id: "eldoria",
    title: "Kingdom of Eldoria",
    slug: "eldoria",
    filePath: path.join(worldPaths.pages, "eldoria.md"),
    content: "# Kingdom of Eldoria\nA northern empire.\n"
  });
});

test("readPage falls back to the slug when the markdown has no heading", async () => {
  const worldName = "page-reading-no-heading-world";
  const worldPaths = await ensureWorldStructure(worldName);

  await fs.writeFile(
    path.join(worldPaths.pages, "tharos.md"),
    "Tyrant ruler notes.\n",
    "utf8"
  );

  const page = await readPage(worldName, "tharos");

  assert.equal(page.title, "tharos");
  assert.equal(page.content, "Tyrant ruler notes.\n");
});

test("readPage returns a not found error when the file does not exist", async () => {
  await assert.rejects(
    () => readPage("missing-page-world", "unknown-page"),
    { code: "PAGE_NOT_FOUND" }
  );
});

test("GET /pages/:id returns a single page payload", async () => {
  const worldName = "route-page-reading-world";
  const worldPaths = await ensureWorldStructure(worldName);

  await fs.writeFile(
    path.join(worldPaths.pages, "eldoria.md"),
    "# Eldoria\nLore\n",
    "utf8"
  );

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

  await router({ method: "GET", url: "/pages/eldoria?world=route-page-reading-world" }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.id, "eldoria");
  assert.equal(result.body.title, "Eldoria");
  assert.equal(result.body.content, "# Eldoria\nLore\n");
});
