const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ensureWorldStructure,
  getWorldsRoot,
  resolveWorldRoot,
  validateRelativePath,
  validateWorldName
} = require("../data/filesystem");
const { indexWorld, removeWorldFromIndex } = require("./indexer");
const { getFileTree } = require("./tree");
const { getUserById } = require("./users");
const { listThemePresets } = require("./themePresets");
const { isGlobalAdmin } = require("../utils/roles");

const THUMBNAIL_TYPES = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

const WORLD_MEMBER_ROLES = new Set(["member", "admin"]);
const WORLD_THEMES = new Set(["default", "ember-archive", "vampire-masquerade"]);
const CUSTOM_THEME_COLOR_KEYS = new Set([
  "background",
  "surface",
  "text",
  "mutedText",
  "accent",
  "secondaryAccent"
]);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeWorldMemberRole(role) {
  return WORLD_MEMBER_ROLES.has(role) ? role : "member";
}

function normalizeWorldMember(member) {
  return {
    ...member,
    role: normalizeWorldMemberRole(member?.role)
  };
}

function isWorldMemberConfig(worldData, userId) {
  return Array.isArray(worldData?.members) && worldData.members.some((member) => member.userId === userId);
}

function isWorldAdminConfig(worldData, userId) {
  return Array.isArray(worldData?.members) && worldData.members.some((member) => (
    member.userId === userId && normalizeWorldMemberRole(member.role) === "admin"
  ));
}

function normalizePublicRead(value) {
  return value === true;
}

function normalizeWorldTheme(value) {
  return WORLD_THEMES.has(value) ? value : "ember-archive";
}

function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) return null;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

function normalizeCustomTheme(value) {
  if (!value || typeof value !== "object") return null;
  const inputColors = value.colors;
  if (!inputColors || typeof inputColors !== "object" || Array.isArray(inputColors)) return null;

  const colors = {};
  for (const [key, color] of Object.entries(inputColors)) {
    if (!CUSTOM_THEME_COLOR_KEYS.has(key)) continue;
    const normalizedColor = normalizeHexColor(color);
    if (normalizedColor) colors[key] = normalizedColor;
  }

  if (Object.keys(colors).length === 0) return null;

  const presetId = typeof value.preset?.id === "string" ? value.preset.id.trim() : "";
  const presetName = typeof value.preset?.name === "string" ? value.preset.name.trim() : "";
  const preset = presetId && presetName && presetName.length <= 60
    ? { id: presetId, name: presetName }
    : null;

  return {
    colors,
    ...(preset ? { preset } : {})
  };
}

function resolveWorldThemePreset(world, presets = []) {
  if (!world?.customTheme?.colors || world.customTheme.preset) return world;
  const matchingPreset = presets.find((preset) => (
    preset.baseTheme === world.theme &&
    [...CUSTOM_THEME_COLOR_KEYS].every((key) => (
      typeof world.customTheme.colors[key] === "string" &&
      world.customTheme.colors[key].toLowerCase() === preset.colors?.[key]?.toLowerCase()
    ))
  ));
  if (!matchingPreset) return world;

  return {
    ...world,
    customTheme: {
      ...world.customTheme,
      preset: {
        id: matchingPreset.id,
        name: matchingPreset.name
      }
    }
  };
}

async function readWorldConfigById(worldId) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  const configPath = path.join(worldRoot, "world.json");

  try {
    const configContent = await fs.readFile(configPath, "utf-8");
    return JSON.parse(configContent);
  } catch {
    const error = new Error("World not found");
    error.code = "WORLD_NOT_FOUND";
    throw error;
  }
}

async function writeWorldConfig(worldId, worldData) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  const configPath = path.join(worldRoot, "world.json");
  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
}

function getThumbnailContentType(filename = "") {
  return THUMBNAIL_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

async function listWorlds(user = null) {
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
    
    const visibleWorlds = user && !isGlobalAdmin(user)
      ? worlds.filter((world) => isWorldMemberConfig(world, user.userId))
      : worlds;

    const presets = await listThemePresets().catch(() => []);
    const resolvedWorlds = visibleWorlds.map((world) => resolveWorldThemePreset(world, presets));

    resolvedWorlds.sort((a, b) => {
      const timeA = Number(a.createdAt) || 0;
      const timeB = Number(b.createdAt) || 0;
      return timeB - timeA;
    });
    return resolvedWorlds;
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
    createdAt: Date.now(),
    theme: normalizeWorldTheme(data.theme),
    customTheme: normalizeCustomTheme(data.customTheme),
    publicRead: normalizePublicRead(data.publicRead),
    members: []
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
  if (Object.prototype.hasOwnProperty.call(data, "theme")) {
    worldData.theme = normalizeWorldTheme(data.theme);
  }
  if (Object.prototype.hasOwnProperty.call(data, "customTheme")) {
    worldData.customTheme = normalizeCustomTheme(data.customTheme);
  }
  if (Object.prototype.hasOwnProperty.call(data, "publicRead")) {
    worldData.publicRead = normalizePublicRead(data.publicRead);
  }

  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  return worldData;
}

async function saveWorldThumbnail(worldId, filename, buffer) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  const ext = path.extname(String(filename || "")).toLowerCase();
  if (!THUMBNAIL_TYPES[ext]) {
    const error = new Error("Unsupported thumbnail file type");
    error.code = "INVALID_THUMBNAIL";
    throw error;
  }

  const worldData = await readWorldConfigById(safeId);
  const thumbnailFile = `thumbnail${ext}`;
  await fs.writeFile(path.join(worldRoot, thumbnailFile), buffer);
  worldData.thumbnail = {
    filename: thumbnailFile,
    updatedAt: Date.now()
  };
  await writeWorldConfig(safeId, worldData);
  return worldData;
}

async function getWorldThumbnail(worldId) {
  const safeId = validateWorldName(worldId);
  const worldRoot = resolveWorldRoot(safeId);
  const worldData = await readWorldConfigById(safeId);
  const filename = worldData.thumbnail?.filename;
  if (!filename) {
    const error = new Error("Thumbnail not found");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  const fullPath = path.join(worldRoot, filename);
  await fs.stat(fullPath);
  return {
    fullPath,
    contentType: getThumbnailContentType(filename)
  };
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

async function isWorldMember(worldId, userId) {
  const worldData = await getWorldConfig(worldId);
  return isWorldMemberConfig(worldData, userId);
}

async function isWorldAdmin(worldId, userId) {
  const worldData = await getWorldConfig(worldId);
  return isWorldAdminConfig(worldData, userId);
}

async function getWorldRole(worldId, user = null) {
  if (isGlobalAdmin(user)) return "global-admin";
  if (!user?.userId) return "none";

  const worldData = await getWorldConfig(worldId);
  if (isWorldAdminConfig(worldData, user.userId)) return "world-admin";
  if (isWorldMemberConfig(worldData, user.userId)) return "member";
  return "none";
}

async function isWorldPublicReadable(worldId) {
  const worldData = await getWorldConfig(worldId);
  return normalizePublicRead(worldData.publicRead);
}

async function listWorldMembers(worldId) {
  const worldData = await getWorldConfig(worldId);
  const members = Array.isArray(worldData.members) ? worldData.members : [];
  const detailedMembers = await Promise.all(
    members.map(async (member) => {
      const user = await getUserById(member.userId);
      return user ? { ...normalizeWorldMember(member), user } : null;
    })
  );
  return detailedMembers.filter(Boolean);
}

async function listUserWorldAccess(userId) {
  const worlds = await listWorlds({ userId: "root", username: "root", globalRole: "root" });
  return Promise.all(worlds.map(async (world) => {
    const worldData = await getWorldConfig(world.id);
    const member = Array.isArray(worldData.members)
      ? worldData.members.find((item) => item.userId === userId)
      : null;
    return {
      id: world.id,
      name: world.name,
      displayName: world.displayName,
      role: member ? normalizeWorldMemberRole(member.role) : "none"
    };
  }));
}

async function getWorldAccessCounts() {
  const worlds = await listWorlds({ userId: "root", username: "root", globalRole: "root" });
  const counts = {};
  await Promise.all(worlds.map(async (world) => {
    const worldData = await getWorldConfig(world.id);
    for (const member of Array.isArray(worldData.members) ? worldData.members : []) {
      counts[member.userId] = (counts[member.userId] || 0) + 1;
    }
  }));
  return counts;
}

async function addWorldMember(worldId, userId, role = "member") {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const worldData = await readWorldConfigById(worldId);
  const members = Array.isArray(worldData.members) ? worldData.members : [];
  const nextRole = normalizeWorldMemberRole(role);
  const existingMember = members.find((member) => member.userId === userId);
  if (existingMember) {
    existingMember.role = nextRole;
  } else {
    members.push({ userId, role: nextRole, addedAt: Date.now() });
  }
  worldData.members = members;
  await writeWorldConfig(worldId, worldData);
  return listWorldMembers(worldId);
}

async function updateWorldMemberRole(worldId, userId, role) {
  const worldData = await readWorldConfigById(worldId);
  const members = Array.isArray(worldData.members) ? worldData.members : [];
  const member = members.find((item) => item.userId === userId);
  if (!member) {
    const error = new Error("User not found");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  member.role = normalizeWorldMemberRole(role);
  worldData.members = members;
  await writeWorldConfig(worldId, worldData);
  return listWorldMembers(worldId);
}

async function removeWorldMember(worldId, userId) {
  const worldData = await readWorldConfigById(worldId);
  const members = Array.isArray(worldData.members) ? worldData.members : [];
  worldData.members = members.filter((member) => member.userId !== userId);
  await writeWorldConfig(worldId, worldData);
  return listWorldMembers(worldId);
}

async function removeUserFromAllWorlds(userId) {
  const worlds = await listWorlds({ userId: "root", username: "root", globalRole: "root" });
  await Promise.all(
    worlds.map(async (world) => {
      const worldData = await readWorldConfigById(world.id);
      const members = Array.isArray(worldData.members) ? worldData.members : [];
      const nextMembers = members.filter((member) => member.userId !== userId);
      if (nextMembers.length !== members.length) {
        worldData.members = nextMembers;
        await writeWorldConfig(world.id, worldData);
      }
    })
  );
  return { success: true };
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

  if (homePagePath === null || homePagePath === undefined || homePagePath === "") {
    worldData.homePage = null;
    await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
    return worldData;
  }

  const safeHomePagePath = validateRelativePath(homePagePath);
  if (safeHomePagePath.includes("/")) {
    const error = new Error("Home page must be a root document");
    error.code = "INVALID_HOME_PAGE";
    throw error;
  }

  const tree = await getFileTree(safeId);
  const homeNode = tree.find((node) => node.path === safeHomePagePath);
  if (!homeNode || homeNode.type !== "container") {
    const error = new Error("Home page must be an existing root document");
    error.code = "INVALID_HOME_PAGE";
    throw error;
  }

  worldData.homePage = safeHomePagePath;
  await fs.writeFile(configPath, JSON.stringify(worldData, null, 2), "utf-8");
  return worldData;
}

module.exports = {
  listWorlds,
  createWorld,
  updateWorld,
  deleteWorld,
  getWorldThumbnail,
  getWorldConfig,
  isWorldMember,
  isWorldAdmin,
  getWorldRole,
  getWorldAccessCounts,
  isWorldPublicReadable,
  listWorldMembers,
  listUserWorldAccess,
  addWorldMember,
  updateWorldMemberRole,
  removeWorldMember,
  removeUserFromAllWorlds,
  saveWorldThumbnail,
  setHomePage,
  resolveWorldThemePreset
};
