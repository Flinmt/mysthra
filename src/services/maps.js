const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  ensureWorldStructure,
  getWorldPaths,
  validateFileName,
  validateRelativePath,
  validateWorldName
} = require("../data");

function createMapError(message, code = "INVALID_MAP_INPUT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeSlugPart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeMapId(value) {
  const normalized = normalizeSlugPart(value);
  if (!normalized) {
    throw createMapError("Map id must contain valid characters");
  }
  return validateFileName(normalized);
}

function normalizeMapName(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createMapError("Map name is required");
  }
  return value.trim();
}

function normalizeImagePath(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createMapError("Map image path is required");
  }
  return validateRelativePath(value);
}

function normalizePinCoordinate(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw createMapError(`${label} must be a number between 0 and 1`);
  }
  return number;
}

function normalizePins(pins = []) {
  if (!Array.isArray(pins)) {
    throw createMapError("Map pins must be an array");
  }

  return pins.map((pin) => {
    const label = typeof pin?.label === "string" ? pin.label.trim() : "";
    if (!label) {
      throw createMapError("Pin label is required");
    }

    return {
      id: typeof pin.id === "string" && pin.id.trim() ? pin.id.trim() : crypto.randomUUID(),
      label,
      x: normalizePinCoordinate(pin.x, "Pin x"),
      y: normalizePinCoordinate(pin.y, "Pin y"),
      target: typeof pin.target === "string" ? pin.target.trim() : "",
      icon: typeof pin.icon === "string" && pin.icon.trim() ? pin.icon.trim() : "MapPin"
    };
  });
}

function normalizeMapDefinition(input, current = null, options = {}) {
  const now = Date.now();
  const name = input?.name !== undefined ? normalizeMapName(input.name) : current?.name;
  const id = current?.id || normalizeMapId(input?.id || name);

  if (!name) {
    throw createMapError("Map name is required");
  }

  const imagePath = input?.imagePath !== undefined
    ? normalizeImagePath(input.imagePath)
    : current?.imagePath;

  if (!imagePath) {
    throw createMapError("Map image path is required");
  }

  return {
    id,
    name,
    imagePath,
    pins: normalizePins(input?.pins !== undefined ? input.pins : current?.pins || []),
    createdAt: current?.createdAt || input?.createdAt || now,
    updatedAt: options.preserveUpdatedAt && input?.updatedAt ? input.updatedAt : now
  };
}

function getMapFilePath(worldName, mapIdOrPath) {
  const safeWorldName = validateWorldName(worldName);
  const safePath = validateRelativePath(mapIdOrPath);
  const { maps } = getWorldPaths(safeWorldName);
  return path.join(maps, `${safePath}.json`);
}

async function ensureMapsDirectory(worldName) {
  const safeWorldName = validateWorldName(worldName);
  await ensureWorldStructure(safeWorldName);
  const { maps } = getWorldPaths(safeWorldName);
  await fs.mkdir(maps, { recursive: true });
  return maps;
}

async function listMaps(worldName) {
  const root = await ensureMapsDirectory(worldName);

  async function walk(dirPath, relativePath = "") {
    let entries = [];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return [];
    }

    const nodes = [];
    for (const entry of entries) {
      const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        const children = await walk(path.join(dirPath, entry.name), currentRelativePath);
        nodes.push({
          name: entry.name,
          path: currentRelativePath,
          type: "folder",
          children
        });
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const mapId = path.basename(entry.name, ".json");
          const map = await readMap(worldName, currentRelativePath.replace(/\.json$/, ""));
          nodes.push({
            ...map,
            path: currentRelativePath,
            type: "map"
          });
        } catch (e) {
          // Skip invalid map files
        }
      }
    }

    return nodes.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return (a.name || a.id).localeCompare(b.name || b.id);
    });
  }

  return await walk(root);
}

async function createMapFolder(worldName, folderPath) {
  const root = await ensureMapsDirectory(worldName);
  const safePath = validateRelativePath(folderPath);
  const fullPath = path.join(root, safePath);
  
  await fs.mkdir(fullPath, { recursive: true });
  return { path: safePath, type: 'folder' };
}

async function readMap(worldName, mapId) {
  await ensureMapsDirectory(worldName);
  const filePath = getMapFilePath(worldName, mapId);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const storedMap = JSON.parse(content);
    return normalizeMapDefinition(storedMap, storedMap, { preserveUpdatedAt: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw createMapError("Map not found", "MAP_NOT_FOUND");
    }
    throw error;
  }
}

async function createMap(worldName, input) {
  await ensureMapsDirectory(worldName);
  const map = normalizeMapDefinition(input);
  const filePath = getMapFilePath(worldName, map.id);

  try {
    await fs.access(filePath);
    throw createMapError("Map already exists", "MAP_ALREADY_EXISTS");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(filePath, JSON.stringify(map, null, 2), "utf8");
  return map;
}

async function updateMap(worldName, mapId, input) {
  const current = await readMap(worldName, mapId);
  const nextMap = normalizeMapDefinition(input, current);
  const filePath = getMapFilePath(worldName, current.id);
  await fs.writeFile(filePath, JSON.stringify(nextMap, null, 2), "utf8");
  return nextMap;
}

async function deleteMap(worldName, mapIdOrPath) {
  const safeName = validateWorldName(worldName);
  const { maps: mapsDir } = getWorldPaths(safeName);
  const safePath = validateRelativePath(mapIdOrPath);
  
  // Try both with and without .json extension to support files and folders
  const fullPathWithExt = path.join(mapsDir, safePath.endsWith('.json') ? safePath : `${safePath}.json`);
  const fullPathNoExt = path.join(mapsDir, safePath);
  
  let stats;
  let finalPath;
  
  try {
    stats = await fs.stat(fullPathWithExt);
    finalPath = fullPathWithExt;
  } catch (e) {
    try {
      stats = await fs.stat(fullPathNoExt);
      finalPath = fullPathNoExt;
    } catch (e2) {
      throw createMapError("Map or folder not found", "MAP_NOT_FOUND");
    }
  }

  await fs.rm(finalPath, { recursive: true, force: true });
  return { success: true };
}

async function moveMap(worldName, sourcePath, targetPath) {
  const root = await ensureMapsDirectory(worldName);
  const safeSource = validateRelativePath(sourcePath.endsWith('.json') ? sourcePath : `${sourcePath}.json`);
  const safeTarget = validateRelativePath(targetPath.endsWith('.json') ? targetPath : `${targetPath}.json`);
  
  const fullSource = path.join(root, safeSource);
  const fullTarget = path.join(root, safeTarget);
  
  await fs.mkdir(path.dirname(fullTarget), { recursive: true });
  await fs.rename(fullSource, fullTarget);
  
  return { source: safeSource, target: safeTarget };
}

module.exports = {
  createMap,
  createMapFolder,
  deleteMap,
  getMapFilePath,
  listMaps,
  moveMap,
  normalizeMapDefinition,
  readMap,
  updateMap
};
