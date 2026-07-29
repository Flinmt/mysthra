const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ensureWorldStructure,
  getWorldPaths,
  validateRelativePath,
  validateWorldName
} = require("../data/filesystem");
const { getAssetFile } = require("./assets");
const { broadcastWorldTreeUpdate } = require("./collaboration");
const { getPathByUid, indexWorld } = require("./indexer");
const {
  getDocumentAccess,
  hasDocumentAccessLevel,
  isDocumentLocked
} = require("./tree");

const DEFAULT_SOUNDTRACK_VOLUME = 0.35;

function createDocumentNotFoundError() {
  const error = new Error("Document not found");
  error.code = "DOCUMENT_NOT_FOUND";
  return error;
}

function createForbiddenError(message = "Forbidden") {
  const error = new Error(message);
  error.code = "FORBIDDEN";
  return error;
}

function createInvalidSoundtrackError(message) {
  const error = new Error(message);
  error.code = "INVALID_DOCUMENT_METADATA";
  return error;
}

async function readMetadata(pagesDir, documentPath) {
  try {
    return JSON.parse(
      await fs.readFile(path.join(pagesDir, documentPath, "metadata.json"), "utf-8")
    );
  } catch (error) {
    if (error.code === "ENOENT") throw createDocumentNotFoundError();
    throw error;
  }
}

async function resolveDocument(worldId, documentUid) {
  const safeWorldId = validateWorldName(worldId);
  const safeDocumentUid = validateWorldName(documentUid);
  await ensureWorldStructure(safeWorldId);

  let documentPath = getPathByUid(safeWorldId, safeDocumentUid);
  if (!documentPath) {
    await indexWorld(safeWorldId);
    documentPath = getPathByUid(safeWorldId, safeDocumentUid);
  }
  if (!documentPath) throw createDocumentNotFoundError();

  const safePath = validateRelativePath(documentPath);
  const { pages: pagesDir } = getWorldPaths(safeWorldId);
  const metadata = await readMetadata(pagesDir, safePath);
  if (metadata.uid !== safeDocumentUid || metadata.type !== "container") {
    throw createDocumentNotFoundError();
  }
  return { worldId: safeWorldId, documentUid: safeDocumentUid, path: safePath, pagesDir, metadata };
}

function normalizeStoredSoundtrack(soundtrack) {
  if (!soundtrack || typeof soundtrack !== "object" || Array.isArray(soundtrack)) return null;
  const assetId = String(soundtrack.assetId || "").trim();
  const defaultVolume = Number(soundtrack.defaultVolume);
  if (!assetId || !Number.isFinite(defaultVolume)) return null;
  return {
    assetId,
    defaultVolume: Math.min(1, Math.max(0, defaultVolume))
  };
}

async function assertDocumentAccess(document, actor, required) {
  const access = await getDocumentAccess(document.worldId, document.path, actor);
  if (!hasDocumentAccessLevel(access, required)) throw createForbiddenError();
}

async function resolveSoundtrackAsset(document, soundtrack) {
  try {
    const asset = await getAssetFile(
      document.worldId,
      { id: soundtrack.assetId },
      { allowDocumentContext: true }
    );
    if (asset.mediaType !== "audio") {
      return { name: "", unavailable: true };
    }
    return { name: asset.name, unavailable: false };
  } catch (error) {
    if (error.code === "ASSET_NOT_FOUND") return { name: "", unavailable: true };
    throw error;
  }
}

async function getDocumentSoundtrack(worldId, documentUid, actor) {
  const document = await resolveDocument(worldId, documentUid);
  await assertDocumentAccess(document, actor, "read");
  const soundtrack = normalizeStoredSoundtrack(document.metadata.soundtrack);
  if (!soundtrack) return { documentUid: document.documentUid, soundtrack: null };
  const asset = await resolveSoundtrackAsset(document, soundtrack);
  return {
    documentUid: document.documentUid,
    soundtrack: { ...soundtrack, ...asset }
  };
}

async function setDocumentSoundtrack(worldId, documentUid, input, actor) {
  const document = await resolveDocument(worldId, documentUid);
  await assertDocumentAccess(document, actor, "write");
  if (await isDocumentLocked(document.worldId, document.path)) {
    throw createForbiddenError("Document is locked");
  }

  const assetId = input?.assetId === null ? null : String(input?.assetId || "").trim();
  let soundtrack = null;
  let assetName = "";
  if (assetId !== null) {
    if (!assetId) throw createInvalidSoundtrackError("Soundtrack asset id is required");
    const defaultVolume = Number(input?.defaultVolume);
    if (!Number.isFinite(defaultVolume) || defaultVolume < 0 || defaultVolume > 1) {
      throw createInvalidSoundtrackError("Soundtrack volume must be between 0 and 1");
    }
    const asset = await getAssetFile(document.worldId, { id: assetId }, { actor });
    if (asset.mediaType !== "audio") {
      const error = new Error("Soundtrack asset must be audio");
      error.code = "UNSUPPORTED_MEDIA_TYPE";
      throw error;
    }
    soundtrack = { assetId: asset.id, defaultVolume };
    assetName = asset.name;
  }

  const nextMetadata = { ...document.metadata, soundtrack };
  await fs.writeFile(
    path.join(document.pagesDir, document.path, "metadata.json"),
    JSON.stringify(nextMetadata, null, 2),
    "utf-8"
  );
  await broadcastWorldTreeUpdate(document.worldId, {
    action: "metadata",
    path: document.path
  });

  return {
    documentUid: document.documentUid,
    soundtrack: soundtrack
      ? { ...soundtrack, name: assetName, unavailable: false }
      : null
  };
}

async function isDocumentSoundtrackAsset(worldId, documentUid, actor, asset) {
  const document = await resolveDocument(worldId, documentUid);
  await assertDocumentAccess(document, actor, "read");
  const soundtrack = normalizeStoredSoundtrack(document.metadata.soundtrack);
  return Boolean(soundtrack && asset?.id && soundtrack.assetId === asset.id);
}

module.exports = {
  DEFAULT_SOUNDTRACK_VOLUME,
  getDocumentSoundtrack,
  isDocumentSoundtrackAsset,
  setDocumentSoundtrack
};
