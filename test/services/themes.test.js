const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { getWorldPaths, resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const {
  getActiveTheme,
  getThemeSelectionFilePath,
  listThemes,
  loadThemes,
  setActiveTheme,
  themeNameFromFile
} = require("../../src/services/themes");

async function resetWorld(worldName) {
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

test("themeNameFromFile removes the css extension", () => {
  assert.equal(themeNameFromFile("eldoria.css"), "eldoria");
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

test("GET /themes returns the theme list payload", async () => {
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

  await router({ method: "GET", url: "/themes?world=themes-route-world" }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.activeTheme, "eldoria");
  assert.equal(result.body.items.length, 1);
});
