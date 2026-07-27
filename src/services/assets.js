const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const {
  assertPathInsideRoot,
  ensureWorldStructure,
  getWorldPaths,
  validateWorldName
} = require("../data/filesystem");
const {
  getAssetContentType,
  getAssetFormat,
  getAssetKind,
  validateAssetMedia
} = require("./mediaTypes");

const ASSET_CATALOG_VERSION = 3;
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ASSET_ACCESS_LEVELS = ["none", "read", "write", "admin"];
const ASSET_ACCESS_RANK = new Map(ASSET_ACCESS_LEVELS.map((level, index) => [level, index]));
const assetQueues = new Map();
const reconciledWorlds = new Set();

function createInvalidPathError(message, value) {
  const error = new Error(message);
  error.code = "INVALID_PATH";
  error.value = value;
  return error;
}

function createAssetNotFoundError() {
  const error = new Error("Asset not found");
  error.code = "ASSET_NOT_FOUND";
  return error;
}

function createForbiddenError(message = "Forbidden") {
  const error = new Error(message);
  error.code = "FORBIDDEN";
  return error;
}

function createPayloadTooLargeError(limitBytes) {
  const error = new Error(`Request body exceeds the ${limitBytes} byte limit`);
  error.code = "PAYLOAD_TOO_LARGE";
  error.limitBytes = limitBytes;
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
  return sanitized || "Folder";
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

function withAssetLock(worldName, operation) {
  const safeName = validateWorldName(worldName);
  const previous = assetQueues.get(safeName) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  assetQueues.set(safeName, current);
  return current.finally(() => {
    if (assetQueues.get(safeName) === current) assetQueues.delete(safeName);
  });
}

async function getAssetsRoot(worldName) {
  const safeName = validateWorldName(worldName);
  await ensureWorldStructure(safeName);
  const { assets, worldRoot } = getWorldPaths(safeName);
  return { safeName, assetsDir: assets, catalogPath: path.join(worldRoot, "assets.json") };
}

async function resolveAssetPath(worldName, relativePath = "") {
  const { safeName, assetsDir, catalogPath } = await getAssetsRoot(worldName);
  const safePath = validateAssetRelativePath(relativePath);
  const fullPath = path.resolve(assetsDir, safePath);
  return {
    safeName,
    assetsDir,
    catalogPath,
    safePath,
    fullPath: assertPathInsideRoot(assetsDir, fullPath)
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

async function hashFile(fullPath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fsSync.createReadStream(fullPath)) hash.update(chunk);
  return hash.digest("hex");
}

function normalizeAssetAccessLevel(level) {
  return ASSET_ACCESS_RANK.has(level) && level !== "admin" ? level : "none";
}

function normalizeAssetPermissions(permissions) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return { inherit: true, users: {} };
  }
  const users = {};
  for (const [userId, access] of Object.entries(permissions.users || {})) {
    if (!userId) continue;
    users[userId] = normalizeAssetAccessLevel(access);
  }
  const normalized = {
    inherit: permissions.inherit !== false,
    users
  };
  if (Object.prototype.hasOwnProperty.call(permissions, "worldMembers")) {
    normalized.worldMembers = normalizeAssetAccessLevel(permissions.worldMembers);
  }
  return normalized;
}

function normalizeCatalogItem(item) {
  return {
    ...item,
    ownerUserId: typeof item.ownerUserId === "string" && item.ownerUserId ? item.ownerUserId : null,
    permissions: normalizeAssetPermissions(item.permissions),
    type: item.type === "folder" ? "folder" : "file"
  };
}

function normalizeCatalog(rawCatalog) {
  if ([1, 2].includes(rawCatalog?.version) && Array.isArray(rawCatalog.items)) {
    rawCatalog = {
      version: ASSET_CATALOG_VERSION,
      revision: Number.isInteger(rawCatalog.revision) ? rawCatalog.revision : 0,
      items: rawCatalog.items.map((item) => normalizeCatalogItem({
        ...item,
        type: rawCatalog.version === 1 ? "file" : item.type
      })),
      trash: Array.isArray(rawCatalog.trash) ? rawCatalog.trash : []
    };
  }
  if (!rawCatalog || rawCatalog.version !== ASSET_CATALOG_VERSION || !Array.isArray(rawCatalog.items)) {
    const error = new Error("Asset catalog is invalid or uses an unsupported version");
    error.code = "INVALID_ASSET_CATALOG";
    throw error;
  }

  const ids = new Set();
  const paths = new Set();
  const items = [];
  for (const item of rawCatalog.items) {
    if (!item?.id || !item?.path || ids.has(item.id) || paths.has(item.path)) {
      const error = new Error("Asset catalog contains invalid or duplicate entries");
      error.code = "INVALID_ASSET_CATALOG";
      throw error;
    }
    try {
      const safePath = validateAssetRelativePath(item.path);
      ids.add(item.id);
      paths.add(safePath);
      items.push(normalizeCatalogItem({
        ...item,
        path: safePath,
      }));
    } catch (cause) {
      const error = new Error("Asset catalog contains an invalid path");
      error.code = "INVALID_ASSET_CATALOG";
      error.cause = cause;
      throw error;
    }
  }
  return {
    version: ASSET_CATALOG_VERSION,
    revision: Number.isInteger(rawCatalog.revision) ? rawCatalog.revision : 0,
    items,
    trash: Array.isArray(rawCatalog.trash)
      ? rawCatalog.trash.map((entry) => ({
          ...entry,
          deletedByUserId: typeof entry.deletedByUserId === "string" ? entry.deletedByUserId : null,
          items: Array.isArray(entry.items) ? entry.items.map(normalizeCatalogItem) : []
        }))
      : []
  };
}

async function readCatalog(catalogPath) {
  try {
    const rawCatalog = JSON.parse(await fs.readFile(catalogPath, "utf-8"));
    const catalog = normalizeCatalog(rawCatalog);
    if (rawCatalog?.version !== ASSET_CATALOG_VERSION) await writeCatalog(catalogPath, catalog);
    return catalog;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      const catalogError = new Error("Asset catalog contains invalid JSON");
      catalogError.code = "INVALID_ASSET_CATALOG";
      catalogError.cause = error;
      throw catalogError;
    }
    throw error;
  }
}

async function writeCatalog(catalogPath, catalog) {
  const temporaryPath = `${catalogPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(catalog, null, 2), "utf-8");
    await fs.rename(temporaryPath, catalogPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function scanAssetFiles(directoryPath, basePath = "") {
  const results = [];
  const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const itemPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const itemFullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const stat = await fs.stat(itemFullPath);
      results.push({ path: itemPath, fullPath: itemFullPath, stat, type: "folder" });
      results.push(...await scanAssetFiles(itemFullPath, itemPath));
    } else if (entry.isFile()) {
      const stat = await fs.stat(itemFullPath);
      results.push({ path: itemPath, fullPath: itemFullPath, stat, type: "file" });
    }
  }

  return results;
}

async function purgeExpiredTrash(assetsDir, catalog, now = Date.now()) {
  const expired = catalog.trash.filter((entry) => now - entry.deletedAt >= TRASH_RETENTION_MS);
  if (expired.length === 0) return { catalog, changed: false };
  await Promise.all(expired.map((entry) =>
    fs.rm(path.join(assetsDir, ".trash", entry.storageKey), { recursive: true, force: true })
  ));
  const expiredIds = new Set(expired.map((entry) => entry.id));
  return {
    catalog: {
      ...catalog,
      revision: catalog.revision + 1,
      trash: catalog.trash.filter((entry) => !expiredIds.has(entry.id))
    },
    changed: true
  };
}

async function reconcileCatalog(worldName, options = {}) {
  const { safeName, assetsDir, catalogPath } = await getAssetsRoot(worldName);
  const storedCatalog = await readCatalog(catalogPath);
  if (storedCatalog && reconciledWorlds.has(safeName) && options.force !== true) {
    const purged = await purgeExpiredTrash(assetsDir, storedCatalog);
    if (purged.changed) await writeCatalog(catalogPath, purged.catalog);
    return purged.catalog;
  }

  let catalog = storedCatalog || {
    version: ASSET_CATALOG_VERSION,
    revision: 0,
    items: [],
    trash: []
  };
  const purged = await purgeExpiredTrash(assetsDir, catalog);
  catalog = purged.catalog;
  const existingByPath = new Map(catalog.items.map((item) => [item.path, item]));
  const files = await scanAssetFiles(assetsDir);
  const nextItems = [];
  let changed = purged.changed || !storedCatalog || files.length !== catalog.items.length;

  for (const file of files) {
    const existing = existingByPath.get(file.path);
    const unchanged = file.type === "folder" || (existing
      && existing.size === file.stat.size
      && existing.mtimeMs === file.stat.mtimeMs
      && existing.sha256);
    const item = {
      id: existing?.id || crypto.randomUUID(),
      path: file.path,
      type: file.type,
      ownerUserId: existing?.ownerUserId || null,
      permissions: normalizeAssetPermissions(existing?.permissions),
      ...(file.type === "file" ? {
        mediaType: getAssetKind(file.path),
        contentType: getAssetContentType(file.path),
        size: file.stat.size
      } : {}),
      mtimeMs: file.stat.mtimeMs,
      ...(file.type === "file" ? {
        sha256: unchanged ? existing.sha256 : await hashFile(file.fullPath)
      } : {}),
      createdAt: existing?.createdAt || file.stat.birthtimeMs || file.stat.ctimeMs
    };
    nextItems.push(item);
    if (!unchanged || JSON.stringify(existing) !== JSON.stringify(item)) changed = true;
  }

  nextItems.sort((left, right) => left.path.localeCompare(right.path));
  const nextCatalog = {
    version: ASSET_CATALOG_VERSION,
    revision: catalog.revision + (storedCatalog && changed ? 1 : 0),
    items: nextItems,
    trash: catalog.trash
  };
  if (changed) await writeCatalog(catalogPath, nextCatalog);
  reconciledWorlds.add(safeName);
  return nextCatalog;
}

function getCatalogItemByPath(catalog, assetPath) {
  return catalog.items.find((item) => item.path === assetPath) || null;
}

function getAssetAncestorItems(catalog, assetPath) {
  const parts = assetPath.split("/").filter(Boolean);
  const paths = parts.map((_, index) => parts.slice(0, index + 1).join("/"));
  return paths.map((itemPath) => getCatalogItemByPath(catalog, itemPath)).filter(Boolean);
}

async function createAssetAccessContext(worldName, actor) {
  if (actor === undefined) {
    return { actor: null, isAdmin: true, isMember: true, isSystem: true, userId: null };
  }
  if (!actor?.userId) {
    return { actor, isAdmin: false, isMember: false, isSystem: false, userId: null };
  }
  const { getWorldRole } = require("./worlds");
  const role = await getWorldRole(worldName, actor);
  return {
    actor,
    isAdmin: role === "global-admin" || role === "world-admin",
    isMember: role === "global-admin" || role === "world-admin" || role === "member",
    isSystem: false,
    userId: actor.userId
  };
}

function getEffectiveAssetAccess(catalog, item, context) {
  if (context.isAdmin) return "admin";
  if (!context.isMember || !context.userId || !item) return "none";

  const ancestors = getAssetAncestorItems(catalog, item.path);
  if (ancestors.some((candidate) => candidate.ownerUserId === context.userId)) return "admin";

  let access = "none";
  for (const candidate of ancestors) {
    const permissions = normalizeAssetPermissions(candidate.permissions);
    if (!permissions.inherit) access = "none";
    const hasUserRule = Object.prototype.hasOwnProperty.call(permissions.users, context.userId);
    if (hasUserRule) {
      access = permissions.users[context.userId];
    } else if (Object.prototype.hasOwnProperty.call(permissions, "worldMembers")) {
      access = permissions.worldMembers;
    }
  }
  return access;
}

function hasAssetAccess(access, required) {
  return (ASSET_ACCESS_RANK.get(access) || 0) >= (ASSET_ACCESS_RANK.get(required) || 0);
}

function assertAssetAccess(catalog, item, context, required) {
  const access = getEffectiveAssetAccess(catalog, item, context);
  if (!hasAssetAccess(access, required)) throw createForbiddenError();
  return access;
}

function assertRootWrite(context) {
  if (!context.isMember) throw createForbiddenError();
  return "write";
}

function assertFolderAccess(catalog, folderPath, context, required) {
  if (!folderPath) {
    if (required === "read") {
      if (!context.isMember) throw createForbiddenError();
      return "read";
    }
    return assertRootWrite(context);
  }
  const item = getCatalogItemByPath(catalog, folderPath);
  if (!item) throw createAssetNotFoundError();
  if (item.type !== "folder") throw createInvalidPathError("Asset target must be a folder", folderPath);
  return assertAssetAccess(catalog, item, context, required);
}

function getActorOwnerUserId(context) {
  return context.userId || null;
}

function normalizeAssetReference(reference) {
  if (typeof reference === "string") return { path: reference };
  if (!reference || typeof reference !== "object") throw createInvalidPathError("Missing asset reference", reference);
  const id = String(reference.id || "").trim();
  const assetPath = String(reference.path || "").trim();
  if (id && assetPath) throw createInvalidPathError("Use either asset id or path, not both", reference);
  if (id) return { id };
  if (assetPath) return { path: assetPath };
  throw createInvalidPathError("Missing asset id or path", reference);
}

async function resolveAssetReference(worldName, reference, catalog) {
  const normalized = normalizeAssetReference(reference);
  if (normalized.id) {
    const item = catalog.items.find((entry) => entry.id === normalized.id);
    if (!item) throw createAssetNotFoundError();
    return resolveAssetPath(worldName, item.path);
  }
  return resolveAssetPath(worldName, normalized.path);
}

function createAssetNode(name, safePath, stat, catalog, context = null) {
  const isDirectory = stat.isDirectory();
  const item = getCatalogItemByPath(catalog, safePath);
  const currentUserAccess = context ? getEffectiveAssetAccess(catalog, item, context) : undefined;
  return {
    success: true,
    id: item?.id,
    name,
    path: safePath,
    type: isDirectory ? "folder" : "file",
    mediaType: isDirectory ? undefined : getAssetKind(name),
    contentType: isDirectory ? undefined : getAssetContentType(name),
    size: isDirectory ? undefined : stat.size,
    ownerUserId: item?.ownerUserId || null,
    permissions: context && currentUserAccess === "admin" ? normalizeAssetPermissions(item?.permissions) : undefined,
    currentUserAccess,
    canManagePermissions: currentUserAccess === "admin",
    revision: catalog.revision
  };
}

async function listAssetsUnlocked(worldName, relativePath = "", actor) {
  const catalog = await reconcileCatalog(worldName);
  const context = await createAssetAccessContext(worldName, actor);
  if (!context.isMember) throw createForbiddenError();
  const { assetsDir, safePath, fullPath } = await resolveAssetPath(worldName, relativePath);
  const stat = await fs.stat(fullPath).catch(() => null);
  if (stat && !stat.isDirectory()) {
    throw createInvalidPathError("Asset path must point to a folder", safePath);
  }

  async function walk(directoryPath, basePath = "") {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    const nodes = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const itemPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const itemFullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const catalogItem = getCatalogItemByPath(catalog, itemPath);
        const children = await walk(itemFullPath, itemPath);
        const currentUserAccess = getEffectiveAssetAccess(catalog, catalogItem, context);
        if (!hasAssetAccess(currentUserAccess, "read") && children.length === 0) continue;
        nodes.push({
          id: catalogItem?.id,
          name: entry.name,
          path: itemPath,
          type: "folder",
          ownerUserId: catalogItem?.ownerUserId || null,
          currentUserAccess,
          canManagePermissions: currentUserAccess === "admin",
          traversalOnly: !hasAssetAccess(currentUserAccess, "read"),
          children
        });
      } else if (entry.isFile()) {
        const itemStat = await fs.stat(itemFullPath);
        const catalogItem = getCatalogItemByPath(catalog, itemPath);
        if (!hasAssetAccess(getEffectiveAssetAccess(catalog, catalogItem, context), "read")) continue;
        const node = createAssetNode(entry.name, itemPath, itemStat, catalog, context);
        delete node.success;
        delete node.permissions;
        nodes.push(node);
      }
    }
    nodes.sort((left, right) => {
      if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
    return nodes;
  }

  const items = await walk(fullPath, path.relative(assetsDir, fullPath).replace(/\\/g, "/"));
  if (safePath) {
    const requestedFolder = getCatalogItemByPath(catalog, safePath);
    const requestedAccess = getEffectiveAssetAccess(catalog, requestedFolder, context);
    if (!hasAssetAccess(requestedAccess, "read") && items.length === 0) throw createForbiddenError();
  }
  return {
    path: safePath,
    revision: catalog.revision,
    items
  };
}

async function listAssets(worldName, relativePath = "", actor) {
  return withAssetLock(worldName, () => listAssetsUnlocked(worldName, relativePath, actor));
}

function replaceCatalogPathPrefix(catalog, oldPath, nextPath) {
  let changed = false;
  const items = catalog.items.map((item) => {
    if (item.path !== oldPath && !item.path.startsWith(`${oldPath}/`)) return item;
    changed = true;
    return { ...item, path: `${nextPath}${item.path.slice(oldPath.length)}` };
  });
  return { changed, catalog: { ...catalog, items } };
}

async function createAssetFolder(worldName, parentReference, folderName, actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    const {
      fullPath: parentFullPath,
      safePath: safeParentPath
    } = typeof parentReference === "object"
      ? await resolveAssetReference(worldName, parentReference, catalog)
      : await resolveAssetPath(worldName, parentReference);
    assertFolderAccess(catalog, safeParentPath, context, "write");
    const stat = await fs.stat(parentFullPath).catch(() => null);
    if (!stat?.isDirectory()) {
      throw createInvalidPathError("Asset folder parent must be an existing folder", parentReference);
    }

    const safeName = await getUniquePath(parentFullPath, sanitizeFolderName(folderName));
    const folderPath = safeParentPath ? `${safeParentPath}/${safeName}` : safeName;
    const { fullPath } = await resolveAssetPath(worldName, folderPath);
    await fs.mkdir(fullPath, { recursive: true });
    const folderStat = await fs.stat(fullPath);
    const item = {
      id: crypto.randomUUID(),
      path: folderPath,
      type: "folder",
      ownerUserId: getActorOwnerUserId(context),
      permissions: normalizeAssetPermissions(null),
      mtimeMs: folderStat.mtimeMs,
      createdAt: Date.now()
    };
    const nextCatalog = {
      ...catalog,
      revision: catalog.revision + 1,
      items: [...catalog.items, item].sort((left, right) => left.path.localeCompare(right.path))
    };
    await writeCatalog(path.join(getWorldPaths(worldName).worldRoot, "assets.json"), nextCatalog);
    return createAssetNode(safeName, folderPath, folderStat, nextCatalog, context);
  });
}

function normalizeRootItems(items) {
  return [...items]
    .sort((left, right) => left.path.length - right.path.length)
    .filter((item, index, roots) => !roots.slice(0, index).some((root) => (
      item.path.startsWith(`${root.path}/`)
    )));
}

function getTrashRecordAccess(catalog, record, context) {
  if (context.isAdmin) return "admin";
  if (context.userId && record.deletedByUserId === context.userId) return "write";
  const recordCatalog = {
    ...catalog,
    items: [...catalog.items, ...(record.items || [])]
  };
  const rootItem = record.items?.find((item) => item.id === record.rootItemId)
    || record.items?.find((item) => item.path === record.originalPath);
  return getEffectiveAssetAccess(recordCatalog, rootItem, context);
}

async function trashAssetsUnlocked(worldName, references, actor) {
  const catalog = await reconcileCatalog(worldName);
  const context = await createAssetAccessContext(worldName, actor);
  const resolvedItems = [];
  for (const reference of references) {
    const resolved = await resolveAssetReference(worldName, reference, catalog);
    const item = getCatalogItemByPath(catalog, resolved.safePath);
    if (!item) throw createAssetNotFoundError();
    assertAssetAccess(catalog, item, context, "write");
    resolvedItems.push({ item, resolved });
  }
  const roots = normalizeRootItems(resolvedItems.map((entry) => entry.item));
  const trashRoot = path.join(getWorldPaths(worldName).assets, ".trash");
  await fs.mkdir(trashRoot, { recursive: true });
  const records = [];
  let activeItems = catalog.items;

  for (const root of roots) {
    const resolved = await resolveAssetPath(worldName, root.path);
    const stat = await fs.stat(resolved.fullPath).catch(() => null);
    if (!stat) throw createAssetNotFoundError();
    const storageKey = crypto.randomUUID();
    const storageDir = path.join(trashRoot, storageKey);
    await fs.mkdir(storageDir, { recursive: true });
    await fs.rename(resolved.fullPath, path.join(storageDir, path.basename(root.path)));
    const affectedItems = activeItems.filter((item) => (
      item.path === root.path || item.path.startsWith(`${root.path}/`)
    ));
    activeItems = activeItems.filter((item) => !affectedItems.includes(item));
    records.push({
      id: crypto.randomUUID(),
      rootItemId: root.id,
      name: path.basename(root.path),
      type: root.type,
      mediaType: root.mediaType,
      contentType: root.contentType,
      size: root.size,
      originalPath: root.path,
      storageKey,
      deletedAt: Date.now(),
      deletedByUserId: context.userId,
      items: affectedItems
    });
  }

  const nextCatalog = {
    ...catalog,
    revision: catalog.revision + 1,
    items: activeItems,
    trash: [...catalog.trash, ...records]
  };
  await writeCatalog(path.join(getWorldPaths(worldName).worldRoot, "assets.json"), nextCatalog);
  return {
    success: true,
    items: records.map((record) => ({
      id: record.rootItemId,
      trashId: record.id,
      name: record.name,
      type: record.type,
      mediaType: record.mediaType,
      originalPath: record.originalPath,
      deletedAt: record.deletedAt
    })),
    revision: nextCatalog.revision
  };
}

async function trashAssets(worldName, references, actor) {
  const list = Array.isArray(references) ? references : [references];
  return withAssetLock(worldName, () => trashAssetsUnlocked(worldName, list, actor));
}

async function deleteAsset(worldName, reference, actor) {
  return trashAssets(worldName, [reference], actor);
}

function findTrashRecord(catalog, identifier) {
  return catalog.trash.find((entry) => (
    entry.id === identifier || entry.rootItemId === identifier
  )) || null;
}

async function listTrash(worldName, actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    if (!context.isMember) throw createForbiddenError();
    return {
      revision: catalog.revision,
      items: [...catalog.trash]
        .filter((entry) => hasAssetAccess(getTrashRecordAccess(catalog, entry, context), "read"))
        .sort((left, right) => right.deletedAt - left.deletedAt)
        .map((entry) => {
          const currentUserAccess = getTrashRecordAccess(catalog, entry, context);
          return {
            id: entry.rootItemId,
            trashId: entry.id,
            name: entry.name,
            type: entry.type,
            mediaType: entry.mediaType,
            contentType: entry.contentType,
            size: entry.size,
            originalPath: entry.originalPath,
            deletedAt: entry.deletedAt,
            expiresAt: entry.deletedAt + TRASH_RETENTION_MS,
            currentUserAccess,
            canManagePermissions: currentUserAccess === "admin"
          };
        })
    };
  });
}

async function restoreTrashItems(worldName, identifiers, actor) {
  return withAssetLock(worldName, async () => {
    let catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    const restored = [];
    for (const identifier of identifiers) {
      const record = findTrashRecord(catalog, identifier);
      if (!record) {
        restored.push({ id: identifier, error: "Trash item not found" });
        continue;
      }
      if (!hasAssetAccess(getTrashRecordAccess(catalog, record, context), "write")) {
        restored.push({ id: identifier, error: "Forbidden" });
        continue;
      }
      const originalParent = path.dirname(record.originalPath) === "."
        ? ""
        : path.dirname(record.originalPath).replace(/\\/g, "/");
      const parentResolved = await resolveAssetPath(worldName, originalParent);
      const parentStat = await fs.stat(parentResolved.fullPath).catch(() => null);
      const targetParent = parentStat?.isDirectory()
        ? parentResolved
        : await resolveAssetPath(worldName, "");
      assertFolderAccess(catalog, targetParent.safePath, context, "write");
      const uniqueName = await getUniquePath(targetParent.fullPath, record.name);
      const restoredPath = targetParent.safePath ? `${targetParent.safePath}/${uniqueName}` : uniqueName;
      const sourcePath = path.join(
        getWorldPaths(worldName).assets,
        ".trash",
        record.storageKey,
        record.name
      );
      const targetPath = path.join(targetParent.fullPath, uniqueName);
      await fs.rename(sourcePath, targetPath);
      await fs.rm(path.dirname(sourcePath), { recursive: true, force: true });
      const restoredItems = record.items.map((item) => ({
        ...item,
        path: `${restoredPath}${item.path.slice(record.originalPath.length)}`
      }));
      catalog = {
        ...catalog,
        items: [...catalog.items, ...restoredItems].sort((left, right) => left.path.localeCompare(right.path)),
        trash: catalog.trash.filter((entry) => entry.id !== record.id)
      };
      const rootItem = restoredItems.find((item) => item.id === record.rootItemId);
      restored.push({
        id: record.rootItemId,
        name: uniqueName,
        path: restoredPath,
        type: rootItem?.type || record.type,
        mediaType: rootItem?.mediaType || record.mediaType
      });
    }
    catalog.revision += 1;
    await writeCatalog(path.join(getWorldPaths(worldName).worldRoot, "assets.json"), catalog);
    return { items: restored, revision: catalog.revision };
  });
}

async function permanentlyDeleteTrashItems(worldName, identifiers, actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    const identifierSet = new Set(identifiers);
    const selected = catalog.trash.filter((entry) => (
      identifierSet.has(entry.id) || identifierSet.has(entry.rootItemId)
    ) && hasAssetAccess(getTrashRecordAccess(catalog, entry, context), "write"));
    await Promise.all(selected.map((entry) => fs.rm(
      path.join(getWorldPaths(worldName).assets, ".trash", entry.storageKey),
      { recursive: true, force: true }
    )));
    const selectedIds = new Set(selected.map((entry) => entry.id));
    const nextCatalog = {
      ...catalog,
      revision: catalog.revision + 1,
      trash: catalog.trash.filter((entry) => !selectedIds.has(entry.id))
    };
    await writeCatalog(path.join(getWorldPaths(worldName).worldRoot, "assets.json"), nextCatalog);
    return { success: true, deleted: selected.length, revision: nextCatalog.revision };
  });
}

async function emptyTrash(worldName, actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    if (!context.isMember) throw createForbiddenError();
    const selected = context.isAdmin
      ? catalog.trash
      : catalog.trash.filter((entry) => hasAssetAccess(getTrashRecordAccess(catalog, entry, context), "write"));
    await Promise.all(selected.map((entry) => fs.rm(
      path.join(getWorldPaths(worldName).assets, ".trash", entry.storageKey),
      { recursive: true, force: true }
    )));
    const selectedIds = new Set(selected.map((entry) => entry.id));
    const nextCatalog = {
      ...catalog,
      revision: catalog.revision + 1,
      trash: catalog.trash.filter((entry) => !selectedIds.has(entry.id))
    };
    await writeCatalog(path.join(getWorldPaths(worldName).worldRoot, "assets.json"), nextCatalog);
    return { success: true, deleted: selected.length, revision: nextCatalog.revision };
  });
}

async function renameAsset(worldName, reference, newName, actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    const resolved = await resolveAssetReference(worldName, reference, catalog);
    const sourceItem = getCatalogItemByPath(catalog, resolved.safePath);
    assertAssetAccess(catalog, sourceItem, context, "write");
    const stat = await fs.stat(resolved.fullPath).catch(() => null);
    if (!stat) throw createAssetNotFoundError();

    const parentPath = path.dirname(resolved.safePath) === "." ? "" : path.dirname(resolved.safePath).replace(/\\/g, "/");
    const parentFullPath = path.dirname(resolved.fullPath);
    const safeName = stat.isDirectory() ? sanitizeFolderName(newName) : sanitizeAssetName(newName);
    if (!stat.isDirectory() && path.extname(safeName).toLowerCase() !== path.extname(resolved.safePath).toLowerCase()) {
      throw createInvalidPathError("Asset file extension cannot be changed", newName);
    }
    const uniqueName = await getUniquePath(parentFullPath, safeName);
    const nextPath = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
    const { fullPath } = await resolveAssetPath(worldName, nextPath);

    await fs.rename(resolved.fullPath, fullPath);
    const updated = replaceCatalogPathPrefix(catalog, resolved.safePath, nextPath);
    if (updated.changed) {
      updated.catalog.revision = catalog.revision + 1;
      await writeCatalog(resolved.catalogPath, updated.catalog);
    }
    const nextStat = await fs.stat(fullPath);
    return {
      ...createAssetNode(uniqueName, nextPath, nextStat, updated.catalog, context),
      previousName: path.basename(resolved.safePath),
      previousPath: resolved.safePath,
      revision: updated.catalog.revision
    };
  });
}

async function moveAsset(worldName, reference, targetFolderReference = "", actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    const source = await resolveAssetReference(worldName, reference, catalog);
    const targetFolder = typeof targetFolderReference === "object"
      ? await resolveAssetReference(worldName, targetFolderReference, catalog)
      : await resolveAssetPath(worldName, targetFolderReference);
    const sourceItem = getCatalogItemByPath(catalog, source.safePath);
    assertAssetAccess(catalog, sourceItem, context, "write");
    assertFolderAccess(catalog, targetFolder.safePath, context, "write");
    const sourceStat = await fs.stat(source.fullPath).catch(() => null);
    if (!sourceStat) throw createAssetNotFoundError();
    const targetStat = await fs.stat(targetFolder.fullPath).catch(() => null);
    if (!targetStat || !targetStat.isDirectory()) {
      throw createInvalidPathError("Asset move target must be an existing folder", targetFolderReference);
    }

    if (sourceStat.isDirectory()) {
      if (targetFolder.safePath === source.safePath || targetFolder.safePath.startsWith(`${source.safePath}/`)) {
        throw createInvalidPathError("Asset folder cannot be moved into itself or its descendants", targetFolderReference);
      }
    }

    const sourceParentPath = path.dirname(source.safePath) === "." ? "" : path.dirname(source.safePath).replace(/\\/g, "/");
    if (sourceParentPath === targetFolder.safePath) {
      return createAssetNode(path.basename(source.safePath), source.safePath, sourceStat, catalog, context);
    }

    const uniqueName = await getUniquePath(targetFolder.fullPath, path.basename(source.safePath));
    const movedPath = targetFolder.safePath ? `${targetFolder.safePath}/${uniqueName}` : uniqueName;
    const { fullPath } = await resolveAssetPath(worldName, movedPath);
    await fs.rename(source.fullPath, fullPath);
    const updated = replaceCatalogPathPrefix(catalog, source.safePath, movedPath);
    if (updated.changed) {
      updated.catalog.revision = catalog.revision + 1;
      await writeCatalog(source.catalogPath, updated.catalog);
    }
    const movedStat = await fs.stat(fullPath);
    return {
      ...createAssetNode(uniqueName, movedPath, movedStat, updated.catalog, context),
      previousPath: source.safePath,
      revision: updated.catalog.revision
    };
  });
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
    } else if (entry.isFile()) {
      await fs.copyFile(sourceEntryPath, targetEntryPath);
    }
  }
}

async function duplicateAsset(worldName, reference, options = {}) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, options.actor);
    const resolved = await resolveAssetReference(worldName, reference, catalog);
    const sourceItem = getCatalogItemByPath(catalog, resolved.safePath);
    assertAssetAccess(catalog, sourceItem, context, "read");
    const stat = await fs.stat(resolved.fullPath).catch(() => null);
    if (!stat) throw createAssetNotFoundError();

    const sourceParentPath = path.dirname(resolved.safePath) === "." ? "" : path.dirname(resolved.safePath).replace(/\\/g, "/");
    const targetFolder = Object.hasOwn(options, "targetFolderReference")
      ? typeof options.targetFolderReference === "object"
        ? await resolveAssetReference(worldName, options.targetFolderReference, catalog)
        : await resolveAssetPath(worldName, options.targetFolderReference)
      : await resolveAssetPath(worldName, sourceParentPath);
    assertFolderAccess(catalog, targetFolder.safePath, context, "write");
    const targetFolderStat = await fs.stat(targetFolder.fullPath).catch(() => null);
    if (!targetFolderStat?.isDirectory()) {
      throw createInvalidPathError("Asset copy target must be an existing folder", options.targetFolderReference);
    }
    if (stat.isDirectory() && (
      targetFolder.safePath === resolved.safePath
      || targetFolder.safePath.startsWith(`${resolved.safePath}/`)
    )) {
      throw createInvalidPathError("Asset folder cannot be copied into itself or its descendants", targetFolder.safePath);
    }
    const parentPath = targetFolder.safePath;
    const parentFullPath = targetFolder.fullPath;
    const sourceName = path.basename(resolved.safePath);
    const ext = stat.isDirectory() ? "" : path.extname(sourceName);
    const base = ext ? path.basename(sourceName, ext) : sourceName;
    const requestedName = options.name || `${base} Copy${ext}`;
    const safeName = stat.isDirectory() ? sanitizeFolderName(requestedName) : sanitizeAssetName(requestedName);
    if (!stat.isDirectory() && path.extname(safeName).toLowerCase() !== ext.toLowerCase()) {
      throw createInvalidPathError("Asset file extension cannot be changed", requestedName);
    }
    const uniqueName = await getUniquePath(parentFullPath, safeName);
    const targetPath = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
    const { fullPath: targetFullPath } = await resolveAssetPath(worldName, targetPath);

    if (stat.isDirectory()) {
      await copyAssetDirectory(resolved.fullPath, targetFullPath, Boolean(options.includeChildren));
      let nextCatalog = await reconcileCatalog(worldName, { force: true });
      nextCatalog = {
        ...nextCatalog,
        revision: nextCatalog.revision + 1,
        items: nextCatalog.items.map((item) => (
          item.path === targetPath || item.path.startsWith(`${targetPath}/`)
            ? {
                ...item,
                ownerUserId: getActorOwnerUserId(context),
                permissions: normalizeAssetPermissions(null)
              }
            : item
        ))
      };
      await writeCatalog(path.join(getWorldPaths(worldName).worldRoot, "assets.json"), nextCatalog);
      const copiedStat = await fs.stat(targetFullPath);
      return createAssetNode(uniqueName, targetPath, copiedStat, nextCatalog, context);
    }

    await fs.copyFile(resolved.fullPath, targetFullPath);
    let nextCatalog = await reconcileCatalog(worldName, { force: true });
    nextCatalog = {
      ...nextCatalog,
      revision: nextCatalog.revision + 1,
      items: nextCatalog.items.map((item) => item.path === targetPath
        ? {
            ...item,
            ownerUserId: getActorOwnerUserId(context),
            permissions: normalizeAssetPermissions(null)
          }
        : item)
    };
    await writeCatalog(path.join(getWorldPaths(worldName).worldRoot, "assets.json"), nextCatalog);
    const copiedStat = await fs.stat(targetFullPath);
    return createAssetNode(uniqueName, targetPath, copiedStat, nextCatalog, context);
  });
}

function validateUploadFilename(filename) {
  if (String(filename || "").includes("/") || String(filename || "").includes("\\") || String(filename || "").includes("..")) {
    throw createInvalidPathError("Filename contains unsafe path characters", filename);
  }
  const sanitizedName = sanitizeAssetName(filename);
  if (!getAssetFormat(sanitizedName)) {
    const error = new Error("Unsupported asset file type");
    error.code = "UNSUPPORTED_MEDIA_TYPE";
    throw error;
  }
  return sanitizedName;
}

async function saveAssetSource(worldName, folderPath, filename, source, options = {}) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, options.actor);
    const sanitizedName = validateUploadFilename(filename);
    const { fullPath: folderFullPath, safePath: safeFolderPath, catalogPath } = await resolveAssetPath(worldName, folderPath);
    assertFolderAccess(catalog, safeFolderPath, context, "write");
    const folderStat = await fs.stat(folderFullPath).catch(() => null);
    if (folderStat && !folderStat.isDirectory()) {
      throw createInvalidPathError("Asset upload target must be a folder", folderPath);
    }
    await fs.mkdir(folderFullPath, { recursive: true });

    const uniqueName = await getUniquePath(folderFullPath, sanitizedName);
    const assetPath = safeFolderPath ? `${safeFolderPath}/${uniqueName}` : uniqueName;
    const finalPath = path.join(folderFullPath, uniqueName);
    const temporaryPath = path.join(folderFullPath, `.upload-${crypto.randomUUID()}.tmp`);
    const file = await fs.open(temporaryPath, "wx");
    const hash = crypto.createHash("sha256");
    const headerChunks = [];
    let headerBytes = 0;
    let size = 0;

    try {
      const iterable = Buffer.isBuffer(source) ? [source] : source;
      for await (const rawChunk of iterable) {
        const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
        size += chunk.length;
        if (options.maxBytes && size > options.maxBytes) throw createPayloadTooLargeError(options.maxBytes);
        if (headerBytes < 64) {
          const headerChunk = chunk.subarray(0, 64 - headerBytes);
          headerChunks.push(headerChunk);
          headerBytes += headerChunk.length;
        }
        hash.update(chunk);
        await file.write(chunk);
      }
      if (size === 0) throw createInvalidPathError("Asset file cannot be empty", filename);
      if (options.validate === true || options.contentType) {
        validateAssetMedia(uniqueName, options.contentType, Buffer.concat(headerChunks));
      }
      await file.sync();
      await file.close();
      await fs.rename(temporaryPath, finalPath);

      const stat = await fs.stat(finalPath);
      const item = {
        id: crypto.randomUUID(),
        path: assetPath,
        type: "file",
        ownerUserId: getActorOwnerUserId(context),
        permissions: normalizeAssetPermissions(null),
        mediaType: getAssetKind(uniqueName),
        contentType: getAssetContentType(uniqueName),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        sha256: hash.digest("hex"),
        createdAt: Date.now()
      };
      const nextCatalog = {
        ...catalog,
        revision: catalog.revision + 1,
        items: [...catalog.items, item].sort((left, right) => left.path.localeCompare(right.path))
      };
      try {
        await writeCatalog(catalogPath, nextCatalog);
      } catch (error) {
        await fs.rm(finalPath, { force: true }).catch(() => undefined);
        throw error;
      }
      return createAssetNode(uniqueName, assetPath, stat, nextCatalog, context);
    } catch (error) {
      await file.close().catch(() => undefined);
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  });
}

async function saveAssetFile(worldName, folderPath, filename, buffer, options = {}) {
  return saveAssetSource(worldName, folderPath, filename, buffer, options);
}

async function saveAssetStream(worldName, folderPath, filename, stream, options = {}) {
  return saveAssetSource(worldName, folderPath, filename, stream, {
    ...options,
    validate: true
  });
}

async function getAssetPermissions(worldName, reference, actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    const resolved = await resolveAssetReference(worldName, reference, catalog);
    const item = getCatalogItemByPath(catalog, resolved.safePath);
    assertAssetAccess(catalog, item, context, "admin");
    return {
      id: item.id,
      path: item.path,
      ownerUserId: item.ownerUserId,
      permissions: normalizeAssetPermissions(item.permissions),
      currentUserAccess: "admin",
      revision: catalog.revision
    };
  });
}

async function updateAssetPermissions(worldName, reference, permissions, actor) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, actor);
    const resolved = await resolveAssetReference(worldName, reference, catalog);
    const item = getCatalogItemByPath(catalog, resolved.safePath);
    assertAssetAccess(catalog, item, context, "admin");
    const normalized = normalizeAssetPermissions(permissions);
    const { isWorldMember } = require("./worlds");
    for (const userId of Object.keys(normalized.users)) {
      if (!(await isWorldMember(worldName, userId))) {
        const error = createInvalidPathError("Asset permissions can only target world members", userId);
        throw error;
      }
    }
    const nextCatalog = {
      ...catalog,
      revision: catalog.revision + 1,
      items: catalog.items.map((candidate) => candidate.id === item.id
        ? { ...candidate, permissions: normalized }
        : candidate)
    };
    await writeCatalog(resolved.catalogPath, nextCatalog);
    return {
      id: item.id,
      path: item.path,
      ownerUserId: item.ownerUserId,
      permissions: normalized,
      currentUserAccess: "admin",
      revision: nextCatalog.revision
    };
  });
}

async function getAssetFile(worldName, reference, options = {}) {
  return withAssetLock(worldName, async () => {
    const catalog = await reconcileCatalog(worldName);
    const context = await createAssetAccessContext(worldName, options.actor);
    const resolved = await resolveAssetReference(worldName, reference, catalog);
    const stat = await fs.stat(resolved.fullPath).catch(() => null);
    if (!stat || !stat.isFile()) throw createAssetNotFoundError();
    const item = getCatalogItemByPath(catalog, resolved.safePath);
    if (!options.allowDocumentContext) assertAssetAccess(catalog, item, context, "read");
    return {
      id: item?.id,
      path: resolved.safePath,
      name: path.basename(resolved.safePath),
      fullPath: resolved.fullPath,
      contentType: getAssetContentType(resolved.safePath),
      mediaType: getAssetKind(resolved.safePath),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      sha256: item?.sha256 || await hashFile(resolved.fullPath)
    };
  });
}

async function getAssetThumbnail(worldName, reference, requestedSize = 320, options = {}) {
  const size = [160, 320].includes(Number(requestedSize)) ? Number(requestedSize) : 320;
  const asset = await getAssetFile(worldName, reference, options);
  if (asset.mediaType !== "image") {
    const error = new Error("Thumbnails are only available for images");
    error.code = "UNSUPPORTED_MEDIA_TYPE";
    throw error;
  }

  const { worldRoot } = getWorldPaths(validateWorldName(worldName));
  const cacheDirectory = path.join(worldRoot, ".cache", "assets");
  const filename = `${asset.sha256}-${size}.webp`;
  const fullPath = path.join(cacheDirectory, filename);
  let stat = await fs.stat(fullPath).catch(() => null);
  if (!stat) {
    await fs.mkdir(cacheDirectory, { recursive: true });
    const temporaryPath = path.join(cacheDirectory, `.${filename}.${crypto.randomUUID()}.tmp`);
    try {
      await sharp(asset.fullPath)
        .rotate()
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(temporaryPath);
      await fs.rename(temporaryPath, fullPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
    stat = await fs.stat(fullPath);
  }

  return {
    id: asset.id,
    path: asset.path,
    name: filename,
    fullPath,
    contentType: "image/webp",
    mediaType: "image",
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    sha256: `${asset.sha256}-${size}`
  };
}

module.exports = {
  ASSET_ACCESS_LEVELS,
  ASSET_CATALOG_VERSION,
  TRASH_RETENTION_MS,
  createAssetFolder,
  deleteAsset,
  duplicateAsset,
  emptyTrash,
  getAssetFile,
  getAssetPermissions,
  getAssetThumbnail,
  listAssets,
  listTrash,
  moveAsset,
  permanentlyDeleteTrashItems,
  renameAsset,
  restoreTrashItems,
  saveAssetFile,
  saveAssetStream,
  sanitizeAssetName,
  trashAssets,
  updateAssetPermissions,
  validateAssetRelativePath
};
