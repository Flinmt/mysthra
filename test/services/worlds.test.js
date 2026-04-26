const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { getWorldPaths, resolveWorldRoot } = require("../../src/data");
const {
  createWorld,
  getThumbnailUrl,
  getWorldThumbnail,
  parseThumbnailBase64,
  updateWorld
} = require("../../src/services/worlds");

const TINY_PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const createdWorlds = new Set();

async function resetWorld(worldName) {
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("parseThumbnailBase64 accepts supported image data URLs", () => {
  const buffer = parseThumbnailBase64(TINY_PNG_DATA_URL);

  assert.equal(Buffer.isBuffer(buffer), true);
  assert.equal(buffer.length > 0, true);
});

test("parseThumbnailBase64 rejects unsupported image types", () => {
  assert.throws(
    () => parseThumbnailBase64("data:image/svg+xml;base64,PHN2Zy8+"),
    { code: "INVALID_THUMBNAIL" }
  );
});

test("createWorld processes thumbnail uploads into webp files", async () => {
  const worldName = "world-thumbnail-create-test";
  await resetWorld(worldName);

  const world = await createWorld({
    name: worldName,
    description: "Thumbnail test",
    thumbnailBase64: TINY_PNG_DATA_URL
  });
  const worldPaths = getWorldPaths(worldName);
  const thumbnailPath = path.join(worldPaths.media, "thumbnail.webp");
  const thumbnail = await getWorldThumbnail(worldName);

  assert.equal(typeof world.thumbnailUpdatedAt, "number");
  assert.equal(world.thumbnailUrl, getThumbnailUrl(worldName, world.thumbnailUpdatedAt));
  assert.equal(thumbnail.path, thumbnailPath);
  assert.equal(thumbnail.mimeType, "image/webp");
  assert.equal((await fs.stat(thumbnailPath)).isFile(), true);
});

test("updateWorld replaces old thumbnails with the processed webp thumbnail", async () => {
  const worldName = "world-thumbnail-update-test";
  await resetWorld(worldName);

  const createdWorld = await createWorld({
    name: worldName,
    thumbnailBase64: TINY_PNG_DATA_URL
  });
  const worldPaths = getWorldPaths(worldName);
  await fs.writeFile(path.join(worldPaths.media, "thumbnail.png"), Buffer.from("old"));

  const world = await updateWorld(worldName, {
    thumbnailBase64: TINY_PNG_DATA_URL
  });

  assert.notEqual(world.thumbnailUrl, createdWorld.thumbnailUrl);
  assert.equal(world.thumbnailUrl, getThumbnailUrl(worldName, world.thumbnailUpdatedAt));
  assert.equal(world.thumbnailUpdatedAt > createdWorld.thumbnailUpdatedAt, true);
  await assert.rejects(
    () => fs.stat(path.join(worldPaths.media, "thumbnail.png")),
    { code: "ENOENT" }
  );
  assert.equal((await fs.stat(path.join(worldPaths.media, "thumbnail.webp"))).isFile(), true);
});

test("createWorld rejects malformed thumbnail images", async () => {
  const worldName = "world-thumbnail-invalid-test";
  await resetWorld(worldName);

  await assert.rejects(
    () => createWorld({
      name: worldName,
      thumbnailBase64: "data:image/png;base64,not-a-real-image"
    }),
    { code: "INVALID_THUMBNAIL" }
  );
});
