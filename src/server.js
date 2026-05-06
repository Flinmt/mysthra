const http = require("node:http");
const { WebSocketServer } = require("ws");
const { router } = require("./routes");
const { COLLABORATION_PATH, createCollaborationServer, initializeIndex } = require("./services");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const server = http.createServer((request, response) => {
  router(request, response);
});

const collaborationServer = createCollaborationServer();
const collaborationWebSocketServer = new WebSocketServer({ noServer: true });

collaborationWebSocketServer.on("connection", (webSocket, request) => {
  const protocol = request.socket.encrypted ? "https" : "http";
  const host = request.headers.host || `localhost:${PORT}`;
  const webRequest = new Request(`${protocol}://${host}${request.url}`, {
    headers: request.headers
  });
  const connection = collaborationServer.handleConnection(webSocket, webRequest);

  webSocket.on("message", (message) => {
    const buffer = Array.isArray(message)
      ? Buffer.concat(message)
      : Buffer.isBuffer(message) ? message : Buffer.from(message);
    connection.handleMessage(buffer);
  });
  webSocket.on("close", (code, reason) => {
    connection.handleClose({ code, reason: reason.toString() });
  });
});

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname !== COLLABORATION_PATH) {
    socket.destroy();
    return;
  }

  collaborationWebSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    collaborationWebSocketServer.emit("connection", webSocket, request);
  });
});

server.listen(PORT, async () => {
  console.log(`Mysthra backend listening on http://localhost:${PORT}`);
  await initializeIndex();
});
