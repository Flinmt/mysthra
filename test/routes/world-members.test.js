const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { Readable } = require("node:stream");
const test = require("node:test");

const { router } = require("../../src/routes");
const { resolveWorldRoot } = require("../../src/data");
const { addWorldMember, createUser, createWorld, updateWorldMemberRole } = require("../../src/services");
const { generateSessionToken } = require("../../src/utils/auth");

const createdWorlds = new Set();

async function invokeRouter({ method, url, headers = {} }) {
  const request = new Readable({
    read() {
      this.push(null);
    }
  });
  request.method = method;
  request.url = url;
  request.headers = { "content-length": "0", ...headers };

  let responseBody = "";
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, responseHeaders = {}) {
      this.statusCode = statusCode;
      for (const [name, value] of Object.entries(responseHeaders)) this.setHeader(name, value);
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

test("world managers can list users available for membership", async () => {
  const suffix = Date.now();
  const worldName = `route-world-members-${suffix}`;
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const manager = await createUser({ username: `manager-${suffix}`, password: "secret-pass" });
  const available = await createUser({ username: `available-${suffix}`, password: "secret-pass" });
  await addWorldMember(worldName, manager.id);
  await updateWorldMemberRole(worldName, manager.id, "admin");

  const token = generateSessionToken({ userId: manager.id, username: manager.username });
  const response = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/available-users`,
    headers: { cookie: `mysthra_session=${token}` }
  });

  assert.equal(response.status, 200);
  assert.equal(response.json.items.some((user) => user.id === available.id), true);
  assert.equal(response.json.items.some((user) => Object.hasOwn(user, "passwordHash")), false);
});
