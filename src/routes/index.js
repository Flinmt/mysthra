const { sendJson, sendText } = require("../utils/http");
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
  createPage,
  deletePage,
  listPages,
  loadThemes,
  listTemplates,
  readPage,
  readTemplate,
  saveTemplate,
  createTemplateFolder,
  deleteTemplate,
  moveTemplate,
  readTheme,
  renderPageOutput,
  updatePage,
  listWorlds,
  createWorld,
  updateWorld,
  deleteWorld,
  getWorldThumbnail,
  getFileTree,
  createDocument,
  readDocument,
  updateDocumentMetadata,
  deleteDocument,
  renameDocument,
  moveDocument,
  handleMediaUpload,
  getMediaFile,
  listMedia,
  createMediaFolder,
  moveMedia,
  deleteMedia
} = require("../services");

function getRequestUrl(requestUrl) {
  return new URL(requestUrl, "http://localhost");
}

function getQueryParams(requestUrl) {
  const url = getRequestUrl(requestUrl);
  return url.searchParams;
}

function getPageIdFromPath(requestUrl) {
  const url = getRequestUrl(requestUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 3 && pathSegments[0] === "api" && pathSegments[1] === "pages") {
    return decodeURIComponent(pathSegments[2]);
  }

  return null;
}

function getRenderedPageIdFromPath(requestUrl) {
  const url = getRequestUrl(requestUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 4 && pathSegments[0] === "api" && pathSegments[1] === "pages" && pathSegments[3] === "rendered") {
    return decodeURIComponent(pathSegments[2]);
  }

  return null;
}

function getThemeNameFromPath(requestUrl) {
  const url = getRequestUrl(requestUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 3 && pathSegments[0] === "api" && pathSegments[1] === "themes" && pathSegments[2].endsWith(".css")) {
    return decodeURIComponent(pathSegments[2]).slice(0, -4);
  }

  return null;
}

function getWorldNameFromThumbnailPath(requestUrl) {
  const url = getRequestUrl(requestUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 4 && pathSegments[0] === "api" && pathSegments[1] === "worlds" && pathSegments[3] === "thumbnail") {
    return decodeURIComponent(pathSegments[2]);
  }

  return null;
}

function getWorldIdFromPath(requestUrl) {
  const url = getRequestUrl(requestUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length >= 3 && pathSegments[0] === "api" && pathSegments[1] === "worlds") {
    return decodeURIComponent(pathSegments[2]);
  }

  return null;
}

function getTemplateNameFromPath(requestUrl) {
  const url = getRequestUrl(requestUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 3 && pathSegments[0] === "api" && pathSegments[1] === "templates" && pathSegments[2].endsWith(".html")) {
    return decodeURIComponent(pathSegments[2]).slice(0, -5);
  }

  return null;
}

function getErrorStatusCode(error) {
  if (error.code === "INVALID_PATH") {
    return 400;
  }
  if (error.code === "INVALID_PAGE_INPUT" || error.code === "INVALID_PAGE_TITLE") {
    return 400;
  }
  if (error.code === "PAGE_NOT_FOUND") {
    return 404;
  }
  if (error.code === "PAGE_ALREADY_EXISTS") {
    return 409;
  }
  if (error.code === "THEME_NOT_FOUND") {
    return 404;
  }
  if (error.code === "TEMPLATE_NOT_FOUND") {
    return 404;
  }
  if (error.code === "INVALID_WORLD_INPUT" || error.code === "INVALID_THUMBNAIL") {
    return 400;
  }
  if (error.code === "WORLD_ALREADY_EXISTS") {
    return 409;
  }
  if (error.code === "WORLD_NOT_FOUND") {
    return 404;
  }
  if (error.code === "THUMBNAIL_NOT_FOUND") {
    return 404;
  }
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
  return method === "GET" && (
    pathname.startsWith("/api/worlds") ||
    pathname.startsWith("/api/pages") ||
    pathname.startsWith("/api/themes")
  );
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
  if (!rawBody.trim()) {
    return {};
  }
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

  // Handle API Routes
  if (pathname.startsWith("/api/")) {
    
    // Public API Endpoints
    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        service: "mysthra-backend"
      });
      return;
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
        if (e.code === "AUTH_CONFIGURATION_ERROR") {
          sendJson(response, 500, { error: "Authentication is not configured" });
        } else {
          sendJson(response, 400, { error: "Invalid request" });
        }
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
        if (cookies.mysthra_session) {
          clearSession(cookies.mysthra_session);
        }
      }
      response.setHeader("Set-Cookie", createExpiredSessionCookie(request));
      sendJson(response, 200, { success: true });
      return;
    }

    if (request.method === "GET" && pathname === "/api/auth/verify") {
      if (isAuthenticated(request)) {
        sendJson(response, 200, { authenticated: true });
      } else {
        sendJson(response, 401, { authenticated: false });
      }
      return;
    }

    // Public read must be explicitly enabled for visitor/share mode.
    // Templates remain private because they can expose reusable authoring structure.
    const isPublicGet = isPublicReadEnabled() && isPublicReadRequest(request.method, pathname);

    if (!isPublicGet && !isAuthenticated(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
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
        const statusCode = error.code === "INVALID_JSON" ? 400 : getErrorStatusCode(error);
        const message = error.code === "INVALID_JSON" ? error.message : getErrorMessage(error, statusCode);
        return sendJson(response, statusCode, { error: message });
      }
    }

    if (request.method === "PUT" && pathname.match(/^\/api\/worlds\/[^\/]+$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const body = await parseJsonBody(request);
        const world = await updateWorld(worldId, body);
        return sendJson(response, 200, world);
      } catch (error) {
        const statusCode = error.code === "INVALID_JSON" ? 400 : getErrorStatusCode(error);
        const message = error.code === "INVALID_JSON" ? error.message : getErrorMessage(error, statusCode);
        return sendJson(response, statusCode, { error: message });
      }
    }

    if (request.method === "DELETE" && pathname.match(/^\/api\/worlds\/[^\/]+$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const result = await deleteWorld(worldId);
        return sendJson(response, 200, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
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

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const body = await parseJsonBody(request);
        if (!body.path) return sendJson(response, 400, { error: "Missing document path" });
        
        const result = await createDocument(worldId, body.path, body.content || "");
        return sendJson(response, 201, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
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

    if (request.method === "DELETE" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
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


    if (request.method === "PUT" && pathname.match(/^\/api\/worlds\/[^\/]+\/documents\/metadata$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const body = await parseJsonBody(request);
        if (!body.path || !body.metadata) return sendJson(response, 400, { error: "Missing path or metadata" });
        
        const result = await updateDocumentMetadata(worldId, body.path, body.metadata);
        return sendJson(response, 200, result);
      } catch (error) {
        console.error("METADATA UPDATE ERROR:", error);
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/media$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const result = await handleMediaUpload(worldId, request);
        return sendJson(response, 201, result);
      } catch (error) {
        console.error("MEDIA UPLOAD ERROR:", error);
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "GET" && pathname.match(/^\/api\/worlds\/[^\/]+\/media$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const media = await listMedia(worldId);
        return sendJson(response, 200, { items: media });
      } catch (error) {
        return sendJson(response, 500, { error: "Failed to list media" });
      }
    }

    if (request.method === "POST" && pathname.match(/^\/api\/worlds\/[^\/]+\/media\/folder$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const body = await parseJsonBody(request);
        if (!body.path) return sendJson(response, 400, { error: "Missing folder path" });
        
        const result = await createMediaFolder(worldId, body.path);
        return sendJson(response, 201, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "PATCH" && pathname.match(/^\/api\/worlds\/[^\/]+\/media\/move$/)) {
      try {
        const worldId = getWorldIdFromPath(request.url);
        if (!worldId) return sendJson(response, 400, { error: "Missing world id" });
        
        const body = await parseJsonBody(request);
        if (!body.sourcePath || !body.targetPath) return sendJson(response, 400, { error: "Missing sourcePath or targetPath" });
        
        const result = await moveMedia(worldId, body.sourcePath, body.targetPath);
        return sendJson(response, 200, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (pathname.includes("/media/")) {
      const parts = pathname.split('/media/');
      const worldParts = parts[0].split('/');
      const worldId = decodeURIComponent(worldParts[worldParts.length - 1]);
      const mediaPath = decodeURIComponent(parts[1]);

      if (request.method === "GET") {
        try {
          const { content, contentType } = await getMediaFile(worldId, mediaPath);
          response.writeHead(200, { 
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable" 
          });
          response.end(content);
          return;
        } catch (error) {
          const statusCode = error.code === "INVALID_PATH" ? 400 : 404;
          return sendJson(response, statusCode, { error: statusCode === 400 ? error.message : "File not found" });
        }
      }

      if (request.method === "DELETE") {
        try {
          const result = await deleteMedia(worldId, mediaPath);
          return sendJson(response, 200, result);
        } catch (error) {
          const statusCode = getErrorStatusCode(error);
          return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
        }
      }
    }

    if (request.method === "GET" && pathname.startsWith("/api/worlds/") && pathname.endsWith("/thumbnail")) {
      try {
        const worldName = getWorldNameFromThumbnailPath(request.url);
        if (!worldName) return sendJson(response, 400, { error: "Invalid path" });
        
        const thumbnail = await getWorldThumbnail(worldName);
        const content = await require("node:fs/promises").readFile(thumbnail.path);
        response.writeHead(200, { 
          "Content-Type": thumbnail.mimeType,
          "Cache-Control": "public, max-age=86400"
        });
        response.end(content);
        return;
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "GET" && pathname.startsWith("/api/pages")) {
      try {
        const queryParams = getQueryParams(request.url);
        const worldName = queryParams.get("world");

        if (!worldName) {
          return sendJson(response, 400, { error: "Missing required query parameter: world" });
        }

        const renderedPageId = getRenderedPageIdFromPath(request.url);
        if (renderedPageId) {
          const output = await renderPageOutput(worldName, renderedPageId);
          return sendJson(response, 200, output);
        }

        const pageId = getPageIdFromPath(request.url);
        if (pageId) {
          const page = await readPage(worldName, pageId);
          return sendJson(response, 200, page);
        }

        const pages = await listPages(worldName);
        return sendJson(response, 200, { items: pages });
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (request.method === "GET" && pathname.startsWith("/api/themes")) {
      try {
        const queryParams = getQueryParams(request.url);
        const worldName = queryParams.get("world");

        if (!worldName) {
          return sendJson(response, 400, { error: "Missing required query parameter: world" });
        }

        const themeName = getThemeNameFromPath(request.url);
        if (themeName) {
          const theme = await readTheme(worldName, themeName);
          return sendText(response, 200, theme.css, "text/css; charset=utf-8");
        }

        const themes = await loadThemes(worldName);
        return sendJson(response, 200, themes);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    if (pathname.startsWith("/api/templates")) {
      try {
        if (request.method === "GET") {
          const queryParams = getQueryParams(request.url);
          const filePath = queryParams.get("path");
          
          if (pathname === "/api/templates" || pathname === "/api/templates/") {
            const templates = await listTemplates();
            return sendJson(response, 200, { items: templates });
          }
          
          if (pathname === "/api/templates/read") {
            if (!filePath) return sendJson(response, 400, { error: "Missing path" });
            const template = await readTemplate(filePath);
            return sendText(response, 200, template.content, template.type === 'content' ? "text/markdown" : "text/html");
          }
        }

        if (request.method === "POST") {
          const body = await parseJsonBody(request);
          if (pathname === "/api/templates/folder") {
            if (!body.path) return sendJson(response, 400, { error: "Missing path" });
            const result = await createTemplateFolder(body.path);
            return sendJson(response, 201, result);
          }
          
          const result = await saveTemplate(body.name, body.content, body.parentPath || "", body.type);
          return sendJson(response, 201, result);
        }

        if (request.method === "DELETE") {
          const queryParams = getQueryParams(request.url);
          const filePath = queryParams.get("path");
          if (!filePath) return sendJson(response, 400, { error: "Missing path" });
          const result = await deleteTemplate(filePath);
          return sendJson(response, 200, result);
        }

        if (request.method === "PATCH" && pathname === "/api/templates/move") {
          const body = await parseJsonBody(request);
          if (!body.sourcePath || !body.targetPath) return sendJson(response, 400, { error: "Missing paths" });
          const result = await moveTemplate(body.sourcePath, body.targetPath);
          return sendJson(response, 200, result);
        }
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }


    if (request.method === "POST" && pathname === "/api/pages") {
      try {
        const body = await parseJsonBody(request);
        const worldName = typeof body.world === "string" ? body.world : "";

        if (!worldName) {
          return sendJson(response, 400, { error: "Missing required field: world" });
        }

        const page = await createPage(worldName, body);
        return sendJson(response, 201, page);
      } catch (error) {
        const statusCode = error.code === "INVALID_JSON" ? 400 : getErrorStatusCode(error);
        const message = error.code === "INVALID_JSON" ? error.message : getErrorMessage(error, statusCode);
        return sendJson(response, statusCode, { error: message });
      }
    }

    if (request.method === "PUT" && pathname.startsWith("/api/pages/")) {
      try {
        const queryParams = getQueryParams(request.url);
        const worldName = queryParams.get("world");

        if (!worldName) {
          return sendJson(response, 400, { error: "Missing required query parameter: world" });
        }

        const pageId = getPageIdFromPath(request.url);
        if (!pageId) {
          return sendJson(response, 400, { error: "Missing required page id" });
        }

        const body = await parseJsonBody(request);
        const page = await updatePage(worldName, pageId, body);
        return sendJson(response, 200, page);
      } catch (error) {
        const statusCode = error.code === "INVALID_JSON" ? 400 : getErrorStatusCode(error);
        const message = error.code === "INVALID_JSON" ? error.message : getErrorMessage(error, statusCode);
        return sendJson(response, statusCode, { error: message });
      }
    }

    if (request.method === "DELETE" && pathname.startsWith("/api/pages/")) {
      try {
        const queryParams = getQueryParams(request.url);
        const worldName = queryParams.get("world");

        if (!worldName) {
          return sendJson(response, 400, { error: "Missing required query parameter: world" });
        }

        const pageId = getPageIdFromPath(request.url);
        if (!pageId) {
          return sendJson(response, 400, { error: "Missing required page id" });
        }

        const result = await deletePage(worldName, pageId);
        return sendJson(response, 200, result);
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        return sendJson(response, statusCode, { error: getErrorMessage(error, statusCode) });
      }
    }

    return sendJson(response, 404, { error: "API Route Not Found" });
  }

  // Handle Static Frontend Requests
  const clientDistDir = path.resolve(process.cwd(), "client", "dist");
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  
  const isStaticServed = await serveStaticFile(response, clientDistDir, targetPath);
  
  if (!isStaticServed) {
    // Fallback to index.html for SPA routing
    const fallbackServed = await serveStaticFile(response, clientDistDir, "/index.html");
    if (!fallbackServed) {
      sendText(response, 404, "Mysthra Frontend is not built. Please run 'npm run build' inside the 'client' directory.");
    }
  }
}

module.exports = {
  isPublicReadEnabled,
  isPublicReadRequest,
  router
};
