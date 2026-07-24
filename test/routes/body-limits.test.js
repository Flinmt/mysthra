const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { Readable } = require("node:stream");
const test = require("node:test");

const { router, parseSizeLimit } = require("../../src/routes");
const { resolveWorldRoot } = require("../../src/data");
const { createWorld } = require("../../src/services/worlds");
const { generateSessionToken } = require("../../src/utils/auth");

const createdWorlds = new Set();

async function invokeRouter({ method, url, headers = {}, body = "" }) {
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const request = new Readable({
    read() {
      this.push(bodyBuffer);
      this.push(null);
    }
  });
  request.method = method;
  request.url = url;
  request.headers = {
    "content-length": String(bodyBuffer.length),
    ...headers
  };

  let responseBody = "";
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, responseHeaders = {}) {
      this.statusCode = statusCode;
      for (const [name, value] of Object.entries(responseHeaders)) {
        this.setHeader(name, value);
      }
    },
    write(chunk) {
      responseBody += Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk);
    },
    end(chunk = "") {
      if (chunk) this.write(chunk);
    }
  };

  await router(request, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    body: responseBody,
    json: responseBody ? JSON.parse(responseBody) : null
  };
}

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("parseSizeLimit accepts common web size units", () => {
  assert.equal(parseSizeLimit("512kb", 1), 512000);
  assert.equal(parseSizeLimit("1mb", 1), 1000000);
  assert.equal(parseSizeLimit("2MiB", 1), 2 * 1024 * 1024);
  assert.equal(parseSizeLimit("invalid", 123), 123);
});

test("JSON request bodies over the configured limit return 413", async () => {
  const previousLimit = process.env.MAX_JSON_BODY_SIZE;
  process.env.MAX_JSON_BODY_SIZE = "32b";

  try {
    const response = await invokeRouter({
      method: "POST",
      url: "/api/auth/login",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "x".repeat(64) })
    });

    assert.equal(response.status, 413);
    assert.match(response.json.error, /exceeds/);
  } finally {
    if (previousLimit === undefined) delete process.env.MAX_JSON_BODY_SIZE;
    else process.env.MAX_JSON_BODY_SIZE = previousLimit;
  }
});

test("upload request bodies over the configured limit return 413", async () => {
  const previousLimit = process.env.MAX_UPLOAD_SIZE;
  process.env.MAX_UPLOAD_SIZE = "8b";
  const worldName = "route-upload-limit";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });
  const token = generateSessionToken({ userId: "root", username: "admin", globalRole: "root" });

  try {
    const response = await invokeRouter({
      method: "POST",
      url: `/api/worlds/${worldName}/thumbnail?filename=cover.webp`,
      headers: {
        "Content-Type": "image/webp",
        cookie: `mysthra_session=${token}`
      },
      body: Buffer.from("too large")
    });

    assert.equal(response.status, 413);
    assert.match(response.json.error, /exceeds/);
  } finally {
    if (previousLimit === undefined) delete process.env.MAX_UPLOAD_SIZE;
    else process.env.MAX_UPLOAD_SIZE = previousLimit;
  }
});
