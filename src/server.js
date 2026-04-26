const http = require("node:http");
const { router } = require("./routes");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const server = http.createServer((request, response) => {
  router(request, response);
});

server.listen(PORT, () => {
  console.log(`Mysthra backend listening on http://localhost:${PORT}`);
});
