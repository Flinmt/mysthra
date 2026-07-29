const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { Readable } = require("node:stream");
const test = require("node:test");

const { resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const {
  addWorldMember,
  createDocument,
  createUser,
  createWorld,
  updateDocumentMetadata,
  updateWorld
} = require("../../src/services");
const { generateSessionToken } = require("../../src/utils/auth");

const createdWorlds = new Set();

function createOpusBytes() {
  return Buffer.concat([
    Buffer.from("OggS"),
    Buffer.alloc(24),
    Buffer.from("OpusHead"),
    Buffer.alloc(16)
  ]);
}

function createPngBytes() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

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
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
  };

  const chunks = [];
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
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    },
    end(chunk = "") {
      if (chunk) this.write(chunk);
    }
  };

  await router(request, response);
  const responseBody = Buffer.concat(chunks);
  return {
    status: response.statusCode,
    headers: response.headers,
    body: responseBody,
    json: responseBody.length && String(response.headers["content-type"] || "").startsWith("application/json")
      ? JSON.parse(responseBody.toString("utf-8"))
      : null
  };
}

function authenticatedHeaders(extra = {}) {
  const token = generateSessionToken({ userId: "root", username: "admin", globalRole: "root" });
  return {
    cookie: `mysthra_session=${token}`,
    ...extra
  };
}

function userHeaders(user, extra = {}) {
  const token = generateSessionToken({ userId: user.id, username: user.username });
  return {
    cookie: `mysthra_session=${token}`,
    ...extra
  };
}

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("document soundtrack routes validate, persist, expose, and remove an audio asset", async () => {
  const worldName = "route-document-soundtrack";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });
  const document = await createDocument(worldName, "Tavern", "", { type: "container" });

  const audioUpload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=tavern.opus`,
    headers: authenticatedHeaders({ "content-type": "audio/opus" }),
    body: createOpusBytes()
  });
  assert.equal(audioUpload.status, 201);

  const save = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: audioUpload.json.id, defaultVolume: 0.35 })
  });
  assert.equal(save.status, 200);
  assert.deepEqual(save.json.soundtrack, {
    assetId: audioUpload.json.id,
    defaultVolume: 0.35,
    name: "tavern.opus",
    unavailable: false
  });

  const read = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders()
  });
  assert.equal(read.status, 200);
  assert.deepEqual(read.json, save.json);

  const invalidVolume = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: audioUpload.json.id, defaultVolume: 1.1 })
  });
  assert.equal(invalidVolume.status, 400);

  const imageUpload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=cover.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: createPngBytes()
  });
  assert.equal(imageUpload.status, 201);
  const invalidMedia = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: imageUpload.json.id, defaultVolume: 0.35 })
  });
  assert.equal(invalidMedia.status, 415);

  await updateDocumentMetadata(worldName, document.path, { locked: true });
  const locked = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: null })
  });
  assert.equal(locked.status, 403);
  await updateDocumentMetadata(worldName, document.path, { locked: false });

  const remove = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: null })
  });
  assert.equal(remove.status, 200);
  assert.equal(remove.json.soundtrack, null);
});

test("public visitors can read and stream only the soundtrack attached to an accessible document", async () => {
  const worldName = "route-public-document-soundtrack";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });
  const document = await createDocument(worldName, "Public Tavern", "", { type: "container" });

  const audio = createOpusBytes();
  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=public-tavern.opus`,
    headers: authenticatedHeaders({ "content-type": "audio/opus" }),
    body: audio
  });
  await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: upload.json.id, defaultVolume: 0.2 })
  });
  await updateWorld(worldName, { publicRead: true });

  const soundtrack = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`
  });
  assert.equal(soundtrack.status, 200);
  assert.equal(soundtrack.json.soundtrack.assetId, upload.json.id);

  const direct = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}`
  });
  assert.equal(direct.status, 403);

  const inDocument = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}&documentUid=${document.uid}`
  });
  assert.equal(inDocument.status, 200);
  assert.equal(inDocument.headers["content-type"], "audio/ogg");
  assert.deepEqual(inDocument.body, audio);

  const otherDocument = await createDocument(worldName, "Other", "", { type: "container" });
  const wrongContext = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}&documentUid=${otherDocument.uid}`
  });
  assert.equal(wrongContext.status, 403);
});

test("read-only document members can read but cannot configure its soundtrack", async () => {
  const worldName = "route-readonly-document-soundtrack";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });
  const suffix = Date.now();
  const owner = await createUser({ username: `soundtrack-owner-${suffix}`, password: "secret-pass" });
  const reader = await createUser({ username: `soundtrack-reader-${suffix}`, password: "secret-pass" });
  await addWorldMember(worldName, owner.id);
  await addWorldMember(worldName, reader.id);
  const document = await createDocument(worldName, "Private Tavern", "", {
    type: "container",
    ownerUserId: owner.id
  });
  await updateDocumentMetadata(worldName, document.path, {
    permissions: {
      inherit: false,
      users: { [reader.id]: "read" }
    }
  });

  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=private.opus`,
    headers: authenticatedHeaders({ "content-type": "audio/opus" }),
    body: createOpusBytes()
  });
  await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: upload.json.id, defaultVolume: 0.35 })
  });

  const read = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: userHeaders(reader)
  });
  assert.equal(read.status, 200);

  const update = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/soundtrack`,
    headers: userHeaders(reader, { "content-type": "application/json" }),
    body: JSON.stringify({ assetId: null })
  });
  assert.equal(update.status, 403);
});
