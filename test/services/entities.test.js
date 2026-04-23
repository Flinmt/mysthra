const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENTITY_TYPES,
  createEntityDefinition,
  normalizeEntityId,
  normalizeEntityType,
  validateEntityDefinition
} = require("../../src/services/entities");

test("ENTITY_TYPES exposes the supported entity categories", () => {
  assert.deepEqual(ENTITY_TYPES, ["character", "location", "item", "event"]);
});

test("normalizeEntityType accepts supported entity types", () => {
  assert.equal(normalizeEntityType("character"), "character");
  assert.equal(normalizeEntityType("Location"), "location");
});

test("normalizeEntityType rejects unsupported entity types", () => {
  assert.throws(
    () => normalizeEntityType("faction"),
    { code: "INVALID_ENTITY" }
  );
});

test("normalizeEntityId converts values to a safe slug id", () => {
  assert.equal(normalizeEntityId("King Tharos"), "king-tharos");
});

test("createEntityDefinition builds the base entity schema", () => {
  const entity = createEntityDefinition({
    type: "character",
    name: "King Tharos",
    description: "Tyrant ruler of Eldoria"
  });

  assert.deepEqual(entity, {
    id: "king-tharos",
    type: "character",
    name: "King Tharos",
    description: "Tyrant ruler of Eldoria"
  });
});

test("validateEntityDefinition accepts a normalized entity", () => {
  const entity = validateEntityDefinition({
    id: "silver-keep",
    type: "location",
    name: "Silver Keep",
    description: "A fortress city in the north"
  });

  assert.deepEqual(entity, {
    id: "silver-keep",
    type: "location",
    name: "Silver Keep",
    description: "A fortress city in the north"
  });
});

test("validateEntityDefinition rejects non-normalized ids", () => {
  assert.throws(
    () => validateEntityDefinition({
      id: "Silver Keep",
      type: "location",
      name: "Silver Keep",
      description: "A fortress city in the north"
    }),
    { code: "INVALID_ENTITY" }
  );
});
