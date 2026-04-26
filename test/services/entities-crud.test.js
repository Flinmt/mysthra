const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const test = require("node:test");

const { resolveWorldRoot } = require("../../src/data");
const {
  createEntity,
  deleteEntity,
  getEntityFilePath,
  listEntities,
  readEntity,
  updateEntity
} = require("../../src/services/entities");

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

test("createEntity writes an entity JSON file", async () => {
  const worldName = "entities-create-world";
  await resetWorld(worldName);

  const entity = await createEntity(worldName, {
    type: "character",
    name: "King Tharos",
    description: "Tyrant ruler of Eldoria"
  });

  const filePath = getEntityFilePath(worldName, "character", "king-tharos");
  const fileContent = JSON.parse(await fs.readFile(filePath, "utf8"));

  assert.deepEqual(entity, fileContent);
});

test("readEntity loads a stored entity", async () => {
  const worldName = "entities-read-world";
  await resetWorld(worldName);

  await createEntity(worldName, {
    type: "location",
    name: "Silver Keep",
    description: "A fortress city in the north"
  });

  const entity = await readEntity(worldName, "location", "silver-keep");

  assert.equal(entity.name, "Silver Keep");
  assert.equal(entity.type, "location");
});

test("listEntities returns all entities of a type", async () => {
  const worldName = "entities-list-world";
  await resetWorld(worldName);

  await createEntity(worldName, {
    type: "item",
    name: "Crown of Dawn",
    description: "Ancient royal artifact"
  });
  await createEntity(worldName, {
    type: "item",
    name: "Sword of Ash",
    description: "A blade from the old wars"
  });

  const entities = await listEntities(worldName, "item");

  assert.equal(entities.length, 2);
  assert.equal(entities[0].type, "item");
  assert.equal(entities[1].type, "item");
});

test("updateEntity replaces stored entity fields safely", async () => {
  const worldName = "entities-update-world";
  await resetWorld(worldName);

  await createEntity(worldName, {
    type: "event",
    name: "Fall of Eldoria",
    description: "The empire collapsed"
  });

  const entity = await updateEntity(worldName, "event", "fall-of-eldoria", {
    description: "The empire collapsed after the northern wars"
  });

  assert.equal(entity.description, "The empire collapsed after the northern wars");
  assert.equal(entity.id, "fall-of-eldoria");
});

test("deleteEntity removes an entity file", async () => {
  const worldName = "entities-delete-world";
  await resetWorld(worldName);

  await createEntity(worldName, {
    type: "character",
    name: "King Tharos",
    description: "Tyrant ruler of Eldoria"
  });

  const deletion = await deleteEntity(worldName, "character", "king-tharos");

  assert.deepEqual(deletion, {
    id: "king-tharos",
    type: "character",
    deleted: true
  });

  await assert.rejects(
    () => readEntity(worldName, "character", "king-tharos"),
    { code: "ENTITY_NOT_FOUND" }
  );
});
