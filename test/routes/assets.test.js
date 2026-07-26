const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { Readable } = require("node:stream");
const test = require("node:test");
const sharp = require("sharp");

const { resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const { createWorld, updateWorld } = require("../../src/services");
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

  const responseChunks = [];
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
      responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    },
    end(chunk = "") {
      if (chunk) this.write(chunk);
    }
  };

  await router(request, response);
  const responseBody = Buffer.concat(responseChunks);
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

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("asset routes expose capabilities and keep ids stable across file operations", async () => {
  const worldName = "route-asset-contract";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const capabilities = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/capabilities`,
    headers: authenticatedHeaders()
  });
  assert.equal(capabilities.status, 200);
  assert.equal(capabilities.json.maxUploadBytes, 50 * 1000 * 1000);
  assert.equal(capabilities.json.types.image.some((format) => format.extension === "png"), true);
  assert.equal(capabilities.json.types.audio.some((format) => format.extension === "mp3"), true);
  assert.equal(capabilities.json.types.audio.some((format) => format.extension === "opus"), true);

  const png = createPngBytes("asset-contents");
  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=portrait.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: png
  });
  assert.equal(upload.status, 201);
  assert.match(upload.json.id, /^[0-9a-f-]{36}$/);
  assert.equal(upload.json.path, "portrait.png");

  const folder = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/folders`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ name: "Portraits" })
  });
  assert.equal(folder.status, 201);

  const move = await invokeRouter({
    method: "PATCH",
    url: `/api/worlds/${worldName}/assets/move`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ id: upload.json.id, targetFolderPath: folder.json.path })
  });
  assert.equal(move.status, 200);
  assert.equal(move.json.id, upload.json.id);
  assert.equal(move.json.path, "Portraits/portrait.png");

  const rename = await invokeRouter({
    method: "PATCH",
    url: `/api/worlds/${worldName}/assets/rename`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ id: upload.json.id, newName: "hero.png" })
  });
  assert.equal(rename.status, 200);
  assert.equal(rename.json.id, upload.json.id);
  assert.equal(rename.json.path, "Portraits/hero.png");

  const duplicate = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/duplicate`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ id: upload.json.id })
  });
  assert.equal(duplicate.status, 201);
  assert.notEqual(duplicate.json.id, upload.json.id);

  const listing = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets`,
    headers: authenticatedHeaders()
  });
  const listedFolder = listing.json.items.find((item) => item.path === "Portraits");
  assert.equal(listedFolder.children.find((item) => item.path === "Portraits/hero.png").id, upload.json.id);
});

test("asset routes upload and serve Opus audio", async () => {
  const worldName = "route-asset-opus";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const opus = createOpusBytes();
  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=voice.opus`,
    headers: authenticatedHeaders({ "content-type": "audio/opus" }),
    body: opus
  });
  assert.equal(upload.status, 201);
  assert.equal(upload.json.mediaType, "audio");
  assert.equal(upload.json.contentType, "audio/ogg");

  const file = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}`,
    headers: authenticatedHeaders()
  });
  assert.equal(file.status, 200);
  assert.equal(file.headers["content-type"], "audio/ogg");
  assert.deepEqual(file.body, opus);
});

test("asset file responses support ids, legacy paths, HEAD, ranges, and conditional requests", async () => {
  const worldName = "route-asset-delivery";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const png = createPngBytes("0123456789");
  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=map.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: png
  });
  const byIdUrl = `/api/worlds/${worldName}/assets/file?id=${upload.json.id}`;

  const full = await invokeRouter({ method: "GET", url: byIdUrl, headers: authenticatedHeaders() });
  assert.equal(full.status, 200);
  assert.deepEqual(full.body, png);
  assert.equal(full.headers["content-type"], "image/png");
  assert.equal(full.headers["content-length"], String(png.length));
  assert.equal(full.headers["accept-ranges"], "bytes");
  assert.equal(full.headers["x-content-type-options"], "nosniff");
  assert.match(full.headers.etag, /^"[0-9a-f]{64}"$/);

  const legacy = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?path=map.png`,
    headers: authenticatedHeaders()
  });
  assert.deepEqual(legacy.body, png);

  const head = await invokeRouter({ method: "HEAD", url: byIdUrl, headers: authenticatedHeaders() });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers["content-length"], String(png.length));

  const range = await invokeRouter({
    method: "GET",
    url: byIdUrl,
    headers: authenticatedHeaders({ range: "bytes=2-5" })
  });
  assert.equal(range.status, 206);
  assert.deepEqual(range.body, png.subarray(2, 6));
  assert.equal(range.headers["content-range"], `bytes 2-5/${png.length}`);

  const invalidRange = await invokeRouter({
    method: "GET",
    url: byIdUrl,
    headers: authenticatedHeaders({ range: `bytes=${png.length}-` })
  });
  assert.equal(invalidRange.status, 416);
  assert.equal(invalidRange.headers["content-range"], `bytes */${png.length}`);

  const cached = await invokeRouter({
    method: "GET",
    url: byIdUrl,
    headers: authenticatedHeaders({ "if-none-match": `"other", W/${full.headers.etag}` })
  });
  assert.equal(cached.status, 304);
  assert.equal(cached.body.length, 0);

  const deletion = await invokeRouter({
    method: "DELETE",
    url: `/api/worlds/${worldName}/assets?id=${upload.json.id}`,
    headers: authenticatedHeaders()
  });
  assert.equal(deletion.status, 200);
  const missing = await invokeRouter({ method: "GET", url: byIdUrl, headers: authenticatedHeaders() });
  assert.equal(missing.status, 404);
});

test("asset explorer routes provide thumbnails, batch moves, and recycle-bin restore", async () => {
  const worldName = "route-asset-explorer";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });
  const png = await sharp({
    create: { width: 32, height: 24, channels: 4, background: "#a855f7" }
  }).png().toBuffer();

  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=scene.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: png
  });
  const folder = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/folders`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ name: "Scenes" })
  });
  assert.match(folder.json.id, /^[0-9a-f-]{36}$/);

  const thumbnail = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/thumbnail?id=${upload.json.id}&size=160`,
    headers: authenticatedHeaders()
  });
  assert.equal(thumbnail.status, 200);
  assert.equal(thumbnail.headers["content-type"], "image/webp");
  assert.ok(thumbnail.body.length > 0);

  const move = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/actions`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action: "move", itemIds: [upload.json.id], targetFolderId: folder.json.id })
  });
  assert.equal(move.status, 200);
  assert.equal(move.json.items[0].path, "Scenes/scene.png");

  const copyToRoot = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/actions`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action: "copy", itemIds: [upload.json.id], targetFolderPath: "" })
  });
  assert.equal(copyToRoot.status, 200);
  assert.equal(copyToRoot.json.items[0].path, "scene Copy.png");

  const trash = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/actions`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action: "trash", itemIds: [upload.json.id] })
  });
  assert.equal(trash.status, 200);
  const trashListing = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/trash`,
    headers: authenticatedHeaders()
  });
  assert.equal(trashListing.json.items[0].id, upload.json.id);

  const restore = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/actions`,
    headers: authenticatedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action: "restore", itemIds: [upload.json.id] })
  });
  assert.equal(restore.status, 200);
  assert.equal(restore.json.items[0].path, "Scenes/scene.png");
});

test("asset uploads reject unsupported or mismatched media", async () => {
  const worldName = "route-asset-validation";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const mismatch = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=fake.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: Buffer.from("not a png")
  });
  assert.equal(mismatch.status, 415);

  const wrongContentType = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=image.png`,
    headers: authenticatedHeaders({ "content-type": "audio/mpeg" }),
    body: createPngBytes()
  });
  assert.equal(wrongContentType.status, 415);

  const unsupported = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=video.webm`,
    headers: authenticatedHeaders({ "content-type": "video/webm" }),
    body: Buffer.from("webm")
  });
  assert.equal(unsupported.status, 415);

  const worldFiles = await fs.readdir(resolveWorldRoot(worldName), { recursive: true });
  assert.equal(worldFiles.some((filename) => String(filename).includes(".upload-")), false);
});

test("public worlds expose asset reads but keep uploads authenticated", async () => {
  const worldName = "route-public-assets";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  const upload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=public.png`,
    headers: authenticatedHeaders({ "content-type": "image/png" }),
    body: createPngBytes("public")
  });
  await updateWorld(worldName, { publicRead: true });

  const publicRead = await invokeRouter({
    method: "GET",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}`
  });
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.headers["content-type"], "image/png");

  const publicHead = await invokeRouter({
    method: "HEAD",
    url: `/api/worlds/${worldName}/assets/file?id=${upload.json.id}`
  });
  assert.equal(publicHead.status, 200);
  assert.equal(publicHead.body.length, 0);

  const anonymousUpload = await invokeRouter({
    method: "POST",
    url: `/api/worlds/${worldName}/assets/upload?filename=denied.png`,
    headers: { "content-type": "image/png" },
    body: createPngBytes("denied")
  });
  assert.equal(anonymousUpload.status, 401);
});

test("asset uploads enforce MAX_UPLOAD_SIZE before writing", async () => {
  const previousLimit = process.env.MAX_UPLOAD_SIZE;
  process.env.MAX_UPLOAD_SIZE = "8b";
  const worldName = "route-asset-size-limit";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await createWorld({ name: worldName });

  try {
    const response = await invokeRouter({
      method: "POST",
      url: `/api/worlds/${worldName}/assets/upload?filename=large.png`,
      headers: authenticatedHeaders({ "content-type": "image/png" }),
      body: createPngBytes("too large")
    });
    assert.equal(response.status, 413);
    assert.match(response.json.error, /exceeds/);

    const worldFiles = await fs.readdir(resolveWorldRoot(worldName), { recursive: true });
    assert.equal(worldFiles.includes("assets/large.png"), false);
    assert.equal(worldFiles.some((filename) => String(filename).includes(".upload-")), false);
  } finally {
    if (previousLimit === undefined) delete process.env.MAX_UPLOAD_SIZE;
    else process.env.MAX_UPLOAD_SIZE = previousLimit;
  }
});
