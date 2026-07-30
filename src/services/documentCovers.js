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

function createInvalidCoverError(message) {
  const error = new Error(message);
  error.code = "INVALID_DOCUMENT_METADATA";
  return error;
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
  let metadata;
  try {
    metadata = JSON.parse(
      await fs.readFile(path.join(pagesDir, safePath, "metadata.json"), "utf-8")
    );
  } catch (error) {
    if (error.code === "ENOENT") throw createDocumentNotFoundError();
    throw error;
  }
  if (metadata.uid !== safeDocumentUid || metadata.type !== "container") {
    throw createDocumentNotFoundError();
  }
  return { worldId: safeWorldId, documentUid: safeDocumentUid, path: safePath, pagesDir, metadata };
}

async function assertDocumentAccess(document, actor, required) {
  const access = await getDocumentAccess(document.worldId, document.path, actor);
  if (!hasDocumentAccessLevel(access, required)) throw createForbiddenError();
}

function getResetCoverMetadata(assetId) {
  return {
    coverAssetId: assetId,
    coverAssetPath: null,
    coverPositionX: 50,
    coverPositionY: 50,
    coverCrop: null,
    coverZoom: 1,
    coverCroppedArea: null
  };
}

async function setDocumentCover(worldId, documentUid, input, actor) {
  const document = await resolveDocument(worldId, documentUid);
  await assertDocumentAccess(document, actor, "write");
  if (await isDocumentLocked(document.worldId, document.path)) {
    throw createForbiddenError("Document is locked");
  }

  const assetId = input?.assetId === null ? null : String(input?.assetId || "").trim();
  if (assetId !== null) {
    if (!assetId) throw createInvalidCoverError("Cover asset id is required");
    const asset = await getAssetFile(document.worldId, { id: assetId }, { actor });
    if (asset.mediaType !== "image") {
      const error = new Error("Document cover asset must be an image");
      error.code = "UNSUPPORTED_MEDIA_TYPE";
      throw error;
    }
  }

  const coverMetadata = getResetCoverMetadata(assetId);
  const nextMetadata = { ...document.metadata, ...coverMetadata };
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
    coverAssetId: assetId,
    metadata: coverMetadata
  };
}

async function isDocumentCoverAsset(worldId, documentUid, actor, asset) {
  const document = await resolveDocument(worldId, documentUid);
  await assertDocumentAccess(document, actor, "read");
  const coverAssetId = String(document.metadata.coverAssetId || "").trim();
  return Boolean(coverAssetId && asset?.id && coverAssetId === asset.id);
}

module.exports = {
  isDocumentCoverAsset,
  setDocumentCover
};
