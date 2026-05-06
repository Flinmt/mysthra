const { sendJson } = require("../utils/http");
const { serveStaticFile } = require("../utils/static");
const fs = require("node:fs");
const {
  createExpiredSessionCookie,
  createSessionCookie,
  generateSessionToken,
  getAdminUsername,
  getAuthenticatedUser,
  getMasterPassword,
  clearSession,
  clearSessionsForUser,
  safeCompare
} = require("../utils/auth");
const path = require("node:path");

const {
  listWorlds,
  createWorld,
  updateWorld,
  deleteWorld,
  getFileTree,
  createDocument,
  createDocumentPlaceholder,
  readDocument,
  updateDocumentContent,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument,
  duplicateDocument,
  createAssetFolder,
  deleteAsset,
  duplicateAsset,
  getAssetFile,
  listAssets,
  moveAsset,
  renameAsset,
  saveAssetFile,
  getWorldConfig,
  getWorldThumbnail,
  isWorldMember,
  listWorldMembers,
  addWorldMember,
  removeWorldMember,
  authenticateUser,
  changeUserPassword,
  createUser,
  deleteUser,
  listLoginUsers,
  listUsers,
  removeUserFromAllWorlds,
  saveWorldThumbnail,
  setHomePage
} = require("../services");

function getRequestUrl(requestUrl) {
  return new URL(requestUrl, "http://localhost");
}

function getQueryParams(requestUrl) {
  const url = getRequestUrl(requestUrl);
  return url.searchParams;
}

function getWorldIdFromPath(requestUrl) {
  const url = getRequestUrl(requestUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length >= 3 && pathSegments[0] === "api" && pathSegments[1] === "worlds") {
    return decodeURIComponent(pathSegments[2]);
  }

  return null;
}

function getErrorStatusCode(error) {
  if (error.code === "INVALID_PATH") return 400;
  if (error.code === "INVALID_HOME_PAGE") return 400;
  if (error.code === "INVALID_USER_INPUT") return 400;
  if (error.code === "INVALID_WORLD_INPUT" || error.code === "INVALID_THUMBNAIL") return 400;
  if (error.code === "USER_ALREADY_EXISTS") return 409;
  if (error.code === "WORLD_ALREADY_EXISTS") return 409;
  if (error.code === "WORLD_NOT_FOUND") return 404;
  if (error.code === "DOCUMENT_NOT_FOUND") return 404;
  if (error.code === "USER_NOT_FOUND") return 404;
  return 500;
}

function getErrorMessage(error, statusCode) {
  if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
    return error.message;
  }
  return "Internal Server Error";
}

function isPublicReadEnabled() {
  return ["1", "true", "yes", "on"].includes(String(process.env.PUBLIC_READ || "").trim().toLowerCase());
}

function isPublicReadRequest(method, pathname) {
  return method === "GET" && pathname.startsWith("/api/worlds");
}

function getPublicUser(user) {
  if (!user) return null;
  return {
    userId: user.userId,
    username: user.username,
    isAdmin: Boolean(user.isAdmin)
  };
}

function sendForbidden(response) {
  return sendJson(response, 403, { error: "Forbidden" });
}

function requireAdmin(response, user) {
  if (user?.isAdmin) return true;
  sendForbidden(response);
  return false;
}

async function requireWorldMemberOrAdmin(response, worldId, user) {
  if (user?.isAdmin) return true;
  if (!user) {
    sendJson(response, 401, { error: "Unauthorized" });
    return false;
  }
  try {
    if (await isWorldMember(worldId, user.userId)) return true;
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
    return false;
  }
  sendForbidden(response);
  return false;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      resolve(body);
    });
    request.on("error", reject);
  });
}

function readRequestBuffer(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    request.on("error", reject);
  });
}

async function parseJsonBody(request) {
  const rawBody = await readRequestBody(request);
  if (!rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const parseError = new Error("Request body must be valid JSON");
    parseError.code = "INVALID_JSON";
    throw parseError;
  }
}

async function router(request, response) {
  const urlObj = getRequestUrl(request.url);
  const pathname = urlObj.pathname;

  if (pathname.startsWith("/api/")) {
    if (request.method === "GET" && pathname === "/api/health") {
      return sendJson(response, 200, { status: "ok", service: "mysthra-backend" });
    }

    if (request.method === "POST" && pathname === "/api/auth/login") {
      try {
        const body = await parseJsonBody(request);
        const { password } = body;
        const username = body.username || getAdminUsername();
        const masterPassword = getMasterPassword();
        const isAdminLogin = String(username).trim().toLowerCase() === getAdminUsername().toLowerCase();

        if (isAdminLogin && typeof password === "string" && safeCompare(password, masterPassword)) {
          const token = generateSessionToken({
            userId: "admin",
            username: getAdminUsername(),
            isAdmin: true
          });
          response.setHeader("Set-Cookie", createSessionCookie(token, request));
          return sendJson(response, 200, {
            success: true,
            user: { userId: "admin", username: getAdminUsername(), isAdmin: true }
          });
        }

        const user = await authenticateUser(username, password);
        if (user) {
          const token = generateSessionToken({
            userId: user.id,
            username: user.username,
            isAdmin: false
          });
          response.setHeader("Set-Cookie", createSessionCookie(token, request));
          return sendJson(response, 200, {
            success: true,
            user: { userId: user.id, username: user.username, isAdmin: false }
          });
        }

        sendJson(response, 401, { error: "Invalid username or password" });
      } catch (e) {
        sendJson(response, 400, { error: "Invalid request" });
      }
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      const cookieHeader = request.headers?.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split("=");
          acc[key] = value;
          return acc;
        }, {});
        if (cookies.mysthra_session) clearSession(cookies.mysthra_session);
      }
      response.setHeader("Set-Cookie", createExpiredSessionCookie(request));
      return sendJson(response, 200, { success: true });
    }

    if (request.method === "GET" && pathname === "/api/auth/verify") {
      const user = getAuthenticatedUser(request);
      return sendJson(response, 200, { authenticated: Boolean(user), user: getPublicUser(user) });
    }

    if (request.method === "GET" && pathname === "/api/auth/users") {
      try {
        const users = await listLoginUsers();
        return sendJson(response, 200, { items: users });
      } catch {
        return sendJson(response, 200, { items: [{ id: "admin", username: getAdminUsername(), isAdmin: true }] });
      }
    }

    const isPublicGet = isPublicReadEnabled() && isPublicReadRequest(request.method, pathname);
    const currentUser = getAuthenticatedUser(request);
    if (!isPublicGet && !currentUser) {
      return sendJson(response, 401, { error: "Unauthorized" });
    }

    if (pathname === "/api/users") {
      if (!requireAdmin(response, currentUser)) return;

      if (request.method === "GET") {
        try {
          const users = await listUsers();
          return sendJson(response, 200, { items: users });
        } catch {
          return sendJson(response, 500, { error: "Failed to list users" });
        }
      }

      if (request.method === "POST") {
        try {
          const body = await parseJsonBody(request);
          const user = await createUser(body);
          return sendJson(response, 201, user);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }
    }

    if (pathname.match(/^\/api\/users\/[^\/]+\/password$/) && request.method === "PATCH") {
      if (!requireAdmin(response, currentUser)) return;
      try {
        const userId = decodeURIComponent(pathname.split("/")[3]);
        const body = await parseJsonBody(request);
        const user = await changeUserPassword(userId, body.password);
        return sendJson(response, 200, user);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (pathname.match(/^\/api\/users\/[^\/]+$/) && request.method === "DELETE") {
      if (!requireAdmin(response, currentUser)) return;
      try {
        const userId = decodeURIComponent(pathname.split("/")[3]);
        const user = await deleteUser(userId);
        await removeUserFromAllWorlds(userId);
        clearSessionsForUser(userId);
        return sendJson(response, 200, user);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "GET" && pathname === "/api/worlds") {
      try {
        const worlds = await listWorlds(currentUser);
        return sendJson(response, 200, { items: worlds });
      } catch (error) {
        return sendJson(response, 500, { error: "Failed to list worlds" });
      }
    }

    if (request.method === "POST" && pathname === "/api/worlds") {
      if (!requireAdmin(response, currentUser)) return;
      try {
        const body = await parseJsonBody(request);
        const world = await createWorld(body);
        return sendJson(response, 201, world);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (pathname.match(/^\/api\/worlds\/[^\/]+\/members(\/[^\/]+)?$/)) {
      const worldId = getWorldIdFromPath(request.url);
      if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
      if (!requireAdmin(response, currentUser)) return;

      if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^\/]+\/members$/)) {
        try {
          const members = await listWorldMembers(worldId);
          return sendJson(response, 200, { items: members });
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/members$/)) {
        try {
          const body = await parseJsonBody(request);
          const user = body.userId ? null : await createUser(body);
          const members = await addWorldMember(worldId, body.userId || user.id);
          return sendJson(response, 201, { items: members });
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "DELETE") {
        try {
          const userId = decodeURIComponent(pathname.split("/")[5]);
          const members = await removeWorldMember(worldId, userId);
          return sendJson(response, 200, { items: members });
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }
    }

    if (pathname.match(/^\/api\/worlds\/[^\/]+\/thumbnail$/)) {
      const worldId = getWorldIdFromPath(request.url);
      if (!worldId) return sendJson(response, 400, { error: "Missing world id" });

      if (request.method === "GET") {
        try {
          if ((currentUser || !isPublicGet) && !(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
          const thumbnail = await getWorldThumbnail(worldId);
          response.writeHead(200, { "Content-Type": thumbnail.contentType });
          fs.createReadStream(thumbnail.fullPath).pipe(response);
          return;
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "POST") {
        if (!requireAdmin(response, currentUser)) return;
        try {
          const queryParams = getQueryParams(request.url);
          const filename = queryParams.get("filename");
          if (!filename) return sendJson(response, 400, { error: "Missing filename" });
          const buffer = await readRequestBuffer(request);
          const world = await saveWorldThumbnail(worldId, filename, buffer);
          return sendJson(response, 200, world);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }
    }

    if (pathname.match(/^\/api\/worlds\/[^\/]+$/)) {
      const worldId = getWorldIdFromPath(request.url);
      if (!worldId) return sendJson(response, 400, { error: "Missing world id" });

      if (request.method === "PUT") {
        if (!requireAdmin(response, currentUser)) return;
        try {
          const body = await parseJsonBody(request);
          const world = await updateWorld(worldId, body);
          return sendJson(response, 200, world);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "DELETE") {
        if (!requireAdmin(response, currentUser)) return;
        try {
          const result = await deleteWorld(worldId);
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }
    }

    if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^\/]+\/tree$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        if ((currentUser || !isPublicGet) && !(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
        const tree = await getFileTree(worldId);
        return sendJson(response, 200, { items: tree });
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (pathname.match(/^\/api\/worlds\/[^\/]+\/assets(\/.*)?$/)) {
      const worldId = getWorldIdFromPath(request.url);
      if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
      if ((currentUser || !isPublicGet) && !(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;

      if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets$/)) {
        try {
          const queryParams = getQueryParams(request.url);
          const result = await listAssets(worldId, queryParams.get("path") || "");
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets\/file$/)) {
        try {
          const queryParams = getQueryParams(request.url);
          const assetPath = queryParams.get("path");
          if (!assetPath) return sendJson(response, 400, { error: "Missing asset path" });
          const asset = await getAssetFile(worldId, assetPath);
          response.writeHead(200, { "Content-Type": asset.contentType });
          fs.createReadStream(asset.fullPath).pipe(response);
          return;
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets\/folders$/)) {
        try {
          const body = await parseJsonBody(request);
          if (!body.name) return sendJson(response, 400, { error: "Missing folder name" });
          const result = await createAssetFolder(worldId, body.parentPath || "", body.name);
          return sendJson(response, 201, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets\/upload$/)) {
        try {
          const queryParams = getQueryParams(request.url);
          const filename = queryParams.get("filename");
          if (!filename) return sendJson(response, 400, { error: "Missing filename" });
          const buffer = await readRequestBuffer(request);
          const result = await saveAssetFile(worldId, queryParams.get("path") || "", filename, buffer);
          return sendJson(response, 201, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "PATCH" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets\/rename$/)) {
        try {
          const body = await parseJsonBody(request);
          if (!body.path || !body.newName) return sendJson(response, 400, { error: "Missing path or newName" });
          const result = await renameAsset(worldId, body.path, body.newName);
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "PATCH" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets\/move$/)) {
        try {
          const body = await parseJsonBody(request);
          if (!body.sourcePath && body.sourcePath !== "") return sendJson(response, 400, { error: "Missing sourcePath" });
          const result = await moveAsset(worldId, body.sourcePath, body.targetFolderPath || "");
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets\/duplicate$/)) {
        try {
          const body = await parseJsonBody(request);
          if (!body.path) return sendJson(response, 400, { error: "Missing asset path" });
          const result = await duplicateAsset(worldId, body.path, {
            includeChildren: Boolean(body.includeChildren),
            name: body.name
          });
          return sendJson(response, 201, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "DELETE" && pathname.match(/^\/api\/worlds\/[^\/]+\/assets$/)) {
        try {
          const queryParams = getQueryParams(request.url);
          const assetPath = queryParams.get("path");
          if (!assetPath) return sendJson(response, 400, { error: "Missing asset path" });
          const result = await deleteAsset(worldId, assetPath);
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }
    }

    if (pathname.match(/^\/api\/worlds\/[^\/]+\/documents$/)) {
      const worldId = getWorldIdFromPath(request.url);
      if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
      if ((currentUser || !isPublicGet) && !(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;

      if (request.method === "POST") {
        try {
          const body = await parseJsonBody(request);
          if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
          const result = await createDocument(worldId, body.path, body.content || "", {
            ...body.metadata,
            createdBy: currentUser?.userId || body.metadata?.createdBy,
            ownerUserId: currentUser?.userId || body.metadata?.ownerUserId,
            visibility: body.metadata?.visibility || "world"
          });
          return sendJson(response, 201, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "GET") {
        try {
          const queryParams = getQueryParams(request.url);
          const filePath = queryParams.get("path");
          if (!filePath) return sendJson(response, 400, { error: "Missing path parameter" });
          const result = await readDocument(worldId, filePath);
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "PUT") {
        try {
          const body = await parseJsonBody(request);
          if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
          const result = await updateDocumentContent(worldId, body.path, body.content || "");
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }

      if (request.method === "DELETE") {
        try {
          const queryParams = getQueryParams(request.url);
          const filePath = queryParams.get("path");
          if (!filePath) return sendJson(response, 400, { error: "Missing path parameter" });
          const result = await deleteDocument(worldId, filePath);
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents\/placeholder$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        if (!(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
        const body = await parseJsonBody(request);
        if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
        const result = await createDocumentPlaceholder(worldId, body.path, {
          ...body.metadata,
          createdBy: currentUser?.userId || body.metadata?.createdBy,
          ownerUserId: currentUser?.userId || body.metadata?.ownerUserId,
          visibility: body.metadata?.visibility || "world"
        });
        return sendJson(response, 201, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "PATCH" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents\/rename$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        if (!(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
        const body = await parseJsonBody(request);
        if (!body.path || !body.newName) return sendJson(response, 400, { error: "Missing path or newName" });
        const result = await renameDocument(worldId, body.path, body.newName);
        return sendJson(response, 200, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "PATCH" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents\/move$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        if (!(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
        const body = await parseJsonBody(request);
        if (!body.sourcePath || !body.targetPath) return sendJson(response, 400, { error: "Missing sourcePath or targetPath" });
        const result = await moveDocument(worldId, body.sourcePath, body.targetPath);
        return sendJson(response, 200, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents\/duplicate$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        if (!(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
        const body = await parseJsonBody(request);
        if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
        const result = await duplicateDocument(worldId, body.path, {
          includeChildren: Boolean(body.includeChildren),
          name: body.name,
          metadataOverrides: {
            createdBy: currentUser?.userId,
            ownerUserId: currentUser?.userId,
            visibility: "world"
          }
        });
        return sendJson(response, 201, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "PUT" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents\/metadata$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        if (!(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
        const body = await parseJsonBody(request);
        if (!body.path || !body.metadata) return sendJson(response, 400, { error: "Missing path or metadata" });
        const result = await updateDocumentMetadata(worldId, body.path, body.metadata);
        return sendJson(response, 200, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "PUT" && pathname.endsWith("/homepage")) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!requireAdmin(response, currentUser)) return;
        const body = await parseJsonBody(request);
        const data = await setHomePage(worldId, body.homePage);
        return sendJson(response, 200, data);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "GET" && pathname.endsWith("/config")) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if ((currentUser || !isPublicGet) && !(await requireWorldMemberOrAdmin(response, worldId, currentUser))) return;
        const data = await getWorldConfig(worldId);
        return sendJson(response, 200, data);
      } catch (error) {
        return sendJson(response, 200, {});
      }
    }

    return sendJson(response, 404, { error: "API Route Not Found" });
  }

  const clientDistDir = path.resolve(process.cwd(), "client", "dist");
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  const isStaticServed = await serveStaticFile(response, clientDistDir, targetPath);
  if (!isStaticServed) {
    await serveStaticFile(response, clientDistDir, "/index.html");
  }
}

module.exports = { isPublicReadEnabled, isPublicReadRequest, router };
