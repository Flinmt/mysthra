const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureWorldStructure, getWorldPaths, resolveWorldPath, validateFileName } = require("../data");

function getThemeSelectionFilePath(worldName) {
  const worldPaths = getWorldPaths(worldName);
  return path.join(worldPaths.themes, "active-theme.json");
}

function themeNameFromFile(fileName) {
  return path.basename(fileName, ".css");
}

function buildThemeFileName(themeName) {
  const safeThemeName = validateFileName(themeName);
  return `${safeThemeName}.css`;
}

function getThemeAssetPath(worldName, themeName) {
  const fileName = buildThemeFileName(themeName);
  return resolveWorldPath(worldName, "themes", fileName);
}

function getThemeAssetHref(worldName, themeName) {
  const fileName = buildThemeFileName(themeName);
  return `/themes/${encodeURIComponent(fileName)}?world=${encodeURIComponent(worldName)}`;
}

async function listThemes(worldName) {
  await ensureWorldStructure(worldName);

  const { themes: themesDirectory } = getWorldPaths(worldName);
  const entries = await fs.readdir(themesDirectory, { withFileTypes: true });
  const themeFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .sort((left, right) => left.name.localeCompare(right.name));

  return themeFiles.map((entry) => ({
    name: themeNameFromFile(entry.name),
    fileName: entry.name,
    filePath: path.join(themesDirectory, entry.name)
  }));
}

async function getActiveTheme(worldName) {
  await ensureWorldStructure(worldName);

  const selectionPath = getThemeSelectionFilePath(worldName);

  try {
    const content = await fs.readFile(selectionPath, "utf8");
    const selection = JSON.parse(content);
    return typeof selection.activeTheme === "string" ? selection.activeTheme : null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function setActiveTheme(worldName, themeName) {
  await ensureWorldStructure(worldName);

  const themes = await listThemes(worldName);
  const matchedTheme = themes.find((theme) => theme.name === themeName);

  if (!matchedTheme) {
    const error = new Error("Theme not found");
    error.code = "THEME_NOT_FOUND";
    error.value = themeName;
    throw error;
  }

  const selectionPath = getThemeSelectionFilePath(worldName);
  await fs.writeFile(
    selectionPath,
    JSON.stringify({ activeTheme: matchedTheme.name }, null, 2),
    "utf8"
  );

  return matchedTheme.name;
}

async function loadThemes(worldName) {
  const themes = await listThemes(worldName);
  const activeTheme = await getActiveTheme(worldName);

  return {
    activeTheme,
    items: themes
  };
}

async function readTheme(worldName, themeName) {
  await ensureWorldStructure(worldName);

  const fileName = buildThemeFileName(themeName);
  const filePath = getThemeAssetPath(worldName, themeName);

  try {
    const css = await fs.readFile(filePath, "utf8");

    return {
      name: themeNameFromFile(fileName),
      fileName,
      filePath,
      href: getThemeAssetHref(worldName, themeName),
      css
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFoundError = new Error("Theme not found");
      notFoundError.code = "THEME_NOT_FOUND";
      notFoundError.value = themeName;
      throw notFoundError;
    }

    throw error;
  }
}

async function getAppliedTheme(worldName) {
  const activeTheme = await getActiveTheme(worldName);

  if (!activeTheme) {
    return null;
  }

  return readTheme(worldName, activeTheme);
}

module.exports = {
  buildThemeFileName,
  getActiveTheme,
  getAppliedTheme,
  getThemeAssetHref,
  getThemeAssetPath,
  getThemeSelectionFilePath,
  listThemes,
  loadThemes,
  readTheme,
  setActiveTheme,
  themeNameFromFile
};
