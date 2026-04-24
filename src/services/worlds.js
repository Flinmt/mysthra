const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ensureWorldStructure,
  getWorldsRoot,
  resolveWorldRoot,
  validateWorldName
} = require("../data/filesystem");

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

  // Handle thumbnail image
  let thumbnailUrl = null;
  if (thumbnailBase64 && typeof thumbnailBase64 === "string") {
    // Extract base64 content
    const match = thumbnailBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (match) {
      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `thumbnail.${ext}`;
      const filePath = path.join(worldPaths.media, fileName);
      
      await fs.writeFile(filePath, buffer);
      // Construct URL to access this image via a future API endpoint or static serving
      // For now, we will just store the base64 string in the JSON to keep it extremely simple
      // and not have to write an image streaming endpoint yet.
      // Actually, storing a small base64 in JSON is fine for a thumbnail, but saving it as a file is better.
      // We will save it as a file and set the URL to `/api/worlds/${safeName}/thumbnail`
      thumbnailUrl = `/api/worlds/${safeName}/thumbnail`;
    }
  }

  const worldData = {
    name: safeName,
    displayName: name,
    description: description || "",
    thumbnailUrl,
    createdAt: Date.now()
  };

  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  return worldData;
}

async function getWorldThumbnail(worldName) {
  const safeName = validateWorldName(worldName);
  const worldPaths = await ensureWorldStructure(safeName);
  
  // Try to find thumbnail.png, thumbnail.jpg, etc.
  const extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
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

  if (thumbnailBase64 && typeof thumbnailBase64 === "string") {
    const match = thumbnailBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (match) {
      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `thumbnail.${ext}`;
      const worldPaths = await ensureWorldStructure(safeId);
      const filePath = path.join(worldPaths.media, fileName);
      
      await fs.writeFile(filePath, buffer);
      worldData.thumbnailUrl = `/api/worlds/${safeId}/thumbnail`;
    }
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
  updateWorld,
  deleteWorld,
  getWorldThumbnail
};
