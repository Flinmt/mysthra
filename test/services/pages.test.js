const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { ensureWorldStructure, getWorldPaths, resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const {
  buildPageFileName,
  createPage,
  listPages,
  readPage,
  slugFromTitle,
  slugFromFileName,
  titleFromMarkdown,
  updatePage
} = require("../../src/services/pages");

async function resetWorld(worldName) {
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

test("slugFromFileName removes the markdown extension", () => {
  assert.equal(slugFromFileName("king-tharos.md"), "king-tharos");
});

test("buildPageFileName appends the markdown extension", () => {
  assert.equal(buildPageFileName("king-tharos"), "king-tharos.md");
});

test("slugFromTitle converts a title into a safe slug", () => {
  assert.equal(slugFromTitle("Kingdom of Eldoria"), "kingdom-of-eldoria");
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
  await resetWorld(worldName);
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
  await resetWorld(worldName);
  const pages = await listPages(worldName);
  const worldPaths = getWorldPaths(worldName);
  const stats = await fs.stat(worldPaths.pages);

  assert.deepEqual(pages, []);
  assert.equal(stats.isDirectory(), true);
});

test("readPage returns the markdown content and extracted title", async () => {
  const worldName = "page-reading-world";
  await resetWorld(worldName);
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
  await resetWorld(worldName);
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
  await resetWorld("missing-page-world");
  await assert.rejects(
    () => readPage("missing-page-world", "unknown-page"),
    { code: "PAGE_NOT_FOUND" }
  );
});

test("GET /pages/:id returns a single page payload", async () => {
  const worldName = "route-page-reading-world";
  await resetWorld(worldName);
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

test("createPage writes a new markdown page using a generated slug", async () => {
  await resetWorld("page-creation-world");
  const page = await createPage("page-creation-world", {
    title: "King Tharos",
    content: "# King Tharos\nTyrant ruler.\n"
  });

  assert.equal(page.slug, "king-tharos");
  assert.equal(page.title, "King Tharos");
  assert.equal(page.content, "# King Tharos\nTyrant ruler.\n");
});

test("createPage uses an explicit slug when provided", async () => {
  await resetWorld("page-creation-slug-world");
  const page = await createPage("page-creation-slug-world", {
    title: "Unused Title",
    slug: "custom capital city",
    content: "# Capital\n"
  });

  assert.equal(page.slug, "custom-capital-city");
  assert.equal(path.basename(page.filePath), "custom-capital-city.md");
});

test("createPage prevents overwriting an existing page by default", async () => {
  await resetWorld("page-creation-conflict-world");
  await createPage("page-creation-conflict-world", {
    title: "Eldoria",
    content: "# Eldoria\n"
  });

  await assert.rejects(
    () => createPage("page-creation-conflict-world", {
      title: "Eldoria",
      content: "# Different content\n"
    }),
    { code: "PAGE_ALREADY_EXISTS" }
  );
});

test("createPage allows overwriting when explicitly enabled", async () => {
  await resetWorld("page-creation-overwrite-world");
  await createPage("page-creation-overwrite-world", {
    title: "Eldoria",
    content: "# Eldoria\nOld content\n"
  });

  const updatedPage = await createPage("page-creation-overwrite-world", {
    title: "Eldoria",
    content: "# Eldoria\nUpdated content\n",
    allowOverwrite: true
  });

  assert.equal(updatedPage.content, "# Eldoria\nUpdated content\n");
});

test("GET /pages accepts POST to create a page", async () => {
  await resetWorld("route-page-creation-world");
  const body = JSON.stringify({
    world: "route-page-creation-world",
    title: "Northern Empire",
    content: "# Northern Empire\nLore\n"
  });

  const result = {
    statusCode: null,
    headers: null,
    body: null
  };

  const request = {
    method: "POST",
    url: "/pages",
    on(event, handler) {
      if (event === "data") {
        handler(body);
      }
      if (event === "end") {
        handler();
      }
      if (event === "error") {
        this.errorHandler = handler;
      }
    }
  };

  const response = {
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers;
    },
    end(payload) {
      result.body = JSON.parse(payload);
    }
  };

  await router(request, response);

  assert.equal(result.statusCode, 201);
  assert.equal(result.body.slug, "northern-empire");
  assert.equal(result.body.content, "# Northern Empire\nLore\n");
});

test("updatePage replaces page content safely", async () => {
  const worldName = "page-update-world";
  await resetWorld(worldName);

  await createPage(worldName, {
    title: "Eldoria",
    content: "# Eldoria\nOld content\n"
  });

  const updatedPage = await updatePage(worldName, "eldoria", {
    content: "# Eldoria\nUpdated content\n"
  });

  assert.equal(updatedPage.title, "Eldoria");
  assert.equal(updatedPage.content, "# Eldoria\nUpdated content\n");
});

test("updatePage returns not found when the page does not exist", async () => {
  const worldName = "page-update-missing-world";
  await resetWorld(worldName);

  await assert.rejects(
    () => updatePage(worldName, "unknown-page", { content: "# Missing\n" }),
    { code: "PAGE_NOT_FOUND" }
  );
});

test("PUT /pages/:id updates a page payload", async () => {
  const worldName = "route-page-update-world";
  await resetWorld(worldName);

  await createPage(worldName, {
    title: "Eldoria",
    content: "# Eldoria\nOriginal\n"
  });

  const body = JSON.stringify({
    content: "# Eldoria\nChanged\n"
  });

  const result = {
    statusCode: null,
    headers: null,
    body: null
  };

  const request = {
    method: "PUT",
    url: "/pages/eldoria?world=route-page-update-world",
    on(event, handler) {
      if (event === "data") {
        handler(body);
      }
      if (event === "end") {
        handler();
      }
      if (event === "error") {
        this.errorHandler = handler;
      }
    }
  };

  const response = {
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers;
    },
    end(payload) {
      result.body = JSON.parse(payload);
    }
  };

  await router(request, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.slug, "eldoria");
  assert.equal(result.body.content, "# Eldoria\nChanged\n");
});
