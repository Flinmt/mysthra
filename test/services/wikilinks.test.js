const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractWikilinks,
  normalizeWikilinkTarget,
  renderWikilinksToHtml,
  slugFromWikilinkTarget
} = require("../../src/services/wikilinks");

test("normalizeWikilinkTarget trims and normalizes spaces", () => {
  assert.equal(normalizeWikilinkTarget("  King   Tharos  "), "King Tharos");
});

test("slugFromWikilinkTarget converts a target to a slug", () => {
  assert.equal(slugFromWikilinkTarget("King Tharos"), "king-tharos");
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

test("renderWikilinksToHtml converts wikilinks into anchor tags", () => {
  const html = renderWikilinksToHtml("Ruled by [[King Tharos]] in [[Eldoria]].");

  assert.equal(
    html,
    "Ruled by <a class=\"wikilink\" data-slug=\"king-tharos\" href=\"/pages/king-tharos\">King Tharos</a> in <a class=\"wikilink\" data-slug=\"eldoria\" href=\"/pages/eldoria\">Eldoria</a>."
  );
});

test("renderWikilinksToHtml marks unresolved links when resolved slugs are provided", () => {
  const html = renderWikilinksToHtml("Visit [[Silver Keep]] and [[Eldoria]].", {
    resolvedSlugs: ["eldoria"]
  });

  assert.equal(
    html,
    "Visit <a class=\"wikilink unresolved\" data-slug=\"silver-keep\" href=\"/pages/silver-keep\">Silver Keep</a> and <a class=\"wikilink\" data-slug=\"eldoria\" href=\"/pages/eldoria\">Eldoria</a>."
  );
});
