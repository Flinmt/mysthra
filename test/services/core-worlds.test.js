const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { ensureWorldStructure, getWorldPaths, resolveWorldRoot } = require("../../src/data");
const {
  addWorldMember,
  authenticateUser,
  createDocument,
  createAssetFolder,
  createUser,
  createWorld,
  deleteAsset,
  deleteDocument,
  deleteWorld,
  duplicateAsset,
  duplicateDocument,
  listAssets,
  listWorlds,
  getFileTree,
  moveAsset,
  readDocument,
  renameAsset,
  renameDocument,
  saveAssetFile,
  saveWorldThumbnail,
  setHomePage,
  updateDocumentContent,
  updateDocumentMetadata,
  updateWorld
} = require("../../src/services");

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

test("createWorld stores lean world metadata", async () => {
  const worldName = "core-world-create";
  await resetWorld(worldName);

  const world = await createWorld({
    name: worldName,
    description: "A world in migration"
  });

  assert.equal(world.name, worldName);
  assert.equal(world.displayName, worldName);
  assert.equal(world.description, "A world in migration");
  assert.equal("thumbnailUrl" in world, false);

  const config = JSON.parse(
    await fs.readFile(path.join(resolveWorldRoot(worldName), "world.json"), "utf-8")
  );
  assert.equal(config.name, worldName);
});

test("updateWorld only updates world profile fields", async () => {
  const worldName = "core-world-update";
  await resetWorld(worldName);
  await createWorld({ name: worldName });

  const world = await updateWorld(worldName, {
    name: "Renamed World",
    description: "Updated"
  });

  assert.equal(world.name, worldName);
  assert.equal(world.displayName, "Renamed World");
  assert.equal(world.description, "Updated");
});

test("saveWorldThumbnail stores thumbnail metadata", async () => {
  const worldName = "core-world-thumbnail";
  await resetWorld(worldName);
  await createWorld({ name: worldName });

  const world = await saveWorldThumbnail(worldName, "cover.webp", Buffer.from("image"));
  assert.equal(world.thumbnail.filename, "thumbnail.webp");
  assert.equal(typeof world.thumbnail.updatedAt, "number");

  const config = JSON.parse(
    await fs.readFile(path.join(resolveWorldRoot(worldName), "world.json"), "utf-8")
  );
  assert.equal(config.thumbnail.filename, "thumbnail.webp");

  await assert.rejects(
    () => saveWorldThumbnail(worldName, "cover.txt", Buffer.from("nope")),
    { code: "INVALID_THUMBNAIL" }
  );
});

test("setHomePage only accepts root container documents", async () => {
  const worldName = "core-world-homepage";
  await resetWorld(worldName);
  await createWorld({ name: worldName });

  const rootDocument = await createDocument(worldName, "Characters", "", {
    type: "container"
  });
  const childDocument = await createDocument(worldName, `${rootDocument.path}/Allies`, "", {
    type: "container"
  });
  const tab = await createDocument(worldName, `${rootDocument.path}/Overview`, "# Notes", {
    type: "tab",
    contentType: "wiki"
  });

  let config = await setHomePage(worldName, rootDocument.path);
  assert.equal(config.homePage, rootDocument.path);

  config = await setHomePage(worldName, null);
  assert.equal(config.homePage, null);

  await assert.rejects(
    () => setHomePage(worldName, childDocument.path),
    { code: "INVALID_HOME_PAGE" }
  );
  await assert.rejects(
    () => setHomePage(worldName, tab.path),
    { code: "INVALID_HOME_PAGE" }
  );
  await assert.rejects(
    () => setHomePage(worldName, "missing-root"),
    { code: "INVALID_HOME_PAGE" }
  );
});

test("world members filter common user world access", async () => {
  const worldA = "core-members-a";
  const worldB = "core-members-b";
  await resetWorld(worldA);
  await resetWorld(worldB);
  await createWorld({ name: worldA });
  await createWorld({ name: worldB });

  const username = `member-${Date.now()}`;
  const user = await createUser({ username, password: "secret-pass" });
  await addWorldMember(worldA, user.id);

  const authenticated = await authenticateUser(username, "secret-pass");
  assert.equal(authenticated.username, username);

  const visibleWorlds = await listWorlds({ userId: user.id, username, isAdmin: false });
  assert.equal(visibleWorlds.some((world) => world.id === worldA), true);
  assert.equal(visibleWorlds.some((world) => world.id === worldB), false);

  const adminWorlds = await listWorlds({ userId: "admin", username: "admin", isAdmin: true });
  assert.equal(adminWorlds.some((world) => world.id === worldA), true);
  assert.equal(adminWorlds.some((world) => world.id === worldB), true);
});

test("document tree supports containers and editable tabs", async () => {
  const worldName = "core-tree-documents";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  const container = await createDocument(worldName, "Characters", "", {
    type: "container",
    icon: "Crown"
  });
  const tab = await createDocument(worldName, `${container.path}/Overview`, "# First draft", {
    type: "tab",
    contentType: "wiki"
  });

  const tree = await getFileTree(worldName);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, "Characters");
  assert.equal(tree[0].type, "container");
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].name, "Overview");
  assert.equal(tree[0].children[0].type, "tab");

  assert.deepEqual(await readDocument(worldName, tab.path), {
    path: tab.path,
    content: "# First draft"
  });

  await updateDocumentContent(worldName, tab.path, "# Revised draft");
  assert.equal((await readDocument(worldName, tab.path)).content, "# Revised draft");
});

test("document metadata changes do not move physical paths", async () => {
  const worldName = "core-tree-metadata";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  const document = await createDocument(worldName, "Locations", "", {
    type: "container"
  });

  const renamed = await renameDocument(worldName, document.path, "Places");
  assert.equal(renamed.path, document.path);
  assert.equal(renamed.name, "Places");

  const result = await updateDocumentMetadata(worldName, document.path, {
    icon: "Castle"
  });
  assert.equal(result.metadata.name, "Places");
  assert.equal(result.metadata.icon, "Castle");
});

test("deleteDocument removes a document subtree", async () => {
  const worldName = "core-tree-delete";
  await resetWorld(worldName);
  const worldPaths = await ensureWorldStructure(worldName);

  const document = await createDocument(worldName, "Factions", "", {
    type: "container"
  });

  await deleteDocument(worldName, document.path);

  await assert.rejects(
    () => fs.stat(path.join(worldPaths.pages, document.path)),
    { code: "ENOENT" }
  );
});

test("duplicateDocument can clone a document with or without children", async () => {
  const worldName = "core-tree-duplicate";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  const document = await createDocument(worldName, "Archive", "", {
    type: "container",
    icon: "Book"
  });
  const tab = await createDocument(worldName, `${document.path}/Overview`, "# Archive", {
    type: "tab",
    contentType: "wiki"
  });

  const singleCopy = await duplicateDocument(worldName, document.path, {
    name: "Archive Copy",
    includeChildren: false
  });
  const fullCopy = await duplicateDocument(worldName, document.path, {
    name: "Archive Copy",
    includeChildren: true
  });

  assert.notEqual(singleCopy.path, document.path);
  assert.notEqual(fullCopy.path, document.path);

  const tree = await getFileTree(worldName);
  const singleCopyNode = tree.find(node => node.path === singleCopy.path);
  const fullCopyNode = tree.find(node => node.path === fullCopy.path);

  assert.equal(singleCopyNode.name, "Archive Copy");
  assert.equal(singleCopyNode.icon, "Book");
  assert.equal(singleCopyNode.children.length, 0);

  assert.equal(fullCopyNode.name, "Archive Copy 2");
  assert.equal(fullCopyNode.children.length, 1);
  assert.notEqual(fullCopyNode.children[0].uid, tab.uid);
  assert.equal(fullCopyNode.children[0].name, "Overview");
  assert.equal((await readDocument(worldName, fullCopyNode.children[0].path)).content, "# Archive");
});

test("asset service creates folders, sanitizes names, and resolves conflicts", async () => {
  const worldName = "core-assets";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  const folder = await createAssetFolder(worldName, "", "Media Folder");
  assert.equal(folder.path, "Media Folder");

  const first = await saveAssetFile(worldName, folder.path, "Mapa Árvore.webp", Buffer.from("one"));
  const second = await saveAssetFile(worldName, folder.path, "Mapa Árvore.webp", Buffer.from("two"));

  assert.equal(first.name, "Mapa Arvore.webp");
  assert.equal(second.name, "Mapa Arvore 2.webp");

  const tree = await listAssets(worldName);
  assert.equal(tree.items.length, 1);
  assert.equal(tree.items[0].type, "folder");
  assert.equal(tree.items[0].children.length, 2);
  assert.equal(tree.items[0].children[0].mediaType, "image");
});

test("asset service renames, duplicates, and deletes files and folders", async () => {
  const worldName = "core-assets-actions";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  const folder = await createAssetFolder(worldName, "", "Media");
  const file = await saveAssetFile(worldName, folder.path, "portrait.webp", Buffer.from("image"));

  const renamedFile = await renameAsset(worldName, file.path, "hero.webp");
  assert.equal(renamedFile.path, "Media/hero.webp");

  const fileCopy = await duplicateAsset(worldName, renamedFile.path, {
    name: "hero Copy.webp"
  });
  assert.equal(fileCopy.path, "Media/hero Copy.webp");

  const emptyFolderCopy = await duplicateAsset(worldName, folder.path, {
    name: "Media Copy",
    includeChildren: false
  });
  assert.equal(emptyFolderCopy.path, "Media Copy");

  const fullFolderCopy = await duplicateAsset(worldName, folder.path, {
    name: "Media Copy",
    includeChildren: true
  });
  assert.equal(fullFolderCopy.path, "Media Copy 2");

  let tree = await listAssets(worldName);
  assert.equal(tree.items.find(item => item.path === "Media Copy").children.length, 0);
  assert.equal(tree.items.find(item => item.path === "Media Copy 2").children.length, 2);

  await deleteAsset(worldName, "Media/hero Copy.webp");
  tree = await listAssets(worldName);
  assert.equal(tree.items.find(item => item.path === "Media").children.length, 1);

  const renamedFolder = await renameAsset(worldName, "Media Copy", "Empty Media");
  assert.equal(renamedFolder.path, "Empty Media");
});

test("asset service moves files and folders between folders", async () => {
  const worldName = "core-assets-move";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  const sourceFolder = await createAssetFolder(worldName, "", "Source");
  const targetFolder = await createAssetFolder(worldName, "", "Target");
  const nestedFolder = await createAssetFolder(worldName, sourceFolder.path, "Nested");
  const file = await saveAssetFile(worldName, sourceFolder.path, "portrait.webp", Buffer.from("image"));

  const movedFile = await moveAsset(worldName, file.path, targetFolder.path);
  assert.equal(movedFile.path, "Target/portrait.webp");

  const movedFolder = await moveAsset(worldName, nestedFolder.path, targetFolder.path);
  assert.equal(movedFolder.path, "Target/Nested");

  const movedToRoot = await moveAsset(worldName, movedFile.path, "");
  assert.equal(movedToRoot.path, "portrait.webp");

  const tree = await listAssets(worldName);
  const target = tree.items.find(item => item.path === "Target");
  assert.equal(target.children.some(item => item.path === "Target/Nested"), true);
  assert.equal(tree.items.some(item => item.path === "portrait.webp"), true);
});

test("asset service resolves move conflicts and rejects invalid move targets", async () => {
  const worldName = "core-assets-move-guards";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  const sourceFolder = await createAssetFolder(worldName, "", "Source");
  const targetFolder = await createAssetFolder(worldName, "", "Target");
  await saveAssetFile(worldName, sourceFolder.path, "map.webp", Buffer.from("source"));
  await saveAssetFile(worldName, targetFolder.path, "map.webp", Buffer.from("target"));

  const movedFile = await moveAsset(worldName, "Source/map.webp", targetFolder.path);
  assert.equal(movedFile.path, "Target/map 2.webp");

  const childFolder = await createAssetFolder(worldName, targetFolder.path, "Child");
  await assert.rejects(
    () => moveAsset(worldName, targetFolder.path, childFolder.path),
    { code: "INVALID_PATH" }
  );

  await assert.rejects(
    () => moveAsset(worldName, targetFolder.path, targetFolder.path),
    { code: "INVALID_PATH" }
  );

  await assert.rejects(
    () => moveAsset(worldName, "Target/map.webp", movedFile.path),
    { code: "INVALID_PATH" }
  );

  await assert.rejects(
    () => moveAsset(worldName, "Target/map.webp", "../pages"),
    { code: "INVALID_PATH" }
  );
});

test("asset service migrates legacy Assets directory into lowercase assets", async () => {
  const worldName = "core-assets-migration";
  await resetWorld(worldName);

  const worldRoot = resolveWorldRoot(worldName);
  await fs.mkdir(path.join(worldRoot, "Assets", "Folder"), { recursive: true });
  await fs.mkdir(path.join(worldRoot, "assets", "Folder"), { recursive: true });
  await fs.writeFile(path.join(worldRoot, "Assets", "Folder", "map.webp"), "legacy", "utf-8");
  await fs.writeFile(path.join(worldRoot, "assets", "Folder", "map.webp"), "current", "utf-8");

  await ensureWorldStructure(worldName);

  await assert.rejects(
    () => fs.stat(path.join(worldRoot, "Assets")),
    { code: "ENOENT" }
  );

  const tree = await listAssets(worldName);
  assert.equal(tree.items.length, 1);
  assert.equal(tree.items[0].path, "Folder");
  assert.deepEqual(
    tree.items[0].children.map((item) => item.name),
    ["map 2.webp", "map.webp"]
  );
  assert.equal(
    await fs.readFile(path.join(worldRoot, "assets", "Folder", "map.webp"), "utf-8"),
    "current"
  );
  assert.equal(
    await fs.readFile(path.join(worldRoot, "assets", "Folder", "map 2.webp"), "utf-8"),
    "legacy"
  );
});

test("asset service rejects traversal outside assets", async () => {
  const worldName = "core-assets-traversal";
  await resetWorld(worldName);
  await ensureWorldStructure(worldName);

  await assert.rejects(
    () => createAssetFolder(worldName, "../pages", "Evil"),
    { code: "INVALID_PATH" }
  );

  await assert.rejects(
    () => saveAssetFile(worldName, "", "../evil.webp", Buffer.from("evil")),
    { code: "INVALID_PATH" }
  );
});

test("deleteWorld removes the world directory", async () => {
  const worldName = "core-world-delete";
  await resetWorld(worldName);
  await createWorld({ name: worldName });

  await deleteWorld(worldName);

  await assert.rejects(
    () => fs.stat(resolveWorldRoot(worldName)),
    { code: "ENOENT" }
  );
  createdWorlds.delete(worldName);
});
