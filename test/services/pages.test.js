const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { ensureWorldStructure, getWorldPaths } = require("../../src/data");
const { listPages, slugFromFileName, titleFromMarkdown } = require("../../src/services/pages");

test("slugFromFileName removes the markdown extension", () => {
  assert.equal(slugFromFileName("king-tharos.md"), "king-tharos");
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
