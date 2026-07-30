const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { getWorldPaths, resolveWorldRoot, validateRelativePath, ensureWorldStructure, validateWorldName } = require("../data/filesystem");
const {
  broadcastWorldTreeUpdate,
  closeCollaborationRoom,
  copyCollaborationState,
  removeCollaborationState
} = require("./collaboration");
const { updateIndex, removeFromIndex } = require("./indexer");

const FILE_BACKED_TAB_CONTENT_TYPES = new Set(["markdown"]);
const COLLABORATIVE_TAB_CONTENT_TYPES = new Set(["wiki", "tiptap", "map", "markdown", "board"]);
function getTabContentType(metadata = {}) {
  return metadata.contentType || (metadata.type === "tab" ? "wiki" : null);
}

function isFileBackedTab(metadata = {}) {
  return metadata.type === "tab" && FILE_BACKED_TAB_CONTENT_TYPES.has(getTabContentType(metadata));
}

function isCollaborativeTab(metadata = {}) {
  return metadata.type === "tab" && COLLABORATIVE_TAB_CONTENT_TYPES.has(getTabContentType(metadata));
}

const UPDATABLE_DOCUMENT_METADATA_FIELDS = new Set([
  "icon",
  "permissions",
  "locked",
  "order",
  "coverPositionX",
  "coverPositionY",
  "coverCrop",
  "coverZoom",
  "coverCroppedArea",
  "documentCoverHidden",
  "wideContent"
]);

const DOCUMENT_ACCESS_LEVELS = ["none", "read", "write", "admin"];
const DOCUMENT_ACCESS_RANK = new Map(DOCUMENT_ACCESS_LEVELS.map((level, index) => [level, index]));

function normalizeDocumentAccessLevel(level) {
  return DOCUMENT_ACCESS_RANK.has(level) ? level : "none";
}

function hasDocumentAccessLevel(access, required) {
  return (DOCUMENT_ACCESS_RANK.get(access) || 0) >= (DOCUMENT_ACCESS_RANK.get(required) || 0);
}

function normalizeDocumentPermissions(permissions) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return null;
  const users = {};
  for (const [userId, access] of Object.entries(permissions.users || {})) {
    if (!userId) continue;
    let level = normalizeDocumentAccessLevel(access);
    if (userId === "visitor" && level !== "none") level = "read";
    users[userId] = level;
  }
  return {
    inherit: permissions.inherit !== false,
    users
  };
}

function getAncestorPaths(safePath) {
  const parts = safePath.split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

function createForbiddenError(message = "Forbidden") {
  const error = new Error(message);
  error.code = "FORBIDDEN";
  throw error;
}

async function getFileTree(worldName) {
  const safeName = validateWorldName(worldName);
  await ensureWorldStructure(safeName);
  
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  async function walk(dirPath, relativePath = "") {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return [];
    }
    
    const nodes = [];
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // ignore hidden
      
      if (entry.isDirectory()) {
        const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const fullDirPath = path.join(dirPath, entry.name);
        
        let metadata = {};
        try {
          const metaPath = path.join(fullDirPath, "metadata.json");
          const metaStr = await fs.readFile(metaPath, "utf-8");
          metadata = JSON.parse(metaStr);
        } catch (e) {
          // Meta doesn't exist or is invalid
        }

        // Se não tiver UID, gera um e salva (Garante consistência)
        if (!metadata.uid) {
          metadata.uid = crypto.randomUUID();
          await fs.writeFile(path.join(fullDirPath, "metadata.json"), JSON.stringify(metadata, null, 2));
          updateIndex(safeName, metadata.uid, currentRelativePath);
        }

        const children = await walk(fullDirPath, currentRelativePath);
        
        nodes.push({
          name: metadata.name || entry.name, // Prioriza o nome de exibição
          path: currentRelativePath,
          uid: metadata.uid,
          icon: metadata.icon || null,
          type: metadata.type || "container", 
          contentType: metadata.contentType || (metadata.type === "tab" ? "wiki" : null),
          metadata,
          children
        });
      }
    }
    
    nodes.sort((a, b) => {
      const orderA = a.metadata?.order ?? 999;
      const orderB = b.metadata?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    return nodes;
  }
  
  return walk(pagesDir);
}

async function getEffectiveDocumentPermissions(pagesDir, safePath) {
  const paths = getAncestorPaths(safePath);
  let users = {};
  let hasRules = false;

  for (const currentPath of paths) {
    const metadata = await readDocumentMetadata(pagesDir, currentPath);
    const permissions = normalizeDocumentPermissions(metadata.permissions);
    if (!permissions) continue;
    const nonVisitorEntries = Object.entries(permissions.users).filter(([k]) => k !== "visitor");
    if (nonVisitorEntries.length > 0) hasRules = true;
    if (!permissions.inherit) users = {};
    users = { ...users, ...permissions.users };
  }

  return { hasRules, users };
}

async function isDocumentLocked(worldName, docPath) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  await ensureWorldStructure(safeName);
  const { pages: pagesDir } = getWorldPaths(safeName);

  const ownMetadata = await readDocumentMetadata(pagesDir, safePath);
  if (ownMetadata.locked === true) return true;

  // Lock only propagates from a document to its direct tabs,
  // not to child documents or their tabs.
  if (ownMetadata.type === "tab") {
    const parts = safePath.split("/");
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join("/");
      const parentMetadata = await readDocumentMetadata(pagesDir, parentPath);
      if (parentMetadata.locked === true) return true;
    }
  }

  return false;
}

async function getDocumentAccess(worldName, docPath, user = null) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  await ensureWorldStructure(safeName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const metadata = await readDocumentMetadata(pagesDir, safePath);
  const { getWorldRole } = require("./worlds");
  const worldRole = await getWorldRole(safeName, user);

  if (worldRole === "global-admin" || worldRole === "world-admin") return "admin";
  if (user?.userId && metadata.ownerUserId === user.userId) return "admin";

  const effectivePermissions = await getEffectiveDocumentPermissions(pagesDir, safePath);
  if (user?.isVisitor) {
    const visitorAccess = effectivePermissions.users["visitor"];
    if (visitorAccess) return DOCUMENT_ACCESS_RANK.has(visitorAccess) && DOCUMENT_ACCESS_RANK.get(visitorAccess) >= DOCUMENT_ACCESS_RANK.get("read") ? "read" : "none";
    return effectivePermissions.hasRules ? "none" : "read";
  }

  if (user?.userId && Object.prototype.hasOwnProperty.call(effectivePermissions.users, user.userId)) {
    return normalizeDocumentAccessLevel(effectivePermissions.users[user.userId]);
  }

  if (effectivePermissions.hasRules) return "none";
  if (worldRole === "member") return "write";
  return "none";
}

async function assertDocumentAccess(worldName, docPath, user, requiredAccess) {
  const access = await getDocumentAccess(worldName, docPath, user);
  if (!hasDocumentAccessLevel(access, requiredAccess)) createForbiddenError();
  return access;
}

async function filterDocumentTreeByAccess(worldName, tree, user = null) {
  const filtered = [];
  for (const node of tree) {
    const children = await filterDocumentTreeByAccess(worldName, node.children || [], user);
    const access = await getDocumentAccess(worldName, node.path, user).catch(() => "none");
    if (hasDocumentAccessLevel(access, "read") || children.length > 0) {
      filtered.push({
        ...node,
        metadata: {
          ...node.metadata,
          currentUserAccess: access
        },
        children
      });
    }
  }
  return filtered;
}

async function getVisibleFileTree(worldName, user = null) {
  const tree = await getFileTree(worldName);
  return filterDocumentTreeByAccess(worldName, tree, user);
}

async function readDocumentMetadata(pagesDir, safePath) {
  const metaPath = path.join(pagesDir, safePath, "metadata.json");
  try {
    const metaStr = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(metaStr);
  } catch (e) {
    return {};
  }
}

async function writeDocumentMetadata(pagesDir, safePath, metadata) {
  const metaPath = path.join(pagesDir, safePath, "metadata.json");
  await fs.mkdir(path.dirname(metaPath), { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
}

function createInvalidDocumentPathError(message, value) {
  const error = new Error(message);
  error.code = "INVALID_PATH";
  error.value = value;
  return error;
}

function parseDocumentCreationPath(docPath) {
  if (typeof docPath !== "string" || docPath.trim() === "") {
    throw createInvalidDocumentPathError("Document path must be a non-empty string", docPath);
  }

  const normalized = docPath.replace(/\\/g, "/").trim();
  const segments = normalized.split("/").filter(Boolean);
  const displayName = segments.at(-1)?.trim();

  if (!displayName || displayName === "." || displayName === "..") {
    throw createInvalidDocumentPathError("Document name is invalid", docPath);
  }

  const parentSegments = segments.slice(0, -1);
  const parentPath = parentSegments.length ? validateRelativePath(parentSegments.join("/")) : "";

  return { parentPath, displayName };
}

async function createDocument(worldName, docPath, content, metadata = {}) {
  const safeName = validateWorldName(worldName);
  const { parentPath, displayName } = parseDocumentCreationPath(docPath);
  await ensureWorldStructure(safeName);
  const { pages: pagesDir } = getWorldPaths(safeName);

  const uid = metadata.uid || crypto.randomUUID();
  
  const safePath = (parentPath ? `${parentPath}/${uid}` : uid).replace(/\\/g, "/");
  const fullDirPath = path.join(pagesDir, safePath);
  
  await fs.mkdir(fullDirPath, { recursive: true });
  
  // Only source-based tabs persist editable content in index.md.
  if (isFileBackedTab(metadata)) {
    const indexPath = path.join(fullDirPath, "index.md");
    await fs.writeFile(indexPath, content || "", "utf-8");
  }

  const currentMeta = await readDocumentMetadata(pagesDir, safePath);
  
  // Ordem de criação
  let order = currentMeta.order;
  if (metadata.type === "tab" && order === undefined) {
    const parentDir = path.dirname(fullDirPath);
    try {
      const peers = await fs.readdir(parentDir);
      order = peers.length;
    } catch (e) {
      order = 1;
    }
  }

  const contentType = metadata.contentType || currentMeta.contentType || (metadata.type === "tab" ? "wiki" : null);
  const nextMeta = {
    ...currentMeta,
    ...metadata,
    name: metadata.name || displayName, // Salva o nome amigável aqui
    uid,
    order: order ?? 0,
    type: metadata.type || currentMeta.type || "container",
    contentType,
    ...(metadata.type === "tab" && (contentType === "map" || contentType === "board") && metadata.documentCoverHidden === undefined
      ? { documentCoverHidden: true }
      : {})
  };
  await writeDocumentMetadata(pagesDir, safePath, nextMeta);
  
  updateIndex(safeName, uid, safePath);
  await broadcastWorldTreeUpdate(safeName, { action: "create", path: safePath });
  
  return { success: true, path: safePath, uid, name: nextMeta.name };
}

async function createDocumentPlaceholder(worldName, docPath, metadata = {}) {
  return createDocument(worldName, docPath, "", metadata);
}

async function readDocument(worldName, docPath) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const indexPath = path.join(pagesDir, safePath, "index.md");
  try {
    const content = await fs.readFile(indexPath, "utf-8");
    return { path: safePath, content };
  } catch (e) {
    const error = new Error("Document content not found (This might be a container)");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }
}

async function updateDocumentContent(worldName, docPath, content) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const metadata = await readDocumentMetadata(pagesDir, safePath);

  if (metadata.type !== "tab") {
    const error = new Error("Only tab documents can store editable content");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  const indexPath = path.join(pagesDir, safePath, "index.md");
  await fs.writeFile(indexPath, content, "utf-8");
  return { success: true, path: safePath };
}

async function updateDocumentMetadata(worldName, docPath, metadata) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const nextMetadata = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (!UPDATABLE_DOCUMENT_METADATA_FIELDS.has(key)) {
      const error = new Error(`Document metadata field is not updatable: ${key}`);
      error.code = "INVALID_DOCUMENT_METADATA";
      throw error;
    }
    nextMetadata[key] = key === "permissions" && value !== null
      ? normalizeDocumentPermissions(value)
      : value;
  }
  
  const currentMeta = await readDocumentMetadata(pagesDir, safePath);
  const newMeta = { ...currentMeta, ...nextMetadata };
  await writeDocumentMetadata(pagesDir, safePath, newMeta);

  if (Object.prototype.hasOwnProperty.call(nextMetadata, "permissions")) {
    await closeCollaborativeTabsForPath(safeName, pagesDir, safePath);
  }
  await broadcastWorldTreeUpdate(safeName, { action: "metadata", path: safePath });
  
  return { success: true, metadata: newMeta };
}

async function collectDocumentMetadata(pagesDir, safePath) {
  const fullPath = path.join(pagesDir, safePath);
  const metadataEntries = [];

  async function walk(currentPath) {
    const metadata = await readDocumentMetadata(pagesDir, currentPath);
    metadataEntries.push(metadata);

    const currentFullPath = path.join(pagesDir, currentPath);
    const entries = await fs.readdir(currentFullPath, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      await walk(`${currentPath}/${entry.name}`);
    }
  }

  await fs.stat(fullPath);
  await walk(safePath);
  return metadataEntries;
}

async function collectDocumentMetadataWithPaths(pagesDir, safePath) {
  const fullPath = path.join(pagesDir, safePath);
  const entriesWithPaths = [];

  async function walk(currentPath) {
    const metadata = await readDocumentMetadata(pagesDir, currentPath);
    entriesWithPaths.push({ path: currentPath, metadata });

    const currentFullPath = path.join(pagesDir, currentPath);
    const entries = await fs.readdir(currentFullPath, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      await walk(`${currentPath}/${entry.name}`);
    }
  }

  await fs.stat(fullPath);
  await walk(safePath);
  return entriesWithPaths;
}

async function collectCollaborativeTabMetadata(pagesDir, safePath) {
  const entries = await collectDocumentMetadata(pagesDir, safePath);
  return entries.filter((metadata) => metadata?.uid && isCollaborativeTab(metadata));
}

async function closeCollaborativeTabsForPath(worldName, pagesDir, safePath) {
  const tabs = await collectCollaborativeTabMetadata(pagesDir, safePath).catch(() => []);
  for (const tab of tabs) {
    closeCollaborationRoom(worldName, tab.uid);
  }
}

async function deleteDocument(worldName, docPath) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullDirPath = path.join(pagesDir, safePath);
  
  try {
    const metadataEntries = await collectDocumentMetadata(pagesDir, safePath);
    for (const metadata of metadataEntries) {
      if (metadata?.uid && isCollaborativeTab(metadata)) {
        closeCollaborationRoom(safeName, metadata.uid);
      }
    }

    await fs.rm(fullDirPath, { recursive: true, force: true });
    
    for (const metadata of metadataEntries) {
      if (metadata.uid) {
        removeFromIndex(safeName, metadata.uid);
      }
      await removeCollaborationState(safeName, metadata);
    }

    await broadcastWorldTreeUpdate(safeName, { action: "delete", path: safePath });
    return { success: true };
  } catch (e) {
    throw new Error("Failed to delete document");
  }
}

async function renameDocument(worldName, docPath, newName) {
  const safeName = validateWorldName(worldName);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const safePath = validateRelativePath(docPath);

  const metadata = await readDocumentMetadata(pagesDir, safePath);
  metadata.name = newName;
  await writeDocumentMetadata(pagesDir, safePath, metadata);
  await broadcastWorldTreeUpdate(safeName, { action: "rename", path: safePath });
  
  return { success: true, path: safePath, name: newName, uid: metadata.uid };
}

async function moveDocument(worldName, sourcePath, targetParentPath = "") {
  const safeName = validateWorldName(worldName);
  const safeSource = validateRelativePath(sourcePath);
  const safeTargetParent = targetParentPath ? validateRelativePath(targetParentPath) : "";
  const { pages: pagesDir } = getWorldPaths(safeName);
  
  const fullSource = path.join(pagesDir, safeSource);
  
  try {
    const metadataEntries = await collectDocumentMetadataWithPaths(pagesDir, safeSource);
    const metadata = metadataEntries[0]?.metadata || {};
    if (metadata.type === "tab") {
      const error = new Error("Tabs cannot be moved directly");
      error.code = "INVALID_PATH";
      throw error;
    }

    if (metadata.type && metadata.type !== "container") {
      const error = new Error("Only container documents can be moved");
      error.code = "INVALID_PATH";
      throw error;
    }

    if (safeTargetParent) {
      if (safeTargetParent === safeSource || safeTargetParent.startsWith(`${safeSource}/`)) {
        const error = new Error("Document cannot be moved into itself or its descendants");
        error.code = "INVALID_PATH";
        throw error;
      }

      const targetParentMetadata = await readDocumentMetadata(pagesDir, safeTargetParent);
      if (targetParentMetadata.type !== "container") {
        const error = new Error("Document move target must be a container");
        error.code = "INVALID_PATH";
        throw error;
      }
    }

    const currentParent = path.dirname(safeSource) === "." ? "" : path.dirname(safeSource).replace(/\\/g, "/");
    if (currentParent === safeTargetParent) {
      const error = new Error("Document is already in the target container");
      error.code = "INVALID_PATH";
      throw error;
    }

    const targetPath = safeTargetParent ? `${safeTargetParent}/${path.basename(safeSource)}` : path.basename(safeSource);
    const fullTarget = path.join(pagesDir, targetPath);

    await fs.mkdir(path.dirname(fullTarget), { recursive: true });
    await fs.rename(fullSource, fullTarget);
    
    for (const entry of metadataEntries) {
      if (!entry.metadata.uid) continue;
      const nextPath = entry.path === safeSource
        ? targetPath
        : `${targetPath}/${entry.path.slice(safeSource.length + 1)}`;
      updateIndex(safeName, entry.metadata.uid, nextPath);
    }

    let homePage;
    const worldConfigPath = path.join(resolveWorldRoot(safeName), "world.json");
    try {
      const worldConfig = JSON.parse(await fs.readFile(worldConfigPath, "utf-8"));
      homePage = worldConfig.homePage ?? null;
      if (worldConfig.homePage === safeSource && safeTargetParent) {
        worldConfig.homePage = null;
        homePage = null;
        await fs.writeFile(worldConfigPath, JSON.stringify(worldConfig, null, 2), "utf-8");
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await broadcastWorldTreeUpdate(safeName, { action: "move", path: targetPath, previousPath: safeSource });
    
    return { success: true, previousPath: safeSource, path: targetPath, targetPath, uid: metadata.uid, homePage };
  } catch (e) {
    if (e.code === "ENOENT") {
      const error = new Error("Document not found");
      error.code = "DOCUMENT_NOT_FOUND";
      throw error;
    }
    if (e.code) throw e;
    const error = new Error("Failed to move document: " + e.message);
    error.code = "DOCUMENT_MOVE_FAILED";
    throw error;
  }
}

async function getUniqueSiblingName(pagesDir, parentPath, baseName) {
  const parentDir = parentPath ? path.join(pagesDir, parentPath) : pagesDir;
  const siblingNames = new Set();

  try {
    const entries = await fs.readdir(parentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const siblingPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      const metadata = await readDocumentMetadata(pagesDir, siblingPath);
      siblingNames.add(metadata.name || entry.name);
    }
  } catch (e) {
    // Missing parent will be handled by the caller when filesystem operations run.
  }

  if (!siblingNames.has(baseName)) return baseName;

  let suffix = 2;
  while (siblingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

async function copyDocumentDirectory(safeName, pagesDir, sourcePath, targetPath, options = {}) {
  const sourceDir = path.join(pagesDir, sourcePath);
  const targetDir = path.join(pagesDir, targetPath);
  const sourceMetadata = await readDocumentMetadata(pagesDir, sourcePath);
  const uid = path.basename(targetPath);
  const metadata = {
    ...sourceMetadata,
    ...(options.metadataOverrides || {}),
    uid,
    name: options.name || sourceMetadata.name || path.basename(targetPath)
  };

  await fs.mkdir(targetDir, { recursive: true });
  await writeDocumentMetadata(pagesDir, targetPath, metadata);
  await copyCollaborationState(safeName, sourceMetadata, metadata);
  updateIndex(safeName, uid, targetPath);

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "metadata.json" || entry.name.startsWith(".")) continue;

    const childSource = `${sourcePath}/${entry.name}`;
    const childTarget = `${targetPath}/${crypto.randomUUID()}`;

    if (entry.isDirectory()) {
      if (!options.includeChildren) continue;
      await copyDocumentDirectory(safeName, pagesDir, childSource, childTarget, {
        includeChildren: true,
        metadataOverrides: options.metadataOverrides
      });
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
    }
  }

  return { path: targetPath, uid, name: metadata.name };
}

async function duplicateDocument(worldName, docPath, options = {}) {
  const safeName = validateWorldName(worldName);
  const safePath = validateRelativePath(docPath);
  const { pages: pagesDir } = getWorldPaths(safeName);
  const sourceDir = path.join(pagesDir, safePath);

  try {
    const stat = await fs.stat(sourceDir);
    if (!stat.isDirectory()) {
      const error = new Error("Document not found");
      error.code = "DOCUMENT_NOT_FOUND";
      throw error;
    }
  } catch (error) {
    if (error.code === "DOCUMENT_NOT_FOUND") throw error;
    const notFound = new Error("Document not found");
    notFound.code = "DOCUMENT_NOT_FOUND";
    throw notFound;
  }

  const parentPath = path.dirname(safePath) === "." ? "" : path.dirname(safePath).replace(/\\/g, "/");
  const sourceMetadata = await readDocumentMetadata(pagesDir, safePath);
  const sourceName = sourceMetadata.name || path.basename(safePath);
  const copyName = await getUniqueSiblingName(pagesDir, parentPath, options.name || `${sourceName} Copy`);
  const targetUid = crypto.randomUUID();
  const targetPath = parentPath ? `${parentPath}/${targetUid}` : targetUid;
  const copied = await copyDocumentDirectory(safeName, pagesDir, safePath, targetPath, {
    includeChildren: Boolean(options.includeChildren),
    name: copyName,
    metadataOverrides: options.metadataOverrides
  });
  await broadcastWorldTreeUpdate(safeName, { action: "duplicate", path: targetPath, sourcePath: safePath });

  return { success: true, ...copied };
}

module.exports = {
  getFileTree,
  getVisibleFileTree,
  getDocumentAccess,
  assertDocumentAccess,
  hasDocumentAccessLevel,
  isDocumentLocked,
  createDocument,
  createDocumentPlaceholder,
  readDocument,
  updateDocumentContent,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument,
  duplicateDocument
};
