const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { ensureWorldStructure, resolveWorldRoot } = require("../../src/data");
const {
  createAssetFolder,
  deleteAsset,
  duplicateAsset,
  listTrash,
  getAssetFile,
  listAssets,
  moveAsset,
  permanentlyDeleteTrashItems,
  renameAsset,
  restoreTrashItems,
  saveAssetFile,
  saveAssetStream
} = require("../../src/services");

const createdWorlds = new Set();

function createWebpBytes(suffix = "") {
  const payload = Buffer.from(suffix);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(payload.length + 4);
  return Buffer.concat([Buffer.from("RIFF"), size, Buffer.from("WEBP"), payload]);
}

test.after(async () => {
  await Promise.all(
    [...createdWorlds].map((worldName) =>
      fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true })
    )
  );
});

test("asset catalog assigns stable ids to legacy files without changing them", async () => {
  const worldName = "service-asset-catalog-migration";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  const worldPaths = await ensureWorldStructure(worldName);
  const legacyBytes = Buffer.from("legacy bytes");
  await fs.writeFile(path.join(worldPaths.assets, "legacy.webp"), legacyBytes);

  const first = await listAssets(worldName);
  const firstAsset = first.items.find((item) => item.path === "legacy.webp");
  assert.match(firstAsset.id, /^[0-9a-f-]{36}$/);

  const second = await listAssets(worldName);
  assert.equal(second.items[0].id, firstAsset.id);
  assert.deepEqual(await fs.readFile(path.join(worldPaths.assets, "legacy.webp")), legacyBytes);

  const catalog = JSON.parse(await fs.readFile(path.join(worldPaths.worldRoot, "assets.json"), "utf-8"));
  assert.equal(catalog.version, 3);
  assert.equal(catalog.items[0].ownerUserId, null);
  assert.equal(catalog.items[0].id, firstAsset.id);
  assert.match(catalog.items[0].sha256, /^[0-9a-f]{64}$/);
});

test("asset ids survive rename and move while copies receive new ids", async () => {
  const worldName = "service-asset-stable-ids";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await ensureWorldStructure(worldName);

  const uploaded = await saveAssetFile(
    worldName,
    "",
    "portrait.webp",
    createWebpBytes("portrait"),
    { contentType: "image/webp", validate: true }
  );
  const folder = await createAssetFolder(worldName, "", "Images");
  assert.match(folder.id, /^[0-9a-f-]{36}$/);
  const moved = await moveAsset(worldName, { id: uploaded.id }, folder.path);
  assert.equal(moved.id, uploaded.id);
  assert.equal(moved.path, "Images/portrait.webp");

  const renamedFolder = await renameAsset(worldName, folder.path, "Artwork");
  assert.equal(renamedFolder.path, "Artwork");
  const resolved = await getAssetFile(worldName, { id: uploaded.id });
  assert.equal(resolved.path, "Artwork/portrait.webp");

  const duplicate = await duplicateAsset(worldName, { id: uploaded.id });
  assert.notEqual(duplicate.id, uploaded.id);
  assert.equal(duplicate.path, "Artwork/portrait Copy.webp");

  await deleteAsset(worldName, { id: uploaded.id });
  await assert.rejects(
    () => getAssetFile(worldName, { id: uploaded.id }),
    { code: "ASSET_NOT_FOUND" }
  );
  assert.equal((await getAssetFile(worldName, { id: duplicate.id })).path, duplicate.path);
});

test("trashed assets keep their ids when restored and can be deleted permanently", async () => {
  const worldName = "service-asset-trash";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await ensureWorldStructure(worldName);

  const uploaded = await saveAssetFile(
    worldName,
    "",
    "recover.webp",
    createWebpBytes("recover"),
    { contentType: "image/webp", validate: true }
  );
  await deleteAsset(worldName, { id: uploaded.id });
  const trash = await listTrash(worldName);
  assert.equal(trash.items[0].id, uploaded.id);
  assert.ok(trash.items[0].expiresAt > trash.items[0].deletedAt);

  const restored = await restoreTrashItems(worldName, [uploaded.id]);
  assert.equal(restored.items[0].id, uploaded.id);
  assert.equal((await getAssetFile(worldName, { id: uploaded.id })).path, "recover.webp");

  await deleteAsset(worldName, { id: uploaded.id });
  const permanentlyDeleted = await permanentlyDeleteTrashItems(worldName, [uploaded.id]);
  assert.equal(permanentlyDeleted.deleted, 1);
  assert.equal((await listTrash(worldName)).items.length, 0);
});

test("concurrent uploads are serialized without filename or catalog conflicts", async () => {
  const worldName = "service-asset-concurrency";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  await ensureWorldStructure(worldName);

  const uploads = await Promise.all([
    saveAssetFile(worldName, "", "map.webp", createWebpBytes("one"), { contentType: "image/webp" }),
    saveAssetFile(worldName, "", "map.webp", createWebpBytes("two"), { contentType: "image/webp" }),
    saveAssetFile(worldName, "", "map.webp", createWebpBytes("three"), { contentType: "image/webp" })
  ]);
  assert.deepEqual(uploads.map((asset) => asset.path), ["map.webp", "map 2.webp", "map 3.webp"]);
  assert.equal(new Set(uploads.map((asset) => asset.id)).size, 3);

  const listing = await listAssets(worldName);
  assert.equal(listing.items.length, 3);
  assert.equal(listing.items.every((asset) => asset.id), true);
});

test("a corrupt asset catalog fails safely instead of replacing stable ids", async () => {
  const worldName = "service-asset-corrupt-catalog";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  const worldPaths = await ensureWorldStructure(worldName);
  await fs.writeFile(path.join(worldPaths.assets, "legacy.webp"), createWebpBytes("legacy"));
  await fs.writeFile(path.join(worldPaths.worldRoot, "assets.json"), "{invalid", "utf-8");

  await assert.rejects(
    () => listAssets(worldName),
    { code: "INVALID_ASSET_CATALOG" }
  );
  assert.equal(await fs.readFile(path.join(worldPaths.worldRoot, "assets.json"), "utf-8"), "{invalid");
});

test("interrupted streamed uploads remove their temporary files", async () => {
  const worldName = "service-asset-interrupted-upload";
  createdWorlds.add(worldName);
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
  const worldPaths = await ensureWorldStructure(worldName);

  async function* interruptedUpload() {
    yield createWebpBytes("partial");
    throw new Error("connection interrupted");
  }

  await assert.rejects(
    () => saveAssetStream(worldName, "", "partial.webp", interruptedUpload(), {
      contentType: "image/webp",
      maxBytes: 1000
    }),
    /connection interrupted/
  );
  assert.deepEqual(await fs.readdir(worldPaths.assets), []);
});
