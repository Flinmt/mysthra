const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const {
  assertPathInsideRoot,
  ensureWorldStructure,
  getWorldPaths,
  getWorldsRoot,
  resolveWorldPath,
  resolveWorldRoot,
  validateFileName,
  validateWorldName
} = require("../../src/data");

const createdWorlds = new Set();

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("validateWorldName accepts safe world names", () => {
  assert.equal(validateWorldName("eldoria"), "eldoria");
  assert.equal(validateWorldName("kingdom-01"), "kingdom-01");
  assert.equal(validateWorldName("world alpha"), "world alpha");
});

test("validateWorldName rejects traversal attempts and unsafe separators", () => {
  assert.throws(() => validateWorldName("../secret"), { code: "INVALID_PATH" });
  assert.throws(() => validateWorldName("nested/world"), { code: "INVALID_PATH" });
  assert.throws(() => validateWorldName(".."), { code: "INVALID_PATH" });
});

test("validateFileName rejects dangerous relative names", () => {
  assert.equal(validateFileName("chapter-1.md"), "chapter-1.md");
  assert.throws(() => validateFileName("../chapter.md"), { code: "INVALID_PATH" });
  assert.throws(() => validateFileName("chapter/one.md"), { code: "INVALID_PATH" });
  assert.throws(() => validateFileName(""), { code: "INVALID_PATH" });
});

test("resolveWorldRoot stays inside data/worlds root", () => {
  const worldsRoot = getWorldsRoot();
  const resolvedWorldRoot = resolveWorldRoot("safe-world");

  assert.equal(path.dirname(resolvedWorldRoot), worldsRoot);
});

test("resolveWorldPath rejects path traversal segments", () => {
  assert.throws(
    () => resolveWorldPath("safe-world", "..", "evil.md"),
    { code: "INVALID_PATH" }
  );
});

test("assertPathInsideRoot rejects paths outside the allowed root", () => {
  const rootPath = path.join(process.cwd(), "data", "worlds");
  const externalPath = path.resolve(rootPath, "..", "escape");

  assert.throws(
    () => assertPathInsideRoot(rootPath, externalPath),
    { code: "INVALID_PATH" }
  );
});

test("ensureWorldStructure creates all standard world directories", async () => {
  const worldName = "task-1-3-world";
  createdWorlds.add(worldName);
  const worldPaths = await ensureWorldStructure(worldName);

  await Promise.all(
    Object.values(worldPaths).map(async (directoryPath) => {
      const stats = await fs.stat(directoryPath);
      assert.equal(stats.isDirectory(), true);
    })
  );

  assert.equal(path.basename(worldPaths.assets), "assets");
  await assert.rejects(
    () => fs.stat(path.join(worldPaths.worldRoot, "Assets")),
    { code: "ENOENT" }
  );

  assert.deepEqual(getWorldPaths(worldName), worldPaths);
});
