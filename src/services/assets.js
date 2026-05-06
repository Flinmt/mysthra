const fs = require("node:fs/promises");
const path = require("node:path");
const { assertPathInsideRoot, getWorldPaths, ensureWorldStructure, validateWorldName } = require("../data/filesystem");

const MIME_TYPES = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mp4": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webp": "image/webp"
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

function createInvalidPathError(message, value) {
  const error = new Error(message);
  error.code = "INVALID_PATH";
  error.value = value;
  return error;
}

function sanitizeAssetName(name, fallback = "asset") {
  const ext = path.extname(name || "").toLowerCase();
  const rawBase = ext ? path.basename(name, ext) : name;
  const base = String(rawBase || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 _.-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[ ._-]+|[ ._-]+$/g, "")
    .slice(0, 80) || fallback;

  return `${base}${ext}`;
}

function sanitizeFolderName(name) {
  if (String(name || "").includes("/") || String(name || "").includes("\\") || String(name || "").includes("..")) {
    throw createInvalidPathError("Folder name contains unsafe path characters", name);
  }
  const sanitized = sanitizeAssetName(name, "Folder").replace(/\.[A-Za-z0-9]+$/, "");
  if (!sanitized) return "Folder";
  return sanitized;
}

function validateAssetRelativePath(relativePath = "") {
  const normalized = String(relativePath || "").replace(/\\/g, "/").trim();
  if (!normalized) return "";
  if (normalized.includes("..")) {
    throw createInvalidPathError("Asset path contains unsafe directory traversal", relativePath);
  }

  const segments = normalized.split("/").filter(Boolean);
  for (const segment of segments) {
    const sanitized = sanitizeAssetName(segment, "asset");
    if (sanitized !== segment || segment === "." || segment === "..") {
      throw createInvalidPathError("Asset path contains unsupported characters in segment: " + segment, relativePath);
    }
  }

  return segments.join("/");
}

async function getAssetsRoot(worldName) {
  const safeName = validateWorldName(worldName);
  await ensureWorldStructure(safeName);
  const { assets } = getWorldPaths(safeName);
  return { safeName, assetsDir: assets };
}

async function resolveAssetPath(worldName, relativePath = "") {
  const { safeName, assetsDir } = await getAssetsRoot(worldName);
  const safePath = validateAssetRelativePath(relativePath);
  const fullPath = path.resolve(assetsDir, safePath);
  return { safeName, assetsDir, safePath, fullPath: assertPathInsideRoot(assetsDir, fullPath) };
}

function getAssetKind(filename) {
  const ext = path.extname(filename).toLowerCase();
  if ([".gif", ".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "image";
  if ([".m4a", ".mp3", ".mp4", ".ogg", ".wav"].includes(ext)) return "audio";
  return "file";
}

function getAssetContentType(filename) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

function createAssetNode(name, safePath, stat) {
  const isDirectory = stat.isDirectory();
  return {
    success: true,
    name,
    path: safePath,
    type: isDirectory ? "folder" : "file",
    mediaType: isDirectory ? undefined : getAssetKind(name),
    contentType: isDirectory ? undefined : getAssetContentType(name),
    size: isDirectory ? undefined : stat.size
  };
}

async function getUniquePath(directoryPath, filename) {
  const ext = path.extname(filename);
  const base = ext ? path.basename(filename, ext) : filename;
  let candidate = filename;
  let suffix = 2;

  while (true) {
    try {
      await fs.stat(path.join(directoryPath, candidate));
      candidate = `${base} ${suffix}${ext}`;
      suffix += 1;
    } catch (error) {
      if (error.code === "ENOENT") return candidate;
      throw error;
    }
  }
}

async function copyAssetDirectory(sourcePath, targetPath, includeChildren) {
  await fs.mkdir(targetPath, { recursive: true });
  if (!includeChildren) return;

  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const sourceEntryPath = path.join(sourcePath, entry.name);
    const targetEntryPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await copyAssetDirectory(sourceEntryPath, targetEntryPath, true);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(sourceEntryPath, targetEntryPath);
    }
  }
}

async function listAssets(worldName, relativePath = "") {
  const { assetsDir, safePath, fullPath } = await resolveAssetPath(worldName, relativePath);

  async function walk(directoryPath, basePath = "") {
    let entries;
    try {
      entries = await fs.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const nodes = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const itemPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const itemFullPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: itemPath,
          type: "folder",
          children: await walk(itemFullPath, itemPath)
        });
        continue;
      }

      if (entry.isFile()) {
        const stat = await fs.stat(itemFullPath);
        nodes.push({
          name: entry.name,
          path: itemPath,
          type: "file",
          mediaType: getAssetKind(entry.name),
          contentType: getAssetContentType(entry.name),
          size: stat.size
        });
      }
    }

    nodes.sort((left, right) => {
      if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

    return nodes;
  }

  const stat = await fs.stat(fullPath).catch(() => null);
  if (stat && !stat.isDirectory()) {
    throw createInvalidPathError("Asset path must point to a folder", safePath);
  }

  return {
    path: safePath,
    items: await walk(fullPath, path.relative(assetsDir, fullPath).replace(/\\/g, "/"))
  };
}

async function deleteAsset(worldName, assetPath) {
  const resolved = await resolveAssetPath(worldName, assetPath);
  const stat = await fs.stat(resolved.fullPath).catch(() => null);
  if (!stat) {
    const error = new Error("Asset not found");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  await fs.rm(resolved.fullPath, { recursive: true, force: true });
  return { success: true };
}

async function renameAsset(worldName, assetPath, newName) {
  const resolved = await resolveAssetPath(worldName, assetPath);
  const stat = await fs.stat(resolved.fullPath).catch(() => null);
  if (!stat) {
    const error = new Error("Asset not found");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  const parentPath = path.dirname(resolved.safePath) === "." ? "" : path.dirname(resolved.safePath).replace(/\\/g, "/");
  const parentFullPath = path.dirname(resolved.fullPath);
  const safeName = stat.isDirectory() ? sanitizeFolderName(newName) : sanitizeAssetName(newName);
  const uniqueName = await getUniquePath(parentFullPath, safeName);
  const nextPath = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
  const { fullPath } = await resolveAssetPath(worldName, nextPath);

  await fs.rename(resolved.fullPath, fullPath);
  return createAssetNode(uniqueName, nextPath, stat);
}

async function moveAsset(worldName, sourcePath, targetFolderPath = "") {
  const source = await resolveAssetPath(worldName, sourcePath);
  const targetFolder = await resolveAssetPath(worldName, targetFolderPath);
  const sourceStat = await fs.stat(source.fullPath).catch(() => null);
  if (!sourceStat) {
    const error = new Error("Asset not found");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  const targetStat = await fs.stat(targetFolder.fullPath).catch(() => null);
  if (!targetStat || !targetStat.isDirectory()) {
    throw createInvalidPathError("Asset move target must be an existing folder", targetFolderPath);
  }

  if (sourceStat.isDirectory()) {
    const normalizedSource = source.safePath;
    const normalizedTarget = targetFolder.safePath;
    if (normalizedTarget === normalizedSource || normalizedTarget.startsWith(`${normalizedSource}/`)) {
      throw createInvalidPathError("Asset folder cannot be moved into itself or its descendants", targetFolderPath);
    }
  }

  const sourceParentPath = path.dirname(source.safePath) === "." ? "" : path.dirname(source.safePath).replace(/\\/g, "/");
  if (sourceParentPath === targetFolder.safePath) {
    return createAssetNode(path.basename(source.safePath), source.safePath, sourceStat);
  }

  const name = path.basename(source.safePath);
  const uniqueName = await getUniquePath(targetFolder.fullPath, name);
  const movedPath = targetFolder.safePath ? `${targetFolder.safePath}/${uniqueName}` : uniqueName;
  const { fullPath } = await resolveAssetPath(worldName, movedPath);

  await fs.rename(source.fullPath, fullPath);
  const movedStat = await fs.stat(fullPath);
  return createAssetNode(uniqueName, movedPath, movedStat);
}

async function duplicateAsset(worldName, assetPath, options = {}) {
  const resolved = await resolveAssetPath(worldName, assetPath);
  const stat = await fs.stat(resolved.fullPath).catch(() => null);
  if (!stat) {
    const error = new Error("Asset not found");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  const parentPath = path.dirname(resolved.safePath) === "." ? "" : path.dirname(resolved.safePath).replace(/\\/g, "/");
  const parentFullPath = path.dirname(resolved.fullPath);
  const sourceName = path.basename(resolved.safePath);
  const ext = stat.isDirectory() ? "" : path.extname(sourceName);
  const base = ext ? path.basename(sourceName, ext) : sourceName;
  const requestedName = options.name || `${base} Copy${ext}`;
  const safeName = stat.isDirectory() ? sanitizeFolderName(requestedName) : sanitizeAssetName(requestedName);
  const uniqueName = await getUniquePath(parentFullPath, safeName);
  const targetPath = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
  const { fullPath: targetFullPath } = await resolveAssetPath(worldName, targetPath);

  if (stat.isDirectory()) {
    await copyAssetDirectory(resolved.fullPath, targetFullPath, Boolean(options.includeChildren));
    return { success: true, name: uniqueName, path: targetPath, type: "folder" };
  }

  await fs.copyFile(resolved.fullPath, targetFullPath);
  const copiedStat = await fs.stat(targetFullPath);
  return {
    success: true,
    name: uniqueName,
    path: targetPath,
    type: "file",
    mediaType: getAssetKind(uniqueName),
    contentType: getAssetContentType(uniqueName),
    size: copiedStat.size
  };
}

async function createAssetFolder(worldName, parentPath, folderName) {
  const { fullPath: parentFullPath, safePath: safeParentPath } = await resolveAssetPath(worldName, parentPath);
  const stat = await fs.stat(parentFullPath).catch(() => null);
  if (stat && !stat.isDirectory()) {
    throw createInvalidPathError("Asset folder parent must be a folder", parentPath);
  }

  await fs.mkdir(parentFullPath, { recursive: true });
  const safeName = await getUniquePath(parentFullPath, sanitizeFolderName(folderName));
  const folderPath = safeParentPath ? `${safeParentPath}/${safeName}` : safeName;
  const { fullPath } = await resolveAssetPath(worldName, folderPath);
  await fs.mkdir(fullPath, { recursive: true });
  return { success: true, name: safeName, path: folderPath, type: "folder" };
}

async function saveAssetFile(worldName, folderPath, filename, buffer) {
  const { fullPath: folderFullPath, safePath: safeFolderPath } = await resolveAssetPath(worldName, folderPath);
  if (String(filename || "").includes("/") || String(filename || "").includes("\\") || String(filename || "").includes("..")) {
    throw createInvalidPathError("Filename contains unsafe path characters", filename);
  }
  const sanitizedName = sanitizeAssetName(filename);
  const ext = path.extname(sanitizedName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw createInvalidPathError("Unsupported asset file type", filename);
  }

  await fs.mkdir(folderFullPath, { recursive: true });
  const uniqueName = await getUniquePath(folderFullPath, sanitizedName);
  const assetPath = safeFolderPath ? `${safeFolderPath}/${uniqueName}` : uniqueName;
  const { fullPath } = await resolveAssetPath(worldName, assetPath);
  await fs.writeFile(fullPath, buffer);

  const stat = await fs.stat(fullPath);
  return {
    success: true,
    name: uniqueName,
    path: assetPath,
    type: "file",
    mediaType: getAssetKind(uniqueName),
    contentType: getAssetContentType(uniqueName),
    size: stat.size
  };
}

async function getAssetFile(worldName, assetPath) {
  const resolved = await resolveAssetPath(worldName, assetPath);
  const stat = await fs.stat(resolved.fullPath).catch(() => null);
  if (!stat || !stat.isFile()) {
    const error = new Error("Asset file not found");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  return {
    fullPath: resolved.fullPath,
    contentType: getAssetContentType(resolved.safePath)
  };
}

module.exports = {
  createAssetFolder,
  deleteAsset,
  duplicateAsset,
  getAssetFile,
  listAssets,
  moveAsset,
  renameAsset,
  saveAssetFile,
  sanitizeAssetName,
  validateAssetRelativePath
};
