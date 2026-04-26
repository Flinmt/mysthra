const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { serveStaticFile } = require("../../src/utils/static");

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

test("serveStaticFile serves files inside the static root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mysthra-static-"));
  await fs.writeFile(path.join(root, "index.html"), "<h1>Mysthra</h1>", "utf8");

  const response = createResponseRecorder();
  const served = await serveStaticFile(response, root, "/index.html");

  assert.equal(served, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.toString(), "<h1>Mysthra</h1>");
});

test("serveStaticFile rejects directory traversal outside the static root", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "mysthra-static-parent-"));
  const root = path.join(parent, "dist");
  await fs.mkdir(root);
  await fs.writeFile(path.join(parent, "secret.txt"), "hidden", "utf8");

  const response = createResponseRecorder();
  const served = await serveStaticFile(response, root, "/../secret.txt");

  assert.equal(served, false);
  assert.equal(response.body, null);
});
