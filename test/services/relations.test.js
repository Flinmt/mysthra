const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { resolveWorldRoot } = require("../../src/data");
const { createPage } = require("../../src/services/pages");
const {
  buildPageRelations,
  generatePageRelations,
  readRelationsFile
} = require("../../src/services/relations");

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

test("buildPageRelations converts wikilinks into relation entries", () => {
  const relations = buildPageRelations(
    { slug: "eldoria" },
    [
      { target: "King Tharos" },
      { target: "Silver Keep" }
    ]
  );

  assert.deepEqual(relations, [
    {
      from: "eldoria",
      to: "king-tharos",
      label: "King Tharos",
      type: "wikilink"
    },
    {
      from: "eldoria",
      to: "silver-keep",
      label: "Silver Keep",
      type: "wikilink"
    }
  ]);
});

test("generatePageRelations saves relation data to relations.json", async () => {
  const worldName = "relations-world";
  await resetWorld(worldName);

  await createPage(worldName, {
    title: "Eldoria",
    content: "# Eldoria\nRuled by [[King Tharos]] from [[Silver Keep]].\n"
  });

  const result = await generatePageRelations(worldName, "eldoria");
  const savedRelations = await readRelationsFile(worldName);

  assert.equal(result.page, "eldoria");
  assert.equal(path.basename(result.filePath), "relations.json");
  assert.deepEqual(savedRelations, [
    {
      from: "eldoria",
      to: "king-tharos",
      label: "King Tharos",
      type: "wikilink"
    },
    {
      from: "eldoria",
      to: "silver-keep",
      label: "Silver Keep",
      type: "wikilink"
    }
  ]);
});

test("generatePageRelations replaces existing relations for the same page", async () => {
  const worldName = "relations-update-world";
  await resetWorld(worldName);

  await createPage(worldName, {
    title: "Eldoria",
    content: "# Eldoria\nRuled by [[King Tharos]].\n"
  });

  await generatePageRelations(worldName, "eldoria");

  await createPage(worldName, {
    title: "Northern Marches",
    content: "# Northern Marches\nBordered by [[Eldoria]].\n"
  });

  await generatePageRelations(worldName, "northern-marches");

  await fs.writeFile(
    path.join(resolveWorldRoot(worldName), "pages", "eldoria.md"),
    "# Eldoria\nAllied with [[Silver Keep]].\n",
    "utf8"
  );

  await generatePageRelations(worldName, "eldoria");

  const savedRelations = await readRelationsFile(worldName);

  assert.deepEqual(savedRelations, [
    {
      from: "northern-marches",
      to: "eldoria",
      label: "Eldoria",
      type: "wikilink"
    },
    {
      from: "eldoria",
      to: "silver-keep",
      label: "Silver Keep",
      type: "wikilink"
    }
  ]);
});
