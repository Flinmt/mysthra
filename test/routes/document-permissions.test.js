const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { Readable } = require("node:stream");
const test = require("node:test");

const { router } = require("../../src/routes");
const { resolveWorldRoot } = require("../../src/data");
const {
  addWorldMember,
  createDocument,
  createUser,
  createWorld,
  updateDocumentMetadata
} = require("../../src/services");
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

test("document content PUT rejects users with read-only document access", async () => {
  const worldName = "route-document-permissions";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const owner = await createUser({ username: `route-owner-${Date.now()}`, password: "secret-pass" });
  const reader = await createUser({ username: `route-reader-${Date.now()}`, password: "secret-pass" });
  await addWorldMember(worldName, owner.id);
  await addWorldMember(worldName, reader.id);

  const container = await createDocument(worldName, "Private", "", { type: "container", ownerUserId: owner.id });
  const tab = await createDocument(worldName, `${container.path}/Notes`, "Original", { type: "tab", contentType: "markdown", ownerUserId: owner.id });
  await updateDocumentMetadata(worldName, container.path, {
    permissions: {
      inherit: false,
      users: {
        [reader.id]: "read"
      }
    }
  });

  const token = generateSessionToken({ userId: reader.id, username: reader.username });
  const response = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents`,
    headers: {
      "Content-Type": "application/json",
      cookie: `mysthra_session=${token}`
    },
    body: JSON.stringify({ path: tab.path, content: "Changed" })
  });

  assert.equal(response.status, 403);
  assert.equal(response.json.error, "Forbidden");
});

test("document tree hides documents explicitly denied to a world member", async () => {
  const worldName = "route-document-tree-permissions";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const owner = await createUser({ username: `tree-owner-${Date.now()}`, password: "secret-pass" });
  const denied = await createUser({ username: `tree-denied-${Date.now()}`, password: "secret-pass" });
  await addWorldMember(worldName, owner.id);
  await addWorldMember(worldName, denied.id);

  const visible = await createDocument(worldName, "Visible", "", { type: "container", ownerUserId: owner.id });
  const hidden = await createDocument(worldName, "Hidden", "", { type: "container", ownerUserId: owner.id });
  await updateDocumentMetadata(worldName, hidden.path, {
    permissions: {
      inherit: true,
      users: {
        [denied.id]: "none"
      }
    }
  });

  const token = generateSessionToken({ userId: denied.id, username: denied.username });
  const response = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/tree`,
    headers: { cookie: `mysthra_session=${token}` }
  });

  assert.equal(response.status, 200);
  assert.equal(response.json.items.some((node) => node.path === visible.path), true);
  assert.equal(response.json.items.some((node) => node.path === hidden.path), false);
});

test("document placeholder creation rejects users with read-only parent access", async () => {
  const worldName = "route-document-create-permissions";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const owner = await createUser({ username: `create-owner-${Date.now()}`, password: "secret-pass" });
  const reader = await createUser({ username: `create-reader-${Date.now()}`, password: "secret-pass" });
  await addWorldMember(worldName, owner.id);
  await addWorldMember(worldName, reader.id);

  const container = await createDocument(worldName, "ReadOnly", "", { type: "container", ownerUserId: owner.id });
  await updateDocumentMetadata(worldName, container.path, {
    permissions: {
      inherit: false,
      users: {
        [reader.id]: "read"
      }
    }
  });

  const token = generateSessionToken({ userId: reader.id, username: reader.username });
  const response = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/documents/placeholder`,
    headers: {
      "Content-Type": "application/json",
      cookie: `mysthra_session=${token}`
    },
    body: JSON.stringify({
      path: `${container.path}/New Tab`,
      metadata: { type: "tab", contentType: "wiki" }
    })
  });

  assert.equal(response.status, 403);
  assert.equal(response.json.error, "Forbidden");
});
