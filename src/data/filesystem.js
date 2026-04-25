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

const SAFE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;

function createValidationError(message, value) {
  const error = new Error(message);
  error.code = "INVALID_PATH";
  error.value = value;
  return error;
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createValidationError(`${label} must be a non-empty string`, value);
  }
}

function assertSafeName(value, label) {
  assertNonEmptyString(value, label);

  const normalizedValue = value.trim();

  if (
    normalizedValue === "." ||
    normalizedValue === ".." ||
    normalizedValue.includes("/") ||
    normalizedValue.includes("\\") ||
    normalizedValue.includes("..")
  ) {
    throw createValidationError(`${label} contains unsafe path characters`, value);
  }

  if (!SAFE_NAME_PATTERN.test(normalizedValue)) {
    throw createValidationError(`${label} contains unsupported characters`, value);
  }

  return normalizedValue;
}

function validateWorldName(worldName) {
  return assertSafeName(worldName, "World name");
}

function validateFileName(fileName) {
  return assertSafeName(fileName, "File name");
}

function validateRelativePath(relativePath) {
  assertNonEmptyString(relativePath, "Relative path");
  const normalized = relativePath.replace(/\\/g, "/").trim();
  
  if (normalized.includes("..")) {
    throw createValidationError("Path contains unsafe directory traversal", relativePath);
  }
  
  const segments = normalized.split('/').filter(Boolean);
  for (const segment of segments) {
    if (!SAFE_NAME_PATTERN.test(segment)) {
      throw createValidationError("Path contains unsupported characters in segment: " + segment, relativePath);
    }
  }
  
  return segments.join("/");
}

function getDataRoot() {
  return path.resolve(process.cwd(), "data");
}

function getWorldsRoot() {
  return path.join(getDataRoot(), "worlds");
}

function getTemplatesRoot() {
  return path.join(getDataRoot(), "templates");
}

function assertPathInsideRoot(rootPath, targetPath) {
  const relativePath = path.relative(rootPath, targetPath);

  if (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  ) {
    return targetPath;
  }

  throw createValidationError("Resolved path escapes the allowed root", targetPath);
}

function resolveWorldRoot(worldName) {
  const safeWorldName = validateWorldName(worldName);
  const worldsRoot = getWorldsRoot();
  const worldRoot = path.resolve(worldsRoot, safeWorldName);

  return assertPathInsideRoot(worldsRoot, worldRoot);
}

function resolveWorldPath(worldName, ...segments) {
  const worldRoot = resolveWorldRoot(worldName);
  const safeSegments = segments.map((segment, index) =>
    validateFileName(segment, `Path segment ${index + 1}`)
  );
  const targetPath = path.resolve(worldRoot, ...safeSegments);

  return assertPathInsideRoot(worldRoot, targetPath);
}

function getWorldPaths(worldName) {
  const worldRoot = resolveWorldRoot(worldName);

  return {
    worldRoot,
    pages: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.pages),
    entities: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.entities),
    relations: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.relations),
    themes: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.themes),
    templates: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.templates),
    media: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.media)
  };
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

async function ensureWorldStructure(worldName) {
  await ensureDirectory(getWorldsRoot());
  await ensureDirectory(getTemplatesRoot());

  const worldPaths = getWorldPaths(worldName);
  const directories = Object.values(worldPaths);

  await Promise.all(directories.map(ensureDirectory));

  return worldPaths;
}

module.exports = {
  WORLD_DIRECTORY_NAMES,
  assertPathInsideRoot,
  createValidationError,
  ensureDirectory,
  ensureWorldStructure,
  getDataRoot,
  getWorldPaths,
  getWorldsRoot,
  getTemplatesRoot,
  resolveWorldPath,
  resolveWorldRoot,
  validateFileName,
  validateWorldName,
  validateRelativePath
};
