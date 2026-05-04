const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { ensureWorldStructure, getWorldPaths, resolveWorldRoot } = require("../../src/data");
const {
  createDocument,
  createWorld,
  deleteDocument,
  deleteWorld,
  duplicateDocument,
  getFileTree,
  readDocument,
  renameDocument,
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
