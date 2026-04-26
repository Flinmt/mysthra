const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { getWorldPaths, resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const { generateSessionToken } = require("../../src/utils/auth");
const {
  buildThemeFileName,
  getActiveTheme,
  getAppliedTheme,
  getThemeAssetHref,
  getThemeSelectionFilePath,
  listThemes,
  loadThemes,
  readTheme,
  resolveAppliedTheme,
  setActiveTheme,
  themeNameFromFile
} = require("../../src/services/themes");

const createdWorlds = new Set();

async function resetWorld(worldName) {
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

function createAuthenticatedHeaders() {
  return {
    cookie: `mysthra_session=${generateSessionToken()}`
  };
}

test("themeNameFromFile removes the css extension", () => {
  assert.equal(themeNameFromFile("eldoria.css"), "eldoria");
});

test("buildThemeFileName appends the css extension", () => {
  assert.equal(buildThemeFileName("eldoria"), "eldoria.css");
});

test("listThemes returns css themes for a world", async () => {
  const worldName = "themes-list-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });

  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body {}", "utf8");
  await fs.writeFile(path.join(worldPaths.themes, "northern.css"), "body {}", "utf8");
  await fs.writeFile(path.join(worldPaths.themes, "ignore.txt"), "noop", "utf8");

  const themes = await listThemes(worldName);

  assert.deepEqual(themes.map((theme) => theme.name), ["eldoria", "northern"]);
});

test("getActiveTheme returns null when no active theme is configured", async () => {
  const worldName = "themes-empty-active-world";
  await resetWorld(worldName);

  assert.equal(await getActiveTheme(worldName), null);
});

test("setActiveTheme stores the active theme selection", async () => {
  const worldName = "themes-set-active-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body {}", "utf8");

  const activeTheme = await setActiveTheme(worldName, "eldoria");
  const savedSelection = JSON.parse(
    await fs.readFile(getThemeSelectionFilePath(worldName), "utf8")
  );

  assert.equal(activeTheme, "eldoria");
  assert.deepEqual(savedSelection, { activeTheme: "eldoria" });
});

test("loadThemes returns the theme list and active selection", async () => {
  const worldName = "themes-load-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body {}", "utf8");
  await fs.writeFile(path.join(worldPaths.themes, "ashlands.css"), "body {}", "utf8");
  await setActiveTheme(worldName, "ashlands");

  const result = await loadThemes(worldName);

  assert.equal(result.activeTheme, "ashlands");
  assert.deepEqual(result.items.map((theme) => theme.name), ["ashlands", "eldoria"]);
});

test("readTheme returns the css content and asset reference", async () => {
  const worldName = "themes-read-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body {}", "utf8");

  const theme = await readTheme(worldName, "eldoria");

  assert.equal(theme.name, "eldoria");
  assert.equal(theme.fileName, "eldoria.css");
  assert.equal(theme.href, getThemeAssetHref(worldName, "eldoria"));
  assert.equal(theme.css, "body {}");
});

test("getAppliedTheme returns null when there is no active theme", async () => {
  const worldName = "themes-applied-empty-world";
  await resetWorld(worldName);

  assert.equal(await getAppliedTheme(worldName), null);
});

test("getAppliedTheme resolves the active theme details", async () => {
  const worldName = "themes-applied-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body { color: red; }", "utf8");
  await setActiveTheme(worldName, "eldoria");

  const theme = await getAppliedTheme(worldName);

  assert.equal(theme.name, "eldoria");
  assert.equal(theme.fileName, "eldoria.css");
  assert.equal(theme.css, "body { color: red; }");
});

test("resolveAppliedTheme prefers a page override over the active world theme", async () => {
  const worldName = "themes-resolve-override-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body { color: red; }", "utf8");
  await fs.writeFile(path.join(worldPaths.themes, "ashlands.css"), "body { color: orange; }", "utf8");
  await setActiveTheme(worldName, "eldoria");

  const result = await resolveAppliedTheme(worldName, "ashlands");

  assert.equal(result.source, "page");
  assert.equal(result.theme.name, "ashlands");
});

test("GET /api/themes returns the theme list payload", async () => {
  const worldName = "themes-route-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body {}", "utf8");
  await setActiveTheme(worldName, "eldoria");

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
    url: "/api/themes?world=themes-route-world",
    headers: createAuthenticatedHeaders()
  }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.activeTheme, "eldoria");
  assert.equal(result.body.items.length, 1);
});

test("GET /api/themes/:file returns the css asset content", async () => {
  const worldName = "themes-asset-route-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.themes, { recursive: true });
  await fs.writeFile(path.join(worldPaths.themes, "eldoria.css"), "body { color: black; }", "utf8");

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
      result.body = body;
    }
  };

  await router({
    method: "GET",
    url: "/api/themes/eldoria.css?world=themes-asset-route-world",
    headers: createAuthenticatedHeaders()
  }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Content-Type"], "text/css; charset=utf-8");
  assert.equal(result.body, "body { color: black; }");
});
