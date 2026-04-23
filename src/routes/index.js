const { sendJson } = require("../utils/http");
const { listPages } = require("../services");

function getQueryParams(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  return url.searchParams;
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

      const pages = await listPages(worldName);

      sendJson(response, 200, {
        items: pages
      });
      return;
    } catch (error) {
      const statusCode = error.code === "INVALID_PATH" ? 400 : 500;
      const message = statusCode === 400 ? error.message : "Internal Server Error";

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
