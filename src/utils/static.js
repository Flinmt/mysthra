const fs = require("node:fs/promises");
const path = require("node:path");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

async function serveStaticFile(response, rootDir, urlPath) {
  try {
    // Basic security to prevent directory traversal
    const safeSuffix = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
    let filePath = path.join(rootDir, safeSuffix);

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch (e) {
      // File not found
      return false;
    }

    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      try {
        stat = await fs.stat(filePath);
      } catch (e) {
        return false;
      }
    }

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || "application/octet-stream";

    const content = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
    return true;
  } catch (error) {
    console.error("Static file serving error:", error);
    return false;
  }
}

module.exports = {
  serveStaticFile,
};
