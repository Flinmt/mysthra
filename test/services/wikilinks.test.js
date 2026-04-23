const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractWikilinks,
  normalizeWikilinkTarget
} = require("../../src/services/wikilinks");

test("normalizeWikilinkTarget trims and normalizes spaces", () => {
  assert.equal(normalizeWikilinkTarget("  King   Tharos  "), "King Tharos");
});

test("extractWikilinks returns an empty list when there are no wikilinks", () => {
  assert.deepEqual(extractWikilinks("No linked entities here."), []);
});

test("extractWikilinks detects wikilinks in markdown", () => {
  const links = extractWikilinks("Ruled by [[King Tharos]] in [[Eldoria]].");

  assert.deepEqual(links, [
    {
      raw: "[[King Tharos]]",
      target: "King Tharos",
      index: 9,
      length: 15
    },
    {
      raw: "[[Eldoria]]",
      target: "Eldoria",
      index: 28,
      length: 11
    }
  ]);
});

test("extractWikilinks ignores empty or malformed wikilinks", () => {
  const links = extractWikilinks("[[]] [[Valid Link]] [[Broken]");

  assert.deepEqual(links, [
    {
      raw: "[[Valid Link]]",
      target: "Valid Link",
      index: 5,
      length: 14
    }
  ]);
});

test("extractWikilinks works across multiple lines", () => {
  const links = extractWikilinks("# Eldoria\nRuled by [[King Tharos]]\nCapital: [[Silver Keep]]");

  assert.equal(links.length, 2);
  assert.equal(links[0].target, "King Tharos");
  assert.equal(links[1].target, "Silver Keep");
});
