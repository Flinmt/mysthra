const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");

const { router } = require("../../src/routes");
const { generateSessionToken } = require("../../src/utils/auth");

const colors = {
  background: "#101112",
  surface: "#202122",
  text: "#f0f1f2",
  mutedText: "#a0a1a2",
  accent: "#a05030",
  secondaryAccent: "#306070"
};

async function invokeRouter({ method, url, token, body }) {
  const bodyBuffer = Buffer.from(body ? JSON.stringify(body) : "");
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
    ...(token ? { cookie: `mysthra_session=${token}` } : {})
  };

  let responseBody = "";
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
    },
    write(chunk) {
      responseBody += String(chunk);
    },
    end(chunk = "") {
      if (chunk) this.write(chunk);
    }
  };

  await router(request, response);
  return {
    status: response.statusCode,
    json: responseBody ? JSON.parse(responseBody) : null
  };
}

let temporaryDirectory;
let previousPresetFile;

test.before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "mysthra-theme-routes-"));
  previousPresetFile = process.env.THEME_PRESETS_FILE;
  process.env.THEME_PRESETS_FILE = path.join(temporaryDirectory, "theme-presets.json");
});

test.after(async () => {
  if (previousPresetFile === undefined) delete process.env.THEME_PRESETS_FILE;
  else process.env.THEME_PRESETS_FILE = previousPresetFile;
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test("authenticated users can list presets while only global admins can mutate them", async () => {
  const adminToken = generateSessionToken({ userId: "root", username: "admin", globalRole: "root" });
  const userToken = generateSessionToken({ userId: "member", username: "member", globalRole: null });

  let response = await invokeRouter({
    method: "POST",
    url: "/api/theme-presets",
    token: userToken,
    body: { name: "Forbidden", baseTheme: "default", colors }
  });
  assert.equal(response.status, 403);

  response = await invokeRouter({
    method: "POST",
    url: "/api/theme-presets",
    token: adminToken,
    body: { name: "Shared Archive", baseTheme: "ember-archive", colors }
  });
  assert.equal(response.status, 201);
  const presetId = response.json.id;

  response = await invokeRouter({
    method: "GET",
    url: "/api/theme-presets",
    token: userToken
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.items[0].name, "Shared Archive");

  response = await invokeRouter({
    method: "DELETE",
    url: `/api/theme-presets/${presetId}`,
    token: adminToken
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { success: true });
});

test("preset routes require authentication and reject invalid imports", async () => {
  const adminToken = generateSessionToken({ userId: "root", username: "admin", globalRole: "root" });
  let response = await invokeRouter({ method: "GET", url: "/api/theme-presets" });
  assert.equal(response.status, 401);

  response = await invokeRouter({
    method: "POST",
    url: "/api/theme-presets/import",
    token: adminToken,
    body: { format: "unknown", version: 1, presets: [] }
  });
  assert.equal(response.status, 400);
});
