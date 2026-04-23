const { listPages, readPage } = require("./pages");
const { ENTITY_TYPES, listEntities } = require("./entities");
const { extractWikilinks, normalizeWikilinkTarget, slugFromWikilinkTarget } = require("./wikilinks");

async function listAllEntities(worldName) {
  const entityGroups = await Promise.all(
    ENTITY_TYPES.map((type) => listEntities(worldName, type))
  );

  return entityGroups.flat();
}

async function resolveLinkTarget(worldName, target) {
  const normalizedTarget = normalizeWikilinkTarget(target);
  const slug = slugFromWikilinkTarget(normalizedTarget);

  const pages = await listPages(worldName);
  const matchedPage = pages.find((page) => page.slug === slug || page.title === normalizedTarget);

  if (matchedPage) {
    return {
      kind: "page",
      target: normalizedTarget,
      slug: matchedPage.slug,
      href: `/pages/${matchedPage.slug}`,
      page: matchedPage
    };
  }

  const entities = await listAllEntities(worldName);
  const matchedEntity = entities.find(
    (entity) => entity.id === slug || entity.name === normalizedTarget
  );

  if (matchedEntity) {
    return {
      kind: "entity",
      target: normalizedTarget,
      slug: matchedEntity.id,
      href: `/entities/${matchedEntity.type}/${matchedEntity.id}`,
      entity: matchedEntity
    };
  }

  return {
    kind: "unresolved",
    target: normalizedTarget,
    slug,
    href: `/pages/${slug}`
  };
}

async function resolvePageLinks(worldName, pageIdOrSlug) {
  const page = await readPage(worldName, pageIdOrSlug);
  const wikilinks = extractWikilinks(page.content);

  const links = await Promise.all(
    wikilinks.map(async (link) => ({
      ...link,
      resolution: await resolveLinkTarget(worldName, link.target)
    }))
  );

  return {
    page: page.slug,
    links
  };
}

module.exports = {
  listAllEntities,
  resolveLinkTarget,
  resolvePageLinks
};
