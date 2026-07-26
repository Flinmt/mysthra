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
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

async function serveStaticFile(response, rootDir, urlPath) {
  try {
    const rootPath = path.resolve(rootDir);
    const decodedPath = decodeURIComponent(urlPath);
    const relativePath = decodedPath.replace(/^[/\\]+/, "");
    let filePath = path.resolve(rootPath, relativePath);

    const rootRelativePath = path.relative(rootPath, filePath);
    if (rootRelativePath.startsWith("..") || path.isAbsolute(rootRelativePath)) {
      return false;
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch (e) {
      // File not found
      return false;
    }

    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      const directoryRelativePath = path.relative(rootPath, filePath);
      if (directoryRelativePath.startsWith("..") || path.isAbsolute(directoryRelativePath)) {
        return false;
      }
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
