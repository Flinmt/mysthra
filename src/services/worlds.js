const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const {
  ensureWorldStructure,
  getWorldsRoot,
  resolveWorldRoot,
  validateWorldName
} = require("../data/filesystem");

const SUPPORTED_THUMBNAIL_TYPES = new Set(["gif", "jpeg", "jpg", "png", "webp"]);
const THUMBNAIL_FILE_NAME = "thumbnail.webp";

function createThumbnailError(message) {
  const error = new Error(message);
  error.code = "INVALID_THUMBNAIL";
  return error;
}

function getThumbnailUrl(worldName, thumbnailUpdatedAt) {
  return `/api/worlds/${encodeURIComponent(worldName)}/thumbnail?v=${encodeURIComponent(thumbnailUpdatedAt)}`;
}

function getNextThumbnailTimestamp(currentTimestamp) {
  const current = Number(currentTimestamp) || 0;
  const now = Date.now();
  return now > current ? now : current + 1;
}

function parseThumbnailBase64(thumbnailBase64) {
  if (typeof thumbnailBase64 !== "string" || thumbnailBase64.trim() === "") {
    return null;
  }

  const match = thumbnailBase64.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw createThumbnailError("Thumbnail must be a base64 image data URL");
  }

  const imageType = match[1].toLowerCase();
  if (!SUPPORTED_THUMBNAIL_TYPES.has(imageType)) {
    throw createThumbnailError("Thumbnail image type is not supported");
  }

  const base64Data = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    throw createThumbnailError("Thumbnail image is empty");
  }
  return buffer;
}

async function writeThumbnail(worldPaths, thumbnailBase64) {
  const input = parseThumbnailBase64(thumbnailBase64);
  if (!input) {
    return null;
  }

  const filePath = path.join(worldPaths.media, THUMBNAIL_FILE_NAME);
  try {
    await sharp(input, { animated: false, limitInputPixels: 20_000_000 })
      .webp({ quality: 82 })
      .toFile(filePath);
  } catch (error) {
    throw createThumbnailError("Thumbnail image could not be processed");
  }

  return filePath;
}

async function deleteExistingThumbnails(worldPaths) {
  const extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  await Promise.all(
    extensions.map((ext) =>
      fs.unlink(path.join(worldPaths.media, `thumbnail${ext}`)).catch(() => {})
    )
  );
}

async function listWorlds() {
  const worldsRoot = getWorldsRoot();
  try {
    await fs.mkdir(worldsRoot, { recursive: true });
    const entries = await fs.readdir(worldsRoot, { withFileTypes: true });
    
    const worlds = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const worldName = entry.name;
          const worldRoot = resolveWorldRoot(worldName);
          const configPath = path.join(worldRoot, "world.json");
          
          let metadata = { name: worldName, displayName: worldName, createdAt: Date.now() };
          try {
            const configContent = await fs.readFile(configPath, "utf-8");
            metadata = JSON.parse(configContent);
          } catch (e) {
            // No world.json found, use fallback
          }
          
          worlds.push({
            id: worldName,
            ...metadata
          });
        } catch (e) {
          // Invalid world folder, ignore
        }
      }
    }
    
    // Sort by creation date descending (newest first)
    worlds.sort((a, b) => {
      const timeA = Number(a.createdAt) || 0;
      const timeB = Number(b.createdAt) || 0;
      return timeB - timeA;
    });
    return worlds;
  } catch (error) {
    return [];
  }
}

async function createWorld(data) {
  const { name, description, thumbnailBase64 } = data;
  
  if (!name || typeof name !== "string") {
    const error = new Error("World name is required");
    error.code = "INVALID_WORLD_INPUT";
    throw error;
  }

  const safeName = validateWorldName(name);
  const worldPaths = await ensureWorldStructure(safeName);
  const worldRoot = worldPaths.worldRoot;
  
  const configPath = path.join(worldRoot, "world.json");
  let exists = false;
  try {
    await fs.stat(configPath);
    exists = true;
  } catch (e) {}

  if (exists) {
    const error = new Error("World already exists");
    error.code = "WORLD_ALREADY_EXISTS";
    throw error;
  }

  let thumbnailUrl = null;
  let thumbnailUpdatedAt = null;
  if (thumbnailBase64) {
    await writeThumbnail(worldPaths, thumbnailBase64);
    thumbnailUpdatedAt = getNextThumbnailTimestamp();
    thumbnailUrl = getThumbnailUrl(safeName, thumbnailUpdatedAt);
  }

  const worldData = {
    name: safeName,
    displayName: name,
    description: description || "",
    thumbnailUrl,
    thumbnailUpdatedAt,
    createdAt: Date.now()
  };

  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  return worldData;
}

async function getWorldThumbnail(worldName) {
  const safeName = validateWorldName(worldName);
  const worldPaths = await ensureWorldStructure(safeName);
  
  const extensions = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
  for (const ext of extensions) {
    const filePath = path.join(worldPaths.media, `thumbnail${ext}`);
    try {
      await fs.stat(filePath);
      return {
        path: filePath,
        mimeType: `image/${ext === ".jpg" ? "jpeg" : ext.substring(1)}`
      };
    } catch (e) {
      // try next
    }
  }
  
  const error = new Error("Thumbnail not found");
  error.code = "THUMBNAIL_NOT_FOUND";
  throw error;
}

async function updateWorld(worldId, data) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  
  const configPath = path.join(worldRoot, "world.json");
  let worldData;
  try {
    const configContent = await fs.readFile(configPath, "utf-8");
    worldData = JSON.parse(configContent);
  } catch (e) {
    const error = new Error("World not found");
    error.code = "WORLD_NOT_FOUND";
    throw error;
  }

  const { name, description, thumbnailBase64 } = data;

  if (name) {
    worldData.displayName = name;
  }
  if (description !== undefined) {
    worldData.description = description;
  }

  if (thumbnailBase64) {
    const worldPaths = await ensureWorldStructure(safeId);
    await deleteExistingThumbnails(worldPaths);
    await writeThumbnail(worldPaths, thumbnailBase64);
    worldData.thumbnailUpdatedAt = getNextThumbnailTimestamp(worldData.thumbnailUpdatedAt);
    worldData.thumbnailUrl = getThumbnailUrl(safeId, worldData.thumbnailUpdatedAt);
  }

  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  return worldData;
}

async function deleteWorld(worldId) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  
  try {
    await fs.stat(worldRoot);
    await fs.rm(worldRoot, { recursive: true, force: true });
    return { success: true };
  } catch (e) {
    const error = new Error("World not found");
    error.code = "WORLD_NOT_FOUND";
    throw error;
  }
}

module.exports = {
  listWorlds,
  createWorld,
  getNextThumbnailTimestamp,
  getThumbnailUrl,
  parseThumbnailBase64,
  updateWorld,
  deleteWorld,
  getWorldThumbnail,
  writeThumbnail
};
