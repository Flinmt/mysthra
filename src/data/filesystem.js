const fs = require("node:fs/promises");
const path = require("node:path");

const WORLD_DIRECTORY_NAMES = Object.freeze({
  assets: "assets",
  pages: "pages"
});

const LEGACY_ASSETS_DIRECTORY_NAME = "Assets";

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
    assets: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.assets),
    pages: resolveWorldPath(worldName, WORLD_DIRECTORY_NAMES.pages)
  };
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

async function pathExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function getUniqueDestinationPath(directoryPath, entryName) {
  const ext = path.extname(entryName);
  const base = ext ? path.basename(entryName, ext) : entryName;
  let candidate = entryName;
  let suffix = 2;

  while (await pathExists(path.join(directoryPath, candidate))) {
    candidate = `${base} ${suffix}${ext}`;
    suffix += 1;
  }

  return path.join(directoryPath, candidate);
}

async function mergeDirectories(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    const targetStat = await fs.stat(targetPath).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (!targetStat) {
      await fs.rename(sourcePath, targetPath);
      continue;
    }

    if (entry.isDirectory() && targetStat.isDirectory()) {
      await mergeDirectories(sourcePath, targetPath);
      continue;
    }

    const uniqueTargetPath = await getUniqueDestinationPath(targetDir, entry.name);
    await fs.rename(sourcePath, uniqueTargetPath);
  }

  await fs.rm(sourceDir, { recursive: true, force: true });
}

async function migrateLegacyAssetsDirectory(worldRoot, assetsDir) {
  const legacyAssetsDir = path.join(worldRoot, LEGACY_ASSETS_DIRECTORY_NAME);
  if (legacyAssetsDir === assetsDir) return;

  const legacyExists = await pathExists(legacyAssetsDir);
  if (!legacyExists) return;

  const assetsExists = await pathExists(assetsDir);
  if (assetsExists) {
    const [legacyStat, assetsStat] = await Promise.all([
      fs.stat(legacyAssetsDir),
      fs.stat(assetsDir)
    ]);
    if (legacyStat.dev === assetsStat.dev && legacyStat.ino === assetsStat.ino) return;
  }

  if (!assetsExists) {
    await fs.rename(legacyAssetsDir, assetsDir);
    return;
  }

  await mergeDirectories(legacyAssetsDir, assetsDir);
}

async function ensureWorldStructure(worldName) {
  await ensureDirectory(getWorldsRoot());

  const worldPaths = getWorldPaths(worldName);
  await ensureDirectory(worldPaths.worldRoot);
  await migrateLegacyAssetsDirectory(worldPaths.worldRoot, worldPaths.assets);

  await Promise.all([worldPaths.assets, worldPaths.pages].map(ensureDirectory));

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
  resolveWorldPath,
  resolveWorldRoot,
  validateFileName,
  validateWorldName,
  validateRelativePath
};
