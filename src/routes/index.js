const { sendJson } = require("../utils/http");

function router(request, response) {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "mythra-backend"
    });
    return;
  }

  sendJson(response, 404, {
    error: "Not Found"
  });
}

module.exports = {
  router
};
