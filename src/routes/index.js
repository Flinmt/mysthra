const { sendJson } = require("../utils/http");
const { listPages, readPage } = require("../services");

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

  if (error.code === "PAGE_NOT_FOUND") {
    return 404;
  }

  return 500;
}

function getErrorMessage(error, statusCode) {
  if (statusCode === 400 || statusCode === 404) {
    return error.message;
  }

  return "Internal Server Error";
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

  sendJson(response, 404, {
    error: "Not Found"
  });
}

module.exports = {
  router
};
