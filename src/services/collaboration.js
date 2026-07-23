const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { Hocuspocus } = require("@hocuspocus/server");
const Y = require("yjs");
const {
  ensureWorldStructure,
  getDataRoot,
  getWorldPaths,
  validateRelativePath,
  validateWorldName
} = require("../data/filesystem");
const { getAuthenticatedUser } = require("../utils/auth");
const { isGlobalAdmin } = require("../utils/roles");
const { getPathByUid, indexWorld } = require("./indexer");

const COLLABORATION_PATH = "/collaboration";
const BLOCKNOTE_FRAGMENT = "blocknote";
const NOTION_MIGRATION_VERSION = 1;
const MAX_MIGRATION_UPDATE_SIZE = 1000 * 1000;
const COLLABORATIVE_TAB_CONTENT_TYPES = new Set(["wiki", "tiptap", "map", "markdown", "board"]);

let activeCollaborationServer = null;
const notionMigrationQueues = new Map();

function isCollaborationDebugEnabled() {
  return ["1", "true", "yes", "on"].includes(String(process.env.COLLABORATION_DEBUG || "").trim().toLowerCase());
}

function debugCollaboration(event, details = {}) {
  if (!isCollaborationDebugEnabled()) return;
  console.log(`[collaboration:${event}]`, details);
}

function parseCollaborationRoom(documentName = "") {
  const parts = String(documentName).split(":");
  if (parts.length === 3 && parts[0] === "world" && parts[2] === "presence") {
    return {
      type: "presence",
      worldId: validateWorldName(parts[1])
    };
  }
  if (parts.length === 4 && parts[0] === "world" && parts[2] === "tab") {
    return {
      type: "tab",
      worldId: validateWorldName(parts[1]),
      tabUid: validateWorldName(parts[3])
    };
  }

  const error = new Error("Invalid collaboration room");
  error.code = "INVALID_COLLABORATION_ROOM";
  throw error;
}

function getCookieRequest(requestHeaders) {
  const cookie = typeof requestHeaders?.get === "function"
    ? requestHeaders.get("cookie")
    : requestHeaders?.cookie;
  return { headers: { cookie: cookie || "" } };
}

async function readDocumentMetadata(pagesDir, safePath) {
  const metaPath = path.join(pagesDir, safePath, "metadata.json");
  try {
    const metaStr = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(metaStr);
  } catch {
    return {};
  }
}

async function getPathByUidWithFallback(worldId, uid) {
  let resolvedPath = getPathByUid(worldId, uid);
  if (resolvedPath) return resolvedPath;

  await indexWorld(worldId);
  resolvedPath = getPathByUid(worldId, uid);
  if (resolvedPath) return resolvedPath;

  const error = new Error("Collaborative document not found");
  error.code = "DOCUMENT_NOT_FOUND";
  throw error;
}

async function resolveTabRoom(room) {
  await ensureWorldStructure(room.worldId);
  const safePath = validateRelativePath(await getPathByUidWithFallback(room.worldId, room.tabUid));
  const { pages: pagesDir } = getWorldPaths(room.worldId);
  const metadata = await readDocumentMetadata(pagesDir, safePath);

  if (
    metadata.uid !== room.tabUid ||
    metadata.type !== "tab" ||
    (metadata.contentType && !COLLABORATIVE_TAB_CONTENT_TYPES.has(metadata.contentType))
  ) {
    const error = new Error("Collaborative room must point to a collaborative tab");
    error.code = "DOCUMENT_NOT_FOUND";
    throw error;
  }

  return {
    ...room,
    path: safePath,
    pagesDir,
    metadata,
    indexPath: path.join(pagesDir, safePath, "index.md")
  };
}

function getWorldYjsRoot(worldId) {
  const safeWorldId = validateWorldName(worldId);
  return path.join(getDataRoot(), "worlds", safeWorldId, "yjs");
}

function getTabStatePath(worldId, tabUid) {
  const safeTabUid = validateWorldName(tabUid);
  return path.join(getWorldYjsRoot(worldId), `${safeTabUid}.bin`);
}

async function readPersistedState(room) {
  try {
    return await fs.readFile(getTabStatePath(room.worldId, room.tabUid));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function loadCollaborationDocument(document, room) {
  const persistedState = await readPersistedState(room);
  if (persistedState) {
    Y.applyUpdate(document, persistedState);
  }
  debugCollaboration("load", {
    room: `world:${room.worldId}:tab:${room.tabUid}`,
    bytes: persistedState?.length || 0
  });
}

async function storeCollaborationDocument(document, room) {
  await ensureWorldStructure(room.worldId);
  await fs.mkdir(getWorldYjsRoot(room.worldId), { recursive: true });
  const statePath = getTabStatePath(room.worldId, room.tabUid);
  const state = Buffer.from(Y.encodeStateAsUpdate(document));
  await fs.writeFile(statePath, state);
  debugCollaboration("store", {
    room: `world:${room.worldId}:tab:${room.tabUid}`,
    bytes: state.length
  });
}

function encodeStateVector(document) {
  return Buffer.from(Y.encodeStateVector(document)).toString("base64");
}

function getContentHash(content = "") {
  return crypto.createHash("sha256").update(String(content), "utf8").digest("hex");
}

function getFallbackContentHash(content = "") {
  let hash = 2166136261;
  for (const byte of Buffer.from(String(content), "utf8")) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function matchesContentHash(content, hash) {
  return hash?.startsWith("fnv1a:")
    ? getFallbackContentHash(content) === hash
    : getContentHash(content) === hash;
}

function sendStateless(connection, payload) {
  connection?.sendStateless(JSON.stringify(payload));
}

async function executeNotionMigration({ connection, document, documentName, payload }) {
  let message;
  try {
    message = JSON.parse(payload);
  } catch {
    return;
  }
  if (message?.type !== "notion:migrate") return;

  const result = {
    type: "notion:migration-result",
    requestId: message.requestId || "",
    status: "rejected"
  };

  try {
    await updateConnectionLockState(documentName, connection);
    if (message.version !== NOTION_MIGRATION_VERSION || connection.readOnly) {
      result.reason = connection.readOnly ? "readonly" : "unsupported-version";
      sendStateless(connection, result);
      return;
    }

    const room = parseCollaborationRoom(documentName);
    if (room.type !== "tab") {
      result.reason = "invalid-room";
      sendStateless(connection, result);
      return;
    }
    const resolvedRoom = await resolveTabRoom(room);
    if (resolvedRoom.metadata.contentType !== "wiki") {
      result.reason = "invalid-content-type";
      sendStateless(connection, result);
      return;
    }

    const fragment = document.getXmlFragment(BLOCKNOTE_FRAGMENT);
    if (fragment.length > 0) {
      sendStateless(connection, { ...result, status: "already-migrated", reason: undefined });
      return;
    }

    const legacyContent = await fs.readFile(resolvedRoom.indexPath, "utf8").catch(error => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    if (!legacyContent.trim() || !matchesContentHash(legacyContent, message.sourceHash)) {
      result.reason = "source-changed";
      sendStateless(connection, result);
      return;
    }

    const update = Buffer.from(String(message.update || ""), "base64");
    if (!update.length || update.length > MAX_MIGRATION_UPDATE_SIZE) {
      result.reason = "invalid-update";
      sendStateless(connection, result);
      return;
    }

    const migrationDocument = new Y.Doc();
    try {
      Y.applyUpdate(migrationDocument, update);
      if (migrationDocument.getXmlFragment(BLOCKNOTE_FRAGMENT).length === 0) {
        result.reason = "invalid-update";
        sendStateless(connection, result);
        return;
      }
      Y.applyUpdate(document, Y.encodeStateAsUpdate(migrationDocument));
    } finally {
      migrationDocument.destroy();
    }
    sendStateless(connection, { ...result, status: "accepted", reason: undefined });
  } catch {
    sendStateless(connection, { ...result, reason: "migration-failed" });
  }
}

async function handleNotionMigration(payload) {
  const key = payload.documentName;
  const previous = notionMigrationQueues.get(key) || Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(() => executeNotionMigration(payload));
  notionMigrationQueues.set(key, current);
  try {
    await current;
  } finally {
    if (notionMigrationQueues.get(key) === current) notionMigrationQueues.delete(key);
  }
}

async function authorizeRoom(documentName, requestHeaders, connectionConfig) {
  const room = parseCollaborationRoom(documentName);
  const user = getAuthenticatedUser(getCookieRequest(requestHeaders));

  if (!user) {
    const { isWorldPublicReadable } = require("./worlds");
    const isPublicWorld = await isWorldPublicReadable(room.worldId).catch(() => false);
    if (!isPublicWorld) {
      debugCollaboration("auth-reject", { documentName, reason: "unauthorized" });
      const error = new Error("Unauthorized");
      error.reason = "unauthorized";
      error.code = 4401;
      throw error;
    }

    if (room.type === "presence") {
      connectionConfig.readOnly = true;
      debugCollaboration("auth", { documentName, userId: "visitor", scope: "readonly" });
      return { room, user: { userId: "visitor", username: "Visitor", isVisitor: true } };
    }

    const resolvedRoom = await resolveTabRoom(room);
    const { getDocumentAccess, hasDocumentAccessLevel } = require("./tree");
    const visitor = { userId: "visitor", username: "Visitor", isVisitor: true };
    const access = await getDocumentAccess(room.worldId, resolvedRoom.path, visitor);
    if (!hasDocumentAccessLevel(access, "read")) {
      debugCollaboration("auth-reject", { documentName, userId: "visitor", reason: "forbidden" });
      const error = new Error("Forbidden");
      error.reason = "forbidden";
      error.code = 4403;
      throw error;
    }
    connectionConfig.readOnly = true;
    debugCollaboration("auth", { documentName, userId: "visitor", scope: "readonly" });
    return { room: resolvedRoom, user: { userId: "visitor", username: "Visitor", isVisitor: true } };
  }

  const { isWorldMember } = require("./worlds");
  if (!isGlobalAdmin(user) && !(await isWorldMember(room.worldId, user.userId))) {
    debugCollaboration("auth-reject", { documentName, userId: user.userId, reason: "forbidden" });
    const error = new Error("Forbidden");
    error.reason = "forbidden";
    error.code = 4403;
    throw error;
  }

  if (room.type === "presence") {
    debugCollaboration("auth", { documentName, userId: user.userId, scope: "read-write" });
    return { room, user };
  }

  const resolvedRoom = await resolveTabRoom(room);
  const { getDocumentAccess, hasDocumentAccessLevel } = require("./tree");
  const access = await getDocumentAccess(room.worldId, resolvedRoom.path, user);
  if (!hasDocumentAccessLevel(access, "read")) {
    debugCollaboration("auth-reject", { documentName, userId: user.userId, reason: "forbidden" });
    const error = new Error("Forbidden");
    error.reason = "forbidden";
    error.code = 4403;
    throw error;
  }
  if (!hasDocumentAccessLevel(access, "write")) {
    connectionConfig.readOnly = true;
  }
  if (!connectionConfig.readOnly) {
    const { isDocumentLocked } = require("./tree");
    connectionConfig.readOnly = await isDocumentLocked(room.worldId, resolvedRoom.path);
  }
  debugCollaboration("auth", {
    documentName,
    userId: user.userId,
    scope: connectionConfig.readOnly ? "readonly" : "read-write"
  });

  return { room: resolvedRoom, user };
}

async function updateConnectionLockState(documentName, connection) {
  const room = parseCollaborationRoom(documentName);
  if (room.type !== "tab") return;
  let resolvedRoom;
  try {
    resolvedRoom = await resolveTabRoom(room);
  } catch (error) {
    if (error.code === "DOCUMENT_NOT_FOUND") {
      closeCollaborationRoom(room.worldId, room.tabUid);
      return;
    }
    throw error;
  }
  const { getDocumentAccess, hasDocumentAccessLevel, isDocumentLocked } = require("./tree");
  const access = await getDocumentAccess(room.worldId, resolvedRoom.path, connection.context?.user).catch(() => "none");
  const locked = connection.context?.user?.isVisitor ? false : await isDocumentLocked(room.worldId, resolvedRoom.path).catch(() => false);
  connection.readOnly = Boolean(
    connection.context?.user?.isVisitor ||
    !hasDocumentAccessLevel(access, "write") ||
    locked
  );
}

async function resolveStorableTabRoom(room) {
  try {
    return await resolveTabRoom(room);
  } catch (error) {
    if (error.code === "DOCUMENT_NOT_FOUND") return null;
    throw error;
  }
}

function createCollaborationServer() {
  activeCollaborationServer = new Hocuspocus({
    name: "mysthra-collaboration",
    quiet: true,
    debounce: 1500,
    maxDebounce: 8000,
    async onAuthenticate({ documentName, requestHeaders, connectionConfig }) {
      return authorizeRoom(documentName, requestHeaders, connectionConfig);
    },
    async onLoadDocument({ document, documentName, context }) {
      const room = context.room || parseCollaborationRoom(documentName);
      if (room.type !== "tab") return;
      const resolvedRoom = await resolveTabRoom(room);
      await loadCollaborationDocument(document, resolvedRoom);
    },
    async beforeHandleMessage({ documentName, connection }) {
      await updateConnectionLockState(documentName, connection);
    },
    async onStateless(payload) {
      await handleNotionMigration(payload);
    },
    async onStoreDocument({ document, documentName, lastContext }) {
      const room = lastContext?.room || parseCollaborationRoom(documentName);
      if (room.type !== "tab") return;
      const resolvedRoom = await resolveStorableTabRoom(room);
      if (!resolvedRoom) return;
      try {
        await storeCollaborationDocument(document, resolvedRoom);
        document.broadcastStateless(JSON.stringify({
          type: "document-persisted",
          tabUid: resolvedRoom.tabUid,
          stateVector: encodeStateVector(document)
        }));
      } catch (error) {
        document.broadcastStateless(JSON.stringify({
          type: "document-persistence-error",
          tabUid: resolvedRoom.tabUid
        }));
        throw error;
      }
    }
  });
  return activeCollaborationServer;
}

function closeCollaborationRoom(worldName, tabUid) {
  if (!activeCollaborationServer || !tabUid) return;
  const safeWorldName = validateWorldName(worldName);
  const safeTabUid = validateWorldName(tabUid);
  activeCollaborationServer.closeConnections(`world:${safeWorldName}:tab:${safeTabUid}`);
}

async function broadcastWorldTreeUpdate(worldName, details = {}) {
  if (!activeCollaborationServer) return;
  const safeWorldName = validateWorldName(worldName);
  const directConnection = await activeCollaborationServer.openDirectConnection(`world:${safeWorldName}:presence`);
  try {
    directConnection.document?.broadcastStateless(JSON.stringify({
      type: "document-tree",
      worldId: safeWorldName,
      ...details
    }));
  } finally {
    await directConnection.disconnect();
  }
}

async function removeCollaborationState(worldName, metadata) {
  if (!metadata?.uid || metadata.type !== "tab") return;
  const statePath = getTabStatePath(worldName, metadata.uid);
  await fs.rm(statePath, { force: true });
}

async function copyCollaborationState(worldName, sourceMetadata, targetMetadata) {
  if (!sourceMetadata?.uid || !targetMetadata?.uid || sourceMetadata.type !== "tab") return;
  const sourcePath = getTabStatePath(worldName, sourceMetadata.uid);
  const targetPath = getTabStatePath(worldName, targetMetadata.uid);
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = {
  BLOCKNOTE_FRAGMENT,
  COLLABORATION_PATH,
  broadcastWorldTreeUpdate,
  closeCollaborationRoom,
  copyCollaborationState,
  createCollaborationServer,
  parseCollaborationRoom,
  removeCollaborationState,
  resolveTabRoom
};
