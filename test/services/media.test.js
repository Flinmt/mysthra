const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { ensureWorldStructure, resolveWorldRoot } = require("../../src/data");
const {
  createMediaFolder,
  deleteMedia,
  getMediaFile,
  moveMedia,
  resolveMediaPath
} = require("../../src/services/media");

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

test("resolveMediaPath keeps media paths inside the world media directory", async () => {
  const worldName = "media-safe-path-world";
  await resetWorld(worldName);
  const worldPaths = await ensureWorldStructure(worldName);

  const resolved = resolveMediaPath(worldName, "portraits/hero.webp");

  assert.equal(resolved.targetPath, path.join(worldPaths.media, "portraits", "hero.webp"));
  assert.throws(() => resolveMediaPath(worldName, "../world.json"), { code: "INVALID_PATH" });
  assert.throws(() => resolveMediaPath(worldName, "portraits/../../world.json"), { code: "INVALID_PATH" });
});

test("media folder, move, read and delete reject traversal paths", async () => {
  const worldName = "media-traversal-world";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  await assert.rejects(() => createMediaFolder(worldName, "../outside"), { code: "INVALID_PATH" });
  await assert.rejects(() => moveMedia(worldName, "safe.webp", "../outside.webp"), { code: "INVALID_PATH" });
  await assert.rejects(() => getMediaFile(worldName, "../world.json"), { code: "INVALID_PATH" });
  await assert.rejects(() => deleteMedia(worldName, "../world.json"), { code: "INVALID_PATH" });
});
