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
  getFileTree,
  updateDocumentMetadata,
  updateWorld
} = require("../../src/services");
const { generateSessionToken } = require("../../src/utils/auth");

const createdWorlds = new Set();

function createPngBytes(suffix = "") {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(suffix)
  ]);
}

function createOpusBytes() {
  return Buffer.concat([
    Buffer.from("OggS"),
    Buffer.alloc(24),
    Buffer.from("OpusHead"),
    Buffer.alloc(16)
  ]);
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

test("document covers keep working by asset id after the image moves", async () => {
  const worldName = "route-document-cover";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });
  const document = await createDocument(worldName, "Atlas", "", { type: "container" });
  const image = createPngBytes("cover");

  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=atlas.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: image
  });
  assert.equal(upload.status, 201);

  const save = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/cover`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: upload.json.id })
  });
  assert.equal(save.status, 200);
  assert.equal(save.json.coverAssetId, upload.json.id);
  assert.deepEqual(save.json.metadata, {
    coverAssetId: upload.json.id,
    coverAssetPath: null,
    coverPositionX: 50,
    coverPositionY: 50,
    coverCrop: null,
    coverZoom: 1,
    coverCroppedArea: null
  });
  const tree = await getFileTree(worldName);
  assert.equal(tree[0].metadata.coverAssetId, upload.json.id);
  assert.equal(tree[0].metadata.coverAssetPath, null);

  const folder = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/folders`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ name: "Covers" })
  });
  const move = await invokeRouter({
    method: "PATCH",
    url: `/api/worlds/${worldName}/assets/move`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ id: upload.json.id, targetFolderId: folder.json.id })
  });
  assert.equal(move.status, 200);
  assert.equal(move.json.id, upload.json.id);
  assert.equal(move.json.path, "Covers/atlas.png");

  const rename = await invokeRouter({
    method: "PATCH",
    url: `/api/worlds/${worldName}/assets/rename`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ id: upload.json.id, newName: "world-atlas.png" })
  });
  assert.equal(rename.status, 200);
  assert.equal(rename.json.id, upload.json.id);
  assert.equal(rename.json.path, "Covers/world-atlas.png");

  await updateWorld(worldName, { publicRead: true });
  const direct = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}`
  });
  assert.equal(direct.status, 403);

  const cover = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}&documentUid=${document.uid}`
  });
  assert.equal(cover.status, 200);
  assert.equal(cover.headers["content-type"], "image/png");
  assert.deepEqual(cover.body, image);

  const legacyDocument = await createDocument(worldName, "Legacy Atlas", "", {
    type: "container",
    coverAssetPath: rename.json.path
  });
  const legacyTab = await createDocument(worldName, `${legacyDocument.path}/Overview`, "", {
    type: "tab",
    contentType: "tiptap"
  });
  const legacyContext = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}&tabUid=${legacyTab.uid}`
  });
  assert.equal(legacyContext.status, 403);

  const remove = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/cover`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: null })
  });
  assert.equal(remove.status, 200);
  assert.equal(remove.json.coverAssetId, null);

  const removedContext = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}&documentUid=${document.uid}`
  });
  assert.equal(removedContext.status, 403);
});

test("document cover updates validate media, locks, and write access", async () => {
  const worldName = "route-document-cover-permissions";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });
  const suffix = Date.now();
  const owner = await createUser({ username: `cover-owner-${suffix}`, password: "secret-pass" });
  const reader = await createUser({ username: `cover-reader-${suffix}`, password: "secret-pass" });
  await addWorldMember(worldName, owner.id);
  await addWorldMember(worldName, reader.id);
  const document = await createDocument(worldName, "Private Atlas", "", {
    type: "container",
    ownerUserId: owner.id
  });
  await updateDocumentMetadata(worldName, document.path, {
    permissions: {
      inherit: false,
      users: { [reader.id]: "read" }
    }
  });

  const imageUpload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=cover.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: createPngBytes()
  });
  const audioUpload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=cover.opus`,
    headers: authenticatedHeaders({ "content-type": "audio/opus" }),
    body: createOpusBytes()
  });

  const invalidMedia = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/cover`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: audioUpload.json.id })
  });
  assert.equal(invalidMedia.status, 415);

  const readOnly = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/cover`,
    headers: userHeaders(reader, { "content-type": "application/json" }),
    body: JSON.stringify({ assetId: imageUpload.json.id })
  });
  assert.equal(readOnly.status, 403);

  await updateDocumentMetadata(worldName, document.path, { locked: true });
  const locked = await invokeRouter({
    method: "PUT",
    url: `/api/worlds/${worldName}/documents/${document.uid}/cover`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ assetId: imageUpload.json.id })
  });
  assert.equal(locked.status, 403);
});
