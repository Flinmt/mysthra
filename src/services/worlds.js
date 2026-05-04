const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ensureWorldStructure,
  getWorldsRoot,
  resolveWorldRoot,
  validateWorldName
} = require("../data/filesystem");
const { indexWorld, removeWorldFromIndex } = require("./indexer");

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
            // No world.json found
          }
          
          worlds.push({
            id: worldName,
            ...metadata
          });
        } catch (e) {
          // Invalid world folder
        }
      }
    }
    
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
  const { name, description } = data;
  
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

  const worldData = {
    name: safeName,
    displayName: name,
    description: description || "",
    createdAt: Date.now()
  };

  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  await indexWorld(safeName);
  return worldData;
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

  const { name, description } = data;

  if (name) worldData.displayName = name;
  if (description !== undefined) worldData.description = description;

  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  return worldData;
}

async function deleteWorld(worldId) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  
  try {
    await fs.stat(worldRoot);
    await fs.rm(worldRoot, { recursive: true, force: true });
    removeWorldFromIndex(safeId);
    return { success: true };
  } catch (e) {
    const error = new Error("World not found");
    error.code = "WORLD_NOT_FOUND";
    throw error;
  }
}

async function getWorldConfig(worldId) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  const configPath = path.join(worldRoot, "world.json");
  
  try {
    const configContent = await fs.readFile(configPath, "utf-8");
    return JSON.parse(configContent);
  } catch (e) {
    const error = new Error("World config not found");
    error.code = "CONFIG_NOT_FOUND";
    throw error;
  }
}

async function setHomePage(worldId, homePagePath) {
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

  worldData.homePage = homePagePath;
  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  return worldData;
}

module.exports = {
  listWorlds,
  createWorld,
  updateWorld,
  deleteWorld,
  getWorldConfig,
  setHomePage
};
