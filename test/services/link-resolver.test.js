const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const test = require("node:test");

const { resolveWorldRoot } = require("../../src/data");
const { createEntity } = require("../../src/services/entities");
const { createPage } = require("../../src/services/pages");
const {
  listAllEntities,
  resolveLinkTarget,
  resolvePageLinks
} = require("../../src/services/link-resolver");

async function resetWorld(worldName) {
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
}

test("listAllEntities returns entities across all supported types", async () => {
  const worldName = "link-resolver-entities-world";
  await resetWorld(worldName);

  await createEntity(worldName, {
    type: "character",
    name: "King Tharos",
    description: "Tyrant ruler of Eldoria"
  });
  await createEntity(worldName, {
    type: "location",
    name: "Silver Keep",
    description: "A fortress city in the north"
  });

  const entities = await listAllEntities(worldName);

  assert.equal(entities.length, 2);
});

test("resolveLinkTarget matches a page before an entity", async () => {
  const worldName = "link-resolver-page-world";
  await resetWorld(worldName);

  await createPage(worldName, {
    title: "Eldoria",
    content: "# Eldoria\nNorthern empire\n"
  });
  await createEntity(worldName, {
    type: "location",
    name: "Eldoria",
    description: "A region in the north"
  });

  const resolution = await resolveLinkTarget(worldName, "Eldoria");

  assert.equal(resolution.kind, "page");
  assert.equal(resolution.href, "/pages/eldoria");
});

test("resolveLinkTarget matches an entity when no page exists", async () => {
  const worldName = "link-resolver-entity-world";
  await resetWorld(worldName);

  await createEntity(worldName, {
    type: "character",
    name: "King Tharos",
    description: "Tyrant ruler of Eldoria"
  });

  const resolution = await resolveLinkTarget(worldName, "King Tharos");

  assert.equal(resolution.kind, "entity");
  assert.equal(resolution.href, "/entities/character/king-tharos");
});

test("resolveLinkTarget returns unresolved when nothing matches", async () => {
  const worldName = "link-resolver-missing-world";
  await resetWorld(worldName);

  const resolution = await resolveLinkTarget(worldName, "Unknown Realm");

  assert.equal(resolution.kind, "unresolved");
  assert.equal(resolution.slug, "unknown-realm");
});

test("resolvePageLinks resolves all wikilinks in a page", async () => {
  const worldName = "link-resolver-page-links-world";
  await resetWorld(worldName);

  await createPage(worldName, {
    title: "Eldoria",
    content: "# Eldoria\nRuled by [[King Tharos]] from [[Silver Keep]].\n"
  });
  await createEntity(worldName, {
    type: "character",
    name: "King Tharos",
    description: "Tyrant ruler of Eldoria"
  });

  const result = await resolvePageLinks(worldName, "eldoria");

  assert.equal(result.page, "eldoria");
  assert.equal(result.links.length, 2);
  assert.equal(result.links[0].resolution.kind, "entity");
  assert.equal(result.links[1].resolution.kind, "unresolved");
});
