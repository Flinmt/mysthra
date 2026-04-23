const fs = require("node:fs/promises");
const path = require("node:path");

const WORLD_DIRECTORY_NAMES = Object.freeze({
  pages: "pages",
  entities: "entities",
  relations: "relations",
  themes: "themes",
  templates: "templates",
  media: "media"
});

function getDataRoot() {
  return path.resolve(process.cwd(), "data");
}

function getWorldsRoot() {
  return path.join(getDataRoot(), "worlds");
}

function resolveWorldRoot(worldName) {
  return path.resolve(getWorldsRoot(), worldName);
}

function getWorldPaths(worldName) {
  const worldRoot = resolveWorldRoot(worldName);

  return {
    worldRoot,
    pages: path.join(worldRoot, WORLD_DIRECTORY_NAMES.pages),
    entities: path.join(worldRoot, WORLD_DIRECTORY_NAMES.entities),
    relations: path.join(worldRoot, WORLD_DIRECTORY_NAMES.relations),
    themes: path.join(worldRoot, WORLD_DIRECTORY_NAMES.themes),
    templates: path.join(worldRoot, WORLD_DIRECTORY_NAMES.templates),
    media: path.join(worldRoot, WORLD_DIRECTORY_NAMES.media)
  };
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

async function ensureWorldStructure(worldName) {
  await ensureDirectory(getWorldsRoot());

  const worldPaths = getWorldPaths(worldName);
  const directories = Object.values(worldPaths);

  await Promise.all(directories.map(ensureDirectory));

  return worldPaths;
}

module.exports = {
  WORLD_DIRECTORY_NAMES,
  ensureDirectory,
  ensureWorldStructure,
  getDataRoot,
  getWorldPaths,
  getWorldsRoot,
  resolveWorldRoot
};
