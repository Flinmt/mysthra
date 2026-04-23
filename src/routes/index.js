const { sendJson } = require("../utils/http");
const { createPage, deletePage, listPages, loadThemes, readPage, updatePage } = require("../services");

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

  if (pathSegments.length === 2 && pathSegments[0] === "pages") {
    return decodeURIComponent(pathSegments[1]);
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

  return 500;
}

function getErrorMessage(error, statusCode) {
  if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
    return error.message;
  }

  return "Internal Server Error";
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
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "mythra-backend"
    });
    return;
  }

  if (request.method === "GET" && request.url.startsWith("/pages")) {
    try {
      const queryParams = getQueryParams(request.url);
      const worldName = queryParams.get("world");

      if (!worldName) {
        sendJson(response, 400, {
          error: "Missing required query parameter: world"
        });
        return;
      }

      const pageId = getPageIdFromPath(request.url);

      if (pageId) {
        const page = await readPage(worldName, pageId);

        sendJson(response, 200, page);
        return;
      }

      const pages = await listPages(worldName);

      sendJson(response, 200, {
        items: pages
      });
      return;
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      const message = getErrorMessage(error, statusCode);

      sendJson(response, statusCode, {
        error: message
      });
      return;
    }
  }

  if (request.method === "GET" && request.url.startsWith("/themes")) {
    try {
      const queryParams = getQueryParams(request.url);
      const worldName = queryParams.get("world");

      if (!worldName) {
        sendJson(response, 400, {
          error: "Missing required query parameter: world"
        });
        return;
      }

      const themes = await loadThemes(worldName);

      sendJson(response, 200, themes);
      return;
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      const message = getErrorMessage(error, statusCode);

      sendJson(response, statusCode, {
        error: message
      });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/pages") {
    try {
      const body = await parseJsonBody(request);
      const worldName = typeof body.world === "string" ? body.world : "";

      if (!worldName) {
        sendJson(response, 400, {
          error: "Missing required field: world"
        });
        return;
      }

      const page = await createPage(worldName, body);

      sendJson(response, 201, page);
      return;
    } catch (error) {
      const statusCode = error.code === "INVALID_JSON"
        ? 400
        : getErrorStatusCode(error);
      const message = error.code === "INVALID_JSON"
        ? error.message
        : getErrorMessage(error, statusCode);

      sendJson(response, statusCode, {
        error: message
      });
      return;
    }
  }

  if (request.method === "PUT" && request.url.startsWith("/pages/")) {
    try {
      const queryParams = getQueryParams(request.url);
      const worldName = queryParams.get("world");

      if (!worldName) {
        sendJson(response, 400, {
          error: "Missing required query parameter: world"
        });
        return;
      }

      const pageId = getPageIdFromPath(request.url);

      if (!pageId) {
        sendJson(response, 400, {
          error: "Missing required page id"
        });
        return;
      }

      const body = await parseJsonBody(request);
      const page = await updatePage(worldName, pageId, body);

      sendJson(response, 200, page);
      return;
    } catch (error) {
      const statusCode = error.code === "INVALID_JSON"
        ? 400
        : getErrorStatusCode(error);
      const message = error.code === "INVALID_JSON"
        ? error.message
        : getErrorMessage(error, statusCode);

      sendJson(response, statusCode, {
        error: message
      });
      return;
    }
  }

  if (request.method === "DELETE" && request.url.startsWith("/pages/")) {
    try {
      const queryParams = getQueryParams(request.url);
      const worldName = queryParams.get("world");

      if (!worldName) {
        sendJson(response, 400, {
          error: "Missing required query parameter: world"
        });
        return;
      }

      const pageId = getPageIdFromPath(request.url);

      if (!pageId) {
        sendJson(response, 400, {
          error: "Missing required page id"
        });
        return;
      }

      const result = await deletePage(worldName, pageId);

      sendJson(response, 200, result);
      return;
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      const message = getErrorMessage(error, statusCode);

      sendJson(response, statusCode, {
        error: message
      });
      return;
    }
  }

  sendJson(response, 404, {
    error: "Not Found"
  });
}

module.exports = {
  router
};
