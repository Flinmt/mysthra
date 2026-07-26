const fs = require("node:fs");
const { once } = require("node:events");
const {
  broadcastWorldAssetUpdate,
  createAssetFolder,
  deleteAsset,
  duplicateAsset,
  emptyTrash,
  getAssetFile,
  getAssetThumbnail,
  listAssets,
  listTrash,
  moveAsset,
  permanentlyDeleteTrashItems,
  renameAsset,
  restoreTrashItems,
  saveAssetStream,
  trashAssets
} = require("../services");
const { getMediaCapabilities } = require("../services/mediaTypes");
const { sendJson } = require("../utils/http");
const { getErrorMessage, getErrorStatusCode } = require("./errors");

function createInvalidPathError(message, value) {
  const error = new Error(message);
  error.code = "INVALID_PATH";
  error.value = value;
  return error;
}

function createPayloadTooLargeError(limitBytes) {
  const error = new Error(`Request body exceeds the ${limitBytes} byte limit`);
  error.code = "PAYLOAD_TOO_LARGE";
  error.limitBytes = limitBytes;
  return error;
}

function getAssetReference(id, assetPath) {
  const normalizedId = String(id || "").trim();
  const normalizedPath = String(assetPath || "").trim();
  if (normalizedId && normalizedPath) {
    throw createInvalidPathError("Use either asset id or path, not both", { id, path: assetPath });
  }
  if (normalizedId) return { id: normalizedId };
  if (normalizedPath) return { path: normalizedPath };
  throw createInvalidPathError("Missing asset id or path", { id, path: assetPath });
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === "" && match[2] === "")) return false;

  let start;
  let end;
  if (match[1] === "") {
    const suffixLength = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return false;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = match[2] === "" ? size - 1 : Number.parseInt(match[2], 10);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return false;
  }
  return { start, end: Math.min(end, size - 1) };
}

function encodeContentDispositionFilename(filename) {
  return encodeURIComponent(filename)
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function getContentDisposition(filename) {
  const fallback = String(filename).replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeContentDispositionFilename(filename)}`;
}

function matchesIfNoneMatch(header, etag) {
  if (!header) return false;
  return String(header).split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized.replace(/^W\//, "") === etag;
  });
}

async function writeFileRange(response, fullPath, range) {
  const stream = fs.createReadStream(fullPath, range || undefined);
  try {
    for await (const chunk of stream) {
      if (response.write(chunk) === false && typeof response.once === "function") {
        await once(response, "drain");
      }
    }
    response.end();
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

async function serveAssetFile(request, response, asset) {
  const etag = `"${asset.sha256}"`;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "Content-Disposition": getContentDisposition(asset.name),
    "Content-Type": asset.contentType,
    "ETag": etag,
    "Last-Modified": new Date(asset.mtimeMs).toUTCString(),
    "X-Content-Type-Options": "nosniff"
  };

  if (matchesIfNoneMatch(request.headers?.["if-none-match"], etag)) {
    response.writeHead(304, commonHeaders);
    response.end();
    return;
  }

  const range = parseRange(request.headers?.range, asset.size);
  if (range === false) {
    response.writeHead(416, {
      ...commonHeaders,
      "Content-Range": `bytes */${asset.size}`,
      "Content-Length": "0"
    });
    response.end();
    return;
  }

  const contentLength = range ? range.end - range.start + 1 : asset.size;
  response.writeHead(range ? 206 : 200, {
    ...commonHeaders,
    "Content-Length": String(contentLength),
    ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${asset.size}` } : {})
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  await writeFileRange(response, asset.fullPath, range || undefined);
}

function sendRouteError(response, error) {
  const statusCode = getErrorStatusCode(error);
  sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
  return true;
}

function sendHandledJson(response, statusCode, payload) {
  sendJson(response, statusCode, payload);
  return true;
}

async function broadcastAssetResult(worldId, result) {
  await broadcastWorldAssetUpdate(worldId, { revision: result?.revision });
}

async function handleAssetRoute({
  request,
  response,
  pathname,
  worldId,
  currentUser,
  isPublicGet,
  getUploadBodyLimit,
  parseJsonBody,
  requireWorldMemberOrAdmin
}) {
  if (!pathname.match(/^\/api\/worlds\/[^/]+\/assets(\/.*)?$/)) return false;
  const isPrivateAssetRoute = pathname.match(/^\/api\/worlds\/[^/]+\/assets\/trash$/);
  if ((currentUser || !isPublicGet || isPrivateAssetRoute) && !(await requireWorldMemberOrAdmin(response, worldId, currentUser))) {
    return true;
  }

  const url = new URL(request.url, "http://localhost");
  const query = url.searchParams;

  try {
    if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/capabilities$/)) {
      return sendHandledJson(response, 200, getMediaCapabilities(getUploadBodyLimit()));
    }

    if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/trash$/)) {
      const result = await listTrash(worldId);
      return sendHandledJson(response, 200, result);
    }

    if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^/]+\/assets$/)) {
      const result = await listAssets(worldId, query.get("path") || "");
      return sendHandledJson(response, 200, result);
    }

    if (["GET", "HEAD"].includes(request.method) && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/thumbnail$/)) {
      const asset = await getAssetThumbnail(
        worldId,
        getAssetReference(query.get("id"), query.get("path")),
        query.get("size")
      );
      await serveAssetFile(request, response, asset);
      return true;
    }

    if (["GET", "HEAD"].includes(request.method) && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/file$/)) {
      const asset = await getAssetFile(worldId, getAssetReference(query.get("id"), query.get("path")));
      await serveAssetFile(request, response, asset);
      return true;
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/folders$/)) {
      const body = await parseJsonBody(request);
      if (!body.name) throw createInvalidPathError("Missing folder name", body.name);
      const result = await createAssetFolder(
        worldId,
        body.parentId ? { id: body.parentId } : body.parentPath || "",
        body.name
      );
      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 201, result);
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/upload$/)) {
      const filename = query.get("filename");
      if (!filename) throw createInvalidPathError("Missing filename", filename);
      const maxBytes = getUploadBodyLimit();
      const contentLength = Number.parseInt(request.headers?.["content-length"] || "", 10);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        request.resume?.();
        throw createPayloadTooLargeError(maxBytes);
      }
      const result = await saveAssetStream(
        worldId,
        query.get("path") || "",
        filename,
        request,
        {
          contentType: request.headers?.["content-type"],
          maxBytes
        }
      );
      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 201, result);
    }

    if (request.method === "PATCH" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/rename$/)) {
      const body = await parseJsonBody(request);
      if (!body.newName) throw createInvalidPathError("Missing newName", body.newName);
      const result = await renameAsset(worldId, getAssetReference(body.id, body.path), body.newName);
      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 200, result);
    }

    if (request.method === "PATCH" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/move$/)) {
      const body = await parseJsonBody(request);
      const result = await moveAsset(
        worldId,
        getAssetReference(body.id, body.sourcePath),
        body.targetFolderId ? { id: body.targetFolderId } : body.targetFolderPath || ""
      );
      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 200, result);
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/duplicate$/)) {
      const body = await parseJsonBody(request);
      const result = await duplicateAsset(worldId, getAssetReference(body.id, body.path), {
        includeChildren: Boolean(body.includeChildren),
        name: body.name,
        ...(body.targetFolderId ? { targetFolderReference: { id: body.targetFolderId } } : {}),
        ...(body.targetFolderPath !== undefined ? { targetFolderReference: body.targetFolderPath } : {})
      });
      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 201, result);
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/actions$/)) {
      const body = await parseJsonBody(request);
      const itemIds = [...new Set(Array.isArray(body.itemIds) ? body.itemIds.map(String).filter(Boolean) : [])];
      if (itemIds.length === 0) throw createInvalidPathError("Missing itemIds", body.itemIds);
      const referenceTarget = body.targetFolderId ? { id: body.targetFolderId } : body.targetFolderPath || "";
      let result;

      if (body.action === "trash") {
        result = await trashAssets(worldId, itemIds.map((id) => ({ id })));
      } else if (body.action === "restore") {
        result = await restoreTrashItems(worldId, itemIds);
      } else if (body.action === "delete-permanently") {
        result = await permanentlyDeleteTrashItems(worldId, itemIds);
      } else if (body.action === "move" || body.action === "copy") {
        const items = [];
        for (const id of itemIds) {
          try {
            const item = body.action === "move"
              ? await moveAsset(worldId, { id }, referenceTarget)
              : await duplicateAsset(worldId, { id }, {
                includeChildren: true,
                targetFolderReference: referenceTarget
              });
            items.push(item);
          } catch (error) {
            items.push({ id, error: getErrorMessage(error, getErrorStatusCode(error)) });
          }
        }
        const current = await listAssets(worldId);
        result = { items, revision: current.revision };
      } else {
        throw createInvalidPathError("Unsupported asset action", body.action);
      }

      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 200, result);
    }

    if (request.method === "DELETE" && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/trash$/)) {
      const result = await emptyTrash(worldId);
      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 200, result);
    }

    if (request.method === "DELETE" && pathname.match(/^\/api\/worlds\/[^/]+\/assets$/)) {
      const result = await deleteAsset(worldId, getAssetReference(query.get("id"), query.get("path")));
      await broadcastAssetResult(worldId, result);
      return sendHandledJson(response, 200, result);
    }
  } catch (error) {
    if (
      request.method === "POST"
      && pathname.match(/^\/api\/worlds\/[^/]+\/assets\/upload$/)
      && !request.readableEnded
    ) {
      request.resume?.();
    }
    sendRouteError(response, error);
    return true;
  }

  return false;
}

module.exports = {
  getAssetReference,
  handleAssetRoute,
  parseRange,
  serveAssetFile
};
