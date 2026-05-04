const { sendJson } = require("../utils/http");
const { serveStaticFile } = require("../utils/static");
const {
  createExpiredSessionCookie,
  createSessionCookie,
  generateSessionToken,
  getMasterPassword,
  clearSession,
  isAuthenticated,
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
  getWorldConfig,
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
  if (error.code === "INVALID_WORLD_INPUT" || error.code === "INVALID_THUMBNAIL") return 400;
  if (error.code === "WORLD_ALREADY_EXISTS") return 409;
  if (error.code === "WORLD_NOT_FOUND") return 404;
  if (error.code === "DOCUMENT_NOT_FOUND") return 404;
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
        const masterPassword = getMasterPassword();
        if (typeof password === "string" && safeCompare(password, masterPassword)) {
          const token = generateSessionToken();
          response.setHeader("Set-Cookie", createSessionCookie(token, request));
          sendJson(response, 200, { success: true });
        } else {
          sendJson(response, 401, { error: "Invalid password" });
        }
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
      return sendJson(response, 200, { authenticated: isAuthenticated(request) });
    }

    const isPublicGet = isPublicReadEnabled() && isPublicReadRequest(request.method, pathname);
    if (!isPublicGet && !isAuthenticated(request)) {
      return sendJson(response, 401, { error: "Unauthorized" });
    }

    if (request.method === "GET" && pathname === "/api/worlds") {
      try {
        const worlds = await listWorlds();
        return sendJson(response, 200, { items: worlds });
      } catch (error) {
        return sendJson(response, 500, { error: "Failed to list worlds" });
      }
    }

    if (request.method === "POST" && pathname === "/api/worlds") {
      try {
        const body = await parseJsonBody(request);
        const world = await createWorld(body);
        return sendJson(response, 201, world);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (pathname.match(/^\/api\/worlds\/[^\/]+$/)) {
      const worldId = getWorldIdFromPath(request.url);
      if (!worldId) return sendJson(response, 400, { error: "Missing world id" });

      if (request.method === "PUT") {
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
        const tree = await getFileTree(worldId);
        return sendJson(response, 200, { items: tree });
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (pathname.match(/^\/api\/worlds\/[^\/]+\/documents$/)) {
      const worldId = getWorldIdFromPath(request.url);
      if (!worldId) return sendJson(response, 400, { error: "Missing world id" });

      if (request.method === "POST") {
        try {
          const body = await parseJsonBody(request);
          if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
          const result = await createDocument(worldId, body.path, body.content || "", body.metadata || {});
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
        const body = await parseJsonBody(request);
        if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
        const result = await createDocumentPlaceholder(worldId, body.path, body.metadata || {});
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
        const body = await parseJsonBody(request);
        if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
        const result = await duplicateDocument(worldId, body.path, {
          includeChildren: Boolean(body.includeChildren),
          name: body.name
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
