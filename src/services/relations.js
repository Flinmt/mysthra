const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureWorldStructure, getWorldPaths } = require("../data");
const { readPage } = require("./pages");
const { extractWikilinks, slugFromWikilinkTarget } = require("./wikilinks");

function buildPageRelations(page, wikilinks) {
  return wikilinks.map((link) => ({
    from: page.slug,
    to: slugFromWikilinkTarget(link.target),
    label: link.target,
    type: "wikilink"
  }));
}

async function readRelationsFile(worldName) {
  await ensureWorldStructure(worldName);

  const { relations: relationsDirectory } = getWorldPaths(worldName);
  const relationsFilePath = path.join(relationsDirectory, "relations.json");

  try {
    const content = await fs.readFile(relationsFilePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeRelationsFile(worldName, relations) {
  await ensureWorldStructure(worldName);

  const { relations: relationsDirectory } = getWorldPaths(worldName);
  const relationsFilePath = path.join(relationsDirectory, "relations.json");

  await fs.writeFile(relationsFilePath, JSON.stringify(relations, null, 2), "utf8");

  return relationsFilePath;
}

async function generatePageRelations(worldName, pageIdOrSlug) {
  const page = await readPage(worldName, pageIdOrSlug);
  const wikilinks = extractWikilinks(page.content);
  const pageRelations = buildPageRelations(page, wikilinks);
  const existingRelations = await readRelationsFile(worldName);
  const preservedRelations = existingRelations.filter((relation) => relation.from !== page.slug);
  const nextRelations = [...preservedRelations, ...pageRelations];

  const filePath = await writeRelationsFile(worldName, nextRelations);

  return {
    page: page.slug,
    relations: pageRelations,
    filePath
  };
}

module.exports = {
  buildPageRelations,
  generatePageRelations,
  readRelationsFile,
  writeRelationsFile
};
